import { useState, FormEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Card from "./ui-custom/Card";
import Button from "./ui-custom/Button";
import { toast } from "sonner";
import { Bot, Trash, Save, Wand } from "lucide-react";
import { TypebotConfig } from "@/lib/types";
import {
  createTypebot,
  findTypebot,
  updateTypebot,
  deleteTypebot,
} from "@/lib/api";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui-custom/Select";
import Switch from "./ui-custom/Switch";
import { Slider } from "@/components/ui/slider";

interface TypebotFormProps {
  instance: string;
  typebotId?: string;
  onSuccess?: () => void;
}

const defaultConfig: TypebotConfig = {
  enabled: true,
  url: "https://bot.packtypebot.com.br",
  typebot: "",
  triggerType: "keyword",
  triggerOperator: "contains",
  triggerValue: "",
  expire: 20,
  keywordFinish: "#SAIR",
  delayMessage: 1000,
  unknownMessage: "Mensagem não reconhecida",
  listeningFromMe: false,
  stopBotFromMe: false,
  keepOpen: false,
  debounceTime: 10,
  description: "",
};

const TypebotForm = ({ instance, typebotId, onSuccess }: TypebotFormProps) => {
  const [config, setConfig] = useState<TypebotConfig>(defaultConfig);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchExistingConfig = async () => {
      setLoading(true);
      const response = await findTypebot(instance);
      if (response.response && response.response.length > 0) {
        if (typebotId) {
          const typebot = response.response.find((tb) => tb.id === typebotId);
          if (typebot) {
            setConfig({
              ...defaultConfig,
              ...typebot,
              triggerOperator: typebot.triggerOperator || "contains",
              triggerValue: typebot.triggerValue || "",
            });
          }
        }
      }
      setLoading(false);
    };

    fetchExistingConfig();
  }, [instance, typebotId]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Se existe typebotId, atualiza, senão cria
      const response = typebotId
        ? await updateTypebot(instance, typebotId, config)
        : await createTypebot(instance, config);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Typebot salvo com sucesso", {
        description: "Sua configuração foi atualizada",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error("Erro ao salvar Typebot", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!typebotId) return;

    setIsSubmitting(true);
    try {
      const response = await deleteTypebot(instance, typebotId);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Typebot excluído com sucesso", {
        description: "A configuração foi removida",
      });

      if (onSuccess) {
        onSuccess();
      }
    } catch (error) {
      toast.error("Erro ao excluir Typebot", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (
    field: keyof TypebotConfig,
    value: string | number | boolean
  ) => {
    setConfig((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return <div className="text-center py-4">Carregando configurações...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Configuração do Typebot</h3>
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="enabled">Ativado</Label>
            <Switch
              id="enabled"
              checked={config.enabled}
              onCheckedChange={(checked) => handleChange("enabled", checked)}
              color="success"
              size="md"
              glow
            />
          </div>
        </div>

        <div className="grid gap-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="url">URL do Typebot</Label>
              <Input
                id="url"
                value={config.url}
                onChange={(e) => handleChange("url", e.target.value)}
                placeholder="https://bot.packtypebot.com.br"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="typebot">ID do Typebot</Label>
              <Input
                id="typebot"
                value={config.typebot}
                onChange={(e) => handleChange("typebot", e.target.value)}
                placeholder="meu-typebot"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição do Typebot</Label>
            <Input
              id="description"
              value={config.description || ""}
              onChange={(e) => handleChange("description", e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="triggerType">Tipo de Acionamento</Label>
              <Select
                value={config.triggerType}
                onValueChange={(value) => handleChange("triggerType", value)}
              >
                <SelectTrigger 
                  id="triggerType"
                  color="primary"
                  size="md"
                  glow
                >
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="keyword">Palavra-chave</SelectItem>
                  <SelectItem value="all">Todas as mensagens</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {config.triggerType === "keyword" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="triggerOperator">Operador</Label>
                  <Select
                    value={config.triggerOperator}
                    onValueChange={(value) =>
                      handleChange("triggerOperator", value)
                    }
                  >
                    <SelectTrigger 
                      id="triggerOperator"
                      color="info"
                      size="md"
                      glow
                    >
                      <SelectValue placeholder="Selecione o operador" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="contains">Contém</SelectItem>
                      <SelectItem value="equals">Igual a</SelectItem>
                      <SelectItem value="startsWith">Começa com</SelectItem>
                      <SelectItem value="endsWith">Termina com</SelectItem>
                      <SelectItem value="regex">Regex</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="triggerValue">Valor</Label>
                  <Input
                    id="triggerValue"
                    value={config.triggerValue}
                    onChange={(e) =>
                      handleChange("triggerValue", e.target.value)
                    }
                    placeholder={
                      config.triggerOperator === "regex"
                        ? "^atend.*"
                        : "atendimento"
                    }
                    required={config.triggerType === "keyword"}
                  />
                </div>
              </>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="expire">Tempo de Expiração (min)</Label>
              <Input
                id="expire"
                type="number"
                value={config.expire}
                onChange={(e) =>
                  handleChange("expire", parseInt(e.target.value))
                }
                min={1}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="keywordFinish">Palavra para Finalizar</Label>
              <Input
                id="keywordFinish"
                value={config.keywordFinish}
                onChange={(e) => handleChange("keywordFinish", e.target.value)}
                placeholder="#SAIR"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="delayMessage">Delay de Mensagem (ms)</Label>
              <Input
                id="delayMessage"
                type="number"
                value={config.delayMessage}
                onChange={(e) =>
                  handleChange("delayMessage", parseInt(e.target.value))
                }
                min={0}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="unknownMessage">Mensagem Desconhecida</Label>
            <Input
              id="unknownMessage"
              value={config.unknownMessage}
              onChange={(e) => handleChange("unknownMessage", e.target.value)}
              placeholder="Mensagem não reconhecida"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="debounceTime">Tempo de Debounce (seg)</Label>
              <div className="flex items-center gap-4">
                <Slider
                  id="debounceTime"
                  value={[config.debounceTime]}
                  onValueChange={(value) =>
                    handleChange("debounceTime", value[0])
                  }
                  min={0}
                  max={60}
                  step={1}
                  className="flex-1"
                />
                <span className="w-10 text-center">{config.debounceTime}</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            <div className="flex items-center space-x-2">
              <Switch
                id="listeningFromMe"
                checked={config.listeningFromMe}
                onCheckedChange={(checked) =>
                  handleChange("listeningFromMe", checked)
                }
                color="info"
                size="sm"
                glow
              />
              <Label htmlFor="listeningFromMe">Ouvir minhas mensagens</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="stopBotFromMe"
                checked={config.stopBotFromMe}
                onCheckedChange={(checked) =>
                  handleChange("stopBotFromMe", checked)
                }
                color="warning"
                size="sm"
                glow
              />
              <Label htmlFor="stopBotFromMe">
                Parar bot com minhas mensagens
              </Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="keepOpen"
                checked={config.keepOpen}
                onCheckedChange={(checked) => handleChange("keepOpen", checked)}
                color="primary"
                size="sm"
                glow
              />
              <Label htmlFor="keepOpen">Manter conversa aberta</Label>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          {typebotId && (
            <>
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-500">
                    Confirmar exclusão?
                  </span>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={handleDelete}
                  >
                    Sim
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => setShowDeleteConfirm(false)}
                  >
                    Não
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="destructive"
                  icon={<Trash className="h-4 w-4" />}
                  disabled={isSubmitting}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  Excluir
                </Button>
              )}
            </>
          )}
          <Button
            type="button"
            variant="outline"
            icon={<Wand className="h-4 w-4" />}
            disabled={isSubmitting}
            onClick={() => setConfig(defaultConfig)}
          >
            Restaurar Padrões
          </Button>
          <Button
            type="submit"
            icon={<Save className="h-4 w-4" />}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Salvando..." : "Salvar Configuração"}
          </Button>
        </div>
      </Card>
    </form>
  );
};

export default TypebotForm;
