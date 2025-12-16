/**
 * AgentReportsPage
 * 
 * Page for agents to view campaign reports.
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { toast } from 'sonner'
import { 
  Loader2, 
  BarChart3, 
  Download, 
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Calendar
} from 'lucide-react'
import {
  getAgentReports,
  getAgentReport,
  exportAgentReport,
  type AgentReport
} from '@/services/agent-messaging'

export default function AgentReportsPage() {
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [expandedReport, setExpandedReport] = useState<string | null>(null)
  
  // Fetch reports
  const { data: reports = [], isLoading, refetch } = useQuery({
    queryKey: ['agent-reports', startDate, endDate],
    queryFn: () => getAgentReports({ 
      startDate: startDate || undefined, 
      endDate: endDate || undefined 
    }),
    staleTime: 60000
  })

  // Fetch expanded report details
  const { data: expandedDetails } = useQuery({
    queryKey: ['agent-report', expandedReport],
    queryFn: () => expandedReport ? getAgentReport(expandedReport) : null,
    enabled: !!expandedReport,
    staleTime: 30000
  })

  const handleToggleExpand = (reportId: string) => {
    setExpandedReport(expandedReport === reportId ? null : reportId)
  }

  const handleExport = async (reportId: string) => {
    try {
      const blobUrl = await exportAgentReport(reportId)
      const link = document.createElement('a')
      link.href = blobUrl
      link.download = `report-${reportId}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(blobUrl)
      toast.success('Relatório exportado!')
    } catch (error) {
      toast.error('Erro ao exportar relatório', { 
        description: error instanceof Error ? error.message : 'Erro desconhecido' 
      })
    }
  }

  const handleFilter = () => {
    refetch()
  }

  const handleClearFilter = () => {
    setStartDate('')
    setEndDate('')
    setTimeout(() => refetch(), 0)
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">
          Visualize os resultados das suas campanhas concluídas
        </p>
      </div>

      {/* Date Filter */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtrar por Data
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label htmlFor="startDate">Data Inicial</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endDate">Data Final</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            <Button onClick={handleFilter}>Filtrar</Button>
            {(startDate || endDate) && (
              <Button variant="outline" onClick={handleClearFilter}>Limpar</Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Reports List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Campanhas Concluídas
          </CardTitle>
          <CardDescription>
            {reports.length} relatório{reports.length !== 1 ? 's' : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : reports.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum relatório encontrado
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Campanha</TableHead>
                  <TableHead>Enviados</TableHead>
                  <TableHead>Falhas</TableHead>
                  <TableHead>Taxa de Entrega</TableHead>
                  <TableHead>Concluída em</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((report) => (
                  <>
                    <TableRow key={report.id}>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleToggleExpand(report.id)}
                        >
                          {expandedReport === report.id ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="font-medium">{report.name}</TableCell>
                      <TableCell>
                        <span className="text-green-600 font-medium">{report.sentCount}</span>
                        <span className="text-muted-foreground">/{report.totalContacts}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-red-600">{report.failedCount}</span>
                      </TableCell>
                      <TableCell>
                        <Badge variant={report.deliveryRate >= 90 ? 'default' : report.deliveryRate >= 70 ? 'secondary' : 'destructive'}>
                          {report.deliveryRate}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {report.completedAt 
                          ? new Date(report.completedAt).toLocaleDateString('pt-BR')
                          : '-'
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleExport(report.id)}
                          title="Exportar CSV"
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                    {expandedReport === report.id && (
                      <TableRow>
                        <TableCell colSpan={7} className="bg-muted/50 p-4">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                            <div>
                              <p className="text-xs text-muted-foreground">Total de Contatos</p>
                              <p className="font-medium">{report.totalContacts}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Enviados com Sucesso</p>
                              <p className="font-medium text-green-600">{report.sentCount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Falhas</p>
                              <p className="font-medium text-red-600">{report.failedCount}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Taxa de Entrega</p>
                              <p className="font-medium">{report.deliveryRate}%</p>
                            </div>
                          </div>
                          
                          {expandedDetails?.contacts && expandedDetails.contacts.length > 0 && (
                            <div>
                              <p className="text-sm font-medium mb-2">Detalhes dos Contatos:</p>
                              <div className="max-h-60 overflow-y-auto border rounded">
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead>Status</TableHead>
                                      <TableHead>Telefone</TableHead>
                                      <TableHead>Nome</TableHead>
                                      <TableHead>Enviado em</TableHead>
                                      <TableHead>Erro</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {expandedDetails.contacts.map((contact) => (
                                      <TableRow key={contact.id}>
                                        <TableCell>
                                          {contact.status === 'sent' && (
                                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                                          )}
                                          {contact.status === 'failed' && (
                                            <AlertCircle className="h-4 w-4 text-red-500" />
                                          )}
                                        </TableCell>
                                        <TableCell>{contact.phone}</TableCell>
                                        <TableCell>{contact.name || '-'}</TableCell>
                                        <TableCell>
                                          {contact.sentAt 
                                            ? new Date(contact.sentAt).toLocaleString('pt-BR')
                                            : '-'
                                          }
                                        </TableCell>
                                        <TableCell className="text-red-600 text-xs">
                                          {contact.errorMessage || '-'}
                                        </TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              </div>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
