import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchInstances } from "@/lib/api";
import { Instance } from "@/lib/types";
import Card from "./ui-custom/Card";
import { Input } from "./ui/input";
import { Search, Webhook } from "lucide-react";
import WebhookForm from "./WebhookForm";

const WebhookWrapper = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);

  // Buscar todas as instâncias
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["instances"],
    queryFn: fetchInstances,
  });

  // Filtrar instâncias com base na pesquisa
  const filteredInstances = instances.filter((instance) =>
    instance.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInstanceSelect = (instanceName: string) => {
    setSelectedInstance(instanceName);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando instâncias...</div>;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div className="md:col-span-1">
        <Card className="p-4 h-full">
          <div className="flex items-center gap-2 mb-4">
            <Webhook className="h-5 w-5 text-primary" />
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

          {filteredInstances.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              {searchQuery
                ? "Nenhuma instância encontrada"
                : "Nenhuma instância disponível"}
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
              {filteredInstances.map((instance: Instance) => (
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
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="md:col-span-2">
        {selectedInstance ? (
          <Card className="p-6">
            <h2 className="text-xl font-medium mb-6">
              Configuração de Webhook - {selectedInstance}
            </h2>
            <WebhookForm instance={selectedInstance} />
          </Card>
        ) : (
          <Card className="p-8 flex flex-col items-center justify-center h-full text-center">
            <Webhook className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-medium mb-2">
              Selecione uma instância
            </h3>
            <p className="text-muted-foreground max-w-md">
              Escolha uma instância na lista à esquerda para configurar o
              webhook para aquela instância.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
};

export default WebhookWrapper;
