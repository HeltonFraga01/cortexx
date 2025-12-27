/**
 * CustomFieldsEditor Component
 * 
 * Dynamic form for editing custom field values on a contact.
 * 
 * Requirements: 6.1, 6.4 (Contact CRM Evolution)
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Settings2, Save, X } from 'lucide-react'
import type { CustomFieldDefinition, CustomFieldType } from '@/types/crm'

interface CustomFieldsEditorProps {
  definitions: CustomFieldDefinition[]
  values: Record<string, unknown>
  isLoading?: boolean
  onSave?: (values: Record<string, unknown>) => Promise<void>
}

export function CustomFieldsEditor({
  definitions,
  values,
  isLoading,
  onSave
}: CustomFieldsEditorProps) {
  const [editedValues, setEditedValues] = useState<Record<string, unknown>>(values)
  const [isDirty, setIsDirty] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    setEditedValues(values)
    setIsDirty(false)
  }, [values])

  const handleChange = (fieldName: string, value: unknown) => {
    setEditedValues((prev) => ({ ...prev, [fieldName]: value }))
    setIsDirty(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await onSave?.(editedValues)
      setIsDirty(false)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setEditedValues(values)
    setIsDirty(false)
  }

  const renderField = (def: CustomFieldDefinition) => {
    const value = editedValues[def.name]

    switch (def.fieldType) {
      case 'text':
      case 'email':
      case 'phone':
      case 'url':
        return (
          <Input
            type={def.fieldType === 'email' ? 'email' : def.fieldType === 'url' ? 'url' : 'text'}
            value={(value as string) || ''}
            onChange={(e) => handleChange(def.name, e.target.value)}
            placeholder={
              def.fieldType === 'email' ? 'email@example.com' :
              def.fieldType === 'url' ? 'https://example.com' :
              def.fieldType === 'phone' ? '+55 11 99999-9999' : ''
            }
          />
        )

      case 'number':
        return (
          <Input
            type="number"
            value={(value as number) ?? ''}
            onChange={(e) => handleChange(def.name, e.target.value ? parseFloat(e.target.value) : null)}
            min={def.validationRules?.min}
            max={def.validationRules?.max}
          />
        )

      case 'date':
        return (
          <Input
            type="date"
            value={(value as string) || ''}
            onChange={(e) => handleChange(def.name, e.target.value)}
          />
        )

      case 'checkbox':
        return (
          <div className="flex items-center space-x-2">
            <Checkbox
              id={`field-${def.name}`}
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleChange(def.name, checked)}
            />
            <label
              htmlFor={`field-${def.name}`}
              className="text-sm text-muted-foreground cursor-pointer"
            >
              {value ? 'Sim' : 'Não'}
            </label>
          </div>
        )

      case 'dropdown':
        return (
          <Select
            value={(value as string) || ''}
            onValueChange={(v) => handleChange(def.name, v)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {def.options?.map((opt) => (
                <SelectItem key={opt} value={opt}>
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )

      default:
        return (
          <Input
            value={(value as string) || ''}
            onChange={(e) => handleChange(def.name, e.target.value)}
          />
        )
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Campos Personalizados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (definitions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Campos Personalizados
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum campo personalizado configurado
          </p>
        </CardContent>
      </Card>
    )
  }

  // Sort by display order
  const sortedDefinitions = [...definitions].sort((a, b) => a.displayOrder - b.displayOrder)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Settings2 className="h-4 w-4" />
            Campos Personalizados
          </CardTitle>
          {isDirty && (
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={handleCancel} disabled={isSaving}>
                <X className="h-4 w-4" />
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                <Save className="h-4 w-4 mr-1" />
                {isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {sortedDefinitions.map((def) => (
          <div key={def.id} className="space-y-2">
            <Label className="flex items-center gap-1">
              {def.label}
              {def.isRequired && <span className="text-red-500">*</span>}
            </Label>
            {renderField(def)}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}

export default CustomFieldsEditor
