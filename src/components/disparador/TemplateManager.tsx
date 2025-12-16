import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Loader2, Trash2, FileText, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { templateService, CampaignTemplate } from '@/services/templateService';
import { CampaignConfig } from '@/services/bulkCampaignService';

interface TemplateManagerProps {
    userToken: string;
    currentConfig?: Partial<CampaignConfig>;
    onLoadTemplate: (config: Partial<CampaignConfig>) => void;
}

export function TemplateManager({ userToken, currentConfig, onLoadTemplate }: TemplateManagerProps) {
    const [templates, setTemplates] = useState<CampaignTemplate[]>([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newTemplateName, setNewTemplateName] = useState('');
    const [newTemplateDesc, setNewTemplateDesc] = useState('');
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [loadDialogOpen, setLoadDialogOpen] = useState(false);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await templateService.getTemplates(userToken);
            setTemplates(data);
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (loadDialogOpen || saveDialogOpen) {
            loadTemplates();
        }
    }, [loadDialogOpen, saveDialogOpen]);

    const handleSaveTemplate = async () => {
        if (!newTemplateName.trim()) {
            toast.error('Nome do template é obrigatório');
            return;
        }

        if (!currentConfig) {
            toast.error('Nenhuma configuração para salvar');
            return;
        }

        try {
            setSaving(true);

            // Clean up config before saving (remove specific campaign data)
            const configToSave = { ...currentConfig };
            delete configToSave.name;
            delete configToSave.contacts;
            delete configToSave.scheduledAt;

            await templateService.createTemplate(
                newTemplateName,
                newTemplateDesc,
                configToSave,
                userToken
            );

            toast.success('Template salvo com sucesso!');
            setSaveDialogOpen(false);
            setNewTemplateName('');
            setNewTemplateDesc('');
        } catch (error: any) {
            toast.error(error.message);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteTemplate = async (id: string) => {
        try {
            await templateService.deleteTemplate(id, userToken);
            setTemplates(prev => prev.filter(t => t.id !== id));
            toast.success('Template excluído');
        } catch (error: any) {
            toast.error(error.message);
        }
    };

    return (
        <div className="flex flex-col gap-2 sm:flex-row">
            {/* Save Template Dialog */}
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                        <Save className="h-4 w-4" />
                        <span className="hidden sm:inline">Salvar Template</span>
                        <span className="sm:hidden">Salvar</span>
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Salvar como Template</DialogTitle>
                        <DialogDescription>
                            Salve a configuração atual (mensagens, agendamento, humanização) para reutilizar depois.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        <div className="space-y-2">
                            <Label htmlFor="tpl-name">Nome do Template</Label>
                            <Input
                                id="tpl-name"
                                placeholder="Ex: Sequência de Boas Vindas"
                                value={newTemplateName}
                                onChange={e => setNewTemplateName(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="tpl-desc">Descrição (Opcional)</Label>
                            <Input
                                id="tpl-desc"
                                placeholder="Breve descrição do objetivo"
                                value={newTemplateDesc}
                                onChange={e => setNewTemplateDesc(e.target.value)}
                            />
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>Cancelar</Button>
                        <Button onClick={handleSaveTemplate} disabled={saving}>
                            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Salvar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Load Template Dialog */}
            <Dialog open={loadDialogOpen} onOpenChange={setLoadDialogOpen}>
                <DialogTrigger asChild>
                    <Button variant="outline" className="gap-2 w-full sm:w-auto">
                        <Download className="h-4 w-4" />
                        <span className="hidden sm:inline">Carregar Template</span>
                        <span className="sm:hidden">Carregar</span>
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Meus Templates</DialogTitle>
                        <DialogDescription>
                            Selecione um template para carregar suas configurações.
                        </DialogDescription>
                    </DialogHeader>

                    <ScrollArea className="h-[400px] pr-4">
                        {loading ? (
                            <div className="flex justify-center py-8">
                                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                            </div>
                        ) : templates.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                                <p>Nenhum template salvo ainda.</p>
                            </div>
                        ) : (
                            <div className="grid gap-4">
                                {templates.map(template => (
                                    <Card key={template.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                                        <CardContent className="p-4 flex items-center justify-between">
                                            <div className="space-y-1" onClick={() => {
                                                onLoadTemplate(template.config);
                                                setLoadDialogOpen(false);
                                                toast.success(`Template "${template.name}" carregado!`);
                                            }}>
                                                <h4 className="font-semibold flex items-center gap-2">
                                                    {template.name}
                                                </h4>
                                                {template.description && (
                                                    <p className="text-sm text-muted-foreground">{template.description}</p>
                                                )}
                                                <p className="text-xs text-muted-foreground">
                                                    Criado em {new Date(template.createdAt).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    size="sm"
                                                    onClick={() => {
                                                        onLoadTemplate(template.config);
                                                        setLoadDialogOpen(false);
                                                        toast.success(`Template "${template.name}" carregado!`);
                                                    }}
                                                >
                                                    Carregar
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDeleteTemplate(template.id);
                                                    }}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </ScrollArea>
                </DialogContent>
            </Dialog>
        </div>
    );
}
