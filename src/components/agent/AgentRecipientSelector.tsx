/**
 * AgentRecipientSelector Component
 * Allows agents to select recipients for campaigns
 * Uses the same import functionality as the contacts page
 */

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Upload,
  UserPlus,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Users,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Download,
  Database,
} from 'lucide-react'
import { toast } from 'sonner'
import { useAgentContacts } from '@/hooks/useAgentContacts'
import { contactImportService } from '@/services/contactImportService'
import { AgentDatabaseContactSelector } from './AgentDatabaseContactSelector'

interface Contact {
  id: string
  phone: string
  name?: string
  variables?: Record<string, string>
}

interface AgentRecipientSelectorProps {
  onContactsSelected: (contacts: Contact[]) => void
  selectedContactsCount: number
}

export function AgentRecipientSelector({
  onContactsSelected,
  selectedContactsCount
}: AgentRecipientSelectorProps) {
  const [activeTab, setActiveTab] = useState<'agenda' | 'csv' | 'manual' | 'database'>('agenda')
  
  // Agenda import state
  const { contacts: agendaContacts, loading: agendaLoading, importing, importContacts } = useAgentContacts()
  const [selectedFromAgenda, setSelectedFromAgenda] = useState<Set<string>>(new Set())
  const [searchFilter, setSearchFilter] = useState('')
  const [hasNameFilter, setHasNameFilter] = useState<boolean | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(20)
  
  // CSV state
  const [csvContent, setCsvContent] = useState('')
  const [csvContacts, setCsvContacts] = useState<Contact[]>([])
  const [csvErrors, setCsvErrors] = useState<string[]>([])
  const [customVariables, setCustomVariables] = useState<string[]>([])
  
  // Manual state
  const [manualPhone, setManualPhone] = useState('')
  const [manualName, setManualName] = useState('')
  const [manualContacts, setManualContacts] = useState<Contact[]>([])

  // Filter agenda contacts
  const filteredAgendaContacts = useMemo(() => {
    let filtered = agendaContacts

    // Search filter
    if (searchFilter.trim()) {
      const searchLower = searchFilter.toLowerCase()
      const searchClean = searchFilter.replace(/\D/g, '')
      
      filtered = filtered.filter(c => {
        const nameMatch = c.name?.toLowerCase().includes(searchLower)
        const phoneClean = c.phone.replace(/\D/g, '')
        const phoneMatch = searchClean.length > 0 && phoneClean.includes(searchClean)
        const lastDigitsMatch = searchClean.length >= 4 && phoneClean.endsWith(searchClean)
        return nameMatch || phoneMatch || lastDigitsMatch
      })
    }

    // Has name filter
    if (hasNameFilter !== null) {
      const hasName = (c: typeof agendaContacts[0]) => Boolean(c.name && c.name.trim())
      filtered = filtered.filter(c => hasNameFilter ? hasName(c) : !hasName(c))
    }

    return filtered
  }, [agendaContacts, searchFilter, hasNameFilter])

  // Pagination
  const totalPages = Math.ceil(filteredAgendaContacts.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const paginatedContacts = filteredAgendaContacts.slice(startIndex, endIndex)

  // Stats
  const stats = useMemo(() => {
    return contactImportService.getContactStats(agendaContacts.map(c => ({
      phone: c.phone,
      name: c.name,
      variables: c.variables
    })))
  }, [agendaContacts])

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchFilter, hasNameFilter])

  // Validate phone number
  const validatePhone = (phone: string): string | null => {
    const cleaned = phone.replace(/\D/g, '')
    if (cleaned.length >= 10 && cleaned.length <= 13) {
      return cleaned
    }
    return null
  }

  // Handle import from agenda
  const handleImportFromAgenda = async () => {
    await importContacts()
  }

  // Normalize phone for consistent comparison
  const normalizePhone = (phone: string) => phone.replace(/\D/g, '')

  // Toggle contact selection from agenda
  const toggleAgendaContact = (phone: string) => {
    const normalizedPhone = normalizePhone(phone)
    const newSelected = new Set(selectedFromAgenda)
    if (newSelected.has(normalizedPhone)) {
      newSelected.delete(normalizedPhone)
    } else {
      newSelected.add(normalizedPhone)
    }
    setSelectedFromAgenda(newSelected)
  }

  // Toggle all on current page
  const toggleAllOnPage = () => {
    const pagePhones = paginatedContacts.map(c => normalizePhone(c.phone))
    const allSelected = pagePhones.every(p => selectedFromAgenda.has(p))
    
    const newSelected = new Set(selectedFromAgenda)
    if (allSelected) {
      pagePhones.forEach(p => newSelected.delete(p))
    } else {
      pagePhones.forEach(p => newSelected.add(p))
    }
    setSelectedFromAgenda(newSelected)
  }

  // Confirm agenda selection
  const handleConfirmAgendaSelection = () => {
    // Usar Set para garantir unicidade por telefone normalizado
    const addedPhones = new Set<string>()
    const selected: Contact[] = []
    
    filteredAgendaContacts
      .filter(c => selectedFromAgenda.has(normalizePhone(c.phone)))
      .forEach(c => {
        const phoneClean = normalizePhone(c.phone)
        if (!addedPhones.has(phoneClean)) {
          addedPhones.add(phoneClean)
          selected.push({
            id: phoneClean,
            phone: phoneClean,
            name: c.name,
            variables: c.variables,
          })
        }
      })
    
    if (selected.length === 0) {
      toast.error('Selecione pelo menos um contato')
      return
    }
    
    onContactsSelected(selected)
    setSelectedFromAgenda(new Set())
    toast.success(`${selected.length} contato${selected.length !== 1 ? 's' : ''} adicionado${selected.length !== 1 ? 's' : ''}`)
  }

  // Add manual contact
  const handleAddManualContact = () => {
    const validPhone = validatePhone(manualPhone)
    if (!validPhone) {
      toast.error('Número de telefone inválido')
      return
    }

    if (manualContacts.some(c => c.phone === validPhone)) {
      toast.error('Este número já foi adicionado')
      return
    }

    const newContact: Contact = {
      id: validPhone,
      phone: validPhone,
      name: manualName.trim() || undefined,
    }

    const updatedContacts = [...manualContacts, newContact]
    setManualContacts(updatedContacts)
    onContactsSelected(updatedContacts)
    setManualPhone('')
    setManualName('')
    toast.success('Contato adicionado')
  }

  // Remove manual contact
  const handleRemoveManualContact = (phone: string) => {
    const updatedContacts = manualContacts.filter(c => c.phone !== phone)
    setManualContacts(updatedContacts)
    onContactsSelected(updatedContacts)
  }

  // Parse CSV content
  const handleParseCsv = () => {
    if (!csvContent.trim()) {
      toast.error('Cole o conteúdo do CSV')
      return
    }

    const lines = csvContent.trim().split('\n')
    const contacts: Contact[] = []
    const errors: string[] = []

    const firstLine = lines[0]
    const separator = firstLine.includes(';') ? ';' : ','

    const hasHeader = firstLine.toLowerCase().includes('telefone') || 
                      firstLine.toLowerCase().includes('phone') ||
                      firstLine.toLowerCase().includes('nome') ||
                      firstLine.toLowerCase().includes('name')

    const startIdx = hasHeader ? 1 : 0
    const headers = hasHeader ? firstLine.split(separator).map(h => h.trim().toLowerCase()) : ['telefone', 'nome']

    const phoneIndex = headers.findIndex(h => 
      h.includes('telefone') || h.includes('phone') || h.includes('celular') || h.includes('numero')
    )
    const nameIndex = headers.findIndex(h => 
      h.includes('nome') || h.includes('name')
    )

    const actualPhoneIndex = phoneIndex >= 0 ? phoneIndex : 0
    const actualNameIndex = nameIndex >= 0 ? nameIndex : (phoneIndex >= 0 ? -1 : 1)

    // Detect custom variables
    const detectedVariables: string[] = []
    headers.forEach((header, idx) => {
      if (idx !== actualPhoneIndex && idx !== actualNameIndex && header.trim()) {
        detectedVariables.push(header)
      }
    })
    setCustomVariables(detectedVariables)

    for (let i = startIdx; i < lines.length; i++) {
      const line = lines[i].trim()
      if (!line) continue

      const values = line.split(separator).map(v => v.trim().replace(/^["']|["']$/g, ''))
      const phone = values[actualPhoneIndex]
      const name = actualNameIndex >= 0 ? values[actualNameIndex] : undefined

      const validPhone = validatePhone(phone || '')
      if (validPhone) {
        if (!contacts.some(c => c.phone === validPhone)) {
          const variables: Record<string, string> = {}
          headers.forEach((header, idx) => {
            if (idx !== actualPhoneIndex && idx !== actualNameIndex && values[idx]) {
              variables[header] = values[idx]
            }
          })

          contacts.push({
            id: validPhone,
            phone: validPhone,
            name: name || undefined,
            variables: Object.keys(variables).length > 0 ? variables : undefined,
          })
        }
      } else if (phone) {
        errors.push(`Linha ${i + 1}: "${phone}" inválido`)
      }
    }

    if (contacts.length > 0) {
      setCsvContacts(contacts)
      setCsvErrors(errors)
      onContactsSelected(contacts)
      toast.success(`${contacts.length} contatos importados`)
      if (errors.length > 0) {
        toast.warning(`${errors.length} linhas ignoradas`)
      }
    } else {
      toast.error('Nenhum contato válido encontrado')
      setCsvErrors(errors)
    }
  }

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target?.result as string
      setCsvContent(content)
    }
    reader.readAsText(file)
  }

  // Download CSV template
  const handleDownloadTemplate = () => {
    contactImportService.downloadCSVTemplate(customVariables)
  }

  // Handle database contacts import
  const handleDatabaseContactsImported = (importedContacts: Array<{ phone: string; name?: string; variables?: Record<string, any> }>) => {
    const contacts: Contact[] = importedContacts.map(c => ({
      id: c.phone,
      phone: c.phone,
      name: c.name,
      variables: c.variables as Record<string, string> | undefined,
    }))
    onContactsSelected(contacts)
    toast.success(`${contacts.length} contatos importados do banco de dados`)
  }

  // Clear all
  const handleClearAll = () => {
    setManualContacts([])
    setCsvContacts([])
    setCsvContent('')
    setCsvErrors([])
    setCustomVariables([])
    setSelectedFromAgenda(new Set())
    onContactsSelected([])
    toast.info('Contatos removidos')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Destinatários</h3>
        </div>
        {selectedContactsCount > 0 && (
          <Button variant="ghost" size="sm" onClick={handleClearAll}>
            <X className="h-4 w-4 mr-1" />
            Limpar
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 h-auto gap-1 p-1">
          <TabsTrigger value="agenda" className="gap-2 text-xs sm:text-sm">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Agenda</span>
          </TabsTrigger>
          <TabsTrigger value="csv" className="gap-2 text-xs sm:text-sm">
            <FileSpreadsheet className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </TabsTrigger>
          <TabsTrigger value="manual" className="gap-2 text-xs sm:text-sm">
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Manual</span>
          </TabsTrigger>
          <TabsTrigger value="database" className="gap-2 text-xs sm:text-sm">
            <Database className="h-4 w-4" />
            <span className="hidden sm:inline">Banco</span>
          </TabsTrigger>
        </TabsList>

        {/* Agenda Tab */}
        <TabsContent value="agenda" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <Button
                onClick={handleImportFromAgenda}
                disabled={agendaLoading || importing}
                className="w-full"
              >
                {importing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Importando...
                  </>
                ) : (
                  <>
                    <Users className="h-4 w-4 mr-2" />
                    Importar da Agenda WhatsApp
                  </>
                )}
              </Button>

              {agendaContacts.length > 0 && (
                <>
                  {/* Stats */}
                  <div className="text-sm text-muted-foreground">
                    {stats.withName} com nome • {stats.total} total
                  </div>

                  {/* Filters */}
                  <div className="space-y-3 p-3 border rounded-lg bg-muted/50">
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
                            setSearchFilter('')
                            setHasNameFilter(null)
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="has-name"
                          checked={hasNameFilter === true}
                          onCheckedChange={(checked) => setHasNameFilter(checked ? true : null)}
                        />
                        <label htmlFor="has-name" className="text-sm cursor-pointer">
                          Com nome
                        </label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="no-name"
                          checked={hasNameFilter === false}
                          onCheckedChange={(checked) => setHasNameFilter(checked ? false : null)}
                        />
                        <label htmlFor="no-name" className="text-sm cursor-pointer">
                          Sem nome
                        </label>
                      </div>
                      <span className="text-sm text-muted-foreground ml-auto">
                        {filteredAgendaContacts.length} de {agendaContacts.length}
                      </span>
                    </div>
                  </div>

                  {/* Selection info */}
                  <div className="text-sm font-medium">
                    {selectedFromAgenda.size} selecionados
                  </div>

                  {/* Table */}
                  <div className="border rounded-lg overflow-x-auto max-h-[300px] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={paginatedContacts.length > 0 && paginatedContacts.every(c => selectedFromAgenda.has(normalizePhone(c.phone)))}
                              onCheckedChange={toggleAllOnPage}
                            />
                          </TableHead>
                          <TableHead>Telefone</TableHead>
                          <TableHead>Nome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedContacts.map((contact) => (
                          <TableRow key={contact.phone}>
                            <TableCell>
                              <Checkbox
                                checked={selectedFromAgenda.has(normalizePhone(contact.phone))}
                                onCheckedChange={() => toggleAgendaContact(contact.phone)}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {contactImportService.formatPhoneDisplay(contact.phone)}
                            </TableCell>
                            <TableCell>{contact.name || '-'}</TableCell>
                          </TableRow>
                        ))}
                        {filteredAgendaContacts.length === 0 && agendaContacts.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                              Nenhum contato encontrado com os filtros aplicados
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Por página:</span>
                        <Select
                          value={itemsPerPage.toString()}
                          onValueChange={(value) => {
                            setItemsPerPage(Number(value))
                            setCurrentPage(1)
                          }}
                        >
                          <SelectTrigger className="w-[80px]">
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

                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">
                          {startIndex + 1}-{Math.min(endIndex, filteredAgendaContacts.length)} de {filteredAgendaContacts.length}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p - 1)}
                            disabled={currentPage === 1}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setCurrentPage(p => p + 1)}
                            disabled={currentPage === totalPages}
                            className="h-8 w-8 p-0"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleConfirmAgendaSelection}
                    disabled={selectedFromAgenda.size === 0}
                    className="w-full"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Adicionar {selectedFromAgenda.size} Contatos
                  </Button>
                </>
              )}

              {agendaContacts.length === 0 && !agendaLoading && !importing && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Clique em "Importar da Agenda WhatsApp" para carregar seus contatos.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CSV Tab */}
        <TabsContent value="csv" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="space-y-2">
                <Label>Arquivo CSV</Label>
                <Input
                  type="file"
                  accept=".csv,.txt"
                  onChange={handleFileUpload}
                />
              </div>

              <div className="space-y-2">
                <Label>Ou cole o conteúdo do CSV</Label>
                <Textarea
                  value={csvContent}
                  onChange={(e) => setCsvContent(e.target.value)}
                  placeholder="telefone;nome&#10;5511999999999;João&#10;5511888888888;Maria"
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
                  <Download className="h-4 w-4 mr-2" />
                  Baixar Template
                </Button>
              </div>

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O CSV deve ter colunas para telefone e nome (opcional). 
                  Separador: vírgula ou ponto-e-vírgula.
                </AlertDescription>
              </Alert>

              <Button onClick={handleParseCsv} className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Processar CSV
              </Button>

              {csvContacts.length > 0 && (
                <Alert className="bg-green-500/10 border-green-500/20">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <AlertDescription>
                    <strong>{csvContacts.length}</strong> contatos importados
                  </AlertDescription>
                </Alert>
              )}

              {customVariables.length > 0 && (
                <Alert>
                  <AlertDescription>
                    <strong>Variáveis detectadas:</strong>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {customVariables.map(varName => (
                        <Badge key={varName} variant="secondary">
                          {`{{${varName}}}`}
                        </Badge>
                      ))}
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {csvErrors.length > 0 && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>{csvErrors.length} erros:</strong>
                    <ul className="mt-1 text-sm">
                      {csvErrors.slice(0, 3).map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                      {csvErrors.length > 3 && <li>... e mais {csvErrors.length - 3}</li>}
                    </ul>
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Manual Tab */}
        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={manualPhone}
                    onChange={(e) => setManualPhone(e.target.value)}
                    placeholder="5511999999999"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="name">Nome (opcional)</Label>
                  <Input
                    id="name"
                    value={manualName}
                    onChange={(e) => setManualName(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleAddManualContact()}
                  />
                </div>
              </div>
              <Button onClick={handleAddManualContact} className="w-full">
                <UserPlus className="h-4 w-4 mr-2" />
                Adicionar Contato
              </Button>

              {manualContacts.length > 0 && (
                <div className="space-y-2">
                  <Label>Contatos adicionados ({manualContacts.length})</Label>
                  <div className="max-h-48 overflow-y-auto space-y-2">
                    {manualContacts.map((contact) => (
                      <div
                        key={contact.phone}
                        className="flex items-center justify-between p-2 bg-muted rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                          <span className="font-mono text-sm">
                            {contactImportService.formatPhoneDisplay(contact.phone)}
                          </span>
                          {contact.name && (
                            <span className="text-sm text-muted-foreground">({contact.name})</span>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveManualContact(contact.phone)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Database Tab */}
        <TabsContent value="database" className="space-y-4">
          <AgentDatabaseContactSelector
            onContactsImported={handleDatabaseContactsImported}
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default AgentRecipientSelector
