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
} from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Dialog,
  DialogContent as DefaultDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
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
import {
  connectInstance,
  deleteInstance,
  logoutInstance,
  restartInstance,
  setPresence,
  getConnectionState,
} from "@/lib/api";
import { Instance, QRCodeResponse } from "@/lib/types";
import { toast } from "sonner";
import Badge from "./ui-custom/Badge";
import Card from "./ui-custom/Card";
import Button from "./ui-custom/Button";

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

interface InstanceCardProps {
  instance: Instance;
  onAction: () => void;
}

const InstanceCard = ({ instance, onAction }: InstanceCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [isQrDialogOpen, setIsQrDialogOpen] = useState(false);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
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

  const statusBadge = () => {
    switch (instance.connectionStatus) {
      case "open":
        return (
          <Badge variant="success" pill>
            Conectado
          </Badge>
        );
      case "connecting":
        return (
          <Badge variant="warning" pulse pill>
            Conectando
          </Badge>
        );
      case "close":
        return (
          <Badge variant="error" pill>
            Desconectado
          </Badge>
        );
      default:
        return (
          <Badge variant="warning" pill>
            {instance.connectionStatus}
          </Badge>
        );
    }
  };

  const handleAction = async (
    action: () => Promise<{
      error?: string;
      response?: { message?: string; [key: string]: unknown };
    }>,
    successMessage: string
  ) => {
    setIsLoading(true);
    try {
      const result = await action();
      console.log("Action result:", result);

      if (result.error) {
        toast.error("Erro", {
          description: result.response?.message || result.error,
        });
      } else {
        toast.success("Sucesso", {
          description: successMessage,
        });

        onAction();
      }
    } catch (error) {
      console.error("Error in handleAction:", error);
      toast.error("Erro", {
        description: "Ocorreu um erro inesperado",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const checkConnectionStatus = async () => {
    try {
      const result = await getConnectionState(instance.name);
      console.log("Connection state result:", result);
      return result;
    } catch (error) {
      console.error("Error checking connection status:", error);
      return null;
    }
  };

  const handleConnect = async () => {
    if (instance.connectionStatus === "open") {
      toast.info("Já conectado", {
        description: `Instância "${instance.name}" já está conectada`,
      });
      return;
    }

    setIsLoading(true);
    try {
      const connectResult = await connectInstance(instance.name);
      console.log("Connect result:", connectResult);

      if (connectResult.error) {
        toast.error("Erro", {
          description: connectResult.error || "Falha ao conectar instância",
        });
      } else if (connectResult.response) {
        setQrCode(connectResult.response.base64);
        setPairingCode(connectResult.response.pairingCode || null);
        setIsQrDialogOpen(true);
        setConnectingState("connecting");

        toast.success("Conexão Iniciada", {
          description: "Escaneie o QR code para conectar ao WhatsApp",
        });

        onAction();
      }
    } catch (error) {
      console.error("Error in handleConnect:", error);
      toast.error("Erro", {
        description: "Falha ao obter QR code ou conectar instância",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestart = () => {
    handleAction(
      () => restartInstance(instance.name),
      `Instância "${instance.name}" está reiniciando`
    );
  };

  const handleRefreshStatus = async () => {
    setIsLoading(true);
    try {
      const result = await checkConnectionStatus();
      if (result && !result.error) {
        toast.success("Status Atualizado", {
          description: `Status da instância "${instance.name}" foi atualizado`,
        });
      } else {
        toast.error("Erro", {
          description: "Não foi possível atualizar o status",
        });
      }
      onAction();
    } catch (error) {
      toast.error("Erro", {
        description: "Falha ao atualizar o status da instância",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetPresence = () => {
    handleAction(
      () => setPresence(instance.name, { type: "available" }),
      `Presença da instância "${instance.name}" atualizada para online`
    );
  };

  const handleLogout = () => {
    handleAction(
      () => logoutInstance(instance.name),
      `Instância "${instance.name}" foi desconectada`
    );
  };

  const handleDelete = async () => {
    setIsDeleteDialogOpen(false);
    handleAction(
      () => deleteInstance(instance.name),
      `Instância "${instance.name}" foi excluída`
    );
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString();
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copiado", {
        description: "Texto copiado para a área de transferência",
      });
    } catch {
      toast.error("Erro ao copiar");
    }
  };

  const maskToken = (token?: string) => {
    if (!token) return "••••••••••••••••••••••••••••";
    return isTokenVisible ? token : token.replace(/./g, "•");
  };

  const refreshQRCode = async () => {
    setIsLoading(true);
    try {
      const connectResult = await connectInstance(instance.name);
      if (connectResult.error) {
        toast.error("Erro", {
          description: connectResult.error || "Falha ao atualizar QR code",
        });
      } else if (connectResult.response) {
        setQrCode(connectResult.response.base64);
        setPairingCode(connectResult.response.pairingCode || null);
        setCountdown(60); // Reseta o contador
        toast.success("QR Code Atualizado", {
          description: "Um novo QR code foi gerado",
        });
      }
    } catch (error) {
      toast.error("Erro", {
        description: "Falha ao atualizar QR code",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Atualizando a referência quando refreshQRCode é definido
  refreshQRCodeRef.current = refreshQRCode;

  // Contador regressivo para o QR Code
  useEffect(() => {
    let timer: NodeJS.Timeout;

    if (isQrDialogOpen && qrCode && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (
      countdown === 0 &&
      qrCode &&
      isQrDialogOpen &&
      refreshQRCodeRef.current
    ) {
      // Quando chegar a zero e o diálogo estiver aberto, recarregar o QR code
      refreshQRCodeRef.current();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isQrDialogOpen, countdown, qrCode]);

  return (
    <Card variant="dark" className="overflow-hidden bg-white dark:bg-slate-950">
      <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-800">
        <h3 className="text-xl font-medium text-slate-900 dark:text-white">
          {instance.name}
        </h3>
        <div className="flex items-center gap-2">
          {statusBadge()}
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                className="p-1 rounded-md text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 focus:outline-none"
                aria-label="Opções da instância"
              >
                <MoreVertical className="h-5 w-5" />
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
                    Ações da Instância
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
                    onSelect={handleRestart}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Reiniciar
                  </DropdownMenu.Item>
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-slate-700 dark:text-slate-300 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleRefreshStatus}
                  >
                    <RotateCw className="mr-2 h-4 w-4" />
                    Atualizar Status
                  </DropdownMenu.Item>

                  <DropdownMenu.Separator className="h-px bg-slate-200 dark:bg-slate-800 my-1" />
                  <DropdownMenu.Item
                    className="flex items-center px-2 py-1.5 text-sm text-amber-500 focus:bg-slate-100 dark:focus:bg-slate-800 rounded cursor-default outline-none"
                    onSelect={handleLogout}
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
            {maskToken(instance.token)}
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
              onClick={() => instance.token && copyToClipboard(instance.token)}
              aria-label="Copiar token"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 px-4">
        <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">Contatos</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            {instance._count?.Contact?.toLocaleString() || 0}
          </div>
        </div>

        <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3">
          <div className="text-xs text-slate-500 mb-1">Mensagens</div>
          <div className="text-xl font-semibold text-slate-900 dark:text-white">
            {instance._count?.Message?.toLocaleString() || 0}
          </div>
        </div>
      </div>

      <div className="p-4">
        <div className="bg-slate-100 dark:bg-slate-900 rounded-md p-3">
          <table className="w-full text-sm">
            <tbody>
              {instance.profileName && (
                <tr>
                  <td className="text-slate-500 py-1.5">Nome do Perfil:</td>
                  <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                    {instance.profileName}
                  </td>
                </tr>
              )}

              {instance.ownerJid && (
                <tr>
                  <td className="text-slate-500 py-1.5">Número:</td>
                  <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                    {instance.ownerJid.split("@")[0]}
                  </td>
                </tr>
              )}

              <tr>
                <td className="text-slate-500 py-1.5">Integração:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {instance.integration}
                </td>
              </tr>

              <tr>
                <td className="text-slate-500 py-1.5">Chats:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {instance._count?.Chat?.toLocaleString() || 0}
                </td>
              </tr>

              <tr>
                <td className="text-slate-500 py-1.5">Criado:</td>
                <td className="text-right text-slate-900 dark:text-white font-medium py-1.5">
                  {formatTimestamp(instance.createdAt)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 p-4">
        <Button
          onClick={handleRestart}
          disabled={isLoading}
          color="success"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          loading={isLoading}
        >
          Reiniciar
        </Button>

        <Button
          onClick={handleRefreshStatus}
          disabled={isLoading}
          color="gray"
          size="sm"
          icon={<RotateCw className="h-4 w-4" />}
          loading={isLoading}
        >
          Status
        </Button>

        {instance.connectionStatus === "open" ? (
          <Button
            onClick={handleLogout}
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
                Escaneie o QR Code para conectar sua conta do WhatsApp à
                Evolution API
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 sm:p-6 bg-dialog-background dark:bg-dialog-background">
              <div className="flex flex-col items-center order-2 lg:order-1">
                <h3 className="text-center font-medium mb-4 text-dialog-foreground dark:text-dialog-foreground">
                  Escaneie o QR Code
                </h3>
                {qrCode && (
                  <div className="border border-dialog-border dark:border-dialog-border p-4 rounded-lg bg-white w-full max-w-[280px] mx-auto">
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="w-full h-auto aspect-square object-contain"
                    />
                  </div>
                )}

                {pairingCode && (
                  <div className="mt-4 text-center w-full">
                    <div className="text-xs text-dialog-muted dark:text-dialog-muted mb-1">
                      Código de pareamento
                    </div>
                    <div className="font-mono tracking-wider text-lg bg-slate-100 dark:bg-slate-800 py-2 px-4 rounded text-dialog-foreground dark:text-dialog-foreground max-w-[280px] mx-auto">
                      {pairingCode.split("").join(" ")}
                    </div>
                  </div>
                )}

                <Button
                  onClick={refreshQRCode}
                  disabled={isLoading}
                  className="mt-4 w-full max-w-[280px]"
                  variant="outline"
                >
                  <RefreshCw
                    className={`h-4 w-4 mr-2 ${
                      isLoading ? "animate-spin" : ""
                    }`}
                  />
                  Gerar Novamente
                </Button>

                <div className="text-center text-xs text-dialog-muted dark:text-dialog-muted mt-3 flex items-center justify-center flex-wrap gap-1">
                  <div className="relative w-5 h-5">
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
              </div>

              <div className="flex flex-col order-1 lg:order-2">
                <h3 className="text-center font-medium mb-4 text-dialog-foreground dark:text-dialog-foreground">
                  Como conectar
                </h3>

                <div className="space-y-4 sm:space-y-6">
                  <div className="flex gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-600 flex items-center justify-center text-white text-xs">
                      1
                    </div>
                    <div>
                      <h4 className="font-medium text-sm text-dialog-foreground dark:text-dialog-foreground">
                        Abra o WhatsApp no seu celular
                      </h4>
                      <p className="text-xs text-dialog-muted dark:text-dialog-muted mt-1">
                        Certifique-se de que você está usando a versão mais
                        recente do aplicativo.
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
            <AlertDialogTitle>Excluir Instância</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir a instância "{instance.name}"? Esta
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

export default InstanceCard;
