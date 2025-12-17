/**
 * WholesalePurchase Component
 * 
 * Displays wholesale credit packages for resellers to purchase in bulk.
 * Requirements: 11.1, 11.2
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Package, Sparkles, Check, ExternalLink, TrendingDown } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { CreditPackage } from '@/types/stripe'

export function WholesalePurchase() {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    loadPackages()
  }, [])

  async function loadPackages() {
    try {
      setLoading(true)
      const data = await stripeService.getWholesalePackages()
      setPackages(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar pacotes de atacado',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handlePurchase(packageId: string) {
    try {
      setPurchasing(packageId)
      const { url } = await stripeService.purchaseWholesale(packageId)
      window.location.href = url
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao iniciar compra. Tente novamente.',
        variant: 'destructive',
      })
      setPurchasing(null)
    }
  }

  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(cents / 100)
  }

  function getPricePerCredit(pkg: CreditPackage) {
    return (pkg.priceCents / pkg.creditAmount / 100).toFixed(4)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-64" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <CardTitle>Pacotes de Atacado</CardTitle>
          </div>
          <CardDescription>
            Compre créditos em grande quantidade com desconto.
          </CardDescription>
        </CardHeader>
        <CardContent className="py-8 text-center">
          <Package className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="mt-4 text-muted-foreground">
            Nenhum pacote de atacado disponível no momento.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          <CardTitle>Pacotes de Atacado</CardTitle>
        </div>
        <CardDescription>
          Compre créditos em grande quantidade com desconto para revender aos seus clientes.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-3">
          {packages.map((pkg, index) => {
            const isBestValue = index === packages.length - 1
            
            return (
              <Card 
                key={pkg.id} 
                className={isBestValue ? 'border-primary shadow-lg' : ''}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    {isBestValue && (
                      <Badge variant="default">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Melhor Valor
                      </Badge>
                    )}
                    {pkg.volumeDiscount && pkg.volumeDiscount > 0 && !isBestValue && (
                      <Badge variant="secondary">
                        <TrendingDown className="mr-1 h-3 w-3" />
                        -{pkg.volumeDiscount}%
                      </Badge>
                    )}
                  </div>
                  <CardDescription>
                    {pkg.creditAmount.toLocaleString('pt-BR')} créditos
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <span className="text-3xl font-bold">
                      {formatPrice(pkg.priceCents, pkg.currency)}
                    </span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    R$ {getPricePerCredit(pkg)} por crédito
                  </div>
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Preço de atacado
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Revenda com sua margem
                    </li>
                    {pkg.volumeDiscount && pkg.volumeDiscount > 0 && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        {pkg.volumeDiscount}% de desconto
                      </li>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isBestValue ? 'default' : 'outline'}
                    onClick={() => handlePurchase(pkg.id)}
                    disabled={purchasing !== null}
                  >
                    {purchasing === pkg.id ? (
                      'Redirecionando...'
                    ) : (
                      <>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Comprar
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

export default WholesalePurchase
