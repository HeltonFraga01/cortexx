/**
 * CreditPurchase Component
 * 
 * Displays available credit packages for purchase.
 * Requirements: 6.1
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Coins, Sparkles, Check, ExternalLink } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { CreditPackage } from '@/types/stripe'

interface CreditPurchaseProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onPurchaseComplete?: () => void
}

export function CreditPurchase({ open, onOpenChange, onPurchaseComplete }: CreditPurchaseProps) {
  const [packages, setPackages] = useState<CreditPackage[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const { toast } = useToast()

  useEffect(() => {
    if (open) {
      loadPackages()
    }
  }, [open])

  async function loadPackages() {
    try {
      setLoading(true)
      const data = await stripeService.getCreditPackages()
      setPackages(data.filter(pkg => !pkg.isWholesale))
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

  async function handlePurchase(packageId: string) {
    try {
      setPurchasing(packageId)
      const { url } = await stripeService.purchaseCredits(packageId)
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

  const content = (
    <div className="space-y-4">
      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-24" />
                <Skeleton className="h-4 w-32" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-10 w-full" />
              </CardContent>
              <CardFooter>
                <Skeleton className="h-10 w-full" />
              </CardFooter>
            </Card>
          ))}
        </div>
      ) : packages.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Coins className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Nenhum pacote de créditos disponível no momento.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {packages.map((pkg, index) => {
            const isPopular = index === 1
            const isBestValue = pkg.volumeDiscount && pkg.volumeDiscount > 0
            
            return (
              <Card 
                key={pkg.id} 
                className={isPopular ? 'border-primary shadow-lg' : ''}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Coins className="h-5 w-5 text-primary" />
                      {pkg.name}
                    </CardTitle>
                    {isPopular && (
                      <Badge variant="default">
                        <Sparkles className="mr-1 h-3 w-3" />
                        Popular
                      </Badge>
                    )}
                    {isBestValue && !isPopular && (
                      <Badge variant="secondary">
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
                      Créditos não expiram
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="h-4 w-4 text-green-500" />
                      Uso imediato após compra
                    </li>
                    {isBestValue && (
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Desconto por volume incluído
                      </li>
                    )}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button 
                    className="w-full" 
                    variant={isPopular ? 'default' : 'outline'}
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
      )}
    </div>
  )

  if (open !== undefined && onOpenChange) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              Comprar Créditos
            </DialogTitle>
            <DialogDescription>
              Escolha um pacote de créditos para continuar usando os recursos do sistema.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    )
  }

  return content
}

export default CreditPurchase
