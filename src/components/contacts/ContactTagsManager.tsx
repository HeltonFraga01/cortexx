/**
 * ContactTagsManager Component
 * 
 * Gerenciamento inline de tags para contatos selecionados.
 * Permite adicionar, remover e criar novas tags sem usar modais.
 */

import { useState } from 'react';
import { X, Plus, Check, Tag as TagIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Tag } from '@/services/contactsStorageService';
import { cn } from '@/lib/utils';

interface ContactTagsManagerProps {
  availableTags: Tag[];
  selectedContactsCount: number;
  onAddTags: (tagIds: string[]) => void;
  onCreateTag: (tag: Omit<Tag, 'id'>) => void;
  onClose: () => void;
}

// Cores predefinidas para tags
const TAG_COLORS = [
  { name: 'Vermelho', value: '#ef4444' },
  { name: 'Laranja', value: '#f97316' },
  { name: 'Amarelo', value: '#eab308' },
  { name: 'Verde', value: '#22c55e' },
  { name: 'Azul', value: '#3b82f6' },
  { name: 'Roxo', value: '#a855f7' },
  { name: 'Rosa', value: '#ec4899' },
  { name: 'Cinza', value: '#6b7280' },
];

export function ContactTagsManager({
  availableTags,
  selectedContactsCount,
  onAddTags,
  onCreateTag,
  onClose,
}: ContactTagsManagerProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(TAG_COLORS[0].value);

  // Toggle seleção de tag
  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds(prev => {
      const next = new Set(prev);
      if (next.has(tagId)) {
        next.delete(tagId);
      } else {
        next.add(tagId);
      }
      return next;
    });
  };

  // Aplicar tags selecionadas
  const handleApplyTags = () => {
    if (selectedTagIds.size > 0) {
      onAddTags(Array.from(selectedTagIds));
      onClose();
    }
  };

  // Criar nova tag
  const handleCreateTag = () => {
    if (newTagName.trim()) {
      onCreateTag({
        name: newTagName.trim(),
        color: newTagColor,
      });
      setNewTagName('');
      setNewTagColor(TAG_COLORS[0].value);
      setShowNewTagForm(false);
    }
  };

  // Cancelar criação de tag
  const handleCancelNewTag = () => {
    setNewTagName('');
    setNewTagColor(TAG_COLORS[0].value);
    setShowNewTagForm(false);
  };

  return (
    <Card className="border-2 border-primary animate-slide-in" role="dialog" aria-labelledby="tags-manager-title">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle id="tags-manager-title" className="text-base flex items-center gap-2">
            <TagIcon className="h-4 w-4" aria-hidden="true" />
            Adicionar Tags a {selectedContactsCount} {selectedContactsCount === 1 ? 'contato' : 'contatos'}
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            aria-label="Fechar gerenciador de tags"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Lista de tags existentes */}
        {availableTags.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Selecione as tags:</legend>
            <div className="space-y-2 max-h-48 overflow-y-auto" role="group" aria-label="Lista de tags disponíveis">
              {availableTags.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center gap-3 p-2 rounded-md hover:bg-accent cursor-pointer transition-colors"
                >
                  <Checkbox
                    checked={selectedTagIds.has(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                    aria-label={`Selecionar tag ${tag.name}`}
                  />
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: tag.color + '20',
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    className="border"
                    aria-label={`Tag ${tag.name}`}
                  >
                    {tag.name}
                  </Badge>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {/* Botão para criar nova tag */}
        {!showNewTagForm && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowNewTagForm(true)}
            className="w-full gap-2"
            aria-label="Criar nova tag"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Criar Nova Tag
          </Button>
        )}

        {/* Formulário de nova tag inline */}
        {showNewTagForm && (
          <div className="space-y-3 p-3 border rounded-md bg-muted/50" role="form" aria-label="Formulário de nova tag">
            <p className="text-sm font-medium" id="new-tag-label">Nova Tag:</p>
            
            {/* Nome da tag */}
            <Input
              placeholder="Nome da tag"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateTag();
                if (e.key === 'Escape') handleCancelNewTag();
              }}
              autoFocus
              aria-label="Nome da nova tag"
              aria-describedby="new-tag-label"
            />

            {/* Seletor de cor */}
            <fieldset className="space-y-2">
              <legend className="text-xs text-muted-foreground">Escolha uma cor:</legend>
              <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cores disponíveis para a tag">
                {TAG_COLORS.map(color => (
                  <button
                    key={color.value}
                    type="button"
                    onClick={() => setNewTagColor(color.value)}
                    className={cn(
                      "w-8 h-8 rounded-full border-2 transition-all focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
                      newTagColor === color.value
                        ? "border-foreground scale-110"
                        : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: color.value }}
                    aria-label={`Cor ${color.name}`}
                    role="radio"
                    aria-checked={newTagColor === color.value}
                  />
                ))}
              </div>
            </fieldset>

            {/* Botões de ação */}
            <div className="flex items-center gap-2 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancelNewTag}
                aria-label="Cancelar criação de tag"
              >
                <X className="h-4 w-4 mr-2" aria-hidden="true" />
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreateTag}
                disabled={!newTagName.trim()}
                aria-label="Criar tag"
              >
                <Check className="h-4 w-4 mr-2" aria-hidden="true" />
                Criar Tag
              </Button>
            </div>
          </div>
        )}

        {/* Botões de ação principal */}
        <div className="flex items-center gap-2 justify-end pt-2 border-t">
          <Button
            variant="outline"
            onClick={onClose}
            aria-label="Cancelar e fechar"
          >
            Cancelar
          </Button>
          <Button
            onClick={handleApplyTags}
            disabled={selectedTagIds.size === 0}
            aria-label={`Adicionar ${selectedTagIds.size} tag${selectedTagIds.size !== 1 ? 's' : ''} aos contatos selecionados`}
          >
            <Check className="h-4 w-4 mr-2" aria-hidden="true" />
            Adicionar {selectedTagIds.size > 0 && `(${selectedTagIds.size})`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
