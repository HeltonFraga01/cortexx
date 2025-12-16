import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2, Database, Play, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

interface DatabaseConnection {
    id: string;
    name: string;
    type: string;
}

interface Contact {
    phone: string;
    name?: string;
    variables?: Record<string, any>;
}

interface DatabaseContactSelectorProps {
    userToken: string;
    onContactsImported: (contacts: Contact[]) => void;
}

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export function DatabaseContactSelector({ userToken, onContactsImported }: DatabaseContactSelectorProps) {
    const [connections, setConnections] = useState<DatabaseConnection[]>([]);
    const [selectedConnection, setSelectedConnection] = useState<string>('');
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(false);
    const [preview, setPreview] = useState<Contact[]>([]);
    const [totalCount, setTotalCount] = useState(0);

    // Load connections on mount
    useEffect(() => {
        const loadConnections = async () => {
            try {
                setLoading(true);
                // Buscar conexões do admin (database_connections table)
                const response = await axios.get(`${API_URL}/api/admin/database-connections`, {
                    headers: { Authorization: `Bearer ${userToken}` }
                });
                if (response.data.success) {
                    setConnections(response.data.connections || []);
                }
            } catch (error: any) {
                console.error('Erro ao carregar conexões:', error);
                // Silently fail for UI, just log to console
                // If it's a 401/403 it might be auth, but we don't want to spam toasts
                setConnections([]);
            } finally {
                setLoading(false);
            }
        };
        loadConnections();
    }, [userToken]);

    const handlePreview = async () => {
        if (!selectedConnection) return;

        try {
            setFetching(true);
            const response = await axios.post(
                `${API_URL}/api/user/database-connections/${selectedConnection}/preview`,
                { query },
                { headers: { Authorization: `Bearer ${userToken}` } }
            );

            if (response.data.success) {
                setPreview(response.data.contacts);
                setTotalCount(response.data.totalAvailable);
                toast.success(`${response.data.totalAvailable} contatos encontrados`);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao buscar contatos');
        } finally {
            setFetching(false);
        }
    };

    const handleImport = async () => {
        if (!selectedConnection) return;

        try {
            setFetching(true);
            const response = await axios.post(
                `${API_URL}/api/user/database-connections/${selectedConnection}/fetch`,
                { query },
                { headers: { Authorization: `Bearer ${userToken}` } }
            );

            if (response.data.success) {
                onContactsImported(response.data.contacts);
                toast.success(`${response.data.count} contatos importados com sucesso!`);
                setPreview([]);
                setTotalCount(0);
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Erro ao importar contatos');
        } finally {
            setFetching(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 border rounded-lg bg-muted/20">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (connections.length === 0) {
        return (
            <div className="border rounded-lg p-6 bg-muted/20 text-center space-y-2">
                <Database className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                    Nenhuma conexão de banco de dados configurada.
                </p>
                <p className="text-xs text-muted-foreground">
                    Configure uma conexão no painel Admin primeiro.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4 border rounded-lg p-3 sm:p-4 bg-muted/20">
            <div className="flex items-center gap-2 mb-2">
                <Database className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                <h3 className="text-sm sm:text-base font-medium">Importar de Banco de Dados</h3>
            </div>

            <div className="grid gap-4">
                <div className="space-y-2">
                    <Label className="text-sm">Selecione a Conexão</Label>
                    <Select value={selectedConnection} onValueChange={setSelectedConnection} disabled={loading}>
                        <SelectTrigger className="w-full">
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
                    <div className="space-y-2">
                        <Label className="text-sm">Query SQL (Opcional)</Label>
                        <Textarea
                            placeholder="SELECT phone, name FROM users WHERE active = 1..."
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            className="font-mono text-xs sm:text-sm h-20 sm:h-24"
                        />
                        <p className="text-xs text-muted-foreground">
                            Se vazio, tentará buscar todos os registros da tabela padrão.
                            O sistema tenta identificar colunas 'phone' e 'name' automaticamente.
                        </p>
                    </div>
                )}

                {selectedConnection && (
                    <div className="flex flex-col sm:flex-row gap-2">
                        <Button
                            variant="secondary"
                            onClick={handlePreview}
                            disabled={fetching}
                            className="w-full sm:flex-1"
                        >
                            {fetching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                            <span className="hidden sm:inline">Testar / Preview</span>
                            <span className="sm:hidden">Preview</span>
                        </Button>

                        {totalCount > 0 && (
                            <Button
                                onClick={handleImport}
                                disabled={fetching}
                                className="w-full sm:flex-1"
                            >
                                <CheckCircle className="h-4 w-4 mr-2" />
                                <span className="hidden sm:inline">Importar {totalCount} Contatos</span>
                                <span className="sm:hidden">Importar ({totalCount})</span>
                            </Button>
                        )}
                    </div>
                )}

                {preview.length > 0 && (
                    <div className="mt-4">
                        <Label className="mb-2 block text-sm">Preview ({preview.length} de {totalCount})</Label>
                        <div className="border rounded-md overflow-x-auto">
                            <table className="w-full text-xs sm:text-sm text-left">
                                <thead className="bg-muted">
                                    <tr>
                                        <th className="p-2 min-w-[120px]">Telefone</th>
                                        <th className="p-2 min-w-[100px]">Nome</th>
                                        <th className="p-2 min-w-[80px]">Variáveis</th>
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
            </div>
        </div>
    );
}
