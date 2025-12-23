/**
 * MergeContactsDialog Component
 * 
 * Dialog for merging duplicate contacts with field selection
 * Requirements: 4.1, 4.2, 4.3, 4.4
 */

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  Merge, 
  User, 
  Phone, 
  Image, 
  Tags, 
  Users,
  Check,
  X
} from 'lucide-react';
import { Contact } from '@/services/contactsApiService';

interface MergeContactsDialogProps {
  contacts: Contact[];
  onConfirm: (contactIds: string[], mergeData: MergeData) => Promise<void>;
  onCancel: () => void;
}

interface MergeData {
  primaryContactId: string;
  name: string;
  phone: string;
  avatarUrl: string | null;
  metadata: Record<string, unknown>;
  preserveTags: boolean;
  preserveGroups: boolean;
}

export function MergeContactsDialog({
  contacts,
  onConfirm,
  onCancel
}: MergeContactsDialogProps) {
  const [primaryContactId, setPrimaryContactId] = useState(contacts[0]?.id || '');
  const [selectedName, setSelectedName] = useState(contacts[0]?.name || '');
  const [selectedPhone, setSelectedPhone] = useState(contacts[0]?.phone || '');
  const [selectedAvatarUrl, setSelectedAvatarUrl] = useState(contacts[0]?.avatarUrl || null);
  const [preserveTags, setPreserveTags] = useState(true);
  const [preserveGroups, setPreserveGroups] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      
      const mergeData: MergeData = {
        primaryContactId,
        name: selectedName,
        phone: selectedPhone,
        avatarUrl: selectedAvatarUrl,
        metadata: {},
        preserveTags,
        preserveGroups
      };

      const contactIds = contacts.map(c => c.id);
      await onConfirm(contactIds, mergeData);
    } catch (error) {
      console.error('Merge failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Get unique values for each field
  const uniqueNames = [...new Set(contacts.map(c => c.name).filter(Boolean))];
  const uniquePhones = [...new Set(contacts.map(c => c.phone))];
  const uniqueAvatars = [...new Set(contacts.map(c => c.avatarUrl).filter(Boolean))];

  // Get all tags and groups
  const allTags = contacts.flatMap(c => c.tags || []);
  const allGroups = contacts.flatMap(c => c.groups || []);
  const uniqueTags = allTags.filter((tag, index, self) => 
    self.findIndex(t => t.id === tag.id) === index
  );
  const uniqueGroups = allGroups.filter((group, index, self) => 
    self.findIndex(g => g.id === group.id) === index
  );

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            Mesclar Contatos ({contacts.length})
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Contact Preview */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {contacts.map((contact) => (
              <Card key={contact.id} className={contact.id === primaryContactId ? 'ring-2 ring-primary' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={contact.avatarUrl || undefined} />
                      <AvatarFallback>
                        {contact.name?.charAt(0) || contact.phone.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <p className="font-medium">{contact.name || 'Sem nome'}</p>
                      <p className="text-sm text-muted-foreground">{contact.phone}</p>
                    </div>
                    {contact.id === primaryContactId && (
                      <Badge variant="default">Principal</Badge>
                    )}
                  </div>
                  
                  {/* Tags */}
                  {contact.tags && contact.tags.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-1 mb-1">
                        <Tags className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Tags:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {contact.tags.map((tag) => (
                          <Badge key={tag.id} variant="outline" className="text-xs">
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Groups */}
                  {contact.groups && contact.groups.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1 mb-1">
                        <Users className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Grupos:</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {contact.groups.map((group) => (
                          <Badge key={group.id} variant="outline" className="text-xs">
                            {group.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Primary Contact Selection */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <User className="h-4 w-4" />
              Contato Principal
            </h3>
            <RadioGroup value={primaryContactId} onValueChange={setPrimaryContactId}>
              {contacts.map((contact) => (
                <div key={contact.id} className="flex items-center space-x-2">
                  <RadioGroupItem value={contact.id} id={`primary-${contact.id}`} />
                  <Label htmlFor={`primary-${contact.id}`} className="flex items-center gap-2 cursor-pointer">
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={contact.avatarUrl || undefined} />
                      <AvatarFallback className="text-xs">
                        {contact.name?.charAt(0) || contact.phone.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span>{contact.name || 'Sem nome'} - {contact.phone}</span>
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Name Selection */}
            {uniqueNames.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Nome
                </h3>
                <RadioGroup value={selectedName} onValueChange={setSelectedName}>
                  {uniqueNames.map((name) => (
                    <div key={name} className="flex items-center space-x-2">
                      <RadioGroupItem value={name} id={`name-${name}`} />
                      <Label htmlFor={`name-${name}`} className="cursor-pointer">
                        {name}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Phone Selection */}
            {uniquePhones.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Telefone
                </h3>
                <RadioGroup value={selectedPhone} onValueChange={setSelectedPhone}>
                  {uniquePhones.map((phone) => (
                    <div key={phone} className="flex items-center space-x-2">
                      <RadioGroupItem value={phone} id={`phone-${phone}`} />
                      <Label htmlFor={`phone-${phone}`} className="cursor-pointer">
                        {phone}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Avatar Selection */}
            {uniqueAvatars.length > 1 && (
              <div className="space-y-3">
                <h3 className="text-sm font-medium flex items-center gap-2">
                  <Image className="h-4 w-4" />
                  Foto
                </h3>
                <RadioGroup 
                  value={selectedAvatarUrl || 'none'} 
                  onValueChange={(value) => setSelectedAvatarUrl(value === 'none' ? null : value)}
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="none" id="avatar-none" />
                    <Label htmlFor="avatar-none" className="cursor-pointer">
                      Sem foto
                    </Label>
                  </div>
                  {uniqueAvatars.map((avatarUrl) => (
                    <div key={avatarUrl} className="flex items-center space-x-2">
                      <RadioGroupItem value={avatarUrl} id={`avatar-${avatarUrl}`} />
                      <Label htmlFor={`avatar-${avatarUrl}`} className="flex items-center gap-2 cursor-pointer">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={avatarUrl} />
                          <AvatarFallback>?</AvatarFallback>
                        </Avatar>
                        <span className="text-sm">Foto do contato</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}
          </div>

          {/* Preserve Options */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium">Opções de Preservação</h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserve-tags"
                  checked={preserveTags}
                  onCheckedChange={setPreserveTags}
                />
                <Label htmlFor="preserve-tags" className="flex items-center gap-2 cursor-pointer">
                  <Tags className="h-4 w-4" />
                  Preservar todas as tags ({uniqueTags.length})
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="preserve-groups"
                  checked={preserveGroups}
                  onCheckedChange={setPreserveGroups}
                />
                <Label htmlFor="preserve-groups" className="flex items-center gap-2 cursor-pointer">
                  <Users className="h-4 w-4" />
                  Preservar todos os grupos ({uniqueGroups.length})
                </Label>
              </div>
            </div>

            {/* Preview of preserved items */}
            {(preserveTags && uniqueTags.length > 0) && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Tags que serão preservadas:</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueTags.map((tag) => (
                    <Badge key={tag.id} variant="outline" className="text-xs">
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {(preserveGroups && uniqueGroups.length > 0) && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm font-medium mb-2">Grupos que serão preservados:</p>
                <div className="flex flex-wrap gap-1">
                  {uniqueGroups.map((group) => (
                    <Badge key={group.id} variant="outline" className="text-xs">
                      {group.name}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={isLoading} className="min-w-[120px]">
              {isLoading ? (
                'Mesclando...'
              ) : (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  Mesclar Contatos
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}