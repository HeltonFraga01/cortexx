/**
 * ContactImporter Component
 * 
 * Componente para importar contatos de múltiplas fontes:
 * - Agenda do sistema
 * - Upload CSV
 * - Entrada manual
 */

import { useState, useEffect } from 'react';
import { useBrandingConfig } from '@/hooks/useBranding';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Upload,
  Users,
  FileText,
  Download,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { toast } from 'sonner';
import { contactImportService } from '@/services/contactImportService';
import { Contact } from '@/services/bulkCampaignService';
import { DatabaseContactSelector } from './DatabaseContactSelector';
import { Database } from 'lucide-react';

interface ContactImporterProps {
  instance: string;
  userToken: string;
  onContactsImported: (contacts: Contact[]) => void;
}

export function ContactImporter({ instance, userToken, onContactsImported }: ContactImporterProps) {
  const brandingConfig = useBrandingConfig();
  const [activeTab, setActiveTab] = useState('wuzapi');
  const [loading, setLoading] = useState(false);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<any[]>([]);
  const [customVariables, setCustomVariables] = useState<string[]>([]);

  // Filtros
  const [searchFilter, setSearchFilter] = useState('');
  const [hasNameFilter, setHasNameFilter] = useState<boolean | null>(null);

  // Paginação
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Carregar contatos pré-selecionados do sessionStorage
  useEffect(() => {
    try {
      const preSelected = sessionStorage.getItem('preSelectedContacts');
      if (preSelected) {
        const parsedContacts = JSON.parse(preSelected);
        if (Array.isArray(parsedContacts) && parsedContacts.length > 0) {
          setContacts(parsedContacts);
          setSelectedContacts(new Set(parsedContacts.map((c: Contact) => c.phone)));
          setActiveTab('wuzapi'); // Mostrar na aba WUZAPI
          toast.success(`${parsedContacts.length} contatos carregados da página de contatos`);

          // Limpar sessionStorage após carregar
          sessionStorage.removeItem('preSelectedContacts');
        }
      }
    } catch (error) {
      console.error('Erro ao carregar contatos pré-selecionados:', error);
    }
  }, [onContactsImported]);

  // WUZAPI Import
  const handleWuzapiImport = async () => {
    try {
      setLoading(true);
      setErrors([]);

      // Validar token antes de fazer a requisição
      if (!userToken || userToken.trim() === '') {
        throw new Error('Token de autenticação não fornecido. Faça login novamente.');
      }

      const result = await contactImportService.importFromWuzapi(instance, userToken);

      setContacts(result.contacts);
      // Não selecionar automaticamente - deixar usuário escolher
      // setSelectedContacts(new Set(result.contacts.map(c => c.phone)));

      // Mostrar mensagem de sucesso com aviso se houver contatos com @lid
      if (result.lidCount && result.lidCount > 0) {
        toast.success(`${result.contacts.length} contatos importados (${result.lidCount} usando ID interno do WhatsApp)`, {
          duration: 5000
        });
      } else {
        toast.success(`${result.contacts.length} contatos importados da agenda ${brandingConfig.appName}`);
      }
    } catch (error: any) {
      toast.error('Erro ao importar contatos: ' + error.message);
      setErrors([{ reason: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  // CSV Import
  const [csvFile, setCsvFile] = useState<File | null>(null);

  const handleCSVUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar arquivo
    const sizeValidation = contactImportService.validateFileSize(file);
    if (!sizeValidation.valid) {
      toast.error(sizeValidation.reason);
      return;
    }

    const typeValidation = contactImportService.validateFileType(file);
    if (!typeValidation.valid) {
      toast.error(typeValidation.reason);
      return;
    }

    setCsvFile(file);

    try {
      setLoading(true);
      setErrors([]);

      const result = await contactImportService.validateCSV(file, userToken);

      setContacts(result.contacts);
      // Não selecionar automaticamente - deixar usuário escolher
      // setSelectedContacts(new Set(result.contacts.map(c => c.phone)));
      setErrors(result.errors);
      setCustomVariables(result.customVariables);

      if (result.errors.length > 0) {
        toast.warning(`${result.contacts.length} contatos válidos, ${result.errors.length} erros encontrados`);
      } else {
        toast.success(`${result.contacts.length} contatos importados do CSV`);
      }
    } catch (error: any) {
      toast.error('Erro ao processar CSV: ' + error.message);
      setErrors([{ reason: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  // Manual Import
  const [manualText, setManualText] = useState('');

  const handleManualImport = async () => {
    if (!manualText.trim()) {
      toast.error('Digite os números de telefone');
      return;
    }

    try {
      setLoading(true);
      setErrors([]);

      const numbers = contactImportService.parseManualNumbers(manualText);
      const result = await contactImportService.validateManualNumbers(numbers, userToken);

      setContacts(result.valid);
      // Não selecionar automaticamente - deixar usuário escolher
      // setSelectedContacts(new Set(result.valid.map(c => c.phone)));
      setErrors(result.invalid);

      if (result.invalid.length > 0) {
        toast.warning(`${result.valid.length} números válidos, ${result.invalid.length} inválidos`);
      } else {
        toast.success(`${result.valid.length} números validados`);
      }
    } catch (error: any) {
      toast.error('Erro ao validar números: ' + error.message);
      setErrors([{ reason: error.message }]);
    } finally {
      setLoading(false);
    }
  };

  // Reset página quando filtros mudarem
  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, hasNameFilter]);

  // Filtrar contatos
  const filteredContacts = contacts.filter(contact => {
    // Filtro de busca
    if (searchFilter && searchFilter.trim()) {
      const searchTrimmed = searchFilter.trim();
      const searchLower = searchTrimmed.toLowerCase();
      const searchClean = searchTrimmed.replace(/\D/g, ''); // Remove caracteres especiais da busca (APÓS trim)

      // Função para normalizar texto (remove acentos)
      const normalize = (text: string) => {
        return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
      };

      // Busca no nome (com e sem acentos)
      const nameNormalized = contact.name ? normalize(contact.name) : '';
      const searchNormalized = normalize(searchLower);
      const nameMatch = nameNormalized.includes(searchNormalized);

      // Busca no número (várias formas)
      const phoneClean = contact.phone.replace(/\D/g, ''); // Número sem formatação
      const phoneMatch = searchClean.length > 0 && phoneClean.includes(searchClean); // Busca no número limpo

      // Busca no número formatado
      const phoneFormatted = contactImportService.formatPhoneDisplay(contact.phone).toLowerCase();
      const phoneFormattedMatch = phoneFormatted.includes(searchLower);

      // Busca parcial no número (últimos dígitos) - mínimo 4 dígitos
      const lastDigitsMatch = searchClean.length >= 4 && phoneClean.endsWith(searchClean);

      // Busca por DDD (primeiros 2 dígitos após código do país)
      const dddMatch = searchClean.length === 2 && phoneClean.length >= 12 && phoneClean.substring(2, 4) === searchClean;

      // Aceita se qualquer uma das buscas encontrar resultado
      if (!nameMatch && !phoneMatch && !phoneFormattedMatch && !lastDigitsMatch && !dddMatch) return false;
    }

    // Filtro de nome
    if (hasNameFilter !== null) {
      const hasName = Boolean(contact.name?.trim());
      if (hasNameFilter && !hasName) return false;
      if (!hasNameFilter && hasName) return false;
    }

    return true;
  });

  // Selection handlers
  const toggleContact = (phone: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(phone)) {
      newSelected.delete(phone);
    } else {
      newSelected.add(phone);
    }
    setSelectedContacts(newSelected);
  };

  const toggleAll = () => {
    // Usar paginatedContacts para selecionar apenas os da página atual
    const pagePhones = paginatedContacts.map(c => c.phone);
    const allPageSelected = pagePhones.every(phone => selectedContacts.has(phone));

    const newSelected = new Set(selectedContacts);

    if (allPageSelected) {
      // Desmarcar todos da página atual
      pagePhones.forEach(phone => newSelected.delete(phone));
    } else {
      // Marcar todos da página atual
      pagePhones.forEach(phone => newSelected.add(phone));
    }

    setSelectedContacts(newSelected);
  };

  // Confirm import
  const handleConfirmImport = () => {
    // Adicionar apenas os contatos que estão visíveis (filtrados) E selecionados
    const selected = filteredContacts.filter(c => selectedContacts.has(c.phone));

    if (selected.length === 0) {
      toast.error('Selecione pelo menos um contato');
      return;
    }

    // Remove duplicados
    const { unique, duplicates } = contactImportService.removeDuplicates(selected);

    if (duplicates > 0) {
      toast.info(`${duplicates} contatos duplicados removidos`);
    }

    onContactsImported(unique);
    toast.success(`${unique.length} contatos adicionados à campanha`);

    // Reset
    setContacts([]);
    setSelectedContacts(new Set());
    setErrors([]);
    setCsvFile(null);
    setManualText('');
  };

  const handleClear = () => {
    setContacts([]);
    setSelectedContacts(new Set());
    setErrors([]);
    setCsvFile(null);
    setManualText('');
    setCustomVariables([]);
  };

  const stats = contactImportService.getContactStats(contacts);

  // Calcular paginação
  const totalPages = Math.ceil(filteredContacts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedContacts = filteredContacts.slice(startIndex, endIndex);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Importar Contatos</CardTitle>
        <CardDescription>
          Importe contatos da agenda {brandingConfig.appName}, arquivo CSV ou digite manualmente
        </CardDescription>
        {!userToken && (
          <Alert variant="destructive" className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Token de autenticação não encontrado. Faça login para importar contatos.
            </AlertDescription>
          </Alert>
        )}
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-2 p-1.5">
            <TabsTrigger value="wuzapi" className="gap-2">
              <Users className="h-4 w-4" />
              <span className="hidden sm:inline">Agenda {brandingConfig.appName}</span>
              <span className="sm:hidden">Agenda</span>
            </TabsTrigger>
            <TabsTrigger value="csv" className="gap-2">
              <Upload className="h-4 w-4" />
              <span className="hidden sm:inline">Upload CSV</span>
              <span className="sm:hidden">CSV</span>
            </TabsTrigger>
            <TabsTrigger value="manual" className="gap-2">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Manual</span>
              <span className="sm:hidden">Manual</span>
            </TabsTrigger>
            <TabsTrigger value="database" className="gap-2">
              <Database className="h-4 w-4" />
              <span className="hidden sm:inline">Banco de Dados</span>
              <span className="sm:hidden">Banco</span>
            </TabsTrigger>
          </TabsList>

          {/* WUZAPI Tab */}
          <TabsContent value="wuzapi" className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Importe contatos salvos na agenda da instância <strong>{instance}</strong>
              </p>
              <Button
                onClick={handleWuzapiImport}
                disabled={loading}
                className="w-full gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Importando...</span>
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4" />
                    <span>Importar da Agenda</span>
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* CSV Tab */}
          <TabsContent value="csv" className="space-y-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="csv-file">Arquivo CSV</Label>
                <Input
                  id="csv-file"
                  type="file"
                  accept=".csv"
                  onChange={handleCSVUpload}
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  O CSV deve conter as colunas: phone (obrigatório), name (opcional) e variáveis customizadas
                </p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={() => contactImportService.downloadCSVTemplate(customVariables)}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                <span>Baixar Template CSV</span>
              </Button>

              {csvFile && (
                <Alert>
                  <CheckCircle2 className="h-4 w-4" />
                  <AlertDescription>
                    Arquivo selecionado: <strong>{csvFile.name}</strong>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </TabsContent>

          {/* Manual Tab */}
          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="manual-numbers">Números de Telefone</Label>
              <Textarea
                id="manual-numbers"
                placeholder="Digite os números separados por vírgula, ponto-e-vírgula ou quebra de linha&#10;Exemplo:&#10;5511999999999&#10;5511888888888&#10;5511777777777"
                value={manualText}
                onChange={(e) => setManualText(e.target.value)}
                rows={8}
                disabled={loading}
              />
              <p className="text-xs text-muted-foreground">
                Separe os números por vírgula, ponto-e-vírgula ou quebra de linha
              </p>
            </div>

            <Button
              onClick={handleManualImport}
              disabled={loading || !manualText.trim()}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Validando...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Validar Números</span>
                </>
              )}
            </Button>
          </TabsContent>

          {/* Database Tab */}
          <TabsContent value="database" className="space-y-4">
            <DatabaseContactSelector
              userToken={userToken}
              onContactsImported={(importedContacts) => {
                setContacts(importedContacts);
                // Optional: auto-select or show success
                toast.success(`${importedContacts.length} contatos importados do banco de dados`);
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Errors */}
        {errors.length > 0 && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{errors.length} erro(s) encontrado(s)</strong>
              <ul className="mt-2 list-disc list-inside text-sm">
                {errors.slice(0, 5).map((error, index) => (
                  <li key={index}>
                    {error.phone || error.number}: {error.reason}
                  </li>
                ))}
                {errors.length > 5 && (
                  <li className="text-muted-foreground">
                    ... e mais {errors.length - 5} erros
                  </li>
                )}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Custom Variables Info */}
        {customVariables.length > 0 && (
          <Alert className="mt-4">
            <AlertDescription>
              <strong>Variáveis customizadas detectadas:</strong>
              <div className="flex flex-wrap gap-2 mt-2">
                {customVariables.map(varName => (
                  <Badge key={varName} variant="secondary">
                    {`{{${varName}}}`}
                  </Badge>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Contacts Preview */}
        {contacts.length > 0 && (
          <div className="mt-6 space-y-4">
            {/* Header com título e botão limpar */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex-1">
                <h3 className="text-lg font-semibold">
                  Contatos Importados ({selectedContacts.size}/{contacts.length})
                </h3>
                <p className="text-sm text-muted-foreground">
                  {stats.withName} com nome • {stats.withVariables} com variáveis
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClear}
                className="gap-2 w-full sm:w-auto"
              >
                <X className="h-4 w-4" />
                <span>Limpar</span>
              </Button>
            </div>

            {/* Botão Adicionar (full width no mobile) */}
            <Button
              onClick={handleConfirmImport}
              disabled={selectedContacts.size === 0}
              className="gap-2 w-full"
              size="lg"
            >
              <CheckCircle2 className="h-4 w-4" />
              <span>Adicionar {filteredContacts.filter(c => selectedContacts.has(c.phone)).length} Contato(s)</span>
            </Button>

            {/* Filtros inline */}
            {contacts.length > 0 && (
              <div className="space-y-3 p-4 border rounded-lg bg-muted/50">
                {/* Linha 1: Campo de busca */}
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Buscar por nome ou telefone..."
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    className="flex-1"
                  />
                  {(searchFilter || hasNameFilter !== null) && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setSearchFilter('');
                        setHasNameFilter(null);
                      }}
                      className="gap-2 flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                      <span className="hidden sm:inline">Limpar</span>
                    </Button>
                  )}
                </div>

                {/* Linha 2: Checkboxes e contador */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex flex-col xs:flex-row items-start xs:items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="has-name-filter"
                        checked={hasNameFilter === true}
                        onCheckedChange={(checked) =>
                          setHasNameFilter(checked ? true : null)
                        }
                      />
                      <label htmlFor="has-name-filter" className="text-sm cursor-pointer whitespace-nowrap">
                        Apenas com nome
                      </label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="no-name-filter"
                        checked={hasNameFilter === false}
                        onCheckedChange={(checked) =>
                          setHasNameFilter(checked ? false : null)
                        }
                      />
                      <label htmlFor="no-name-filter" className="text-sm cursor-pointer whitespace-nowrap">
                        Apenas sem nome
                      </label>
                    </div>
                  </div>
                  <div className="text-sm text-muted-foreground whitespace-nowrap">
                    {filteredContacts.length} de {contacts.length} contatos
                  </div>
                </div>
              </div>
            )}

            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedContacts.has(c.phone))}
                        // indeterminate prop is not supported by this Checkbox component directly, 
                        // but we can use the data-state attribute or a custom implementation if needed.
                        // For now, we'll just rely on checked state.
                        onCheckedChange={toggleAll}
                        aria-label={`Selecionar todos os ${paginatedContacts.length} contatos da página`}
                      />
                    </TableHead>
                    <TableHead className="min-w-[180px]">Telefone</TableHead>
                    <TableHead className="min-w-[150px]">Nome</TableHead>
                    {stats.uniqueVariables.length > 0 && (
                      <TableHead className="min-w-[200px]">Variáveis</TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedContacts.map((contact) => (
                    <TableRow key={contact.phone}>
                      <TableCell className="align-top">
                        <Checkbox
                          checked={selectedContacts.has(contact.phone)}
                          onCheckedChange={() => toggleContact(contact.phone)}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm whitespace-nowrap align-top">
                        {contactImportService.formatPhoneDisplay(contact.phone)}
                      </TableCell>
                      <TableCell className="align-top">{contact.name || '-'}</TableCell>
                      {stats.uniqueVariables.length > 0 && (
                        <TableCell className="align-top">
                          {contact.variables && Object.keys(contact.variables).length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {Object.entries(contact.variables).slice(0, 3).map(([key, value]) => (
                                <Badge key={key} variant="outline" className="text-xs">
                                  {key}: {String(value)}
                                </Badge>
                              ))}
                              {Object.keys(contact.variables).length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{Object.keys(contact.variables).length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            '-'
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                  {filteredContacts.length === 0 && contacts.length > 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum contato encontrado com os filtros aplicados
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>

            {/* Paginação */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4">
                {/* Seletor de itens por página */}
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">Itens por página:</span>
                  <Select
                    value={itemsPerPage.toString()}
                    onValueChange={(value) => {
                      setItemsPerPage(Number(value));
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">10</SelectItem>
                      <SelectItem value="20">20</SelectItem>
                      <SelectItem value="50">50</SelectItem>
                      <SelectItem value="100">100</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Info e navegação */}
                <div className="flex items-center gap-4">
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {startIndex + 1}-{Math.min(endIndex, filteredContacts.length)} de {filteredContacts.length}
                  </span>

                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>

                    <span className="text-sm px-2">
                      Página {currentPage} de {totalPages}
                    </span>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="h-8 w-8 p-0"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
