/**
 * Contact Import Service
 * 
 * Serviço para importar e validar contatos de múltiplas fontes
 */

import { BackendApiClient } from './api-client';
import { Contact } from './bulkCampaignService';
import {
  validatePhoneFormat,
  normalizePhoneNumber,
  formatPhoneDisplay as formatPhoneUtil
} from '@/lib/phone-utils';

const IS_DEVELOPMENT = import.meta.env.DEV;

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
}

export interface ManualValidationResult {
  success: boolean;
  valid: Contact[];
  invalid: Array<{
    number: string;
    reason: string;
    line: number;
  }>;
  summary: {
    total: number;
    validCount: number;
    invalidCount: number;
  };
}

export interface WuzapiContact {
  phone: string;
  name?: string | null;
  variables: Record<string, string>;
}

class ContactImportService {
  private api: BackendApiClient;
  private baseUrl = '/user/contacts';

  constructor() {
    this.api = new BackendApiClient();
  }

  /**
   * Importa contatos da agenda WUZAPI
   */
  async importFromWuzapi(instance: string, userToken: string): Promise<{
    contacts: Contact[];
    total: number;
    lidCount?: number;
    warning?: string;
  }> {
    const response = await this.api.get<{
      contacts: Contact[];
      total: number;
      lidCount?: number;
      warning?: string;
    }>(
      `${this.baseUrl}/import/wuzapi`,
      {
        params: { instance }
      }
    );

    return response.data;
  }

  /**
   * Valida arquivo CSV
   */
  async validateCSV(file: File, userToken: string): Promise<CSVValidationResult> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await this.api.post<CSVValidationResult>(
      `${this.baseUrl}/validate-csv`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      }
    );

    return response.data;
  }

  /**
   * Valida números manuais
   */
  async validateManualNumbers(numbers: string[], userToken: string): Promise<ManualValidationResult> {
    const response = await this.api.post<ManualValidationResult>(
      `${this.baseUrl}/validate-manual`,
      { numbers }
    );

    return response.data;
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
  validateFileSize(file: File, maxSizeMB: number = 5): { valid: boolean; reason?: string } {
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
  ): { valid: boolean; missingVariables: Array<{ phone: string; missing: string[] }> } {
    const missingVariables: Array<{ phone: string; missing: string[] }> = [];

    // Variáveis que são geradas dinamicamente no momento do envio
    const dynamicVariables = ['data', 'saudacao'];

    // Debug logging (only in development)
    if (IS_DEVELOPMENT) {
      console.log('[ContactImport] Validating variables:', {
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
        return !contact.variables || !contact.variables[varName];
      });

      if (missing.length > 0) {
        if (IS_DEVELOPMENT) {
          console.log('[ContactImport] Contact missing variables:', {
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
      console.log('[ContactImport] Validation result:', {
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
    link.setAttribute('download', 'template-contatos.csv');
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Exporta contatos para CSV
   */
  exportContactsToCSV(contacts: Contact[], filename: string = 'contatos.csv'): void {
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
export const contactImportService = new ContactImportService();
export default contactImportService;
