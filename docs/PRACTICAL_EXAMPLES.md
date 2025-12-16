# Exemplos Práticos de Implementação

Este documento fornece exemplos práticos e detalhados de como implementar funcionalidades comuns no WUZAPI Manager, seguindo os padrões estabelecidos.

## 📋 Índice

- [Exemplo 1: Sistema de Grupos WhatsApp](#exemplo-1-sistema-de-grupos-whatsapp)
- [Exemplo 2: Integração com API Externa](#exemplo-2-integração-com-api-externa)
- [Exemplo 3: Dashboard com Métricas](#exemplo-3-dashboard-com-métricas)
- [Exemplo 4: Sistema de Upload de Arquivos](#exemplo-4-sistema-de-upload-de-arquivos)
- [Exemplo 5: WebSocket para Tempo Real](#exemplo-5-websocket-para-tempo-real)
- [Padrões Comuns](#padrões-comuns)
- [Troubleshooting](#troubleshooting)

## Exemplo 1: Sistema de Grupos WhatsApp

### Objetivo
Implementar um sistema completo para gerenciar grupos WhatsApp, incluindo criação, listagem, adição/remoção de membros e configurações.

### Estrutura Planejada
```
Backend:
- /api/admin/groups (CRUD grupos)
- /api/admin/groups/:id/members (gerenciar membros)
- /api/user/groups (grupos do usuário)

Frontend:
- AdminGroups (página administrativa)
- UserGroups (página do usuário)
- GroupCard (componente reutilizável)
- useGroups (hook personalizado)
```

### Implementação Passo-a-Passo

#### 1. Backend - Estrutura de Dados
```sql
-- Adicionar ao schema do banco
CREATE TABLE whatsapp_groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  admin_user_token TEXT NOT NULL,
  member_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE group_members (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  group_id TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member' CHECK(role IN ('admin', 'member')),
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (group_id) REFERENCES whatsapp_groups(group_id)
);
```###
# 2. Backend - Gerar e Implementar Rotas

```bash
# Gerar rota administrativa para grupos
npm run generate route admin-groups
# Selecionar: Administrativa, GET, groups, "Gerenciar grupos WhatsApp"

# Gerar rota para membros
npm run generate route admin-group-members
# Selecionar: Administrativa, POST, groups/:id/members, "Gerenciar membros do grupo"
```

#### 3. Backend - Implementar Lógica de Grupos

```javascript
// server/routes/admin-groupsRoutes.js

// Listar grupos
const groups = await db.query(`
  SELECT g.*, COUNT(m.id) as member_count 
  FROM whatsapp_groups g 
  LEFT JOIN group_members m ON g.group_id = m.group_id 
  WHERE g.admin_user_token = ? 
  GROUP BY g.id 
  ORDER BY g.created_at DESC
`, [userToken]);

// Criar grupo via WUZAPI
const wuzapiClient = require('../utils/wuzapiClient');
const groupData = await wuzapiClient.createGroup(userToken, {
  name: requestData.name,
  description: requestData.description,
  members: requestData.members || []
});

// Salvar no banco local
const result = await db.query(`
  INSERT INTO whatsapp_groups (group_id, name, description, admin_user_token) 
  VALUES (?, ?, ?, ?)
`, [groupData.id, requestData.name, requestData.description, userToken]);
```

#### 4. Frontend - Gerar Estrutura

```bash
# Gerar serviço
npm run generate service groupsService
# Configurar: Group, GroupsService, group, groups

# Gerar hook
npm run generate hook useGroups
# Tipo: Group, API: Sim, CRUD: Sim

# Gerar página administrativa
npm run generate page AdminGroups
# Template: Administrativa, Formulário: Sim, CRUD: Sim, Busca: Sim
```#### 5. Fr
ontend - Implementar Tipos e Interfaces

```typescript
// src/services/groupsService.ts

export interface WhatsAppGroup {
  id: string;
  group_id: string;
  name: string;
  description?: string;
  member_count: number;
  status: 'active' | 'inactive';
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  id: string;
  phone_number: string;
  name?: string;
  role: 'admin' | 'member';
  joined_at: string;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
  members?: string[]; // Array de números de telefone
}
```

#### 6. Frontend - Implementar Serviço

```typescript
// Implementar métodos específicos do serviço

async createGroup(data: CreateGroupRequest): Promise<WhatsAppGroup> {
  try {
    this.validateCreateData(data);
    const response = await this.api.post<ApiResponse<WhatsAppGroup>>('/admin/groups', data);
    
    if (!response.data) {
      throw new Error('Resposta inválida do servidor');
    }

    return response.data;
  } catch (error) {
    console.error('Erro ao criar grupo:', error);
    throw error;
  }
}

async getGroupMembers(groupId: string): Promise<GroupMember[]> {
  try {
    const response = await this.api.get<ApiResponse<GroupMember[]>>(`/admin/groups/${groupId}/members`);
    return response.data || [];
  } catch (error) {
    console.error('Erro ao buscar membros do grupo:', error);
    throw error;
  }
}
```#
### 7. Frontend - Implementar Página AdminGroups

```typescript
// src/pages/AdminGroups.tsx

const AdminGroups = () => {
  const [groups, setGroups] = useState<WhatsAppGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<WhatsAppGroup | null>(null);
  const [showMembersModal, setShowMembersModal] = useState(false);
  
  const groupsService = new GroupsService();

  const handleCreateGroup = async (formData: CreateGroupRequest) => {
    try {
      const newGroup = await groupsService.create(formData);
      setGroups(prev => [newGroup, ...prev]);
      toast.success('Grupo criado com sucesso!');
      setShowCreateForm(false);
    } catch (error) {
      console.error('Erro ao criar grupo:', error);
      toast.error('Erro ao criar grupo');
    }
  };

  const handleViewMembers = (group: WhatsAppGroup) => {
    setSelectedGroup(group);
    setShowMembersModal(true);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Gerenciar Grupos WhatsApp</h1>
          <p className="text-muted-foreground">
            Gerencie grupos WhatsApp e seus membros
          </p>
        </div>
        <Button onClick={() => setShowCreateForm(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Novo Grupo
        </Button>
      </div>

      {/* Cards de estatísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Grupos</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{groups.length}</div>
            <p className="text-xs text-muted-foreground">
              {groups.filter(g => g.status === 'active').length} ativos
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Lista de grupos */}
      <Card>
        <CardHeader>
          <CardTitle>Grupos WhatsApp</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {groups.map((group) => (
              <div key={group.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                    <Users className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <h3 className="font-medium">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {group.member_count} membros • Criado em {new Date(group.created_at).toLocaleDateString('pt-BR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant={group.status === 'active' ? 'default' : 'secondary'}>
                    {group.status === 'active' ? 'Ativo' : 'Inativo'}
                  </Badge>
                  <Button variant="outline" size="sm" onClick={() => handleViewMembers(group)}>
                    <Users className="h-4 w-4 mr-2" />
                    Membros
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```## Exemplo
 2: Integração com API Externa

### Objetivo
Implementar integração com uma API externa de CEP para autocompletar endereços.

### Implementação

#### 1. Backend - Criar Rota de Integração

```bash
npm run generate route integration-cep
# Selecionar: Integração externa, GET, cep/:cep, "Buscar dados de CEP"
```

#### 2. Backend - Implementar Cliente da API

```javascript
// server/utils/cepClient.js

class CEPClient {
  constructor() {
    this.baseURL = 'https://viacep.com.br/ws';
    this.timeout = 5000;
  }

  async getCEP(cep) {
    try {
      // Validar formato do CEP
      const cleanCEP = cep.replace(/\D/g, '');
      if (cleanCEP.length !== 8) {
        throw new Error('CEP deve ter 8 dígitos');
      }

      const axios = require('axios');
      const response = await axios.get(`${this.baseURL}/${cleanCEP}/json/`, {
        timeout: this.timeout
      });

      if (response.data.erro) {
        throw new Error('CEP não encontrado');
      }

      return {
        cep: response.data.cep,
        logradouro: response.data.logradouro,
        bairro: response.data.bairro,
        cidade: response.data.localidade,
        uf: response.data.uf,
        ibge: response.data.ibge
      };
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        throw new Error('Serviço de CEP indisponível');
      }
      throw error;
    }
  }
}

module.exports = new CEPClient();
```

#### 3. Frontend - Implementar Hook de CEP

```typescript
// src/hooks/useCEP.ts

import { useState, useCallback } from 'react';
import axios from 'axios';

interface CEPData {
  cep: string;
  logradouro: string;
  bairro: string;
  cidade: string;
  uf: string;
}

export const useCEP = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchCEP = useCallback(async (cep: string): Promise<CEPData | null> => {
    if (!cep || cep.length < 8) {
      return null;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`/api/integration/cep/${cep}`);
      
      if (response.data.success) {
        return response.data.data;
      } else {
        throw new Error(response.data.error || 'Erro ao buscar CEP');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar CEP';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { fetchCEP, loading, error };
};
```#### 4. Fr
ontend - Componente de Endereço com Autocompletar

```typescript
// src/components/shared/AddressForm.tsx

import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCEP } from '@/hooks/useCEP';
import { toast } from 'sonner';

interface AddressData {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
}

interface AddressFormProps {
  value: AddressData;
  onChange: (address: AddressData) => void;
}

const AddressForm = ({ value, onChange }: AddressFormProps) => {
  const { fetchCEP, loading } = useCEP();
  const [cepTimer, setCepTimer] = useState<NodeJS.Timeout | null>(null);

  const handleCEPChange = (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, '');
    const formattedCEP = cleanCEP.replace(/(\d{5})(\d{3})/, '$1-$2');
    
    onChange({ ...value, cep: formattedCEP });

    // Debounce para buscar CEP
    if (cepTimer) {
      clearTimeout(cepTimer);
    }

    if (cleanCEP.length === 8) {
      const timer = setTimeout(async () => {
        const cepData = await fetchCEP(cleanCEP);
        if (cepData) {
          onChange({
            ...value,
            cep: formattedCEP,
            logradouro: cepData.logradouro,
            bairro: cepData.bairro,
            cidade: cepData.cidade,
            uf: cepData.uf
          });
          toast.success('Endereço preenchido automaticamente');
        }
      }, 500);
      setCepTimer(timer);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div>
        <Label htmlFor="cep">CEP</Label>
        <Input
          id="cep"
          placeholder="00000-000"
          value={value.cep}
          onChange={(e) => handleCEPChange(e.target.value)}
          maxLength={9}
        />
        {loading && <p className="text-xs text-muted-foreground mt-1">Buscando CEP...</p>}
      </div>

      <div>
        <Label htmlFor="logradouro">Logradouro</Label>
        <Input
          id="logradouro"
          placeholder="Rua, Avenida..."
          value={value.logradouro}
          onChange={(e) => onChange({ ...value, logradouro: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="numero">Número</Label>
        <Input
          id="numero"
          placeholder="123"
          value={value.numero}
          onChange={(e) => onChange({ ...value, numero: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="complemento">Complemento</Label>
        <Input
          id="complemento"
          placeholder="Apto, Sala..."
          value={value.complemento}
          onChange={(e) => onChange({ ...value, complemento: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="bairro">Bairro</Label>
        <Input
          id="bairro"
          placeholder="Centro"
          value={value.bairro}
          onChange={(e) => onChange({ ...value, bairro: e.target.value })}
        />
      </div>

      <div>
        <Label htmlFor="cidade">Cidade</Label>
        <Input
          id="cidade"
          placeholder="São Paulo"
          value={value.cidade}
          onChange={(e) => onChange({ ...value, cidade: e.target.value })}
        />
      </div>
    </div>
  );
};

export default AddressForm;
```## Exemp
lo 3: Dashboard com Métricas

### Objetivo
Criar um dashboard administrativo com métricas em tempo real e gráficos interativos.

### Implementação

#### 1. Backend - Rota de Métricas

```bash
npm run generate route admin-metrics
# Selecionar: Administrativa, GET, metrics, "Buscar métricas do sistema"
```

#### 2. Backend - Implementar Cálculo de Métricas

```javascript
// server/routes/admin-metricsRoutes.js

const getSystemMetrics = async (userToken, period = '7d') => {
  const db = req.app.locals.db;
  
  // Definir período
  const periodMap = {
    '24h': 1,
    '7d': 7,
    '30d': 30,
    '90d': 90
  };
  
  const days = periodMap[period] || 7;
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  // Métricas de usuários
  const userMetrics = await db.query(`
    SELECT 
      COUNT(*) as total_users,
      COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_users,
      COUNT(CASE WHEN status = 'active' THEN 1 END) as active_users
    FROM users 
    WHERE admin_token = ?
  `, [startDate.toISOString(), userToken]);

  // Métricas de mensagens
  const messageMetrics = await db.query(`
    SELECT 
      COUNT(*) as total_messages,
      COUNT(CASE WHEN created_at >= ? THEN 1 END) as recent_messages,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_messages,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_messages
    FROM messages 
    WHERE user_token = ? AND created_at >= ?
  `, [startDate.toISOString(), userToken, startDate.toISOString()]);

  // Métricas por dia (para gráficos)
  const dailyMetrics = await db.query(`
    SELECT 
      DATE(created_at) as date,
      COUNT(*) as message_count,
      COUNT(CASE WHEN status = 'sent' THEN 1 END) as sent_count
    FROM messages 
    WHERE user_token = ? AND created_at >= ?
    GROUP BY DATE(created_at)
    ORDER BY date
  `, [userToken, startDate.toISOString()]);

  return {
    users: userMetrics.rows[0],
    messages: messageMetrics.rows[0],
    daily: dailyMetrics.rows,
    period: period,
    generated_at: new Date().toISOString()
  };
};
```

#### 3. Frontend - Hook de Métricas

```typescript
// src/hooks/useMetrics.ts

import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

interface SystemMetrics {
  users: {
    total_users: number;
    new_users: number;
    active_users: number;
  };
  messages: {
    total_messages: number;
    recent_messages: number;
    sent_messages: number;
    failed_messages: number;
  };
  daily: Array<{
    date: string;
    message_count: number;
    sent_count: number;
  }>;
  period: string;
  generated_at: string;
}

export const useMetrics = (period: string = '7d') => {
  const [metrics, setMetrics] = useState<SystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await axios.get(`/api/admin/metrics?period=${period}`);
      
      if (response.data.success) {
        setMetrics(response.data.data);
      } else {
        throw new Error(response.data.error || 'Erro ao buscar métricas');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao buscar métricas';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchMetrics();
    
    // Atualizar métricas a cada 5 minutos
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  return { metrics, loading, error, refresh: fetchMetrics };
};
```###
# 4. Frontend - Dashboard com Gráficos

```typescript
// src/pages/AdminDashboard.tsx

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Users, MessageSquare, TrendingUp, AlertCircle } from 'lucide-react';
import { useMetrics } from '@/hooks/useMetrics';

const AdminDashboard = () => {
  const [period, setPeriod] = useState('7d');
  const { metrics, loading, error, refresh } = useMetrics(period);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-4">
        <div className="flex items-center">
          <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
          <p className="text-red-800">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">
            Visão geral das métricas do sistema
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">24 horas</SelectItem>
              <SelectItem value="7d">7 dias</SelectItem>
              <SelectItem value="30d">30 dias</SelectItem>
              <SelectItem value="90d">90 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Cards de métricas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Usuários</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.users.total_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              +{metrics?.users.new_users || 0} novos usuários
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Usuários Ativos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.users.active_users || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.users.total_users ? 
                Math.round((metrics.users.active_users / metrics.users.total_users) * 100) : 0}% do total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Mensagens Enviadas</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics?.messages.sent_messages || 0}</div>
            <p className="text-xs text-muted-foreground">
              {metrics?.messages.recent_messages || 0} no período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Sucesso</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {metrics?.messages.total_messages ? 
                Math.round((metrics.messages.sent_messages / metrics.messages.total_messages) * 100) : 0}%
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics?.messages.failed_messages || 0} falhas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de mensagens por dia */}
      <Card>
        <CardHeader>
          <CardTitle>Mensagens por Dia</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={metrics?.daily || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="date" 
                tickFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
              />
              <YAxis />
              <Tooltip 
                labelFormatter={(value) => new Date(value).toLocaleDateString('pt-BR')}
                formatter={(value, name) => [value, name === 'message_count' ? 'Total' : 'Enviadas']}
              />
              <Line 
                type="monotone" 
                dataKey="message_count" 
                stroke="#8884d8" 
                strokeWidth={2}
                name="Total"
              />
              <Line 
                type="monotone" 
                dataKey="sent_count" 
                stroke="#82ca9d" 
                strokeWidth={2}
                name="Enviadas"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminDashboard;
```#
# Padrões Comuns

### 1. Tratamento de Erros Consistente

```typescript
// Hook padrão para operações CRUD
const useCRUDOperations = <T>(service: any) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const executeOperation = async (operation: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true);
      setError(null);
      const result = await operation();
      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';
      setError(errorMessage);
      toast.error(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { executeOperation, loading, error };
};
```

### 2. Validação de Formulários

```typescript
// Hook de validação reutilizável
const useFormValidation = <T>(initialData: T, validationRules: ValidationRules<T>) => {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});

  const validate = (): boolean => {
    const newErrors: Partial<Record<keyof T, string>> = {};
    
    Object.entries(validationRules).forEach(([field, rules]) => {
      const value = data[field as keyof T];
      
      if (rules.required && (!value || String(value).trim() === '')) {
        newErrors[field as keyof T] = `${field} é obrigatório`;
      }
      
      if (rules.minLength && String(value).length < rules.minLength) {
        newErrors[field as keyof T] = `${field} deve ter pelo menos ${rules.minLength} caracteres`;
      }
      
      if (rules.pattern && !rules.pattern.test(String(value))) {
        newErrors[field as keyof T] = rules.message || `${field} inválido`;
      }
    });
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  return { data, setData, errors, validate };
};
```

### 3. Cache e Performance

```typescript
// Hook com cache simples
const useCachedData = <T>(key: string, fetcher: () => Promise<T>, ttl: number = 5 * 60 * 1000) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchData = useCallback(async (forceRefresh = false) => {
    const cached = localStorage.getItem(key);
    const cacheTime = localStorage.getItem(`${key}_time`);
    
    if (!forceRefresh && cached && cacheTime) {
      const age = Date.now() - parseInt(cacheTime);
      if (age < ttl) {
        setData(JSON.parse(cached));
        return;
      }
    }

    try {
      setLoading(true);
      const result = await fetcher();
      setData(result);
      localStorage.setItem(key, JSON.stringify(result));
      localStorage.setItem(`${key}_time`, Date.now().toString());
    } catch (error) {
      console.error('Erro ao buscar dados:', error);
    } finally {
      setLoading(false);
    }
  }, [key, fetcher, ttl]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, refresh: () => fetchData(true) };
};
```

## Troubleshooting

### Problemas Comuns e Soluções

#### 1. Erro de CORS
```javascript
// server/index.js
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://seu-dominio.com'] 
    : ['http://localhost:8080'],
  credentials: true
}));
```

#### 2. Token Expirado
```typescript
// Interceptor para renovar token automaticamente
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      // Tentar renovar token
      try {
        const newToken = await refreshToken();
        localStorage.setItem('userToken', newToken);
        // Repetir requisição original
        return axios.request(error.config);
      } catch (refreshError) {
        // Redirecionar para login
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

#### 3. Performance de Listas Grandes
```typescript
// Implementar paginação virtual
import { FixedSizeList as List } from 'react-window';

const VirtualizedList = ({ items }) => {
  const Row = ({ index, style }) => (
    <div style={style}>
      <ItemComponent item={items[index]} />
    </div>
  );

  return (
    <List
      height={400}
      itemCount={items.length}
      itemSize={60}
      width="100%"
    >
      {Row}
    </List>
  );
};
```

---

**Conclusão**: Estes exemplos demonstram padrões reais de implementação no WUZAPI Manager. Use-os como referência para manter consistência e qualidade no desenvolvimento de novas funcionalidades.