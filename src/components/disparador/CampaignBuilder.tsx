/**
 * CampaignBuilder Component
 * 
 * Componente principal para configurar e criar campanhas de disparo em massa
 */

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Send,
  Calendar,
  Clock,
  Shuffle,
  AlertCircle,
  Loader2,
  Sparkles,
  Tag
} from 'lucide-react';
import { bulkCampaignService } from '@/services/bulkCampaignService';
import { contactImportService } from '@/services/contactImportService';
import { MessageSequenceEditor } from './MessageSequenceEditor';
import { SchedulingWindowInput } from './SchedulingWindowInput';
import { SchedulingInput } from '@/components/shared/forms/SchedulingInput';
import { TemplateManager } from './TemplateManager';
import { RecipientSelector } from './RecipientSelector';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, BarChart3, PlusCircle } from 'lucide-react';
import { AnalyticsDashboard } from './AnalyticsDashboard';
import { useCampaignBuilder } from './hooks/useCampaignBuilder';

interface CampaignBuilderProps {
  instance: string;
  userToken: string;
  onCampaignCreated?: (campaignId: string) => void;
}

export function CampaignBuilder({ instance, userToken, onCampaignCreated }: CampaignBuilderProps) {
  const {
    name,
    setName,
    messages,
    setMessages,
    delayMin,
    setDelayMin,
    delayMax,
    setDelayMax,
    randomizeOrder,
    setRandomizeOrder,
    isScheduled,
    setIsScheduled,
    scheduledDateTime,
    setScheduledDateTime,
    isSchedulingValid,
    setIsSchedulingValid,
    enableWindow,
    setEnableWindow,
    sendingWindow,
    setSendingWindow,
    contacts,
    setContacts,
    loading,
    detectedVariables,
    currentConfig,
    handleLoadTemplate,
    handleContactsImported,
    handleRemoveContact,
    handleClearContacts,
    insertVariable,
    handleCreateCampaign,
    stats,
  } = useCampaignBuilder({ instance, userToken, onCampaignCreated });

  return (
    <div className="w-full">
      <Tabs defaultValue="create" className="w-full">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold">Disparador em Massa</h1>
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="create" className="gap-2 flex-1 sm:flex-none">
              <PlusCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Nova Campanha</span>
              <span className="sm:hidden">Nova</span>
            </TabsTrigger>
            <TabsTrigger value="analytics" className="gap-2 flex-1 sm:flex-none">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="create">
          <Card>
            <CardHeader>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <CardTitle>Configurar Campanha</CardTitle>
                  <CardDescription>
                    Configure os detalhes da campanha de disparo em massa
                  </CardDescription>
                </div>
                <div className="w-full sm:w-auto">
                  <TemplateManager
                    userToken={userToken}
                    currentConfig={currentConfig}
                    onLoadTemplate={handleLoadTemplate}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Campaign Name */}
              <div className="space-y-2">
                <Label htmlFor="campaign-name">Nome da Campanha *</Label>
                <Input
                  id="campaign-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <Separator />

              {/* Message Sequence Editor */}
              <MessageSequenceEditor
                messages={messages}
                onChange={setMessages}
                userToken={userToken}
              />

              {/* Variáveis Padrão */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  Variáveis Disponíveis (clique para adicionar à última mensagem)
                </Label>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('nome')}>Nome</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('telefone')}>Telefone</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('data')}>Data</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('empresa')}>Empresa</Button>
                  <Button type="button" variant="outline" size="sm" onClick={() => insertVariable('saudacao')}>Saudação</Button>
                </div>
              </div>

              {/* Variáveis Customizadas dos Contatos */}
              {stats.uniqueVariables.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">
                    Variáveis Customizadas (dos contatos importados)
                  </Label>
                  <div className="flex flex-wrap gap-2">
                    {stats.uniqueVariables.map(varName => (
                      <Button
                        key={varName}
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => insertVariable(varName)}
                      >
                        {`{{${varName}}}`}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Humanization Settings */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Humanização</h3>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="delay-min">Delay Mínimo (segundos) *</Label>
                    <Input
                      id="delay-min"
                      type="number"
                      min={5}
                      max={300}
                      value={delayMin}
                      onChange={(e) => setDelayMin(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Mínimo: 5s</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="delay-max">Delay Máximo (segundos) *</Label>
                    <Input
                      id="delay-max"
                      type="number"
                      min={5}
                      max={300}
                      value={delayMax}
                      onChange={(e) => setDelayMax(Number(e.target.value))}
                    />
                    <p className="text-xs text-muted-foreground">Máximo: 300s</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="randomize"
                    checked={randomizeOrder}
                    onCheckedChange={(checked) => setRandomizeOrder(checked as boolean)}
                  />
                  <Label htmlFor="randomize" className="flex items-center gap-2 cursor-pointer">
                    <Shuffle className="h-4 w-4" />
                    Randomizar ordem dos contatos
                  </Label>
                </div>

                <Alert>
                  <Sparkles className="h-4 w-4" />
                  <AlertDescription>
                    A humanização adiciona delays variáveis entre mensagens e pode randomizar a ordem
                    para evitar detecção como automação.
                  </AlertDescription>
                </Alert>
              </div>

              {/* Contacts Import */}
              <div className="space-y-2">
                <Label>Destinatários</Label>
                <RecipientSelector
                  instance={instance}
                  userToken={userToken}
                  onContactsSelected={handleContactsImported}
                  selectedContactsCount={contacts.length}
                />

                {contacts.length > 0 && (
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      <span className="font-medium">{contacts.length} contatos importados</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setContacts([])}
                      className="text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/40"
                    >
                      Limpar
                    </Button>
                  </div>
                )}
              </div>

              <Separator />

              {/* Scheduling & Window */}
              <div className="space-y-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-primary" />
                  <h3 className="text-lg font-semibold">Agendamento e Horários</h3>
                </div>

                {/* Start Date/Time */}
                <div className="space-y-4">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="schedule"
                      checked={isScheduled}
                      onCheckedChange={(checked) => setIsScheduled(checked as boolean)}
                    />
                    <Label htmlFor="schedule" className="flex items-center gap-2 cursor-pointer font-medium">
                      <Calendar className="h-4 w-4" />
                      Agendar Início da Campanha
                    </Label>
                  </div>

                  {isScheduled && (
                    <div className="pl-6 border-l-2 ml-2">
                      <SchedulingInput
                        value={scheduledDateTime}
                        onChange={setScheduledDateTime}
                        onValidationChange={setIsSchedulingValid}
                        showSummary={true}
                      />
                    </div>
                  )}
                </div>

                {/* Sending Window */}
                <div className="space-y-4">
                  <SchedulingWindowInput
                    value={sendingWindow}
                    onChange={setSendingWindow}
                    enabled={enableWindow}
                    onEnabledChange={(enabled) => {
                      setEnableWindow(enabled);
                      if (enabled && !sendingWindow) {
                        setSendingWindow({
                          startTime: '08:00',
                          endTime: '18:00',
                          days: [1, 2, 3, 4, 5]
                        });
                      } else if (!enabled) {
                        setSendingWindow(null);
                      }
                    }}
                  />
                </div>
              </div>

              <Separator />

              {/* Contacts Summary */}
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Contatos Selecionados</h3>
                {contacts.length === 0 ? (
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Nenhum contato adicionado. Use o importador acima para adicionar contatos.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="p-4 border rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-2xl font-bold">{contacts.length} contatos</p>
                        <p className="text-sm text-muted-foreground">
                          {stats.withName} com nome • {stats.withVariables} com variáveis
                        </p>
                      </div>
                      <Button variant="outline" size="sm" onClick={handleClearContacts}>
                        Limpar Todos
                      </Button>
                    </div>

                    {detectedVariables.length > 0 && (
                      <Alert>
                        <AlertDescription>
                          <strong>Variáveis necessárias:</strong>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {detectedVariables.map(varName => (
                              <Badge key={varName} variant="secondary">
                                {`{{${varName}}}`}
                              </Badge>
                            ))}
                          </div>
                        </AlertDescription>
                      </Alert>
                    )}

                    {/* Validation Alert */}
                    {detectedVariables.length > 0 && (() => {
                      const varValidation = contactImportService.validateContactVariables(contacts, detectedVariables);

                      if (!varValidation.valid) {
                        return (
                          <Alert variant="destructive">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              <strong>{varValidation.missingVariables.length} contato(s) sem variáveis necessárias</strong>
                              <div className="mt-2 space-y-1 text-xs">
                                {varValidation.missingVariables.slice(0, 5).map((item, idx) => (
                                  <div key={idx}>
                                    {item.phone}: faltam {item.missing.map(v => `{{${v}}}`).join(', ')}
                                  </div>
                                ))}
                                {varValidation.missingVariables.length > 5 && (
                                  <div className="font-medium">
                                    ... e mais {varValidation.missingVariables.length - 5} contato(s)
                                  </div>
                                )}
                              </div>
                            </AlertDescription>
                          </Alert>
                        );
                      }

                      return (
                        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
                          <AlertCircle className="h-4 w-4 text-green-600" />
                          <AlertDescription className="text-green-800 dark:text-green-200">
                            ✅ Todos os {contacts.length} contatos possuem as variáveis necessárias
                          </AlertDescription>
                        </Alert>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateCampaign}
                  disabled={loading || contacts.length === 0 || messages.length === 0 || (isScheduled && !isSchedulingValid)}
                  className="flex-1"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Criando...
                    </>
                  ) : isScheduled ? (
                    <>
                      <Calendar className="h-4 w-4 mr-2" />
                      Agendar Campanha
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4 mr-2" />
                      Iniciar Campanha
                    </>
                  )}
                </Button>
              </div>

              {/* Estimated Time */}
              {contacts.length > 0 && (
                <Alert>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <strong>Tempo estimado:</strong>{' '}
                    {bulkCampaignService.formatDuration(
                      Math.round(((delayMin + delayMax) / 2) * contacts.length * messages.length)
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics">
          <AnalyticsDashboard userToken={userToken} />
        </TabsContent>
      </Tabs >
    </div >
  );
}
