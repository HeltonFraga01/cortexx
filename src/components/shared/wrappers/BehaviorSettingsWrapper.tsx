import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInstances, findBehaviorSettings, setBehaviorSettings } from "@/lib/api";
import { Instance } from "@/lib/types";
import { toast } from "sonner";
import Switch from "@/components/ui-custom/Switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui-custom/Textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Activity, Search } from "lucide-react";

const BehaviorSettingsWrapper = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState({
    rejectCall: false,
    msgCall: "",
    groupsIgnore: false,
    alwaysOnline: false,
    readMessages: false,
    syncFullHistory: false,
    readStatus: false,
  });

  // Fetch all instances
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["instances"],
    queryFn: fetchInstances,
  });

  // Filter instances based on search
  const filteredInstances = instances.filter((instance) =>
    instance.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInstanceSelect = async (instanceName: string) => {
    setSelectedInstance(instanceName);
    setLoading(true);
    try {
      const result = await findBehaviorSettings(instanceName);
      if (result.response) {
        setSettings(result.response);
      }
    } catch (error) {
      console.error("Error fetching behavior settings:", error);
      toast.error("Failed to load behavior settings");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    if (!selectedInstance) return;
    
    setSaving(true);
    try {
      const result = await setBehaviorSettings(selectedInstance, settings);
      if (result.response) {
        toast.success("Configurações de comportamento salvas com sucesso");
      } else {
        toast.error("Failed to save behavior settings", {
          description: result.error,
        });
      }
    } catch (error) {
      console.error("Erro ao salvar configurações de comportamento:", error);
      toast.error("Falha ao salvar as configurações de comportamento");
    } finally {
      setSaving(false);
    }
  };

  const handleChange = (field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando instâncias...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      {/* Instance Selection Panel */}
      <div className="md:col-span-1">
        <Card className="p-4 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Instâncias</h3>
          </div>

          <div className="relative mb-4">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="text"
                placeholder="Buscar instância..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="space-y-2 max-h-96 overflow-y-auto pr-2">
              {filteredInstances.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma instância encontrada
                </div>
              ) : (
                filteredInstances.map((instance) => (
                  <div
                    key={instance.id}
                    className={`p-3 rounded-md cursor-pointer hover:bg-muted transition-colors ${
                      selectedInstance === instance.name
                        ? "bg-primary/10 border-l-4 border-primary"
                        : "border-l-4 border-transparent"
                    }`}
                    onClick={() => handleInstanceSelect(instance.name)}
                  >
                    <div className="font-medium">{instance.name}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Status:{" "}
                      <span
                        className={
                          instance.connectionStatus === "open"
                            ? "text-green-500"
                            : "text-amber-500"
                        }
                      >
                        {instance.connectionStatus === "open"
                          ? "Conectado"
                          : "Desconectado"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
      </div>

      {/* Settings Panel */}
      <div className="md:col-span-2">
        {!selectedInstance ? (
          <div className="text-center py-8 text-muted-foreground">
            Selecione uma instância para gerenciar as configurações de comportamento
          </div>
        ) : loading ? (
          <div className="text-center py-8">Carregando configurações...</div>
        ) : (
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-6">Configurações de Comportamento - {selectedInstance}</h2>
            <div className="space-y-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="rejectCall" className="text-base font-medium">
                      Rejeitar Chamadas
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Rejeitar automaticamente todas as chamadas recebidas
                    </p>
                  </div>
                  <Switch
                    id="rejectCall"
                    checked={settings.rejectCall}
                    onCheckedChange={(checked) => handleChange("rejectCall", checked)}
                  />
                </div>

                {settings.rejectCall && (
                  <div className="ml-6 border-l-2 pl-4 border-primary/20">
                    <Label htmlFor="msgCall" className="text-base font-medium mb-2 block">
                      Mensagem de Rejeição
                    </Label>
                    <Textarea
                      id="msgCall"
                      value={settings.msgCall}
                      onChange={(e) => handleChange("msgCall", e.target.value)}
                      placeholder="Mensagem para enviar ao rejeitar chamadas"
                      className="min-h-[80px]"
                      color="primary"
                      size="md"
                      glow
                    />
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="groupsIgnore" className="text-base font-medium">
                      Ignorar Grupos
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Ignorar todas as mensagens de grupos
                    </p>
                  </div>
                  <Switch
                    id="groupsIgnore"
                    checked={settings.groupsIgnore}
                    onCheckedChange={(checked) => handleChange("groupsIgnore", checked)}
                    color="primary"
                    size="md"
                    glow
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="alwaysOnline" className="text-base font-medium">
                      Sempre Online
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Manter o status da instância como sempre online
                    </p>
                  </div>
                  <Switch
                    id="alwaysOnline"
                    checked={settings.alwaysOnline}
                    onCheckedChange={(checked) => handleChange("alwaysOnline", checked)}
                    color="success"
                    size="md"
                    glow
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="readMessages" className="text-base font-medium">
                      Ler Mensagens
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Marcar todas as mensagens como lidas automaticamente
                    </p>
                  </div>
                  <Switch
                    id="readMessages"
                    checked={settings.readMessages}
                    onCheckedChange={(checked) => handleChange("readMessages", checked)}
                    color="info"
                    size="md"
                    glow
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="syncFullHistory" className="text-base font-medium">
                      Sincronizar Histórico Completo
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Sincronizar o histórico completo com QR Code
                    </p>
                  </div>
                  <Switch
                    id="syncFullHistory"
                    checked={settings.syncFullHistory}
                    onCheckedChange={(checked) => handleChange("syncFullHistory", checked)}
                    color="warning"
                    size="md"
                    glow
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label htmlFor="readStatus" className="text-base font-medium">
                      Ler Status
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Marcar todos os status como visualizados automaticamente
                    </p>
                  </div>
                  <Switch
                    id="readStatus"
                    checked={settings.readStatus}
                    onCheckedChange={(checked) => handleChange("readStatus", checked)}
                  />
                </div>
              </div>

              <Button 
                onClick={handleSaveSettings} 
                disabled={saving}
                className="w-full mt-6"
              >
                {saving ? "Salvando..." : "Salvar Configurações"}
              </Button>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default BehaviorSettingsWrapper;
