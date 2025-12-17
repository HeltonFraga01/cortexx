/**
 * ResellerPricing Component
 * 
 * Allows resellers to configure custom pricing for credit packages.
 * Requirements: 14.1, 14.2, 14.3, 14.4, 14.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { DollarSign, Save, AlertTriangle, TrendingUp } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { ResellerPricing as ResellerPricingType } from '@/types/stripe'

export function ResellerPricing() {
  const [pricing, setPricing] = useState<ResellerPricingType[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [editedPrices, setEditedPrices] = useState<Record<string, number>>({})
  const { toast } = useToast()

  useEffect(() => {
    loadPricing()
  }, [])

  async function loadPricing() {
    try {
      setLoading(true)
      const data = await stripeService.getResellerPricing()
      setPricing(data)
      // Initialize edited prices
      const initial: Record<string, number> = {}
      data.forEach(p => {
        initial[p.packageId] = p.customPrice
      })
      setEditedPrices(initial)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar configuração de preços',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSave(packageId: string) {
    const pkg = pricing.find(p => p.packageId === packageId)
    if (!pkg) return

    const newPrice = editedPrices[packageId]
    const minPrice = pkg.wholesaleCost + pkg.platformFee

    if (newPrice < minPrice) {
      toast({
        title: 'Preço inválido',
        description: `O preço mínimo é ${formatPrice(minPrice)} (custo + taxa da plataforma)`,
        variant: 'destructive',
      })
      return
    }

    try {
      setSaving(packageId)
      await stripeService.updateResellerPricing({
        ...pkg,
        customPrice: newPrice,
        profitMargin: calculateMargin(newPrice, pkg.wholesaleCost, pkg.platformFee),
      })
      toast({
        title: 'Sucesso',
        description: 'Preço atualizado com sucesso',
      })
      await loadPricing()
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao salvar preço',
        variant: 'destructive',
      })
    } finally {
      setSaving(null)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  function calculateMargin(price: number, cost: number, fee: number) {
    const profit = price - cost - fee
    return profit / price
  }

  function handlePriceChange(packageId: string, value: string) {
    const cents = Math.round(parseFloat(value) * 100) || 0
    setEditedPrices(prev => ({ ...prev, [packageId]: cents }))
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (pricing.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            <CardTitle>Configuração de Preços</CardTitle>
          </div>
          <CardDescription>
            Configure os preços dos pacotes para seus clientes.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <DollarSign className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Nenhum pacote disponível para configuração de preços.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          <CardTitle>Configuração de Preços</CardTitle>
        </div>
        <CardDescription>
          Defina os preços de venda para seus clientes. O preço mínimo é o custo de atacado + taxa da plataforma.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pacote</TableHead>
              <TableHead className="text-right">Custo Atacado</TableHead>
              <TableHead className="text-right">Taxa Plataforma</TableHead>
              <TableHead className="text-right">Seu Preço</TableHead>
              <TableHead className="text-right">Margem</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {pricing.map((pkg) => {
              const currentPrice = editedPrices[pkg.packageId] || pkg.customPrice
              const minPrice = pkg.wholesaleCost + pkg.platformFee
              const isValid = currentPrice >= minPrice
              const margin = calculateMargin(currentPrice, pkg.wholesaleCost, pkg.platformFee)
              const hasChanges = currentPrice !== pkg.customPrice

              return (
                <TableRow key={pkg.packageId}>
                  <TableCell className="font-medium">{pkg.packageName}</TableCell>
                  <TableCell className="text-right">{formatPrice(pkg.wholesaleCost)}</TableCell>
                  <TableCell className="text-right">{formatPrice(pkg.platformFee)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        step="0.01"
                        min={(minPrice / 100).toFixed(2)}
                        value={(currentPrice / 100).toFixed(2)}
                        onChange={(e) => handlePriceChange(pkg.packageId, e.target.value)}
                        className={`w-24 text-right ${!isValid ? 'border-destructive' : ''}`}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={margin > 0.2 ? 'default' : margin > 0 ? 'secondary' : 'destructive'}>
                      <TrendingUp className="mr-1 h-3 w-3" />
                      {(margin * 100).toFixed(1)}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      onClick={() => handleSave(pkg.packageId)}
                      disabled={!isValid || !hasChanges || saving === pkg.packageId}
                    >
                      {saving === pkg.packageId ? (
                        'Salvando...'
                      ) : (
                        <>
                          <Save className="mr-1 h-3 w-3" />
                          Salvar
                        </>
                      )}
                    </Button>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>

        <Alert className="mt-4">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            O preço mínimo de cada pacote é calculado como: Custo de Atacado + Taxa da Plataforma.
            Defina um preço acima desse valor para garantir sua margem de lucro.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  )
}

export default ResellerPricing
