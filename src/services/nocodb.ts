import axios, { AxiosInstance } from 'axios';
import { getEnvConfig } from '@/lib/env-config';

export interface UserConfig {
  Id?: number;
  wasendToken: string;
  AssasToken?: string;
  ChatWootToken?: string;
  fone?: string;
  site?: string;
  email?: string;
  nome?: string;
  [key: string]: any; // Para campos adicionais
}

export class NocoDBService {
  private api: AxiosInstance;
  private baseURL: string;
  private token: string;
  private projectId: string;
  private tableId: string;

  constructor(
    baseURL?: string,
    token?: string,
    projectId?: string,
    tableId?: string
  ) {
    // Load from environment config - no hardcoded credentials
    const envConfig = getEnvConfig();
    
    this.baseURL = baseURL || envConfig.nocodbBaseUrl;
    this.token = token || envConfig.nocodbToken;
    this.projectId = projectId || envConfig.nocodbProjectId;
    this.tableId = tableId || envConfig.nocodbTableId;

    this.api = axios.create({
      baseURL: this.baseURL,
      headers: {
        'xc-token': this.token,
        'Content-Type': 'application/json',
      },
    });
  }

  /**
   * Busca a configuração do usuário pelo wasendToken
   */
  async getUserConfig(wasendToken: string): Promise<UserConfig | null> {
    try {
      const response = await this.api.get(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}`,
        {
          params: {
            where: `(wasendToken,eq,${wasendToken})`,
            limit: 1,
          },
        }
      );

      if (response.data?.list && response.data.list.length > 0) {
        return response.data.list[0];
      }

      return null;
    } catch (error) {
      console.error('Erro ao buscar configuração do usuário:', error);
      throw new Error('Falha ao carregar configurações do NocoDB');
    }
  }

  /**
   * Atualiza a configuração do usuário
   */
  async updateUserConfig(rowId: number, data: Partial<UserConfig>): Promise<UserConfig> {
    try {
      // Remove o Id e wasendToken dos dados a serem atualizados
      const { Id, wasendToken, ...updateData } = data;

      const response = await this.api.patch(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/${rowId}`,
        updateData
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao atualizar configuração do usuário:', error);
      throw new Error('Falha ao salvar configurações no NocoDB');
    }
  }

  /**
   * Cria uma nova configuração de usuário
   */
  async createUserConfig(data: UserConfig): Promise<UserConfig> {
    try {
      const response = await this.api.post(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}`,
        data
      );

      return response.data;
    } catch (error) {
      console.error('Erro ao criar configuração do usuário:', error);
      throw new Error('Falha ao criar configurações no NocoDB');
    }
  }

  /**
   * Lista todas as configurações (apenas para admin)
   */
  async listAllConfigs(offset = 0, limit = 25): Promise<UserConfig[]> {
    try {
      const response = await this.api.get(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}`,
        {
          params: {
            offset,
            limit,
          },
        }
      );

      return response.data.list || [];
    } catch (error) {
      console.error('Erro ao listar configurações:', error);
      throw new Error('Falha ao listar configurações do NocoDB');
    }
  }

  /**
   * Deleta uma configuração de usuário
   */
  async deleteUserConfig(rowId: number): Promise<void> {
    try {
      await this.api.delete(
        `/api/v1/db/data/noco/${this.projectId}/${this.tableId}/${rowId}`
      );
    } catch (error) {
      console.error('Erro ao deletar configuração do usuário:', error);
      throw new Error('Falha ao deletar configurações do NocoDB');
    }
  }
}

// Instância padrão do serviço
export const nocoDBService = new NocoDBService();
