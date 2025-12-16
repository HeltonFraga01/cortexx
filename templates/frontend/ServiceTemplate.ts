/**
 * [NAME] Service
 * 
 * Service para gerenciar operações relacionadas a [DATA_TYPE]
 * Gerado automaticamente em [TIMESTAMP]
 */

import axios, { AxiosInstance, AxiosResponse } from 'axios';

// TODO: Defina a interface para seus dados
export interface [DATA_TYPE] {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  createdAt: string;
  updatedAt: string;
  // Adicione campos específicos aqui
}

// TODO: Defina a interface para criação/atualização
export interface Create[DATA_TYPE]Request {
  name: string;
  // Adicione campos obrigatórios para criação
}

export interface Update[DATA_TYPE]Request {
  name?: string;
  status?: 'active' | 'inactive';
  // Adicione campos que podem ser atualizados
}

// Interface para resposta da API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
}

// Interface para filtros de busca
export interface [DATA_TYPE]Filters {
  search?: string;
  status?: 'active' | 'inactive';
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Interface para resposta paginada
export interface Paginated[DATA_TYPE]Response {
  data: [DATA_TYPE][];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export class [API_SERVICE] {
  private api: AxiosInstance;
  private baseURL: string;

  constructor(baseURL: string = '/api') {
    this.baseURL = baseURL;
    this.api = axios.create({
      baseURL: this.baseURL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para adicionar token de autenticação
    this.api.interceptors.request.use(
      (config) => {
        const token = this.getAuthToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Interceptor para tratamento de respostas
    this.api.interceptors.response.use(
      (response: AxiosResponse) => {
        return response.data;
      },
      (error) => {
        return Promise.reject(this.handleError(error));
      }
    );
  }

  /**
   * Obter token de autenticação
   * TODO: Implemente a lógica para obter o token (localStorage, context, etc.)
   */
  private getAuthToken(): string | null {
    // Exemplo: return localStorage.getItem('authToken');
    return localStorage.getItem('userToken') || localStorage.getItem('adminToken');
  }

  /**
   * Tratamento centralizado de erros
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Erro da API
      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          return new Error(data.error || 'Dados inválidos');
        case 401:
          return new Error('Token de autenticação inválido ou expirado');
        case 403:
          return new Error('Sem permissão para acessar este recurso');
        case 404:
          return new Error('[DATA_TYPE] não encontrado');
        case 409:
          return new Error('[DATA_TYPE] já existe');
        case 422:
          return new Error('Dados não processáveis - verifique os campos obrigatórios');
        case 429:
          return new Error('Muitas requisições - tente novamente em alguns segundos');
        case 500:
          return new Error('Erro interno do servidor');
        case 502:
          return new Error('Servidor indisponível');
        case 503:
          return new Error('Serviço temporariamente indisponível');
        case 504:
          return new Error('Timeout na conexão');
        default:
          return new Error(data.error || `Erro HTTP ${status}`);
      }
    } else if (error.request) {
      // Erro de rede
      return new Error('Erro de conexão - verifique sua internet');
    } else {
      // Erro de configuração
      return new Error(error.message || 'Erro desconhecido');
    }
  }

  /**
   * Listar todos os [DATA_TYPE]s
   */
  async getAll(filters?: [DATA_TYPE]Filters): Promise<[DATA_TYPE][]> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await this.api.get<ApiResponse<[DATA_TYPE][]>>(
        `/[FILE_NAME]${params.toString() ? `?${params.toString()}` : ''}`
      );

      return response.data || [];
    } catch (error) {
      console.error('Erro ao buscar [DATA_TYPE]s:', error);
      throw error;
    }
  }

  /**
   * Listar [DATA_TYPE]s com paginação
   */
  async getPaginated(filters?: [DATA_TYPE]Filters): Promise<Paginated[DATA_TYPE]Response> {
    try {
      const params = new URLSearchParams();
      
      // Configurar paginação padrão
      params.append('page', (filters?.page || 1).toString());
      params.append('limit', (filters?.limit || 20).toString());
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (key !== 'page' && key !== 'limit' && value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await this.api.get<ApiResponse<Paginated[DATA_TYPE]Response>>(
        `/[FILE_NAME]/paginated?${params.toString()}`
      );

      return response.data || { data: [], pagination: { page: 1, limit: 20, total: 0, totalPages: 0, hasNext: false, hasPrev: false } };
    } catch (error) {
      console.error('Erro ao buscar [DATA_TYPE]s paginados:', error);
      throw error;
    }
  }

  /**
   * Buscar [DATA_TYPE] por ID
   */
  async getById(id: string): Promise<[DATA_TYPE] | null> {
    try {
      const response = await this.api.get<ApiResponse<[DATA_TYPE]>>(`/[FILE_NAME]/${id}`);
      return response.data || null;
    } catch (error) {
      if (error.message.includes('não encontrado')) {
        return null;
      }
      console.error(`Erro ao buscar [DATA_TYPE] ${id}:`, error);
      throw error;
    }
  }

  /**
   * Criar novo [DATA_TYPE]
   */
  async create(data: Create[DATA_TYPE]Request): Promise<[DATA_TYPE]> {
    try {
      // TODO: Adicione validações específicas se necessário
      this.validateCreateData(data);

      const response = await this.api.post<ApiResponse<[DATA_TYPE]>>('/[FILE_NAME]', data);
      
      if (!response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      return response.data;
    } catch (error) {
      console.error('Erro ao criar [DATA_TYPE]:', error);
      throw error;
    }
  }

  /**
   * Atualizar [DATA_TYPE] existente
   */
  async update(id: string, data: Update[DATA_TYPE]Request): Promise<[DATA_TYPE]> {
    try {
      // TODO: Adicione validações específicas se necessário
      this.validateUpdateData(data);

      const response = await this.api.put<ApiResponse<[DATA_TYPE]>>(`/[FILE_NAME]/${id}`, data);
      
      if (!response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      return response.data;
    } catch (error) {
      console.error(`Erro ao atualizar [DATA_TYPE] ${id}:`, error);
      throw error;
    }
  }

  /**
   * Atualizar parcialmente [DATA_TYPE]
   */
  async patch(id: string, data: Partial<Update[DATA_TYPE]Request>): Promise<[DATA_TYPE]> {
    try {
      const response = await this.api.patch<ApiResponse<[DATA_TYPE]>>(`/[FILE_NAME]/${id}`, data);
      
      if (!response.data) {
        throw new Error('Resposta inválida do servidor');
      }

      return response.data;
    } catch (error) {
      console.error(`Erro ao atualizar parcialmente [DATA_TYPE] ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deletar [DATA_TYPE]
   */
  async delete(id: string): Promise<void> {
    try {
      await this.api.delete<ApiResponse<void>>(`/[FILE_NAME]/${id}`);
    } catch (error) {
      console.error(`Erro ao deletar [DATA_TYPE] ${id}:`, error);
      throw error;
    }
  }

  /**
   * Deletar múltiplos [DATA_TYPE]s
   */
  async bulkDelete(ids: string[]): Promise<void> {
    try {
      if (ids.length === 0) {
        throw new Error('Lista de IDs não pode estar vazia');
      }

      await this.api.delete<ApiResponse<void>>('/[FILE_NAME]/bulk', {
        data: { ids }
      });
    } catch (error) {
      console.error('Erro ao deletar [DATA_TYPE]s em lote:', error);
      throw error;
    }
  }

  /**
   * Buscar [DATA_TYPE]s por texto
   */
  async search(query: string, filters?: Omit<[DATA_TYPE]Filters, 'search'>): Promise<[DATA_TYPE][]> {
    try {
      if (!query.trim()) {
        return [];
      }

      const searchFilters: [DATA_TYPE]Filters = {
        ...filters,
        search: query.trim()
      };

      return await this.getAll(searchFilters);
    } catch (error) {
      console.error('Erro ao buscar [DATA_TYPE]s:', error);
      throw error;
    }
  }

  /**
   * Contar total de [DATA_TYPE]s
   */
  async count(filters?: Omit<[DATA_TYPE]Filters, 'page' | 'limit'>): Promise<number> {
    try {
      const params = new URLSearchParams();
      
      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null && value !== '') {
            params.append(key, value.toString());
          }
        });
      }

      const response = await this.api.get<ApiResponse<{ count: number }>>(
        `/[FILE_NAME]/count${params.toString() ? `?${params.toString()}` : ''}`
      );

      return response.data?.count || 0;
    } catch (error) {
      console.error('Erro ao contar [DATA_TYPE]s:', error);
      throw error;
    }
  }

  /**
   * Verificar se [DATA_TYPE] existe
   */
  async exists(id: string): Promise<boolean> {
    try {
      const item = await this.getById(id);
      return item !== null;
    } catch (error) {
      return false;
    }
  }

  /**
   * Validar dados para criação
   * TODO: Implemente validações específicas
   */
  private validateCreateData(data: Create[DATA_TYPE]Request): void {
    if (!data.name || data.name.trim().length === 0) {
      throw new Error('Nome é obrigatório');
    }

    if (data.name.length > 255) {
      throw new Error('Nome deve ter no máximo 255 caracteres');
    }

    // Adicione mais validações conforme necessário
  }

  /**
   * Validar dados para atualização
   * TODO: Implemente validações específicas
   */
  private validateUpdateData(data: Update[DATA_TYPE]Request): void {
    if (data.name !== undefined) {
      if (!data.name || data.name.trim().length === 0) {
        throw new Error('Nome não pode estar vazio');
      }

      if (data.name.length > 255) {
        throw new Error('Nome deve ter no máximo 255 caracteres');
      }
    }

    // Adicione mais validações conforme necessário
  }

  /**
   * Configurar timeout personalizado para uma requisição
   */
  setTimeout(timeout: number): [API_SERVICE] {
    this.api.defaults.timeout = timeout;
    return this;
  }

  /**
   * Configurar headers personalizados
   */
  setHeaders(headers: Record<string, string>): [API_SERVICE] {
    Object.assign(this.api.defaults.headers, headers);
    return this;
  }

  /**
   * Obter estatísticas dos [DATA_TYPE]s
   * TODO: Implemente conforme necessário
   */
  async getStats(): Promise<{
    total: number;
    active: number;
    inactive: number;
    recentlyCreated: number;
  }> {
    try {
      const response = await this.api.get<ApiResponse<any>>('/[FILE_NAME]/stats');
      
      return response.data || {
        total: 0,
        active: 0,
        inactive: 0,
        recentlyCreated: 0
      };
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      throw error;
    }
  }
}

// Instância padrão do serviço
export const [HOOK_NAME]Service = new [API_SERVICE]();

// Hook personalizado para usar o serviço (opcional)
// TODO: Descomente e customize se necessário
/*
import { useState, useEffect, useCallback } from 'react';

export const use[DATA_TYPE] = () => {
  const [data, setData] = useState<[DATA_TYPE][]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async (filters?: [DATA_TYPE]Filters) => {
    try {
      setLoading(true);
      setError(null);
      const result = await [HOOK_NAME]Service.getAll(filters);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  }, []);

  const createItem = useCallback(async (itemData: Create[DATA_TYPE]Request) => {
    try {
      const newItem = await [HOOK_NAME]Service.create(itemData);
      setData(prev => [...prev, newItem]);
      return newItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao criar item');
      throw err;
    }
  }, []);

  const updateItem = useCallback(async (id: string, itemData: Update[DATA_TYPE]Request) => {
    try {
      const updatedItem = await [HOOK_NAME]Service.update(id, itemData);
      setData(prev => prev.map(item => item.id === id ? updatedItem : item));
      return updatedItem;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar item');
      throw err;
    }
  }, []);

  const deleteItem = useCallback(async (id: string) => {
    try {
      await [HOOK_NAME]Service.delete(id);
      setData(prev => prev.filter(item => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao deletar item');
      throw err;
    }
  }, []);

  return {
    data,
    loading,
    error,
    fetchData,
    createItem,
    updateItem,
    deleteItem,
    refresh: fetchData
  };
};
*/

/**
 * INSTRUÇÕES DE USO:
 * 
 * 1. SUBSTITUIR PLACEHOLDERS:
 *    - [DATA_TYPE]: Tipo de dados (ex: User, Product, Order)
 *    - [API_SERVICE]: Nome da classe do serviço (ex: UserService, ProductService)
 *    - [HOOK_NAME]: Nome do hook (ex: user, product, order)
 *    - [FILE_NAME]: Nome do endpoint (ex: users, products, orders)
 * 
 * 2. IMPLEMENTAR TODOs:
 *    - Definir interfaces específicas para seus dados
 *    - Implementar validações customizadas
 *    - Configurar autenticação apropriada
 *    - Adicionar métodos específicos se necessário
 * 
 * 3. EXEMPLO DE USO:
 *    ```typescript
 *    import { userService } from '@/services/userService';
 *    
 *    // Buscar todos os usuários
 *    const users = await userService.getAll();
 *    
 *    // Criar novo usuário
 *    const newUser = await userService.create({
 *      name: 'João Silva',
 *      email: 'joao@example.com'
 *    });
 *    
 *    // Atualizar usuário
 *    const updatedUser = await userService.update('123', {
 *      name: 'João Santos'
 *    });
 *    ```
 * 
 * 4. INTEGRAÇÃO COM COMPONENTES:
 *    - Use o serviço diretamente em componentes
 *    - Ou descomente e use o hook personalizado
 *    - Combine com React Query para cache avançado
 */