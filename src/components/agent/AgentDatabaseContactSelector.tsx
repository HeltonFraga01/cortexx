/**
 * AgentDatabaseContactSelector Component
 * 
 * Permite que agentes importem contatos de conexões de banco de dados configuradas.
 * Versão adaptada do DatabaseContactSelector para o contexto do agente.
 */

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Loader2, Database, Play, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { getAgentToken } from '@/services/agent-auth'

interface DatabaseConnection {
  id: string
  name: string
  type: string
}

interface Contact {
  phone: string
  name?: string
  variables?: Record<string, any>
}

interface AgentDatabaseContactSelectorProps {
  onContactsImported: (contacts: Contact[]) => void
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function AgentDatabaseContactSelector({ onContactsImported }: AgentDatabaseContactSelectorProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([])
  const [selectedConnection, setSelectedConnection] = useState<string>('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(false)
  const [preview, setPreview] = useState<Contact[]>([])
  const [totalCount, setTotalCount] = useState(0)

  // Load connections on mount
  useEffect(() => {
    const loadConnections = async () => {
      const token = getAgentToken()
      if (!token) return
      
      try {
        setLoading(true)
        const response = await fetch(`${API_URL}/api/agent/database-connections`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const data = await response.json()
        if (data.success) {
          setConnections(data.connections || [])
        }
      } catch (error) {
        console.error('Erro ao carregar conexões:', error)
        setConnections([])
      } finally {
        setLoading(false)
      }
    }
    loadConnections()
  }, [])

  const handlePreview = async () => {
    const token = getAgentToken()
    if (!selectedConnection || !token) return

    try {
      setFetching(true)
      const response = await fetch(
        `${API_URL}/api/agent/database-connections/${selectedConnection}/preview`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ query })
        }
      )
      const data = await response.json()

      if (data.success) {
        setPreview(data.contacts)
        setTotalCount(data.totalAvailable)
        toast.success(`${data.totalAvailable} contatos encontrados`)
      } else {
        toast.error(data.message || 'Erro ao buscar contatos')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao buscar contatos')
    } finally {
      setFetching(false)
    }
  }

  const handleImport = async () => {
    const token = getAgentToken()
    if (!selectedConnection || !token) return

    try {
      setFetching(true)
      const response = await fetch(
        `${API_URL}/api/agent/database-connections/${selectedConnection}/fetch`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ query })
        }
      )
      const data = await response.json()

      if (data.success) {
        onContactsImported(data.contacts)
        toast.success(`${data.count} contatos importados com sucesso!`)
        setPreview([])
        setTotalCount(0)
      } else {
        toast.error(data.message || 'Erro ao importar contatos')
      }
    } catch (error: any) {
      toast.error(error.message || 'Erro ao importar contatos')
    } finally {
      setFetching(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    )
  }

  if (connections.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center space-y-2">
          <Database className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Nenhuma conexão de banco de dados disponível.
          </p>
          <p className="text-xs text-muted-foreground">
            Solicite ao administrador para configurar uma conexão.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Database className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Importar de Banco de Dados</h3>
        </div>

        <div className="space-y-2">
          <Label>Selecione a Conexão</Label>
          <Select value={selectedConnection} onValueChange={setSelectedConnection}>
            <SelectTrigger>
              <SelectValue placeholder="Escolha uma conexão..." />
            </SelectTrigger>
            <SelectContent>
              {connections.map(conn => (
                <SelectItem key={conn.id} value={conn.id}>
                  {conn.name} ({conn.type})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedConnection && (
          <>
            <div className="space-y-2">
              <Label>Query SQL (Opcional)</Label>
              <Textarea
                placeholder="SELECT phone, name FROM users WHERE active = 1..."
                value={query}
                onChange={e => setQuery(e.target.value)}
                className="font-mono text-sm h-24"
              />
              <p className="text-xs text-muted-foreground">
                Se vazio, busca todos os registros da tabela padrão.
                O sistema identifica colunas 'phone' e 'name' automaticamente.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="secondary"
                onClick={handlePreview}
                disabled={fetching}
                className="flex-1"
              >
                {fetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
                Preview
              </Button>

              {totalCount > 0 && (
                <Button
                  onClick={handleImport}
                  disabled={fetching}
                  className="flex-1"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Importar {totalCount}
                </Button>
              )}
            </div>
          </>
        )}

        {preview.length > 0 && (
          <div className="space-y-2">
            <Label>Preview ({preview.length} de {totalCount})</Label>
            <div className="border rounded-md overflow-x-auto max-h-48">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="p-2 text-left">Telefone</th>
                    <th className="p-2 text-left">Nome</th>
                    <th className="p-2 text-left">Variáveis</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.map((contact, i) => (
                    <tr key={i} className="border-t">
                      <td className="p-2 font-mono text-xs">{contact.phone}</td>
                      <td className="p-2 truncate max-w-[150px]">{contact.name || '-'}</td>
                      <td className="p-2 text-xs text-muted-foreground">
                        {Object.keys(contact.variables || {}).length} vars
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default AgentDatabaseContactSelector
