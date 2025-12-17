/**
 * ResellerSales Component
 * 
 * Displays sales history and transaction details for resellers.
 * Requirements: 10.5
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ShoppingCart, DollarSign, TrendingUp, Calendar } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { api } from '@/lib/api'

interface Sale {
  id: string
  customerEmail: string
  packageName: string
  amount: number
  platformFee: number
  netAmount: number
  status: 'completed' | 'pending' | 'refunded'
  createdAt: string
}

interface SalesSummary {
  totalSales: number
  totalRevenue: number
  totalFees: number
  netRevenue: number
}

export function ResellerSales() {
  const [sales, setSales] = useState<Sale[]>([])
  const [summary, setSummary] = useState<SalesSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadSales()
  }, [])

  async function loadSales() {
    try {
      setLoading(true)
      const response = await api.get('/reseller/sales')
      setSales(response.data.data?.sales || [])
      setSummary(response.data.data?.summary || null)
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Falha ao carregar histórico de vendas',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  function formatPrice(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  function formatDate(dateString: string) {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString))
  }

  function getStatusBadge(status: Sale['status']) {
    switch (status) {
      case 'completed':
        return <Badge variant="default">Concluída</Badge>
      case 'pending':
        return <Badge variant="secondary">Pendente</Badge>
      case 'refunded':
        return <Badge variant="destructive">Reembolsada</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
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
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <Skeleton className="h-64 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5 text-primary" />
          <CardTitle>Histórico de Vendas</CardTitle>
        </div>
        <CardDescription>
          Acompanhe suas vendas e comissões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Cards */}
        {summary && (
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ShoppingCart className="h-4 w-4" />
                  Total de Vendas
                </div>
                <p className="text-2xl font-bold">{summary.totalSales}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Receita Bruta
                </div>
                <p className="text-2xl font-bold">{formatPrice(summary.totalRevenue)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <DollarSign className="h-4 w-4" />
                  Taxas
                </div>
                <p className="text-2xl font-bold text-muted-foreground">
                  -{formatPrice(summary.totalFees)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  Receita Líquida
                </div>
                <p className="text-2xl font-bold text-green-600">
                  {formatPrice(summary.netRevenue)}
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Sales Table */}
        {sales.length === 0 ? (
          <div className="py-8 text-center">
            <ShoppingCart className="mx-auto h-12 w-12 text-muted-foreground" />
            <p className="mt-4 text-muted-foreground">
              Nenhuma venda registrada ainda.
            </p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Pacote</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="text-right">Líquido</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((sale) => (
                <TableRow key={sale.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      {formatDate(sale.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell>{sale.customerEmail}</TableCell>
                  <TableCell>{sale.packageName}</TableCell>
                  <TableCell className="text-right">{formatPrice(sale.amount)}</TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    -{formatPrice(sale.platformFee)}
                  </TableCell>
                  <TableCell className="text-right font-medium text-green-600">
                    {formatPrice(sale.netAmount)}
                  </TableCell>
                  <TableCell>{getStatusBadge(sale.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}

export default ResellerSales
