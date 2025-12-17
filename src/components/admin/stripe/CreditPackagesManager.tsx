/**
 * CreditPackagesManager Component
 * 
 * Admin interface for managing credit packages (one-time purchases).
 * These are extra credits users can buy when they exceed their plan limits.
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, Plus, Pencil, Trash2, Coins, Check, X } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'

interface CreditPackage {
  id: string
  name: string
  description: string | null
  creditAmount: number
  priceCents: number
  status: string
  stripeProductId: string | null
  stripePriceId: string | null
}

interface PackageFormData {
  name: string
  description: string
  creditAmount: number
  priceCents: number
}

export function CreditPackagesManager() {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState<PackageFormData>({
    name: '',
    description: '',
    creditAmount: 1000,
    priceCents: 1000,
  })
  const { toast } = useToast()

  useEffect(() => {
    loadPackages()
  }, [])

  async function loadPackages() {
    try {
      setLoading(true)
      const response = await api.get('/api/admin/credit-packages')
      setPackages(response.data.data || [])
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar pacotes de créditos',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!formData.name || formData.creditAmount <= 0 || formData.priceCents <= 0) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios',
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(true)
      if (editingId) {
        await api.put(`/api/admin/credit-packages/${editingId}`, formData)
        toast({ title: 'Sucesso', description: 'Pacote atualizado' })
      } else {
        await api.post('/api/admin/credit-packages', formData)
        toast({ title: 'Sucesso', description: 'Pacote criado' })
      }
      resetForm()
      loadPackages()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar pacote',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Tem certeza que deseja excluir este pacote?')) return

    try {
      await api.delete(`/api/admin/credit-packages/${id}`)
      toast({ title: 'Sucesso', description: 'Pacote excluído' })
      loadPackages()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao excluir pacote',
        variant: 'destructive',
      })
    }
  }

  function handleEdit(pkg: CreditPackage) {
    setFormData({
      name: pkg.name,
      description: pkg.description || '',
      creditAmount: pkg.creditAmount,
      priceCents: pkg.priceCents,
    })
    setEditingId(pkg.id)
    setShowForm(true)
  }

  function resetForm() {
    setFormData({ name: '', description: '', creditAmount: 1000, priceCents: 1000 })
    setEditingId(null)
    setShowForm(false)
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  function getPricePerToken(pkg: CreditPackage) {
    return (pkg.priceCents / pkg.creditAmount / 100).toFixed(4)
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5" />
                Pacotes de Créditos Extras
              </CardTitle>
              <CardDescription>
                Pacotes de tokens que usuários podem comprar quando excederem o limite do plano
              </CardDescription>
            </div>
            {!showForm && (
              <Button onClick={() => setShowForm(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Pacote
              </Button>
            )}
          </div>
        </CardHeader>

        {showForm && (
          <CardContent className="border-b">
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">{editingId ? 'Editar Pacote' : 'Novo Pacote'}</h4>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: 1.000 Tokens"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Descrição</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descrição opcional"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Quantidade de Tokens</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.creditAmount}
                    onChange={(e) => setFormData({ ...formData, creditAmount: parseInt(e.target.value) || 0 })}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Preço (R$)</label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.priceCents / 100}
                    onChange={(e) => setFormData({ ...formData, priceCents: Math.round(parseFloat(e.target.value || '0') * 100) })}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={resetForm}>
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                  Salvar
                </Button>
              </div>
            </div>
          </CardContent>
        )}

        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Tokens</TableHead>
                <TableHead>Preço</TableHead>
                <TableHead>R$/Token</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Stripe</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {packages.map((pkg) => (
                <TableRow key={pkg.id}>
                  <TableCell className="font-medium">{pkg.name}</TableCell>
                  <TableCell>{pkg.creditAmount.toLocaleString('pt-BR')}</TableCell>
                  <TableCell>{formatCurrency(pkg.priceCents)}</TableCell>
                  <TableCell className="text-muted-foreground">R$ {getPricePerToken(pkg)}</TableCell>
                  <TableCell>
                    <Badge variant={pkg.status === 'active' ? 'default' : 'secondary'}>
                      {pkg.status === 'active' ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {pkg.stripePriceId ? (
                      <Badge variant="outline" className="text-green-600">Sincronizado</Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-600">Pendente</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(pkg)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleDelete(pkg.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {packages.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                    Nenhum pacote de créditos cadastrado
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

export default CreditPackagesManager
