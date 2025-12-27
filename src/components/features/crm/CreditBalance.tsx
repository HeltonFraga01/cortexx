/**
 * CreditBalance Component
 * 
 * Displays credit balance with transaction history and add/consume actions.
 * 
 * Requirements: 4.1, 4.5, 4.7 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Coins, Plus, Minus, X, Check, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCredits, getTransactionTypeLabel, getTransactionTypeColor } from '@/services/creditService'
import type { CreditTransaction, AddCreditsFormData, ConsumeCreditsFormData } from '@/types/crm'

interface CreditBalanceProps {
  balance: number
  transactions: CreditTransaction[]
  total: number
  isLoading?: boolean
  onAddCredits?: (data: AddCreditsFormData) => Promise<void>
  onConsumeCredits?: (data: ConsumeCreditsFormData) => Promise<void>
  onLoadMore?: () => void
  hasMore?: boolean
}

type FormMode = 'none' | 'add' | 'consume'

export function CreditBalance({
  balance,
  transactions,
  total,
  isLoading,
  onAddCredits,
  onConsumeCredits,
  onLoadMore,
  hasMore
}: CreditBalanceProps) {
  const [formMode, setFormMode] = useState<FormMode>('none')
  const [isSaving, setIsSaving] = useState(false)
  const [addForm, setAddForm] = useState<AddCreditsFormData>({
    amount: 0,
    source: '',
    description: ''
  })
  const [consumeForm, setConsumeForm] = useState<ConsumeCreditsFormData>({
    amount: 0,
    reason: '',
    description: ''
  })

  const handleAddSubmit = async () => {
    if (addForm.amount <= 0 || !addForm.source) return
    
    setIsSaving(true)
    try {
      await onAddCredits?.(addForm)
      setFormMode('none')
      setAddForm({ amount: 0, source: '', description: '' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleConsumeSubmit = async () => {
    if (consumeForm.amount <= 0 || !consumeForm.reason) return
    
    setIsSaving(true)
    try {
      await onConsumeCredits?.(consumeForm)
      setFormMode('none')
      setConsumeForm({ amount: 0, reason: '', description: '' })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setFormMode('none')
    setAddForm({ amount: 0, source: '', description: '' })
    setConsumeForm({ amount: 0, reason: '', description: '' })
  }

  if (isLoading && transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Créditos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-16" />
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
            <Coins className="h-4 w-4" />
            Créditos
          </CardTitle>
          {formMode === 'none' && (
            <div className="flex gap-1">
              {onAddCredits && (
                <Button size="sm" variant="outline" onClick={() => setFormMode('add')}>
                  <Plus className="h-4 w-4" />
                </Button>
              )}
              {onConsumeCredits && (
                <Button size="sm" variant="outline" onClick={() => setFormMode('consume')}>
                  <Minus className="h-4 w-4" />
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Balance Display */}
        <div className="p-4 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/30 dark:to-yellow-950/30 border border-amber-200 dark:border-amber-800">
          <p className="text-xs text-muted-foreground mb-1">Saldo Atual</p>
          <p className="text-3xl font-bold text-amber-700 dark:text-amber-400">
            {formatCredits(balance)}
          </p>
        </div>

        {/* Add Credits Form */}
        {formMode === 'add' && (
          <Card className="border-2 border-green-500">
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm font-medium text-green-700 flex items-center gap-2">
                <ArrowUpCircle className="h-4 w-4" />
                Adicionar Créditos
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={addForm.amount || ''}
                    onChange={(e) => setAddForm({ ...addForm, amount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Origem</Label>
                  <Input
                    value={addForm.source}
                    onChange={(e) => setAddForm({ ...addForm, source: e.target.value })}
                    placeholder="Ex: Compra, Bônus"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={addForm.description}
                  onChange={(e) => setAddForm({ ...addForm, description: e.target.value })}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleAddSubmit} 
                  disabled={isSaving || addForm.amount <= 0 || !addForm.source}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isSaving ? 'Salvando...' : 'Adicionar'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Consume Credits Form */}
        {formMode === 'consume' && (
          <Card className="border-2 border-red-500">
            <CardContent className="pt-4 space-y-4">
              <p className="text-sm font-medium text-red-700 flex items-center gap-2">
                <ArrowDownCircle className="h-4 w-4" />
                Consumir Créditos
              </p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    max={balance}
                    value={consumeForm.amount || ''}
                    onChange={(e) => setConsumeForm({ ...consumeForm, amount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Input
                    value={consumeForm.reason}
                    onChange={(e) => setConsumeForm({ ...consumeForm, reason: e.target.value })}
                    placeholder="Ex: Envio de mensagem"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={consumeForm.description}
                  onChange={(e) => setConsumeForm({ ...consumeForm, description: e.target.value })}
                />
              </div>
              {consumeForm.amount > balance && (
                <p className="text-xs text-red-600">Saldo insuficiente</p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={handleCancel} disabled={isSaving}>
                  <X className="h-4 w-4 mr-1" />
                  Cancelar
                </Button>
                <Button 
                  onClick={handleConsumeSubmit} 
                  disabled={isSaving || consumeForm.amount <= 0 || consumeForm.amount > balance || !consumeForm.reason}
                  variant="destructive"
                >
                  <Check className="h-4 w-4 mr-1" />
                  {isSaving ? 'Salvando...' : 'Consumir'}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Transaction History */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-3">
            Histórico <Badge variant="secondary" className="ml-1">{total}</Badge>
          </p>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma transação registrada
            </p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'h-8 w-8 rounded-full flex items-center justify-center',
                      tx.type === 'credit' ? 'bg-green-100' : 
                      tx.type === 'debit' ? 'bg-red-100' : 
                      tx.type === 'adjustment' ? 'bg-yellow-100' : 'bg-gray-100'
                    )}>
                      {tx.type === 'credit' ? (
                        <ArrowUpCircle className="h-4 w-4 text-green-600" />
                      ) : tx.type === 'debit' ? (
                        <ArrowDownCircle className="h-4 w-4 text-red-600" />
                      ) : (
                        <RefreshCw className="h-4 w-4 text-yellow-600" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tx.source}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.createdAt).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={cn(
                      'text-sm font-semibold',
                      tx.amount > 0 ? 'text-green-600' : 'text-red-600'
                    )}>
                      {tx.amount > 0 ? '+' : ''}{formatCredits(tx.amount)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Saldo: {formatCredits(tx.balanceAfter)}
                    </p>
                  </div>
                </div>
              ))}

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
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default CreditBalance
