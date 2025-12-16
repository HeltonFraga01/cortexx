import { useState, useEffect } from "react";
import { findTypebot, updateTypebot, deleteTypebot } from "@/lib/api";
import { TypebotConfig } from "@/lib/types";
import Card from "./ui-custom/Card";
import Button from "./ui-custom/Button";
import {
  Bot,
  Trash,
  Edit,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import TypebotForm from "./TypebotForm";

interface TypebotListProps {
  instance: string;
  onRefresh?: () => void;
}

const TypebotList = ({ instance, onRefresh }: TypebotListProps) => {
  const [typebots, setTypebots] = useState<TypebotConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTypebot, setSelectedTypebot] = useState<TypebotConfig | null>(
    null
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const fetchTypebots = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await findTypebot(instance);
      if (response.error) {
        throw new Error(response.error);
      }
      setTypebots(response.response || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao buscar typebots");
      toast.error("Erro ao carregar typebots", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (instance) {
      fetchTypebots();
    }
  }, [instance]);

  const handleToggleStatus = async (typebot: TypebotConfig) => {
    if (!typebot.id) return;

    try {
      const updatedTypebot = { ...typebot, enabled: !typebot.enabled };
      const response = await updateTypebot(
        instance,
        typebot.id,
        updatedTypebot
      );

      if (response.error) {
        throw new Error(response.error);
      }

      setTypebots(
        typebots.map((t) =>
          t.id === typebot.id ? { ...t, enabled: !t.enabled } : t
        )
      );

      toast.success(
        `Typebot ${updatedTypebot.enabled ? "ativado" : "desativado"}`,
        {
          description: `O typebot foi ${
            updatedTypebot.enabled ? "ativado" : "desativado"
          } com sucesso.`,
        }
      );
    } catch (err) {
      toast.error("Erro ao alterar status", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    }
  };

  const handleDelete = async (typebotId: string) => {
    setIsDeleting(typebotId);

    try {
      const response = await deleteTypebot(instance, typebotId);

      if (response.error) {
        throw new Error(response.error);
      }

      setTypebots(typebots.filter((t) => t.id !== typebotId));

      toast.success("Typebot excluído", {
        description: "O typebot foi excluído com sucesso.",
      });

      if (selectedTypebot?.id === typebotId) {
        setSelectedTypebot(null);
        setIsEditMode(false);
      }
    } catch (err) {
      toast.error("Erro ao excluir typebot", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
      });
    } finally {
      setIsDeleting(null);
    }
  };

  const handleEdit = (typebot: TypebotConfig) => {
    setSelectedTypebot(typebot);
    setIsEditMode(true);
  };

  const handleEditSuccess = () => {
    fetchTypebots();
    setIsEditMode(false);
    setSelectedTypebot(null);
    if (onRefresh) {
      onRefresh();
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return "N/A";

    const date = new Date(dateString);
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (isEditMode && selectedTypebot) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium">Editar Typebot</h3>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditMode(false);
              setSelectedTypebot(null);
            }}
          >
            Voltar para lista
          </Button>
        </div>

        <TypebotForm
          instance={instance}
          typebotId={selectedTypebot.id}
          onSuccess={handleEditSuccess}
        />
      </div>
    );
  }

  if (loading) {
    return <div className="text-center py-8">Carregando typebots...</div>;
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <Button
          onClick={fetchTypebots}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Tentar novamente
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-medium">Typebots da Instância</h3>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchTypebots}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Atualizar
        </Button>
      </div>

      {typebots.length === 0 ? (
        <Card className="p-8 text-center">
          <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-xl font-medium mb-2">
            Nenhum Typebot Encontrado
          </h3>
          <p className="text-muted-foreground max-w-md mx-auto mb-4">
            Esta instância não possui typebots configurados. Use o formulário
            abaixo para criar um novo.
          </p>
        </Card>
      ) : (
        <div className="grid gap-4">
          {typebots.map((typebot) => (
            <Card key={typebot.id} className="p-4 relative">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Bot className="h-5 w-5 text-primary" />
                    <h4 className="font-medium text-lg">{typebot.typebot}</h4>
                    <span
                      className={`text-xs px-2 py-1 rounded-full ${
                        typebot.enabled
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {typebot.enabled ? "Ativo" : "Inativo"}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    <span className="font-medium">Descrição:</span>{" "}
                    {typebot.description || "Sem descrição"}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    Criado em: {formatDate(typebot.createdAt)}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                    <div>
                      <span className="font-medium">Tipo de Acionamento:</span>{" "}
                      {typebot.triggerType === "keyword"
                        ? `Palavra-chave (${typebot.triggerOperator}: ${typebot.triggerValue})`
                        : "Todas as mensagens"}
                    </div>
                    <div>
                      <span className="font-medium">URL:</span> {typebot.url}
                    </div>
                    <div>
                      <span className="font-medium">
                        Palavra para finalizar:
                      </span>{" "}
                      {typebot.keywordFinish}
                    </div>
                    <div>
                      <span className="font-medium">Expiração:</span>{" "}
                      {typebot.expire} min
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={
                      typebot.enabled ? (
                        <ToggleRight className="h-4 w-4" />
                      ) : (
                        <ToggleLeft className="h-4 w-4" />
                      )
                    }
                    onClick={() => handleToggleStatus(typebot)}
                  >
                    {typebot.enabled ? "Desativar" : "Ativar"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon={<Edit className="h-4 w-4" />}
                    onClick={() => handleEdit(typebot)}
                  >
                    Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    icon={<Trash className="h-4 w-4" />}
                    onClick={() => handleDelete(typebot.id || "")}
                    disabled={isDeleting === typebot.id}
                  >
                    {isDeleting === typebot.id ? "Excluindo..." : "Excluir"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default TypebotList;
