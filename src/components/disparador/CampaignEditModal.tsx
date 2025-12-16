/**
 * CampaignEditModal Component
 * 
 * Modal para editar configurações de campanhas pausadas ou em execução
 */

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { 
  bulkCampaignService, 
  type Campaign, 
  type CampaignConfigUpdate 
} from '@/services/bulkCampaignService';

interface CampaignEditModalProps {
  campaign: Campaign | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

const DAYS_OF_WEEK = [
  { value: 0, label: 'Dom' },
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
];

export function CampaignEditModal({
  campaign,
  open,
  onOpenChange,
  onSuccess,
}: CampaignEditModalProps) {
  const [loading, setLoading] = useState(false);
  const [delayMin, setDelayMin] = useState(5);
  const [delayMax, setDelayMax] = useState(30);
  const [useSendingWindow, setUseSendingWindow] = useState(false);
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('18:00');
  const [selectedDays, setSelectedDays] = useState<number[]>([1, 2, 3, 4, 5]);

  const [errors, setErrors] = useState<string[]>([]);

  // Reset form when campaign changes
  useEffect(() => {
    if (campaign && open) {
      // Parse campaign data - need to handle both camelCase and snake_case
      const campaignData = campaign as any;
      
      setDelayMin(campaignData.delayMin || campaignData.delay_min || 5);
      setDelayMax(campaignData.delayMax || campaignData.delay_max || 30);
      
      // Parse sending window if exists
      let sendingWindow = campaignData.sendingWindow || campaignData.sending_window;
      if (typeof sendingWindow === 'string') {
        try {
          sendingWindow = JSON.parse(sendingWindow);
        } catch {
          sendingWindow = null;
        }
      }
      
      if (sendingWindow) {
        setUseSendingWindow(true);
        setStartTime(sendingWindow.startTime || '09:00');
        setEndTime(sendingWindow.endTime || '18:00');
        setSelectedDays(sendingWindow.days || [1, 2, 3, 4, 5]);
      } else {
        setUseSendingWindow(false);
        setStartTime('09:00');
        setEndTime('18:00');
        setSelectedDays([1, 2, 3, 4, 5]);
      }
      
      setErrors([]);
    }
  }, [campaign, open]);

  const validateForm = (): boolean => {
    const newErrors: string[] = [];

    if (delayMin < 1) {
      newErrors.push('Delay mínimo deve ser pelo menos 1 segundo');
    }

    if (delayMax < 1) {
      newErrors.push('Delay máximo deve ser pelo menos 1 segundo');
    }

    if (delayMin > delayMax) {
      newErrors.push('Delay mínimo não pode ser maior que o máximo');
    }

    if (useSendingWindow) {
      const timeRegex = /^\d{2}:\d{2}$/;
      
      if (!timeRegex.test(startTime)) {
        newErrors.push('Hora de início deve estar no formato HH:mm');
      }
      
      if (!timeRegex.test(endTime)) {
        newErrors.push('Hora de fim deve estar no formato HH:mm');
      }
      
      if (selectedDays.length === 0) {
        newErrors.push('Selecione pelo menos um dia da semana');
      }
    }

    setErrors(newErrors);
    return newErrors.length === 0;
  };

  const handleDayToggle = (day: number) => {
    setSelectedDays(prev => 
      prev.includes(day) 
        ? prev.filter(d => d !== day)
        : [...prev, day].sort()
    );
  };

  const handleSubmit = async () => {
    if (!campaign || !validateForm()) {
      return;
    }

    setLoading(true);

    try {
      const updates: CampaignConfigUpdate = {
        delay_min: delayMin,
        delay_max: delayMax,
      };

      if (useSendingWindow) {
        updates.sending_window = {
          startTime,
          endTime,
          days: selectedDays,
        };
      }

      await bulkCampaignService.updateCampaignConfig(campaign.id, updates);
      
      toast.success('Configurações atualizadas com sucesso');
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      toast.error('Erro ao atualizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const canEdit = campaign && ['paused', 'running', 'scheduled'].includes(campaign.status);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Editar Campanha
          </DialogTitle>
          <DialogDescription>
            {campaign?.name} - {bulkCampaignService.getStatusLabel(campaign?.status || '')}
          </DialogDescription>
        </DialogHeader>

        {!canEdit ? (
          <div className="py-4 text-center text-muted-foreground">
            Não é possível editar campanhas com status "{campaign?.status}"
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {/* Delay Settings */}
            <div className="space-y-4">
              <h4 className="font-medium text-sm">Intervalo entre mensagens</h4>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="delayMin">Mínimo (segundos)</Label>
                  <Input
                    id="delayMin"
                    type="number"
                    min={1}
                    max={300}
                    value={delayMin}
                    onChange={(e) => setDelayMin(parseInt(e.target.value) || 1)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="delayMax">Máximo (segundos)</Label>
                  <Input
                    id="delayMax"
                    type="number"
                    min={1}
                    max={300}
                    value={delayMax}
                    onChange={(e) => setDelayMax(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>
            </div>

            {/* Sending Window Settings */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="useSendingWindow"
                  checked={useSendingWindow}
                  onCheckedChange={(checked) => setUseSendingWindow(checked === true)}
                />
                <Label htmlFor="useSendingWindow" className="font-medium text-sm">
                  Janela de envio
                </Label>
              </div>

              {useSendingWindow && (
                <div className="space-y-4 pl-6 border-l-2 border-muted">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="startTime">Início</Label>
                      <Input
                        id="startTime"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="endTime">Fim</Label>
                      <Input
                        id="endTime"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Dias da semana</Label>
                    <div className="flex flex-wrap gap-2">
                      {DAYS_OF_WEEK.map((day) => (
                        <Button
                          key={day.value}
                          type="button"
                          variant={selectedDays.includes(day.value) ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => handleDayToggle(day.value)}
                          className="w-10"
                        >
                          {day.label}
                        </Button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Validation Errors */}
            {errors.length > 0 && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md space-y-1">
                {errors.map((error, index) => (
                  <p key={index}>• {error}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          {canEdit && (
            <Button onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar'
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
