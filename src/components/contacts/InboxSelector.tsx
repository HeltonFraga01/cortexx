/**
 * InboxSelector Component
 * 
 * Modal/dropdown for selecting which inbox to import contacts from
 * Requirements: 1.1, 1.3, 1.5, 1.6
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Phone, Wifi, WifiOff } from 'lucide-react';
import { InboxOption } from '@/services/contactsApiService';

interface InboxSelectorProps {
  inboxes: InboxOption[];
  isOpen: boolean;
  onSelect: (inbox: InboxOption) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function InboxSelector({
  inboxes,
  isOpen,
  onSelect,
  onCancel,
  isLoading = false
}: InboxSelectorProps) {
  const [selectedInbox, setSelectedInbox] = useState<InboxOption | null>(null);

  const handleSelect = () => {
    if (selectedInbox) {
      onSelect(selectedInbox);
    }
  };

  const connectedInboxes = inboxes.filter(inbox => inbox.isConnected);
  const disconnectedInboxes = inboxes.filter(inbox => !inbox.isConnected);

  return (
    <Dialog open={isOpen} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Selecionar Caixa de Entrada
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Escolha de qual caixa de entrada você deseja importar os contatos:
          </p>

          {/* Connected Inboxes */}
          {connectedInboxes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-green-700 dark:text-green-400">
                Conectadas
              </h4>
              {connectedInboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className={`
                    p-3 border rounded-lg cursor-pointer transition-colors
                    ${selectedInbox?.id === inbox.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                    }
                  `}
                  onClick={() => setSelectedInbox(inbox)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Wifi className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="font-medium">{inbox.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {inbox.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="bg-green-100 text-green-700">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Conectada
                      </Badge>
                      {selectedInbox?.id === inbox.id && (
                        <div className="w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <div className="w-2 h-2 rounded-full bg-white" />
                        </div>
                      )}
                    </div>
                  </div>
                  {inbox.lastImportAt && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Última importação: {new Date(inbox.lastImportAt).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Disconnected Inboxes */}
          {disconnectedInboxes.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-red-700 dark:text-red-400">
                Desconectadas
              </h4>
              {disconnectedInboxes.map((inbox) => (
                <div
                  key={inbox.id}
                  className="p-3 border border-red-200 rounded-lg bg-red-50/50 dark:bg-red-950/20 opacity-60"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <WifiOff className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="font-medium text-red-700 dark:text-red-400">
                            {inbox.name}
                          </p>
                          <p className="text-sm text-red-600 dark:text-red-500">
                            {inbox.phoneNumber}
                          </p>
                        </div>
                      </div>
                    </div>
                    <Badge variant="destructive" className="bg-red-100 text-red-700">
                      <AlertCircle className="h-3 w-3 mr-1" />
                      Desconectada
                    </Badge>
                  </div>
                  <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                    Reconecte esta caixa de entrada para importar contatos
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* No inboxes */}
          {inboxes.length === 0 && (
            <div className="text-center py-8">
              <Phone className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Nenhuma caixa de entrada encontrada
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Configure uma caixa de entrada primeiro
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancelar
            </Button>
            <Button
              onClick={handleSelect}
              disabled={!selectedInbox || isLoading}
              className="min-w-[100px]"
            >
              {isLoading ? 'Importando...' : 'Importar'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}