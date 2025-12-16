import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Plus, Edit, Trash2, Check, X } from 'lucide-react';
import { toast } from 'sonner';
import { automationService } from '@/services/automation';
import type { DefaultCannedResponse, DefaultCannedResponseInput } from '@/types/automation';

export default function DefaultCannedResponsesManager() {
  const [responses, setResponses] = useState<DefaultCannedResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [formData, setFormData] = useState<DefaultCannedResponseInput>({
    shortcut: '',
    content: ''
  });

  useEffect(() => {
    loadResponses();
  }, []);

  const loadResponses = async () => {
    try {
      setLoading(true);
      const data = await automationService.getDefaultCannedResponses();
      setResponses(data);
    } catch (error) {
      toast.error('Erro ao carregar respostas');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!formData.shortcut.trim() || !formData.content.trim()) {
      toast.error('Atalho e conteúdo são obrigatórios');
      return;
    }

    try {
      if (editingId) {
        await automationService.updateDefaultCannedResponse(editingId, formData);
        toast.success('Resposta atualizada');
      } else {
        await automationService.createDefaultCannedResponse(formData);
        toast.success('Resposta criada');
      }
      resetForm();
      loadResponses();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar resposta');
    }
  };

  const handleEdit = (response: DefaultCannedResponse) => {
    setFormData({ shortcut: response.shortcut, content: response.content });
    setEditingId(response.id);
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteId) return;

    try {
      await automationService.deleteDefaultCannedResponse(deleteId);
      toast.success('Resposta excluída');
      loadResponses();
    } catch (error) {
      toast.error('Erro ao excluir resposta');
    } finally {
      setDeleteId(null);
    }
  };

  const resetForm = () => {
    setFormData({ shortcut: '', content: '' });
    setEditingId(null);
    setShowForm(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Respostas Rápidas Padrão</CardTitle>
        {!showForm && (
          <Button onClick={() => setShowForm(true)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Nova Resposta
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {showForm && (
          <Card className="border-2 border-primary">
            <CardHeader>
              <CardTitle className="text-lg">
                {editingId ? 'Editar Resposta' : 'Nova Resposta'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Atalho</Label>
                <Input
                  value={formData.shortcut}
                  onChange={(e) => setFormData({ ...formData, shortcut: e.target.value })}
                  placeholder="/saudacao"
                />
                <p className="text-xs text-muted-foreground">
                  Digite o atalho que ativará esta resposta (ex: /saudacao)
                </p>
              </div>
              <div className="space-y-2">
                <Label>Conteúdo</Label>
                <Textarea
                  value={formData.content}
                  onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                  rows={4}
                />
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetForm}>
                  <X className="h-4 w-4 mr-2" />
                  Cancelar
                </Button>
                <Button onClick={handleSubmit}>
                  <Check className="h-4 w-4 mr-2" />
                  Salvar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {loading ? (
          <div className="flex justify-center p-4">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </div>
        ) : responses.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhuma resposta cadastrada
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">Atalho</TableHead>
                <TableHead>Conteúdo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {responses.map((response) => (
                <TableRow key={response.id}>
                  <TableCell>
                    <code className="bg-muted px-2 py-1 rounded text-sm">
                      {response.shortcut}
                    </code>
                  </TableCell>
                  <TableCell className="max-w-[300px] truncate">
                    {response.content}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(response)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setDeleteId(response.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta resposta?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
