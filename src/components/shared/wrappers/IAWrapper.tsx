import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Key, Bot, Search } from "lucide-react";
import OpenAICredentialsList from "@/components/OpenAICredentialsList";
import ChatbotList from "@/components/ChatbotList";
import { useQuery } from "@tanstack/react-query";
import { fetchInstances } from "@/lib/api";
import { Instance } from "@/lib/types";
import Card from "./ui-custom/Card";
import { Input } from "./ui/input";

const IAWrapper = () => {
  const [activeTab, setActiveTab] = useState("credentials");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedInstance, setSelectedInstance] = useState<string | null>(null);

  // Fetch all instances
  const { data: instances = [], isLoading } = useQuery({
    queryKey: ["instances"],
    queryFn: fetchInstances,
  });

  // Filter instances based on search
  const filteredInstances = instances.filter((instance) =>
    instance.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleInstanceSelect = (instanceName: string) => {
    setSelectedInstance(instanceName);
  };

  if (isLoading) {
    return <div className="text-center py-8">Carregando instâncias...</div>;
  }

  // If no instance is selected, show the instance selection UI
  if (!selectedInstance) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-1">
          <Card className="p-4 h-full">
            <div className="flex items-center gap-2 mb-4">
              <Bot className="h-5 w-5 text-primary" />
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

        <div className="md:col-span-2">
          <Card className="p-6 h-full flex flex-col items-center justify-center">
            <Key className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Configuração de IA</h3>
            <p className="text-center text-muted-foreground max-w-md">
              Selecione uma instância para configurar as credenciais da OpenAI e criar chatbots de IA.
            </p>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Tabs
        defaultValue="credentials"
        value={activeTab}
        onValueChange={setActiveTab}
        className="w-full"
      >
        <TabsList className="mb-4">
          <TabsTrigger value="credentials" className="flex items-center gap-2">
            <Key className="h-4 w-4" />
            <span>Credenciais da OpenAI</span>
          </TabsTrigger>
          <TabsTrigger value="chatbots" className="flex items-center gap-2">
            <Bot className="h-4 w-4" />
            <span>Chatbots de IA</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="credentials" className="mt-0">
          <OpenAICredentialsList instance={selectedInstance} />
        </TabsContent>

        <TabsContent value="chatbots" className="mt-0">
          <ChatbotList instance={selectedInstance} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default IAWrapper;
