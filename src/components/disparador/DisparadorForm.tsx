import { useState, useRef, ChangeEvent, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Button from "@/components/ui-custom/Button";
import { toast } from "sonner";
import {
  Upload,
  FileType,
  File,
  Send,
  Info,
  Download,
  Image,
  FileText,
  AlertCircle,
  Trash,
  Calendar,
  Tag,
  CheckCircle,
  XCircle,
  BarChart3,
  Clock,
  Users,
} from "lucide-react";
import {
  sendText,
  sendMedia,
  parseCsvContacts,
  getCsvTemplate,
  scheduleMessage,
  getContactInfo,
  fetchGroups,
  Group,
} from "@/lib/api";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DateTime } from "luxon";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import DatePicker, { registerLocale } from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { pt } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";

// Registrar localização brasileira
registerLocale("pt-BR", pt);

interface DisparadorFormProps {
  instance: string;
  onSuccess?: () => void;
}

interface Contact {
  number: string;
  [key: string]: string;
}

// Tipo para acompanhar o resultado de cada envio
interface SendResult {
  number: string;
  success: boolean;
  error?: string;
  variables?: Record<string, string>;
}

const DisparadorForm = ({ instance, onSuccess }: DisparadorFormProps) => {
  const [messageType, setMessageType] = useState<"text" | "media">("text");
  const [textMessage, setTextMessage] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaType, setMediaType] = useState<"image" | "video" | "document">(
    "image"
  );
  const [mediaFileName, setMediaFileName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedVariables, setSelectedVariables] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTab, setSelectedTab] = useState<
    "manual" | "import" | "groups"
  >("manual");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [manualNumbers, setManualNumbers] = useState("");
  const [hasDelay, setHasDelay] = useState(false);
  const [delayValue, setDelayValue] = useState(3000);

  // Campos para agendamento
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState<Date>(new Date());
  const [scheduledTime, setScheduledTime] = useState("12:00");

  // Para gerenciar a visualização dos contatos importados
  const [showContacts, setShowContacts] = useState(false);

  // Lista de variáveis disponíveis para todos os tipos de mensagem
  const variables = [
    { id: "nome", label: "Nome", value: "{{nome}}" },
    { id: "telefone", label: "Telefone", value: "{{telefone}}" },
    { id: "data", label: "Data", value: "{{data}}" },
    { id: "empresa", label: "Empresa", value: "{{empresa}}" },
    { id: "saudacao", label: "Saudação", value: "{{saudacao}}" },
  ];

  const textMessageRef = useRef<HTMLTextAreaElement>(null);
  const mediaCaptionRef = useRef<HTMLTextAreaElement>(null);

  // Estados para o modal de resultado
  const [showResultModal, setShowResultModal] = useState(false);
  const [sendResults, setSendResults] = useState<SendResult[]>([]);
  const [summaryStats, setSummaryStats] = useState({
    total: 0,
    success: 0,
    error: 0,
    scheduled: false,
    scheduledTime: "",
  });

  // Efeito para garantir que o modal seja exibido corretamente
  useEffect(() => {
    if (sendResults.length > 0 && !showResultModal) {
      // Se temos resultados mas o modal não está visível, exibi-lo
      setShowResultModal(true);
    }
  }, [sendResults, showResultModal]);

  // Fetch groups
  const { data: groups = [], isLoading: isLoadingGroups } = useQuery({
    queryKey: ["groups", instance],
    queryFn: async () => {
      try {
        const response = await fetchGroups(instance);
        // Garantir que sempre retornamos um array
        return Array.isArray(response?.response) ? response.response : [];
      } catch (error) {
        console.error("Erro ao buscar grupos:", error);
        return [];
      }
    },
    enabled: selectedTab === "groups", // Only fetch when groups tab is selected
  });

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const csvContent = event.target?.result as string;
      try {
        const parsedContacts = parseCsvContacts(csvContent);
        if (parsedContacts.length > 0) {
          setContacts(parsedContacts);

          // Extrair as variáveis disponíveis (cabeçalhos) do primeiro contato
          if (parsedContacts[0]) {
            const variables = Object.keys(parsedContacts[0]).filter(
              (key) => key !== "number"
            );
            setSelectedVariables(variables);
            toast.success("Contatos importados", {
              description: `${parsedContacts.length} contatos carregados com sucesso`,
            });
            setShowContacts(true);
          }
        } else {
          toast.error("Formato inválido", {
            description:
              "Não foi possível processar o arquivo CSV. Verifique o formato.",
          });
        }
      } catch (error) {
        toast.error("Erro ao processar arquivo", {
          description: "Ocorreu um erro ao processar o arquivo CSV.",
        });
      }
    };
    reader.readAsText(file);
  };

  const downloadCsvTemplate = () => {
    const template = getCsvTemplate();
    const blob = new Blob([template], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "contatos_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const insertVariable = (variable: string) => {
    if (messageType === "text" && textMessageRef.current) {
      const textarea = textMessageRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;

      const newMessage =
        textMessage.substring(0, startPos) +
        variable +
        textMessage.substring(endPos);

      setTextMessage(newMessage);

      // Foco no textarea após inserir a variável
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          startPos + variable.length,
          startPos + variable.length
        );
      }, 0);
    } else if (messageType === "media" && mediaCaptionRef.current) {
      const textarea = mediaCaptionRef.current;
      const startPos = textarea.selectionStart;
      const endPos = textarea.selectionEnd;

      const newCaption =
        mediaCaption.substring(0, startPos) +
        variable +
        mediaCaption.substring(endPos);

      setMediaCaption(newCaption);

      // Foco no textarea após inserir a variável
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(
          startPos + variable.length,
          startPos + variable.length
        );
      }, 0);
    }
  };

  const getMimeType = () => {
    switch (mediaType) {
      case "image":
        return "image/jpeg";
      case "video":
        return "video/mp4";
      case "document":
        return "application/pdf";
      default:
        return "image/jpeg";
    }
  };

  const getFileName = () => {
    if (mediaFileName) return mediaFileName;

    const extension =
      mediaType === "image" ? ".jpg" : mediaType === "video" ? ".mp4" : ".pdf";

    return `arquivo${extension}`;
  };

  const processMessage = async (
    template: string,
    contact: Contact
  ): Promise<string> => {
    // Se o contato tiver a coluna 'mensagem' e estivermos enviando para contatos importados,
    // usamos a mensagem do próprio contato como template principal (substituindo o template padrão)
    let processed =
      selectedTab === "import" && contact.mensagem?.trim()
        ? contact.mensagem
        : template;

    // Primeiro substituir as variáveis personalizadas do contato
    for (const [key, value] of Object.entries(contact)) {
      processed = processed.replace(new RegExp(`{${key}}`, "g"), value);
    }

    // Preparar os dados para substituição de variáveis padrão
    // Obter a data atual formatada com Luxon
    const today = DateTime.now().setLocale("pt-BR").toFormat("dd/MM/yyyy");

    // Determinar saudação com base na hora do dia
    const hour = DateTime.now().hour;
    let saudacao = "Bom dia";
    if (hour >= 12 && hour < 18) {
      saudacao = "Boa tarde";
    } else if (hour >= 18) {
      saudacao = "Boa noite";
    }

    // Tentar obter as informações de contato reais do WhatsApp
    let pushname = "Cliente"; // Valor padrão
    try {
      const contactInfo = await getContactInfo(instance, contact.number);
      if (contactInfo.response && contactInfo.response.pushname) {
        pushname = contactInfo.response.pushname;
      }
    } catch (error) {
      console.error(
        `Erro ao obter informações do contato ${contact.number}:`,
        error
      );
      // Em caso de erro, usar o valor do CSV ou o fallback
      pushname = contact.nome || "Cliente";
    }

    // Mapa de variáveis para substituição
    const variableMap: Record<string, string> = {
      "{{nome}}": pushname,
      "{{telefone}}": contact.number,
      "{{data}}": today,
      "{{empresa}}": instance,
      "{{saudacao}}": saudacao,
    };

    // Substituir todas as variáveis no texto
    for (const [variable, value] of Object.entries(variableMap)) {
      processed = processed.replace(new RegExp(variable, "g"), value);
    }

    // Processar quebras de linha personalizadas (n/) -> transformar em quebra de linha real
    processed = processed.replace(/n\//g, "\n");

    // As formatações *texto* para negrito e _texto_ para itálico são mantidas
    // porque o WhatsApp interpreta corretamente essas marcações

    return processed;
  };

  // Função para obter a data/hora agendada completa usando Luxon
  const getScheduledDateTime = (): DateTime | null => {
    if (!isScheduled || !scheduledDate) return null;

    // Obter as horas e minutos do formato HH:mm
    const [hours, minutes] = scheduledTime.split(":").map(Number);

    // Criar um clone da data e configurar hora/minutos
    const dateWithTime = new Date(scheduledDate);
    dateWithTime.setHours(hours, minutes, 0, 0);

    // Converter para DateTime do Luxon com timezone
    return DateTime.fromJSDate(dateWithTime, {
      zone: "America/Sao_Paulo",
    }).setLocale("pt-BR");
  };

  const handleSubmit = async () => {
    // Validações
    if (messageType === "text" && !textMessage.trim()) {
      toast.error("Mensagem inválida", {
        description: "Por favor, digite uma mensagem de texto para enviar.",
      });
      return;
    }

    if (messageType === "media") {
      if (!mediaUrl.trim()) {
        toast.error("URL de mídia inválida", {
          description: "Por favor, informe a URL da mídia para enviar.",
        });
        return;
      }

      if (!mediaFileName && mediaType === "document") {
        toast.error("Nome do arquivo inválido", {
          description:
            "Por favor, informe um nome para o arquivo a ser enviado.",
        });
        return;
      }
    }

    // Obter os números de telefone
    let numbersToSend: Contact[] = [];

    if (selectedTab === "manual") {
      if (!manualNumbers.trim()) {
        toast.error("Números inválidos", {
          description: "Por favor, insira pelo menos um número de telefone.",
        });
        return;
      }

      // Processar números digitados manualmente
      const lines = manualNumbers.split("\n").filter((line) => line.trim());
      numbersToSend = lines.map((line) => ({ number: line.trim() }));
    } else if (selectedTab === "import") {
      // Usar contatos importados
      if (contacts.length === 0) {
        toast.error("Nenhum contato importado", {
          description: "Por favor, importe contatos antes de enviar mensagens.",
        });
        return;
      }
      numbersToSend = contacts;
    } else if (selectedTab === "groups") {
      // Usar grupos selecionados
      if (selectedGroups.length === 0) {
        toast.error("Nenhum grupo selecionado", {
          description: "Por favor, selecione pelo menos um grupo.",
        });
        return;
      }
      numbersToSend = selectedGroups.map((groupId) => ({ number: groupId }));
    }

    // Verificar agendamento
    if (isScheduled) {
      const scheduledDateTime = getScheduledDateTime();

      if (!scheduledDateTime) {
        toast.error("Data inválida", {
          description:
            "Por favor, selecione uma data e hora válidas para o agendamento.",
        });
        return;
      }

      // Obter a data atual no timezone de São Paulo
      const now = DateTime.now().setZone("America/Sao_Paulo");

      // Verificar se a data agendada é anterior à data atual
      // Comparando os valores como milissegundos para evitar problemas
      if (scheduledDateTime.toMillis() <= now.toMillis()) {
        toast.error("Horário inválido", {
          description: "O horário de agendamento deve ser no futuro.",
        });
        return;
      }
    }

    setIsSubmitting(true);
    const results: SendResult[] = [];

    try {
      let successCount = 0;
      let errorCount = 0;
      const scheduledDateTime = isScheduled ? getScheduledDateTime() : null;

      for (const contact of numbersToSend) {
        try {
          if (messageType === "text") {
            // Agora processMessage é assíncrono
            const processedText = await processMessage(textMessage, contact);

            const payload = {
              number: contact.number,
              text: processedText,
              ...(hasDelay && { delay: delayValue }),
              instance,
            };

            if (isScheduled && scheduledDateTime) {
              // Agendar mensagem (converter DateTime do Luxon para Date do JS)
              await scheduleMessage(
                payload,
                "text",
                scheduledDateTime.toJSDate(),
                instance,
                contact.name
              );
              successCount++;
              results.push({
                number: contact.number,
                success: true,
                variables: { ...contact },
              });
            } else {
              // Enviar imediatamente
              const response = await sendText(instance, payload);

              if (response.error) {
                errorCount++;
                results.push({
                  number: contact.number,
                  success: false,
                  error: response.error,
                  variables: { ...contact },
                });
                console.error(
                  `Erro ao enviar para ${contact.number}:`,
                  response.error
                );
              } else {
                successCount++;
                results.push({
                  number: contact.number,
                  success: true,
                  variables: { ...contact },
                });
              }
            }
          } else {
            // Agora processMessage é assíncrono
            const processedCaption = await processMessage(
              mediaCaption,
              contact
            );

            const payload = {
              number: contact.number,
              mediatype: mediaType,
              mimetype: getMimeType(),
              caption: processedCaption,
              media: mediaUrl,
              fileName: getFileName(),
              ...(hasDelay && { delay: delayValue }),
              instance,
            };

            if (isScheduled && scheduledDateTime) {
              // Agendar mensagem (converter DateTime do Luxon para Date do JS)
              await scheduleMessage(
                payload,
                "media",
                scheduledDateTime.toJSDate(),
                instance,
                contact.name
              );
              successCount++;
              results.push({
                number: contact.number,
                success: true,
                variables: { ...contact },
              });
            } else {
              // Enviar imediatamente
              const response = await sendMedia(instance, payload);

              if (response.error) {
                errorCount++;
                results.push({
                  number: contact.number,
                  success: false,
                  error: response.error,
                  variables: { ...contact },
                });
                console.error(
                  `Erro ao enviar para ${contact.number}:`,
                  response.error
                );
              } else {
                successCount++;
                results.push({
                  number: contact.number,
                  success: true,
                  variables: { ...contact },
                });
              }
            }
          }
        } catch (error) {
          errorCount++;
          results.push({
            number: contact.number,
            success: false,
            error: "Erro interno ao processar envio",
            variables: { ...contact },
          });
          console.error(
            `Erro ao processar envio para ${contact.number}:`,
            error
          );
        }
      }

      // Atualizar os resultados para mostrar no modal
      setSendResults(results);
      setSummaryStats({
        total: successCount + errorCount,
        success: successCount,
        error: errorCount,
        scheduled: isScheduled,
        scheduledTime:
          isScheduled && scheduledDateTime
            ? scheduledDateTime
                .setLocale("pt-BR")
                .toFormat("dd/MM/yyyy 'às' HH:mm")
            : "",
      });

      // Mostrar o modal com os resultados
      setTimeout(() => {
        setShowResultModal(true);
      }, 100);

      // Exibir notificações toast
      if (successCount > 0) {
        if (isScheduled) {
          toast.success("Mensagens agendadas", {
            description: `${successCount} mensagens agendadas para ${scheduledDateTime!
              .setLocale("pt-BR")
              .toFormat("dd/MM/yyyy 'às' HH:mm")}${
              errorCount > 0 ? `, ${errorCount} falhas` : ""
            }`,
          });
        } else {
          toast.success("Mensagens enviadas", {
            description: `${successCount} mensagens enviadas com sucesso${
              errorCount > 0 ? `, ${errorCount} falhas` : ""
            }`,
          });
        }

        // A limpeza do formulário será feita quando o modal for fechado
        // através da propriedade onOpenChange do Dialog
      } else {
        toast.error("Falha no envio", {
          description:
            "Não foi possível enviar nenhuma mensagem. Verifique os detalhes no relatório.",
        });
      }
    } catch (error) {
      toast.error("Erro no envio", {
        description: "Ocorreu um erro ao tentar enviar as mensagens.",
      });
      console.error("Erro no envio:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const clearContacts = () => {
    setContacts([]);
    setSelectedVariables([]);
    setShowContacts(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleVariableSelect = (variable: string) => {
    // Determinar qual textarea está com o foco
    const activeTextarea = document.activeElement;
    let textarea: HTMLTextAreaElement | null = null;
    let text = "";
    let setText: (value: string) => void = () => {};

    if (
      messageType === "text" &&
      (activeTextarea === textMessageRef.current || !activeTextarea)
    ) {
      textarea = textMessageRef.current;
      text = textMessage;
      setText = setTextMessage;
    } else if (
      messageType === "media" &&
      (activeTextarea === mediaCaptionRef.current ||
        activeTextarea?.id === "mediaCaption")
    ) {
      textarea = mediaCaptionRef.current;
      text = mediaCaption;
      setText = setMediaCaption;
    }

    if (textarea) {
      // Obter a posição do cursor
      const startPos = textarea.selectionStart || 0;
      const endPos = textarea.selectionEnd || 0;

      // Inserir a variável na posição do cursor
      const newText =
        text.substring(0, startPos) + `{${variable}}` + text.substring(endPos);

      // Atualizar o texto
      setText(newText);

      // Focar o textarea e posicionar o cursor após a variável inserida
      setTimeout(() => {
        textarea?.focus();
        const newCursorPos = startPos + variable.length + 2; // +2 para os colchetes {}
        textarea?.setSelectionRange(newCursorPos, newCursorPos);
      }, 0);
    } else {
      // Se nenhum textarea tiver foco, inserir no final do texto principal
      if (messageType === "text") {
        setTextMessage(textMessage + `{${variable}}`);
        setTimeout(() => textMessageRef.current?.focus(), 0);
      } else {
        setMediaCaption(mediaCaption + `{${variable}}`);
        setTimeout(() => mediaCaptionRef.current?.focus(), 0);
      }
    }
  };

  // Adicionar uma nova função para facilitar o preenchimento do campo de mensagem com o conteúdo do CSV
  const useCsvMessageAsTemplate = () => {
    // Verificar se temos contatos importados e se eles têm a coluna "mensagem"
    if (contacts.length === 0 || !selectedVariables.includes("mensagem")) {
      toast.error("Nenhuma mensagem disponível", {
        description: "O CSV importado não contém uma coluna 'mensagem' válida.",
      });
      return;
    }

    // Pegar a primeira mensagem do CSV como template
    const firstMessage = contacts[0]?.mensagem || "";
    if (!firstMessage.trim()) {
      toast.error("Mensagem vazia", {
        description: "A primeira mensagem no CSV está vazia.",
      });
      return;
    }

    // Definir a mensagem no campo de texto correspondente
    if (messageType === "text") {
      setTextMessage(firstMessage);
      toast.success("Mensagem aplicada", {
        description: "O texto da mensagem do CSV foi aplicado.",
      });
    } else {
      setMediaCaption(firstMessage);
      toast.success("Legenda aplicada", {
        description: "O texto da legenda do CSV foi aplicado.",
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Modal de resultados - renderizando diretamente, não como componente aninhado */}
      <Dialog
        open={showResultModal}
        onOpenChange={(open) => {
          setShowResultModal(open);
          // Se o modal estiver sendo fechado, verificar se precisamos limpar o formulário
          if (!open && summaryStats.success > 0) {
            setTimeout(() => {
              // Limpar o formulário após fechar o modal
              if (onSuccess) {
                onSuccess();
              }
            }, 300);
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col custom-scrollbar">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BarChart3 className="h-5 w-5 text-primary" />
              Relatório de Disparo
            </DialogTitle>
            <DialogDescription>
              Resumo detalhado do resultado do disparo de mensagens
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 overflow-y-auto flex-1 custom-scrollbar">
            {/* Resumo estatístico */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-slate-100 dark:bg-slate-800 p-4 rounded-lg flex flex-col items-center">
                <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">
                  {summaryStats.total}
                </div>
                <div className="text-sm text-slate-500 dark:text-slate-400">
                  Total de Mensagens
                </div>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg flex flex-col items-center">
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {summaryStats.success}
                </div>
                <div className="text-sm text-green-600/70 dark:text-green-400/70">
                  {summaryStats.scheduled
                    ? "Agendadas com Sucesso"
                    : "Envios com Sucesso"}
                </div>
              </div>

              <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg flex flex-col items-center">
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  {summaryStats.error}
                </div>
                <div className="text-sm text-red-600/70 dark:text-red-400/70">
                  {summaryStats.scheduled
                    ? "Falhas no Agendamento"
                    : "Falhas no Envio"}
                </div>
              </div>
            </div>

            {/* Informação de agendamento, se aplicável */}
            {summaryStats.scheduled && (
              <div className="mb-6 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-medium mb-1">
                  <Calendar className="h-4 w-4" />
                  Mensagens Agendadas
                </div>
                <p className="text-sm text-blue-600/70 dark:text-blue-400/70">
                  Agendado para: {summaryStats.scheduledTime}
                </p>
              </div>
            )}

            {/* Tabela de resultados detalhados */}
            <div className="border rounded-md">
              <table className="w-full text-sm">
                <thead className="bg-slate-100 dark:bg-slate-800 border-b">
                  <tr>
                    <th className="text-left p-3 font-medium">Status</th>
                    <th className="text-left p-3 font-medium">Número</th>
                    {selectedVariables.length > 0 && (
                      <th className="text-left p-3 font-medium">Variáveis</th>
                    )}
                    <th className="text-left p-3 font-medium">Detalhes</th>
                  </tr>
                </thead>
                <tbody>
                  {sendResults.map((result, index) => (
                    <tr key={index} className="border-b last:border-0">
                      <td className="p-3">
                        {result.success ? (
                          <div className="flex items-center gap-1.5 text-green-600 dark:text-green-400">
                            <CheckCircle className="h-4 w-4" />
                            <span>Sucesso</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                            <XCircle className="h-4 w-4" />
                            <span>Falha</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3 font-mono">{result.number}</td>
                      {selectedVariables.length > 0 && (
                        <td className="p-3">
                          {selectedVariables.map((variable) => (
                            <div key={variable} className="text-xs mb-1">
                              <span className="font-medium">{variable}:</span>{" "}
                              {result.variables?.[variable] || "-"}
                            </div>
                          ))}
                        </td>
                      )}
                      <td className="p-3">
                        {result.error ? (
                          <span className="text-red-600 dark:text-red-400 text-xs">
                            {result.error}
                          </span>
                        ) : (
                          <span className="text-slate-500 dark:text-slate-400 text-xs">
                            {summaryStats.scheduled
                              ? "Mensagem agendada"
                              : "Mensagem enviada com sucesso"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Tipo de Mensagem</Label>
          <Select
            value={messageType}
            onValueChange={(value) => setMessageType(value as "text" | "media")}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de mensagem" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="text">Texto</SelectItem>
              <SelectItem value="media">
                Mídia (Imagem, Vídeo, Documento)
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {messageType === "text" ? (
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <Label htmlFor="textMessage">Mensagem de Texto</Label>
              {selectedVariables.includes("mensagem") && (
                <button
                  type="button"
                  onClick={useCsvMessageAsTemplate}
                  className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/30 transition"
                >
                  Usar mensagem do CSV
                </button>
              )}
            </div>
            <Textarea
              id="textMessage"
              placeholder="Digite sua mensagem aqui..."
              className="min-h-[120px]"
              value={textMessage}
              onChange={(e) => setTextMessage(e.target.value)}
              ref={textMessageRef}
            />

            <div className="mt-2">
              <Label className="flex items-center gap-2 mb-2 text-sm">
                <Tag className="h-3.5 w-3.5 text-primary" />
                Variáveis Disponíveis (clique para adicionar)
              </Label>
              <div className="flex flex-wrap gap-2 mt-1">
                {variables.map((variable) => (
                  <button
                    key={variable.id}
                    type="button"
                    onClick={() => insertVariable(variable.value)}
                    className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-xs text-slate-700 dark:text-slate-200 transition-colors"
                  >
                    {variable.label}
                  </button>
                ))}

                {selectedVariables.length > 0 && (
                  <>
                    <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2" />
                    <p className="text-xs text-muted-foreground w-full mb-1">
                      Variáveis do CSV:
                    </p>
                    {selectedVariables.map((variable) => (
                      <button
                        key={variable}
                        type="button"
                        className="px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 text-xs"
                        onClick={() => handleVariableSelect(variable)}
                      >
                        {variable}
                      </button>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label htmlFor="mediaType">Tipo de Mídia</Label>
              <Select
                value={mediaType}
                onValueChange={(value) =>
                  setMediaType(value as "image" | "video" | "document")
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de mídia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="image">Imagem</SelectItem>
                  <SelectItem value="video">Vídeo</SelectItem>
                  <SelectItem value="document">Documento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="mediaUrl">URL da Mídia</Label>
              <Input
                id="mediaUrl"
                placeholder="https://exemplo.com/imagem.jpg"
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Insira a URL da{" "}
                {mediaType === "image"
                  ? "imagem"
                  : mediaType === "video"
                  ? "vídeo"
                  : "documento"}{" "}
                que deseja enviar
              </p>
            </div>

            {mediaType === "document" && (
              <div className="space-y-2">
                <Label htmlFor="fileName">Nome do Arquivo</Label>
                <Input
                  id="fileName"
                  placeholder="documento.pdf"
                  value={mediaFileName}
                  onChange={(e) => setMediaFileName(e.target.value)}
                />
              </div>
            )}

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <Label htmlFor="mediaCaption">Legenda</Label>
                {selectedVariables.includes("mensagem") && (
                  <button
                    type="button"
                    onClick={useCsvMessageAsTemplate}
                    className="px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-md hover:bg-blue-100 dark:hover:bg-blue-800/30 transition"
                  >
                    Usar mensagem do CSV
                  </button>
                )}
              </div>
              <Textarea
                id="mediaCaption"
                placeholder="Digite a legenda aqui..."
                className="min-h-[80px]"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
                ref={mediaCaptionRef}
              />

              <div className="mt-2">
                <Label className="flex items-center gap-2 mb-2 text-sm">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Variáveis Disponíveis (clique para adicionar)
                </Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {variables.map((variable) => (
                    <button
                      key={variable.id}
                      type="button"
                      onClick={() => insertVariable(variable.value)}
                      className="px-2 py-1 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md text-xs text-slate-700 dark:text-slate-200 transition-colors"
                    >
                      {variable.label}
                    </button>
                  ))}

                  {selectedVariables.length > 0 && (
                    <>
                      <div className="w-full h-px bg-slate-200 dark:bg-slate-700 my-2" />
                      <p className="text-xs text-muted-foreground w-full mb-1">
                        Variáveis do CSV:
                      </p>
                      {selectedVariables.map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          className="px-2 py-1 bg-primary/10 text-primary rounded hover:bg-primary/20 text-xs"
                          onClick={() => handleVariableSelect(variable)}
                        >
                          {variable}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium mb-4">Destinatários</h3>

          <Tabs
            value={selectedTab}
            onValueChange={(value) =>
              setSelectedTab(value as "manual" | "import" | "groups")
            }
          >
            <TabsList className="mb-4">
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                <span>Adicionar Manualmente</span>
              </TabsTrigger>
              <TabsTrigger value="import" className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                <span>Importar CSV</span>
              </TabsTrigger>
              <TabsTrigger value="groups" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Grupos</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="manual">
              <div className="space-y-2">
                <Label htmlFor="manualNumbers">Números de Telefone</Label>
                <Textarea
                  id="manualNumbers"
                  placeholder="Adicione um número por linha com código do país. Ex: 5511999999999"
                  className="min-h-[120px]"
                  value={manualNumbers}
                  onChange={(e) => setManualNumbers(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Digite um número por linha, incluindo o código do país (Ex:
                  5511999999999)
                </p>
              </div>
            </TabsContent>

            <TabsContent value="import">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleFileUpload}
                        className="flex-1"
                      />
                      {contacts.length > 0 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={clearContacts}
                        >
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      Aceita apenas arquivos CSV. Campos que contêm vírgulas,
                      como mensagens, devem estar entre aspas (").
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="whitespace-nowrap"
                    icon={<Download className="h-4 w-4" />}
                    onClick={downloadCsvTemplate}
                  >
                    Template CSV
                  </Button>
                </div>

                {contacts.length > 0 && (
                  <>
                    <Alert>
                      <Info className="h-4 w-4" />
                      <AlertTitle>Contatos importados</AlertTitle>
                      <AlertDescription>
                        {contacts.length} contatos foram importados.
                        <button
                          type="button"
                          className="ml-2 underline text-primary"
                          onClick={() => setShowContacts(!showContacts)}
                        >
                          {showContacts ? "Ocultar lista" : "Ver lista"}
                        </button>
                        <div className="mt-2 text-xs">
                          <strong>Dica:</strong> Campos com vírgulas, como
                          mensagens, devem estar entre aspas (") para serem
                          processados corretamente.
                        </div>
                      </AlertDescription>
                    </Alert>

                    {showContacts && (
                      <div className="border rounded-md max-h-[200px] overflow-y-auto mt-2">
                        <table className="w-full text-sm">
                          <thead className="sticky top-0 bg-background border-b">
                            <tr>
                              <th className="text-left p-2 font-medium">
                                Número
                              </th>
                              {selectedVariables.map((variable) => (
                                <th
                                  key={variable}
                                  className="text-left p-2 font-medium"
                                >
                                  {variable}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {contacts.slice(0, 20).map((contact, index) => (
                              <tr
                                key={index}
                                className="border-b last:border-0"
                              >
                                <td className="p-2">{contact.number}</td>
                                {selectedVariables.map((variable) => (
                                  <td key={variable} className="p-2">
                                    {contact[variable] || "-"}
                                  </td>
                                ))}
                              </tr>
                            ))}
                            {contacts.length > 20 && (
                              <tr>
                                <td
                                  colSpan={selectedVariables.length + 1}
                                  className="p-2 text-center text-muted-foreground"
                                >
                                  ...e mais {contacts.length - 20} contatos
                                </td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
                )}
              </div>
            </TabsContent>

            <TabsContent value="groups">
              <div className="space-y-4">
                {isLoadingGroups ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando grupos...
                  </div>
                ) : groups.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <h4 className="text-lg font-medium mb-2">
                      Nenhum grupo encontrado
                    </h4>
                    <p className="text-muted-foreground">
                      Verifique se a instância está conectada e tente novamente.
                      Se o problema persistir, não foram encontrados grupos para
                      esta instância.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {groups.map((group) => (
                      <div
                        key={group.id}
                        className={cn(
                          "flex items-center justify-between p-4 rounded-lg border",
                          selectedGroups.includes(group.id)
                            ? "border-primary bg-primary/5"
                            : "border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-start gap-3">
                          <Users className="h-5 w-5 text-primary mt-0.5" />
                          <div>
                            <h4 className="font-medium">{group.subject}</h4>
                            <p className="text-sm text-muted-foreground mt-1">
                              {group.size} membros
                            </p>
                            {group.desc && (
                              <p className="text-xs text-muted-foreground mt-1">
                                {group.desc}
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          type="button"
                          variant={
                            selectedGroups.includes(group.id)
                              ? "default"
                              : "outline"
                          }
                          size="sm"
                          onClick={() => {
                            setSelectedGroups((prev) =>
                              prev.includes(group.id)
                                ? prev.filter((id) => id !== group.id)
                                : [...prev, group.id]
                            );
                          }}
                        >
                          {selectedGroups.includes(group.id)
                            ? "Selecionado"
                            : "Selecionar"}
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <h3 className="text-lg font-medium mb-4">Opções Avançadas</h3>

          <div className="space-y-4">
            {/* Seção de Delay */}
            <div className="flex items-center space-x-2 mb-4">
              <Switch
                id="hasDelay"
                checked={hasDelay}
                onCheckedChange={setHasDelay}
              />
              <Label htmlFor="hasDelay">Adicionar Delay</Label>
            </div>

            {hasDelay && (
              <div className="space-y-2 pl-6">
                <Label htmlFor="delayValue">Delay entre mensagens (ms)</Label>
                <Input
                  id="delayValue"
                  type="number"
                  min={100}
                  value={delayValue}
                  onChange={(e) => setDelayValue(parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Tempo de espera entre o envio de cada mensagem (em
                  milissegundos). Recomendado: 3000ms
                </p>
              </div>
            )}

            {/* Seção de agendamento */}
            <div className="flex items-center space-x-2 mb-4 mt-6">
              <Switch
                id="isScheduled"
                checked={isScheduled}
                onCheckedChange={setIsScheduled}
              />
              <Label htmlFor="isScheduled" className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" />
                Agendar Envio
              </Label>
            </div>

            {isScheduled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-6">
                <div className="space-y-2">
                  <Label htmlFor="scheduledDate">Data</Label>
                  <div className="relative">
                    <DatePicker
                      selected={scheduledDate}
                      onChange={(date: Date | null) =>
                        date && setScheduledDate(date)
                      }
                      locale="pt-BR"
                      dateFormat="dd/MM/yyyy"
                      minDate={new Date()}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      showPopperArrow={false}
                      wrapperClassName="w-full"
                    />
                    <div className="absolute right-3 top-1/2 transform -translate-y-1/2 pointer-events-none text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Selecione uma data (incluindo hoje)
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scheduledTime">Hora</Label>
                  <Input
                    id="scheduledTime"
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Horário de Brasília (GMT-3) no formato 24h
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 flex justify-end">
          <Button
            type="button"
            className="w-full sm:w-auto"
            icon={
              isScheduled ? (
                <Calendar className="h-4 w-4" />
              ) : (
                <Send className="h-4 w-4" />
              )
            }
            onClick={handleSubmit}
            loading={isSubmitting}
            disabled={isSubmitting}
          >
            {isScheduled ? "Agendar Disparo" : "Iniciar Disparo"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DisparadorForm;
