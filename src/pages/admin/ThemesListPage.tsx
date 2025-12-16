/**
 * Themes List Page
 * 
 * Admin page for listing, editing, and deleting custom themes.
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useConfirmDialog } from '@/hooks/useConfirmDialog';
import { listCustomThemes, deleteCustomTheme } from '@/services/custom-themes';
import type { CustomTheme } from '@/types/page-builder';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Loader2, Blocks, Calendar, Database } from 'lucide-react';

export function ThemesListPage() {
  const navigate = useNavigate();
  const [themes, setThemes] = useState<CustomTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState<number | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const loadThemes = async () => {
    setLoading(true);
    try {
      const response = await listCustomThemes();
      if (response.success && response.data) {
        setThemes(response.data.themes || []);
      } else {
        toast.error(response.error || 'Erro ao carregar temas');
      }
    } catch (error) {
      toast.error('Erro ao carregar temas');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadThemes();
  }, []);

  const handleDelete = async (theme: CustomTheme) => {
    const confirmed = await confirm({
      title: 'Excluir Tema',
      description: `Tem certeza que deseja excluir o tema "${theme.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive',
    });

    if (!confirmed) return;

    setDeleting(theme.id);
    try {
      const response = await deleteCustomTheme(theme.id);
      if (response.success) {
        toast.success('Tema excluído com sucesso');
        setThemes(prev => prev.filter(t => t.id !== theme.id));
      } else {
        toast.error(response.error || 'Erro ao excluir tema');
      }
    } catch (error) {
      toast.error('Erro ao excluir tema');
    } finally {
      setDeleting(null);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Page Builder</h1>
          <p className="text-muted-foreground">
            Gerencie seus temas personalizados para visualização de registros
          </p>
        </div>
        <Button onClick={() => navigate('/admin/page-builder/new')}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Tema
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Blocks className="h-5 w-5" />
            Temas Personalizados
          </CardTitle>
          <CardDescription>
            Temas criados no Page Builder para personalizar a visualização de registros
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : themes.length === 0 ? (
            <div className="text-center py-8">
              <Blocks className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum tema personalizado criado ainda
              </p>
              <Button onClick={() => navigate('/admin/page-builder/new')}>
                <Plus className="h-4 w-4 mr-2" />
                Criar Primeiro Tema
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Blocos</TableHead>
                  <TableHead>Atualizado</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {themes.map((theme) => (
                  <TableRow key={theme.id}>
                    <TableCell className="font-medium">
                      {theme.name}
                    </TableCell>
                    <TableCell className="text-muted-foreground max-w-[200px] truncate">
                      {theme.description || '-'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {theme.schema?.blocks?.length || 0} blocos
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(theme.updated_at)}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/admin/page-builder/${theme.id}`)}
                        >
                          <Edit className="h-4 w-4 mr-1" />
                          Editar
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => handleDelete(theme)}
                          disabled={deleting === theme.id}
                        >
                          {deleting === theme.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog />
    </div>
  );
}

export default ThemesListPage;
