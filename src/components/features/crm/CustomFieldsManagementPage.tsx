/**
 * CustomFieldsManagementPage Component
 * 
 * Page for managing custom field definitions with CRUD operations.
 * 
 * Requirements: 6.1, 6.2, 6.4 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { toast } from 'sonner'
import {
  Settings2,
  Plus,
  MoreHorizontal,
  Trash2,
  Edit2,
  X,
  Check,
  GripVertical,
  Type,
  Hash,
  Calendar,
  ChevronDown,
  CheckSquare,
  Link,
  Mail,
  Phone
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

import * as customFieldService from '@/services/customFieldService'
import type { CustomFieldDefinition, CustomFieldType, CreateCustomFieldFormData } from '@/types/crm'

const fieldTypeConfig: Record<CustomFieldType, { icon: typeof Type; label: string }> = {
  text: { icon: Type, label: 'Texto' },
  number: { icon: Hash, label: 'Número' },
  date: { icon: Calendar, label: 'Data' },
  dropdown: { icon: ChevronDown, label: 'Lista suspensa' },
  checkbox: { icon: CheckSquare, label: 'Caixa de seleção' },
  url: { icon: Link, label: 'URL' },
  email: { icon: Mail, label: 'E-mail' },
  phone: { icon: Phone, label: 'Telefone' }
}

const emptyFormData: CreateCustomFieldFormData = {
  name: '',
  label: '',
  fieldType: 'text',
  options: [],
  isRequired: false,
  isSearchable: true,
  defaultValue: '',
  validationRules: {}
}

export function CustomFieldsManagementPage() {
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [showForm, setShowForm] = useState(false)
  const [editingField, setEditingField] = useState<CustomFieldDefinition | null>(null)
  const [formData, setFormData] = useState<CreateCustomFieldFormData>(emptyFormData)
  const [optionsInput, setOptionsInput] = useState('')

  // Fetch custom fields
  const { data: fields, isLoading } = useQuery({
    queryKey: ['custom-field-definitions'],
    queryFn: () => customFieldService.getFieldDefinitions()
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: customFieldService.CreateFieldData) => customFieldService.createField(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
      toast.success('Campo criado')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: customFieldService.UpdateFieldData }) =>
      customFieldService.updateField(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
      toast.success('Campo atualizado')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => customFieldService.deleteField(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['custom-field-definitions'] })
      toast.success('Campo excluído')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Handlers
  const resetForm = () => {
    setShowForm(false)
    setEditingField(null)
    setFormData(emptyFormData)
    setOptionsInput('')
  }

  const handleLabelChange = (label: string) => {
    const newFormData = { ...formData, label }
    // Auto-generate name from label if creating new field
    if (!editingField) {
      newFormData.name = customFieldService.generateFieldName(label)
    }
    setFormData(newFormData)
  }

  const handleCreate = () => {
    // Validate name
    const nameValidation = customFieldService.validateFieldName(formData.name)
    if (!nameValidation.valid) {
      toast.error(nameValidation.error)
      return
    }

    if (!formData.label.trim()) {
      toast.error('Label é obrigatório')
      return
    }

    // Parse options for dropdown
    const options = formData.fieldType === 'dropdown'
      ? optionsInput.split('\n').map(o => o.trim()).filter(Boolean)
      : undefined

    createMutation.mutate({
      name: formData.name,
      label: formData.label,
      fieldType: formData.fieldType,
      options,
      isRequired: formData.isRequired,
      isSearchable: formData.isSearchable,
      defaultValue: formData.defaultValue || undefined,
      validationRules: Object.keys(formData.validationRules).length > 0
        ? formData.validationRules
        : undefined
    })
  }

  const handleUpdate = () => {
    if (!editingField) return

    if (!formData.label.trim()) {
      toast.error('Label é obrigatório')
      return
    }

    // Parse options for dropdown
    const options = formData.fieldType === 'dropdown'
      ? optionsInput.split('\n').map(o => o.trim()).filter(Boolean)
      : undefined

    updateMutation.mutate({
      id: editingField.id,
      data: {
        label: formData.label,
        options,
        isRequired: formData.isRequired,
        isSearchable: formData.isSearchable,
        defaultValue: formData.defaultValue || null,
        validationRules: Object.keys(formData.validationRules).length > 0
          ? formData.validationRules
          : null
      }
    })
  }

  const handleEdit = (field: CustomFieldDefinition) => {
    setEditingField(field)
    setFormData({
      name: field.name,
      label: field.label,
      fieldType: field.fieldType,
      options: field.options || [],
      isRequired: field.isRequired,
      isSearchable: field.isSearchable,
      defaultValue: field.defaultValue || '',
      validationRules: field.validationRules || {}
    })
    setOptionsInput(field.options?.join('\n') || '')
    setShowForm(true)
  }

  const handleDelete = async (field: CustomFieldDefinition) => {
    const confirmed = await confirm({
      title: 'Excluir Campo',
      description: `Tem certeza que deseja excluir o campo "${field.label}"? Os valores existentes serão perdidos.`,
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(field.id)
    }
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Campos Personalizados</h1>
          <p className="text-sm text-muted-foreground">
            Defina campos adicionais para seus contatos
          </p>
        </div>
        {!showForm && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Campo
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              {editingField ? 'Editar Campo' : 'Novo Campo'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Label (exibição)</Label>
                <Input
                  value={formData.label}
                  onChange={(e) => handleLabelChange(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Nome (identificador)</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  disabled={!!editingField}
                  className={editingField ? 'bg-muted' : ''}
                />
                <p className="text-xs text-muted-foreground">
                  Usado internamente. Apenas letras minúsculas, números e underscores.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={formData.fieldType}
                  onValueChange={(v) => setFormData({ ...formData, fieldType: v as CustomFieldType })}
                  disabled={!!editingField}
                >
                  <SelectTrigger className={editingField ? 'bg-muted' : ''}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(fieldTypeConfig).map(([type, config]) => {
                      const Icon = config.icon
                      return (
                        <SelectItem key={type} value={type}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            {config.label}
                          </div>
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Valor padrão</Label>
                <Input
                  value={formData.defaultValue}
                  onChange={(e) => setFormData({ ...formData, defaultValue: e.target.value })}
                />
              </div>
            </div>

            {/* Options for dropdown */}
            {formData.fieldType === 'dropdown' && (
              <div className="space-y-2">
                <Label>Opções (uma por linha)</Label>
                <textarea
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  className="w-full min-h-[100px] p-2 border rounded-md text-sm"
                  placeholder="Opção 1&#10;Opção 2&#10;Opção 3"
                />
              </div>
            )}

            {/* Validation for number */}
            {formData.fieldType === 'number' && (
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor mínimo</Label>
                  <Input
                    type="number"
                    value={formData.validationRules.min ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      validationRules: {
                        ...formData.validationRules,
                        min: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Valor máximo</Label>
                  <Input
                    type="number"
                    value={formData.validationRules.max ?? ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      validationRules: {
                        ...formData.validationRules,
                        max: e.target.value ? parseFloat(e.target.value) : undefined
                      }
                    })}
                  />
                </div>
              </div>
            )}

            {/* Checkboxes */}
            <div className="flex gap-6">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isRequired"
                  checked={formData.isRequired}
                  onCheckedChange={(checked) => setFormData({ ...formData, isRequired: !!checked })}
                />
                <label htmlFor="isRequired" className="text-sm cursor-pointer">
                  Obrigatório
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="isSearchable"
                  checked={formData.isSearchable}
                  onCheckedChange={(checked) => setFormData({ ...formData, isSearchable: !!checked })}
                />
                <label htmlFor="isSearchable" className="text-sm cursor-pointer">
                  Pesquisável
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={resetForm}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                onClick={editingField ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fields List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Campos Definidos
            <Badge variant="secondary">{fields?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!fields || fields.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum campo personalizado definido
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Opções</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fields
                  .sort((a, b) => a.displayOrder - b.displayOrder)
                  .map((field) => {
                    const typeConfig = fieldTypeConfig[field.fieldType]
                    const Icon = typeConfig.icon
                    return (
                      <TableRow key={field.id}>
                        <TableCell>
                          <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                        </TableCell>
                        <TableCell className="font-medium">{field.label}</TableCell>
                        <TableCell className="text-sm text-muted-foreground font-mono">
                          {field.name}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm">{typeConfig.label}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {field.isRequired && (
                              <Badge variant="outline" className="text-xs">Obrigatório</Badge>
                            )}
                            {field.isSearchable && (
                              <Badge variant="outline" className="text-xs">Pesquisável</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => handleEdit(field)}>
                                <Edit2 className="h-4 w-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => void handleDelete(field)}
                                className="text-red-600"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    )
                  })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CustomFieldsManagementPage
