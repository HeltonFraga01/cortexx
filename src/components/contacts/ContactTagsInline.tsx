/**
 * ContactTagsInline Component
 * 
 * Gerenciamento inline de tags para um único contato.
 * Exibe tags atuais e permite adicionar/remover inline.
 */

import { useState } from 'react';
import { X, Plus, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tag } from '@/services/contactsStorageService';
import { Checkbox } from '@/components/ui/checkbox';

interface ContactTagsInlineProps {
  contactPhone: string;
  contactTags: Tag[];
  availableTags: Tag[];
  onAddTags: (contactPhone: string, tagIds: string[]) => void;
  onRemoveTag: (contactPhone: string, tagId: string) => void;
}

export function ContactTagsInline({
  contactPhone,
  contactTags,
  availableTags,
  onAddTags,
  onRemoveTag,
}: ContactTagsInlineProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set());

  // Tags disponíveis que o contato ainda não tem
  const availableToAdd = availableTags.filter(
    tag => !contactTags.some(ct => ct.id === tag.id)
  );

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
      onAddTags(contactPhone, Array.from(selectedTagIds));
      setSelectedTagIds(new Set());
      setIsEditing(false);
    }
  };

  // Cancelar edição
  const handleCancel = () => {
    setSelectedTagIds(new Set());
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-2 p-2 border rounded-md bg-muted/50" role="form" aria-label="Adicionar tags ao contato">
        {availableToAdd.length > 0 ? (
          <>
            <div className="space-y-1 max-h-32 overflow-y-auto" role="group" aria-label="Tags disponíveis">
              {availableToAdd.map(tag => (
                <label
                  key={tag.id}
                  className="flex items-center gap-2 p-1 rounded hover:bg-accent cursor-pointer text-sm"
                >
                  <Checkbox
                    checked={selectedTagIds.has(tag.id)}
                    onCheckedChange={() => handleToggleTag(tag.id)}
                    aria-label={`Adicionar tag ${tag.name}`}
                  />
                  <Badge
                    variant="secondary"
                    style={{
                      backgroundColor: tag.color + '20',
                      borderColor: tag.color,
                      color: tag.color,
                    }}
                    className="text-xs border"
                  >
                    {tag.name}
                  </Badge>
                </label>
              ))}
            </div>
            <div className="flex items-center gap-1 justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                aria-label="Cancelar adição de tags"
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </Button>
              <Button
                size="sm"
                onClick={handleApplyTags}
                disabled={selectedTagIds.size === 0}
                aria-label="Confirmar adição de tags"
              >
                <Check className="h-3 w-3" aria-hidden="true" />
              </Button>
            </div>
          </>
        ) : (
          <div className="text-xs text-muted-foreground">
            Todas as tags já foram adicionadas
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCancel}
              className="ml-2"
              aria-label="Fechar"
            >
              <X className="h-3 w-3" aria-hidden="true" />
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-1 items-center overflow-hidden" role="group" aria-label="Tags do contato">
      {/* Tags atuais */}
      {contactTags.slice(0, 3).map(tag => (
        <Badge
          key={tag.id}
          variant="secondary"
          style={{
            backgroundColor: tag.color + '20',
            borderColor: tag.color,
            color: tag.color,
          }}
          className="text-xs border group relative pr-6 max-w-[120px] truncate"
          aria-label={`Tag ${tag.name}`}
        >
          <span className="truncate">{tag.name}</span>
          <button
            onClick={() => onRemoveTag(contactPhone, tag.id)}
            className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100 focus:outline-none focus:ring-1 focus:ring-ring rounded"
            aria-label={`Remover tag ${tag.name}`}
            type="button"
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </Badge>
      ))}
      
      {/* Indicador de mais tags */}
      {contactTags.length > 3 && (
        <Badge
          variant="secondary"
          className="text-xs"
          aria-label={`${contactTags.length - 3} tag${contactTags.length - 3 !== 1 ? 's' : ''} adicional${contactTags.length - 3 !== 1 ? 'is' : ''}: ${contactTags.slice(3).map(t => t.name).join(', ')}`}
        >
          +{contactTags.length - 3}
        </Badge>
      )}
      
      {/* Botão para adicionar mais tags */}
      {availableToAdd.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsEditing(true)}
          className="h-6 px-2 flex-shrink-0"
          aria-label="Adicionar mais tags"
        >
          <Plus className="h-3 w-3" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}
