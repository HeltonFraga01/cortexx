/**
 * ReportGenerator Service
 * 
 * Gera relatórios detalhados de campanhas:
 * - Estatísticas completas
 * - Categorização de erros
 * - Exportação para CSV
 * - Comparação entre campanhas
 */

const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class ReportGenerator {
  /**
   * Constructor - no longer requires db parameter
   */
  constructor() {
    // Uses SupabaseService directly
  }

  /**
   * Gera relatório completo de uma campanha
   */
  async generateReport(campaignId) {
    try {
      logger.info('Gerando relatório', { campaignId });

      // Buscar dados da campanha
      const campaign = await this.getCampaignData(campaignId);
      
      if (!campaign) {
        throw new Error('Campanha não encontrada');
      }

      // Buscar contatos da campanha
      const contacts = await this.getCampaignContacts(campaignId);

      // Calcular estatísticas
      const stats = this.calculateStatistics(contacts);

      // Categorizar erros
      const errorsByType = this.categorizeErrors(contacts);

      // Calcular duração
      const duration = this.calculateDuration(campaign);

      // Buscar ou criar relatório no banco
      const report = await this.saveReport(campaignId, {
        total_contacts: stats.total,
        sent_count: stats.sent,
        failed_count: stats.failed,
        success_rate: stats.successRate,
        duration_seconds: duration,
        errors_by_type: JSON.stringify(errorsByType)
      });

      logger.info('Relatório gerado', {
        campaignId,
        reportId: report.id
      });

      return {
        campaignId,
        campaignName: campaign.name,
        instance: campaign.instance,
        executedAt: campaign.started_at,
        completedAt: campaign.completed_at,
        duration,
        stats,
        errorsByType,
        errors: contacts.filter(c => c.status === 'failed'),
        config: {
          messageType: campaign.message_type,
          delayMin: campaign.delay_min,
          delayMax: campaign.delay_max,
          randomizeOrder: campaign.randomize_order === 1
        }
      };

    } catch (error) {
      logger.error('Erro ao gerar relatório:', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Busca dados da campanha
   */
  async getCampaignData(campaignId) {
    const { data, error } = await SupabaseService.getById('bulk_campaigns', campaignId);
    if (error && error.code !== 'PGRST116') {
      logger.error('Error fetching campaign data', { campaignId, error: error.message });
      throw error;
    }
    return data;
  }

  /**
   * Busca contatos da campanha
   */
  async getCampaignContacts(campaignId) {
    const { data, error } = await SupabaseService.queryAsAdmin('campaign_contacts', (query) => {
      return query
        .select('*')
        .eq('campaign_id', campaignId)
        .order('processing_order', { ascending: true });
    });
    
    if (error) {
      logger.error('Error fetching campaign contacts', { campaignId, error: error.message });
      throw error;
    }
    
    return (data || []).map(row => ({
      id: row.id,
      phone: row.phone,
      name: row.name,
      status: row.status,
      errorType: row.error_type,
      errorMessage: row.error_message,
      sentAt: row.sent_at
    }));
  }

  /**
   * Calcula estatísticas da campanha
   */
  calculateStatistics(contacts) {
    const total = contacts.length;
    const sent = contacts.filter(c => c.status === 'sent').length;
    const failed = contacts.filter(c => c.status === 'failed').length;
    const pending = contacts.filter(c => c.status === 'pending').length;
    const successRate = total > 0 ? (sent / total) * 100 : 0;

    return {
      total,
      sent,
      failed,
      pending,
      successRate: Math.round(successRate * 100) / 100
    };
  }

  /**
   * Categoriza erros por tipo
   */
  categorizeErrors(contacts) {
    const errorsByType = {
      invalid_number: 0,
      disconnected: 0,
      timeout: 0,
      api_error: 0
    };

    contacts
      .filter(c => c.status === 'failed' && c.errorType)
      .forEach(c => {
        if (errorsByType.hasOwnProperty(c.errorType)) {
          errorsByType[c.errorType]++;
        } else {
          errorsByType.api_error++;
        }
      });

    return errorsByType;
  }

  /**
   * Calcula duração da campanha em segundos
   */
  calculateDuration(campaign) {
    if (!campaign.started_at || !campaign.completed_at) {
      return 0;
    }

    const start = new Date(campaign.started_at);
    const end = new Date(campaign.completed_at);
    const durationMs = end - start;
    
    return Math.round(durationMs / 1000);
  }

  /**
   * Salva relatório no banco de dados
   */
  async saveReport(campaignId, reportData) {
    try {
      // Verificar se já existe relatório
      const { data: existingReport, error: checkError } = await SupabaseService.queryAsAdmin('campaign_reports', (query) => {
        return query.select('*').eq('campaign_id', campaignId).single();
      });

      if (existingReport && !checkError) {
        // Atualizar relatório existente
        const { data, error } = await SupabaseService.update('campaign_reports', existingReport.id, {
          total_contacts: reportData.total_contacts,
          sent_count: reportData.sent_count,
          failed_count: reportData.failed_count,
          success_rate: reportData.success_rate,
          duration_seconds: reportData.duration_seconds,
          errors_by_type: reportData.errors_by_type,
          generated_at: new Date().toISOString()
        });

        if (error) throw error;
        return data || existingReport;
      } else {
        // Criar novo relatório
        const { data, error } = await SupabaseService.insert('campaign_reports', {
          campaign_id: campaignId,
          total_contacts: reportData.total_contacts,
          sent_count: reportData.sent_count,
          failed_count: reportData.failed_count,
          success_rate: reportData.success_rate,
          duration_seconds: reportData.duration_seconds,
          errors_by_type: reportData.errors_by_type
        });

        if (error) throw error;
        return data || { campaign_id: campaignId };
      }

    } catch (error) {
      logger.error('Erro ao salvar relatório:', error.message);
      throw error;
    }
  }

  /**
   * Exporta relatório para CSV
   */
  async exportToCSV(campaignId) {
    try {
      logger.info('Exportando relatório para CSV', { campaignId });

      const report = await this.generateReport(campaignId);

      // Cabeçalho do CSV
      const headers = [
        'Telefone',
        'Nome',
        'Status',
        'Tipo de Erro',
        'Mensagem de Erro',
        'Enviado Em'
      ];

      // Linhas de dados
      const rows = report.errors.map(contact => [
        contact.phone,
        contact.name || '',
        contact.status,
        contact.errorType || '',
        contact.errorMessage || '',
        contact.sentAt || ''
      ]);

      // Adicionar linha de resumo
      rows.unshift([]);
      rows.unshift([
        'RESUMO DA CAMPANHA',
        report.campaignName,
        '',
        '',
        '',
        ''
      ]);
      rows.unshift([
        'Total de Contatos',
        report.stats.total,
        'Enviados',
        report.stats.sent,
        'Falhas',
        report.stats.failed
      ]);
      rows.unshift([
        'Taxa de Sucesso',
        `${report.stats.successRate}%`,
        'Duração',
        `${report.duration}s`,
        '',
        ''
      ]);
      rows.unshift([]);

      // Adicionar cabeçalho de erros
      rows.push([]);
      rows.push(['DETALHES DOS ERROS']);
      rows.push(headers);

      // Converter para string CSV
      const csvContent = rows
        .map(row => row.map(cell => this.escapeCSV(cell)).join(','))
        .join('\n');

      logger.info('CSV gerado', {
        campaignId,
        lines: rows.length
      });

      return csvContent;

    } catch (error) {
      logger.error('Erro ao exportar CSV:', {
        campaignId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Escapa valores para CSV
   */
  escapeCSV(value) {
    if (value === null || value === undefined) {
      return '';
    }

    const stringValue = String(value);
    
    // Se contém vírgula, aspas ou quebra de linha, envolver em aspas
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  }

  /**
   * Compara múltiplas campanhas
   */
  async compareCampaigns(campaignIds) {
    try {
      logger.info('Comparando campanhas', {
        campaignIds,
        count: campaignIds.length
      });

      const reports = [];

      for (const campaignId of campaignIds) {
        const report = await this.generateReport(campaignId);
        reports.push(report);
      }

      // Calcular médias
      const avgStats = this.calculateAverageStats(reports);

      // Identificar melhor e pior campanha
      const bestCampaign = this.findBestCampaign(reports);
      const worstCampaign = this.findWorstCampaign(reports);

      logger.info('Comparação concluída', {
        campaignsCompared: reports.length,
        avgSuccessRate: avgStats.successRate
      });

      return {
        campaigns: reports,
        averages: avgStats,
        best: bestCampaign,
        worst: worstCampaign,
        insights: this.generateInsights(reports)
      };

    } catch (error) {
      logger.error('Erro ao comparar campanhas:', error.message);
      throw error;
    }
  }

  /**
   * Calcula estatísticas médias
   */
  calculateAverageStats(reports) {
    if (reports.length === 0) {
      return {
        successRate: 0,
        duration: 0,
        totalContacts: 0
      };
    }

    const sum = reports.reduce((acc, report) => ({
      successRate: acc.successRate + report.stats.successRate,
      duration: acc.duration + report.duration,
      totalContacts: acc.totalContacts + report.stats.total
    }), { successRate: 0, duration: 0, totalContacts: 0 });

    return {
      successRate: Math.round((sum.successRate / reports.length) * 100) / 100,
      duration: Math.round(sum.duration / reports.length),
      totalContacts: Math.round(sum.totalContacts / reports.length)
    };
  }

  /**
   * Encontra campanha com melhor taxa de sucesso
   */
  findBestCampaign(reports) {
    if (reports.length === 0) return null;

    return reports.reduce((best, current) => {
      return current.stats.successRate > best.stats.successRate ? current : best;
    });
  }

  /**
   * Encontra campanha com pior taxa de sucesso
   */
  findWorstCampaign(reports) {
    if (reports.length === 0) return null;

    return reports.reduce((worst, current) => {
      return current.stats.successRate < worst.stats.successRate ? current : worst;
    });
  }

  /**
   * Gera insights sobre as campanhas
   */
  generateInsights(reports) {
    const insights = [];

    if (reports.length === 0) {
      return insights;
    }

    // Insight sobre taxa de sucesso
    const avgSuccessRate = this.calculateAverageStats(reports).successRate;
    if (avgSuccessRate >= 90) {
      insights.push({
        type: 'success',
        message: `Excelente taxa de sucesso média: ${avgSuccessRate}%`
      });
    } else if (avgSuccessRate < 70) {
      insights.push({
        type: 'warning',
        message: `Taxa de sucesso abaixo do esperado: ${avgSuccessRate}%. Revise os números de telefone.`
      });
    }

    // Insight sobre erros comuns
    const allErrors = reports.flatMap(r => 
      Object.entries(r.errorsByType).map(([type, count]) => ({ type, count }))
    );
    
    const errorTotals = allErrors.reduce((acc, { type, count }) => {
      acc[type] = (acc[type] || 0) + count;
      return acc;
    }, {});

    const mostCommonError = Object.entries(errorTotals)
      .sort(([, a], [, b]) => b - a)[0];

    if (mostCommonError && mostCommonError[1] > 0) {
      const errorMessages = {
        invalid_number: 'Muitos números inválidos detectados. Valide os números antes de enviar.',
        disconnected: 'Muitos números desconectados. Atualize sua lista de contatos.',
        timeout: 'Muitos timeouts. Verifique a conexão com WUZAPI.',
        api_error: 'Muitos erros de API. Verifique a configuração do WUZAPI.'
      };

      insights.push({
        type: 'info',
        message: errorMessages[mostCommonError[0]] || 'Erros detectados nas campanhas.'
      });
    }

    // Insight sobre duração
    const avgDuration = this.calculateAverageStats(reports).duration;
    const avgContacts = this.calculateAverageStats(reports).totalContacts;
    const timePerContact = avgContacts > 0 ? avgDuration / avgContacts : 0;

    if (timePerContact > 30) {
      insights.push({
        type: 'info',
        message: `Tempo médio por contato: ${Math.round(timePerContact)}s. Considere reduzir os delays.`
      });
    }

    return insights;
  }

  /**
   * Lista relatórios de campanhas
   */
  async listReports(filters = {}) {
    try {
      // Build query with filters
      const { data, error } = await SupabaseService.queryAsAdmin('campaign_reports', (query) => {
        let q = query.select(`
          *,
          bulk_campaigns!inner (
            name,
            instance,
            started_at,
            completed_at
          )
        `);

        if (filters.instance) {
          q = q.eq('bulk_campaigns.instance', filters.instance);
        }

        if (filters.minSuccessRate !== undefined) {
          q = q.gte('success_rate', filters.minSuccessRate);
        }

        q = q.order('generated_at', { ascending: false });

        if (filters.limit) {
          q = q.limit(filters.limit);
        }

        return q;
      });

      if (error) {
        logger.error('Error listing reports', { error: error.message });
        throw error;
      }

      return (data || []).map(row => ({
        id: row.id,
        campaignId: row.campaign_id,
        campaignName: row.bulk_campaigns?.name,
        instance: row.bulk_campaigns?.instance,
        stats: {
          total: row.total_contacts,
          sent: row.sent_count,
          failed: row.failed_count,
          successRate: row.success_rate
        },
        duration: row.duration_seconds,
        errorsByType: typeof row.errors_by_type === 'string' 
          ? JSON.parse(row.errors_by_type || '{}') 
          : (row.errors_by_type || {}),
        generatedAt: row.generated_at,
        startedAt: row.bulk_campaigns?.started_at,
        completedAt: row.bulk_campaigns?.completed_at
      }));

    } catch (error) {
      logger.error('Erro ao listar relatórios:', error.message);
      throw error;
    }
  }
}

module.exports = ReportGenerator;
