import { useState } from 'react';
import { MessageSquare, Send, Trash, Clock, AlertCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Button from '@/components/ui-custom/Button';
import { ScheduledSingleMessage, formatScheduledDate, isOverdue, getTimeUntilScheduled } from '@/lib/scheduled-items';
import { cn } from '@/lib/utils';

interface ScheduledSingleMessageCardProps {
  message: ScheduledSingleMessage;
  onRemove: (id: string) => void;
}

export function ScheduledSingleMessageCard({ message, onRemove }: ScheduledSingleMessageCardProps) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isText = message.messageType === 'text';
  const overdue = isOverdue(message.scheduledAt);
  const timeUntil = getTimeUntilScheduled(message.scheduledAt);

  const handleRemove = () => {
    if (confirmDelete) {
      onRemove(message.id);
    } else {
      setConfirmDelete(true);
    }
  };

  const handleCancel = () => {
    setConfirmDelete(false);
  };

  return (
    <div
      className={cn(
        'border border-border rounded-lg p-4 relative hover:bg-muted/50 transition-colors',
        overdue && message.status === 'pending' && 'border-destructive/50 bg-destructive/5'
      )}
    >
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {isText ? (
              <MessageSquare className="h-4 w-4 text-primary" />
            ) : (
              <Send className="h-4 w-4 text-primary" />
            )}
            <span className="font-medium">
              {isText ? 'Mensagem de Texto' : 'Mensagem com Mídia'}
            </span>
            <Badge
              variant={
                message.status === 'pending'
                  ? 'outline'
                  : message.status === 'sent'
                  ? 'secondary'
                  : 'destructive'
              }
            >
              {message.status === 'pending'
                ? 'Pendente'
                : message.status === 'sent'
                ? 'Enviada'
                : 'Falhou'}
            </Badge>
          </div>

          <div className="text-sm text-muted-foreground mb-2 flex items-center gap-2">
            <Clock className="h-3.5 w-3.5" />
            <span>
              {formatScheduledDate(message.scheduledAt)}
              {message.status === 'pending' && !overdue && (
                <span className="ml-2 text-xs">({timeUntil})</span>
              )}
            </span>
            {overdue && message.status === 'pending' && (
              <Badge variant="destructive" className="ml-2">
                <AlertCircle className="h-3 w-3 mr-1" />
                Atrasado
              </Badge>
            )}
          </div>

          <div className="text-sm mb-1">
            <span className="font-medium">Destinatário:</span>{' '}
            {message.recipientName ? `${message.recipientName} (${message.recipient})` : message.recipient}
          </div>

          <div className="text-sm mb-1">
            <span className="font-medium">Instância:</span>{' '}
            <span className="font-mono text-xs">{message.instance.substring(0, 8)}...</span>
          </div>

          <div className="text-sm mt-2">
            <span className="font-medium">Conteúdo:</span>{' '}
            <span className="text-muted-foreground line-clamp-2">
              {message.messageContent.length > 100
                ? message.messageContent.substring(0, 100) + '...'
                : message.messageContent}
            </span>
          </div>

          {message.mediaUrl && (
            <div className="text-sm mt-1">
              <span className="font-medium">Mídia:</span>{' '}
              <span className="text-muted-foreground text-xs">
                {message.mediaType} - {message.mediaUrl.substring(0, 50)}...
              </span>
            </div>
          )}
        </div>

        <div className="ml-4">
          {confirmDelete ? (
            <div className="flex items-center space-x-2">
              <Button
                type="button"
                variant="destructive"
                onClick={handleRemove}
                className="flex items-center gap-1"
                size="sm"
              >
                <Trash className="h-3.5 w-3.5" />
                Confirmar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                size="sm"
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRemove}
              className="text-destructive hover:text-destructive"
            >
              <Trash className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {message.error && (
        <div className="mt-2 text-sm text-destructive flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5" />
          <div>
            <span className="font-medium">Erro:</span> {message.error}
          </div>
        </div>
      )}
    </div>
  );
}
