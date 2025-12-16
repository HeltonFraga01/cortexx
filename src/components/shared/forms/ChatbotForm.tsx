import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui-custom/Textarea";
import Card from "./ui-custom/Card";
import { toast } from "sonner";
import { Bot, Trash, Save, ArrowLeft } from "lucide-react";
import Switch from "@/components/ui-custom/Switch";
import { Slider } from "@/components/ui/slider";
import {
  createChatbot,
  findChatbotById,
  updateChatbot,
  deleteChatbot,
  findOpenAICredentials,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-custom/Select";

interface ChatbotFormProps {
  instance: string;
  chatbotId?: string | null;
  onClose: () => void;
}

interface OpenAICredential {
  id: string;
  name: string;
}

interface ChatbotConfig {
  name?: string;
  description: string;
  enabled: boolean;
  openaiCredsId: string;
  botType: "assistant" | "chatCompletion";
  // For assistants
  assistantId?: string;
  functionUrl?: string;
  // For chat completion
  model: string;
  systemMessages?: string[];
  assistantMessages?: string[];
  userMessages?: string[];
  maxTokens: number;
  // Options
  triggerType: "keyword" | "all";
  triggerOperator:
    | "contains"
    | "equals"
    | "startsWith"
    | "endsWith"
    | "regex"
    | "none";
  triggerValue: string;
  expire: number;
  keywordFinish: string;
  delayMessage: number;
  unknownMessage: string;
  listeningFromMe: boolean;
  stopBotFromMe: boolean;
  keepOpen: boolean;
  debounceTime: number;
  ignoreJids?: string[];
}

const defaultConfig: ChatbotConfig = {
  name: "",
  description: "",
  enabled: true,
  openaiCredsId: "",
  botType: "assistant",
  assistantId: "",
  functionUrl: "",
  model: "gpt-4o",
  systemMessages: ["Você é um assistente útil."],
  assistantMessages: ["Olá, como posso ajudar você hoje?"],
  userMessages: ["Olá!"],
  maxTokens: 300,
  triggerType: "keyword",
  triggerOperator: "equals",
  triggerValue: "",
  expire: 20,
  keywordFinish: "#SAIR",
  delayMessage: 1000,
  unknownMessage: "Mensagem não reconhecida",
  listeningFromMe: false,
  stopBotFromMe: false,
  keepOpen: false,
  debounceTime: 10,
  ignoreJids: [],
};

const ChatbotForm = ({ instance, chatbotId, onClose }: ChatbotFormProps) => {
  const [config, setConfig] = useState<ChatbotConfig>(defaultConfig);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [credentials, setCredentials] = useState<OpenAICredential[]>([]);

  useEffect(() => {
    const fetchCredentials = async () => {
      try {
        const response = await findOpenAICredentials(instance);
        if (response.response) {
          setCredentials(response.response);
        }
      } catch (error) {
        toast.error("Erro ao buscar credenciais", {
          description:
            error instanceof Error ? error.message : "Erro desconhecido",
        });
      }
    };

    fetchCredentials();
  }, [instance]);

  useEffect(() => {
    const fetchChatbot = async () => {
      if (!chatbotId) return;

      setLoading(true);
      try {
        const response = await findChatbotById(instance, chatbotId);
        if (response.error) {
          toast.error("Erro ao buscar chatbot", {
            description: response.error,
          });
        } else if (response.response) {
          // Ensure all fields have non-null values
          const cleanedResponse = { ...response.response };

          // Handle potential null values to avoid React warnings
          if (cleanedResponse.description === null)
            cleanedResponse.description = "";
          if (cleanedResponse.assistantId === null)
            cleanedResponse.assistantId = "";
          if (cleanedResponse.functionUrl === null)
            cleanedResponse.functionUrl = "";
          if (cleanedResponse.triggerValue === null)
            cleanedResponse.triggerValue = "";
          if (cleanedResponse.keywordFinish === null)
            cleanedResponse.keywordFinish = "#SAIR";
          if (cleanedResponse.unknownMessage === null)
            cleanedResponse.unknownMessage = "Mensagem não reconhecida";
          if (cleanedResponse.systemMessages === null)
            cleanedResponse.systemMessages = ["Você é um assistente útil."];
          if (cleanedResponse.assistantMessages === null)
            cleanedResponse.assistantMessages = [
              "Olá, como posso ajudar você hoje?",
            ];
          if (cleanedResponse.userMessages === null)
            cleanedResponse.userMessages = ["Olá!"];
          if (cleanedResponse.ignoreJids === null)
            cleanedResponse.ignoreJids = [];

          setConfig({
            ...defaultConfig,
            ...cleanedResponse,
          });
        }
      } catch (error) {
        toast.error("Erro ao buscar chatbot", {
          description:
            error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchChatbot();
  }, [instance, chatbotId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = chatbotId
        ? await updateChatbot(instance, chatbotId, config)
        : await createChatbot(instance, config);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success(
        chatbotId
          ? "Chatbot atualizado com sucesso"
          : "Chatbot criado com sucesso",
        {
          description: "Sua configuração foi salva",
        }
      );

      onClose();
    } catch (error) {
      toast.error("Erro ao salvar chatbot", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!chatbotId) return;

    setIsSubmitting(true);
    try {
      const response = await deleteChatbot(instance, chatbotId);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Chatbot excluído com sucesso", {
        description: "O chatbot foi removido",
      });

      onClose();
    } catch (error) {
      toast.error("Erro ao excluir chatbot", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (
    field: keyof ChatbotConfig,
    value: string | number | boolean | string[]
  ) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return <div className="text-center py-4">Carregando chatbot...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">
              {chatbotId ? "Editar Chatbot" : "Novo Chatbot"}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled">Ativado</Label>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome do Chatbot</Label>
              <Input
                id="name"
                value={config.name || ""}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="Nome do chatbot"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="openaiCredsId">Credencial OpenAI</Label>
              <Select
                value={config.openaiCredsId}
                onValueChange={(value) => handleChange("openaiCredsId", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma credencial" />
                </SelectTrigger>
                <SelectContent>
                  {credentials.length === 0 ? (
                    <SelectItem value="none" disabled>
                      Nenhuma credencial disponível
                    </SelectItem>
                  ) : (
                    credentials.map((cred) => (
                      <SelectItem key={cred.id} value={cred.id}>
                        {cred.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              {credentials.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Você precisa criar uma credencial OpenAI primeiro
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={config.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              placeholder="Descreva o chatbot"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="botType">Tipo de Bot</Label>
              <Select
                value={config.botType}
                onValueChange={(value) => handleChange("botType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="assistant">Assistente</SelectItem>
                  <SelectItem value="chatCompletion">
                    Chat Completion
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.botType === "assistant" && (
              <div className="space-y-2">
                <Label htmlFor="assistantId">ID do Assistente</Label>
                <Input
                  id="assistantId"
                  value={config.assistantId !== null ? config.assistantId : ""}
                  onChange={(e) => handleChange("assistantId", e.target.value)}
                  placeholder="ID do assistente"
                />
              </div>
            )}

            {config.botType === "assistant" && (
              <div className="space-y-2">
                <Label htmlFor="functionUrl">URL da Função</Label>
                <Input
                  id="functionUrl"
                  value={config.functionUrl || ""}
                  onChange={(e) => handleChange("functionUrl", e.target.value)}
                  placeholder="URL da função"
                />
              </div>
            )}

            {config.botType === "chatCompletion" && (
              <div className="space-y-2">
                <Label htmlFor="model">Modelo OpenAI</Label>
                <Select
                  value={config.model}
                  onValueChange={(value) => handleChange("model", value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um modelo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4o">GPT-4o</SelectItem>
                    <SelectItem value="gpt-4o-mini">GPT-4o Mini</SelectItem>
                    <SelectItem value="gpt-4">GPT-4</SelectItem>
                    <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="systemMessages">Mensagens do Sistema</Label>
              <Textarea
                id="systemMessages"
                value={config.systemMessages?.join("\n") || ""}
                onChange={(e) =>
                  handleChange("systemMessages", e.target.value.split("\n"))
                }
                placeholder="Mensagens do sistema"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="assistantMessages">Mensagens do Assistente</Label>
              <Textarea
                id="assistantMessages"
                value={config.assistantMessages?.join("\n") || ""}
                onChange={(e) =>
                  handleChange("assistantMessages", e.target.value.split("\n"))
                }
                placeholder="Mensagens do assistente"
                rows={5}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="userMessages">Mensagens do Usuário</Label>
              <Textarea
                id="userMessages"
                value={config.userMessages?.join("\n") || ""}
                onChange={(e) =>
                  handleChange("userMessages", e.target.value.split("\n"))
                }
                placeholder="Mensagens do usuário"
                rows={5}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTokens">Máximo de Tokens</Label>
              <Input
                id="maxTokens"
                type="number"
                min={50}
                max={4000}
                value={config.maxTokens}
                onChange={(e) =>
                  handleChange("maxTokens", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Limite máximo de tokens por resposta (1-4000)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="triggerType">Tipo de Acionamento</Label>
              <Select
                value={config.triggerType}
                onValueChange={(value) => handleChange("triggerType", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="all">Todas as mensagens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.triggerType === "keyword" && (
              <div className="space-y-2">
                <Label htmlFor="triggerOperator">Operador de Acionamento</Label>
                <Select
                  value={config.triggerOperator}
                  onValueChange={(value) =>
                    handleChange("triggerOperator", value)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um operador" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="contains">Contém</SelectItem>
                    <SelectItem value="equals">Igual a</SelectItem>
                    <SelectItem value="startsWith">Começa com</SelectItem>
                    <SelectItem value="endsWith">Termina com</SelectItem>
                    <SelectItem value="regex">Expressão regular</SelectItem>
                    <SelectItem value="none">Nenhum</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {config.triggerType === "keyword" && (
              <div className="space-y-2">
                <Label htmlFor="triggerValue">Valor de Acionamento</Label>
                <Input
                  id="triggerValue"
                  value={config.triggerValue}
                  onChange={(e) => handleChange("triggerValue", e.target.value)}
                  placeholder="Ex: #IA, AJUDA, etc."
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expire">Tempo de Expiração</Label>
              <Input
                id="expire"
                type="number"
                min={1}
                max={60}
                value={config.expire}
                onChange={(e) =>
                  handleChange("expire", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Tempo de expiração em minutos (1-60)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywordFinish">Palavra para Finalizar</Label>
              <Input
                id="keywordFinish"
                value={config.keywordFinish}
                onChange={(e) => handleChange("keywordFinish", e.target.value)}
                placeholder="Ex: #SAIR"
              />
              <p className="text-xs text-muted-foreground">
                Palavra-chave que o usuário pode enviar para finalizar a
                conversa
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="delayMessage">Atraso de Mensagem</Label>
              <Input
                id="delayMessage"
                type="number"
                min={0}
                max={10000}
                value={config.delayMessage}
                onChange={(e) =>
                  handleChange("delayMessage", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Atraso de mensagem em milissegundos (0-10000)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="unknownMessage">Mensagem Desconhecida</Label>
              <Input
                id="unknownMessage"
                value={config.unknownMessage}
                onChange={(e) => handleChange("unknownMessage", e.target.value)}
                placeholder="Mensagem desconhecida"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="listeningFromMe">Ouvir de Mim</Label>
              <Switch
                id="listeningFromMe"
                checked={config.listeningFromMe}
                onCheckedChange={(checked) =>
                  handleChange("listeningFromMe", checked)
                }
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="stopBotFromMe">Parar Bot de Mim</Label>
              <Switch
                id="stopBotFromMe"
                checked={config.stopBotFromMe}
                onCheckedChange={(checked) =>
                  handleChange("stopBotFromMe", checked)
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keepOpen">Manter Aberto</Label>
              <Switch
                id="keepOpen"
                checked={config.keepOpen}
                onCheckedChange={(checked) => handleChange("keepOpen", checked)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="debounceTime">Tempo de Debounce</Label>
              <Input
                id="debounceTime"
                type="number"
                min={0}
                max={10000}
                value={config.debounceTime}
                onChange={(e) =>
                  handleChange("debounceTime", parseInt(e.target.value))
                }
              />
              <p className="text-xs text-muted-foreground">
                Tempo de debounce em milissegundos (0-10000)
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ignoreJids">IDs para Ignorar</Label>
            <Textarea
              id="ignoreJids"
              value={config.ignoreJids?.join("\n") || ""}
              onChange={(e) =>
                handleChange("ignoreJids", e.target.value.split("\n"))
              }
              placeholder="IDs para ignorar"
              rows={5}
            />
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border mt-4">
          {chatbotId ? (
            <div>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="destructive"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    className="flex items-center gap-1"
                  >
                    <Trash className="h-4 w-4" />
                    Confirmar
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowDeleteConfirm(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={isSubmitting}
                  className="text-destructive border-destructive hover:bg-destructive/10"
                >
                  <Trash className="h-4 w-4 mr-2" />
                  Excluir Chatbot
                </Button>
              )}
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar
            </Button>
          )}

          <Button
            type="submit"
            disabled={isSubmitting || credentials.length === 0}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            Salvar Chatbot
          </Button>
        </div>
      </Card>
    </form>
  );
};

export default ChatbotForm;
