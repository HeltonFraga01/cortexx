import { backendApi } from './api-client';

export interface OverviewMetrics {
    totalCampaigns: number;
    totalMessages: number;
    totalSent: number;
    totalFailed: number;
    activeCampaigns: number;
    successRate: string;
}

export interface HourlyStat {
    hour: string;
    count: number;
}

export interface FunnelStage {
    stage: string;
    value: number;
    fill: string;
}

export const analyticsService = {
    getOverview: async (): Promise<OverviewMetrics> => {
        const response = await backendApi.get<{ success: boolean; metrics: OverviewMetrics }>('/user/analytics/overview');
        if (!response.success || !response.data) {
            throw new Error('Falha ao carregar métricas');
        }
        return response.data.metrics;
    },

    getHourlyStats: async (): Promise<HourlyStat[]> => {
        const response = await backendApi.get<{ success: boolean; data: HourlyStat[] }>('/user/analytics/hourly');
        if (!response.success || !response.data) {
            throw new Error('Falha ao carregar estatísticas por hora');
        }
        return response.data.data;
    },

    getFunnel: async (): Promise<FunnelStage[]> => {
        const response = await backendApi.get<{ success: boolean; data: FunnelStage[] }>('/user/analytics/funnel');
        if (!response.success || !response.data) {
            throw new Error('Falha ao carregar funil');
        }
        return response.data.data;
    }
};
