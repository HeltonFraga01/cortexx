import axios from 'axios';
import { backendApi, ApiResponse as BackendApiResponse } from './api-client';
import { connectionCache } from './cache/connectionCache';

const IS_DEVELOPMENT = import.meta.env.DEV;

export interface FieldMapping {
  columnName: string;
  label: string;
  visible: boolean;
  editable: boolean;
  showInCard?: boolean; // Novo campo para controlar exibição no card
  helperText?: string; // Texto de ajuda/descrição para o campo (max 500 caracteres)
}

// Configuração de visualização em calendário
export interface CalendarViewConfig {
  enabled: boolean;
  dateField?: string; // Nome da coluna a ser usada para organização no calendário
}

// Configuração de visualização em kanban
export interface KanbanViewConfig {
  enabled: boolean;
  statusField?: string; // Nome da coluna a ser usada para colunas do kanban
}

// Configuração de tema de edição personalizado
export interface EditThemeConfig {
  enabled: boolean;
  themeId: string;
  options?: Record<string, any>; // Opções específicas do tema
}

// Configuração de visualizações avançadas
export interface ViewConfiguration {
  calendar?: CalendarViewConfig;
  kanban?: KanbanViewConfig;
  editTheme?: EditThemeConfig;
}

// Tipos para eventos de calendário
export interface CalendarEvent {
  id: string | number;
  title: string;
  start: Date;
  end: Date;
  resource?: any; // Dados completos do registro
}

// Tipos para colunas de kanban
export interface KanbanColumn {
  id: string;
  title: string;
  records: any[];
}

// Metadados de coluna do NocoDB
export interface NocoDBColumn {
  id: string;
  title: string;
  column_name: string;
  uidt: string; // UI Data Type (Date, DateTime, SingleLineText, etc.)
}

export interface DatabaseConnection {
  id?: number;
  name: string;
  type: 'POSTGRES' | 'MYSQL' | 'NOCODB' | 'API' | 'SQLITE';
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  table_name: string;
  status: 'connected' | 'disconnected' | 'error' | 'testing';
  assignedUsers: string[];
  // Campos específicos do NocoDB
  nocodb_token?: string;
  nocodb_project_id?: string;
  nocodb_table_id?: string;
  // Campos avançados
  user_link_field?: string;
  userLinkField?: string;
  fieldMappings?: FieldMapping[];
  default_view_mode?: 'list' | 'single';
  field_mappings?: FieldMapping[];
  viewConfiguration?: ViewConfiguration; // Configuração de visualizações avançadas
  view_configuration?: ViewConfiguration; // Snake case para compatibilidade com backend
  created_at?: string;
  updated_at?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  code?: string;
  count?: number;
  metadata?: Record<string, any>;
}

// Error codes for specific error handling
export enum DatabaseNavigationError {
  CONNECTION_NOT_FOUND = 'CONNECTION_NOT_FOUND',
  RECORD_NOT_FOUND = 'RECORD_NOT_FOUND',
  UNAUTHORIZED = 'UNAUTHORIZED',
  NETWORK_ERROR = 'NETWORK_ERROR',
  INVALID_FIELD_MAPPING = 'INVALID_FIELD_MAPPING',
  DATABASE_ERROR = 'DATABASE_ERROR',
  INVALID_TOKEN = 'INVALID_TOKEN',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

// Custom error class for database navigation errors
export class DatabaseNavigationException extends Error {
  code: string;
  suggestion?: string;

  constructor(message: string, code: string, suggestion?: string) {
    super(message);
    this.name = 'DatabaseNavigationException';
    this.code = code;
    this.suggestion = suggestion;
  }
}

export class DatabaseConnectionsService {

  /**
   * Verificar se o servidor está rodando
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Usar a mesma origem para evitar problemas de CSP
      // O backend está servindo na mesma porta que o frontend
      const response = await axios.get('/health');
      return response.status === 200 && response.data?.status === 'ok';
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Listar todas as conexões
   */
  async getAllConnections(): Promise<DatabaseConnection[]> {
    const response = await backendApi.get<ApiResponse<DatabaseConnection[]>>('/database-connections');

    if (!response.success) {
      throw new Error((response.error as any)?.message || 'Erro ao buscar conexões');
    }

    return response.data?.data || [];
  }

  /**
   * Buscar conexão por ID (rota admin - sem validação de acesso do usuário)
   * @deprecated Use getUserConnectionById para validar acesso do usuário
   */
  async getConnectionById(id: number): Promise<DatabaseConnection | null> {
    const response = await backendApi.get<ApiResponse<DatabaseConnection>>(`/database-connections/${id}`);

    if (!response.success) {
      if ((response as any).status === 404) {
        return null;
      }
      throw new Error((response.error as any)?.message || 'Erro desconhecido');
    }

    return response.data?.data || null;
  }

  /**
   * Buscar conexão por ID com validação de acesso do usuário
   * Usa a rota de usuário que valida se o usuário tem permissão para acessar a conexão
   */
  async getUserConnectionById(userToken: string, id: number): Promise<DatabaseConnection | null> {
    const cacheKey = `user-connection:${userToken}:${id}`;

    // Try cache first
    const cached = connectionCache.get<DatabaseConnection>(cacheKey);
    if (cached) {
      if (IS_DEVELOPMENT) {
        console.log('📦 Cache hit: user connection by id', { connectionId: id });
      }
      return cached;
    }

    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.get<ApiResponse<DatabaseConnection>>(`/user/database-connections/${id}`);

      if (!response.success) {
        if (response.status === 404 || (response as any).code === 'CONNECTION_NOT_FOUND') {
          throw new DatabaseNavigationException(
            'Conexão não encontrada',
            DatabaseNavigationError.CONNECTION_NOT_FOUND
          );
        }

        if (response.status === 403 || (response as any).code === 'ACCESS_DENIED') {
          throw new DatabaseNavigationException(
            'Acesso negado a esta conexão',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }

        if (response.status === 401) {
          throw new DatabaseNavigationException(
            'Sessão expirada',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }

        throw new DatabaseNavigationException(
          response.error || 'Erro ao buscar conexão',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      const connection = response.data?.data || null;

      if (connection) {
        // Cache for 5 minutes
        connectionCache.set(cacheKey, connection, 300000);
      }

      return connection;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao buscar conexão',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Criar nova conexão
   */
  async createConnection(data: Omit<DatabaseConnection, 'id' | 'created_at' | 'updated_at'>): Promise<DatabaseConnection> {
    const response = await backendApi.post<ApiResponse<DatabaseConnection>>('/database-connections', data);

    if (!response.success) {
      throw new Error(response.error || 'Erro ao criar conexão');
    }

    return response.data?.data!;
  }

  /**
   * Atualizar conexão
   */
  async updateConnection(id: number, data: Partial<DatabaseConnection>): Promise<DatabaseConnection> {
    const response = await backendApi.put<ApiResponse<any>>(`/database-connections/${id}`, data);

    if (!response.success) {
      throw new Error(response.error || 'Erro ao atualizar conexão');
    }

    // Invalidate all caches related to this connection
    // This ensures users see fresh data after admin makes changes
    this.clearConnectionCache(id);

    return { id, ...data } as DatabaseConnection;
  }

  /**
   * Atualizar apenas o status da conexão
   */
  async updateConnectionStatus(id: number, status: 'connected' | 'disconnected' | 'error' | 'testing'): Promise<void> {
    const response = await backendApi.patch<ApiResponse<any>>(`/database-connections/${id}/status`, { status });

    if (!response.success) {
      throw new Error(response.error || 'Erro ao atualizar status');
    }
  }

  /**
   * Deletar conexão
   */
  async deleteConnection(id: number): Promise<void> {
    const response = await backendApi.delete<ApiResponse<any>>(`/database-connections/${id}`);

    if (!response.success) {
      throw new Error(response.error || 'Erro ao deletar conexão');
    }
  }

  /**
   * Testar conexão com NocoDB
   */
  async testNocoDBConnection(connection: DatabaseConnection): Promise<{ success: boolean; error?: string }> {
    try {
      const testApi = axios.create({
        baseURL: connection.host,
        headers: {
          'xc-token': connection.nocodb_token || connection.password || '',
        },
        timeout: 10000,
      });

      // Testar com a API do NocoDB
      const response = await testApi.get(
        `/api/v1/db/data/noco/${connection.nocodb_project_id || connection.database}/${connection.nocodb_table_id || connection.table_name}`,
        {
          params: { limit: 1 },
        }
      );

      return { success: true };
    } catch (error: any) {
      console.error('Erro ao testar NocoDB:', error);
      return {
        success: false,
        error: error.response?.data?.message || error.message || 'Erro de conexão com NocoDB'
      };
    }
  }

  /**
   * Testar conexão com SQLite
   */
  async testSQLiteConnection(connection: DatabaseConnection): Promise<{ success: boolean; error?: string }> {
    try {
      // Usar a rota de teste específica da conexão
      if (!connection.id) {
        return { success: false, error: 'ID da conexão não encontrado' };
      }

      const response = await backendApi.post(`/database-connections/${connection.id}/test`);

      // Verificar se a resposta foi bem-sucedida
      if (response.success) {
        // Verificar o status dentro de data
        const connectionStatus = response.data?.data?.status;
        if (connectionStatus === 'connected') {
          return { success: true };
        } else {
          return { success: false, error: response.data?.message || 'Banco SQLite não está acessível' };
        }
      } else {
        return { success: false, error: response.data?.message || response.error || 'Banco SQLite não está acessível' };
      }
    } catch (error: any) {
      return { success: false, error: error.message || 'Erro ao conectar com SQLite' };
    }
  }

  /**
   * Testar e atualizar status de uma conexão
   */
  async testAndUpdateConnectionStatus(connection: DatabaseConnection): Promise<void> {
    if (!connection.id) return;

    try {
      let testResult = { success: false, error: 'Tipo não suportado' };

      if (connection.type === 'NOCODB') {
        testResult = await this.testNocoDBConnection(connection);
      } else if (connection.type === 'SQLITE') {
        testResult = await this.testSQLiteConnection(connection);
      }
      // Adicionar outros tipos de teste aqui no futuro

      const newStatus = testResult.success ? 'connected' : 'error';
      await this.updateConnectionStatus(connection.id, newStatus);

      if (!testResult.success) {
        console.error(`Erro na conexão ${connection.name}:`, testResult.error);
      }
    } catch (error: any) {
      console.error('Erro ao testar conexão:', error);
      if (connection.id) {
        await this.updateConnectionStatus(connection.id, 'error');
      }
    }
  }

  /**
   * Testar todas as conexões e atualizar seus status
   */
  async testAllConnections(): Promise<void> {
    try {
      const connections = await this.getAllConnections();

      // Testar conexões em paralelo (máximo 3 por vez para não sobrecarregar)
      const chunks = [];
      for (let i = 0; i < connections.length; i += 3) {
        chunks.push(connections.slice(i, i + 3));
      }

      for (const chunk of chunks) {
        await Promise.all(
          chunk.map(connection => this.testAndUpdateConnectionStatus(connection))
        );
      }
    } catch (error: any) {
      console.error('Erro ao testar todas as conexões:', error);
    }
  }

  /**
   * Buscar workspaces do NocoDB
   */
  async getNocoDBWorkspaces(baseURL: string, token: string): Promise<Array<{ id: string, title: string }>> {
    try {
      const api = axios.create({
        baseURL,
        headers: {
          'xc-token': token,
        },
        timeout: 10000,
      });

      const response = await api.get('/api/v1/db/meta/workspaces');
      return response.data.list || [];
    } catch (error: any) {
      console.error('Erro ao buscar workspaces:', error);
      throw new Error('Erro ao buscar workspaces do NocoDB');
    }
  }

  /**
   * Buscar projetos/bases de um workspace
   */
  async getNocoDBProjects(baseURL: string, token: string, workspaceId?: string): Promise<Array<{ id: string, title: string }>> {
    try {
      const api = axios.create({
        baseURL,
        headers: {
          'xc-token': token,
        },
        timeout: 10000,
      });

      // Se não tem workspaceId, buscar projetos diretos
      const endpoint = workspaceId
        ? `/api/v1/db/meta/workspaces/${workspaceId}/bases`
        : '/api/v1/db/meta/projects';

      const response = await api.get(endpoint);
      return response.data.list || response.data || [];
    } catch (error: any) {
      console.error('Erro ao buscar projetos:', error);
      throw new Error('Erro ao buscar projetos do NocoDB');
    }
  }

  /**
   * Buscar tabelas de um projeto
   */
  async getNocoDBTables(baseURL: string, token: string, projectId: string): Promise<Array<{ id: string, title: string, table_name: string }>> {
    try {
      const api = axios.create({
        baseURL,
        headers: {
          'xc-token': token,
        },
        timeout: 10000,
      });

      const response = await api.get(`/api/v1/db/meta/projects/${projectId}/tables`);
      return response.data.list || [];
    } catch (error: any) {
      console.error('Erro ao buscar tabelas:', error);
      throw new Error('Erro ao buscar tabelas do NocoDB');
    }
  }

  /**
   * Buscar colunas de uma tabela NocoDB (versão com parâmetros separados - para uso do admin)
   */
  async getNocoDBColumns(baseURL: string, token: string, tableId: string): Promise<NocoDBColumn[]>;

  /**
   * Buscar colunas de uma tabela NocoDB (versão com objeto connection - para uso do usuário)
   */
  async getNocoDBColumns(connection: DatabaseConnection): Promise<NocoDBColumn[]>;

  /**
   * Implementação do método getNocoDBColumns com sobrecarga
   */
  async getNocoDBColumns(
    baseURLOrConnection: string | DatabaseConnection,
    token?: string,
    tableId?: string
  ): Promise<NocoDBColumn[]> {
    // Determinar se é chamada com parâmetros separados ou com objeto connection
    let baseURL: string;
    let apiToken: string;
    let targetTableId: string;
    let cacheKey: string | null = null;

    if (typeof baseURLOrConnection === 'string') {
      // Versão com parâmetros separados (admin)
      baseURL = baseURLOrConnection;
      apiToken = token!;
      targetTableId = tableId!;
      // Não usar cache para chamadas do admin (parâmetros podem mudar durante configuração)
    } else {
      // Versão com objeto connection (usuário)
      const connection = baseURLOrConnection;

      if (connection.type !== 'NOCODB') {
        throw new DatabaseNavigationException(
          'Este método só funciona com conexões NocoDB',
          DatabaseNavigationError.INVALID_FIELD_MAPPING
        );
      }

      baseURL = connection.host;
      apiToken = connection.nocodb_token || connection.password || '';
      targetTableId = connection.nocodb_table_id || connection.table_name;

      // Check cache first para chamadas do usuário
      cacheKey = `field-metadata:${connection.id}:${targetTableId}`;
      const cached = connectionCache.get<NocoDBColumn[]>(cacheKey);

      if (cached) {
        if (IS_DEVELOPMENT) {
          console.log('✅ Field metadata loaded from cache', { connectionId: connection.id });
        }
        return cached;
      }
    }

    try {
      const api = axios.create({
        baseURL,
        headers: {
          'xc-token': apiToken,
        },
        timeout: 10000,
      });

      // Buscar metadados da tabela que incluem as colunas
      const response = await api.get(`/api/v1/db/meta/tables/${targetTableId}`);
      const columns: NocoDBColumn[] = response.data.columns || [];

      // Cache apenas para chamadas do usuário (com connection object)
      if (cacheKey) {
        connectionCache.set(cacheKey, columns, 600000); // 10 minutes
        if (IS_DEVELOPMENT) {
          console.log('✅ Field metadata fetched from NocoDB and cached', {
            columnCount: columns.length
          });
        }
      } else {
        if (IS_DEVELOPMENT) {
          console.log('✅ Field metadata fetched from NocoDB (admin - no cache)', {
            columnCount: columns.length
          });
        }
      }

      return columns;
    } catch (error: any) {
      console.error('❌ Error fetching NocoDB columns:', error);

      if (typeof baseURLOrConnection === 'string') {
        // Erro na versão admin - mensagem mais simples
        throw new Error(`Erro ao buscar colunas do NocoDB: ${error.response?.status || error.message}`);
      } else {
        // Erro na versão usuário - usar DatabaseNavigationException
        throw new DatabaseNavigationException(
          error.response?.data?.message || error.message || 'Erro ao buscar metadados de colunas',
          DatabaseNavigationError.DATABASE_ERROR,
          'Verifique se o token e IDs do NocoDB estão corretos'
        );
      }
    }
  }

  /**
   * Buscar conexões atribuídas a um usuário específico
   * Implementa cache de 5 minutos para melhorar performance
   */
  async getUserConnections(userToken: string): Promise<DatabaseConnection[]> {
    const cacheKey = `user-connections:${userToken}`;

    // Try cache first
    const cached = connectionCache.get<DatabaseConnection[]>(cacheKey);
    if (cached) {
      if (IS_DEVELOPMENT) {
        console.log('📦 Cache hit: user connections');
      }
      return cached;
    }

    try {
      // Usar sessão em vez de header de autorização
      const response = await backendApi.get<ApiResponse<DatabaseConnection[]>>('/user/database-connections');

      if (!response.success) {
        if (response.status === 401) {
          throw new DatabaseNavigationException(
            response.error || 'Não autorizado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }
        throw new DatabaseNavigationException(
          response.error || 'Erro ao buscar conexões do usuário',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      const connections = response.data?.data || [];

      // Cache for 5 minutes (300000ms)
      connectionCache.set(cacheKey, connections, 300000);

      return connections;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao buscar conexões',
        DatabaseNavigationError.NETWORK_ERROR
      );
    }
  }

  /**
   * Buscar um registro específico por ID
   * Implementa cache de 2 minutos para melhorar performance
   */
  async getUserTableRecordById(userToken: string, connectionId: number, recordId: string): Promise<any> {
    const cacheKey = `user-record-by-id:${userToken}:${connectionId}:${recordId}`;

    // Try cache first
    const cached = connectionCache.get<any>(cacheKey);
    if (cached) {
      if (IS_DEVELOPMENT) {
        console.log('📦 Cache hit: user record by id', { connectionId, recordId });
      }
      return cached;
    }

    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.get<ApiResponse<any>>(
        `/user/database-connections/${connectionId}/data/${recordId}`
      );

      if (!response.success) {
        // Handle specific error codes
        if (response.code === DatabaseNavigationError.RECORD_NOT_FOUND || response.status === 404) {
          throw new DatabaseNavigationException(
            response.error || 'Registro não encontrado',
            DatabaseNavigationError.RECORD_NOT_FOUND,
            'O registro pode ter sido removido ou você não tem permissão para acessá-lo'
          );
        }

        if (response.code === DatabaseNavigationError.CONNECTION_NOT_FOUND) {
          throw new DatabaseNavigationException(
            response.error || 'Conexão não encontrada',
            DatabaseNavigationError.CONNECTION_NOT_FOUND
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }

        throw new DatabaseNavigationException(
          response.error || 'Erro ao buscar registro',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      const record = response.data?.data;

      if (!record) {
        throw new DatabaseNavigationException(
          'Registro não encontrado',
          DatabaseNavigationError.RECORD_NOT_FOUND,
          'O registro pode ter sido removido'
        );
      }

      // Cache for 2 minutes (120000ms)
      connectionCache.set(cacheKey, record, 120000);

      return record;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao buscar registro',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Buscar registro único do usuário para uma conexão específica
   * Implementa cache de 2 minutos para melhorar performance
   * Este método é usado para navegação direct-to-edit
   */
  async getUserRecord(userToken: string, connectionId: number): Promise<any> {
    const cacheKey = `user-record:${userToken}:${connectionId}`;

    // Try cache first
    const cached = connectionCache.get<any>(cacheKey);
    if (cached) {
      if (IS_DEVELOPMENT) {
        console.log('📦 Cache hit: user record', { connectionId });
      }
      return cached;
    }

    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.get<ApiResponse<any>>(
        `/user/database-connections/${connectionId}/record`
      );

      if (!response.success) {
        // Handle specific error codes
        if (response.code === DatabaseNavigationError.RECORD_NOT_FOUND) {
          throw new DatabaseNavigationException(
            response.error || 'Nenhum registro encontrado para sua conta',
            DatabaseNavigationError.RECORD_NOT_FOUND,
            response.data?.suggestion || 'Entre em contato com o administrador para criar um registro'
          );
        }

        if (response.code === DatabaseNavigationError.CONNECTION_NOT_FOUND) {
          throw new DatabaseNavigationException(
            response.error || 'Conexão não encontrada',
            DatabaseNavigationError.CONNECTION_NOT_FOUND
          );
        }

        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }

        throw new DatabaseNavigationException(
          response.error || 'Erro ao buscar registro do usuário',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      const record = response.data?.data;

      if (!record) {
        throw new DatabaseNavigationException(
          'Nenhum registro encontrado',
          DatabaseNavigationError.RECORD_NOT_FOUND,
          'Entre em contato com o administrador para criar um registro'
        );
      }

      // Cache for 2 minutes (120000ms)
      connectionCache.set(cacheKey, record, 120000);

      return record;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao buscar registro',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Buscar dados de uma tabela para um usuário específico
   * Implementa cache de 2 minutos para melhorar performance
   */
  async getUserTableData(userToken: string, connectionId: number): Promise<any[]> {
    const cacheKey = `user-table-data:${userToken}:${connectionId}`;

    // Try cache first
    const cached = connectionCache.get<any[]>(cacheKey);
    if (cached) {
      if (IS_DEVELOPMENT) {
        console.log('📦 Cache hit: user table data', { connectionId });
      }
      return cached;
    }

    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.get<ApiResponse<any[]>>(`/user/database-connections/${connectionId}/data`);

      if (!response.success) {
        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }
        throw new DatabaseNavigationException(
          response.error || 'Erro ao buscar dados da tabela',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      const data = response.data?.data || [];

      // Cache for 2 minutes (120000ms)
      connectionCache.set(cacheKey, data, 120000);

      return data;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao buscar dados',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Criar um novo registro na tabela do usuário
   * Invalida o cache após criação bem-sucedida
   */
  async createUserTableRecord(userToken: string, connectionId: number, data: Record<string, any>): Promise<any> {
    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.post<ApiResponse<any>>(`/user/database-connections/${connectionId}/data`, data);

      if (!response.success) {
        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }
        throw new DatabaseNavigationException(
          response.error || 'Erro ao criar registro',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      // Invalidate cache for this connection
      connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
      connectionCache.invalidate(`user-table-data:${userToken}:${connectionId}`);

      // Also invalidate field metadata cache
      const fieldMetadataPattern = new RegExp(`^field-metadata:${connectionId}:`);
      connectionCache.invalidatePattern(fieldMetadataPattern);

      if (IS_DEVELOPMENT) {
        console.log('🗑️ Cache invalidated after create (including field metadata)', { connectionId });
      }

      return response.data?.data;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao criar registro',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Atualizar um registro na tabela do usuário
   * Invalida o cache após atualização bem-sucedida
   */
  async updateUserTableRecord(userToken: string, connectionId: number, recordId: string, data: Record<string, any>): Promise<any> {
    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.put<ApiResponse<any>>(`/user/database-connections/${connectionId}/data/${recordId}`, data);

      if (!response.success) {
        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }
        throw new DatabaseNavigationException(
          response.error || 'Erro ao atualizar registro',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      // Invalidate cache for this specific record and table data
      connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
      connectionCache.invalidate(`user-record-by-id:${userToken}:${connectionId}:${recordId}`);
      connectionCache.invalidate(`user-table-data:${userToken}:${connectionId}`);

      // Also invalidate field metadata cache to ensure fresh schema on next load
      // This is important because the user might have changed field values that affect
      // select options or other metadata-dependent features
      const fieldMetadataPattern = new RegExp(`^field-metadata:${connectionId}:`);
      connectionCache.invalidatePattern(fieldMetadataPattern);

      if (IS_DEVELOPMENT) {
        console.log('🗑️ Cache invalidated after update (including field metadata)', { connectionId, recordId });
      }

      return response.data?.data;
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao atualizar registro',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Deletar um registro na tabela do usuário
   * Invalida o cache após deleção bem-sucedida
   */
  async deleteUserTableRecord(userToken: string, connectionId: number, recordId: string): Promise<void> {
    // Configurar header de autorização temporariamente
    backendApi.setAuthHeader(userToken);

    try {
      const response = await backendApi.delete<ApiResponse<any>>(`/user/database-connections/${connectionId}/data/${recordId}`);

      if (!response.success) {
        if (response.status === 401 || response.status === 403) {
          throw new DatabaseNavigationException(
            response.error || 'Acesso negado',
            DatabaseNavigationError.UNAUTHORIZED
          );
        }
        throw new DatabaseNavigationException(
          response.error || 'Erro ao deletar registro',
          DatabaseNavigationError.DATABASE_ERROR
        );
      }

      // Invalidate cache for this connection
      connectionCache.invalidate(`user-record:${userToken}:${connectionId}`);
      connectionCache.invalidate(`user-table-data:${userToken}:${connectionId}`);

      // Also invalidate field metadata cache
      const fieldMetadataPattern = new RegExp(`^field-metadata:${connectionId}:`);
      connectionCache.invalidatePattern(fieldMetadataPattern);

      if (IS_DEVELOPMENT) {
        console.log('🗑️ Cache invalidated after delete (including field metadata)', { connectionId, recordId });
      }
    } catch (error: any) {
      if (error instanceof DatabaseNavigationException) {
        throw error;
      }
      throw new DatabaseNavigationException(
        error.message || 'Erro de rede ao deletar registro',
        DatabaseNavigationError.NETWORK_ERROR
      );
    } finally {
      // Remover header após uso
      backendApi.removeAuthHeader();
    }
  }

  /**
   * Invalidar todo o cache relacionado a um usuário específico
   * Útil para logout ou quando o admin faz mudanças nas conexões
   */
  clearUserCache(userToken: string): void {
    const pattern = new RegExp(`^user-(connections|record|table-data):${userToken.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
    connectionCache.invalidatePattern(pattern);
    if (IS_DEVELOPMENT) {
      console.log('🗑️ All user cache cleared', { userToken: userToken.substring(0, 8) + '...' });
    }
  }

  /**
   * Invalidar cache de uma conexão específica para todos os usuários
   * Útil quando o admin atualiza configurações de uma conexão
   */
  clearConnectionCache(connectionId: number): void {
    const pattern = new RegExp(`:${connectionId}$`);
    connectionCache.invalidatePattern(pattern);
    if (IS_DEVELOPMENT) {
      console.log('🗑️ Connection cache cleared', { connectionId });
    }
  }

  /**
   * Limpar todo o cache
   * Útil para troubleshooting ou após atualizações importantes
   */
  clearAllCache(): void {
    connectionCache.clear();
    if (IS_DEVELOPMENT) {
      console.log('🗑️ All cache cleared');
    }
  }



  /**
   * Validar configuração de visualização
   * Verifica se os campos selecionados existem e são do tipo correto
   */
  validateViewConfiguration(
    viewConfig: ViewConfiguration | null | undefined,
    columns: NocoDBColumn[]
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Se não há configuração, é válido (campo opcional)
    if (!viewConfig) {
      return { valid: true, errors: [] };
    }

    // Validar configuração de calendário
    if (viewConfig.calendar?.enabled) {
      if (!viewConfig.calendar.dateField) {
        errors.push('Campo de data é obrigatório quando a visualização de calendário está habilitada');
      } else {
        const dateColumn = columns.find(
          col => col.column_name === viewConfig.calendar!.dateField
        );

        if (!dateColumn) {
          errors.push(`Campo de data '${viewConfig.calendar.dateField}' não encontrado na tabela`);
        } else {
          // Verificar se é um tipo de data válido
          const validDateTypes = ['Date', 'DateTime', 'CreatedTime', 'LastModifiedTime'];
          if (!validDateTypes.includes(dateColumn.uidt)) {
            errors.push(
              `Campo '${viewConfig.calendar.dateField}' não é do tipo Date/DateTime (tipo atual: ${dateColumn.uidt})`
            );
          }
        }
      }
    }

    // Validar configuração de kanban
    if (viewConfig.kanban?.enabled) {
      if (!viewConfig.kanban.statusField) {
        errors.push('Campo de status é obrigatório quando a visualização Kanban está habilitada');
      } else {
        const statusColumn = columns.find(
          col => col.column_name === viewConfig.kanban!.statusField
        );

        if (!statusColumn) {
          errors.push(`Campo de status '${viewConfig.kanban.statusField}' não encontrado na tabela`);
        }
        // Nota: Não validamos o tipo para kanban pois qualquer campo pode ser usado para agrupamento
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Obter colunas de data/datetime de uma tabela
   * Útil para popular dropdown de seleção de campo de calendário
   */
  getDateColumns(columns: NocoDBColumn[]): NocoDBColumn[] {
    return columns.filter(
      col =>
        col.uidt === 'Date' ||
        col.uidt === 'DateTime' ||
        col.uidt === 'CreatedTime' ||
        col.uidt === 'LastModifiedTime'
    );
  }

  /**
   * Obter colunas agrupáveis de uma tabela
   * Útil para popular dropdown de seleção de campo de kanban
   */
  getGroupableColumns(columns: NocoDBColumn[]): NocoDBColumn[] {
    return columns.filter(
      col =>
        col.uidt === 'SingleLineText' ||
        col.uidt === 'LongText' ||
        col.uidt === 'SingleSelect' ||
        col.uidt === 'MultiSelect'
    );
  }
}

// Instância padrão do serviço
export const databaseConnectionsService = new DatabaseConnectionsService();