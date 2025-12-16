/**
 * TemplateEditor Component
 * Form for creating and editing message templates with preview
 * 
 * Requirements: 1.2, 1.3, 1.4
 */

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { X, Check, FileText, Eye, Variable } from 'lucide-react';
import { CampaignTemplate, CreateTemplateDTO, UpdateTemplateDTO } from '@/services/templateService';
import { toast } from 'sonner';

interface TemplateEditorProps {
  template?: CampaignTemplate;
  onSave: (data: CreateTemplateDTO | UpdateTemplateDTO) => Promise<void>;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TemplateEditor({
  template,
  onSave,
  onCancel,
  isLoading = false,
}: TemplateEditorProps) {
  const [name, setName] = useState(template?.name || '');
  const [description, setDescription] = useState(template?.description || '');
  const [messageContent, setMessageContent] = useState(
    template?.config?.messageContent || ''
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);

  // Extract variables from message content
  const extractVariables = (content: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches = content.match(regex) || [];
    return [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, '')))];
  };

  const variables = extractVariables(messageContent);

  // Preview with sample data
  const getPreview = () => {
    let preview = messageContent;
    variables.forEach((v) => {
      preview = preview.replace(
        new RegExp(`\\{\\{${v}\\}\\}`, 'g'),
        `[${v}]`
      );
    });
    return preview;
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Nome é obrigatório';
    }

    if (!messageContent.trim()) {
      newErrors.messageContent = 'Conteúdo da mensagem é obrigatório';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setIsSaving(true);
    try {
      const data: CreateTemplateDTO | UpdateTemplateDTO = {
        name: name.trim(),
        description: description.trim() || undefined,
        config: {
          messageContent: messageContent.trim(),
        },
      };

      await onSave(data);
      toast.success(template ? 'Template atualizado' : 'Template criado');
    } catch (error: any) {
      toast.error('Erro ao salvar template', {
        description: error.message,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const insertVariable = (variable: string) => {
    setMessageContent((prev) => prev + `{{${variable}}}`);
  };

  return (
    <Card className="border-2 border-primary">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          {template ? 'Editar Template' : 'Novo Template'}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <Label htmlFor="name">Nome do Template</Label>
          <Input
            id="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={errors.name ? 'border-destructive' : ''}
            disabled={isLoading || isSaving}
          />
          {errors.name && (
            <p className="text-sm text-destructive">{errors.name}</p>
          )}
        </div>

        {/* Description Field */}
        <div className="space-y-2">
          <Label htmlFor="description">Descrição (opcional)</Label>
          <Input
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={isLoading || isSaving}
          />
        </div>

        {/* Message Content */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="messageContent">Conteúdo da Mensagem</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                Variáveis disponíveis:
              </span>
              {['nome', 'telefone', 'email'].map((v) => (
                <Badge
                  key={v}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary hover:text-primary-foreground"
                  onClick={() => insertVariable(v)}
                >
                  <Variable className="h-3 w-3 mr-1" />
                  {v}
                </Badge>
              ))}
            </div>
          </div>
          <Textarea
            id="messageContent"
            value={messageContent}
            onChange={(e) => setMessageContent(e.target.value)}
            rows={6}
            className={errors.messageContent ? 'border-destructive' : ''}
            disabled={isLoading || isSaving}
          />
          {errors.messageContent && (
            <p className="text-sm text-destructive">{errors.messageContent}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Use {'{{variavel}}'} para inserir variáveis dinâmicas
          </p>
        </div>

        {/* Variables Found */}
        {variables.length > 0 && (
          <div className="space-y-2">
            <Label>Variáveis detectadas</Label>
            <div className="flex flex-wrap gap-2">
              {variables.map((v) => (
                <Badge key={v} variant="secondary">
                  <Variable className="h-3 w-3 mr-1" />
                  {v}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />

        {/* Preview */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Eye className="h-4 w-4" />
            Prévia da Mensagem
          </Label>
          <div className="rounded-lg bg-muted p-4 whitespace-pre-wrap text-sm">
            {getPreview() || (
              <span className="text-muted-foreground italic">
                Digite o conteúdo da mensagem para ver a prévia
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={onCancel}
            disabled={isSaving}
          >
            <X className="h-4 w-4 mr-2" />
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isLoading || isSaving}
          >
            <Check className="h-4 w-4 mr-2" />
            {isSaving ? 'Salvando...' : 'Salvar'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default TemplateEditor;
