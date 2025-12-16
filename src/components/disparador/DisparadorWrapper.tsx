import { useState, useEffect } from "react";
import { initScheduledMessageProcessor } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useBrandingConfig } from "@/hooks/useBranding";
import Card from "../ui-custom/Card";
import { Input } from "../ui/input";
import { Send, Key } from "lucide-react";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import DisparadorList from "./DisparadorList";

const DisparadorWrapper = () => {
  const [customToken, setCustomToken] = useState("");
  const [showCustomToken, setShowCustomToken] = useState(false);
  const { user } = useAuth();
  const brandingConfig = useBrandingConfig();

  // Usar o token do usuário logado ou token customizado
  const activeToken = customToken || user?.token || "";

  // Inicializar o processador de mensagens agendadas quando o componente é montado
  useEffect(() => {
    const intervalId = initScheduledMessageProcessor();

    // Limpar o intervalo quando o componente é desmontado
    return () => {
      clearInterval(intervalId);
    };
  }, []);

  const handleClearCustomToken = () => {
    setCustomToken("");
    setShowCustomToken(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Disparador de Mensagens</h1>
        <p className="text-muted-foreground">
          Envie mensagens em massa com humanização e controle avançado
        </p>
      </div>

      {/* Configuração de Token */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key className="h-5 w-5 text-primary" />
            <h3 className="text-lg font-medium">Configuração de Instância</h3>
          </div>
          {!showCustomToken && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCustomToken(true)}
            >
              Usar Token Customizado
            </Button>
          )}
        </div>

        {showCustomToken ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-token">Token da Instância (Opcional)</Label>
              <Input
                id="custom-token"
                type="text"
                placeholder="Digite o token de outra instância para randomização..."
                value={customToken}
                onChange={(e) => setCustomToken(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Use o token de outra instância {brandingConfig.appName} para randomizar os envios entre múltiplas contas
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearCustomToken}
              >
                Usar Meu Token
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">
            Usando token da sua conta: <span className="font-mono">{user?.token?.substring(0, 8)}...</span>
          </div>
        )}
      </Card>

      {/* DisparadorList com token ativo */}
      {activeToken ? (
        <DisparadorList
          instance={activeToken}
          userToken={user?.token || activeToken}
          onRefresh={() => {
            // Opcional: atualizar algo após uma operação
          }}
        />
      ) : (
        <Card className="p-8 flex flex-col items-center justify-center text-center">
          <Send className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-xl font-medium mb-2">
            Token não encontrado
          </h3>
          <p className="text-muted-foreground max-w-md">
            Faça login para usar o disparador de mensagens
          </p>
        </Card>
      )}
    </div>
  );
};

export default DisparadorWrapper;
