/**
 * TemplatesPage
 * CRUD page for message templates
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 5.2
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageHeader } from '@/components/ui/page-header';
import { Plus } from 'lucide-react';
import { TemplateList } from '@/components/features/messaging/TemplateList';
import { TemplateEditor } from '@/components/features/messaging/TemplateEditor';
import { templateService, CampaignTemplate, CreateTemplateDTO, UpdateTemplateDTO } from '@/services/templateService';
import { toast } from 'sonner';

export function TemplatesPage() {
  const navigate = useNavigate();
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<CampaignTemplate | undefined>();
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = () => {
    setEditingTemplate(undefined);
    setShowEditor(true);
  };

  const handleEdit = (template: CampaignTemplate) => {
    setEditingTemplate(template);
    setShowEditor(true);
  };

  const handleSave = async (data: CreateTemplateDTO | UpdateTemplateDTO) => {
    if (editingTemplate) {
      await templateService.update(editingTemplate.id, data as UpdateTemplateDTO);
    } else {
      await templateService.create(data as CreateTemplateDTO);
    }
    setShowEditor(false);
    setEditingTemplate(undefined);
    setRefreshKey((k) => k + 1);
  };

  const handleCancel = () => {
    setShowEditor(false);
    setEditingTemplate(undefined);
  };

  const handleUseTemplate = (template: CampaignTemplate) => {
    navigate('/user/mensagens', {
      state: { template },
    });
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden px-4 md:px-6 space-y-6">
      {/* Header */}
      <PageHeader
        title="Templates de Mensagem"
        subtitle="Crie e gerencie seus templates de mensagem"
        backButton={{
          label: 'Voltar',
          onClick: () => navigate('/user/mensagens'),
        }}
        actions={!showEditor ? [
          {
            label: 'Novo Template',
            onClick: handleCreate,
            icon: <Plus className="h-4 w-4" />,
          },
        ] : []}
      />

      {/* Editor or List */}
      {showEditor ? (
        <TemplateEditor
          template={editingTemplate}
          onSave={handleSave}
          onCancel={handleCancel}
        />
      ) : (
        <TemplateList
          key={refreshKey}
          onEdit={handleEdit}
          onSelect={handleUseTemplate}
        />
      )}
    </div>
  );
}

export default TemplatesPage;
