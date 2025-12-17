/**
 * AffiliateConfig Component
 * 
 * Admin configuration for affiliate program settings.
 * Requirements: 12.1
 */

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Users, Percent, DollarSign, Save, Info } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { stripeService } from '@/services/stripe'
import type { AffiliateConfig as AffiliateConfigType } from '@/types/stripe'

export function AffiliateConfig() {
  const [config, setConfig] = useState<AffiliateConfigType>({
    commissionRate: 0.10,
    payoutThreshold: 10000,
    enabled: false,
  })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    loadConfig()
  }, [])

  async function loadConfig() {
    try {
      setLoading(true)
      // Load from API - for now use defaults
      // const data = await stripeService.getAffiliateConfig()
      // setConfig(data)
    } catch (error) {
      toast.error('Falha ao carregar configuração de afiliados')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      await stripeService.updateAffiliateConfig(config)
      toast.success('Configuração de afiliados atualizada')
    } catch (error) {
      toast.error('Falha ao salvar configuração')
    } finally {
      setSaving(false)
    }
  }

  function formatCurrency(cents: number) {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(cents / 100)
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <CardTitle>Programa de Afiliados</CardTitle>
        </div>
        <CardDescription>
          Configure as regras do programa de afiliados e comissões.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between p-4 rounded-lg border">
          <div className="space-y-0.5">
            <Label>Programa Ativo</Label>
            <p className="text-sm text-muted-foreground">
              Habilitar ou desabilitar o programa de afiliados
            </p>
          </div>
          <Switch
            checked={config.enabled}
            onCheckedChange={(enabled) => setConfig({ ...config, enabled })}
          />
        </div>

        {/* Commission Rate */}
        <div className="space-y-2">
          <Label htmlFor="commission-rate" className="flex items-center gap-2">
            <Percent className="h-4 w-4" />
            Taxa de Comissão
          </Label>
          <div className="flex items-center gap-2">
            <Input
              id="commission-rate"
              type="number"
              min="0"
              max="100"
              step="0.5"
              value={(config.commissionRate * 100).toFixed(1)}
              onChange={(e) => setConfig({ 
                ...config, 
                commissionRate: parseFloat(e.target.value) / 100 || 0 
              })}
              className="w-24"
            />
            <span className="text-muted-foreground">%</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Porcentagem do valor da venda que será paga ao afiliado.
          </p>
        </div>

        {/* Payout Threshold */}
        <div className="space-y-2">
          <Label htmlFor="payout-threshold" className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Valor Mínimo para Saque
          </Label>
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">R$</span>
            <Input
              id="payout-threshold"
              type="number"
              min="0"
              step="10"
              value={(config.payoutThreshold / 100).toFixed(2)}
              onChange={(e) => setConfig({ 
                ...config, 
                payoutThreshold: Math.round(parseFloat(e.target.value) * 100) || 0 
              })}
              className="w-32"
            />
          </div>
          <p className="text-sm text-muted-foreground">
            Valor mínimo acumulado para que o afiliado possa solicitar saque.
          </p>
        </div>

        {/* Summary */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Com a configuração atual, afiliados receberão{' '}
            <strong>{(config.commissionRate * 100).toFixed(1)}%</strong> de cada venda indicada
            e poderão sacar quando acumularem{' '}
            <strong>{formatCurrency(config.payoutThreshold)}</strong>.
          </AlertDescription>
        </Alert>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? (
            'Salvando...'
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Configuração
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  )
}

export default AffiliateConfig
