import { useState, useEffect, useCallback, useRef } from "react";
import {
  CheckCircle,
  Copy,
  Eye,
  EyeOff,
  MoreVertical,
  Play,
  QrCode,
  RefreshCw,
  RotateCw,
  Trash,
  UserMinus,
  Wifi,
  WifiOff,
  X,
  Phone,
  User,
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import React from "react";
import { WuzAPIUser } from "@/lib/wuzapi-types";
import { useBrandingConfig } from "@/hooks/useBranding";
import { BRANDED_MESSAGES } from "@/lib/branding-messages";
import { toast } from "sonner";
import Badge from "./ui-custom/Badge";
import Card from "./ui-custom/Card";
import Button from "./ui-custom/Button";
import { useWuzAPIAuth } from "@/contexts/WuzAPIAuthContext";

// Componente personalizado sem o botão de fechar
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
        className
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogContent.displayName = DialogPrimitive.Content.displayName;

interface UserCardProps {
  user: WuzAPIUser;
  onAction: () => void;
}

const UserCard = ({ user, onAction }: UserCardProps) => {
  const { wuzapiClient } = useWuzAPIAuth();
  const brandingConfig = useBrandingConfig();
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isTokenVisible, setIsTokenVisible] = useState(false);
  const [connectingState, setConnectingState] = useState<"idle" | "connecting">(
    "idle"
  );
  const [countdown, setCountdown] = useState(60);

  // Usando useRef para armazenar a função refreshQRCode para uso no useEffect
  const refreshQRCodeRef = useRef<() => Promise<void>>();

  // Função para lidar com o pressionamento da tecla Escape
  const handleEscapeKey = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape" && isQrDialogOpen) {
        setIsQrDialogOpen(false);
      }
    },
    [isQrDialogOpen]
  );

  // Adiciona e remove o listener de teclado
  useEffect(() => {
    if (isQrDialogOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      document.body.style.overflow = "hidden"; // Impede a rolagem do fundo
    }

    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
      document.body.style.overflow = ""; // Restaura a rolagem
    };
  }, [isQrDialogOpen, handleEscapeKey]);

  // Função para mascarar o token
  const maskToken = (token: string | undefined): string => {
    if (!token) return "Token não disponível";
    if (isTokenVisible) return token;
    return token.substring(0, 8) + "..." + token.substring(token.length - 8);
  };

  // Função para copiar para a área de transferência
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Token copiado para a área de transferência!");
    } catch {
      toast.error("Erro ao copiar token");
    }
  };

  // Função para formatar timestamp
  const formatTimestamp = (timestamp: string): string => {
    return new Date(timestamp).toLocaleString("pt-BR");
  };

  // Função genérica para lidar com ações
  const handleAction = async (
    action: () => Promise<unknown>,
    successMessage: string
  ) => {
    setIsLoading(true);
    try {
      await action();
      toast.success(successMessage);
      onAction();
    } catch (error) {
      console.error("Erro na ação:", error);
      toast.error("Erro ao executar ação");
    } finally {
      setIsLoading(false);
    }
  };

  // Função para conectar usuário
  const handleConnect = async () => {
    console.log('🔄 handleConnect chamado para usuário:', user.name);
    
    if (!wuzapiClient) {
      console.error('❌ wuzapiClient não disponível');
      toast.error(BRANDED_MESSAGES.CLIENT_NOT_AVAILABLE());
      return;
    }

    if (!user.token) {
      console.error('❌ Token do usuário não disponível');
      toast.error('Token do usuário não disponível');
      return;
    }

    console.log('✅ wuzapiClient disponível, iniciando conexão...');
    
    setConnectingState("connecting");
    toast.info(`Usuário '${user.name}' conectando...`);

    try {
      // Usar o token diretamente, sem depender do número de telefone
      console.log('🔄 Chamando connectUser com token...');
      const connectResponse = await wuzapiClient.connectUser(user.token);
      console.log('🔄 Resposta connectUser:', connectResponse);

      if (connectResponse.success) {
        console.log('✅ Usuário conectado, obtendo QR Code...');
        
        // Obter QR Code usando o token diretamente
        const qrResponse = await wuzapiClient.getUserQRCode(user.token);
        console.log('🔄 Resposta QR Code:', qrResponse);

        if (qrResponse.success && qrResponse.data?.qr_code) {
          console.log('✅ QR Code obtido com sucesso');
          setQrCode(qrResponse.data.qr_code);
          setIsQrDialogOpen(true);
          setCountdown(60);
          toast.success(`QR Code gerado para ${user.name}`);
        } else {
          console.error('❌ Erro ao obter QR Code:', qrResponse.error);
          toast.error(`Erro ao obter QR Code: ${qrResponse.error || 'Erro desconhecido'}`);
        }
      } else {
        console.error('❌ Erro ao conectar usuário:', connectResponse.error);
        toast.error(`Erro ao conectar: ${connectResponse.error || 'Erro desconhecido'}`);
      }
      
      onAction();
    } catch (error) {
      console.error('❌ Erro na conexão:', error);
      toast.error('Erro inesperado ao conectar usuário');
    } finally {
      setConnectingState("idle");
    }
  };

  // Função para desconectar usuário
  const handleDisconnect = () => {
    if (!wuzapiClient) return;
    
    handleAction(
      () => wuzapiClient.disconnectUser(user.phone),
      `Usuário "${user.name}" foi desconectado`
    );
  };

  // Função para excluir usuário
  const handleDelete = () => {
    if (!wuzapiClient) return;
    
    handleAction(
      () => wuzapiClient.deleteUser(user.phone),
      `Usuário "${user.name}" foi excluído`
    );
    setIsDeleteDialogOpen(false);
  };

  // Função para atualizar status
  const handleRefreshStatus = () => {
    if (!wuzapiClient) return;
    
    handleAction(
      () => wuzapiClient.getUserStatus(user.phone),
      `Status do usuário "${user.name}" atualizado`
    );
  };

  // Função para definir presença
  const handleSetPresence = () => {
    if (!wuzapiClient) return;
    
    handleAction(
      () => wuzapiClient.setPresence({ type: "available" }, user.token),
      `Presença do usuário "${user.name}" atualizada para online`
    );
  };

  // Função para atualizar QR Code
  const refreshQRCode = useCallback(async () => {
    if (!wuzapiClient) return;
    
    try {
      const qrResponse = await wuzapiClient.getUserQRCode(user.phone);
      if (qrResponse.success && qrResponse.data?.qr_code) {
        setQrCode(qrResponse.data.qr_code);
        setCountdown(60);
      }
    } catch (error) {
      console.error("Erro ao atualizar QR Code:", error);
      toast.error("Erro ao atualizar QR Code");
    }
  }, [wuzapiClient, user.phone]);

  // Armazenar a função no ref
  refreshQRCodeRef.current = refreshQRCode;

  // Countdown do QR Code
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (isQrDialogOpen && countdown > 0) {
      interval = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            // QR Code expirou, atualizar
            refreshQRCodeRef.current?.();
            return 60;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isQrDialogOpen, countdown]);

  // Determinar status de conexão baseado no usuário WuzAPI
  const getConnectionStatus = () => {
    if (user.status === 'connected') return "open";
    return "close";
  };

  const connectionStatus = getConnectionStatus();

  return (
    <Card 
      variant="default" 
      hover 
      border 
      padding="none" 
      glow={connectionStatus === "open"}
      interactive
    >
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center space-x-3">
          <div className="flex-shrink-0">
            <div className="w-10 h-10 bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
              <User className="h-5 w-5 text-white" />
            </div>
          </div>
          <div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
              {user.name}
            </h3>
            <div className="flex items-center space-x-2">
              <Phone className="h-3 w-3 text-slate-500" />
              <span className="text-sm text-slate-500">{user.phone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Badge
            variant={connectionStatus === "open" ? "success" : "error"}
            glow={connectionStatus === "open"}
            pulse={connectionStatus === "open"}
          >
            {connectionStatus === "open" ? (
              <>
                <Wifi className="h-3 w-3 mr-1" />
                Conectado
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 mr-1" />
                Desconectado
              </>
            )}
          </Badge>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="p-2 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                aria-label="Mais opções"
              >
                <MoreVertical className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                className="min-w-[220px] bg-white dark:bg-slate-950 rounded-md p-1 shadow-md border border-slate-200 dark:border-slate-800 z-50"
                sideOffset={5}
                align="end"
                alignOffset={0}
                forceMount
              >
                <DropdownMenu.Group>
                  <div className="px-2 py-1.5 text-sm font-medium text-slate-900 dark:text-slate-300">
                    Ações do Usuário
                  </div>
                  <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleConnect}
                  >
                    <Play className="mr-2 h-4 w-4" />
                    Conectar
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleRefreshStatus}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Atualizar Status
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleSetPresence}
                  >
                    <Wifi className="mr-2 h-4 w-4" />
                    Definir Presença
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-amber-500 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleDisconnect}
                  >
                    <UserMinus className="mr-2 h-4 w-4" />
                    Desconectar
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-red-500 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={() => setIsDeleteDialogOpen(true)}
                  >
                    <Trash className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenu.Item>
                </DropdownMenu.Group>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>

      <div className="p-4">
        <div className="mb-1 text-xs text-slate-500">Token da API:</div>
        <div className="bg-slate-100 dark:bg-slate-900 p-3 rounded-md flex items-center justify-between">
          <div className="font-mono text-sm text-slate-900 dark:text-white truncate pr-2">
            {maskToken(user.token)}
          </div>
          <div className="flex space-x-1">
            <button
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
              onClick={() => setIsTokenVisible(!isTokenVisible)}
              aria-label={isTokenVisible ? "Ocultar token" : "Mostrar token"}
            >
              {isTokenVisible ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
            <button
              className="p-1 rounded text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800"
              onClick={() => user.token && copyToClipboard(user.token)}
              aria-label="Copiar token"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="text-slate-500 py-1.5">Nome:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {user.name}
                </td>
              </tr>

              <tr>
                <td className="text-slate-500 py-1.5">Telefone:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {user.phone}
                </td>
              </tr>

              <tr>
                <td className="text-slate-500 py-1.5">Status:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {user.status === 'connected' ? "Conectado" : "Desconectado"}
                </td>
              </tr>

              {user.webhook && (
                <tr>
                  <td className="text-slate-500 py-1.5">Webhook:</td>
                  <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                    Configurado
                  </td>
                </tr>
              )}

              <tr>
                <td className="text-slate-500 py-1.5">Criado:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {formatTimestamp(user.created_at)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        <Button
          onClick={handleRefreshStatus}
          disabled={isLoading}
          color="success"
          size="sm"
          icon={<RotateCw className="h-4 w-4" />}
          loading={isLoading}
        >
          Status
        </Button>

        <Button
          onClick={handleSetPresence}
          disabled={isLoading}
          color="gray"
          size="sm"
          icon={<Wifi className="h-4 w-4" />}
          loading={isLoading}
        >
          Presença
        </Button>

        {connectionStatus === "open" ? (
          <Button
            onClick={handleDisconnect}
            disabled={isLoading}
            color="error"
            size="sm"
            icon={<WifiOff className="h-4 w-4" />}
            loading={isLoading}
          >
            Desconectar
          </Button>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            color="primary"
            size="sm"
            icon={<Play className="h-4 w-4" />}
            loading={isLoading}
          >
            Conectar
          </Button>
        )}
      </div>

      {isQrDialogOpen && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center overflow-y-auto p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-dialog-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setIsQrDialogOpen(false);
            }
          }}
        >
          <div className="relative bg-white dark:bg-black border border-slate-200 dark:border-slate-800 rounded-lg w-full max-w-3xl text-slate-900 dark:text-white my-4">
            <button
              type="button"
              className="absolute right-4 top-4 z-10 rounded-full bg-dialog-close-button hover:bg-dialog-close-button-hover dark:bg-dialog-close-button dark:hover:bg-dialog-close-button-hover p-1.5 text-slate-800 dark:text-white focus:outline-none"
              onClick={() => setIsQrDialogOpen(false)}
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="py-6 px-4 flex flex-col items-center bg-dialog-background dark:bg-dialog-background border-b border-dialog-border dark:border-dialog-border">
              <h2
                id="qr-dialog-title"
                className="text-xl font-semibold text-dialog-foreground dark:text-dialog-foreground text-center"
              >
                Conectar WhatsApp
              </h2>
              <p className="text-sm text-dialog-muted dark:text-dialog-muted mt-1 text-center">
                Escaneie o QR Code com seu WhatsApp para conectar o usuário{" "}
                <strong>{user.name}</strong>
              </p>
            </div>

            <div className="p-6 flex flex-col lg:flex-row gap-6">
              <div className="flex flex-col items-center order-2 lg:order-1">
                <div className="bg-white p-4 rounded-lg shadow-sm border border-slate-200">
                  {qrCode ? (
                    <img
                      src={qrCode}
                      alt="QR Code para conectar WhatsApp"
                      className="w-64 h-64 object-contain"
                    />
                  ) : (
                    <div className="w-64 h-64 flex items-center justify-center bg-slate-100 rounded">
                      <QrCode className="h-16 w-16 text-slate-400" />
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-4 text-sm text-dialog-muted dark:text-dialog-muted">
                  <div className="relative">
                    <svg className="w-5 h-5" viewBox="0 0 36 36">
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className="stroke-slate-200 dark:stroke-slate-700"
                        strokeWidth="2"
                      />
                      <circle
                        cx="18"
                        cy="18"
                        r="16"
                        fill="none"
                        className={`${
                          countdown < 10 ? "stroke-red-500" : "stroke-blue-500"
                        } transition-all duration-1000 ease-linear`}
                        strokeWidth="2"
                        strokeDasharray="100"
                        strokeDashoffset={100 - (countdown / 60) * 100}
                        strokeLinecap="round"
                        transform="rotate(-90 18 18)"
                      />
                    </svg>
                  </div>
                  <span>O QR code expira em</span>
                  <span
                    className={`font-semibold ${
                      countdown < 10 ? "text-red-500" : ""
                    }`}
                  >
                    {countdown}
                  </span>
                  <span>segundos</span>
                </div>

                <Button
                  onClick={refreshQRCode}
                  variant="outline"
                  size="sm"
                  className="mt-2"
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar QR Code
                </Button>
              </div>

              <div className="flex flex-col order-1 lg:order-2">
                <h3 className="text-lg font-semibold text-dialog-foreground dark:text-dialog-foreground mb-4">
                  Como conectar:
                </h3>

                <div className="space-y-4">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-dialog-foreground dark:text-dialog-foreground">
                        Abra o WhatsApp no seu celular
                      </h4>
                      <p className="text-xs text-dialog-muted dark:text-dialog-muted mt-1">
                        Certifique-se de que você tem a versão mais recente do
                        WhatsApp instalada.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      2
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-dialog-foreground dark:text-dialog-foreground">
                        Acesse as configurações
                      </h4>
                      <p className="text-xs text-dialog-muted dark:text-dialog-muted mt-1">
                        Toque em{" "}
                        <span className="text-dialog-foreground dark:text-white font-medium">
                          Configurações
                        </span>{" "}
                        &gt;{" "}
                        <span className="text-dialog-foreground dark:text-white font-medium">
                          Dispositivos conectados
                        </span>
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      3
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-dialog-foreground dark:text-dialog-foreground">
                        Escolha um método de conexão
                      </h4>
                      <p className="text-xs text-dialog-muted dark:text-dialog-muted mt-1">
                        Toque em{" "}
                        <span className="text-dialog-foreground dark:text-white font-medium">
                          Conectar um dispositivo
                        </span>{" "}
                        e escaneie o QR Code
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      4
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-dialog-foreground dark:text-dialog-foreground">
                        Aguarde a conexão
                      </h4>
                      <p className="text-xs text-dialog-muted dark:text-dialog-muted mt-1">
                        Após escanear o QR Code, aguarde a confirmação da
                        conexão.
                      </p>
                    </div>
                  </div>
                </div>

                {connectingState === "connecting" && (
                  <div className="mt-4 flex items-center justify-center">
                    <div className="bg-slate-100/30 dark:bg-black/30 rounded-full px-4 py-1 text-xs flex items-center text-dialog-foreground dark:text-dialog-foreground">
                      <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2"></div>
                      Aguardando conexão...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <AlertDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o usuário "{user.name}"? Esta
              ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
};

export default UserCard;