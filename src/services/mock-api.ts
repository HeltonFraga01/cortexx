/**
 * Mock API Service para desenvolvimento
 * Simula as respostas da API quando o backend não está disponível
 */

import { WuzAPIUser, CreateUserRequest, HealthStatus } from './wuzapi';

export class MockAPIService {
  private users: WuzAPIUser[] = [
    {
      id: '1',
      name: 'LiviaWaSend',
      token: '2c150893...',
      webhook: 'https://webhook.site/test1',
      events: 'All',
      connected: true,
      loggedIn: true,
      jid: '5521994387880:3@s.whatsapp.net',
      qrcode: '',
      expiration: Date.now() + 86400000,
      proxy_config: {
        enabled: false,
        proxy_url: ''
      },
      s3_config: {
        enabled: false,
        endpoint: '',
        region: '',
        bucket: '',
        access_key: '',
        path_style: false,
        public_url: '',
        media_delivery: '',
        retention_days: 30
      }
    },
    {
      id: '2',
      name: 'Helton',
      token: '01K7MXQ1...',
      webhook: 'https://webhook.site/test2',
      events: 'Message,UndecryptableMessage',
      connected: true,
      loggedIn: true,
      jid: '553194974759:49@s.whatsapp.net',
      qrcode: '',
      expiration: Date.now() + 86400000,
      proxy_config: {
        enabled: false,
        proxy_url: ''
      },
      s3_config: {
        enabled: false,
        endpoint: '',
        region: '',
        bucket: '',
        access_key: '',
        path_style: false,
        public_url: '',
        media_delivery: '',
        retention_days: 30
      }
    },
    {
      id: '3',
      name: 'SeusPuloFlix',
      token: '01K7MXAS...',
      webhook: 'https://webhook.site/test3',
      events: 'All',
      connected: true,
      loggedIn: true,
      jid: '553193514418:29@s.whatsapp.net',
      qrcode: '',
      expiration: Date.now() + 86400000,
      proxy_config: {
        enabled: false,
        proxy_url: ''
      },
      s3_config: {
        enabled: false,
        endpoint: '',
        region: '',
        bucket: '',
        access_key: '',
        path_style: false,
        public_url: '',
        media_delivery: '',
        retention_days: 30
      }
    }
  ];

  private delay(ms = 500): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async getUsers(): Promise<WuzAPIUser[]> {
    await this.delay();
    return [...this.users];
  }

  async getUser(id: string): Promise<WuzAPIUser> {
    await this.delay();
    const user = this.users.find(u => u.id === id);
    if (!user) {
      throw new Error('User not found');
    }
    return { ...user };
  }

  async createUser(userData: CreateUserRequest): Promise<WuzAPIUser> {
    await this.delay(1000); // Simular tempo de criação

    // Validações básicas
    if (!userData.name || !userData.token) {
      throw new Error('Name and token are required');
    }

    // Verificar se já existe usuário com mesmo token
    if (this.users.find(u => u.token === userData.token)) {
      throw new Error('User with this token already exists');
    }

    // Criar novo usuário
    const newUser: WuzAPIUser = {
      id: (this.users.length + 1).toString(),
      name: userData.name,
      token: userData.token,
      webhook: userData.webhook || '',
      events: userData.events || 'All',
      connected: false,
      loggedIn: false,
      jid: '',
      qrcode: '',
      expiration: Date.now() + 86400000,
      proxy_config: {
        enabled: userData.proxyConfig?.enabled || false,
        proxy_url: userData.proxyConfig?.proxyURL || ''
      },
      s3_config: {
        enabled: userData.s3Config?.enabled || false,
        endpoint: userData.s3Config?.endpoint || '',
        region: userData.s3Config?.region || '',
        bucket: userData.s3Config?.bucket || '',
        access_key: userData.s3Config?.accessKey || '',
        path_style: userData.s3Config?.pathStyle || false,
        public_url: userData.s3Config?.publicURL || '',
        media_delivery: userData.s3Config?.mediaDelivery || '',
        retention_days: userData.s3Config?.retentionDays || 30
      }
    };

    this.users.push(newUser);
    return { ...newUser };
  }

  async updateUser(id: string, userData: Partial<CreateUserRequest>): Promise<WuzAPIUser> {
    await this.delay();
    
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    const user = this.users[userIndex];
    const updatedUser: WuzAPIUser = {
      ...user,
      name: userData.name || user.name,
      webhook: userData.webhook !== undefined ? userData.webhook : user.webhook,
      events: userData.events || user.events,
      proxy_config: {
        enabled: userData.proxyConfig?.enabled !== undefined ? userData.proxyConfig.enabled : user.proxy_config.enabled,
        proxy_url: userData.proxyConfig?.proxyURL || user.proxy_config.proxy_url
      },
      s3_config: {
        ...user.s3_config,
        enabled: userData.s3Config?.enabled !== undefined ? userData.s3Config.enabled : user.s3_config.enabled,
        endpoint: userData.s3Config?.endpoint || user.s3_config.endpoint,
        region: userData.s3Config?.region || user.s3_config.region,
        bucket: userData.s3Config?.bucket || user.s3_config.bucket,
        access_key: userData.s3Config?.accessKey || user.s3_config.access_key,
        path_style: userData.s3Config?.pathStyle !== undefined ? userData.s3Config.pathStyle : user.s3_config.path_style,
        public_url: userData.s3Config?.publicURL || user.s3_config.public_url,
        media_delivery: userData.s3Config?.mediaDelivery || user.s3_config.media_delivery,
        retention_days: userData.s3Config?.retentionDays || user.s3_config.retention_days
      }
    };

    this.users[userIndex] = updatedUser;
    return { ...updatedUser };
  }

  async deleteUser(id: string): Promise<void> {
    await this.delay();
    
    const userIndex = this.users.findIndex(u => u.id === id);
    if (userIndex === -1) {
      throw new Error('User not found');
    }

    this.users.splice(userIndex, 1);
  }

  async deleteUserFull(id: string): Promise<void> {
    // Para o mock, mesmo comportamento que deleteUser
    return this.deleteUser(id);
  }

  async getHealth(): Promise<HealthStatus> {
    await this.delay(200);
    
    return {
      status: 'ok',
      uptime: '2h 30m 15s',
      version: '1.0.0-mock',
      total_users: this.users.length,
      connected_users: this.users.filter(u => u.connected).length,
      logged_in_users: this.users.filter(u => u.loggedIn).length,
      active_connections: this.users.filter(u => u.connected).length,
      memory_stats: {
        alloc_mb: 45.2,
        sys_mb: 78.1,
        total_alloc_mb: 156.7,
        num_gc: 23
      },
      goroutines: 42,
      timestamp: new Date().toISOString()
    };
  }

  async getQRCode(token: string): Promise<{ QRCode: string }> {
    await this.delay(1500);
    
    const user = this.users.find(u => u.token === token);
    if (!user) {
      throw new Error('User not found');
    }

    // Simular QR Code (base64 de uma imagem pequena)
    const mockQRCode = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    
    return {
      QRCode: mockQRCode
    };
  }

  async connectSession(token: string): Promise<void> {
    await this.delay(1000);
    
    const user = this.users.find(u => u.token === token);
    if (!user) {
      throw new Error('User not found');
    }

    // Simular conexão
    user.connected = true;
  }

  async updateWebhook(token: string, config: any): Promise<void> {
    await this.delay(800);
    
    const user = this.users.find(u => u.token === token);
    if (!user) {
      throw new Error('User not found');
    }

    // Atualizar configurações do webhook
    user.webhook = config.webhook || user.webhook;
    user.events = Array.isArray(config.events) ? config.events.join(',') : config.events || user.events;
  }
}

export const mockAPI = new MockAPIService();