const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

class AnalyticsService {
    constructor(db) {
        this.db = db;
    }

    /**
     * Obtém métricas gerais de todas as campanhas
     */
    async getOverviewMetrics(userToken) {
        try {
            // Query bulk_campaigns using Supabase
            const { data: campaigns, error } = await SupabaseService.adminClient
                .from('bulk_campaigns')
                .select('total_contacts, sent_count, failed_count, status')
                .eq('user_token', userToken);

            if (error) throw error;

            // Calculate metrics from results
            const totalCampaigns = campaigns?.length || 0;
            const totalMessages = campaigns?.reduce((sum, c) => sum + (c.total_contacts || 0), 0) || 0;
            const totalSent = campaigns?.reduce((sum, c) => sum + (c.sent_count || 0), 0) || 0;
            const totalFailed = campaigns?.reduce((sum, c) => sum + (c.failed_count || 0), 0) || 0;
            const activeCampaigns = campaigns?.filter(c => c.status === 'running').length || 0;

            return {
                totalCampaigns,
                totalMessages,
                totalSent,
                totalFailed,
                activeCampaigns,
                successRate: totalMessages > 0
                    ? ((totalSent / totalMessages) * 100).toFixed(1)
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
            // First get campaign IDs for this user
            const { data: campaigns, error: campaignError } = await SupabaseService.adminClient
                .from('bulk_campaigns')
                .select('id')
                .eq('user_token', userToken);

            if (campaignError) throw campaignError;

            const campaignIds = campaigns?.map(c => c.id) || [];

            if (campaignIds.length === 0) {
                // Return empty hourly data
                return Array(24).fill(0).map((_, i) => ({
                    hour: i.toString().padStart(2, '0') + ':00',
                    count: 0
                }));
            }

            // Get contacts with sent_at for these campaigns
            const { data: contacts, error: contactError } = await SupabaseService.adminClient
                .from('campaign_contacts')
                .select('sent_at')
                .in('campaign_id', campaignIds)
                .in('status', ['sent', 'delivered', 'read'])
                .not('sent_at', 'is', null);

            if (contactError) throw contactError;

            // Initialize hourly data
            const hourlyData = Array(24).fill(0).map((_, i) => ({
                hour: i.toString().padStart(2, '0') + ':00',
                count: 0
            }));

            // Count by hour
            (contacts || []).forEach(contact => {
                if (contact.sent_at) {
                    const hour = new Date(contact.sent_at).getHours();
                    if (hour >= 0 && hour < 24) {
                        hourlyData[hour].count++;
                    }
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
            // First get campaign IDs for this user
            const { data: campaigns, error: campaignError } = await SupabaseService.adminClient
                .from('bulk_campaigns')
                .select('id')
                .eq('user_token', userToken);

            if (campaignError) throw campaignError;

            const campaignIds = campaigns?.map(c => c.id) || [];

            if (campaignIds.length === 0) {
                return [
                    { stage: 'Total', value: 0, fill: '#8884d8' },
                    { stage: 'Enviados', value: 0, fill: '#82ca9d' },
                    { stage: 'Entregues', value: 0, fill: '#00C49F' },
                    { stage: 'Lidos', value: 0, fill: '#FFBB28' },
                    { stage: 'Falhas', value: 0, fill: '#ff8042' }
                ];
            }

            // Get all contacts for these campaigns
            const { data: contacts, error: contactError } = await SupabaseService.adminClient
                .from('campaign_contacts')
                .select('status, delivered_at, read_at')
                .in('campaign_id', campaignIds);

            if (contactError) throw contactError;

            // Calculate funnel metrics
            const total = contacts?.length || 0;
            const sent = contacts?.filter(c => ['sent', 'delivered', 'read'].includes(c.status)).length || 0;
            const delivered = contacts?.filter(c => c.delivered_at || ['delivered', 'read'].includes(c.status)).length || 0;
            const read = contacts?.filter(c => c.read_at || c.status === 'read').length || 0;
            const failed = contacts?.filter(c => c.status === 'failed').length || 0;

            return [
                { stage: 'Total', value: total, fill: '#8884d8' },
                { stage: 'Enviados', value: sent, fill: '#82ca9d' },
                { stage: 'Entregues', value: delivered, fill: '#00C49F' },
                { stage: 'Lidos', value: read, fill: '#FFBB28' },
                { stage: 'Falhas', value: failed, fill: '#ff8042' }
            ];
        } catch (error) {
            logger.error('Erro ao obter funil:', error);
            throw error;
        }
    }
}

module.exports = AnalyticsService;
