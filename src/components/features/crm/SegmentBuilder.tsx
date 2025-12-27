/**
 * SegmentBuilder Component
 * 
 * Visual builder for segment conditions with AND/OR logic.
 * 
 * Requirements: 7.1, 7.3 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Plus, Trash2, Eye, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  getAvailableFields,
  getOperatorLabel,
  createEmptyCondition,
  validateConditions
} from '@/services/segmentService'
import type { SegmentGroup, SegmentCondition, SegmentOperator, SegmentPreview } from '@/types/crm'

interface SegmentBuilderProps {
  segment: SegmentGroup
  onChange: (segment: SegmentGroup) => void
  onPreview?: () => Promise<SegmentPreview>
  isLoading?: boolean
}

const availableFields = getAvailableFields()

export function SegmentBuilder({
  segment,
  onChange,
  onPreview,
  isLoading
}: SegmentBuilderProps) {
  const [preview, setPreview] = useState<SegmentPreview | null>(null)
  const [isPreviewing, setIsPreviewing] = useState(false)

  const handleLogicChange = (logic: 'AND' | 'OR') => {
    onChange({ ...segment, logic })
  }

  const handleConditionChange = (index: number, condition: SegmentCondition) => {
    const newConditions = [...segment.conditions]
    newConditions[index] = condition
    onChange({ ...segment, conditions: newConditions })
  }

  const handleAddCondition = () => {
    onChange({
      ...segment,
      conditions: [...segment.conditions, createEmptyCondition()]
    })
  }

  const handleRemoveCondition = (index: number) => {
    if (segment.conditions.length <= 1) return
    const newConditions = segment.conditions.filter((_, i) => i !== index)
    onChange({ ...segment, conditions: newConditions })
  }

  const handlePreview = async () => {
    if (!onPreview) return
    
    const validation = validateConditions(segment)
    if (!validation.valid) return
    
    setIsPreviewing(true)
    try {
      const result = await onPreview()
      setPreview(result)
    } finally {
      setIsPreviewing(false)
    }
  }

  const getFieldConfig = (fieldName: string) => {
    return availableFields.find((f) => f.name === fieldName)
  }

  const renderCondition = (condition: SegmentCondition | SegmentGroup, index: number) => {
    // Only handle simple conditions for now
    if ('logic' in condition) return null

    const fieldConfig = getFieldConfig(condition.field)
    const operators = fieldConfig?.operators || ['equals', 'not_equals']

    return (
      <div key={index} className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
        {/* Field Select */}
        <Select
          value={condition.field}
          onValueChange={(value) =>
            handleConditionChange(index, { ...condition, field: value, value: '' })
          }
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {availableFields.map((field) => (
              <SelectItem key={field.name} value={field.name}>
                {field.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Operator Select */}
        <Select
          value={condition.operator}
          onValueChange={(value) =>
            handleConditionChange(index, { ...condition, operator: value as SegmentOperator })
          }
        >
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {operators.map((op) => (
              <SelectItem key={op} value={op}>
                {getOperatorLabel(op)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Value Input */}
        {fieldConfig?.type === 'boolean' ? (
          <Select
            value={String(condition.value)}
            onValueChange={(value) =>
              handleConditionChange(index, { ...condition, value: value === 'true' })
            }
          >
            <SelectTrigger className="w-24">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="true">Sim</SelectItem>
              <SelectItem value="false">Não</SelectItem>
            </SelectContent>
          </Select>
        ) : fieldConfig?.name === 'lead_tier' ? (
          <Select
            value={String(condition.value)}
            onValueChange={(value) =>
              handleConditionChange(index, { ...condition, value })
            }
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cold">Frio</SelectItem>
              <SelectItem value="warm">Morno</SelectItem>
              <SelectItem value="hot">Quente</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
            </SelectContent>
          </Select>
        ) : fieldConfig?.type === 'date' ? (
          <Input
            type="date"
            value={String(condition.value || '')}
            onChange={(e) =>
              handleConditionChange(index, { ...condition, value: e.target.value })
            }
            className="w-40"
          />
        ) : fieldConfig?.type === 'number' ? (
          <Input
            type="number"
            value={String(condition.value || '')}
            onChange={(e) =>
              handleConditionChange(index, { ...condition, value: parseFloat(e.target.value) || 0 })
            }
            className="w-28"
          />
        ) : (
          <Input
            value={String(condition.value || '')}
            onChange={(e) =>
              handleConditionChange(index, { ...condition, value: e.target.value })
            }
            className="w-40"
          />
        )}

        {/* Remove Button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => handleRemoveCondition(index)}
          disabled={segment.conditions.length <= 1}
          className="h-8 w-8 p-0"
        >
          <Trash2 className="h-4 w-4 text-muted-foreground" />
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Logic Toggle */}
      <div className="flex items-center gap-2">
        <Label className="text-sm">Combinar condições com:</Label>
        <div className="flex rounded-lg border overflow-hidden">
          <Button
            variant={segment.logic === 'AND' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLogicChange('AND')}
            className="rounded-none"
          >
            E (AND)
          </Button>
          <Button
            variant={segment.logic === 'OR' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => handleLogicChange('OR')}
            className="rounded-none"
          >
            OU (OR)
          </Button>
        </div>
      </div>

      {/* Conditions */}
      <div className="space-y-2">
        {segment.conditions.map((condition, index) => (
          <div key={index}>
            {index > 0 && (
              <div className="flex items-center justify-center py-1">
                <Badge variant="outline" className="text-xs">
                  {segment.logic}
                </Badge>
              </div>
            )}
            {renderCondition(condition, index)}
          </div>
        ))}
      </div>

      {/* Add Condition */}
      <Button variant="outline" size="sm" onClick={handleAddCondition}>
        <Plus className="h-4 w-4 mr-2" />
        Adicionar condição
      </Button>

      {/* Preview */}
      {onPreview && (
        <div className="pt-4 border-t">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={isPreviewing || isLoading}
          >
            <Eye className="h-4 w-4 mr-2" />
            {isPreviewing ? 'Carregando...' : 'Visualizar'}
          </Button>

          {preview && (
            <div className="mt-4 p-4 rounded-lg bg-muted/50">
              <p className="text-sm font-medium mb-2">
                {preview.count} contato{preview.count !== 1 ? 's' : ''} encontrado{preview.count !== 1 ? 's' : ''}
              </p>
              {preview.sample.length > 0 && (
                <div className="space-y-1">
                  {preview.sample.slice(0, 5).map((contact) => (
                    <div key={contact.id} className="text-xs text-muted-foreground">
                      {contact.name || contact.phone}
                    </div>
                  ))}
                  {preview.count > 5 && (
                    <p className="text-xs text-muted-foreground">
                      e mais {preview.count - 5}...
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default SegmentBuilder
