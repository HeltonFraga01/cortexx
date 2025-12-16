import { useState, useEffect, useCallback } from "react";
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
import {
  Send,
  AlertCircle,
  Calendar,
  Tag,
  Users,
  CheckCircle2,
  XCircle,
  Loader2,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Switch } from "@/components/ui/switch";
import { SchedulingInput } from "@/components/shared/forms/SchedulingInput";
import { useSingleMessageSender } from "./hooks/useSingleMessageSender";
import { suggestPhoneFormat } from "@/lib/phone-utils";

interface DisparadorUnicoProps {
  instance: string;
  onSuccess?: () => void;
}

const DisparadorUnico = ({ instance, onSuccess }: DisparadorUnicoProps) => {
  const {
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
    setIsSchedulingValid,
    groups,
    isLoadingGroups,
    insertVariable,
    handleSubmit,
  } = useSingleMessageSender({ instance, onSuccess });

  // Phone validation state
  const [phoneValidationState, setPhoneValidationState] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [phoneValidationMessage, setPhoneValidationMessage] = useState<string>('');
  const [phoneSuggestion, setPhoneSuggestion] = useState<string | null>(null);

  // Debounced phone validation
  useEffect(() => {
    if (!number || number.trim().length < 8) {
      setPhoneValidationState('idle');
      setPhoneValidationMessage('');
      setPhoneSuggestion(null);
      return;
    }

    setPhoneValidationState('validating');
    
    const timeoutId = setTimeout(() => {
      // Basic format validation
      const digitsOnly = number.replace(/\D/g, '');
      
      if (digitsOnly.length < 10) {
        setPhoneValidationState('invalid');
        setPhoneValidationMessage('Número muito curto. Inclua o DDD.');
        setPhoneSuggestion(null);
        return;
      }

      if (digitsOnly.length > 15) {
        setPhoneValidationState('invalid');
        setPhoneValidationMessage('Número muito longo.');
        setPhoneSuggestion(null);
        return;
      }

      // Check for suggestion
      const suggestion = suggestPhoneFormat(number);
      if (suggestion && suggestion !== number) {
        setPhoneSuggestion(suggestion);
      } else {
        setPhoneSuggestion(null);
      }

      setPhoneValidationState('valid');
      setPhoneValidationMessage('Formato válido');
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [number]);

  // Apply phone suggestion
  const applySuggestion = useCallback(() => {
    if (phoneSuggestion) {
      setNumber(phoneSuggestion);
      setPhoneSuggestion(null);
    }
  }, [phoneSuggestion, setNumber]);

  // Lista de variáveis disponíveis
  const variables = [
    { id: "nome", label: "Nome", value: "{{nome}}" },
    { id: "telefone", label: "Telefone", value: "{{telefone}}" },
    { id: "data", label: "Data", value: "{{data}}" },
    { id: "empresa", label: "Empresa", value: "{{empresa}}" },
    { id: "saudacao", label: "Saudação", value: "{{saudacao}}" },
  ];

  return (
    <div className="space-y-6">
      <Alert variant="destructive" className="mb-4">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Envio Único</AlertTitle>
        <AlertDescription>
          Esta função permite enviar uma única mensagem para um número
          específico ou grupo. Para envios em massa, utilize a aba "Novo
          Disparo".
        </AlertDescription>
      </Alert>

      <div className="grid gap-4">
        <div className="space-y-2">
          <Label>Tipo de Destinatário</Label>
          <Select
            value={destinationType}
            onValueChange={(value) =>
              setDestinationType(value as "contact" | "group")
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo de destinatário" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="contact">Contato Individual</SelectItem>
              <SelectItem value="group">Grupo</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {destinationType === "contact" ? (
          <div className="space-y-2">
            <Label htmlFor="number">Número do Destinatário</Label>
            <div className="relative">
              <Input
                id="number"
                placeholder="+55 11 99999-9999"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className={`pr-10 ${
                  phoneValidationState === 'valid' ? 'border-green-500 focus-visible:ring-green-500' :
                  phoneValidationState === 'invalid' ? 'border-red-500 focus-visible:ring-red-500' :
                  ''
                }`}
              />
              {/* Validation indicator */}
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {phoneValidationState === 'validating' && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                {phoneValidationState === 'valid' && (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                )}
                {phoneValidationState === 'invalid' && (
                  <XCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
            </div>
            
            {/* Validation message */}
            {phoneValidationState === 'invalid' && phoneValidationMessage && (
              <p className="text-xs text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {phoneValidationMessage}
              </p>
            )}
            
            {/* Format suggestion */}
            {phoneSuggestion && phoneValidationState === 'valid' && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Sugestão de formato:</span>
                <button
                  type="button"
                  onClick={applySuggestion}
                  className="text-primary hover:underline font-medium"
                >
                  {phoneSuggestion}
                </button>
              </div>
            )}
            
            {/* Help text */}
            {phoneValidationState === 'idle' && (
              <p className="text-xs text-muted-foreground">
                Aceita qualquer formato: com ou sem código do país, espaços ou hífens.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="group">Grupo</Label>
            <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um grupo" />
              </SelectTrigger>
              <SelectContent>
                {isLoadingGroups ? (
                  <SelectItem value="loading" disabled>
                    Carregando grupos...
                  </SelectItem>
                ) : groups.length === 0 ? (
                  <SelectItem value="empty" disabled>
                    Nenhum grupo encontrado
                  </SelectItem>
                ) : (
                  groups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-primary" />
                        <span>{group.subject}</span>
                        <span className="text-xs text-muted-foreground">
                          ({group.size} membros)
                        </span>
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
            {selectedGroupId && (
              <div className="text-xs text-muted-foreground">
                {groups.find((g) => g.id === selectedGroupId)?.desc ||
                  "Sem descrição"}
              </div>
            )}
            {groups.length === 0 && !isLoadingGroups && (
              <p className="text-xs text-muted-foreground mt-1">
                Verifique se a instância está conectada e tente novamente.
              </p>
            )}
          </div>
        )}

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
            <Label htmlFor="message">Mensagem de Texto</Label>
            <Textarea
              id="message"
              placeholder="Digite sua mensagem aqui..."
              className="min-h-[120px]"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              ref={messageRef}
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
              <Label htmlFor="mediaCaption">Legenda</Label>
              <Textarea
                id="mediaCaption"
                placeholder="Digite a legenda aqui..."
                className="min-h-[80px]"
                value={mediaCaption}
                onChange={(e) => setMediaCaption(e.target.value)}
              />
            </div>
          </>
        )}

        {/* Seção de agendamento */}
        <div className="pt-4 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center space-x-2 mb-4">
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
            <div className="pl-6 mt-4">
              <SchedulingInput
                value={scheduledDateTime}
                onChange={setScheduledDateTime}
                onValidationChange={setIsSchedulingValid}
                showSummary={true}
              />
            </div>
          )}
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
            {isScheduled ? "Agendar Mensagem" : "Enviar Mensagem"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default DisparadorUnico;
