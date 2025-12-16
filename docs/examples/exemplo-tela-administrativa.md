# Exemplo: Implementando Nova Tela Administrativa

Como criar uma tela administrativa completa no WUZAPI Manager.

## 🎯 Objetivo

Implementar uma tela administrativa para gerenciar campanhas de marketing que inclui:
- Lista de campanhas com paginação e filtros
- Formulário de criação/edição
- Ações em lote (ativar/desativar múltiplas)
- Visualização de métricas e estatísticas

## 📋 Estrutura

### Backend (já implementado)
- API REST em `/api/admin/campaigns`
- Endpoints: GET, POST, PUT, DELETE
- Filtros e paginação

### Frontend (a implementar)
- Página principal: `src/pages/admin/AdminCampaigns.tsx`
- Componentes: Lista, Formulário, Filtros
- Hooks: `useAdminCampaigns`
- Serviço: `campaignsService`

## 🔧 Implementação Frontend

### Passo 1: Gerar Estrutura Base

```bash
# Gerar página administrativa
npm run generate page AdminCampaigns

# Gerar serviço
npm run generate service campaignsService

# Gerar hook
npm run generate hook useAdminCampaigns
```

### Passo 2: Implementar Serviço

🔧 **Implementar** `src/services/campaignsService.ts`:
```typescript
import axios, { AxiosInstance } from 'axios';

export interface Campaign {
  id: string;
  name: string;
  description: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  target_audience: string;
  message_template: string;
  scheduled_at?: string;
  created_at: string;
  updated_at: string;
  stats: {
    sent: number;
    delivered: number;
    read: number;
    replied: number;
  };
}

export interface CampaignFilters {
  status?: string;
  search?: string;
  date_from?: string;
  date_to?: string;
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

class CampaignsService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: '/api/admin',
      timeout: 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    this.api.interceptors.request.use((config) => {
      const token = import.meta.env.VITE_ADMIN_TOKEN;
      if (token) {
        config.headers.Authorization = token;
      }
      return config;
    });

    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('Campaigns API Error:', error);
        throw error;
      }
    );
  }

  async getCampaigns(
    page = 1, 
    limit = 10, 
    filters: CampaignFilters = {}
  ): Promise<CampaignListResponse> {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...Object.fromEntries(
        Object.entries(filters).filter(([_, value]) => value)
      )
    });

    const response = await this.api.get(`/campaigns?${params}`);
    return response.data.data;
  }

  async getCampaign(id: string): Promise<Campaign> {
    const response = await this.api.get(`/campaigns/${id}`);
    return response.data.data;
  }

  async createCampaign(data: Partial<Campaign>): Promise<Campaign> {
    const response = await this.api.post('/campaigns', data);
    return response.data.data;
  }

  async updateCampaign(id: string, data: Partial<Campaign>): Promise<Campaign> {
    const response = await this.api.put(`/campaigns/${id}`, data);
    return response.data.data;
  }

  async deleteCampaign(id: string): Promise<void> {
    await this.api.delete(`/campaigns/${id}`);
  }

  async bulkUpdateStatus(ids: string[], status: Campaign['status']): Promise<void> {
    await this.api.post('/campaigns/bulk-update', { ids, status });
  }
}

export const campaignsService = new CampaignsService();
```#
## Passo 3: Implementar Hook Customizado

🔧 **Implementar** `src/hooks/useAdminCampaigns.ts`:
```typescript
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { 
  campaignsService, 
  Campaign, 
  CampaignFilters 
} from '@/services/campaignsService';

export const useAdminCampaigns = () => {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [filters, setFilters] = useState<CampaignFilters>({});
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const queryClient = useQueryClient();

  // Query para listar campanhas
  const {
    data: campaignsData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-campaigns', page, limit, filters],
    queryFn: () => campaignsService.getCampaigns(page, limit, filters),
    keepPreviousData: true,
  });

  // Mutation para criar campanha
  const createMutation = useMutation({
    mutationFn: campaignsService.createCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-campaigns']);
      toast.success('Campanha criada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao criar campanha');
    },
  });

  // Mutation para atualizar campanha
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Campaign> }) =>
      campaignsService.updateCampaign(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-campaigns']);
      toast.success('Campanha atualizada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar campanha');
    },
  });

  // Mutation para deletar campanha
  const deleteMutation = useMutation({
    mutationFn: campaignsService.deleteCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-campaigns']);
      toast.success('Campanha deletada com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao deletar campanha');
    },
  });

  // Mutation para ações em lote
  const bulkUpdateMutation = useMutation({
    mutationFn: ({ ids, status }: { ids: string[]; status: Campaign['status'] }) =>
      campaignsService.bulkUpdateStatus(ids, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['admin-campaigns']);
      setSelectedIds([]);
      toast.success('Campanhas atualizadas com sucesso!');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Erro ao atualizar campanhas');
    },
  });

  // Handlers
  const handlePageChange = useCallback((newPage: number) => {
    setPage(newPage);
  }, []);

  const handleFiltersChange = useCallback((newFilters: CampaignFilters) => {
    setFilters(newFilters);
    setPage(1); // Reset para primeira página
  }, []);

  const handleSelectCampaign = useCallback((id: string, selected: boolean) => {
    setSelectedIds(prev => 
      selected 
        ? [...prev, id]
        : prev.filter(selectedId => selectedId !== id)
    );
  }, []);

  const handleSelectAll = useCallback((selected: boolean) => {
    if (selected && campaignsData?.campaigns) {
      setSelectedIds(campaignsData.campaigns.map(c => c.id));
    } else {
      setSelectedIds([]);
    }
  }, [campaignsData?.campaigns]);

  const handleBulkStatusUpdate = useCallback((status: Campaign['status']) => {
    if (selectedIds.length === 0) {
      toast.error('Selecione pelo menos uma campanha');
      return;
    }

    bulkUpdateMutation.mutate({ ids: selectedIds, status });
  }, [selectedIds, bulkUpdateMutation]);

  return {
    // Data
    campaigns: campaignsData?.campaigns || [],
    total: campaignsData?.total || 0,
    totalPages: campaignsData?.totalPages || 0,
    page,
    limit,
    filters,
    selectedIds,
    
    // Loading states
    isLoading,
    isCreating: createMutation.isLoading,
    isUpdating: updateMutation.isLoading,
    isDeleting: deleteMutation.isLoading,
    isBulkUpdating: bulkUpdateMutation.isLoading,
    
    // Error
    error,
    
    // Actions
    createCampaign: createMutation.mutate,
    updateCampaign: updateMutation.mutate,
    deleteCampaign: deleteMutation.mutate,
    refetch,
    
    // Handlers
    handlePageChange,
    handleFiltersChange,
    handleSelectCampaign,
    handleSelectAll,
    handleBulkStatusUpdate,
  };
};
```