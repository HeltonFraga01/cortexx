/**
 * ContactsTable Component
 * 
 * Tabela de contatos com seleção, paginação e ações inline.
 * Usa virtualização com react-window para performance com grandes listas.
 * Implementa memoization para otimizar renderização.
 */

import { useState, useRef, useEffect, useMemo, useCallback, memo, useContext } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { List, ListImperativeAPI } from 'react-window';
import { Edit2, Trash2, Tag as TagIcon, ChevronLeft, ChevronRight, X, Check, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useChatApi } from '@/hooks/useChatApi';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Contact } from '@/services/bulkCampaignService';
import { Tag } from '@/services/contactsStorageService';
import { contactsService } from '@/services/contactsService';
import { ContactTagsInline } from './ContactTagsInline';

interface ContactsTableProps {
  contacts: Contact[];
  tags: Tag[];
  selectedIds: Set<string>;
  onSelectionChange: (ids: Set<string>) => void;
  onContactUpdate: (phone: string, updates: Partial<Contact>) => void;
  onContactDelete: (phones: string[]) => void;
  onAddTagsToContact: (contactPhones: string[], tagIds: string[]) => void;
  onRemoveTagFromContact: (contactPhone: string, tagId: string) => void;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onStartChat?: (phone: string, name?: string) => void;
}

// Constantes de virtualização
const ROW_HEIGHT = 60; // Altura de cada linha em pixels
const CONTAINER_HEIGHT = 600; // Altura do container de virtualização

export function ContactsTable({
  contacts,
  tags,
  selectedIds,
  onSelectionChange,
  onContactUpdate,
  onContactDelete,
  onAddTagsToContact,
  onRemoveTagFromContact,
  page,
  pageSize,
  onPageChange,
  onStartChat,
}: ContactsTableProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const chatApi = useChatApi();
  const [editingPhone, setEditingPhone] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const listRef = useRef<ListImperativeAPI>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Determine chat path based on current location (agent or user)
  const chatPath = location.pathname.startsWith('/agent') ? '/agent/chat' : '/user/chat';

  // Handler para iniciar chat com um contato
  const handleStartChat = useCallback(async (contact: Contact) => {
    if (startingChat) return; // Prevent double clicks
    
    // Use custom handler if provided
    if (onStartChat) {
      onStartChat(contact.phone, contact.name);
      return;
    }
    
    setStartingChat(contact.phone);
    try {
      const conversation = await chatApi.startConversation(contact.phone, { name: contact.name });
      
      // Navigate to chat with the conversation
      navigate(`${chatPath}?conversation=${conversation.id}`);
      
      toast.success('Conversa iniciada', {
        description: `Chat com ${contact.name || contact.phone}`
      });
    } catch (error: any) {
      console.error('Error starting chat:', error);
      toast.error('Erro ao iniciar conversa', {
        description: error.message || 'Tente novamente'
      });
    } finally {
      setStartingChat(null);
    }
  }, [navigate, startingChat, chatApi, chatPath, onStartChat]);

  // Atualizar largura do container quando redimensionar
  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Paginar contatos com memoization
  const paginationData = useMemo(() => {
    return contactsService.paginateContacts(contacts, page, pageSize);
  }, [contacts, page, pageSize]);

  const { contacts: paginatedContacts, totalPages, currentPage } = paginationData;

  // Verificar se todos da página estão selecionados com memoization
  const { allPageSelected, somePageSelected } = useMemo(() => {
    const all = paginatedContacts.every(c => selectedIds.has(c.phone));
    const some = paginatedContacts.some(c => selectedIds.has(c.phone));
    return { allPageSelected: all, somePageSelected: some };
  }, [paginatedContacts, selectedIds]);

  // Toggle seleção de todos da página com useCallback
  const handleSelectAll = useCallback(() => {
    const newSelection = new Set(selectedIds);
    
    if (allPageSelected) {
      // Desmarcar todos da página
      paginatedContacts.forEach(c => newSelection.delete(c.phone));
    } else {
      // Marcar todos da página
      paginatedContacts.forEach(c => newSelection.add(c.phone));
    }
    
    onSelectionChange(newSelection);
  }, [selectedIds, allPageSelected, paginatedContacts, onSelectionChange]);

  // Toggle seleção individual com useCallback
  const handleToggleContact = useCallback((phone: string) => {
    const newSelection = new Set(selectedIds);
    
    if (newSelection.has(phone)) {
      newSelection.delete(phone);
    } else {
      newSelection.add(phone);
    }
    
    onSelectionChange(newSelection);
  }, [selectedIds, onSelectionChange]);

  // Iniciar edição de nome com useCallback
  const handleStartEdit = useCallback((contact: Contact) => {
    setEditingPhone(contact.phone);
    setEditingName(contact.name || '');
  }, []);

  // Salvar edição de nome com useCallback
  const handleSaveEdit = useCallback(() => {
    if (editingPhone) {
      onContactUpdate(editingPhone, { name: editingName });
      setEditingPhone(null);
      setEditingName('');
    }
  }, [editingPhone, editingName, onContactUpdate]);

  // Cancelar edição com useCallback
  const handleCancelEdit = useCallback(() => {
    setEditingPhone(null);
    setEditingName('');
  }, []);

  // Obter tags de um contato com useCallback
  const getContactTags = useCallback((contact: Contact): Tag[] => {
    if (!contact.variables?.tags) return [];
    
    const contactTagIds = Array.isArray(contact.variables.tags)
      ? contact.variables.tags
      : [contact.variables.tags];
    
    return tags.filter(tag => contactTagIds.includes(tag.id));
  }, [tags]);

  // Componente de linha virtualizada
  const RowComponent = ({ 
    index, 
    style 
  }: { 
    index: number; 
    style: React.CSSProperties;
    ariaAttributes: {
      'aria-posinset': number;
      'aria-setsize': number;
      role: 'listitem';
    };
  }) => {
    const contact = paginatedContacts[index];
    const isSelected = selectedIds.has(contact.phone);
    const isEditing = editingPhone === contact.phone;
    const contactTags = getContactTags(contact);

    return (
      <div 
        style={style} 
        className={`flex items-center border-b transition-all duration-200 hover:bg-accent/30 min-w-[500px] xs:min-w-[600px] ${isSelected ? 'bg-accent/50' : ''}`}
        role="row"
        aria-selected={isSelected}
      >
        {/* Checkbox */}
        <div className="w-10 sm:w-12 px-1 sm:px-4 flex items-center justify-center flex-shrink-0" role="cell">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggleContact(contact.phone)}
            aria-label={`Selecionar contato ${contact.name || contact.phone}`}
          />
        </div>

        {/* Telefone */}
        <div className="min-w-[120px] px-1 sm:px-4 font-mono text-[10px] sm:text-sm flex-shrink-0" role="cell">
          <span className="truncate block" aria-label={`Telefone ${contactsService.formatPhoneDisplay(contact.phone)}`}>
            {contactsService.formatPhoneDisplay(contact.phone)}
          </span>
        </div>

        {/* Nome */}
        <div className="flex-[2] px-1 sm:px-4 min-w-[120px] text-xs sm:text-sm" role="cell">
          {isEditing ? (
            <div className="flex items-center gap-1 animate-in">
              <Input
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSaveEdit();
                  if (e.key === 'Escape') handleCancelEdit();
                }}
                className="h-7 sm:h-8 text-xs sm:text-sm transition-all duration-200"
                autoFocus
                placeholder="Nome"
                aria-label={`Editar nome do contato ${contact.phone}`}
              />
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleSaveEdit}
                className="text-green-600 hover:text-green-700 transition-all duration-200 hover:scale-110 h-7 w-7 p-0"
                aria-label="Salvar"
              >
                <Check className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
              <Button 
                size="sm" 
                variant="ghost" 
                onClick={handleCancelEdit}
                className="text-muted-foreground transition-all duration-200 hover:scale-110 h-7 w-7 p-0"
                aria-label="Cancelar"
              >
                <X className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
            </div>
          ) : (
            <button 
              className="cursor-pointer hover:text-primary transition-all duration-200 text-left w-full hover:translate-x-1 truncate"
              onClick={() => handleStartEdit(contact)}
              aria-label={`Editar nome do contato ${contact.name || contact.phone}`}
              tabIndex={0}
            >
              {contact.name || <span className="text-muted-foreground italic text-xs">Sem nome</span>}
            </button>
          )}
        </div>

        {/* Tags */}
        <div className="flex-1 px-1 sm:px-4 min-w-[100px]" role="cell">
          <div className="text-xs">
            <ContactTagsInline
              contactPhone={contact.phone}
              contactTags={contactTags}
              availableTags={tags}
              onAddTags={onAddTagsToContact}
              onRemoveTag={onRemoveTagFromContact}
            />
          </div>
        </div>

        {/* Ações inline */}
        <div className="w-24 sm:w-32 px-1 sm:px-4 flex items-center justify-end gap-0.5 flex-shrink-0" role="cell">
          {!isEditing && (
            <>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleStartChat(contact)}
                disabled={startingChat === contact.phone}
                className="text-primary hover:text-primary transition-all duration-200 hover:scale-110 h-7 w-7 p-0"
                aria-label={`Iniciar chat com ${contact.name || contact.phone}`}
                title="Iniciar conversa"
              >
                {startingChat === contact.phone ? (
                  <span className="h-3 w-3 sm:h-4 sm:w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                ) : (
                  <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
                )}
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => handleStartEdit(contact)}
                className="transition-all duration-200 hover:scale-110 h-7 w-7 p-0"
                aria-label={`Editar ${contact.name || contact.phone}`}
              >
                <Edit2 className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => onContactDelete([contact.phone])}
                className="text-destructive hover:text-destructive transition-all duration-200 hover:scale-110 h-7 w-7 p-0"
                aria-label={`Remover ${contact.name || contact.phone}`}
              >
                <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" aria-hidden="true" />
              </Button>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2 sm:space-y-4">
      {/* Dica de scroll para mobile */}
      {paginatedContacts.length > 0 && (
        <div className="sm:hidden text-xs text-muted-foreground text-center py-1.5 bg-muted/50 rounded-md border">
          ← Deslize horizontalmente para ver mais →
        </div>
      )}
      
      {/* Tabela com virtualização */}
      <div 
        className="border rounded-lg -mx-2 sm:mx-0" 
        ref={containerRef}
        role="table"
        aria-label="Tabela de contatos"
        aria-rowcount={paginatedContacts.length + 1}
      >
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Cabeçalho da tabela */}
            <div className="flex items-center border-b bg-muted/50 font-medium text-xs sm:text-sm min-w-[500px] xs:min-w-[600px]" role="row">
              <div className="w-10 sm:w-12 px-1 sm:px-4 py-2 sm:py-3 flex items-center justify-center flex-shrink-0" role="columnheader">
                <Checkbox
                  checked={allPageSelected}
                  indeterminate={somePageSelected && !allPageSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label={`Selecionar todos os ${paginatedContacts.length} contatos da página`}
                />
              </div>
              <div className="min-w-[120px] px-1 sm:px-4 py-2 sm:py-3 flex-shrink-0" role="columnheader">
                <span className="truncate block">Telefone</span>
              </div>
              <div className="flex-[2] px-1 sm:px-4 py-2 sm:py-3 min-w-[120px]" role="columnheader">
                <span className="truncate block">Nome</span>
              </div>
              <div className="flex-1 px-1 sm:px-4 py-2 sm:py-3 min-w-[100px]" role="columnheader">
                <span className="truncate block">Tags</span>
              </div>
              <div className="w-24 sm:w-32 px-1 sm:px-4 py-2 sm:py-3 text-right flex-shrink-0" role="columnheader">Ações</div>
            </div>

            {/* Lista virtualizada */}
            {paginatedContacts.length === 0 ? (
              <div 
                className="text-center text-muted-foreground py-8"
                role="status"
                aria-live="polite"
              >
                Nenhum contato encontrado
              </div>
            ) : (
              <div role="rowgroup">
                <List
                  listRef={listRef}
                  defaultHeight={Math.min(CONTAINER_HEIGHT, paginatedContacts.length * ROW_HEIGHT)}
                  rowCount={paginatedContacts.length}
                  rowHeight={ROW_HEIGHT}
                  rowComponent={RowComponent}
                  rowProps={{}}
                  overscanCount={5}
                  style={{ width: '100%' }}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Paginação */}
      {totalPages > 1 && (
        <nav 
          className="flex flex-col sm:flex-row items-center justify-between gap-4 animate-in"
          role="navigation"
          aria-label="Navegação de páginas de contatos"
        >
          <div 
            className="text-sm text-muted-foreground transition-all duration-300"
            role="status"
            aria-live="polite"
            aria-atomic="true"
          >
            Página {currentPage} de {totalPages}
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="transition-all duration-200 hover:scale-105"
              aria-label="Ir para página anterior"
            >
              <ChevronLeft className="h-4 w-4 sm:mr-1" aria-hidden="true" />
              <span className="hidden sm:inline">Anterior</span>
            </Button>
            
            {/* Números de página */}
            <div className="flex items-center gap-1" role="list" aria-label="Páginas">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => onPageChange(pageNum)}
                    className="w-8 h-8 p-0 transition-all duration-200 hover:scale-110"
                    aria-label={`Ir para página ${pageNum}`}
                    aria-current={currentPage === pageNum ? "page" : undefined}
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="transition-all duration-200 hover:scale-105"
              aria-label="Ir para próxima página"
            >
              <span className="hidden sm:inline">Próxima</span>
              <ChevronRight className="h-4 w-4 sm:ml-1" aria-hidden="true" />
            </Button>
          </div>
        </nav>
      )}
    </div>
  );
}
