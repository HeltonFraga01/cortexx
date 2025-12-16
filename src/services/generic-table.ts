import { backendApi, ApiResponse } from './api-client';
import { toast } from '@/hooks/use-toast';
import type {
  QueryOptions,
  PaginationInfo,
  QueryResult,
  TableRecord,
} from '@/lib/types';

// Re-export types for backward compatibility
export type {
  QueryOptions,
  PaginationInfo,
  QueryResult,
  TableRecord,
};

/**
 * Serviço para operações genéricas em tabelas
 */
export class GenericTableService {
  private static instance: GenericTableService;
  private userToken: string | null = null;

  private constructor() {}

  static getInstance(): GenericTableService {
    if (!GenericTableService.instance) {
      GenericTableService.instance = new GenericTableService();
    }
    return GenericTableService.instance;
  }

  /**
   * Define o token do usuário para autenticação
   */
  setUserToken(token: string): void {
    this.userToken = token;
  }

  /**
   * Obtém o token do usuário
   */
  private getUserToken(): string {
    if (!this.userToken) {
      throw new Error('Token de usuário não configurado');
    }
    return this.userToken;
  }

  /**
   * Consulta registros de uma tabela com paginação, filtros e ordenação
   */
  async queryTable<T = TableRecord>(
    tableName: string,
    options: QueryOptions = {}
  ): Promise<ApiResponse<QueryResult<T>>> {
    try {
      const token = this.getUserToken();
      
      // Construir query params
      const params = new URLSearchParams();
      
      if (options.page) params.append('page', options.page.toString());
      if (options.limit) params.append('limit', options.limit.toString());
      if (options.sortBy) params.append('sortBy', options.sortBy);
      if (options.sortOrder) params.append('sortOrder', options.sortOrder);
      
      // Adicionar filtros
      if (options.filters) {
        Object.entries(options.filters).forEach(([key, value]) => {
          if (value) {
            params.append(`filter_${key}`, value);
          }
        });
      }
      
      const queryString = params.toString();
      const url = `/tables/${encodeURIComponent(tableName)}${queryString ? `?${queryString}` : ''}`;
      
      const response = await backendApi.get<QueryResult<T>>(url);

      if (response.success && response.data) {
        return {
          success: true,
          data: response.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao consultar tabela');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao consultar tabela',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Busca um registro específico por ID
   */
  async getRecord<T = TableRecord>(
    tableName: string,
    id: number
  ): Promise<ApiResponse<T>> {
    try {
      const token = this.getUserToken();
      
      const response = await backendApi.get<{ data: T }>(
        `/tables/${encodeURIComponent(tableName)}/${id}`
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao buscar registro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao buscar registro',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Cria um novo registro na tabela
   */
  async createRecord<T = TableRecord>(
    tableName: string,
    data: Partial<T>
  ): Promise<ApiResponse<T>> {
    try {
      const token = this.getUserToken();
      
      const response = await backendApi.post<{ data: T }>(
        `/tables/${encodeURIComponent(tableName)}`,
        data
      );

      if (response.success && response.data?.data) {
        toast({
          title: 'Sucesso',
          description: 'Registro criado com sucesso',
        });

        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao criar registro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao criar registro',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Atualiza um registro existente
   */
  async updateRecord<T = TableRecord>(
    tableName: string,
    id: number,
    data: Partial<T>
  ): Promise<ApiResponse<void>> {
    try {
      const token = this.getUserToken();
      
      const response = await backendApi.put<{ message: string }>(
        `/tables/${encodeURIComponent(tableName)}/${id}`,
        data
      );

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Registro atualizado com sucesso',
        });

        return {
          success: true,
        };
      } else {
        throw new Error(response.error || 'Falha ao atualizar registro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao atualizar registro',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Deleta um registro
   */
  async deleteRecord(
    tableName: string,
    id: number
  ): Promise<ApiResponse<void>> {
    try {
      const token = this.getUserToken();
      
      const response = await backendApi.delete<{ message: string }>(
        `/tables/${encodeURIComponent(tableName)}/${id}`
      );

      if (response.success) {
        toast({
          title: 'Sucesso',
          description: 'Registro deletado com sucesso',
        });

        return {
          success: true,
        };
      } else {
        throw new Error(response.error || 'Falha ao deletar registro');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      toast({
        title: 'Erro ao deletar registro',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Valida nome de tabela
   */
  validateTableName(tableName: string): { isValid: boolean; error?: string } {
    if (!tableName || tableName.trim().length === 0) {
      return { isValid: false, error: 'Nome da tabela é obrigatório' };
    }

    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      return { isValid: false, error: 'Nome da tabela inválido' };
    }

    return { isValid: true };
  }

  /**
   * Valida opções de consulta
   */
  validateQueryOptions(options: QueryOptions): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (options.page !== undefined && options.page < 1) {
      errors.push('Página deve ser maior que 0');
    }

    if (options.limit !== undefined) {
      if (options.limit < 1) {
        errors.push('Limite deve ser maior que 0');
      } else if (options.limit > 100) {
        errors.push('Limite máximo é 100 registros');
      }
    }

    if (options.sortOrder && !['ASC', 'DESC'].includes(options.sortOrder)) {
      errors.push('Ordem de ordenação deve ser ASC ou DESC');
    }

    if (options.sortBy && !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(options.sortBy)) {
      errors.push('Nome da coluna de ordenação inválido');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Sanitiza dados de registro removendo campos do sistema
   */
  sanitizeRecordData<T>(data: Partial<T>): Partial<T> {
    const sanitized = { ...data };
    
    // Remover campos que não devem ser modificados
    delete (sanitized as any).id;
    delete (sanitized as any).created_at;
    delete (sanitized as any).updated_at;
    
    return sanitized;
  }

  /**
   * Formata valor de campo para exibição
   */
  formatFieldValue(value: any): string {
    if (value === null || value === undefined) {
      return '-';
    }

    if (typeof value === 'boolean') {
      return value ? 'Sim' : 'Não';
    }

    if (typeof value === 'number') {
      return value.toString();
    }

    if (typeof value === 'string') {
      // Limitar tamanho de strings longas
      if (value.length > 100) {
        return value.substring(0, 97) + '...';
      }
      return value;
    }

    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[Object]';
      }
    }

    return String(value);
  }

  /**
   * Detecta tipo de campo baseado no valor
   */
  detectFieldType(value: any): 'text' | 'number' | 'boolean' | 'date' | 'json' | 'unknown' {
    if (value === null || value === undefined) {
      return 'unknown';
    }

    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (typeof value === 'number') {
      return 'number';
    }

    if (typeof value === 'string') {
      // Tentar detectar data
      if (/^\d{4}-\d{2}-\d{2}/.test(value)) {
        return 'date';
      }
      
      // Tentar detectar JSON
      if ((value.startsWith('{') && value.endsWith('}')) || 
          (value.startsWith('[') && value.endsWith(']'))) {
        try {
          JSON.parse(value);
          return 'json';
        } catch {
          return 'text';
        }
      }
      
      return 'text';
    }

    if (typeof value === 'object') {
      return 'json';
    }

    return 'unknown';
  }

  /**
   * Cria filtros a partir de um objeto de busca
   */
  createFiltersFromSearch(searchTerm: string, columns: string[]): Record<string, string> {
    const filters: Record<string, string> = {};
    
    if (searchTerm && searchTerm.trim().length > 0) {
      // Aplicar o mesmo termo de busca para todas as colunas
      columns.forEach(column => {
        filters[column] = searchTerm.trim();
      });
    }
    
    return filters;
  }

  /**
   * Calcula informações de paginação
   */
  calculatePaginationInfo(pagination: PaginationInfo): {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startRecord: number;
    endRecord: number;
  } {
    const hasNextPage = pagination.page < pagination.total_pages;
    const hasPreviousPage = pagination.page > 1;
    const startRecord = (pagination.page - 1) * pagination.limit + 1;
    const endRecord = Math.min(pagination.page * pagination.limit, pagination.total);

    return {
      hasNextPage,
      hasPreviousPage,
      startRecord,
      endRecord,
    };
  }

  /**
   * Gera opções de paginação para seletor
   */
  getPaginationOptions(): number[] {
    return [10, 25, 50, 100];
  }

  /**
   * Valida ID de registro
   */
  validateRecordId(id: any): { isValid: boolean; error?: string } {
    if (id === null || id === undefined) {
      return { isValid: false, error: 'ID é obrigatório' };
    }

    const numId = Number(id);
    
    if (isNaN(numId) || numId < 1) {
      return { isValid: false, error: 'ID deve ser um número positivo' };
    }

    return { isValid: true };
  }
}

// Instância singleton do serviço
export const genericTableService = GenericTableService.getInstance();

export default genericTableService;
