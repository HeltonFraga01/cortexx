import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import Button from "./ui-custom/Button";
import Card from "./ui-custom/Card";
import { toast } from "sonner";
import { Key, Trash, Save, ArrowLeft } from "lucide-react";
import {
  createOpenAICredential,
  findOpenAICredentialById,
  updateOpenAICredential,
  deleteOpenAICredential,
} from "@/lib/api";

interface OpenAICredentialFormProps {
  instance: string;
  credentialId?: string | null;
  onClose: () => void;
}

interface OpenAICredential {
  name: string;
  apiKey: string;
}

const defaultCredential: OpenAICredential = {
  name: "",
  apiKey: "",
};

const OpenAICredentialForm = ({ 
  instance, 
  credentialId, 
  onClose 
}: OpenAICredentialFormProps) => {
  const [credential, setCredential] = useState<OpenAICredential>(defaultCredential);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const fetchCredential = async () => {
      if (!credentialId) return;
      
      setLoading(true);
      try {
        const response = await findOpenAICredentialById(instance, credentialId);
        if (response.error) {
          toast.error("Erro ao buscar credencial", {
            description: response.error,
          });
        } else if (response.response) {
          setCredential({
            name: response.response.name || "",
            apiKey: response.response.apiKey || "",
          });
        }
      } catch (error) {
        toast.error("Erro ao buscar credencial", {
          description: error instanceof Error ? error.message : "Erro desconhecido",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchCredential();
  }, [instance, credentialId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const response = credentialId
        ? await updateOpenAICredential(instance, credentialId, credential)
        : await createOpenAICredential(instance, credential);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success(
        credentialId ? "Credencial atualizada com sucesso" : "Credencial criada com sucesso",
        {
          description: "Sua configuração foi salva",
        }
      );

      onClose();
    } catch (error) {
      toast.error("Erro ao salvar credencial", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!credentialId) return;

    setIsSubmitting(true);
    try {
      const response = await deleteOpenAICredential(instance, credentialId);

      if (response.error) {
        throw new Error(response.error);
      }

      toast.success("Credencial excluída com sucesso", {
        description: "A credencial foi removida",
      });

      onClose();
    } catch (error) {
      toast.error("Erro ao excluir credencial", {
        description: error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsSubmitting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleChange = (field: keyof OpenAICredential, value: string) => {
    setCredential((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  if (loading) {
    return <div className="text-center py-4">Carregando credencial...</div>;
  }

  return (
    <form onSubmit={handleSubmit}>
      <Card className="space-y-4 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">
              {credentialId ? "Editar Credencial" : "Nova Credencial"}
            </h3>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="flex items-center gap-1"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        <div className="grid gap-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome da Credencial</Label>
            <Input
              id="name"
              value={credential.name}
              onChange={(e) => handleChange("name", e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="apiKey">Chave da API (OpenAI API Key)</Label>
            <Input
              id="apiKey"
              value={credential.apiKey}
              onChange={(e) => handleChange("apiKey", e.target.value)}
              placeholder="sk-proj-..."
              required
              type="password"
            />
            <p className="text-xs text-muted-foreground">
              A chave da API da OpenAI é usada para autenticar suas solicitações.
              Você pode obter uma chave em{" "}
              <a
                href="https://platform.openai.com/api-keys"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                platform.openai.com/api-keys
              </a>
            </p>
          </div>
        </div>

        <div className="flex justify-between pt-4 border-t border-border mt-4">
          {credentialId ? (
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
                  Excluir Credencial
                </Button>
              )}
            </div>
          ) : (
            <div></div>
          )}

          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex items-center gap-1"
          >
            <Save className="h-4 w-4" />
            Salvar Credencial
          </Button>
        </div>
      </Card>
    </form>
  );
};

export default OpenAICredentialForm;
