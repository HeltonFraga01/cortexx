import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsService, OverviewMetrics, HourlyStat, FunnelStage } from '@/services/analytics';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Loader2, TrendingUp, MessageSquare, Send, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AnalyticsDashboardProps {
    userToken: string;
}

const AnalyticsDashboard = ({ userToken }: AnalyticsDashboardProps) => {
    const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
    const [hourlyStats, setHourlyStats] = useState<HourlyStat[]>([]);
    const [funnelData, setFunnelData] = useState<FunnelStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadData = async () => {
            try {
                setLoading(true);
                setError(null);
                const [metricsData, hourlyData, funnelData] = await Promise.all([
                    analyticsService.getOverview(),
                    analyticsService.getHourlyStats(),
                    analyticsService.getFunnel()
                ]);
                setMetrics(metricsData);
                setHourlyStats(hourlyData);
                setFunnelData(funnelData);
            } catch (error: any) {
                console.error('Erro ao carregar analytics:', error);
                const errorMsg = error?.message || 'Erro ao carregar analytics';
                setError(errorMsg);
                toast.error('Erro ao carregar analytics', {
                    description: errorMsg
                });
            } finally {
                setLoading(false);
            }
        };

        if (userToken) {
            loadData();
        }
    }, [userToken]);

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col justify-center items-center h-64 space-y-4">
                <AlertCircle className="h-12 w-12 text-destructive" />
                <div className="text-center">
                    <h3 className="text-lg font-semibold">Erro ao carregar Analytics</h3>
                    <p className="text-sm text-muted-foreground">{error}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Cards de Métricas Gerais */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Total de Envios</CardTitle>
                        <Send className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.totalSent || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            de {metrics?.totalMessages || 0} mensagens agendadas
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.successRate || 0}%</div>
                        <p className="text-xs text-muted-foreground">
                            {metrics?.activeCampaigns || 0} campanhas ativas
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Falhas</CardTitle>
                        <AlertCircle className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.totalFailed || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            mensagens não entregues
                        </p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Campanhas</CardTitle>
                        <MessageSquare className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{metrics?.totalCampaigns || 0}</div>
                        <p className="text-xs text-muted-foreground">
                            total de campanhas criadas
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
                {/* Gráfico de Envios por Hora */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Envios por Hora (Janela de Ouro)</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={hourlyStats}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis
                                        dataKey="hour"
                                        tick={{ fontSize: 12 }}
                                        interval={3} // Mostrar a cada 3 horas para não poluir
                                    />
                                    <YAxis tick={{ fontSize: 12 }} />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="count" fill="#8884d8" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                {/* Funil de Conversão */}
                <Card className="col-span-1">
                    <CardHeader>
                        <CardTitle>Funil de Conversão</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={funnelData}
                                    layout="vertical"
                                    margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis
                                        dataKey="stage"
                                        type="category"
                                        tick={{ fontSize: 12 }}
                                        width={80}
                                    />
                                    <Tooltip
                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                                        cursor={{ fill: 'transparent' }}
                                    />
                                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                        {funnelData.map((entry, index) => (
                                            <Cell key={`cell-\${index}`} fill={entry.fill} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export { AnalyticsDashboard };
