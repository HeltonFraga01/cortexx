import { useState, useEffect } from "react";
import { toast } from "sonner";
import Card from "../ui-custom/Card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Send,
  Clock,
  AlertTriangle,
  MessageSquare,
  Calendar,
  BarChart3,
  Users,
} from "lucide-react";
import DisparadorUnico from "./DisparadorUnico";
import BulkDispatcherDashboard from "./BulkDispatcherDashboard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import ContactListManager from "./ContactListManager";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { removeScheduledMessage } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { getAllScheduledItems, ScheduledItem } from "@/lib/scheduled-items";
import { ScheduledSingleMessageCard } from "./ScheduledSingleMessageCard";
import { ScheduledCampaignCard } from "./ScheduledCampaignCard";
import { bulkCampaignService } from "@/services/bulkCampaignService";

interface DisparadorListProps {
  instance: string;
  userToken: string;
  onRefresh?: () => void;
}

const DisparadorList = ({ instance, userToken, onRefresh }: DisparadorListProps) => {
  const [selectedTab, setSelectedTab] = useState<
    "info" | "unico" | "massa" | "agendados" | "analytics" | "listas"
  >("info");
  const [scheduledItems, setScheduledItems] = useState<ScheduledItem[]>([]);
  const [isLoadingScheduled, setIsLoadingScheduled] = useState(false);

  // Carregar itens agendados (mensagens únicas + campanhas)
  useEffect(() => {
    const loadScheduledItems = async () => {
      setIsLoadingScheduled(true);
      try {
        const items = await getAllScheduledItems(userToken, instance);
        setScheduledItems(items);
      } catch (error) {
        console.error('Erro ao carregar itens agendados:', error);
        toast.error('Erro ao carregar agendados', {
          description: 'Não foi possível carregar os itens agendados'
        });
      } finally {
        setIsLoadingScheduled(false);
      }
    };

    loadScheduledItems();

    // Atualizar quando houver mudanças no localStorage
    const handleStorageChange = () => {
      loadScheduledItems();
    };

    window.addEventListener("storage", handleStorageChange);

    // Polling para atualizar campanhas do backend a cada 30 segundos
    const intervalId = setInterval(loadScheduledItems, 30000);

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      clearInterval(intervalId);
    };
  }, [instance, userToken]);

  // Handler para remover mensagem única
  const handleRemoveSingleMessage = async (id: string) => {
    try {
      // Cancelar no backend
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const response = await fetch(`${API_BASE_URL}/api/user/scheduled-messages/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (!response.ok) {
        throw new Error('Erro ao cancelar mensagem');
      }

      setScheduledItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Mensagem removida", {
        description: "A mensagem foi removida com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao remover mensagem:', error);
      toast.error("Erro ao remover", {
        description: "Não foi possível remover a mensagem.",
      });
    }
  };

  // Handler para cancelar campanha
  const handleCancelCampaign = async (id: string) => {
    try {
      await bulkCampaignService.cancelCampaign(id);
      setScheduledItems((prev) => prev.filter((item) => item.id !== id));
      toast.success("Campanha cancelada", {
        description: "A campanha foi cancelada com sucesso.",
      });
    } catch (error) {
      console.error('Erro ao cancelar campanha:', error);
      toast.error("Erro ao cancelar", {
        description: "Não foi possível cancelar a campanha.",
      });
    }
  };

  // Handler para pausar campanha
  const handlePauseCampaign = async (id: string) => {
    try {
      await bulkCampaignService.pauseCampaign(id);
      toast.success("Campanha pausada");
      // Recarregar itens
      const items = await getAllScheduledItems(userToken, instance);
      setScheduledItems(items);
    } catch (error) {
      console.error('Erro ao pausar campanha:', error);
      toast.error("Erro ao pausar campanha");
    }
  };

  // Handler para retomar campanha
  const handleResumeCampaign = async (id: string) => {
    try {
      await bulkCampaignService.resumeCampaign(id);
      toast.success("Campanha retomada");
      // Recarregar itens
      const items = await getAllScheduledItems(userToken, instance);
      setScheduledItems(items);
    } catch (error) {
      console.error('Erro ao retomar campanha:', error);
      toast.error("Erro ao retomar campanha");
    }
  };

  return (
    <div className="space-y-4">
      <Tabs
        value={selectedTab}
        onValueChange={(value) =>
          setSelectedTab(value as "info" | "unico" | "massa" | "agendados" | "analytics" | "listas")
        }
      >
        <TabsList className="mb-4 flex whitespace-nowrap scrollbar-none">
          <TabsTrigger
            value="info"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Informações</span>
          </TabsTrigger>
          <TabsTrigger
            value="unico"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <MessageSquare className="h-4 w-4" />
            <span className="hidden sm:inline">Envio Único</span>
          </TabsTrigger>
          <TabsTrigger
            value="massa"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <Send className="h-4 w-4" />
            <span className="hidden sm:inline">Envio em Massa</span>
          </TabsTrigger>
          <TabsTrigger
            value="agendados"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <Calendar className="h-4 w-4" />
            <span className="hidden sm:inline">Agendados</span>
            {scheduledItems.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {scheduledItems.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="analytics"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Analytics</span>
          </TabsTrigger>
          <TabsTrigger
            value="listas"
            className="flex items-center gap-1 sm:gap-2 data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary rounded-none min-w-[40px] sm:min-w-fit px-3 sm:px-4"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Gerenciar Listas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="info" className="mt-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Informação</AlertTitle>
            <AlertDescription>
              Os disparos são processados imediatamente e não ficam armazenados
              em um histórico. Escolha entre envio único ou em massa nas abas
              disponíveis.
            </AlertDescription>
          </Alert>

          <div className="bg-muted/50 border border-border rounded-lg p-4 mt-4">
            <h4 className="text-sm font-medium flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4" />
              Dicas para disparos em massa
            </h4>
            <ul className="text-sm text-muted-foreground space-y-2">
              <li>
                • Utilize um delay adequado entre as mensagens para evitar
                bloqueios (recomendado: 3000ms).
              </li>
              <li>
                • Personalize as mensagens usando variáveis para maior
                engajamento.
              </li>
              <li>
                • Para contatos em massa, utilize a importação via CSV com os
                dados dos destinatários.
              </li>
              <li>
                • Evite enviar a mesma mensagem para muitos contatos em um curto
                período.
              </li>
              <li>
                • Teste o disparo com poucos números antes de fazer um envio
                maior.
              </li>
            </ul>
          </div>
        </TabsContent>

        <TabsContent value="unico" className="mt-4">
          <Card className="p-6">
            <DisparadorUnico
              instance={instance}
              onSuccess={() => toast.success("Mensagem enviada com sucesso")}
            />
          </Card>
        </TabsContent>

        <TabsContent value="massa" className="mt-4">
          <BulkDispatcherDashboard instance={instance} userToken={userToken} />
        </TabsContent>

        <TabsContent value="agendados" className="mt-4">
          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Itens Agendados</h3>
            </div>

            {isLoadingScheduled ? (
              <div className="text-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-spin" />
                <p className="text-muted-foreground">Carregando agendados...</p>
              </div>
            ) : scheduledItems.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h4 className="text-lg font-medium mb-2">
                  Nenhum item agendado
                </h4>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Mensagens únicas e campanhas agendadas aparecerão aqui. Você pode agendar
                  nas opções de envio único ou em massa.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {scheduledItems.map((item) => {
                  if (item.type === 'single') {
                    return (
                      <ScheduledSingleMessageCard
                        key={item.id}
                        message={item}
                        onRemove={handleRemoveSingleMessage}
                      />
                    );
                  } else {
                    return (
                      <ScheduledCampaignCard
                        key={item.id}
                        campaign={item}
                        onCancel={handleCancelCampaign}
                        onPause={handlePauseCampaign}
                        onResume={handleResumeCampaign}
                      />
                    );
                  }
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <AnalyticsDashboard userToken={userToken} />
        </TabsContent>

        <TabsContent value="listas" className="mt-4">
          <ContactListManager />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DisparadorList;
