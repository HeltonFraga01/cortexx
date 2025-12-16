import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { WebhookConfig, WebhookEventType } from "@/lib/types";
import { setWebhook, findWebhook } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Checkbox from "@/components/ui-custom/Checkbox";
import Switch from "@/components/ui-custom/Switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Label } from "@/components/ui/label";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import Card from "@/components/ui-custom/Card";

interface WebhookFormProps {
  instance: string;
}

const WEBHOOK_EVENTS: { value: WebhookEventType; label: string }[] = [
  { value: "APPLICATION_STARTUP", label: "Inicialização da aplicação" },
  { value: "QRCODE_UPDATED", label: "QR Code atualizado" },
  { value: "MESSAGES_SET", label: "Mensagens definidas" },
  { value: "MESSAGES_UPSERT", label: "Novas mensagens" },
  { value: "MESSAGES_UPDATE", label: "Atualização de mensagens" },
  { value: "MESSAGES_DELETE", label: "Mensagens excluídas" },
  { value: "SEND_MESSAGE", label: "Mensagem enviada" },
  { value: "CONTACTS_SET", label: "Contatos definidos" },
  { value: "CONTACTS_UPSERT", label: "Novos contatos" },
  { value: "CONTACTS_UPDATE", label: "Atualização de contatos" },
  { value: "PRESENCE_UPDATE", label: "Atualização de presença" },
  { value: "CHATS_SET", label: "Chats definidos" },
  { value: "CHATS_UPSERT", label: "Novos chats" },
  { value: "CHATS_UPDATE", label: "Atualização de chats" },
  { value: "CHATS_DELETE", label: "Chats excluídos" },
  { value: "GROUPS_UPSERT", label: "Novos grupos" },
  { value: "GROUP_UPDATE", label: "Atualização de grupo" },
  {
    value: "GROUP_PARTICIPANTS_UPDATE",
    label: "Atualização de participantes do grupo",
  },
  { value: "CONNECTION_UPDATE", label: "Atualização de conexão" },
  { value: "LABELS_EDIT", label: "Edição de etiquetas" },
  { value: "LABELS_ASSOCIATION", label: "Associação de etiquetas" },
  { value: "CALL", label: "Chamada" },
  { value: "TYPEBOT_START", label: "Início de typebot" },
  { value: "TYPEBOT_CHANGE_STATUS", label: "Mudança de status do typebot" },
];

const WebhookForm = ({ instance }: WebhookFormProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [headerFields, setHeaderFields] = useState<
    { key: string; value: string }[]
  >([{ key: "Content-Type", value: "application/json" }]);

  const form = useForm<{ webhook: WebhookConfig }>({
    defaultValues: {
      webhook: {
        enabled: true,
        url: "",
        headers: {
          "Content-Type": "application/json",
        },
        byEvents: false,
        base64: false,
        events: WEBHOOK_EVENTS.map((event) => event.value),
      },
    },
  });

  useEffect(() => {
    const fetchWebhookConfig = async () => {
      setIsFetching(true);
      try {
        const response = await findWebhook(instance);
        if (response.response?.webhook) {
          form.reset({ webhook: response.response.webhook });

          // Configurar os campos de cabeçalho
          const headers = response.response.webhook.headers;
          if (headers) {
            const headerArray = Object.entries(headers).map(([key, value]) => ({
              key,
              value: value.toString(),
            }));
            setHeaderFields(
              headerArray.length > 0
                ? headerArray
                : [{ key: "Content-Type", value: "application/json" }]
            );
          }
        }
      } catch (error) {
        console.error("Erro ao buscar configuração do webhook:", error);
      } finally {
        setIsFetching(false);
      }
    };

    if (instance) {
      fetchWebhookConfig();
    }
  }, [instance, form]);

  const onSubmit = async (data: { webhook: WebhookConfig }) => {
    setIsLoading(true);

    // Converter o array de headerFields para o formato de objeto esperado
    const headersObject: Record<string, string> = {};
    headerFields.forEach((header) => {
      if (header.key && header.value) {
        headersObject[header.key] = header.value;
      }
    });

    // Atualizar o objeto data com os cabeçalhos convertidos
    data.webhook.headers = headersObject;

    // Garantir que a URL seja válida mesmo quando o webhook está desativado
    if (
      !data.webhook.enabled &&
      (!data.webhook.url || data.webhook.url.trim() === "")
    ) {
      data.webhook.url = "https://webhook.site";
    }

    try {
      const response = await setWebhook(instance, data);
      if (response.error) {
        toast.error("Erro ao configurar webhook", {
          description: response.error,
        });
      } else {
        toast.success("Webhook configurado com sucesso", {
          description: data.webhook.enabled
            ? "A configuração do webhook foi atualizada."
            : "O webhook foi desativado com sucesso.",
        });
      }
    } catch (error) {
      toast.error("Erro ao configurar webhook", {
        description:
          error instanceof Error ? error.message : "Erro desconhecido",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddHeader = () => {
    setHeaderFields([...headerFields, { key: "", value: "" }]);
  };

  const handleRemoveHeader = (index: number) => {
    setHeaderFields(headerFields.filter((_, i) => i !== index));
  };

  const handleHeaderChange = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const newHeaders = [...headerFields];
    newHeaders[index][field] = value;
    setHeaderFields(newHeaders);
  };

  if (isFetching) {
    return (
      <div className="flex justify-center items-center py-8">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg mb-4 text-sm">
          <p className="font-medium mb-1">Como configurar o webhook:</p>
          <ul className="list-disc pl-6 space-y-1">
            <li>
              Para <strong>ativar</strong>: Configure a URL e os eventos
              desejados e mantenha o switch "Ativar Webhook" ligado.
            </li>
            <li>
              Para <strong>desativar</strong>: Desligue o switch "Ativar
              Webhook" e clique em "Salvar Configuração".
            </li>
            <li>
              Uma URL válida é sempre necessária, mesmo quando o webhook está
              desativado.
            </li>
          </ul>
        </div>

        <div
          className={`grid grid-cols-1 gap-6 ${
            !form.watch("webhook.enabled") ? "opacity-90" : ""
          }`}
        >
          {!form.watch("webhook.enabled") && (
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 rounded-md text-amber-800 dark:text-amber-300 text-sm">
              <p>
                ⚠️ Webhook está <strong>desativado</strong>. Configure os campos
                e salve para registrar as configurações quando for ativado
                posteriormente.
              </p>
            </div>
          )}

          <FormField
            control={form.control}
            name="webhook.enabled"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Ativar Webhook</FormLabel>
                  <FormDescription>
                    Habilita ou desabilita o webhook para esta instância.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    color="primary"
                    size="md"
                    glow
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webhook.url"
            render={({ field }) => (
              <FormItem>
                <FormLabel>URL do Webhook</FormLabel>
                <FormControl>
                  <Input
                    placeholder="https://seu-webhook.com/callback"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  URL para onde serão enviados os eventos de webhook.
                  {!form.watch("webhook.enabled") && (
                    <span className="text-amber-500 ml-1">
                      (Mesmo com webhook desativado, uma URL válida é
                      necessária)
                    </span>
                  )}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div>
            <Label className="mb-2 block">Cabeçalhos HTTP</Label>
            <Card className="p-4">
              {headerFields.map((header, index) => (
                <div key={index} className="flex gap-3 mb-3">
                  <Input
                    value={header.key}
                    onChange={(e) =>
                      handleHeaderChange(index, "key", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Input
                    value={header.value}
                    onChange={(e) =>
                      handleHeaderChange(index, "value", e.target.value)
                    }
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => handleRemoveHeader(index)}
                    disabled={headerFields.length <= 1}
                  >
                    Remover
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddHeader}
                className="mt-2"
              >
                Adicionar Cabeçalho
              </Button>
            </Card>
          </div>

          <FormField
            control={form.control}
            name="webhook.byEvents"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Agrupar por Eventos
                  </FormLabel>
                  <FormDescription>
                    Envia eventos agrupados por tipo ao invés de
                    individualmente.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="webhook.base64"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">
                    Codificar em Base64
                  </FormLabel>
                  <FormDescription>
                    Converte mídias em formato base64 antes de enviar.
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />

          <div>
            <Label className="mb-2 block">Eventos para Monitorar</Label>
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                {WEBHOOK_EVENTS.map((event) => (
                  <FormField
                    key={event.value}
                    control={form.control}
                    name="webhook.events"
                    render={({ field }) => {
                      return (
                        <FormItem
                          key={event.value}
                          className="flex flex-row items-start space-x-3 space-y-0"
                        >
                          <FormControl>
                            <Checkbox
                              checked={field.value?.includes(event.value)}
                              onCheckedChange={(checked) => {
                                const updatedEvents = checked
                                  ? [...field.value, event.value]
                                  : field.value?.filter(
                                      (value) => value !== event.value
                                    );
                                field.onChange(updatedEvents);
                              }}
                              color="primary"
                              size="sm"
                              glow
                            />
                          </FormControl>
                          <FormLabel className="text-sm font-normal">
                            {event.label}
                          </FormLabel>
                        </FormItem>
                      );
                    }}
                  />
                ))}
              </div>
            </Card>
          </div>
        </div>

        <Button type="submit" disabled={isLoading} className="w-full md:w-auto">
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando...
            </>
          ) : (
            "Salvar Configuração"
          )}
        </Button>
      </form>
    </Form>
  );
};

export default WebhookForm;
