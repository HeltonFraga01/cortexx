/**
 * BillingHistory Component
 * 
 * Displays user's invoice history with download links.
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Download, ExternalLink, FileText, Loader2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { Invoice } from '@/types/stripe'

const STATUS_LABELS: Record<string, string> = {
  paid: 'Pago',
  open: 'Aberto',
  void: 'Cancelado',
  uncollectible: 'Não cobrável',
}

const STATUS_VARIANTS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  paid: 'default',
  open: 'secondary',
  void: 'outline',
  uncollectible: 'destructive',
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: currency || 'BRL',
  }).format(amount)
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

export function BillingHistory() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [openingPortal, setOpeningPortal] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadInvoices()
  }, [])

  async function loadInvoices() {
    try {
      setLoading(true)
      const data = await stripeService.getBillingHistory()
      setInvoices(data)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar histórico de cobrança',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleOpenPortal() {
    try {
      setOpeningPortal(true)
      const { url } = await stripeService.openBillingPortal()
      window.open(url, '_blank')
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao abrir portal de cobrança',
        variant: 'destructive',
      })
    } finally {
      setOpeningPortal(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Histórico de Cobrança</CardTitle>
            <CardDescription>
              Suas faturas e pagamentos dos últimos 12 meses
            </CardDescription>
          </div>
          <Button variant="outline" onClick={handleOpenPortal} disabled={openingPortal}>
            {openingPortal ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Gerenciar Pagamento
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma fatura encontrada</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>{formatDate(invoice.createdAt)}</TableCell>
                  <TableCell>{formatCurrency(invoice.amount, invoice.currency)}</TableCell>
                  <TableCell>
                    <Badge variant={STATUS_VARIANTS[invoice.status] || 'outline'}>
                      {STATUS_LABELS[invoice.status] || invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {invoice.pdfUrl && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(invoice.pdfUrl, '_blank')}
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default BillingHistory
