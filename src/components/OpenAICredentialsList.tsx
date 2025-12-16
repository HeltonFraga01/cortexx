import { useState, useEffect } from "react";
import { findOpenAICredentials } from "@/lib/api";
import { Loader2, Plus, Key } from "lucide-react";
import Button from "@/components/ui-custom/Button";
import { toast } from "sonner";
import OpenAICredentialForm from "./OpenAICredentialForm";
import Card from "@/components/ui-custom/Card";
import { useQuery } from "@tanstack/react-query";

interface OpenAICredential {
  id: string;
  name: string;
  apiKey: string;
  createdAt: string;
  updatedAt: string;
}

interface OpenAICredentialsListProps {
  instance: string;
}

const OpenAICredentialsList = ({ instance }: OpenAICredentialsListProps) => {
  const [selectedCredentialId, setSelectedCredentialId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Fetch OpenAI credentials
  const {
    data: credentials = [],
    isLoading,
    refetch,
  } = useQuery<OpenAICredential[]>({
    queryKey: ["openai-credentials", instance],
    queryFn: async () => {
      if (!instance) return [];
      const response = await findOpenAICredentials(instance);
      if (response.error) {
        toast.error("Erro ao buscar credenciais", {
          description: response.error,
        });
        return [];
      }
      return response.response || [];
    },
    enabled: !!instance,
  });

  const handleEditCredential = (id: string) => {
    setSelectedCredentialId(id);
    setShowForm(true);
  };

  const handleAddNew = () => {
    setSelectedCredentialId(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setSelectedCredentialId(null);
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
        <OpenAICredentialForm
          instance={instance}
          credentialId={selectedCredentialId}
          onClose={() => {
            setShowForm(false);
            setSelectedCredentialId(null);
            refetch();
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-medium">Credenciais OpenAI</h2>
        <Button
          onClick={handleAddNew}
          className="flex items-center gap-2"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          Nova Credencial
        </Button>
      </div>

      {credentials.length === 0 ? (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center justify-center py-4 space-y-3">
            <Key className="h-12 w-12 text-muted-foreground" />
            <h3 className="text-lg font-medium">Nenhuma credencial encontrada</h3>
            <p className="text-muted-foreground">
              Adicione credenciais para conectar ao OpenAI.
            </p>
            <Button onClick={handleAddNew} className="mt-2">
              Adicionar credencial
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {credentials.map((credential) => (
            <Card key={credential.id} className="p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
              <div
                className="flex justify-between items-center"
                onClick={() => handleEditCredential(credential.id)}
              >
                <div>
                  <h3 className="font-medium">{credential.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {credential.apiKey.substring(0, 3)}...
                    {credential.apiKey.substring(credential.apiKey.length - 4)}
                  </p>
                </div>
                <div className="text-sm text-muted-foreground">
                  {new Date(credential.createdAt).toLocaleDateString()}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default OpenAICredentialsList;
