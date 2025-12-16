/**
 * RecipientPicker Component
 * Unified component for selecting recipients based on send type
 * 
 * Requirements: 4.2, 4.3, 4.4, 4.5, 4.6, 6.1, 6.2
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Plus,
  X,
  Upload,
  Users,
  Tag,
  Database,
  Phone,
} from 'lucide-react';
import { SendType } from './SendTypeSelector';
import { Contact } from '@/services/draftService';
import { toast } from 'sonner';

interface RecipientPickerProps {
  sendType: SendType;
  recipients: Contact[];
  onChange: (recipients: Contact[]) => void;
}

export function RecipientPicker({
  sendType,
  recipients,
  onChange,
}: RecipientPickerProps) {
  const [manualInput, setManualInput] = useState('');
  const [selectedGroup, setSelectedGroup] = useState('');
  const [selectedTag, setSelectedTag] = useState('');

  // Parse phone numbers from text input
  const parsePhoneNumbers = (text: string): Contact[] => {
    const lines = text.split(/[\n,;]+/);
    const contacts: Contact[] = [];
    
    lines.forEach((line) => {
      const trimmed = line.trim();
      if (trimmed) {
        // Extract phone number (remove non-numeric except +)
        const phone = trimmed.replace(/[^\d+]/g, '');
        if (phone.length >= 10) {
          contacts.push({
            id: `manual-${phone}`,
            phone,
            name: undefined,
          });
        }
      }
    });

    return contacts;
  };

  const handleManualAdd = () => {
    const newContacts = parsePhoneNumbers(manualInput);
    if (newContacts.length === 0) {
      toast.error('Nenhum número válido encontrado');
      return;
    }

    // Merge with existing, avoiding duplicates
    const existingPhones = new Set(recipients.map((r) => r.phone));
    const uniqueNew = newContacts.filter((c) => !existingPhones.has(c.phone));
    
    onChange([...recipients, ...uniqueNew]);
    setManualInput('');
    toast.success(`${uniqueNew.length} contato(s) adicionado(s)`);
  };

  const handleRemoveRecipient = (phone: string) => {
    onChange(recipients.filter((r) => r.phone !== phone));
  };

  const handleClearAll = () => {
    onChange([]);
  };

  const handleCSVUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const newContacts = parsePhoneNumbers(text);
      
      if (newContacts.length === 0) {
        toast.error('Nenhum número válido encontrado no arquivo');
        return;
      }

      const existingPhones = new Set(recipients.map((r) => r.phone));
      const uniqueNew = newContacts.filter((c) => !existingPhones.has(c.phone));
      
      onChange([...recipients, ...uniqueNew]);
      toast.success(`${uniqueNew.length} contato(s) importado(s)`);
    };
    reader.readAsText(file);
    
    // Reset input
    event.target.value = '';
  };

  // Mock data for groups and tags (in production, fetch from API)
  const mockGroups = [
    { id: 'g1', name: 'Clientes VIP', count: 50 },
    { id: 'g2', name: 'Leads Novos', count: 120 },
    { id: 'g3', name: 'Newsletter', count: 500 },
  ];

  const mockTags = [
    { id: 't1', name: 'ativo', count: 200 },
    { id: 't2', name: 'premium', count: 45 },
    { id: 't3', name: 'interessado', count: 80 },
  ];

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroup(groupId);
    const group = mockGroups.find((g) => g.id === groupId);
    if (group) {
      // In production, fetch actual contacts from the group
      const mockContacts: Contact[] = Array.from({ length: Math.min(group.count, 10) }, (_, i) => ({
        id: `group-${groupId}-${i}`,
        phone: `5511999${String(i).padStart(6, '0')}`,
        name: `Contato ${i + 1}`,
      }));
      onChange(mockContacts);
      toast.success(`Grupo "${group.name}" selecionado`);
    }
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTag(tagId);
    const tag = mockTags.find((t) => t.id === tagId);
    if (tag) {
      // In production, fetch actual contacts with this tag
      const mockContacts: Contact[] = Array.from({ length: Math.min(tag.count, 10) }, (_, i) => ({
        id: `tag-${tagId}-${i}`,
        phone: `5511998${String(i).padStart(6, '0')}`,
        name: `Contato Tag ${i + 1}`,
      }));
      onChange(mockContacts);
      toast.success(`Tag "${tag.name}" selecionada`);
    }
  };

  return (
    <div className="space-y-4">
      {/* Manual Input */}
      {sendType === 'manual' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                Digite os números de telefone
              </Label>
              <Textarea
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                rows={4}
                placeholder="5511999999999&#10;5511888888888&#10;..."
              />
              <p className="text-xs text-muted-foreground">
                Um número por linha, ou separados por vírgula
              </p>
            </div>
            <Button onClick={handleManualAdd} disabled={!manualInput.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Group Selection */}
      {sendType === 'group' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Selecione um grupo
              </Label>
              <Select value={selectedGroup} onValueChange={handleGroupSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha um grupo" />
                </SelectTrigger>
                <SelectContent>
                  {mockGroups.map((group) => (
                    <SelectItem key={group.id} value={group.id}>
                      {group.name} ({group.count} contatos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tag Selection */}
      {sendType === 'tag' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Tag className="h-4 w-4" />
                Selecione uma tag
              </Label>
              <Select value={selectedTag} onValueChange={handleTagSelect}>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma tag" />
                </SelectTrigger>
                <SelectContent>
                  {mockTags.map((tag) => (
                    <SelectItem key={tag.id} value={tag.id}>
                      #{tag.name} ({tag.count} contatos)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV Upload */}
      {sendType === 'csv' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Importe um arquivo CSV
              </Label>
              <div className="flex items-center gap-4">
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleCSVUpload}
                  className="cursor-pointer"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                O arquivo deve conter números de telefone (um por linha ou separados por vírgula)
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Database Selection */}
      {sendType === 'database' && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Database className="h-4 w-4" />
                Selecione uma tabela
              </Label>
              <Select>
                <SelectTrigger>
                  <SelectValue placeholder="Escolha uma tabela" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="contacts">Contatos</SelectItem>
                  <SelectItem value="leads">Leads</SelectItem>
                  <SelectItem value="customers">Clientes</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Configure a conexão com banco de dados em Configurações
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Selected Recipients */}
      {recipients.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between mb-4">
              <Label>Contatos selecionados ({recipients.length})</Label>
              <Button variant="ghost" size="sm" onClick={handleClearAll}>
                <X className="h-4 w-4 mr-1" />
                Limpar todos
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
              {recipients.slice(0, 50).map((recipient) => (
                <Badge
                  key={recipient.id}
                  variant="secondary"
                  className="flex items-center gap-1"
                >
                  {recipient.name || recipient.phone}
                  <X
                    className="h-3 w-3 cursor-pointer hover:text-destructive"
                    onClick={() => handleRemoveRecipient(recipient.phone)}
                  />
                </Badge>
              ))}
              {recipients.length > 50 && (
                <Badge variant="outline">
                  +{recipients.length - 50} mais
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default RecipientPicker;
