import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { contactListService, ContactList, Contact } from '@/services/contactListService';
import { contactImportService } from '@/services/contactImportService';
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Upload, Users, Download } from 'lucide-react';
import { backendApi } from '@/services/api-client';
import { contactsService } from '@/services/contactsService';
import { contactsStorageService, ContactGroup, Tag } from '@/services/contactsStorageService';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const ContactListManager = () => {
  const [lists, setLists] = useState<ContactList[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newListName, setNewListName] = useState('');
  const [newListDescription, setNewListDescription] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importedContacts, setImportedContacts] = useState<Contact[]>([]);

  // Novos estados para Grupos e Tags
  const [sourceType, setSourceType] = useState<'csv' | 'group' | 'tag'>('csv');
  const [groups, setGroups] = useState<ContactGroup[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');
  const [selectedTagId, setSelectedTagId] = useState<string>('');

  useEffect(() => {
    loadLists();
  }, []);

  const loadLists = async () => {
    try {
      const data = await contactListService.getAll();
      setLists(data);
    } catch (error) {
      toast.error('Erro ao carregar listas');
    } finally {
      setLoading(false);
    }
  };

  const loadGroupsAndTags = () => {
    const loadedGroups = contactsStorageService.loadGroups();
    const loadedTags = contactsStorageService.loadTags();
    setGroups(loadedGroups);
    setTags(loadedTags);
  };

  useEffect(() => {
    if (isCreateDialogOpen) {
      loadGroupsAndTags();
      setSourceType('csv');
      setSelectedGroupId('');
      setSelectedTagId('');
      setImportedContacts([]);
    }
  }, [isCreateDialogOpen]);

  const handleGroupSelect = (groupId: string) => {
    setSelectedGroupId(groupId);
    const group = groups.find(g => g.id === groupId);
    if (group) {
      const allContacts = contactsStorageService.loadContacts();
      console.log('[ContactListManager] All contacts from storage:', allContacts.length, allContacts.slice(0, 2));
      console.log('[ContactListManager] Group contactIds:', group.contactIds);
      const groupContacts = contactsService.getGroupContacts(allContacts, group);
      console.log('[ContactListManager] Filtered group contacts:', groupContacts.length, groupContacts.slice(0, 2));
      
      // Mapear para o formato esperado pelo backend
      const mappedContacts = groupContacts.map(contact => ({
        phone: contact.phone,
        name: contact.name || '',
        variables: contact.variables || {}
      }));
      console.log('[ContactListManager] Mapped contacts:', mappedContacts.slice(0, 2));
      
      setImportedContacts(mappedContacts);
      toast.success(`${mappedContacts.length} contatos carregados do grupo`);
    }
  };

  const handleTagSelect = (tagId: string) => {
    setSelectedTagId(tagId);
    const allContacts = contactsStorageService.loadContacts();
    console.log('[ContactListManager] All contacts from storage:', allContacts.length);
    console.log('[ContactListManager] Looking for tag:', tagId);
    
    // Filtrar contatos que possuem a tag selecionada
    const tagContacts = allContacts.filter(contact => {
      if (!contact.variables?.tags) return false;
      const contactTags = Array.isArray(contact.variables.tags)
        ? contact.variables.tags
        : [contact.variables.tags];
      return contactTags.includes(tagId);
    });

    console.log('[ContactListManager] Filtered tag contacts:', tagContacts.length, tagContacts.slice(0, 2));
    
    // Mapear para o formato esperado pelo backend
    const mappedContacts = tagContacts.map(contact => ({
      phone: contact.phone,
      name: contact.name || '',
      variables: contact.variables || {}
    }));
    console.log('[ContactListManager] Mapped contacts:', mappedContacts.slice(0, 2));

    setImportedContacts(mappedContacts);
    toast.success(`${mappedContacts.length} contatos carregados da tag`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCsvFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!csvFile) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', csvFile);

    try {
      // Usar a rota existente de validação de CSV
      const response = await backendApi.post<{ success: boolean; contacts: any[] }>('/user/contacts/validate-csv', formData);

      if (response.success && response.data?.contacts) {
        setImportedContacts(response.data.contacts);
        toast.success(`${response.data.contacts.length} contatos importados com sucesso!`);
      }
    } catch (error) {
      toast.error('Erro ao processar CSV');
    } finally {
      setIsUploading(false);
    }
  };

  const handleCreateList = async () => {
    if (!newListName) {
      toast.error('Nome da lista é obrigatório');
      return;
    }

    try {
      await contactListService.create({
        name: newListName,
        description: newListDescription,
        contacts: importedContacts
      });

      toast.success('Lista criada com sucesso');
      setIsCreateDialogOpen(false);
      setNewListName('');
      setNewListDescription('');
      setCsvFile(null);
      setImportedContacts([]);
      loadLists();
    } catch (error) {
      toast.error('Erro ao criar lista');
    }
  };

  const handleDeleteList = async (id: number) => {
    if (!confirm('Tem certeza que deseja excluir esta lista?')) return;

    try {
      await contactListService.delete(id);
      toast.success('Lista excluída');
      loadLists();
    } catch (error) {
      toast.error('Erro ao excluir lista');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold tracking-tight">Listas de Contatos</h2>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nova Lista
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Criar Nova Lista</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome da Lista</Label>
                <Input
                  id="name"
                  value={newListName}
                  onChange={(e) => setNewListName(e.target.value)}
                  placeholder="Ex: Clientes VIP"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Descrição (Opcional)</Label>
                <Input
                  id="description"
                  value={newListDescription}
                  onChange={(e) => setNewListDescription(e.target.value)}
                  placeholder="Lista de clientes para promoções"
                />
              </div>

              <div className="space-y-2 border p-4 rounded-md bg-muted/50">
                <Label className="mb-2 block">Fonte dos Contatos</Label>
                <Tabs defaultValue="csv" value={sourceType} onValueChange={(v) => setSourceType(v as any)} className="w-full">
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="csv">Arquivo CSV</TabsTrigger>
                    <TabsTrigger value="group">Grupo</TabsTrigger>
                    <TabsTrigger value="tag">Tag</TabsTrigger>
                  </TabsList>

                  <TabsContent value="csv" className="space-y-4">
                    <div className="flex justify-between items-center mb-2">
                      <Label>Importar Contatos (CSV)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs gap-1 text-muted-foreground hover:text-primary"
                        onClick={() => contactImportService.downloadCSVTemplate()}
                      >
                        <Download className="h-3 w-3" />
                        Baixar Template
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Input
                        type="file"
                        accept=".csv"
                        onChange={handleFileChange}
                        className="cursor-pointer"
                      />
                      <Button
                        variant="outline"
                        onClick={handleUpload}
                        disabled={!csvFile || isUploading}
                      >
                        {isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      O arquivo CSV deve conter as colunas: phone (ou telefone) e opcionalmente name (ou nome).
                    </p>
                  </TabsContent>

                  <TabsContent value="group" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecione o Grupo</Label>
                      <Select value={selectedGroupId} onValueChange={handleGroupSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um grupo..." />
                        </SelectTrigger>
                        <SelectContent>
                          {groups.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">Nenhum grupo encontrado</div>
                          ) : (
                            groups.map(group => (
                              <SelectItem key={group.id} value={group.id}>
                                {group.name} ({group.contactIds.length} contatos)
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>

                  <TabsContent value="tag" className="space-y-4">
                    <div className="space-y-2">
                      <Label>Selecione a Tag</Label>
                      <Select value={selectedTagId} onValueChange={handleTagSelect}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione uma tag..." />
                        </SelectTrigger>
                        <SelectContent>
                          {tags.length === 0 ? (
                            <div className="p-2 text-sm text-muted-foreground text-center">Nenhuma tag encontrada</div>
                          ) : (
                            tags.map(tag => (
                              <SelectItem key={tag.id} value={tag.id}>
                                {tag.name}
                              </SelectItem>
                            ))
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </TabsContent>
                </Tabs>

                {importedContacts.length > 0 && (
                  <p className="text-sm text-green-600 font-medium flex items-center gap-1 mt-4 pt-4 border-t">
                    <Users className="h-3 w-3" />
                    {importedContacts.length} contatos selecionados
                  </p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleCreateList} disabled={!newListName}>Criar Lista</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {lists.map((list) => (
          <Card key={list.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
              <CardTitle className="text-lg font-medium truncate pr-4" title={list.name}>
                {list.name}
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:text-destructive"
                onClick={() => handleDeleteList(list.id)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-muted-foreground mb-2">
                <Users className="h-4 w-4" />
                <span className="text-2xl font-bold text-foreground">{list.total_contacts}</span>
                <span className="text-sm">contatos</span>
              </div>
              {list.description && (
                <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                  {list.description}
                </p>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Criada em {new Date(list.created_at).toLocaleDateString()}
              </p>
            </CardContent>
          </Card>
        ))}

        {lists.length === 0 && (
          <div className="col-span-full text-center py-12 bg-muted/30 rounded-lg border border-dashed">
            <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">Nenhuma lista encontrada</h3>
            <p className="text-muted-foreground mb-4">Crie sua primeira lista de contatos para começar.</p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar Lista
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactListManager;
