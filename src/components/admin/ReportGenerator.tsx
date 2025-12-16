/**
 * ReportGenerator Component
 * 
 * Form to generate reports with date range and type.
 * Requirements: 12.1, 12.2, 12.3, 12.5
 */

import { useState } from 'react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FileText, Download, Loader2 } from 'lucide-react'

type ReportType = 'usage' | 'revenue' | 'growth'

const reportTypeLabels: Record<ReportType, { label: string; description: string }> = {
  usage: {
    label: 'Relatório de Uso',
    description: 'Métricas de uso por usuário, plano e período'
  },
  revenue: {
    label: 'Relatório de Receita',
    description: 'MRR, ARR, churn e receita por plano'
  },
  growth: {
    label: 'Relatório de Crescimento',
    description: 'Novos usuários, churn e crescimento líquido'
  }
}

export function ReportGenerator() {
  const [reportType, setReportType] = useState<ReportType>('usage')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [reportData, setReportData] = useState<unknown>(null)

  const handleGenerate = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams()
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await api.get(`/api/admin/reports/${reportType}?${params}`)
      setReportData(response.data?.data)
      toast.success('Relatório gerado')
    } catch (error) {
      toast.error('Falha ao gerar relatório')
    } finally {
      setIsLoading(false)
    }
  }

  const handleExport = async () => {
    try {
      setIsLoading(true)
      const params = new URLSearchParams({
        type: reportType,
        format: 'csv'
      })
      if (startDate) params.append('startDate', startDate)
      if (endDate) params.append('endDate', endDate)

      const response = await api.get(`/api/admin/reports/export?${params}`, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${reportType}-report-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      toast.success('Relatório exportado')
    } catch (error) {
      toast.error('Falha ao exportar relatório')
    } finally {
      setIsLoading(false)
    }
  }

  const renderReportData = () => {
    if (!reportData) return null

    return (
      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Resultado</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-lg overflow-auto max-h-96 text-sm">
            {JSON.stringify(reportData, null, 2)}
          </pre>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gerador de Relatórios
          </CardTitle>
          <CardDescription>
            Gere relatórios administrativos com filtros personalizados
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Tipo de Relatório</Label>
              <Select value={reportType} onValueChange={(v) => setReportType(v as ReportType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(reportTypeLabels).map(([key, { label }]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {reportTypeLabels[reportType].description}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <Button onClick={handleGenerate} disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <FileText className="h-4 w-4 mr-2" />
              )}
              Gerar Relatório
            </Button>
            <Button variant="outline" onClick={handleExport} disabled={isLoading}>
              <Download className="h-4 w-4 mr-2" />
              Exportar CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {renderReportData()}
    </div>
  )
}
