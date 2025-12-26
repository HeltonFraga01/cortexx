/**
 * Page Builder Page
 * 
 * Admin page for creating and editing custom themes using the visual Page Builder.
 * Uses Puck library for professional visual editing experience.
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { PuckPageBuilder } from '@/components/features/page-builder/puck';
import { 
  createCustomTheme, 
  updateCustomTheme, 
  getCustomTheme 
} from '@/services/custom-themes';
import type { ThemeSchema } from '@/types/page-builder';
import { toast } from 'sonner';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function PageBuilderPage() {
  const { themeId } = useParams<{ themeId?: string }>();
  const navigate = useNavigate();
  const [initialTheme, setInitialTheme] = useState<ThemeSchema | undefined>();
  const [loading, setLoading] = useState(!!themeId);
  const [saving, setSaving] = useState(false);

  const isEditMode = !!themeId;

  // Load existing theme if editing
  useEffect(() => {
    if (!themeId) return;

    const loadTheme = async () => {
      setLoading(true);
      try {
        const response = await getCustomTheme(parseInt(themeId, 10));
        if (response.success && response.data) {
          setInitialTheme(response.data.schema);
        } else {
          toast.error('Tema não encontrado');
          navigate('/admin/page-builder');
        }
      } catch (error) {
        toast.error('Erro ao carregar tema');
        navigate('/admin/page-builder');
      } finally {
        setLoading(false);
      }
    };

    loadTheme();
  }, [themeId, navigate]);

  const handleSave = async (schema: ThemeSchema) => {
    setSaving(true);
    try {
      if (isEditMode && themeId) {
        const response = await updateCustomTheme(parseInt(themeId, 10), {
          name: schema.name,
          description: schema.description,
          connectionId: schema.connectionId,
          schema,
        });

        if (response.success) {
          toast.success('Tema atualizado com sucesso');
        } else {
          toast.error(response.error || 'Erro ao atualizar tema');
        }
      } else {
        const response = await createCustomTheme({
          name: schema.name,
          description: schema.description,
          connectionId: schema.connectionId,
          schema,
        });

        if (response.success && response.data) {
          toast.success('Tema criado com sucesso');
          navigate(`/admin/page-builder/${response.data.id}`);
        } else {
          toast.error(response.error || 'Erro ao criar tema');
        }
      }
    } catch (error) {
      toast.error('Erro ao salvar tema');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-200px)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 mb-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/admin/page-builder')}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-xl font-semibold">
          {isEditMode ? 'Editar Tema' : 'Criar Novo Tema'}
        </h1>
      </div>
      
      <div className="flex-1 min-h-0">
        <PuckPageBuilder
          initialTheme={initialTheme}
          onSave={handleSave}
          saving={saving}
        />
      </div>
    </div>
  );
}

export default PageBuilderPage;
