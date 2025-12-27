/**
 * PurchaseHistory Component
 * 
 * Displays purchase history table with metrics and manual entry form.
 * 
 * Requirements: 3.1, 3.3, 3.4, 3.5 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ShoppingCart, Plus, X, Check, TrendingUp, DollarSign, Package } from 'lucide-react'
import { formatCurrency } from '@/services/purchaseService'
import type { Purchase, PurchaseStatus, CreatePurchaseFormData } from '@/types/crm'

interface PurchaseHistoryProps {
  purchases: Purchase[]
  total: number
  lifetimeValueCents: number
  purchaseCount: number
  averageOrderValueCents: number
  isLoading?: boolean
  onAddPurchase?: (data: CreatePurchaseFormData) => Promise<void>
  onLoadMore?: () => void
  hasMore?: boolean
}

const statusConfig: Record<PurchaseStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pendente', variant: 'secondary' },
  completed: { label: 'Concluída', variant: 'default' },
  refunded: { label: 'Reembolsada', variant: 'destructive' },
  cancelled: { label: 'Cancelada', variant: 'outline' }
}

export function PurchaseHistory({
  purchases,
  total,
  lifetimeValueCents,
  purchaseCount,
  averageOrderValueCents,
  isLoading,
  onAddPurchase,
  onLoadMore,
  hasMore
}: PurchaseHistoryProps) {
  const [showForm, setShowForm] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState<CreatePurchaseFormData>({
    amountCents: 0,
    currency: 'BRL',
    productName: '',
    description: '',
    status: 'completed',
    purchasedAt: new Date().toISOString().split('T')[0]
  })

  const handleSubmit = async () => {
    if (formData.amountCents <= 0) return
    
    setIsSaving(true)
    try {
      await onAddPurchase?.(formData)
      setShowForm(false)
      setFormData({
        amountCents: 0,
        currency: 'BRL',
        productName: '',
        description: '',
        status: 'completed',
        purchasedAt: new Date().toISOString().split('T')[0]
      })
    } finally {
      setIsSaving(false)
    }
  }

  if (isLoading && purchases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Compras</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <ShoppingCart className="h-4 w-4" />
            Compras
            <Badge variant="secondary" className="ml-1">{total}</Badge>
          </CardTitle>
          {onAddPurchase && !showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Adicionar
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <DollarSign className="h-3 w-3" />
              LTV
            </div>
            <p className="text-lg font-semibold">{formatCurrency(lifetimeValueCents)}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <Package className="h-3 w-3" />
              Compras
            </div>
            <p className="text-lg font-semibold">{purchaseCount}</p>
          </div>
          <div className="p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
              <TrendingUp className="h-3 w-3" />
              Ticket Médio
            </div>
            <p className="text-lg font-semibold">{formatCurrency(averageOrderValueCents)}</p>
          </div>
        </div>

        {/* Add Purchase Form */}
        {showForm && (
          <Card className="border-2 border-primary">
            <CardContent className="pt-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Valor (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.amountCents / 100 || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      amountCents: Math.round(parseFloat(e.target.value || '0') * 100)
                    })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Input
                    value={formData.productName}
                    onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data</Label>
                  <Input
                    type="date"
                    value={formData.purchasedAt}
                    onChange={(e) => setFormData({ ...formData, purchasedAt: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select
                    value={formData.status}
                    onValueChange={(v) => setFormData({ ...formData, status: v as PurchaseStatus })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="completed">Concluída</SelectItem>
                      <SelectItem value="pending">Pendente</SelectItem>
                      <SelectItem value="refunded">Reembolsada</SelectItem>
                      <SelectItem value="cancelled">Cancelada</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setShowForm(false)} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={isSaving || formData.amountCents <= 0}>
                  <Check className="h-4 w-4 mr-1" />
                  {isSaving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Purchase Table */}
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhuma compra registrada
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Produto</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell className="text-sm">
                      {new Date(purchase.purchasedAt).toLocaleDateString('pt-BR')}
                    </TableCell>
                    <TableCell className="text-sm">
                      {purchase.productName || '-'}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {formatCurrency(purchase.amountCents, purchase.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusConfig[purchase.status].variant}>
                        {statusConfig[purchase.status].label}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                onClick={onLoadMore}
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? 'Carregando...' : 'Carregar mais'}
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default PurchaseHistory
