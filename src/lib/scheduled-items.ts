/**
 * Scheduled Items - Interface unificada para mensagens e campanhas agendadas
 * 
 * Este módulo fornece uma interface unificada para trabalhar com:
 * - Mensagens únicas agendadas (localStorage)
 * - Campanhas agendadas (backend)
 */

import { DateTime } from 'luxon';
import { getScheduledMessages, ScheduledMessage } from './api';
import { bulkCampaignService, Campaign } from '@/services/bulkCampaignService';

/**
 * Interface unificada para itens agendados usando discriminated union
 */
export type ScheduledItem = ScheduledSingleMessage | ScheduledCampaign;

/**
 * Mensagem única agendada (do localStorage)
 */
export interface ScheduledSingleMessage {
  type: 'single';
  id: string;
  scheduledAt: string; // ISO string
  status: 'pending' | 'sent' | 'failed';
  instance: string;
  messageType: 'text' | 'media';
  messageContent: string;
  recipient: string; // phone number
  recipientName?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  error?: string;
}

/**
 * Campanha agendada (do backend)
 */
export interface ScheduledCampaign {
  type: 'campaign';
  id: string;
  scheduledAt: string; // ISO string
  status: 'scheduled' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed';
  instance: string;
  name: string;
  messageType: string;
  totalContacts: number;
  sentCount: number;
  failedCount: number;
  successRate?: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * Converte ScheduledMessage do localStorage para ScheduledSingleMessage
 */
function convertToScheduledSingleMessage(msg: ScheduledMessage): ScheduledSingleMessage {
  const payload = msg.payload as any;
  
  return {
    type: 'single',
    id: msg.id,
    scheduledAt: msg.scheduledAt,
    status: msg.status,
    instance: payload.instance || '',
    messageType: msg.type,
    messageContent: msg.type === 'text' ? payload.text : (payload.caption || ''),
    recipient: payload.phone || payload.to || '',
    recipientName: payload.name,
    mediaUrl: msg.type === 'media' ? payload.mediaUrl : undefined,
    mediaType: msg.type === 'media' ? payload.mediaType : undefined,
    error: msg.error,
  };
}

/**
 * Converte Campaign do backend para ScheduledCampaign
 */
function convertToScheduledCampaign(campaign: Campaign): ScheduledCampaign {
  return {
    type: 'campaign',
    id: campaign.id,
    scheduledAt: campaign.scheduledAt || campaign.createdAt,
    status: campaign.status as any,
    instance: campaign.instance,
    name: campaign.name,
    messageType: campaign.messageType,
    totalContacts: campaign.totalContacts,
    sentCount: campaign.sentCount,
    failedCount: campaign.failedCount,
    successRate: campaign.successRate,
    createdAt: campaign.createdAt,
    startedAt: campaign.startedAt,
    completedAt: campaign.completedAt,
  };
}

/**
 * Obtém todos os itens agendados (mensagens únicas + campanhas)
 * Combina dados do localStorage e do backend
 * 
 * @param userToken - Token do usuário para buscar campanhas do backend
 * @param instance - Filtrar por instância específica (opcional)
 * @returns Array de itens agendados ordenados por scheduledAt
 */
export async function getAllScheduledItems(
  userToken?: string,
  instance?: string
): Promise<ScheduledItem[]> {
  const items: ScheduledItem[] = [];

  // 1. Buscar mensagens únicas do backend
  if (userToken) {
    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
      const url = new URL(`${API_BASE_URL}/api/user/scheduled-messages`);
      
      if (instance) {
        url.searchParams.append('instance', instance);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${userToken}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const singleMessages = data.messages.map((msg: any): ScheduledSingleMessage => ({
          type: 'single',
          id: msg.id,
          scheduledAt: msg.scheduled_at,
          status: msg.status,
          instance: msg.instance,
          messageType: msg.message_type,
          messageContent: msg.message_content,
          recipient: msg.recipient,
          recipientName: msg.recipient_name,
          mediaUrl: msg.media_data ? JSON.parse(msg.media_data).url : undefined,
          mediaType: msg.media_data ? JSON.parse(msg.media_data).type : undefined,
          error: msg.error_message,
        }));
        
        items.push(...singleMessages);
      }
    } catch (error) {
      console.error('Erro ao buscar mensagens agendadas do backend:', error);
    }
  }

  // 2. Buscar campanhas agendadas do backend
  if (userToken) {
    try {
      const campaigns = await bulkCampaignService.getActiveCampaigns(instance);
      const scheduledCampaigns = campaigns
        .filter(c => c.isScheduled) // Incluir todas as campanhas agendadas, independente do status
        .map(convertToScheduledCampaign);
      
      items.push(...scheduledCampaigns);
    } catch (error) {
      console.error('Erro ao buscar campanhas agendadas do backend:', error);
    }
  }

  // 3. Filtrar por instância se especificado
  const filteredItems = instance
    ? items.filter(item => item.instance === instance)
    : items;

  // 4. Ordenar por scheduledAt (mais próximo primeiro)
  return filteredItems.sort((a, b) => {
    const dateA = DateTime.fromISO(a.scheduledAt);
    const dateB = DateTime.fromISO(b.scheduledAt);
    return dateA.toMillis() - dateB.toMillis();
  });
}

/**
 * Formata a data de agendamento para exibição
 */
export function formatScheduledDate(isoString: string): string {
  return DateTime.fromISO(isoString)
    .setZone('America/Sao_Paulo')
    .toFormat("dd/MM/yyyy 'às' HH:mm");
}

/**
 * Verifica se um item está atrasado (passou do horário agendado)
 */
export function isOverdue(scheduledAt: string): boolean {
  const scheduled = DateTime.fromISO(scheduledAt).setZone('America/Sao_Paulo');
  const now = DateTime.now().setZone('America/Sao_Paulo');
  return scheduled < now;
}

/**
 * Calcula tempo restante até o agendamento
 */
export function getTimeUntilScheduled(scheduledAt: string): string {
  const scheduled = DateTime.fromISO(scheduledAt).setZone('America/Sao_Paulo');
  const now = DateTime.now().setZone('America/Sao_Paulo');
  
  const diff = scheduled.diff(now, ['days', 'hours', 'minutes']);
  
  if (diff.days > 0) {
    return `${Math.floor(diff.days)}d ${Math.floor(diff.hours)}h`;
  }
  
  if (diff.hours > 0) {
    return `${Math.floor(diff.hours)}h ${Math.floor(diff.minutes)}m`;
  }
  
  if (diff.minutes > 0) {
    return `${Math.floor(diff.minutes)}m`;
  }
  
  return 'Agora';
}
