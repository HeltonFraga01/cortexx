import { useState, useRef, useCallback } from "react";
import { toast } from "sonner";
import { DateTime } from "luxon";
import {
    sendText,
    sendMedia,
    scheduleMessage,
    getContactInfo,
    fetchGroups,
} from "@/lib/api";
import {
    validatePhoneNumber,
    normalizePhoneNumber,
    PhoneValidationResult
} from "@/lib/phone-utils";
import {
    handleApiError,
    isRetryableError,
    formatErrorForToast,
    requiresUserAction,
    type ApiError
} from "@/lib/errorHandler";
import { useQuery } from "@tanstack/react-query";

interface UseSingleMessageSenderProps {
    instance: string;
    onSuccess?: () => void;
}

export const useSingleMessageSender = ({ instance, onSuccess }: UseSingleMessageSenderProps) => {
    const [destinationType, setDestinationType] = useState<"contact" | "group">("contact");
    const [number, setNumber] = useState("");
    const [selectedGroupId, setSelectedGroupId] = useState("");
    const [message, setMessage] = useState("");
    const messageRef = useRef<HTMLTextAreaElement>(null);
    const [messageType, setMessageType] = useState<"text" | "media">("text");
    const [mediaUrl, setMediaUrl] = useState("");
    const [mediaCaption, setMediaCaption] = useState("");
    const [mediaType, setMediaType] = useState<"image" | "video" | "document">("image");
    const [mediaFileName, setMediaFileName] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [lastError, setLastError] = useState<ApiError | null>(null);
    const [canRetry, setCanRetry] = useState(false);

    // Scheduling state
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
    const [isSchedulingValid, setIsSchedulingValid] = useState(false);

    // Fetch groups
    const { data: groups = [], isLoading: isLoadingGroups } = useQuery({
        queryKey: ["groups", instance],
        queryFn: async () => {
            try {
                const response = await fetchGroups(instance);
                return Array.isArray(response?.response) ? response.response : [];
            } catch (error) {
                console.error("Erro ao buscar grupos:", error);
                return [];
            }
        },
        enabled: destinationType === "group",
    });

    const insertVariable = (variable: string) => {
        if (messageRef.current) {
            const textarea = messageRef.current;
            const startPos = textarea.selectionStart;
            const endPos = textarea.selectionEnd;

            const newMessage =
                message.substring(0, startPos) + variable + message.substring(endPos);

            setMessage(newMessage);

            setTimeout(() => {
                textarea.focus();
                textarea.setSelectionRange(
                    startPos + variable.length,
                    startPos + variable.length
                );
            }, 0);
        } else {
            setMessage(message + variable);
        }
    };

    const getMimeType = () => {
        switch (mediaType) {
            case "image": return "image/jpeg";
            case "video": return "video/mp4";
            case "document": return "application/pdf";
            default: return "image/jpeg";
        }
    };

    const getFileName = () => {
        if (mediaFileName) return mediaFileName;
        const extension = mediaType === "image" ? ".jpg" : mediaType === "video" ? ".mp4" : ".pdf";
        return `arquivo${extension}`;
    };

    const processMessage = async (template: string): Promise<string> => {
        let processed = template;
        const today = DateTime.now().setLocale("pt-BR").toFormat("dd/MM/yyyy");
        const hour = DateTime.now().hour;
        let saudacao = "Bom dia";
        if (hour >= 12 && hour < 18) saudacao = "Boa tarde";
        else if (hour >= 18) saudacao = "Boa noite";

        let pushname = "Cliente";
        try {
            const contactInfo = await getContactInfo(instance, number);
            if (contactInfo.response?.pushname) {
                pushname = contactInfo.response.pushname;
            }
        } catch (error) {
            console.error(`Erro ao obter informações do contato ${number}:`, error);
        }

        const variableMap: Record<string, string> = {
            "{{nome}}": pushname,
            "{{telefone}}": number,
            "{{data}}": today,
            "{{empresa}}": instance,
            "{{saudacao}}": saudacao,
        };

        for (const [variable, value] of Object.entries(variableMap)) {
            processed = processed.replace(new RegExp(variable, "g"), value);
        }

        processed = processed.replace(/n\//g, "\n");
        return processed;
    };

    const handleSubmit = async () => {
        if (destinationType === "contact") {
            if (!number.trim()) {
                toast.error("Número inválido", { description: "Por favor, informe um número de telefone válido." });
                return;
            }

            toast.info("Validando número", { description: "Verificando formato e existência no WhatsApp..." });

            const validation: PhoneValidationResult = await validatePhoneNumber(number, instance, true);

            if (!validation.isValid) {
                toast.error("Número inválido", { description: validation.error || "Formato de número inválido.", duration: 5000 });
                return;
            }

            if (validation.warning) {
                toast.warning("Aviso", { description: validation.warning, duration: 4000 });
            }

            if (validation.normalized) {
                setNumber(validation.normalized);
            }

            const description = validation.contactName
                ? `Contato encontrado: ${validation.contactName}`
                : `Número válido: ${validation.formatted || validation.normalized}`;

            toast.success("Número verificado", { description, duration: 3000 });
        }

        if (destinationType === "group" && !selectedGroupId) {
            toast.error("Grupo inválido", { description: "Por favor, selecione um grupo para enviar a mensagem." });
            return;
        }

        if (messageType === "text" && !message.trim()) {
            toast.error("Mensagem inválida", { description: "Por favor, digite uma mensagem para enviar." });
            return;
        }

        if (messageType === "media") {
            if (!mediaUrl.trim()) {
                toast.error("URL de mídia inválida", { description: "Por favor, informe a URL da mídia para enviar." });
                return;
            }

            if (!mediaFileName && mediaType === "document") {
                toast.error("Nome do arquivo inválido", { description: "Por favor, informe um nome para o arquivo a ser enviado." });
                return;
            }
        }

        if (isScheduled && !isSchedulingValid) {
            toast.error("Agendamento inválido", { description: "Por favor, selecione uma data e hora válidas no futuro." });
            return;
        }

        setIsSubmitting(true);

        try {
            const destinationNumber = destinationType === "group" ? selectedGroupId : normalizePhoneNumber(number.trim());

            if (messageType === "text") {
                const processedText = await processMessage(message);
                const payload = { number: destinationNumber, text: processedText, instance };

                if (isScheduled && scheduledDateTime) {
                    await scheduleMessage(payload, "text", scheduledDateTime, instance, undefined);
                    const luxonDateTime = DateTime.fromJSDate(scheduledDateTime).setZone("America/Sao_Paulo");
                    toast.success("Mensagem Agendada", { description: `Mensagem de texto agendada para ${luxonDateTime.toFormat("dd/MM/yyyy 'às' HH:mm")}` });
                } else {
                    const response = await sendText(instance, payload);
                    if (response.error) {
                        toast.error("Erro ao Enviar", { description: response.error });
                    } else {
                        toast.success("Mensagem Enviada", { description: "Mensagem de texto enviada com sucesso!" });
                    }
                }
            } else {
                const processedCaption = await processMessage(mediaCaption);
                const payload = {
                    number: destinationNumber,
                    mediatype: mediaType,
                    mimetype: getMimeType(),
                    caption: processedCaption,
                    media: mediaUrl,
                    fileName: getFileName(),
                    instance,
                };

                if (isScheduled && scheduledDateTime) {
                    await scheduleMessage(payload, "media", scheduledDateTime, instance, undefined);
                    const luxonDateTime = DateTime.fromJSDate(scheduledDateTime).setZone("America/Sao_Paulo");
                    toast.success("Mensagem Agendada", { description: `Mensagem de mídia agendada para ${luxonDateTime.toFormat("dd/MM/yyyy 'às' HH:mm")}` });
                } else {
                    const response = await sendMedia(instance, payload);
                    if (response.error) {
                        toast.error("Erro ao Enviar", { description: response.error });
                    } else {
                        toast.success("Mensagem Enviada", { description: "Mensagem de mídia enviada com sucesso!" });
                    }
                }
            }

            if (!isScheduled) {
                setNumber("");
                setSelectedGroupId("");
                setMessage("");
                setMediaUrl("");
                setMediaCaption("");
                setMediaFileName("");
                setIsScheduled(false);
                setScheduledDateTime(null);
                setIsSchedulingValid(false);
            }

            if (onSuccess) onSuccess();
        } catch (error) {
            console.error("Erro ao enviar mensagem:", error);
            
            // Use the error handler to get user-friendly message
            const errorResult = handleApiError(error);
            const toastData = formatErrorForToast(error);
            
            // Store error for potential retry
            setLastError(error as ApiError);
            setCanRetry(isRetryableError(error));
            
            // Show appropriate toast based on error type
            if (toastData.variant === 'destructive') {
                toast.error(toastData.title, { 
                    description: toastData.description,
                    duration: 5000
                });
            } else {
                toast.warning(toastData.title, { 
                    description: toastData.description,
                    duration: 4000
                });
            }
            
            // If requires user action (login, reconnect), show additional guidance
            if (requiresUserAction(error)) {
                setTimeout(() => {
                    toast.info("Ação necessária", {
                        description: errorResult.suggestion || "Verifique sua conexão e tente novamente.",
                        duration: 6000
                    });
                }, 1000);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    // Retry function for retryable errors
    const handleRetry = useCallback(async () => {
        if (!canRetry) {
            toast.warning("Não é possível tentar novamente", {
                description: "Este tipo de erro não permite nova tentativa."
            });
            return;
        }
        
        setLastError(null);
        setCanRetry(false);
        await handleSubmit();
    }, [canRetry]);

    // Clear error state
    const clearError = useCallback(() => {
        setLastError(null);
        setCanRetry(false);
    }, []);

    return {
        destinationType,
        setDestinationType,
        number,
        setNumber,
        selectedGroupId,
        setSelectedGroupId,
        message,
        setMessage,
        messageRef,
        messageType,
        setMessageType,
        mediaUrl,
        setMediaUrl,
        mediaCaption,
        setMediaCaption,
        mediaType,
        setMediaType,
        mediaFileName,
        setMediaFileName,
        isSubmitting,
        isScheduled,
        setIsScheduled,
        scheduledDateTime,
        setScheduledDateTime,
        isSchedulingValid,
        setIsSchedulingValid,
        groups,
        isLoadingGroups,
        insertVariable,
        handleSubmit,
        // New error handling exports
        lastError,
        canRetry,
        handleRetry,
        clearError,
    };
};
