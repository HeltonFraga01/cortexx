/**
 * Agent Contact Import Service
 * 
 * Serviço para importar e validar contatos para agentes
 * Adapta a funcionalidade do contactImportService para o contexto de agentes
 */

import { getAgentToken } from './agent-auth';
import { Contact } from './bulkCampaignService';
import {
  validatePhoneFormat,
  normalizePhoneNumber,
  formatPhoneDisplay as formatPhoneUtil
} from '@/lib/phone-utils';

const IS_DEVELOPMENT = import.meta.env.DEV;
const API_BASE = '';

// CSRF token cache
let csrfToken: string | null = null

async function getCsrfToken(): Promise<string | null> {
  if (csrfToken) return csrfToken
  
  try {
    const response = await fetch(`${API_BASE}/api/auth/csrf-token`, {
      credentials: 'include'
    })
    const data = await response.json()
    csrfToken = data.csrfToken
    return csrfToken
  } catch (error) {
    console.error('Failed to get CSRF token:', error)
    return null
  }
}

function getRequestOptions(): RequestInit {
  const token = getAgentToken()
  return {
    headers: token ? { 'Authorization': `Bearer ${token}` } : {}
  }
}

async function getRequestOptionsWithCsrf(): Promise<RequestInit> {
  const authToken = getAgentToken()
  const csrf = await getCsrfToken()
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (authToken) headers.Authorization = `Bearer ${authToken}`
  if (csrf) headers['CSRF-Token'] = csrf
  
  return {
    credentials: 'include' as RequestCredentials,
    headers
  }
}

// Interfaces
export interface ValidationError {
  line?: number;
  number?: string;
  phone?: string;
  reason: string;
}

export interface CSVValidationResult {
  success: boolean;
  valid: boolean;
  contacts: Contact[];
  errors: ValidationError[];
  customVariables: string[];
  summary: {
    total: number;
    valid: number;
    invalid: number;
  };
  inboxId?: string;
}

export interface ManualValidationResult {
  success: boolean;
  valid: Contact[];
  invalid: {
    number: string;
    reason: string;
    line: number;
  }[];
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
  };
  inboxId?: string;
}

export interface AgentWuzapiContact {
  phone: string;
  name?: string | null;
  variables: Record<string, string>;
  inboxId?: string;
}

class AgentContactImportService {
  private baseUrl = '/agent/contacts';

  /**
   * Importa contatos da agenda WUZAPI para agentes
   */
  async importFromWuzapi(instance: string, agentToken: string, inboxId?: string): Promise<{
    contacts: Contact[];
    total: number;
    inboxId?: string;
    inboxName?: string;
  }> {
    const options = await getRequestOptionsWithCsrf();
    
    const response = await fetch(`${API_BASE}/api${this.baseUrl}/import/wuzapi`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({
        instance,
        inboxId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Falha ao importar contatos');
    }

    // Backend retorna diretamente { success, contacts, total, inboxId, inboxName }
    // Não há wrapper 'data'
    return {
      contacts: result.contacts || [],
      total: result.total || 0,
      inboxId: result.inboxId,
      inboxName: result.inboxName
    };
  }

  /**
   * Valida arquivo CSV para agentes
   */
  async validateCSV(file: File, agentToken: string, inboxId?: string): Promise<CSVValidationResult> {
    const formData = new FormData();
    formData.append('file', file);
    
    if (inboxId) {
      formData.append('inboxId', inboxId);
    }

    const authToken = getAgentToken()
    const csrf = await getCsrfToken()
    
    const headers: Record<string, string> = {}
    if (authToken) headers.Authorization = `Bearer ${authToken}`
    if (csrf) headers['CSRF-Token'] = csrf

    const response = await fetch(`${API_BASE}/api${this.baseUrl}/import/csv`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: formData
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Falha ao validar CSV');
    }

    // Backend retorna diretamente { success, valid, contacts, errors, customVariables, summary, inboxId }
    // Não há wrapper 'data'
    return {
      success: result.success,
      valid: result.valid,
      contacts: result.contacts || [],
      errors: result.errors || [],
      customVariables: result.customVariables || [],
      summary: result.summary || { total: 0, valid: 0, invalid: 0 },
      inboxId: result.inboxId
    };
  }

  /**
   * Valida números manuais para agentes
   */
  async validateManualNumbers(numbers: string[], agentToken: string, inboxId?: string): Promise<ManualValidationResult> {
    const options = await getRequestOptionsWithCsrf();
    
    const response = await fetch(`${API_BASE}/api${this.baseUrl}/import/manual`, {
      ...options,
      method: 'POST',
      body: JSON.stringify({ 
        numbers,
        inboxId
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Falha ao validar números');
    }

    // Backend retorna diretamente { success, valid, invalid, summary, inboxId }
    // Não há wrapper 'data'
    return {
      success: result.success,
      valid: result.valid || [],
      invalid: result.invalid || [],
      summary: result.summary || { total: 0, validCount: 0, invalidCount: 0 },
      inboxId: result.inboxId
    };
  }

  /**
   * Parse CSV no cliente (para preview antes de enviar)
   */
  parseCSVFile(file: File): Promise<{ headers: string[]; rows: string[][] }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const lines = content.split('\n').filter(line => line.trim());

          if (lines.length === 0) {
            reject(new Error('Arquivo CSV vazio'));
            return;
          }

          // Parse headers
          const headers = lines[0].split(',').map(h => h.trim());

          // Parse rows
          const rows = lines.slice(1).map(line =>
            line.split(',').map(cell => cell.trim())
          );

          resolve({ headers, rows });
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = () => {
        reject(new Error('Erro ao ler arquivo'));
      };

      reader.readAsText(file);
    });
  }

  /**
   * Valida formato de número de telefone (client-side)
   * Usa as novas funções de validação do phone-utils
   */
  validatePhoneFormatLocal(phone: string): { valid: boolean; reason?: string } {
    const result = validatePhoneFormat(phone);

    if (result.isValid) {
      return { valid: true };
    } else {
      return { valid: false, reason: result.error };
    }
  }

  /**
   * Normaliza número de telefone
   * Usa as novas funções de normalização do phone-utils
   */
  normalizePhone(phone: string): string {
    return normalizePhoneNumber(phone);
  }

  /**
   * Formata número para exibição
   * Usa as novas funções de formatação do phone-utils
   */
  formatPhoneDisplay(phone: string): string {
    return formatPhoneUtil(phone);
  }

  /**
   * Parse números de texto (separados por vírgula, ponto-e-vírgula ou quebra de linha)
   */
  parseManualNumbers(text: string): string[] {
    return text
      .split(/[,;\n]/)
      .map(num => num.trim())
      .filter(num => num.length > 0);
  }

  /**
   * Valida tamanho de arquivo
   */
  validateFileSize(file: File, maxSizeMB = 5): { valid: boolean; reason?: string } {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;

    if (file.size > maxSizeBytes) {
      return {
        valid: false,
        reason: `Arquivo muito grande. Máximo: ${maxSizeMB}MB`
      };
    }

    return { valid: true };
  }

  /**
   * Valida tipo de arquivo
   */
  validateFileType(file: File): { valid: boolean; reason?: string } {
    const validTypes = ['text/csv', 'application/vnd.ms-excel'];
    const validExtensions = ['.csv'];

    const isValidType = validTypes.includes(file.type);
    const isValidExtension = validExtensions.some(ext => file.name.toLowerCase().endsWith(ext));

    if (!isValidType && !isValidExtension) {
      return {
        valid: false,
        reason: 'Apenas arquivos CSV são permitidos'
      };
    }

    return { valid: true };
  }

  /**
   * Detecta variáveis no template de mensagem
   */
  detectVariables(template: string): string[] {
    const regex = /{{(\w+)}}/g;
    const variables: string[] = [];
    let match;

    while ((match = regex.exec(template)) !== null) {
      if (!variables.includes(match[1])) {
        variables.push(match[1]);
      }
    }

    return variables;
  }

  /**
   * Valida se todos os contatos têm as variáveis necessárias
   * 
   * NOTA: Variáveis dinâmicas (data, saudacao) são geradas no momento do envio
   * e não precisam estar presentes nos contatos importados
   */
  validateContactVariables(
    contacts: Contact[],
    requiredVariables: string[]
  ): { valid: boolean; missingVariables: { phone: string; missing: string[] }[] } {
    const missingVariables: { phone: string; missing: string[] }[] = [];

    // Variáveis que são geradas dinamicamente no momento do envio
    const dynamicVariables = ['data', 'saudacao'];

    // Debug logging (only in development)
    if (IS_DEVELOPMENT) {
      console.log('[AgentContactImport] Validating variables:', {
        totalContacts: contacts.length,
        requiredVariables,
        dynamicVariables,
        sampleContact: contacts[0] ? {
          phone: contacts[0].phone,
          hasVariables: !!contacts[0].variables,
          variableKeys: contacts[0].variables ? Object.keys(contacts[0].variables) : []
        } : null
      });
    }

    contacts.forEach(contact => {
      // Filtrar apenas variáveis que NÃO são dinâmicas
      const missing = requiredVariables.filter(varName => {
        // Se é variável dinâmica, não validar (será gerada no envio)
        if (dynamicVariables.includes(varName)) {
          return false;
        }
        // Validar se a variável existe no contato
        return !contact.variables?.[varName];
      });

      if (missing.length > 0) {
        if (IS_DEVELOPMENT) {
          console.log('[AgentContactImport] Contact missing variables:', {
            phone: contact.phone,
            missing,
            hasVariables: !!contact.variables,
            variables: contact.variables
          });
        }

        missingVariables.push({
          phone: contact.phone,
          missing
        });
      }
    });

    if (IS_DEVELOPMENT) {
      console.log('[AgentContactImport] Validation result:', {
        valid: missingVariables.length === 0,
        totalMissing: missingVariables.length,
        note: 'Dynamic variables (data, saudacao) are generated at send time'
      });
    }

    return {
      valid: missingVariables.length === 0,
      missingVariables
    };
  }

  /**
   * Remove contatos duplicados
   */
  removeDuplicates(contacts: Contact[]): { unique: Contact[]; duplicates: number } {
    const seen = new Set<string>();
    const unique: Contact[] = [];
    let duplicates = 0;

    contacts.forEach(contact => {
      if (!seen.has(contact.phone)) {
        seen.add(contact.phone);
        unique.push(contact);
      } else {
        duplicates++;
      }
    });

    return { unique, duplicates };
  }

  /**
   * Gera template CSV de exemplo
   */
  generateCSVTemplate(includeVariables: string[] = []): string {
    const headers = ['phone', 'name', ...includeVariables];
    const exampleRow = [
      '5511999999999',
      'João Silva',
      ...includeVariables.map(() => 'valor_exemplo')
    ];

    return [
      headers.join(','),
      exampleRow.join(',')
    ].join('\n');
  }

  /**
   * Download de template CSV
   */
  downloadCSVTemplate(includeVariables: string[] = []): void {
    const content = this.generateCSVTemplate(includeVariables);
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', 'template-contatos-agente.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Exporta contatos para CSV
   */
  exportContactsToCSV(contacts: Contact[], filename = 'contatos-agente.csv'): void {
    if (contacts.length === 0) {
      return;
    }

    // Coletar todas as variáveis únicas
    const allVariables = new Set<string>();
    contacts.forEach(contact => {
      if (contact.variables) {
        Object.keys(contact.variables).forEach(key => {
          // Filtrar chaves numéricas (índices de array)
          if (isNaN(Number(key))) {
            allVariables.add(key);
          }
        });
      }
    });

    const variableColumns = Array.from(allVariables);
    const headers = ['phone', 'name', ...variableColumns];

    // Gerar linhas
    const rows = contacts.map(contact => {
      const row = [
        contact.phone,
        contact.name || '',
        ...variableColumns.map(varName => contact.variables?.[varName] || '')
      ];
      return row.join(',');
    });

    const content = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Obtém estatísticas de contatos
   */
  getContactStats(contacts: Contact[]): {
    total: number;
    withName: number;
    withVariables: number;
    uniqueVariables: string[];
  } {
    const allVariables = new Set<string>();
    let withName = 0;
    let withVariables = 0;

    contacts.forEach(contact => {
      if (contact.name) {
        withName++;
      }

      if (contact.variables && Object.keys(contact.variables).length > 0) {
        withVariables++;
        Object.keys(contact.variables).forEach(key => {
          // Filtrar chaves numéricas (índices de array)
          if (isNaN(Number(key))) {
            allVariables.add(key);
          }
        });
      }
    });

    return {
      total: contacts.length,
      withName,
      withVariables,
      uniqueVariables: Array.from(allVariables)
    };
  }
}

// Exportar instância singleton
export const agentContactImportService = new AgentContactImportService();
export default agentContactImportService;