import { backendApi } from './api-client';

export interface Contact {
    id?: number;
    phone: string;
    name?: string;
    variables?: Record<string, any>;
}

export interface ContactList {
    id: number;
    name: string;
    description?: string;
    total_contacts: number;
    created_at: string;
    contacts?: Contact[];
}

export const contactListService = {
    getAll: async (): Promise<ContactList[]> => {
        const response = await backendApi.get<{ success: boolean; data: ContactList[] }>('/user/contact-lists');
        if (!response.success || !response.data) {
            throw new Error('Falha ao carregar listas de contatos');
        }
        return response.data.data;
    },

    getById: async (id: number): Promise<ContactList> => {
        const response = await backendApi.get<{ success: boolean; data: ContactList }>(`/user/contact-lists/${id}`);
    if (!response.success || !response.data) {
      throw new Error('Falha ao carregar lista de contatos');
    }
    return response.data.data;
  },

  create: async (data: { name: string; description?: string; contacts: Contact[] }): Promise<ContactList> => {
    const response = await backendApi.post<{ success: boolean; data: ContactList }>('/user/contact-lists', data);
    if (!response.success || !response.data) {
      throw new Error('Falha ao criar lista de contatos');
    }
    return response.data.data;
  },

  delete: async (id: number): Promise<void> => {
    const response = await backendApi.delete<{ success: boolean }>(`/user/contact-lists/${id}`);
    if (!response.success) {
      throw new Error('Falha ao deletar lista de contatos');
    }
  }
};
