/**
 * ContactSelection Component
 * 
 * Barra flutuante que aparece quando há contatos selecionados.
 * Fornece ações em massa: adicionar tags, salvar grupo, enviar mensagem, exportar CSV.
 * Animação de entrada/saída usando CSS animations.
 */

import { useState, useEffect } from 'react';
import { X, Tag, FolderPlus, MessageSquare, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface ContactSelectionProps {
  selectedCount: number;
  onClearSelection: () => void;
  onAddTags: () => void;
  onSaveGroup: () => void;
  onSendMessage: () => void;
  onExport: () => void;
}

export function ContactSelection({
  selectedCount,
  onClearSelection,
  onAddTags,
  onSaveGroup,
  onSendMessage,
  onExport,
}: ContactSelectionProps) {
  const [isDesktop, setIsDesktop] = useState(false);

  // Detectar mudanças de viewport
  useEffect(() => {
    const checkViewport = () => {
      setIsDesktop(window.innerWidth >= 640);
    };

    // Verificar inicialmente
    checkViewport();

    // Adicionar listener para resize
    window.addEventListener('resize', checkViewport);
    return () => window.removeEventListener('resize', checkViewport);
  }, []);

  // Não renderizar se não houver seleção
  if (selectedCount === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50",
        "sm:bottom-6 sm:left-1/2 sm:right-auto",
        "sm:w-auto sm:max-w-4xl",
        "transition-all duration-300",
        "animate-in slide-in-from-bottom-4"
      )}
      style={{
        transform: isDesktop ? 'translateX(-50%)' : undefined,
      }}
      role="region"
      aria-label="Ações para contatos selecionados"
      aria-live="polite"
    >
      <Card className="shadow-2xl border-2 border-primary/20 hover:shadow-3xl transition-shadow duration-300">
        <CardContent className="p-3 sm:p-4">
          {/* Layout Mobile: Melhorado */}
          <div className="sm:hidden space-y-3">
            {/* Linha 1: Badge + Limpar */}
            <div className="flex items-center justify-between gap-2">
              <Badge 
                variant="secondary" 
                className="text-sm px-3 py-1.5 font-semibold"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {selectedCount} {selectedCount === 1 ? 'contato' : 'contatos'}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearSelection}
                className="h-8 px-3 text-muted-foreground hover:text-foreground"
                aria-label="Limpar seleção"
              >
                <X className="h-4 w-4 mr-1" />
                <span className="text-xs">Limpar</span>
              </Button>
            </div>
            
            {/* Linha 2: Botões de ação em grid 2x2 */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={onAddTags}
                className="h-10 gap-2 text-sm"
                aria-label="Adicionar Tags"
              >
                <Tag className="h-4 w-4" />
                <span>Tags</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onSaveGroup}
                className="h-10 gap-2 text-sm"
                aria-label="Salvar Grupo"
              >
                <FolderPlus className="h-4 w-4" />
                <span>Grupo</span>
              </Button>
              <Button
                variant="default"
                size="sm"
                onClick={onSendMessage}
                className="h-10 gap-2 text-sm col-span-2"
                aria-label="Enviar Mensagem"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Enviar Mensagem</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={onExport}
                className="h-10 gap-2 text-sm col-span-2"
                aria-label="Exportar CSV"
              >
                <Download className="h-4 w-4" />
                <span>Exportar CSV</span>
              </Button>
            </div>
          </div>

          {/* Layout Desktop: Melhorado */}
          <div className="hidden sm:block">
            <div className="flex flex-col gap-3">
              {/* Linha 1: Badge + Limpar */}
              <div className="flex items-center justify-between gap-2">
                <Badge 
                  variant="secondary" 
                  className="text-sm px-3 py-1.5 font-semibold whitespace-nowrap"
                  role="status"
                  aria-live="polite"
                  aria-atomic="true"
                >
                  {selectedCount} {selectedCount === 1 ? 'contato' : 'contatos'}
                </Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClearSelection}
                  className="gap-1.5 text-muted-foreground hover:text-foreground transition-all duration-200 hover:scale-105"
                  aria-label="Limpar seleção de contatos"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                  <span>Limpar</span>
                </Button>
              </div>

              {/* Linha 2: Ações em grid responsivo */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-2" role="toolbar" aria-label="Ações em massa">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onAddTags}
                  className="gap-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  aria-label={`Adicionar tags aos ${selectedCount} contatos selecionados`}
                >
                  <Tag className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Adicionar Tags</span>
                  <span className="md:hidden">Tags</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSaveGroup}
                  className="gap-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md"
                  aria-label={`Salvar ${selectedCount} contatos como grupo`}
                >
                  <FolderPlus className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Salvar Grupo</span>
                  <span className="md:hidden">Grupo</span>
                </Button>

                <Button
                  variant="default"
                  size="sm"
                  onClick={onSendMessage}
                  className="gap-1.5 transition-all duration-200 hover:scale-105 hover:shadow-lg col-span-2 lg:col-span-1"
                  aria-label={`Enviar mensagem para ${selectedCount} contatos selecionados`}
                >
                  <MessageSquare className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Enviar Mensagem</span>
                  <span className="md:hidden">Enviar</span>
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={onExport}
                  className="gap-1.5 transition-all duration-200 hover:scale-105 hover:shadow-md col-span-2 lg:col-span-1"
                  aria-label={`Exportar ${selectedCount} contatos para CSV`}
                >
                  <Download className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden md:inline">Exportar CSV</span>
                  <span className="md:hidden">CSV</span>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
