import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import {
    Upload,
    List,
    FolderOpen,
    Tag
} from 'lucide-react';

import { contactsStorageService, ContactGroup, Tag as ContactTag } from '@/services/contactsStorageService';
import { ContactImporter } from './ContactImporter';
import { Contact } from '@/services/bulkCampaignService';
import { toast } from 'sonner';

interface RecipientSelectorProps {
    instance: string;
    userToken: string;
    onContactsSelected: (contacts: Contact[]) => void;
    selectedContactsCount: number;
}

export function RecipientSelector({
    instance,
    userToken,
    onContactsSelected,
    selectedContactsCount
}: RecipientSelectorProps) {
    const [activeMethod, setActiveMethod] = useState<'lists' | 'import'>('lists');
    
    // Grupos e tags do localStorage (página de contatos)
    const [groups, setGroups] = useState<ContactGroup[]>([]);
    const [tags, setTags] = useState<ContactTag[]>([]);
    const [storedContacts, setStoredContacts] = useState<Contact[]>([]);

    // Load local data on mount
    useEffect(() => {
        loadLocalData();
    }, []);

    // Carregar grupos, tags e contatos do localStorage
    const loadLocalData = () => {
        try {
            const loadedGroups = contactsStorageService.loadGroups();
            const loadedTags = contactsStorageService.loadTags();
            const loadedContacts = contactsStorageService.loadContacts();
            
            setGroups(loadedGroups);
            setTags(loadedTags);
            setStoredContacts(loadedContacts);
        } catch (error) {
            console.error('Erro ao carregar dados locais:', error);
        }
    };

    // Handler para selecionar grupo do localStorage
    const handleGroupSelect = (groupId: string) => {
        if (!groupId) return;

        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        // Filtrar contatos que pertencem ao grupo
        const groupContacts = storedContacts.filter(c => 
            group.contactIds.includes(c.phone)
        );

        if (groupContacts.length > 0) {
            onContactsSelected(groupContacts);
            toast.success(`${groupContacts.length} contatos carregados do grupo "${group.name}"`);
        } else {
            toast.warning(`O grupo "${group.name}" está vazio`);
        }
    };

    // Handler para selecionar tag do localStorage
    const handleTagSelect = (tagId: string) => {
        if (!tagId) return;

        const tag = tags.find(t => t.id === tagId);
        if (!tag) return;

        // Filtrar contatos que possuem a tag (tags são armazenadas em variables.tags)
        const taggedContacts = storedContacts.filter(c => {
            const contactTags = c.variables?.tags;
            if (!contactTags) return false;
            const tagsArray = Array.isArray(contactTags) ? contactTags : [contactTags];
            return tagsArray.includes(tagId);
        });

        if (taggedContacts.length > 0) {
            onContactsSelected(taggedContacts);
            toast.success(`${taggedContacts.length} contatos carregados com a tag "${tag.name}"`);
        } else {
            toast.warning(`Nenhum contato encontrado com a tag "${tag.name}"`);
        }
    };

    const handleImportedContacts = (contacts: Contact[]) => {
        onContactsSelected(contacts);
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4">
                {/* Method Selection Cards */}
                <div
                    className={`flex-1 cursor-pointer border rounded-lg p-4 transition-all hover:border-primary ${activeMethod === 'lists' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}`}
                    onClick={() => setActiveMethod('lists')}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${activeMethod === 'lists' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <List className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-medium">Minhas Listas</h3>
                            <p className="text-sm text-muted-foreground">Usar listas salvas</p>
                        </div>
                    </div>
                </div>

                <div
                    className={`flex-1 cursor-pointer border rounded-lg p-4 transition-all hover:border-primary ${activeMethod === 'import' ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'bg-card'}`}
                    onClick={() => setActiveMethod('import')}
                >
                    <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full ${activeMethod === 'import' ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                            <Upload className="h-5 w-5" />
                        </div>
                        <div>
                            <h3 className="font-medium">Importar / Manual</h3>
                            <p className="text-sm text-muted-foreground">CSV, Excel ou Digitar</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Area */}
            <div className="mt-4">
                {activeMethod === 'lists' && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="space-y-6">
                                {/* Grupos da página de Contatos */}
                                {groups.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <FolderOpen className="h-4 w-4 text-primary" />
                                            Grupos Salvos
                                        </Label>
                                        <Select onValueChange={handleGroupSelect}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Escolha um grupo..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {groups.map((group) => (
                                                    <SelectItem key={group.id} value={group.id}>
                                                        <div className="flex items-center justify-between w-full gap-2">
                                                            <span>{group.name}</span>
                                                            <Badge variant="secondary" className="ml-2 text-xs">
                                                                {group.contactIds.length} contatos
                                                            </Badge>
                                                        </div>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {/* Tags da página de Contatos */}
                                {tags.length > 0 && (
                                    <div className="space-y-2">
                                        <Label className="flex items-center gap-2">
                                            <Tag className="h-4 w-4 text-primary" />
                                            Tags
                                        </Label>
                                        <Select onValueChange={handleTagSelect}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Escolha uma tag..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {tags.map((tag) => {
                                                    const count = storedContacts.filter(c => {
                                                        const contactTags = c.variables?.tags;
                                                        if (!contactTags) return false;
                                                        const tagsArray = Array.isArray(contactTags) ? contactTags : [contactTags];
                                                        return tagsArray.includes(tag.id);
                                                    }).length;
                                                    return (
                                                        <SelectItem key={tag.id} value={tag.id}>
                                                            <div className="flex items-center justify-between w-full gap-2">
                                                                <div className="flex items-center gap-2">
                                                                    <div 
                                                                        className="w-3 h-3 rounded-full" 
                                                                        style={{ backgroundColor: tag.color }}
                                                                    />
                                                                    <span>{tag.name}</span>
                                                                </div>
                                                                <Badge variant="secondary" className="ml-2 text-xs">
                                                                    {count} contatos
                                                                </Badge>
                                                            </div>
                                                        </SelectItem>
                                                    );
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                )}

                                {groups.length === 0 && tags.length === 0 && (
                                    <Alert>
                                        <AlertDescription>
                                            Você ainda não tem listas, grupos ou tags. Vá para a página de Contatos para criar grupos e tags, ou use a opção "Importar".
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}

                {activeMethod === 'import' && (
                    <ContactImporter
                        instance={instance}
                        userToken={userToken}
                        onContactsImported={handleImportedContacts}
                    />
                )}
            </div>
        </div>
    );
}
