import { useState } from "react";
import { findChatbots } from "@/lib/api";
import { Loader2, Plus, Bot } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import ChatbotForm from "./ChatbotForm";
import Card from "@/components/ui-custom/Card";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

interface Chatbot {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  model: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatbotListProps {
  instance: string;
}

const ChatbotList = ({ instance }: ChatbotListProps) => {
  const [selectedChatbotId, setSelectedChatbotId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch chatbots
  const {
    data: chatbots = [],
    isLoading,
    refetch,
  } = useQuery<Chatbot[]>({
    queryKey: ["chatbots", instance],
    queryFn: async () => {
      if (!instance) return [];
      const response = await findChatbots(instance);
      if (response.error) {
        toast.error("Erro ao buscar chatbots", {
          description: response.error,
        });
        return [];
      }
      return response.response || [];
    },
    enabled: !!instance,
  });

  const handleEditChatbot = (id: string) => {
    setSelectedChatbotId(id);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setSelectedChatbotId(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedChatbotId(null);
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (showForm) {
    return (
      <div className="mb-6">
        <ChatbotForm
          instance={instance}
          chatbotId={selectedChatbotId}
          onClose={() => {
            setShowForm(false);
            setSelectedChatbotId(null);
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">Chatbots IA</h2>
        <Button
          onClick={handleAddNew}
          className="flex items-center gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Novo Chatbot
        </Button>
      </div>

      {chatbots.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <Bot className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Nenhum chatbot encontrado</h3>
            <p className="text-muted-foreground">
              Adicione chatbots de IA para interação com seus contatos.
            </p>
            <Button onClick={handleAddNew} className="mt-2">
              Adicionar chatbot
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {chatbots.map((chatbot) => (
            <Card key={chatbot.id} className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div
                className="flex justify-between items-center"
                onClick={() => handleEditChatbot(chatbot.id)}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{chatbot.name}</h3>
                    {chatbot.enabled ? (
                      <Badge variant="outline" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-200 dark:border-green-800">
                        Ativo
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100 border-gray-200 dark:border-gray-800">
                        Inativo
                      </Badge>
                    )}
                  </div>
                  {chatbot.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {chatbot.description}
                    </p>
                  )}
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(chatbot.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default ChatbotList;
