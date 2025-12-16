import { backendApi, ApiResponse } from './api-client';
import type {
  TablePermission,
  CreatePermissionRequest,
  UpdatePermissionRequest,
  TableInfo,
  ColumnInfo,
  TableSchema,
} from '@/lib/types';

// Re-export types for backward compatibility
export type {
  TablePermission,
  CreatePermissionRequest,
  UpdatePermissionRequest,
  TableInfo,
  ColumnInfo,
  TableSchema,
};

/**
 * Serviço para gerenciar permissões de tabela
 */
export class TablePermissionsService {
  private static instance: TablePermissionsService;

  private constructor() {
    // Session-based authentication - no token needed
  }

  static getInstance(): TablePermissionsService {
    if (!TablePermissionsService.instance) {
      TablePermissionsService.instance = new TablePermissionsService();
    }
    return TablePermissionsService.instance;
  }

  /**
   * Cria uma nova permissão de tabela
   */
  async createPermission(data: CreatePermissionRequest): Promise<ApiResponse<TablePermission>> {
    try {
      const response = await backendApi.post<{ data: TablePermission }>(
        '/admin/table-permissions',
        data
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao criar permissão');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      
      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Lista todas as permissões ou filtra por usuário
   */
  async getPermissions(userId?: string): Promise<ApiResponse<TablePermission[]>> {
    try {
      const url = userId 
        ? `/admin/table-permissions?user_id=${encodeURIComponent(userId)}`
        : '/admin/table-permissions';

      const response = await backendApi.get<{ data: TablePermission[]; count: number }>(url);

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao listar permissões');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        data: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Busca uma permissão específica por ID
   */
  async getPermission(id: number): Promise<ApiResponse<TablePermission>> {
    try {
      const response = await backendApi.get<{ data: TablePermission }>(
        `/admin/table-permissions/${id}`
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao buscar permissão');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Atualiza uma permissão existente
   */
  async updatePermission(id: number, data: UpdatePermissionRequest): Promise<ApiResponse<void>> {
    try {
      const response = await backendApi.put<{ message: string }>(
        `/admin/table-permissions/${id}`,
        data
      );

      if (response.success) {

        return {
          success: true,
        };
      } else {
        throw new Error(response.error || 'Falha ao atualizar permissão');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Deleta uma permissão
   */
  async deletePermission(id: number): Promise<ApiResponse<void>> {
    try {
      const response = await backendApi.delete<{ message: string }>(
        `/admin/table-permissions/${id}`
      );

      if (response.success) {

        return {
          success: true,
        };
      } else {
        throw new Error(response.error || 'Falha ao deletar permissão');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Lista todas as tabelas disponíveis
   */
  async getAvailableTables(): Promise<ApiResponse<TableInfo[]>> {
    try {
      const response = await backendApi.get<{ data: TableInfo[]; count: number }>(
        '/admin/tables'
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao listar tabelas');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        data: [],
        error: errorMessage,
      };
    }
  }

  /**
   * Obtém o schema de uma tabela específica
   */
  async getTableSchema(tableName: string): Promise<ApiResponse<TableSchema>> {
    try {
      const response = await backendApi.get<{ data: TableSchema }>(
        `/admin/tables/${encodeURIComponent(tableName)}`
      );

      if (response.success && response.data?.data) {
        return {
          success: true,
          data: response.data.data,
        };
      } else {
        throw new Error(response.error || 'Falha ao buscar schema da tabela');
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      

      return {
        success: false,
        error: errorMessage,
      };
    }
  }

  /**
   * Valida dados de criação de permissão
   */
  validateCreatePermission(data: CreatePermissionRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!data.user_id || data.user_id.trim().length === 0) {
      errors.push('ID do usuário é obrigatório');
    }

    if (!data.table_name || data.table_name.trim().length === 0) {
      errors.push('Nome da tabela é obrigatório');
    } else if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(data.table_name)) {
      errors.push('Nome da tabela inválido');
    }

    // Verificar se pelo menos uma permissão foi concedida
    if (!data.can_read && !data.can_write && !data.can_delete) {
      errors.push('Pelo menos uma permissão deve ser concedida');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Valida dados de atualização de permissão
   */
  validateUpdatePermission(data: UpdatePermissionRequest): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Verificar se pelo menos um campo foi fornecido
    if (data.can_read === undefined && data.can_write === undefined && data.can_delete === undefined) {
      errors.push('Pelo menos um campo deve ser fornecido para atualização');
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formata permissões para exibição
   */
  formatPermissions(permission: TablePermission): string {
    const permissions: string[] = [];
    
    if (permission.can_read) permissions.push('Leitura');
    if (permission.can_write) permissions.push('Escrita');
    if (permission.can_delete) permissions.push('Exclusão');
    
    return permissions.length > 0 ? permissions.join(', ') : 'Nenhuma';
  }

  /**
   * Verifica se uma permissão tem todas as operações habilitadas
   */
  hasFullAccess(permission: TablePermission): boolean {
    return permission.can_read === 1 && permission.can_write === 1 && permission.can_delete === 1;
  }

  /**
   * Verifica se uma permissão é somente leitura
   */
  isReadOnly(permission: TablePermission): boolean {
    return permission.can_read === 1 && permission.can_write === 0 && permission.can_delete === 0;
  }
}

// Instância singleton do serviço
export const tablePermissionsService = TablePermissionsService.getInstance();

export default tablePermissionsService;
