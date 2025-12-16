const { logger } = require('../utils/logger');

class AnalyticsService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Obtém métricas gerais de todas as campanhas
     */
    async getOverviewMetrics(userToken) {
        try {
            const sql = `
        SELECT 
          COUNT(*) as total_campaigns,
          SUM(total_contacts) as total_messages,
          SUM(sent_count) as total_sent,
          SUM(failed_count) as total_failed,
          SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as active_campaigns
        FROM campaigns
        WHERE user_token = ?
      `;

            const { rows } = await this.db.query(sql, [userToken]);
            const data = rows[0];

            return {
                totalCampaigns: data.total_campaigns || 0,
                totalMessages: data.total_messages || 0,
                totalSent: data.total_sent || 0,
                totalFailed: data.total_failed || 0,
                activeCampaigns: data.active_campaigns || 0,
                successRate: data.total_messages > 0
                    ? ((data.total_sent / data.total_messages) * 100).toFixed(1)
                    : 0
            };
        } catch (error) {
            logger.error('Erro ao obter métricas gerais:', error);
            throw error;
        }
    }

    /**
     * Obtém dados para o gráfico de envios por hora (Janela de Ouro)
     */
    async getHourlyDeliveryStats(userToken) {
        try {
            // Agrupar envios por hora do dia (0-23)
            // SQLite: strftime('%H', sent_at)
            const sql = `
        SELECT 
          strftime('%H', sent_at) as hour,
          COUNT(*) as count
        FROM campaign_contacts cc
        JOIN campaigns c ON cc.campaign_id = c.id
        WHERE c.user_token = ? 
        AND cc.status IN ('sent', 'delivered', 'read')
        AND cc.sent_at IS NOT NULL
        GROUP BY hour
        ORDER BY hour
      `;

            const { rows } = await this.db.query(sql, [userToken]);

            // Preencher horas vazias
            const hourlyData = Array(24).fill(0).map((_, i) => ({
                hour: i.toString().padStart(2, '0') + ':00',
                count: 0
            }));

            rows.forEach(row => {
                const hourIndex = parseInt(row.hour);
                if (!isNaN(hourIndex) && hourIndex >= 0 && hourIndex < 24) {
                    hourlyData[hourIndex].count = row.count;
                }
            });

            return hourlyData;
        } catch (error) {
            logger.error('Erro ao obter estatísticas por hora:', error);
            throw error;
        }
    }

    /**
     * Obtém o funil de conversão (Enviado -> Entregue -> Lido -> Respondido)
     */
    async getConversionFunnel(userToken) {
        try {
            // Usar as novas colunas delivered_at e read_at se disponíveis
            // Fallback para status se as colunas forem nulas mas o status indicar sucesso
            const sql = `
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN cc.status IN ('sent', 'delivered', 'read') THEN 1 ELSE 0 END) as sent,
          SUM(CASE WHEN cc.delivered_at IS NOT NULL OR cc.status IN ('delivered', 'read') THEN 1 ELSE 0 END) as delivered,
          SUM(CASE WHEN cc.read_at IS NOT NULL OR cc.status = 'read' THEN 1 ELSE 0 END) as read,
          SUM(CASE WHEN cc.status = 'failed' THEN 1 ELSE 0 END) as failed
        FROM campaign_contacts cc
        JOIN campaigns c ON cc.campaign_id = c.id
        WHERE c.user_token = ?
      `;

            const { rows } = await this.db.query(sql, [userToken]);
            const data = rows[0] || { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };

            // Se não houver dados de entrega/leitura (feature nova), usar estimativas ou zeros
            // Mas vamos retornar o que temos
            return [
                { stage: 'Total', value: data.total, fill: '#8884d8' },
                { stage: 'Enviados', value: data.sent, fill: '#82ca9d' },
                { stage: 'Entregues', value: data.delivered, fill: '#00C49F' },
                { stage: 'Lidos', value: data.read, fill: '#FFBB28' },
                { stage: 'Falhas', value: data.failed, fill: '#ff8042' }
            ];
        } catch (error) {
            logger.error('Erro ao obter funil:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsService;
