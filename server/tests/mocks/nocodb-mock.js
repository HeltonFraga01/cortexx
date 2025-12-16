/**
 * Mock server para NocoDB
 * Simula respostas da API do NocoDB para testes
 */

const http = require('http');
const url = require('url');

class NocoDBMock {
  constructor(port = 8082) {
    this.port = port;
    this.server = null;
    this.projects = new Map();
    this.tables = new Map();
    this.records = new Map();
    this.validTokens = new Set(['test-nocodb-token', 'valid-nocodb-token']);
    
    // Inicializar dados mock
    this.initializeMockData();
  }

  initializeMockData() {
    // Projetos mock
    this.projects.set('test-project-1', {
      id: 'test-project-1',
      title: 'Test Project 1',
      description: 'Projeto de teste para integração',
      status: 'active',
      created_at: new Date().toISOString()
    });

    this.projects.set('test-project-2', {
      id: 'test-project-2',
      title: 'Test Project 2',
      description: 'Segundo projeto de teste',
      status: 'active',
      created_at: new Date().toISOString()
    });

    // Tabelas mock
    this.tables.set('test-table-1', {
      id: 'test-table-1',
      title: 'Users Table',
      project_id: 'test-project-1',
      columns: [
        { id: 'col1', title: 'Id', uidt: 'ID' },
        { id: 'col2', title: 'wasendToken', uidt: 'SingleLineText' },
        { id: 'col3', title: 'nome', uidt: 'SingleLineText' },
        { id: 'col4', title: 'email', uidt: 'Email' },
        { id: 'col5', title: 'telefone', uidt: 'PhoneNumber' },
        { id: 'col6', title: 'created_at', uidt: 'DateTime' }
      ]
    });

    this.tables.set('test-table-2', {
      id: 'test-table-2',
      title: 'Messages Table',
      project_id: 'test-project-1',
      columns: [
        { id: 'col1', title: 'Id', uidt: 'ID' },
        { id: 'col2', title: 'user_token', uidt: 'SingleLineText' },
        { id: 'col3', title: 'message', uidt: 'LongText' },
        { id: 'col4', title: 'timestamp', uidt: 'DateTime' }
      ]
    });

    // Registros mock
    this.records.set('test-table-1', [
      {
        Id: 1,
        wasendToken: 'test-user-token-1',
        nome: 'João Silva',
        email: 'joao@example.com',
        telefone: '+5511999999999',
        created_at: new Date('2024-01-01').toISOString()
      },
      {
        Id: 2,
        wasendToken: 'test-user-token-2',
        nome: 'Maria Santos',
        email: 'maria@example.com',
        telefone: '+5511888888888',
        created_at: new Date('2024-01-02').toISOString()
      },
      {
        Id: 3,
        wasendToken: 'test-user-token-3',
        nome: 'Pedro Costa',
        email: 'pedro@example.com',
        telefone: '+5511777777777',
        created_at: new Date('2024-01-03').toISOString()
      }
    ]);

    this.records.set('test-table-2', [
      {
        Id: 1,
        user_token: 'test-user-token-1',
        message: 'Primeira mensagem de teste',
        timestamp: new Date('2024-01-01T10:00:00Z').toISOString()
      },
      {
        Id: 2,
        user_token: 'test-user-token-1',
        message: 'Segunda mensagem de teste',
        timestamp: new Date('2024-01-01T11:00:00Z').toISOString()
      },
      {
        Id: 3,
        user_token: 'test-user-token-2',
        message: 'Mensagem do usuário 2',
        timestamp: new Date('2024-01-02T09:00:00Z').toISOString()
      }
    ]);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`NocoDB Mock server running on port ${this.port}`);
          resolve();
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          console.log('NocoDB Mock server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  handleRequest(req, res) {
    // Configurar CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, xc-token, Authorization');
    res.setHeader('Content-Type', 'application/json');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    const parsedUrl = url.parse(req.url, true);
    const path = parsedUrl.pathname;
    const method = req.method;
    const token = req.headers['xc-token'] || req.headers.authorization;
    const query = parsedUrl.query;

    console.log(`Mock NocoDB: ${method} ${path} - Token: ${token ? token.substring(0, 10) + '...' : 'none'}`);

    try {
      // Validar token
      if (!this.validTokens.has(token)) {
        this.sendError(res, 401, 'Invalid token');
        return;
      }

      // Roteamento baseado no path
      if (path === '/api/v1/db/meta/projects') {
        this.handleProjects(req, res, method, query);
      } else if (path.match(/^\/api\/v1\/db\/meta\/projects\/[^\/]+$/)) {
        const projectId = path.split('/')[5];
        this.handleProject(req, res, method, projectId, query);
      } else if (path.match(/^\/api\/v1\/db\/meta\/projects\/[^\/]+\/tables$/)) {
        const projectId = path.split('/')[5];
        this.handleTables(req, res, method, projectId, query);
      } else if (path.match(/^\/api\/v1\/db\/meta\/projects\/[^\/]+\/tables\/[^\/]+$/)) {
        const projectId = path.split('/')[5];
        const tableId = path.split('/')[7];
        this.handleTable(req, res, method, projectId, tableId, query);
      } else if (path.match(/^\/api\/v1\/db\/data\/noco\/[^\/]+\/[^\/]+$/)) {
        const projectId = path.split('/')[5];
        const tableId = path.split('/')[6];
        this.handleTableData(req, res, method, projectId, tableId, query);
      } else if (path.match(/^\/api\/v1\/db\/data\/noco\/[^\/]+\/[^\/]+\/[^\/]+$/)) {
        const projectId = path.split('/')[5];
        const tableId = path.split('/')[6];
        const recordId = path.split('/')[7];
        this.handleRecord(req, res, method, projectId, tableId, recordId, query);
      } else {
        this.sendError(res, 404, 'Endpoint not found');
      }
    } catch (error) {
      console.error('Mock NocoDB Error:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  handleProjects(req, res, method, query) {
    if (method === 'GET') {
      const projects = Array.from(this.projects.values());
      this.sendSuccess(res, 200, {
        list: projects,
        pageInfo: {
          totalRows: projects.length,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true
        }
      });
    } else if (method === 'POST') {
      this.getRequestBody(req, (body) => {
        try {
          const projectData = JSON.parse(body);
          const newProject = {
            id: `project_${Date.now()}`,
            title: projectData.title,
            description: projectData.description || '',
            status: 'active',
            created_at: new Date().toISOString()
          };

          this.projects.set(newProject.id, newProject);
          this.sendSuccess(res, 201, newProject);
        } catch (error) {
          this.sendError(res, 400, 'Invalid project data');
        }
      });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  handleProject(req, res, method, projectId, query) {
    const project = this.projects.get(projectId);
    
    if (method === 'GET') {
      if (!project) {
        this.sendError(res, 404, 'Project not found');
        return;
      }
      this.sendSuccess(res, 200, project);
    } else if (method === 'PUT' || method === 'PATCH') {
      if (!project) {
        this.sendError(res, 404, 'Project not found');
        return;
      }

      this.getRequestBody(req, (body) => {
        try {
          const updateData = JSON.parse(body);
          Object.assign(project, updateData);
          project.updated_at = new Date().toISOString();
          this.sendSuccess(res, 200, project);
        } catch (error) {
          this.sendError(res, 400, 'Invalid update data');
        }
      });
    } else if (method === 'DELETE') {
      if (!project) {
        this.sendError(res, 404, 'Project not found');
        return;
      }

      this.projects.delete(projectId);
      this.sendSuccess(res, 200, { message: 'Project deleted successfully' });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  handleTables(req, res, method, projectId, query) {
    if (method === 'GET') {
      const tables = Array.from(this.tables.values()).filter(t => t.project_id === projectId);
      this.sendSuccess(res, 200, {
        list: tables,
        pageInfo: {
          totalRows: tables.length,
          page: 1,
          pageSize: 25,
          isFirstPage: true,
          isLastPage: true
        }
      });
    } else if (method === 'POST') {
      this.getRequestBody(req, (body) => {
        try {
          const tableData = JSON.parse(body);
          const newTable = {
            id: `table_${Date.now()}`,
            title: tableData.title,
            project_id: projectId,
            columns: tableData.columns || [],
            created_at: new Date().toISOString()
          };

          this.tables.set(newTable.id, newTable);
          this.records.set(newTable.id, []);
          this.sendSuccess(res, 201, newTable);
        } catch (error) {
          this.sendError(res, 400, 'Invalid table data');
        }
      });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  handleTable(req, res, method, projectId, tableId, query) {
    const table = this.tables.get(tableId);
    
    if (method === 'GET') {
      if (!table || table.project_id !== projectId) {
        this.sendError(res, 404, 'Table not found');
        return;
      }
      this.sendSuccess(res, 200, table);
    } else if (method === 'PUT' || method === 'PATCH') {
      if (!table || table.project_id !== projectId) {
        this.sendError(res, 404, 'Table not found');
        return;
      }

      this.getRequestBody(req, (body) => {
        try {
          const updateData = JSON.parse(body);
          Object.assign(table, updateData);
          table.updated_at = new Date().toISOString();
          this.sendSuccess(res, 200, table);
        } catch (error) {
          this.sendError(res, 400, 'Invalid update data');
        }
      });
    } else if (method === 'DELETE') {
      if (!table || table.project_id !== projectId) {
        this.sendError(res, 404, 'Table not found');
        return;
      }

      this.tables.delete(tableId);
      this.records.delete(tableId);
      this.sendSuccess(res, 200, { message: 'Table deleted successfully' });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  handleTableData(req, res, method, projectId, tableId, query) {
    const table = this.tables.get(tableId);
    if (!table || table.project_id !== projectId) {
      this.sendError(res, 404, 'Table not found');
      return;
    }

    const records = this.records.get(tableId) || [];

    if (method === 'GET') {
      let filteredRecords = [...records];

      // Aplicar filtros baseados na query
      if (query.where) {
        try {
          const whereCondition = JSON.parse(query.where);
          filteredRecords = this.applyWhereFilter(filteredRecords, whereCondition);
        } catch (error) {
          console.warn('Invalid where condition:', query.where);
        }
      }

      // Aplicar paginação
      const limit = parseInt(query.limit) || 25;
      const offset = parseInt(query.offset) || 0;
      const paginatedRecords = filteredRecords.slice(offset, offset + limit);

      this.sendSuccess(res, 200, {
        list: paginatedRecords,
        pageInfo: {
          totalRows: filteredRecords.length,
          page: Math.floor(offset / limit) + 1,
          pageSize: limit,
          isFirstPage: offset === 0,
          isLastPage: offset + limit >= filteredRecords.length
        }
      });
    } else if (method === 'POST') {
      this.getRequestBody(req, (body) => {
        try {
          const recordData = JSON.parse(body);
          const newRecord = {
            Id: records.length + 1,
            ...recordData,
            created_at: new Date().toISOString()
          };

          records.push(newRecord);
          this.sendSuccess(res, 201, newRecord);
        } catch (error) {
          this.sendError(res, 400, 'Invalid record data');
        }
      });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  handleRecord(req, res, method, projectId, tableId, recordId, query) {
    const table = this.tables.get(tableId);
    if (!table || table.project_id !== projectId) {
      this.sendError(res, 404, 'Table not found');
      return;
    }

    const records = this.records.get(tableId) || [];
    const recordIndex = records.findIndex(r => r.Id == recordId);

    if (method === 'GET') {
      if (recordIndex === -1) {
        this.sendError(res, 404, 'Record not found');
        return;
      }
      this.sendSuccess(res, 200, records[recordIndex]);
    } else if (method === 'PUT' || method === 'PATCH') {
      if (recordIndex === -1) {
        this.sendError(res, 404, 'Record not found');
        return;
      }

      this.getRequestBody(req, (body) => {
        try {
          const updateData = JSON.parse(body);
          Object.assign(records[recordIndex], updateData);
          records[recordIndex].updated_at = new Date().toISOString();
          this.sendSuccess(res, 200, records[recordIndex]);
        } catch (error) {
          this.sendError(res, 400, 'Invalid update data');
        }
      });
    } else if (method === 'DELETE') {
      if (recordIndex === -1) {
        this.sendError(res, 404, 'Record not found');
        return;
      }

      records.splice(recordIndex, 1);
      this.sendSuccess(res, 200, { message: 'Record deleted successfully' });
    } else {
      this.sendError(res, 405, 'Method not allowed');
    }
  }

  applyWhereFilter(records, whereCondition) {
    return records.filter(record => {
      return this.evaluateWhereCondition(record, whereCondition);
    });
  }

  evaluateWhereCondition(record, condition) {
    if (condition._and) {
      return condition._and.every(subCondition => this.evaluateWhereCondition(record, subCondition));
    }

    if (condition._or) {
      return condition._or.some(subCondition => this.evaluateWhereCondition(record, subCondition));
    }

    // Condições simples
    for (const [field, operator] of Object.entries(condition)) {
      const recordValue = record[field];
      
      if (typeof operator === 'object') {
        for (const [op, value] of Object.entries(operator)) {
          switch (op) {
            case '_eq':
              if (recordValue != value) return false;
              break;
            case '_neq':
              if (recordValue == value) return false;
              break;
            case '_like':
              if (!recordValue || !recordValue.toString().toLowerCase().includes(value.toLowerCase())) return false;
              break;
            case '_nlike':
              if (recordValue && recordValue.toString().toLowerCase().includes(value.toLowerCase())) return false;
              break;
            case '_gt':
              if (recordValue <= value) return false;
              break;
            case '_gte':
              if (recordValue < value) return false;
              break;
            case '_lt':
              if (recordValue >= value) return false;
              break;
            case '_lte':
              if (recordValue > value) return false;
              break;
            case '_in':
              if (!Array.isArray(value) || !value.includes(recordValue)) return false;
              break;
            case '_nin':
              if (Array.isArray(value) && value.includes(recordValue)) return false;
              break;
          }
        }
      } else {
        // Igualdade simples
        if (recordValue != operator) return false;
      }
    }

    return true;
  }

  // Métodos auxiliares
  getRequestBody(req, callback) {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      callback(body);
    });
  }

  sendSuccess(res, statusCode, data) {
    res.writeHead(statusCode);
    res.end(JSON.stringify(data));
  }

  sendError(res, statusCode, message) {
    res.writeHead(statusCode);
    res.end(JSON.stringify({
      error: message,
      statusCode: statusCode,
      timestamp: new Date().toISOString()
    }));
  }

  // Métodos para manipular dados de teste
  addProject(projectData) {
    const project = {
      id: projectData.id || `project_${Date.now()}`,
      title: projectData.title,
      description: projectData.description || '',
      status: projectData.status || 'active',
      created_at: new Date().toISOString()
    };

    this.projects.set(project.id, project);
    return project;
  }

  addTable(tableData) {
    const table = {
      id: tableData.id || `table_${Date.now()}`,
      title: tableData.title,
      project_id: tableData.project_id,
      columns: tableData.columns || [],
      created_at: new Date().toISOString()
    };

    this.tables.set(table.id, table);
    if (!this.records.has(table.id)) {
      this.records.set(table.id, []);
    }
    return table;
  }

  addRecord(tableId, recordData) {
    const records = this.records.get(tableId) || [];
    const newRecord = {
      Id: records.length + 1,
      ...recordData,
      created_at: new Date().toISOString()
    };

    records.push(newRecord);
    this.records.set(tableId, records);
    return newRecord;
  }

  addToken(token) {
    this.validTokens.add(token);
  }

  removeToken(token) {
    this.validTokens.delete(token);
  }

  reset() {
    this.projects.clear();
    this.tables.clear();
    this.records.clear();
    this.validTokens.clear();
    this.initializeMockData();
  }
}

module.exports = NocoDBMock;