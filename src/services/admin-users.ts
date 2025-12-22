import { backendApi } from './api-client';

export interface SupabaseUser {
  id: string;
  email?: string;
  phone?: string;
  email_confirmed_at?: string;
  last_sign_in_at?: string;
  user_metadata?: Record<string, any>;
  created_at: string;
  updated_at?: string;
}

export interface CreateSupabaseUserDTO {
  email: string;
  password: string;
  email_confirm?: boolean;
  phone?: string;
  phone_confirm?: boolean;
  user_metadata?: Record<string, any>;
}

export interface UpdateSupabaseUserDTO {
  email?: string;
  password?: string;
  email_confirm?: boolean;
  phone?: string;
  phone_confirm?: boolean;
  user_metadata?: Record<string, any>;
}

class AdminUsersService {
  private static instance: AdminUsersService;

  public static getInstance(): AdminUsersService {
    if (!AdminUsersService.instance) {
      AdminUsersService.instance = new AdminUsersService();
    }
    return AdminUsersService.instance;
  }

  /**
   * Listar usuários do Supabase
   */
  async listUsers(page = 1, perPage = 50, search = ''): Promise<SupabaseUser[]> {
    try {
      const response = await backendApi.get<{ data: SupabaseUser[] }>(
        '/admin/supabase/users',
        { params: { page, per_page: perPage, search } }
      );
      if (!response.success) throw new Error(response.error);
      return response.data?.data || [];
    } catch (error) {
      console.error('Erro ao listar usuários:', error);
      throw error;
    }
  }

  /**
   * Obter usuário específico por ID
   */
  async getUser(id: string): Promise<SupabaseUser> {
    try {
      const response = await backendApi.get<{ data: SupabaseUser }>(
        `/admin/supabase/users/${id}`
      );
      if (!response.success) throw new Error(response.error);
      if (!response.data?.data) throw new Error('Dados não retornados da API');
      return response.data.data;
    } catch (error) {
      console.error('Erro ao obter usuário:', error);
      throw error;
    }
  }

  /**
   * Criar novo usuário no Supabase
   */
  async createUser(data: CreateSupabaseUserDTO): Promise<SupabaseUser> {
    try {
      const response = await backendApi.post<{ data: SupabaseUser }>(
        '/admin/supabase/users',
        data
      );
      if (!response.success) throw new Error(response.error);
      if (!response.data?.data) throw new Error('Dados não retornados da API');
      return response.data.data;
    } catch (error) {
      console.error('Erro ao criar usuário:', error);
      throw error;
    }
  }

  /**
   * Atualizar usuário no Supabase
   */
  async updateUser(id: string, data: UpdateSupabaseUserDTO): Promise<SupabaseUser> {
    try {
      const response = await backendApi.put<{ data: SupabaseUser }>(
        `/admin/supabase/users/${id}`,
        data
      );
      if (!response.success) throw new Error(response.error);
      if (!response.data?.data) throw new Error('Dados não retornados da API');
      return response.data.data;
    } catch (error) {
      console.error('Erro ao atualizar usuário:', error);
      throw error;
    }
  }

  /**
   * Deletar usuário do Supabase
   */
  async deleteUser(id: string): Promise<void> {
    try {
      const response = await backendApi.delete(`/admin/supabase/users/${id}`);
      if (!response.success) throw new Error(response.error);
    } catch (error) {
      console.error('Erro ao deletar usuário:', error);
      throw error;
    }
  }
}

export const adminUsersService = AdminUsersService.getInstance();
