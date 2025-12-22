import { toast } from "sonner";
import { DateTime } from "luxon";
import {
  ApiResponse,
  CreateInstancePayload,
  Instance,
  PresencePayload,
  QRCodeResponse,
  TypebotConfig,
  TypebotStartPayload,
  WebhookConfig,
  WebhookEventType,
  License,
} from "./types";
import { WuzAPIClient } from './wuzapi-client';
import { SendTextMessagePayload, SendMediaMessagePayload, WuzAPIMessageResponse, WuzAPIWebhookConfig } from './wuzapi-types';
import { supabase } from '@/lib/supabase';

// Interfaces para OpenAI
interface OpenAICredential {
  id: string;
  name: string;
  apiKey: string;
}

interface Chatbot {
  id: string;
  name: string;
  prompt: string;
  temperature: number;
  maxTokens: number;
  model: string;
  status: string;
  remoteJid?: string;
}

interface BehaviorSettings {
  rejectCall: boolean;
  msgCall: string;
  groupsIgnore: boolean;
  alwaysOnline: boolean;
  readMessages: boolean;
  syncFullHistory: boolean;
  readStatus: boolean;
}

// API agora usa proxy do backend - não precisa mais de URL externa

// Helper to get API key from localStorage
export const getApiKey = (): string => {
  return localStorage.getItem("wuzapi_key") || "";
};

// Helper to set API key in localStorage
export const setApiKey = (apiKey: string): void => {
  localStorage.setItem("wuzapi_key", apiKey);
};

// API URL não é mais necessária - backend faz proxy

// Helper to clear API credentials when logging out
export const clearApiCredentials = (): void => {
  localStorage.removeItem("wuzapi_key");
  clearCsrfToken();
};

// CSRF Token management
let csrfToken: string | null = null;

// Get CSRF token from server
export const getCsrfToken = async (forceRefresh = false): Promise<string> => {
  // Return cached token if available and not forcing refresh
  if (csrfToken && !forceRefresh) {
    return csrfToken;
  }

  try {
    const response = await fetch('/api/auth/csrf-token', {
      credentials: 'include'
    });
    
    if (response.ok) {
      const data = await response.json();
      csrfToken = data.csrfToken;
      return csrfToken;
    }
  } catch (error) {
    console.error('Failed to get CSRF token:', error);
  }
  
  return '';
};

// Clear CSRF token (call on logout or on CSRF error)
export const clearCsrfToken = (): void => {
  csrfToken = null;
};

// Base fetch with session-based authentication and CSRF retry
const apiFetch = async <T>(
  endpoint: string,
  options: RequestInit = {},
  retryOnCsrf = true
): Promise<ApiResponse<T>> => {
  // Usar URL relativa - o backend cuida do proxy
  const url = `/api${endpoint}`;

  // Get CSRF token for non-GET requests
  const token = (options.method && options.method !== 'GET') 
    ? await getCsrfToken() 
    : '';

  const headers = {
    "Content-Type": "application/json",
    ...(token && { 'CSRF-Token': token }),
    ...options.headers,
  };

  try {
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.debug(`[API] ${options.method || "GET"} ${url}`);
    }
    
    const response = await fetch(url, {
      ...options,
      headers,
      credentials: 'include' // IMPORTANTE: Envia cookies de sessão
    });

    // Handle CSRF token errors with automatic retry
    if (response.status === 403 && retryOnCsrf) {
      const errorData = await response.json();
      if (errorData.code === 'CSRF_VALIDATION_FAILED') {
        // Clear cached token and retry with fresh token
        clearCsrfToken();
        if (import.meta.env.DEV) {
          console.debug('[API] CSRF token expired, refreshing and retrying...');
        }
        return apiFetch<T>(endpoint, options, false); // Retry once without CSRF retry
      }
      return {
        status: response.status,
        error: errorData.error || `Error: ${response.statusText}`,
        response: errorData.response,
      };
    }

    if (!response.ok) {
      const errorData = await response.json();
      // Log errors in development only, without sensitive data
      if (import.meta.env.DEV) {
        console.error("[API] Error:", response.status, errorData.error);
      }
      return {
        status: response.status,
        error: errorData.error || `Error: ${response.statusText}`,
        response: errorData.response,
      };
    }

    const data = await response.json();
    return { response: data };
  } catch (error) {
    // Log errors in development only
    if (import.meta.env.DEV) {
      console.error("[API] Request failed:", error instanceof Error ? error.message : "Unknown error");
    }
    return {
      status: 500,
      error: error instanceof Error ? error.message : "Unknown error occurred",
    };
  }
};

// API Functions
export const fetchInstances = async (): Promise<Instance[]> => {
  try {
    const client = getWuzAPIClient();
    const usersResponse = await client.listUsers();
    
    if (!usersResponse.success || !usersResponse.data) {
      console.error("Erro ao buscar usuários WuzAPI:", usersResponse.error);
      return [];
    }

    // Mapear usuários WuzAPI para formato de instâncias
    const instances: Instance[] = usersResponse.data.map(user => ({
      id: user.phone, // Usar phone como ID único
      name: user.name,
      connectionStatus: user.status === 'connected' ? 'open' : 'close',
      ownerJid: user.phone + '@s.whatsapp.net',
      integration: 'WUZAPI',
      token: user.token,
      phoneNumber: user.phone,
      createdAt: user.created_at,
      updatedAt: user.updated_at
    }));

    return instances;
  } catch (error) {
    console.error("Erro ao buscar instâncias:", error);
    return [];
  }
};

export const createInstance = async (
  payload: CreateInstancePayload
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Mapear payload para formato WuzAPI
    const createUserPayload = {
      phone: payload.phoneNumber || '',
      name: payload.instanceName,
      webhook: '', // WuzAPI usa webhook simples
      webhook_message: payload.webhook_by_events || false
    };

    const response = await client.createUser(createUserPayload);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao criar usuário WuzAPI'
      };
    }

    return {
      status: 200,
      response: {
        instance: {
          instanceName: response.data?.name,
          phone: response.data?.phone,
          status: response.data?.status
        }
      }
    };
  } catch (error) {
    console.error("Erro ao criar instância:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const connectInstance = async (
  instanceName: string
): Promise<ApiResponse<QRCodeResponse>> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome para obter o phone
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.getUserQRCode(user.phone);
     
     if (!response.success) {
       return {
         status: 400,
         error: response.error || 'Erro ao conectar usuário'
       };
     }

     return {
       status: 200,
       response: {
         qrcode: response.data?.qr_code || '',
         base64: response.data?.qr_code || ''
       }
     };
  } catch (error) {
    console.error("Erro ao conectar instância:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const restartInstance = async (
  instanceName: string
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    // Desconectar e reconectar
    await client.disconnectUser(user.phone);
    const response = await client.connectUser(user.phone);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao reiniciar usuário'
      };
    }

    return {
      status: 200,
      response: { message: 'Instância reiniciada com sucesso' }
    };
  } catch (error) {
    console.error("Erro ao reiniciar instância:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const setPresence = async (
  instanceName: string,
  payload: PresencePayload
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.setPresence(payload, user.token);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao definir presença'
      };
    }

    return {
      status: 200,
      response: { message: 'Presença definida com sucesso' }
    };
  } catch (error) {
    console.error("Erro ao definir presença:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const getConnectionState = async (
  instanceName: string
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.getUserStatus(user.phone);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao obter status'
      };
    }

    return {
      status: 200,
      response: {
        instance: {
          instanceName: user.name,
          state: response.data?.status || 'disconnected'
        }
      }
    };
  } catch (error) {
    console.error("Erro ao obter estado da conexão:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const logoutInstance = async (
  instanceName: string
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.disconnectUser(user.phone);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao desconectar usuário'
      };
    }

    return {
      status: 200,
      response: { message: 'Usuário desconectado com sucesso' }
    };
  } catch (error) {
    console.error("Erro ao desconectar instância:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const deleteInstance = async (
  instanceName: string
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.deleteUser(user.phone);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao deletar usuário'
      };
    }

    return {
      status: 200,
      response: { message: 'Usuário deletado com sucesso' }
    };
  } catch (error) {
    console.error("Erro ao deletar instância:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const getQRCode = async (
  instanceName: string
): Promise<ApiResponse<QRCodeResponse>> => {
  try {
    const client = getWuzAPIClient();
    
    // Buscar usuário pelo nome
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data) {
      return {
        status: 400,
        error: 'Erro ao buscar usuários'
      };
    }

    const user = usersResponse.data.find(u => u.name === instanceName);
    if (!user) {
      return {
        status: 404,
        error: `Usuário ${instanceName} não encontrado`
      };
    }

    const response = await client.getUserQRCode(user.phone);
    
    if (!response.success) {
      return {
        status: 400,
        error: response.error || 'Erro ao obter QR code'
      };
    }

    return {
      status: 200,
      response: {
        qrcode: response.data?.qr_code || '',
        base64: response.data?.qr_code || ''
      }
    };
  } catch (error) {
    console.error("Erro ao obter QR code:", error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

// Typebot API Functions
export const createTypebot = async (
  instance: string,
  config: TypebotConfig
): Promise<ApiResponse> => {
  return await apiFetch(`/typebot/create/${instance}`, {
    method: "POST",
    body: JSON.stringify(config),
  });
};

export const findTypebot = async (
  instance: string
): Promise<ApiResponse<TypebotConfig[]>> => {
  return await apiFetch(`/typebot/find/${instance}`, {
    method: "GET",
  });
};

export const fetchTypebot = async (
  instance: string,
  typebotId: string
): Promise<ApiResponse<TypebotConfig>> => {
  return await apiFetch(`/typebot/fetch/${typebotId}/${instance}`, {
    method: "GET",
  });
};

export const updateTypebot = async (
  instance: string,
  typebotId: string,
  config: TypebotConfig
): Promise<ApiResponse> => {
  return await apiFetch(`/typebot/update/${typebotId}/${instance}`, {
    method: "PUT",
    body: JSON.stringify(config),
  });
};

export const deleteTypebot = async (
  instance: string,
  typebotId: string
): Promise<ApiResponse> => {
  return await apiFetch(`/typebot/delete/${typebotId}/${instance}`, {
    method: "DELETE",
  });
};

export const startTypebot = async (
  instance: string,
  payload: TypebotStartPayload
): Promise<ApiResponse> => {
  return await apiFetch(`/typebot/start/${instance}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
};

export const findAllTypebots = async (
  instance: string
): Promise<ApiResponse<TypebotConfig[]>> => {
  return await apiFetch(`/typebot/find-all/${instance}`, {
    method: "GET",
  });
};

// Webhook API Functions - Migrated to WuzAPI

// Função para mapear configuração Evolution API para WuzAPI
const mapEvolutionWebhookToWuzAPI = (evolutionWebhook: WebhookConfig): WuzAPIWebhookConfig => {
  // Mapear eventos Evolution API para eventos WuzAPI
  const events: WuzAPIWebhookConfig['events'] = {};
  
  if (evolutionWebhook.events.includes('MESSAGES_UPSERT') || evolutionWebhook.events.includes('SEND_MESSAGE')) {
    events.message = true;
  }
  if (evolutionWebhook.events.includes('CONNECTION_UPDATE')) {
    events.connect = true;
    events.disconnect = true;
  }
  if (evolutionWebhook.events.includes('MESSAGES_UPSERT')) {
    events.received = true;
  }
  if (evolutionWebhook.events.includes('SEND_MESSAGE')) {
    events.sent = true;
  }
  if (evolutionWebhook.events.includes('MESSAGES_UPDATE')) {
    events.ack = true;
  }
  if (evolutionWebhook.events.includes('PRESENCE_UPDATE')) {
    events.typing = true;
    events.presence = true;
  }
  if (evolutionWebhook.events.includes('GROUPS_UPSERT') || evolutionWebhook.events.includes('GROUP_UPDATE')) {
    events.group = true;
  }
  if (evolutionWebhook.events.includes('CALL')) {
    events.call = true;
  }

  return {
    url: evolutionWebhook.url,
    events
  };
};

// Função para mapear configuração WuzAPI para Evolution API
const mapWuzAPIWebhookToEvolution = (wuzapiWebhook: WuzAPIWebhookConfig): WebhookConfig => {
  const events: WebhookEventType[] = [];
  
  if (wuzapiWebhook.events.message) {
    events.push('MESSAGES_UPSERT', 'SEND_MESSAGE');
  }
  if (wuzapiWebhook.events.connect || wuzapiWebhook.events.disconnect) {
    events.push('CONNECTION_UPDATE');
  }
  if (wuzapiWebhook.events.received) {
    events.push('MESSAGES_UPSERT');
  }
  if (wuzapiWebhook.events.sent) {
    events.push('SEND_MESSAGE');
  }
  if (wuzapiWebhook.events.ack) {
    events.push('MESSAGES_UPDATE');
  }
  if (wuzapiWebhook.events.typing || wuzapiWebhook.events.presence) {
    events.push('PRESENCE_UPDATE');
  }
  if (wuzapiWebhook.events.group) {
    events.push('GROUPS_UPSERT', 'GROUP_UPDATE');
  }
  if (wuzapiWebhook.events.call) {
    events.push('CALL');
  }

  return {
    enabled: true,
    url: wuzapiWebhook.url,
    headers: {
      'Content-Type': 'application/json'
    },
    byEvents: true,
    base64: false,
    events: events.length > 0 ? events : ['MESSAGES_UPSERT'] // Default event
  };
};

export const setWebhook = async (
  instance: string,
  config: { webhook: WebhookConfig }
): Promise<ApiResponse> => {
  try {
    const client = getWuzAPIClient();
    
    // Mapear configuração Evolution API para WuzAPI
    const wuzapiConfig = mapEvolutionWebhookToWuzAPI(config.webhook);
    
    // Obter primeiro usuário disponível (similar ao sendText/sendMedia)
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data || usersResponse.data.length === 0) {
      return {
        error: "Nenhum usuário WuzAPI disponível para configurar webhook",
        status: 400
      };
    }
    
    const userPhone = usersResponse.data[0].phone;
    const response = await client.setWebhook(wuzapiConfig, userPhone);
    
    if (response.success) {
      return {
        status: 200,
        response: { message: "Webhook configurado com sucesso" }
      };
    } else {
      return {
        error: response.error || "Erro ao configurar webhook",
        status: response.code || 500
      };
    }
  } catch (error) {
    console.error("Erro ao configurar webhook:", error);
    return {
      error: error instanceof Error ? error.message : "Erro desconhecido ao configurar webhook",
      status: 500
    };
  }
};

export const findWebhook = async (
  instance: string
): Promise<ApiResponse<{ webhook: WebhookConfig }>> => {
  try {
    const client = getWuzAPIClient();
    
    // Obter primeiro usuário disponível
    const usersResponse = await client.listUsers();
    if (!usersResponse.success || !usersResponse.data || usersResponse.data.length === 0) {
      return {
        error: "Nenhum usuário WuzAPI disponível para buscar webhook",
        status: 400
      };
    }
    
    const userPhone = usersResponse.data[0].phone;
    const response = await client.getWebhook(userPhone);
    
    if (response.success && response.data) {
      // Mapear resposta WuzAPI para formato Evolution API
      const evolutionWebhook = mapWuzAPIWebhookToEvolution(response.data);
      return {
        status: 200,
        response: { webhook: evolutionWebhook }
      };
    } else {
      return {
        error: response.error || "Erro ao buscar webhook",
        status: response.code || 500
      };
    }
  } catch (error) {
    console.error("Erro ao buscar webhook:", error);
    return {
      error: error instanceof Error ? error.message : "Erro desconhecido ao buscar webhook",
      status: 500
    };
  }
};

// OpenAI API Functions
export const findOpenAICredentials = async (
  instance: string
): Promise<ApiResponse<OpenAICredential[]>> => {
  return await apiFetch(`/openai/creds/${instance}`, {
    method: "GET",
  });
};

export const findOpenAICredentialById = async (
  instance: string,
  credentialId: string
): Promise<ApiResponse<OpenAICredential>> => {
  const response = await findOpenAICredentials(instance);

  if (response.error) {
    return { status: response.status, error: response.error };
  }

  const credentials = response.response || [];
  const credential = credentials.find(
    (cred: OpenAICredential) => cred.id === credentialId
  );

  if (!credential) {
    return { status: 404, error: "Credential not found" };
  }

  return { status: 200, response: credential };
};

export const createOpenAICredential = async (
  instance: string,
  credential: { name: string; apiKey: string }
): Promise<ApiResponse> => {
  return await apiFetch(`/openai/creds/${instance}`, {
    method: "POST",
    body: JSON.stringify(credential),
  });
};

export const updateOpenAICredential = async (
  instance: string,
  credentialId: string,
  credential: { name: string; apiKey: string }
): Promise<ApiResponse> => {
  // Corrected endpoint format
  return await apiFetch(`/openai/creds/${credentialId}/${instance}`, {
    method: "PUT",
    body: JSON.stringify(credential),
  });
};

export const deleteOpenAICredential = async (
  instance: string,
  credentialId: string
): Promise<ApiResponse> => {
  // Corrected endpoint format
  return await apiFetch(`/openai/creds/${credentialId}/${instance}`, {
    method: "DELETE",
  });
};

// Chatbot API Functions
export const findChatbots = async (
  instance: string
): Promise<ApiResponse<Chatbot[]>> => {
  return await apiFetch(`/openai/find/${instance}`, {
    method: "GET",
  });
};

export const findChatbotById = async (
  instance: string,
  chatbotId: string
): Promise<ApiResponse<Chatbot>> => {
  const response = await findChatbots(instance);

  if (response.error) {
    return { status: response.status, error: response.error };
  }

  const chatbots = response.response || [];
  const chatbot = chatbots.find((bot: Chatbot) => bot.id === chatbotId);

  if (!chatbot) {
    return { status: 404, error: "Chatbot not found" };
  }

  return { status: 200, response: chatbot };
};

export const createChatbot = async (
  instance: string,
  chatbot: Omit<Chatbot, "id">
): Promise<ApiResponse> => {
  return await apiFetch(`/openai/create/${instance}`, {
    method: "POST",
    body: JSON.stringify(chatbot),
  });
};

export const updateChatbot = async (
  instance: string,
  chatbotId: string,
  chatbot: Partial<Omit<Chatbot, "id">>
): Promise<ApiResponse> => {
  return await apiFetch(`/openai/update/${chatbotId}/${instance}`, {
    method: "PUT",
    body: JSON.stringify(chatbot),
  });
};

export const deleteChatbot = async (
  instance: string,
  chatbotId: string
): Promise<ApiResponse> => {
  // Updated endpoint format to match the API structure
  return await apiFetch(`/openai/delete/${chatbotId}/${instance}`, {
    method: "DELETE",
  });
};

export const changeChatbotStatus = async (
  instance: string,
  chatbotId: string,
  status: { status: string; remoteJid: string }
): Promise<ApiResponse> => {
  return await apiFetch(`/openai/changeStatus/${instance}`, {
    method: "POST",
    body: JSON.stringify({
      ...status,
      chatbotId,
    }),
  });
};

// Behavior Settings API Functions
export const findBehaviorSettings = async (
  instance: string
): Promise<ApiResponse<BehaviorSettings>> => {
  return await apiFetch(`/settings/find/${instance}`, {
    method: "GET",
  });
};

export const setBehaviorSettings = async (
  instance: string,
  settings: {
    rejectCall: boolean;
    msgCall: string;
    groupsIgnore: boolean;
    alwaysOnline: boolean;
    readMessages: boolean;
    syncFullHistory: boolean;
    readStatus: boolean;
  }
): Promise<ApiResponse> => {
  return await apiFetch(`/settings/set/${instance}`, {
    method: "POST",
    body: JSON.stringify(settings),
  });
};

// Sender API Functions
export interface SendTextPayload {
  number: string;
  text: string;
  delay?: number;
  scheduledAt?: string; // ISO string para agendamento
  quoted?: {
    key?: {
      id: string;
    };
    message?: {
      conversation: string;
    };
  };
  linkPreview?: boolean;
  mentionsEveryOne?: boolean;
  mentioned?: string[];
}

export interface SendMediaPayload {
  number: string;
  mediatype: "image" | "video" | "document";
  mimetype: string;
  caption: string;
  media: string;
  fileName: string;
  delay?: number;
  scheduledAt?: string; // ISO string para agendamento
  quoted?: {
    key?: {
      id: string;
    };
    message?: {
      conversation: string;
    };
  };
  mentionsEveryOne?: boolean;
  mentioned?: string[];
}

export interface MessageResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  pushName: string;
  status: string;
  message: Record<string, unknown>;
  contextInfo: Record<string, unknown> | null;
  messageType: string;
  messageTimestamp: number;
  instanceId: string;
  source: string;
}

// ============================================================================
// FUNÇÕES DE ENVIO DE MENSAGENS - WUZAPI
// ============================================================================

// Instância global do WuzAPIClient
let wuzapiClient: WuzAPIClient | null = null;

// Helper para obter instância do WuzAPIClient
const getWuzAPIClient = (): WuzAPIClient => {
  if (!wuzapiClient) {
    // Backend faz proxy - não precisa mais de baseUrl ou adminToken no frontend
    wuzapiClient = new WuzAPIClient({
      baseUrl: '/api/wuzapi',
      adminToken: '' // Token gerenciado via sessão no backend
    });
  }
  return wuzapiClient;
};

// Função para mapear payload Evolution API para WuzAPI
const mapTextPayloadToWuzAPI = (payload: SendTextPayload): SendTextMessagePayload => {
  return {
    Phone: payload.number,
    Body: payload.text,
    isGroup: payload.number.includes('@g.us') || (payload.number.includes('-') && payload.number.length > 15)
  };
};

// Função para mapear payload de mídia Evolution API para WuzAPI
const mapMediaPayloadToWuzAPI = (payload: SendMediaPayload): SendMediaMessagePayload => {
  const result: SendMediaMessagePayload = {
    Phone: payload.number,
    Caption: payload.caption,
    FileName: payload.fileName,
    isGroup: payload.number.includes('@g.us') || (payload.number.includes('-') && payload.number.length > 15)
  };

  // Mapear o campo de mídia baseado no tipo
  switch (payload.mediatype) {
    case 'image':
      result.Image = payload.media;
      break;
    case 'video':
      result.Video = payload.media;
      break;
    case 'document':
      result.Document = payload.media;
      break;
    default:
      result.Document = payload.media;
  }

  return result;
};

// Função para mapear resposta WuzAPI para formato Evolution API
const mapWuzAPIResponseToEvolution = (wuzResponse: WuzAPIMessageResponse, originalPayload: SendTextPayload | SendMediaPayload): ApiResponse<MessageResponse> => {
  if (!wuzResponse.success || !wuzResponse.data) {
    return {
      status: 400,
      error: wuzResponse.error || 'Erro ao enviar mensagem'
    };
  }

  const message = wuzResponse.data;
  return {
    status: 200,
    response: {
      key: {
        remoteJid: message.to,
        fromMe: true,
        id: message.id
      },
      pushName: 'WuzAPI',
      status: 'sent',
      message: {},
      contextInfo: null,
      messageType: message.type,
      messageTimestamp: message.timestamp,
      instanceId: 'wuzapi',
      source: 'wuzapi'
    }
  };
};

export const sendText = async (
  instance: string,
  payload: SendTextPayload
): Promise<ApiResponse<MessageResponse>> => {
  try {
    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Enviar através do backend para evitar problemas de CORS
    const response = await fetch('/api/chat/send/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance,
        ...(csrfToken && { 'CSRF-Token': csrfToken })
      },
      credentials: 'include', // IMPORTANTE: Envia cookies de sessão
      body: JSON.stringify({
        Phone: payload.number,
        Body: payload.text
      })
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        status: response.status,
        error: error.message || 'Erro ao enviar mensagem'
      };
    }

    const data = await response.json();
    
    return {
      status: 200,
      response: {
        key: {
          remoteJid: payload.number,
          fromMe: true,
          id: data.data?.Id || ''
        },
        pushName: 'WUZAPI',
        status: 'sent',
        message: {},
        contextInfo: null,
        messageType: 'text',
        messageTimestamp: data.data?.Timestamp || Date.now(),
        instanceId: 'wuzapi',
        source: 'wuzapi'
      }
    };
  } catch (error) {
    console.error('Erro ao enviar texto:', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

export const sendMedia = async (
  instance: string,
  payload: SendMediaPayload
): Promise<ApiResponse<MessageResponse>> => {
  try {
    // Determinar o endpoint baseado no tipo de mídia
    let endpoint = '/api/chat/send/image';
    const body: any = {
      Phone: payload.number,
      Caption: payload.caption,
      FileName: payload.fileName
    };

    switch (payload.mediatype) {
      case 'image':
        endpoint = '/api/chat/send/image';
        body.Image = payload.media;
        break;
      case 'video':
        endpoint = '/api/chat/send/video';
        body.Video = payload.media;
        break;
      case 'document':
        endpoint = '/api/chat/send/document';
        body.Document = payload.media;
        break;
      default:
        endpoint = '/api/chat/send/image';
        body.Image = payload.media;
    }

    // Get CSRF token
    const csrfToken = await getCsrfToken();
    
    // Enviar através do backend para evitar problemas de CORS
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'token': instance,
        ...(csrfToken && { 'CSRF-Token': csrfToken })
      },
      credentials: 'include', // IMPORTANTE: Envia cookies de sessão
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const error = await response.json();
      return {
        status: response.status,
        error: error.message || 'Erro ao enviar mídia'
      };
    }

    const data = await response.json();
    
    return {
      status: 200,
      response: {
        key: {
          remoteJid: payload.number,
          fromMe: true,
          id: data.data?.Id || ''
        },
        pushName: 'WUZAPI',
        status: 'sent',
        message: {},
        contextInfo: null,
        messageType: payload.mediatype,
        messageTimestamp: data.data?.Timestamp || Date.now(),
        instanceId: 'wuzapi',
        source: 'wuzapi'
      }
    };
  } catch (error) {
    console.error('Erro ao enviar mídia:', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

// Bulk Messaging Helper Functions
export const parseCsvContacts = (
  csvContent: string
): { number: string; [key: string]: string }[] => {
  try {
    // Função auxiliar para parsear uma linha CSV considerando campos com aspas
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = [];
      let current = "";
      let insideQuotes = false;

      for (let i = 0; i < line.length; i++) {
        const char = line[i];

        if (char === '"') {
          // Toggle estado de "dentro de aspas"
          insideQuotes = !insideQuotes;
        } else if (char === "," && !insideQuotes) {
          // Vírgula fora de aspas é um separador
          result.push(current.trim());
          current = "";
        } else {
          // Adicionar caractere ao campo atual
          current += char;
        }
      }

      // Adicionar o último campo
      result.push(current.trim());
      return result;
    };

    // Verificar se o conteúdo CSV tem aspas nas mensagens, caso não tenha, adicioná-las
    let fixedCsvContent = csvContent;

    // Identificar as linhas
    const lines = fixedCsvContent.split("\n");

    // Extrair cabeçalhos
    const headers = parseCSVLine(lines[0]);

    // Encontrar o índice da coluna 'mensagem'
    const msgIndex = headers.findIndex((h) => h.trim() === "mensagem");

    // Verificar se o conteúdo precisa ser corrigido
    if (msgIndex !== -1) {
      // Criar linhas corrigidas
      const fixedLines = [lines[0]]; // Primeiro os cabeçalhos

      // Para cada linha de dados
      for (let i = 1; i < lines.length; i++) {
        if (lines[i].trim() === "") continue;

        // Dividir a linha nos primeiros N campos (onde N é o índice da coluna mensagem + 1)
        const parts = lines[i].split(",");

        if (parts.length > msgIndex + 1) {
          // Os primeiros campos (exceto mensagem)
          const firstParts = parts.slice(0, msgIndex).join(",");
          // O campo de mensagem e tudo que vier depois (potencialmente com vírgulas)
          const messageAndRest = parts.slice(msgIndex).join(",");

          // Se a mensagem não estiver entre aspas, colocá-la
          let fixedMessage = messageAndRest;
          if (
            !messageAndRest.startsWith('"') &&
            !messageAndRest.endsWith('"')
          ) {
            fixedMessage = `"${messageAndRest}"`;
          }

          // Reconstruir a linha
          fixedLines.push(`${firstParts},${fixedMessage}`);
        } else {
          // Se a linha não tiver campos suficientes, apenas incluí-la como está
          fixedLines.push(lines[i]);
        }
      }

      // Reconstruir o CSV com as linhas corrigidas
      fixedCsvContent = fixedLines.join("\n");
    }

    // Agora realizar o parsing com o conteúdo corrigido
    const correctedLines = fixedCsvContent.split("\n");
    const correctedHeaders = parseCSVLine(correctedLines[0]);

    // Garantir que os cabeçalhos incluam 'number'
    if (!correctedHeaders.includes("number")) {
      throw new Error("CSV deve ter uma coluna 'number'");
    }

    // Analisar linhas
    const contacts = correctedLines
      .slice(1)
      .filter((line) => line.trim() !== "")
      .map((line) => {
        const values = parseCSVLine(line);
        const contact: Record<string, string> = {};

        correctedHeaders.forEach((header, index) => {
          let value = values[index] || "";
          // Remover aspas do início e fim, se presentes
          if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
          }
          contact[header] = value;
        });

        // Garantir que cada contato tenha um campo number
        if (!contact.number) {
          contact.number = ""; // Atribuir string vazia como fallback
        }

        return contact as { number: string; [key: string]: string };
      });

    return contacts;
  } catch (error) {
    console.error("Erro ao analisar CSV:", error);
    return [];
  }
};

export const getCsvTemplate = (): string => {
  return 'number,nome,data,valor,mensagem\n5511999999999,João,01/05/2024,R$ 100;00,"Olá {nome}, seu pagamento de *{valor}* vence em {data}.n/n/Entre em contato para _regularizar_ sua situação."\n5511999999991,Maria,02/05/2024,R$ 150;00,"*AVISO IMPORTANTE*n/n/Prezada {nome}, seu pagamento no valor de {valor} vence em {data}.n/Favor desconsiderar se já efetuou."';
};

export const scheduleMessage = async (
  payload: SendTextPayload | SendMediaPayload,
  type: "text" | "media",
  scheduledAt: Date,
  instance: string,
  recipientName?: string
): Promise<void> => {
  try {
    // Converter a data do JS para DateTime do Luxon, já setando o timezone de São Paulo
    const scheduledTime =
      DateTime.fromJSDate(scheduledAt).setZone("America/Sao_Paulo");

    // Enviar para o backend para agendamento
    const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || window.location.origin;
    const endpoint = type === "text" ? "/api/chat/send/text" : "/api/chat/send/image";
    
    // Mapear campos do frontend para o backend
    const requestPayload: any = {
      isScheduled: true,
      scheduledAt: scheduledTime.toISO(),
      instance,
      recipientName
    };
    
    // Para mensagens de texto
    if (type === "text" && "number" in payload && "text" in payload) {
      requestPayload.Phone = payload.number;
      requestPayload.Body = payload.text;
    }
    // Para mensagens de mídia
    else if (type === "media") {
      requestPayload.Phone = (payload as any).number;
      requestPayload.Body = (payload as any).caption || "";
      requestPayload.mediaUrl = (payload as any).media;
      requestPayload.mediaType = (payload as any).mediatype;
      requestPayload.mimeType = (payload as any).mimetype;
      requestPayload.fileName = (payload as any).fileName;
    }

    // Obter CSRF token
    const csrfToken = await getCsrfToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${instance}`, // Usar instance como token
        "CSRF-Token": csrfToken,
      },
      body: JSON.stringify(requestPayload),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Erro ao agendar mensagem");
    }

    // Disparar evento para atualizar componentes
    window.dispatchEvent(new Event("storage"));
  } catch (error) {
    console.error("Erro ao agendar mensagem:", error);
    throw error;
  }
};

// Interface para mensagens agendadas
export interface ScheduledMessage {
  id: string;
  payload: SendTextPayload | SendMediaPayload;
  type: "text" | "media";
  scheduledAt: string;
  status: "pending" | "sent" | "failed";
  error?: string;
}

// Funções para gerenciar mensagens agendadas
export const getScheduledMessages = (): ScheduledMessage[] => {
  const stored = localStorage.getItem("scheduled_messages");
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch (error) {
    console.error("Erro ao analisar mensagens agendadas:", error);
    return [];
  }
};

export const removeScheduledMessage = (id: string): void => {
  const messages = getScheduledMessages();
  const updated = messages.filter((msg) => msg.id !== id);
  localStorage.setItem("scheduled_messages", JSON.stringify(updated));

  // Disparar evento para atualizar componentes
  window.dispatchEvent(new Event("storage"));
};

export const processScheduledMessages = async (): Promise<void> => {
  const messages = getScheduledMessages();
  const now = DateTime.now().setZone("America/Sao_Paulo");
  let updated = false;

  for (const message of messages) {
    if (message.status !== "pending") continue;

    const scheduledTime = DateTime.fromISO(message.scheduledAt).setZone(
      "America/Sao_Paulo"
    );

    if (scheduledTime <= now) {
      // Hora de enviar a mensagem
      try {
        const payload = message.payload as (
          | SendTextPayload
          | SendMediaPayload
        ) & { instance?: string };
        const instance = payload.instance || "";

        if (!instance) {
          throw new Error("Instance name not provided in scheduled message");
        }

        let response;

        if (message.type === "text") {
          response = await sendText(
            instance,
            message.payload as SendTextPayload
          );
        } else {
          response = await sendMedia(
            instance,
            message.payload as SendMediaPayload
          );
        }

        // Atualizar status da mensagem
        message.status = response.error ? "failed" : "sent";
        if (response.error) {
          message.error = response.error;
        }

        updated = true;
      } catch (error) {
        console.error("Erro ao processar mensagem agendada:", error);
        message.status = "failed";
        message.error =
          error instanceof Error ? error.message : "Erro desconhecido";
        updated = true;
      }
    }
  }

  if (updated) {
    localStorage.setItem("scheduled_messages", JSON.stringify(messages));
    window.dispatchEvent(new Event("storage"));
  }
};

// Atualizar a função initScheduledMessageProcessor para usar Luxon
export const initScheduledMessageProcessor = (): number => {
  // Iniciar um intervalo para verificar mensagens agendadas a cada 30 segundos
  const intervalId = window.setInterval(async () => {
    // Para fins de depuração
    console.log(
      "Verificando mensagens agendadas em:",
      DateTime.now().setZone("America/Sao_Paulo").toFormat("HH:mm:ss")
    );

    try {
      await processScheduledMessages();
    } catch (error) {
      console.error("Erro ao processar mensagens agendadas:", error);
    }
  }, 30000); // 30 segundos

  // Executar imediatamente na inicialização
  setTimeout(async () => {
    try {
      await processScheduledMessages();
    } catch (error) {
      console.error("Erro ao processar mensagens agendadas (inicial):", error);
    }
  }, 1000);

  return intervalId;
};

// Formatar data para exibição no timezone de São Paulo
export const formatScheduledDateBR = (isoString: string): string => {
  // Usar Luxon para formatar o ISO string no formato brasileiro
  return DateTime.fromISO(isoString)
    .setZone("America/Sao_Paulo")
    .setLocale("pt-BR")
    .toFormat("dd/MM/yyyy HH:mm");
};

export interface ContactInfo {
  pushname?: string;
  number: string;
  name?: string;
  businessProfile?: {
    description?: string;
    email?: string;
    websites?: string[];
    address?: string;
    latitude?: number;
    longitude?: number;
    profilePictureUrl?: string;
  };
  isGroup?: boolean;
  // Outros campos que possam ser retornados pela API
}

// Cache para informações de contato (5 minutos)
const contactInfoCache = new Map<string, { data: ApiResponse<ContactInfo>; timestamp: number }>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos em ms

/**
 * Limpa entradas expiradas do cache
 */
const cleanExpiredCache = () => {
  const now = Date.now();
  for (const [key, value] of contactInfoCache.entries()) {
    if (now - value.timestamp > CACHE_DURATION) {
      contactInfoCache.delete(key);
    }
  }
};

/**
 * Obtém informações de um contato do WhatsApp com timeout e caching
 * @param instance Nome da instância
 * @param phoneNumber Número do telefone (com código do país)
 * @param timeout Timeout em ms (padrão: 5000ms)
 * @returns Informações do contato, incluindo pushname
 */
export const getContactInfo = async (
  instance: string,
  phoneNumber: string,
  timeout = 5000
): Promise<ApiResponse<ContactInfo>> => {
  try {
    // Garantir que o número esteja formatado corretamente (com código do país)
    let formattedNumber = phoneNumber;
    if (!phoneNumber.includes("@")) {
      // Remover caracteres não numéricos
      formattedNumber = phoneNumber.replace(/\D/g, "");
      // Adicionar o código do país se não existir
      if (!formattedNumber.startsWith("55") && formattedNumber.length < 13) {
        formattedNumber = `55${formattedNumber}`;
      }
    }

    // Verificar cache
    const cacheKey = `${instance}:${formattedNumber}`;
    const cached = contactInfoCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return cached.data;
    }

    // Limpar cache expirado periodicamente
    if (contactInfoCache.size > 100) {
      cleanExpiredCache();
    }

    // Criar AbortController para timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      // Get CSRF token
      const csrfToken = await getCsrfToken();
      
      // Usar proxy do backend
      const response = await fetch('/api/wuzapi/user/check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'token': instance,
          ...(csrfToken && { 'CSRF-Token': csrfToken })
        },
        credentials: 'include', // IMPORTANTE: Envia cookies de sessão
        body: JSON.stringify({
          Phone: [formattedNumber]  // API espera um array
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const result = {
          status: response.status,
          error: 'Erro ao verificar número'
        };
        // Não cachear erros de servidor
        return result;
      }

      const data = await response.json();
      
      // A API retorna um array de usuários verificados
      if (data.success && data.data?.Users && data.data.Users.length > 0) {
        const user = data.data.Users[0];
        const result = {
          status: 200,
          response: {
            exists: user.IsInWhatsapp || false,
            jid: user.JID || '',
            name: user.VerifiedName || '',
            pushname: user.VerifiedName || '',
            profilePictureUrl: ''
          }
        };
        
        // Cachear resultado positivo
        contactInfoCache.set(cacheKey, { data: result, timestamp: Date.now() });
        return result;
      }

      const result = {
        status: 404,
        error: 'Número não encontrado no WhatsApp'
      };
      
      // Cachear resultado negativo também (para evitar verificações repetidas)
      contactInfoCache.set(cacheKey, { data: result, timestamp: Date.now() });
      return result;
    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      // Verificar se foi timeout
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        return {
          status: 408,
          error: 'Timeout ao verificar número (5s)'
        };
      }
      
      throw fetchError;
    }
  } catch (error) {
    console.error('Erro ao verificar contato:', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};

// Group interfaces
export interface Group {
  id: string;
  subject: string;
  subjectOwner: string;
  subjectTime: number;
  pictureUrl: string | null;
  size: number;
  creation: number;
  owner: string;
  desc: string;
  descId: string;
  restrict: boolean;
  announce: boolean;
  isCommunity: boolean;
  isCommunityAnnounce: boolean;
}

export const fetchGroups = async (
  instance: string
): Promise<ApiResponse<Group[]>> => {
  try {
    // Usar proxy do backend
    const response = await fetch('/api/wuzapi/group/list', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'token': instance
      },
      credentials: 'include' // IMPORTANTE: Envia cookies de sessão
    });

    if (!response.ok) {
      return {
        status: response.status,
        error: 'Erro ao buscar grupos'
      };
    }

    const data = await response.json();
    
    if (data.success && data.data?.Groups) {
      const groups: Group[] = data.data.Groups.map((g: any) => ({
        id: g.JID || '',
        subject: g.Name || '',
        subjectOwner: g.OwnerJID || '',
        subjectTime: 0,
        pictureUrl: null,
        size: g.Participants?.length || 0,
        creation: new Date(g.GroupCreated).getTime() || 0,
        owner: g.OwnerJID || '',
        desc: g.Topic || '',
        descId: g.TopicID || '',
        restrict: g.IsLocked || false,
        announce: g.IsAnnounce || false,
        isCommunity: false,
        isCommunityAnnounce: false
      }));

      return {
        status: 200,
        response: groups
      };
    }

    return {
      status: 200,
      response: []
    };
  } catch (error) {
    console.error('Erro ao buscar grupos:', error);
    return {
      status: 500,
      error: error instanceof Error ? error.message : 'Erro desconhecido'
    };
  }
};


// ============================================================================
// API CLIENT - Axios-like interface for admin services
// ============================================================================

interface ApiClientResponse<T> {
  data: T
  status: number
}

interface ApiClientConfig {
  data?: unknown
  headers?: Record<string, string>
}

/**
 * Helper to get Supabase JWT token for authentication
 * Uses getSession() first, falls back to localStorage if needed
 */
async function getSupabaseToken(): Promise<string | null> {
  try {
    // First try to get session from Supabase client
    const { data: { session }, error } = await supabase.auth.getSession()
    
    if (session?.access_token) {
      if (import.meta.env.DEV) {
        console.debug('[API] Got JWT token from Supabase session')
      }
      return session.access_token
    }
    
    // If no session from client, try to get from localStorage directly
    // This handles race conditions where the session isn't fully loaded yet
    const storageKey = 'supabase.auth.token'
    const storedSession = localStorage.getItem(storageKey)
    
    if (storedSession) {
      try {
        const parsed = JSON.parse(storedSession)
        const accessToken = parsed?.access_token || parsed?.currentSession?.access_token
        if (accessToken) {
          if (import.meta.env.DEV) {
            console.debug('[API] Got JWT token from localStorage fallback')
          }
          return accessToken
        }
      } catch (parseError) {
        console.warn('[API] Failed to parse stored session:', parseError)
      }
    }
    
    if (import.meta.env.DEV) {
      console.warn('[API] No JWT token available', { 
        hasSession: !!session, 
        error: error?.message,
        hasStoredSession: !!storedSession 
      })
    }
    
    return null
  } catch (error) {
    console.warn('[API] Failed to get Supabase session:', error)
    return null
  }
}

/**
 * Helper to make fetch request with CSRF token, JWT auth, and retry on CSRF failure
 */
async function fetchWithCsrf<T>(
  url: string,
  method: string,
  body?: unknown,
  config?: ApiClientConfig,
  retried = false
): Promise<ApiClientResponse<T>> {
  const csrfToken = await getCsrfToken(retried) // Force refresh on retry
  const jwtToken = await getSupabaseToken() // Get Supabase JWT token
  
  if (import.meta.env.DEV) {
    console.debug('[API] fetchWithCsrf', { 
      url, 
      method, 
      hasJwtToken: !!jwtToken,
      hasCsrfToken: !!csrfToken,
      retried 
    })
  }
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...config?.headers
  }
  
  if (csrfToken) {
    headers['CSRF-Token'] = csrfToken
  }
  
  if (jwtToken) {
    headers.Authorization = `Bearer ${jwtToken}`
  }
  
  const response = await fetch(url, {
    method,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined
  })

  const data = await response.json()
  
  // If CSRF validation failed and we haven't retried yet, refresh token and retry
  if (response.status === 403 && data?.code === 'CSRF_VALIDATION_FAILED' && !retried) {
    clearCsrfToken() // Clear the invalid token
    return fetchWithCsrf<T>(url, method, body, config, true)
  }
  
  // If 401 and no JWT token, log warning for debugging
  if (response.status === 401 && !jwtToken) {
    console.warn('[API] Request failed with 401 - No JWT token available. User may need to re-login.')
  }
  
  return { data, status: response.status }
}

/**
 * API client with axios-like interface for admin services
 * Uses session-based authentication via cookies
 */
export const api = {
  async get<T>(url: string, config?: ApiClientConfig): Promise<ApiClientResponse<T>> {
    return fetchWithCsrf<T>(url, 'GET', undefined, config)
  },

  async post<T>(url: string, body?: unknown, config?: ApiClientConfig): Promise<ApiClientResponse<T>> {
    return fetchWithCsrf<T>(url, 'POST', body, config)
  },

  async put<T>(url: string, body?: unknown, config?: ApiClientConfig): Promise<ApiClientResponse<T>> {
    return fetchWithCsrf<T>(url, 'PUT', body, config)
  },

  async delete<T>(url: string, config?: ApiClientConfig): Promise<ApiClientResponse<T>> {
    return fetchWithCsrf<T>(url, 'DELETE', config?.data, config)
  }
}
