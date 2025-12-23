/**
 * DuplicatesPanel Component
 * 
 * Panel for displaying and managing duplicate contacts
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Users, 
  Phone, 
  UserCheck, 
  X, 
  Merge, 
  AlertTriangle,
  Eye,
  EyeOff
} from 'lucide-react';
import { DuplicateSet, Contact } from '@/services/contactsApiService';
import { MergeContactsDialog } from './MergeContactsDialog';

interface DuplicatesPanelProps {
  duplicateSets: DuplicateSet[];
  onMerge: (setId: string, contactIds: string[], mergeData: any) => Promise<void>;
  onDismiss: (setId: string, contactId1: string, contactId2: string) => Promise<void>;
  onBulkMerge: (setIds: string[]) => Promise<void>;
  isLoading?: boolean;
}

export function DuplicatesPanel({
  duplicateSets,
  onMerge,
  onDismiss,
  onBulkMerge,
  isLoading = false
}: DuplicatesPanelProps) {
  const [selectedSets, setSelectedSets] = useState<Set<string>>(new Set());
  const [showMergeDialog, setShowMergeDialog] = useState(false);
  const [currentMergeSet, setCurrentMergeSet] = useState<DuplicateSet | null>(null);
  const [expandedSets, setExpandedSets] = useState<Set<string>>(new Set());

  const handleSelectSet = (setId: string, checked: boolean) => {
    const newSelected = new Set(selectedSets);
    if (checked) {
      newSelected.add(setId);
    } else {
      newSelected.delete(setId);
    }
    setSelectedSets(newSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSets(new Set(duplicateSets.map(set => set.id)));
    } else {
      setSelectedSets(new Set());
    }
  };

  const handleMergeSet = (duplicateSet: DuplicateSet) => {
    setCurrentMergeSet(duplicateSet);
    setShowMergeDialog(true);
  };

  const handleConfirmMerge = async (contactIds: string[], mergeData: any) => {
    if (currentMergeSet) {
      await onMerge(currentMergeSet.id, contactIds, mergeData);
      setShowMergeDialog(false);
      setCurrentMergeSet(null);
    }
  };

  const handleDismissSet = async (duplicateSet: DuplicateSet) => {
    // For simplicity, dismiss the first pair in the set
    if (duplicateSet.contacts.length >= 2) {
      await onDismiss(
        duplicateSet.id,
        duplicateSet.contacts[0].id,
        duplicateSet.contacts[1].id
      );
    }
  };

  const handleBulkMerge = async () => {
    if (selectedSets.size > 0) {
      await onBulkMerge(Array.from(selectedSets));
      setSelectedSets(new Set());
    }
  };

  const toggleExpanded = (setId: string) => {
    const newExpanded = new Set(expandedSets);
    if (newExpanded.has(setId)) {
      newExpanded.delete(setId);
    } else {
      newExpanded.add(setId);
    }
    setExpandedSets(newExpanded);
  };

  const getTypeIcon = (type: DuplicateSet['type']) => {
    switch (type) {
      case 'exact_phone':
        return <Phone className="h-4 w-4" />;
      case 'similar_phone':
        return <Phone className="h-4 w-4" />;
      case 'similar_name':
        return <UserCheck className="h-4 w-4" />;
      default:
        return <Users className="h-4 w-4" />;
    }
  };

  const getTypeLabel = (type: DuplicateSet['type']) => {
    switch (type) {
      case 'exact_phone':
        return 'Telefone Idêntico';
      case 'similar_phone':
        return 'Telefone Similar';
      case 'similar_name':
        return 'Nome Similar';
      default:
        return 'Duplicado';
    }
  };

  const getTypeColor = (type: DuplicateSet['type']) => {
    switch (type) {
      case 'exact_phone':
        return 'bg-red-100 text-red-700';
      case 'similar_phone':
        return 'bg-orange-100 text-orange-700';
      case 'similar_name':
        return 'bg-blue-100 text-blue-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  if (duplicateSets.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-muted-foreground mb-2">
            Nenhum duplicado encontrado
          </h3>
          <p className="text-sm text-muted-foreground text-center">
            Seus contatos estão organizados! Execute uma nova importação para verificar novamente.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with bulk actions */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Duplicados Encontrados
              <Badge variant="secondary">{duplicateSets.length}</Badge>
            </CardTitle>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={selectedSets.size === duplicateSets.length}
                  onCheckedChange={handleSelectAll}
                  disabled={isLoading}
                />
                <span className="text-sm text-muted-foreground">
                  Selecionar todos
                </span>
              </div>
              {selectedSets.size > 0 && (
                <Button
                  onClick={handleBulkMerge}
                  disabled={isLoading}
                  size="sm"
                  className="ml-4"
                >
                  <Merge className="h-4 w-4 mr-2" />
                  Mesclar Selecionados ({selectedSets.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Duplicate sets grouped by type */}
      {['exact_phone', 'similar_phone', 'similar_name'].map(type => {
        const setsOfType = duplicateSets.filter(set => set.type === type);
        if (setsOfType.length === 0) return null;

        return (
          <div key={type} className="space-y-2">
            <h3 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              {getTypeIcon(type as DuplicateSet['type'])}
              {getTypeLabel(type as DuplicateSet['type'])} ({setsOfType.length})
            </h3>
            
            {setsOfType.map((duplicateSet) => {
              const isExpanded = expandedSets.has(duplicateSet.id);
              const isSelected = selectedSets.has(duplicateSet.id);
              
              return (
                <Card key={duplicateSet.id} className={isSelected ? 'ring-2 ring-primary' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleSelectSet(duplicateSet.id, checked as boolean)}
                          disabled={isLoading}
                        />
                        
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge className={getTypeColor(duplicateSet.type)}>
                              {getTypeLabel(duplicateSet.type)}
                            </Badge>
                            {duplicateSet.similarity && (
                              <Badge variant="outline">
                                {Math.round(duplicateSet.similarity * 100)}% similar
                              </Badge>
                            )}
                          </div>
                          
                          {/* Contact preview */}
                          <div className="flex items-center gap-2 mb-3">
                            {duplicateSet.contacts.slice(0, isExpanded ? undefined : 2).map((contact, index) => (
                              <div key={contact.id} className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={contact.avatarUrl || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {contact.name?.charAt(0) || contact.phone.charAt(0)}
                                  </AvatarFallback>
                                </Avatar>
                                <div>
                                  <p className="text-sm font-medium">
                                    {contact.name || 'Sem nome'}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {contact.phone}
                                  </p>
                                </div>
                              </div>
                            ))}
                            
                            {!isExpanded && duplicateSet.contacts.length > 2 && (
                              <div className="text-sm text-muted-foreground">
                                +{duplicateSet.contacts.length - 2} mais
                              </div>
                            )}
                          </div>

                          {/* Expanded view */}
                          {isExpanded && duplicateSet.contacts.length > 2 && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                              {duplicateSet.contacts.slice(2).map((contact) => (
                                <div key={contact.id} className="flex items-center gap-2 bg-muted/30 rounded p-2">
                                  <Avatar className="h-6 w-6">
                                    <AvatarImage src={contact.avatarUrl || undefined} />
                                    <AvatarFallback className="text-xs">
                                      {contact.name?.charAt(0) || contact.phone.charAt(0)}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-sm">{contact.name || 'Sem nome'}</p>
                                    <p className="text-xs text-muted-foreground">{contact.phone}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 ml-4">
                        {duplicateSet.contacts.length > 2 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => toggleExpanded(duplicateSet.id)}
                          >
                            {isExpanded ? (
                              <EyeOff className="h-4 w-4" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                        
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleMergeSet(duplicateSet)}
                          disabled={isLoading}
                        >
                          <Merge className="h-4 w-4 mr-2" />
                          Mesclar
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDismissSet(duplicateSet)}
                          disabled={isLoading}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Dispensar
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        );
      })}

      {/* Merge Dialog */}
      {showMergeDialog && currentMergeSet && (
        <MergeContactsDialog
          contacts={currentMergeSet.contacts}
          onConfirm={handleConfirmMerge}
          onCancel={() => {
            setShowMergeDialog(false);
            setCurrentMergeSet(null);
          }}
        />
      )}
    </div>
  );
}