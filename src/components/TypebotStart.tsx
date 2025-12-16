import { useState, FormEvent } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Card from "./ui-custom/Card";
import Button from "./ui-custom/Button";
import { toast } from "sonner";
import { Play, Bot } from "lucide-react";
import { startTypebot, findTypebot } from "@/lib/api";
import { TypebotStartPayload } from "@/lib/types";

interface TypebotStartProps {
  instance: string;
}

const TypebotStart = ({ instance }: TypebotStartProps) => {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [startSession, setStartSession] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [variables, setVariables] = useState<
    Array<{ name: string; value: string }>
  >([{ name: "pushName", value: "" }]);

  const handleStartTypebot = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // Formatar o número de telefone
      const formattedNumber = formatPhoneNumber(phoneNumber);

      // Buscar a configuração do Typebot para esta instância
      const configResponse = await findTypebot(instance);
      if (!configResponse.response) {
        throw new Error(
          "Nenhuma configuração de Typebot encontrada para esta instância"
        );
      }

      const config = configResponse.response;

      // Preparar a payload
      const payload: TypebotStartPayload = {
        url: config.url,
        typebot: config.typebot,
        remoteJid: formattedNumber,
        startSession,
        variables: variables.filter((v) => v.name && v.value),
      };

      // Iniciar o Typebot
      const response = await startTypebot(instance, payload);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Typebot iniciado com sucesso", {
        description: `Conversa iniciada com ${formattedNumber}`,
      });

      // Resetar o formulário
      setPhoneNumber("");
      setVariables([{ name: "pushName", value: "" }]);
      setShowForm(false);
    } catch (error) {
      toast.error("Erro ao iniciar Typebot", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    // Remover caracteres não numéricos
    let cleaned = phone.replace(/\D/g, "");

    // Verificar se já tem o formato correto
    if (cleaned.includes("@s.whatsapp.net")) {
      return cleaned;
    }

    // Adicionar código do país se não começar com ele
    if (!cleaned.startsWith("55")) {
      cleaned = "55" + cleaned;
    }

    // Adicionar o sufixo do WhatsApp
    return `${cleaned}@s.whatsapp.net`;
  };

  const handleAddVariable = () => {
    setVariables([...variables, { name: "", value: "" }]);
  };

  const handleRemoveVariable = (index: number) => {
    const newVariables = [...variables];
    newVariables.splice(index, 1);
    setVariables(newVariables);
  };

  const handleVariableChange = (
    index: number,
    field: "name" | "value",
    value: string
  ) => {
    const newVariables = [...variables];
    newVariables[index][field] = value;
    setVariables(newVariables);
  };

  return (
    <div className="mt-4">
      {!showForm ? (
        <Button
          type="button"
          variant="outline"
          className="w-full"
          icon={<Bot className="h-4 w-4" />}
          onClick={() => setShowForm(true)}
        >
          Iniciar Typebot com um Número
        </Button>
      ) : (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h3 className="text-lg font-medium">Iniciar Typebot</h3>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowForm(false)}
            >
              Cancelar
            </Button>
          </div>

          <form onSubmit={handleStartTypebot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="phoneNumber">Número de Telefone</Label>
              <Input
                id="phoneNumber"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="5511999999999"
                required
              />
              <p className="text-xs text-muted-foreground">
                Formato: 55 + DDD + número. Ex: 557499879409
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Variáveis</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddVariable}
                >
                  Adicionar Variável
                </Button>
              </div>

              {variables.map((variable, index) => (
                <div key={index} className="flex gap-2 items-center">
                  <Input
                    value={variable.name}
                    onChange={(e) =>
                      handleVariableChange(index, "name", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    value={variable.value}
                    onChange={(e) =>
                      handleVariableChange(index, "value", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveVariable(index)}
                    disabled={variables.length <= 1}
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="startSession"
                checked={startSession}
                onChange={(e) => setStartSession(e.target.checked)}
                aria-label="Iniciar Sessão"
              />
              <Label htmlFor="startSession">Iniciar Sessão</Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              icon={<Play className="h-4 w-4" />}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Iniciando..." : "Iniciar Conversa"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
};

export default TypebotStart;
