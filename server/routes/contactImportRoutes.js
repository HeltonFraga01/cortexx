const express = require('express');
const multer = require('multer');
const axios = require('axios');
const { logger } = require('../utils/logger');
const { validatePhoneFormat, normalizePhoneNumber, sanitizePhoneNumber } = require('../utils/phoneUtils');

const router = express.Router();

/**
 * Mapeia campos do contato WUZAPI para variáveis padrão
 * @param {Object} contact - Contato do WUZAPI
 * @param {string} phone - Telefone normalizado
 * @returns {Object} Objeto com variáveis mapeadas
 * 
 * NOTA: 'data' e 'saudacao' são geradas dinamicamente no momento do envio
 * para garantir que sejam sempre atuais
 */
function mapWuzapiContactToVariables(contact, phone) {
  const nome = contact.FullName || contact.PushName || contact.FirstName || contact.BusinessName || '';
  
  const variables = {
    nome: nome,
    telefone: phone
  };
  
  // Adicionar empresa se disponível
  if (contact.BusinessName) {
    variables.empresa = contact.BusinessName;
  }
  
  return variables;
}

/**
 * Normaliza nome de variável para garantir consistência
 * @param {string} name - Nome da variável
 * @returns {string} Nome normalizado
 */
function normalizeVariableName(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_')  // Substituir espaços por underscore
    .replace(/[^a-z0-9_]/g, '');  // Remover caracteres especiais
}

// Configurar multer para upload de arquivos CSV
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Apenas arquivos CSV são permitidos'));
    }
  }
});

// Middleware para verificar token do usuário (via header ou sessão)
const verifyUserToken = async (req, res, next) => {
  let userToken = null;
  
  // Tentar obter token do header primeiro
  const authHeader = req.headers.authorization;
  const tokenHeader = req.headers.token;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    userToken = authHeader.substring(7);
  } else if (tokenHeader) {
    userToken = tokenHeader;
  } else if (req.session?.userToken) {
    // Fallback para token da sessão
    userToken = req.session.userToken;
  }
  
  if (!userToken) {
    return res.status(401).json({
      error: 'Token não fornecido',
      message: 'Header Authorization com Bearer token, header token ou sessão ativa é obrigatório'
    });
  }
  
  req.userToken = userToken;
  next();
};

// Valida número de telefone usando as novas funções de validação
function validatePhoneNumber(phone) {
  const result = validatePhoneFormat(phone);
  
  if (result.isValid) {
    return { valid: true, normalized: result.normalized };
  } else {
    return { valid: false, reason: result.error };
  }
}

// Parse CSV
function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  
  if (lines.length === 0) {
    throw new Error('Arquivo CSV vazio');
  }

  // Normalizar headers
  const rawHeaders = lines[0].split(',').map(h => h.trim());
  const headers = rawHeaders.map(h => normalizeVariableName(h));
  
  if (!headers.includes('phone') && !headers.includes('telefone')) {
    throw new Error('CSV deve conter coluna "phone" ou "telefone"');
  }

  const phoneIndex = headers.indexOf('phone') !== -1 ? headers.indexOf('phone') : headers.indexOf('telefone');
  const nameIndex = headers.indexOf('name') !== -1 ? headers.indexOf('name') : headers.indexOf('nome');
  const customVariables = headers.filter((h, i) => i !== phoneIndex && i !== nameIndex && h);

  const contacts = [];
  const errors = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const values = line.split(',').map(v => v.trim());
    const phone = values[phoneIndex];
    const name = nameIndex !== -1 ? values[nameIndex] : '';

    // Mapear variáveis customizadas com nomes normalizados
    const variables = {};
    customVariables.forEach(varName => {
      const varIndex = headers.indexOf(varName);
      if (varIndex !== -1 && values[varIndex]) {
        variables[varName] = values[varIndex].trim();
      }
    });

    const validation = validatePhoneNumber(phone);
    
    if (validation.valid) {
      contacts.push({
        phone: validation.normalized,
        name: name || null,
        variables
      });
    } else {
      errors.push({
        line: i + 1,
        phone,
        reason: validation.reason
      });
    }
  }

  return { contacts, errors, customVariables };
}

// GET /import/wuzapi - Importar contatos da agenda WUZAPI
router.get('/import/wuzapi', verifyUserToken, async (req, res) => {
  try {
    const userToken = req.userToken;
    const { instance } = req.query;

    if (!instance) {
      return res.status(400).json({
        error: 'Instância não fornecida',
        message: 'Parâmetro instance é obrigatório'
      });
    }

    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';

    logger.info('Importando contatos do WUZAPI', {
      instance,
      userToken: userToken.substring(0, 8) + '...'
    });

    // Buscar contatos via WUZAPI
    logger.info('Chamando WUZAPI /user/contacts', {
      url: `${wuzapiBaseUrl}/user/contacts`,
      tokenPrefix: userToken.substring(0, 8) + '...'
    });

    const response = await axios.get(
      `${wuzapiBaseUrl}/user/contacts`,
      {
        headers: {
          'token': userToken,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    logger.info('Resposta do WUZAPI recebida', {
      status: response.status,
      hasData: !!response.data
    });

    const wuzapiResponse = response.data;

    logger.info('Estrutura da resposta WUZAPI', {
      hasData: !!wuzapiResponse,
      hasDataProperty: !!wuzapiResponse?.data,
      responseKeys: wuzapiResponse ? Object.keys(wuzapiResponse) : []
    });

    if (!wuzapiResponse || !wuzapiResponse.data) {
      logger.error('Resposta inválida do WUZAPI', { wuzapiResponse });
      throw new Error('Resposta inválida do WUZAPI');
    }

    const wuzapiContacts = wuzapiResponse.data;
    logger.info('Contatos brutos do WUZAPI', {
      totalEntries: Object.keys(wuzapiContacts).length,
      sampleKeys: Object.keys(wuzapiContacts).slice(0, 3)
    });

    // Transformar objeto de contatos em array
    const contacts = Object.entries(wuzapiContacts)
      .filter(([jid, contact]) => jid && jid.includes('@') && contact.Found)
      .map(([jid, contact]) => {
        const phone = jid.split('@')[0];
        const validation = validatePhoneNumber(phone);
        const normalizedPhone = validation.valid ? validation.normalized : phone;
        
        // Mapear campos do WUZAPI para variáveis padrão
        const variables = mapWuzapiContactToVariables(contact, normalizedPhone);

        return {
          phone: normalizedPhone,
          name: variables.nome || null,
          variables: variables,
          valid: validation.valid
        };
      })
      .filter(contact => contact.valid);

    logger.info('Contatos processados e validados', {
      instance,
      total: contacts.length,
      sampleContacts: contacts.slice(0, 2).map(c => ({ 
        phone: c.phone.substring(0, 8) + '...', 
        name: c.name,
        variables: Object.keys(c.variables)
      }))
    });

    res.json({
      success: true,
      contacts: contacts.map(c => ({
        phone: c.phone,
        name: c.name,
        variables: c.variables
      })),
      total: contacts.length
    });

  } catch (error) {
    logger.error('Erro ao importar contatos do WUZAPI:', {
      error: error.message,
      status: error.response?.status,
      statusText: error.response?.statusText,
      responseData: error.response?.data,
      code: error.code,
      instance,
      userToken: userToken.substring(0, 8) + '...'
    });

    let statusCode = 500;
    let errorMessage = error.message;

    if (error.response?.status === 401) {
      statusCode = 401;
      errorMessage = 'Token WUZAPI inválido';
    } else if (error.response?.status === 404) {
      statusCode = 404;
      errorMessage = 'Instância não encontrada';
    } else if (error.code === 'ECONNREFUSED') {
      statusCode = 503;
      errorMessage = 'Serviço WUZAPI indisponível';
    } else if (error.code === 'ECONNABORTED' || error.code === 'ETIMEDOUT') {
      statusCode = 408;
      errorMessage = 'Tempo limite excedido ao conectar com WUZAPI';
    }

    res.status(statusCode).json({
      error: 'Erro ao importar contatos',
      message: errorMessage
    });
  }
});

// POST /validate-csv - Validar arquivo CSV
router.post('/validate-csv', verifyUserToken, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'Arquivo não fornecido',
        message: 'É necessário enviar um arquivo CSV'
      });
    }

    logger.info('Validando arquivo CSV', {
      filename: req.file.originalname,
      size: req.file.size
    });

    const content = req.file.buffer.toString('utf-8');
    const result = parseCSV(content);

    logger.info('CSV validado', {
      totalContacts: result.contacts.length,
      totalErrors: result.errors.length,
      customVariables: result.customVariables
    });

    res.json({
      success: true,
      valid: result.errors.length === 0,
      contacts: result.contacts,
      errors: result.errors,
      customVariables: result.customVariables,
      summary: {
        total: result.contacts.length + result.errors.length,
        valid: result.contacts.length,
        invalid: result.errors.length
      }
    });

  } catch (error) {
    logger.error('Erro ao validar CSV:', error.message);
    
    res.status(400).json({
      error: 'Erro ao processar CSV',
      message: error.message
    });
  }
});

// POST /validate-manual - Validar números manuais
router.post('/validate-manual', verifyUserToken, async (req, res) => {
  try {
    const { numbers } = req.body;

    if (!numbers || !Array.isArray(numbers)) {
      return res.status(400).json({
        error: 'Números inválidos',
        message: 'É necessário fornecer um array de números'
      });
    }

    if (numbers.length === 0) {
      return res.status(400).json({
        error: 'Lista vazia',
        message: 'É necessário fornecer pelo menos um número'
      });
    }

    if (numbers.length > 1000) {
      return res.status(400).json({
        error: 'Lista muito grande',
        message: 'Máximo de 1000 números por vez'
      });
    }

    logger.info('Validando números manuais', {
      total: numbers.length
    });

    const valid = [];
    const invalid = [];

    numbers.forEach((number, index) => {
      const validation = validatePhoneNumber(number);
      
      if (validation.valid) {
        valid.push({
          phone: validation.normalized,
          name: null,
          variables: {}
        });
      } else {
        invalid.push({
          number,
          reason: validation.reason,
          line: index + 1
        });
      }
    });

    logger.info('Números validados', {
      valid: valid.length,
      invalid: invalid.length
    });

    res.json({
      success: true,
      valid,
      invalid,
      summary: {
        total: numbers.length,
        validCount: valid.length,
        invalidCount: invalid.length
      }
    });

  } catch (error) {
    logger.error('Erro ao validar números:', error.message);
    
    res.status(500).json({
      error: 'Erro ao validar números',
      message: error.message
    });
  }
});

module.exports = router;
