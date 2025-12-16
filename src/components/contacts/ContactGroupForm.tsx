/**
 * ContactGroupForm Component
 * 
 * Formulário inline para criar grupo a partir de contatos selecionados.
 * Aparece quando o usuário clica em "Salvar Grupo" na barra de seleção.
 */

import { useState } from 'react';
import { Check, X, FolderPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ContactGroupFormProps {
  selectedContactsCount: number;
  selectedContactIds: string[];
  onCreateGroup: (name: string, contactIds: string[]) => void;
  onClose: () => void;
}

export function ContactGroupForm({
  selectedContactsCount,
  selectedContactIds,
  onCreateGroup,
  onClose,
}: ContactGroupFormProps) {
  const [groupName, setGroupName] = useState('');

  // Criar grupo
  const handleCreateGroup = () => {
    if (groupName.trim() && selectedContactIds.length > 0) {
      onCreateGroup(groupName.trim(), selectedContactIds);
      onClose();
    }
  };

  return (
    <Card className="border-2 border-primary animate-slide-in">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FolderPlus className="h-4 w-4" />
            Salvar Grupo com {selectedContactsCount} {selectedContactsCount === 1 ? 'contato' : 'contatos'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Nome do Grupo:</label>
          <Input
            placeholder="Ex: Clientes VIP, Leads Quentes, etc."
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateGroup();
              if (e.key === 'Escape') onClose();
            }}
            autoFocus
          />
        </div>

        <div className="flex items-center gap-2 justify-end pt-2 border-t">
          <Button
            variant="outline"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleCreateGroup}
            disabled={!groupName.trim()}
          >
            <Check className="h-4 w-4 mr-2" />
            Salvar Grupo
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
