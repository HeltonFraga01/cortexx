import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { WuzAPIInstance, CreateInstancePayload, WuzAPIInstanceStatus } from '@/lib/wuzapi-types';
import { useWuzAPIAuth } from './WuzAPIAuthContext';
import { toast } from 'sonner';

interface WuzAPIInstancesContextType {
  instances: WuzAPIInstance[];
  loading: boolean;
  error: string | null;
  
  // Ações
  loadInstances: () => Promise<void>;
  createInstance: (payload: CreateInstancePayload) => Promise<boolean>;
  deleteInstance: (instanceName: string) => Promise<boolean>;
  connectInstance: (instanceName: string) => Promise<boolean>;
  disconnectInstance: (instanceName: string) => Promise<boolean>;
  getInstanceQRCode: (instanceName: string) => Promise<string | null>;
  refreshInstance: (instanceName: string) => Promise<void>;
  
  // Estado
  selectedInstance: WuzAPIInstance | null;
  setSelectedInstance: (instance: WuzAPIInstance | null) => void;
}

const WuzAPIInstancesContext = createContext<WuzAPIInstancesContextType | undefined>(undefined);

export function WuzAPIInstancesProvider({ children }: { children: React.ReactNode }) {
  const { wuzapiClient, isAuthenticated } = useWuzAPIAuth();
  const [instances, setInstances] = useState<WuzAPIInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedInstance, setSelectedInstance] = useState<WuzAPIInstance | null>(null);

  // Carrega lista de instâncias
  const loadInstances = useCallback(async () => {
    if (!wuzapiClient || !isAuthenticated) {
      setInstances([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await wuzapiClient.listInstances();
      
      if (response.success && response.data) {
        setInstances(response.data);
      } else {
        throw new Error(response.error || 'Erro ao carregar instâncias');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error('Erro ao carregar instâncias', {
        description: errorMessage
      });
    } finally {
      setLoading(false);
    }
  }, [wuzapiClient, isAuthenticated]);

  // Cria nova instância
  const createInstance = useCallback(async (payload: CreateInstancePayload): Promise<boolean> => {
    if (!wuzapiClient) {
      toast.error('Cliente não inicializado');
      return false;
    }

    try {
      const response = await wuzapiClient.createInstance(payload);
      
      if (response.success) {
        toast.success('Instância criada com sucesso');
        await loadInstances(); // Recarrega a lista
        return true;
      } else {
        throw new Error(response.error || 'Erro ao criar instância');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao criar instância', {
        description: errorMessage
      });
      return false;
    }
  }, [wuzapiClient, loadInstances]);

  // Remove instância
  const deleteInstance = useCallback(async (instanceName: string): Promise<boolean> => {
    if (!wuzapiClient) {
      toast.error('Cliente não inicializado');
      return false;
    }

    try {
      const response = await wuzapiClient.deleteInstance(instanceName);
      
      if (response.success) {
        toast.success('Instância removida com sucesso');
        
        // Remove da lista local
        setInstances(prev => prev.filter(instance => instance.name !== instanceName));
        
        // Remove da seleção se for a instância selecionada
        if (selectedInstance?.name === instanceName) {
          setSelectedInstance(null);
        }
        
        return true;
      } else {
        throw new Error(response.error || 'Erro ao remover instância');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao remover instância', {
        description: errorMessage
      });
      return false;
    }
  }, [wuzapiClient, selectedInstance]);

  // Conecta instância
  const connectInstance = useCallback(async (instanceName: string): Promise<boolean> => {
    if (!wuzapiClient) {
      toast.error('Cliente não inicializado');
      return false;
    }

    try {
      // Atualiza status local para "connecting"
      setInstances(prev => prev.map(instance => 
        instance.name === instanceName 
          ? { ...instance, status: 'connecting' as WuzAPIInstanceStatus }
          : instance
      ));

      const response = await wuzapiClient.connectInstance(instanceName);
      
      if (response.success) {
        toast.success('Conectando instância...');
        
        // Aguarda um pouco e atualiza o status
        setTimeout(() => {
          refreshInstance(instanceName);
        }, 2000);
        
        return true;
      } else {
        throw new Error(response.error || 'Erro ao conectar instância');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao conectar instância', {
        description: errorMessage
      });
      
      // Reverte status em caso de erro
      await refreshInstance(instanceName);
      return false;
    }
  }, [wuzapiClient]);

  // Desconecta instância
  const disconnectInstance = useCallback(async (instanceName: string): Promise<boolean> => {
    if (!wuzapiClient) {
      toast.error('Cliente não inicializado');
      return false;
    }

    try {
      const response = await wuzapiClient.disconnectInstance(instanceName);
      
      if (response.success) {
        toast.success('Instância desconectada');
        
        // Atualiza status local
        setInstances(prev => prev.map(instance => 
          instance.name === instanceName 
            ? { ...instance, status: 'disconnected' as WuzAPIInstanceStatus }
            : instance
        ));
        
        return true;
      } else {
        throw new Error(response.error || 'Erro ao desconectar instância');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao desconectar instância', {
        description: errorMessage
      });
      return false;
    }
  }, [wuzapiClient]);

  // Obtém QR Code da instância
  const getInstanceQRCode = useCallback(async (instanceName: string): Promise<string | null> => {
    if (!wuzapiClient) {
      toast.error('Cliente não inicializado');
      return null;
    }

    try {
      const response = await wuzapiClient.getInstanceQRCode(instanceName);
      
      if (response.success && response.data?.qr_code) {
        return response.data.qr_code;
      } else {
        throw new Error(response.error || 'QR Code não disponível');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      toast.error('Erro ao obter QR Code', {
        description: errorMessage
      });
      return null;
    }
  }, [wuzapiClient]);

  // Atualiza informações de uma instância específica
  const refreshInstance = useCallback(async (instanceName: string) => {
    if (!wuzapiClient) return;

    try {
      const response = await wuzapiClient.getInstance(instanceName);
      
      if (response.success && response.data) {
        setInstances(prev => prev.map(instance => 
          instance.name === instanceName ? response.data! : instance
        ));
        
        // Atualiza instância selecionada se for a mesma
        if (selectedInstance?.name === instanceName) {
          setSelectedInstance(response.data);
        }
      }
    } catch (err) {
      console.error('Erro ao atualizar instância:', err);
    }
  }, [wuzapiClient, selectedInstance]);

  // Carrega instâncias quando o cliente estiver disponível
  useEffect(() => {
    if (isAuthenticated) {
      loadInstances();
    } else {
      setInstances([]);
      setSelectedInstance(null);
    }
  }, [isAuthenticated, loadInstances]);

  // Auto-seleciona a primeira instância conectada se nenhuma estiver selecionada
  useEffect(() => {
    if (instances.length > 0 && !selectedInstance) {
      const connectedInstance = instances.find(i => i.status === 'connected');
      if (connectedInstance) {
        setSelectedInstance(connectedInstance);
      } else {
        // Se não houver instância conectada, seleciona a primeira
        setSelectedInstance(instances[0]);
      }
    }
  }, [instances, selectedInstance]);

  const value: WuzAPIInstancesContextType = {
    instances,
    loading,
    error,
    loadInstances,
    createInstance,
    deleteInstance,
    connectInstance,
    disconnectInstance,
    getInstanceQRCode,
    refreshInstance,
    selectedInstance,
    setSelectedInstance,
  };

  return (
    <WuzAPIInstancesContext.Provider value={value}>
      {children}
    </WuzAPIInstancesContext.Provider>
  );
}

export function useWuzAPIInstances() {
  const context = useContext(WuzAPIInstancesContext);
  if (context === undefined) {
    throw new Error('useWuzAPIInstances must be used within a WuzAPIInstancesProvider');
  }
  return context;
}