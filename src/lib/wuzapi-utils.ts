/**
 * Utilitários para WuzAPI
 */

import { WuzAPIUser } from './wuzapi-types';

/**
 * Extrai o número de telefone do JID do WhatsApp
 * @param jid - JID no formato "55XXXXXXXXXXX:XX@s.whatsapp.net"
 * @returns Número de telefone no formato "55XXXXXXXXXXX"
 */
export function extractPhoneFromJid(jid: string): string {
  if (!jid) return '';
  
  // Remove a parte após o primeiro ':'
  const phoneWithSuffix = jid.split(':')[0];
  
  // Remove qualquer sufixo adicional após '@'
  const phone = phoneWithSuffix.split('@')[0];
  
  return phone;
}

/**
 * Tipo para dados brutos do usuário da API WuzAPI
 */
export interface RawWuzAPIUser {
  jid: string;
  name: string;
  token: string;
  connected: boolean;
  loggedIn: boolean;
  events: string[];
  webhook?: string;
  id?: string;
  webhook_message?: boolean;
  webhook_connect?: boolean;
  webhook_disconnect?: boolean;
  webhook_received?: boolean;
  webhook_sent?: boolean;
  webhook_ack?: boolean;
  webhook_typing?: boolean;
  webhook_presence?: boolean;
  webhook_chatstate?: boolean;
  webhook_group?: boolean;
  webhook_call?: boolean;
}

/**
 * Converte dados brutos da API WuzAPI para o formato esperado pelo frontend
 * @param rawUser - Dados brutos do usuário da API
 * @returns Usuário no formato WuzAPIUser
 */
export function mapRawUserToWuzAPIUser(rawUser: RawWuzAPIUser): WuzAPIUser {
  const phone = extractPhoneFromJid(rawUser.jid || '');
  
  return {
    phone,
    name: rawUser.name,
    token: rawUser.token,
    webhook: rawUser.webhook,
    webhook_message: rawUser.webhook_message,
    webhook_connect: rawUser.webhook_connect,
    webhook_disconnect: rawUser.webhook_disconnect,
    webhook_received: rawUser.webhook_received,
    webhook_sent: rawUser.webhook_sent,
    webhook_ack: rawUser.webhook_ack,
    webhook_typing: rawUser.webhook_typing,
    webhook_presence: rawUser.webhook_presence,
    webhook_chatstate: rawUser.webhook_chatstate,
    webhook_group: rawUser.webhook_group,
    webhook_call: rawUser.webhook_call,
    status: rawUser.connected ? 'connected' : 'disconnected',
    created_at: new Date().toISOString(), // Valor padrão se não fornecido
    updated_at: new Date().toISOString(), // Valor padrão se não fornecido
  };
}

/**
 * Converte array de dados brutos da API para array de WuzAPIUser
 * @param rawUsers - Array de dados brutos dos usuários
 * @returns Array de usuários no formato WuzAPIUser
 */
export function mapRawUsersToWuzAPIUsers(rawUsers: RawWuzAPIUser[]): WuzAPIUser[] {
  return rawUsers.map(mapRawUserToWuzAPIUser);
}

/**
 * Valida se um número de telefone está no formato correto
 * @param phone - Número de telefone
 * @returns true se válido, false caso contrário
 */
export function isValidPhoneNumber(phone: string): boolean {
  if (!phone) return false;
  
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Deve ter pelo menos 10 dígitos (DDD + número)
  return cleanPhone.length >= 10;
}

/**
 * Formata número de telefone para o padrão brasileiro
 * @param phone - Número de telefone
 * @returns Número formatado
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  
  // Remove caracteres não numéricos
  const cleanPhone = phone.replace(/\D/g, '');
  
  // Se não tem código do país, adiciona 55
  if (cleanPhone.length === 11 && !cleanPhone.startsWith('55')) {
    return `55${cleanPhone}`;
  }
  
  return cleanPhone;
}