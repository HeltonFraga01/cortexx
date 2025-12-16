#!/usr/bin/env node

/**
 * WUZAPI Manager Code Generator CLI
 * 
 * Este script automatiza a geração de código seguindo os padrões do projeto.
 * Suporta geração de rotas backend, componentes frontend, hooks e testes.
 * 
 * Uso:
 *   npm run generate <type> <name> [options]
 *   node scripts/generate.js <type> <name> [options]
 * 
 * Exemplos:
 *   npm run generate route admin-users
 *   npm run generate component AdminProducts
 *   npm run generate hook useProducts
 *   npm run generate page UserProfile
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// Configurações do gerador
const CONFIG = {
  templatesDir: path.join(__dirname, '..', 'templates'),
  outputDirs: {
    backend: {
      routes: path.join(__dirname, '..', 'server', 'routes'),
      middleware: path.join(__dirname, '..', 'server', 'middleware'),
      validators: path.join(__dirname, '..', 'server', 'validators'),
      utils: path.join(__dirname, '..', 'server', 'utils')
    },
    frontend: {
      admin: path.join(__dirname, '..', 'src', 'components', 'admin'),
      user: path.join(__dirname, '..', 'src', 'components', 'user'),
      ui: path.join(__dirname, '..', 'src', 'components', 'ui-custom'),
      shared: path.join(__dirname, '..', 'src', 'components', 'shared'),
      hooks: path.join(__dirname, '..', 'src', 'hooks'),
      services: path.join(__dirname, '..', 'src', 'services'),
      pages: path.join(__dirname, '..', 'src', 'pages')
    }
  }
};

// Tipos de geração suportados
const GENERATORS = {
  'route': {
    description: 'Gera uma nova rota backend',
    templates: ['adminRouteTemplate.js', 'userRouteTemplate.js', 'publicRouteTemplate.js', 'integrationRouteTemplate.js'],
    outputDir: 'backend.routes'
  },
  'component': {
    description: 'Gera um novo componente React',
    templates: ['AdminPageTemplate.tsx', 'UserPageTemplate.tsx', 'ReusableComponentTemplate.tsx'],
    outputDir: 'frontend.ui'
  },
  'page': {
    description: 'Gera uma nova página React',
    templates: ['AdminPageTemplate.tsx', 'UserPageTemplate.tsx'],
    outputDir: 'frontend.pages'
  },
  'hook': {
    description: 'Gera um custom hook React',
    templates: ['CustomHookTemplate.ts'],
    outputDir: 'frontend.hooks'
  },
  'service': {
    description: 'Gera um service para API',
    templates: ['ServiceTemplate.ts'],
    outputDir: 'frontend.services'
  }
};

// Utilitários
class Logger {
  static info(message) {
    console.log(`\x1b[36mℹ\x1b[0m ${message}`);
  }
  
  static success(message) {
    console.log(`\x1b[32m✓\x1b[0m ${message}`);
  }
  
  static warning(message) {
    console.log(`\x1b[33m⚠\x1b[0m ${message}`);
  }
  
  static error(message) {
    console.log(`\x1b[31m✗\x1b[0m ${message}`);
  }
  
  static title(message) {
    console.log(`\n\x1b[1m${message}\x1b[0m`);
  }
}

class FileUtils {
  static ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
      Logger.info(`Diretório criado: ${dirPath}`);
    }
  }
  
  static fileExists(filePath) {
    return fs.existsSync(filePath);
  }
  
  static readTemplate(templatePath) {
    if (!this.fileExists(templatePath)) {
      throw new Error(`Template não encontrado: ${templatePath}`);
    }
    return fs.readFileSync(templatePath, 'utf8');
  }
  
  static writeFile(filePath, content) {
    this.ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, 'utf8');
  }
  
  static getOutputDir(outputDirPath) {
    const parts = outputDirPath.split('.');
    let dir = CONFIG.outputDirs;
    
    for (const part of parts) {
      if (dir[part]) {
        dir = dir[part];
      } else {
        throw new Error(`Diretório de saída não encontrado: ${outputDirPath}`);
      }
    }
    
    return dir;
  }
}

class TemplateProcessor {
  constructor() {
    this.placeholders = new Map();
  }
  
  setPlaceholder(key, value) {
    this.placeholders.set(key, value);
  }
  
  setPlaceholders(placeholders) {
    Object.entries(placeholders).forEach(([key, value]) => {
      this.setPlaceholder(key, value);
    });
  }
  
  process(template) {
    let processed = template;
    
    // Substituir placeholders básicos
    for (const [key, value] of this.placeholders) {
      const regex = new RegExp(`\\[${key}\\]`, 'g');
      processed = processed.replace(regex, value);
    }
    
    // Processar seções condicionais
    processed = this.processConditionalSections(processed);
    
    return processed;
  }
  
  processConditionalSections(template) {
    // Remove seções opcionais que não foram preenchidas
    const sectionRegex = /\[([A-Z_]+_SECTION)\]([\s\S]*?)\[\/\1\]/g;
    
    return template.replace(sectionRegex, (match, sectionName, content) => {
      // Se a seção contém placeholders não substituídos, remove a seção
      if (content.includes('[') && content.includes(']')) {
        const hasUnreplacedPlaceholders = /\[[A-Z_]+\]/.test(content);
        if (hasUnreplacedPlaceholders) {
          return '';
        }
      }
      return content;
    });
  }
}

class InteractivePrompt {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }
  
  async question(prompt) {
    return new Promise((resolve) => {
      this.rl.question(prompt, resolve);
    });
  }
  
  async confirm(message, defaultValue = false) {
    const defaultText = defaultValue ? '[Y/n]' : '[y/N]';
    const answer = await this.question(`${message} ${defaultText}: `);
    
    if (!answer.trim()) {
      return defaultValue;
    }
    
    return answer.toLowerCase().startsWith('y');
  }
  
  async select(message, options) {
    console.log(`\n${message}`);
    options.forEach((option, index) => {
      console.log(`  ${index + 1}. ${option}`);
    });
    
    const answer = await this.question('\nEscolha uma opção (número): ');
    const index = parseInt(answer) - 1;
    
    if (index >= 0 && index < options.length) {
      return { index, value: options[index] };
    }
    
    Logger.error('Opção inválida');
    return this.select(message, options);
  }
  
  close() {
    this.rl.close();
  }
}

class CodeGenerator {
  constructor() {
    this.prompt = new InteractivePrompt();
    this.processor = new TemplateProcessor();
  }
  
  async generate(type, name, options = {}) {
    try {
      Logger.title(`🚀 Gerador de Código WUZAPI Manager`);
      Logger.info(`Gerando ${type}: ${name}`);
      
      if (!GENERATORS[type]) {
        throw new Error(`Tipo de geração não suportado: ${type}`);
      }
      
      const generator = GENERATORS[type];
      
      // Selecionar template
      const template = await this.selectTemplate(generator.templates);
      
      // Coletar informações do usuário
      const config = await this.collectUserInput(type, name, template);
      
      // Processar template
      const content = await this.processTemplate(template, config);
      
      // Gerar arquivo
      const outputPath = await this.generateFile(type, name, content, generator.outputDir);
      
      // Mostrar próximos passos
      this.showNextSteps(type, name, outputPath);
      
      Logger.success(`\n✨ Código gerado com sucesso!`);
      
    } catch (error) {
      Logger.error(`Erro durante geração: ${error.message}`);
      process.exit(1);
    } finally {
      this.prompt.close();
    }
  }
  
  async selectTemplate(templates) {
    if (templates.length === 1) {
      return templates[0];
    }
    
    const templateDescriptions = templates.map(template => {
      const descriptions = {
        'adminRouteTemplate.js': 'Rota administrativa (requer token admin)',
        'userRouteTemplate.js': 'Rota de usuário (requer token user)',
        'publicRouteTemplate.js': 'Rota pública (sem autenticação)',
        'integrationRouteTemplate.js': 'Rota de integração externa',
        'AdminPageTemplate.tsx': 'Página administrativa com CRUD completo',
        'UserPageTemplate.tsx': 'Página de usuário com perfil e configurações',
        'ReusableComponentTemplate.tsx': 'Componente reutilizável',
        'CustomHookTemplate.ts': 'Custom hook com gerenciamento de estado'
      };
      return descriptions[template] || template;
    });
    
    const selection = await this.prompt.select(
      'Selecione o template base:',
      templateDescriptions
    );
    
    return templates[selection.index];
  }
  
  async collectUserInput(type, name, template) {
    const config = {
      name,
      type,
      template
    };
    
    // Configurações específicas por tipo
    if (type === 'route') {
      config.httpMethod = await this.selectHttpMethod();
      config.endpoint = await this.prompt.question('Endpoint da rota (ex: users, settings): ');
      config.description = await this.prompt.question('Descrição da operação: ');
      config.requiresAuth = template.includes('admin') || template.includes('user');
      
      if (config.requiresAuth) {
        config.authType = template.includes('admin') ? 'admin' : 'user';
      }
    }
    
    if (type === 'component' || type === 'page') {
      config.componentType = await this.selectComponentType();
      config.hasForm = await this.prompt.confirm('Incluir formulário?');
      config.hasCRUD = await this.prompt.confirm('Incluir operações CRUD?');
      config.hasSearch = await this.prompt.confirm('Incluir busca/filtros?');
    }
    
    if (type === 'hook') {
      config.dataType = await this.prompt.question('Tipo de dados (ex: User, Product): ');
      config.hasAPI = await this.prompt.confirm('Conectar com API?');
      config.hasCRUD = await this.prompt.confirm('Incluir operações CRUD?');
    }
    
    return config;
  }
  
  async selectHttpMethod() {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const selection = await this.prompt.select('Método HTTP:', methods);
    return methods[selection.index];
  }
  
  async selectComponentType() {
    const types = ['Page', 'Component', 'Modal', 'Form'];
    const selection = await this.prompt.select('Tipo de componente:', types);
    return types[selection.index];
  }
  
  async processTemplate(templateName, config) {
    const templatePath = path.join(CONFIG.templatesDir, 
      config.type === 'route' ? 'backend' : 'frontend', 
      templateName
    );
    
    const template = FileUtils.readTemplate(templatePath);
    
    // Configurar placeholders baseado no tipo e configuração
    this.setupPlaceholders(config);
    
    return this.processor.process(template);
  }
  
  setupPlaceholders(config) {
    const placeholders = {
      // Placeholders básicos
      'NAME': config.name,
      'COMPONENT_NAME': this.toPascalCase(config.name),
      'HOOK_NAME': this.toCamelCase(config.name),
      'FILE_NAME': this.toKebabCase(config.name),
      'DESCRIPTION': config.description || `${config.type} ${config.name}`,
      'TIMESTAMP': new Date().toISOString()
    };
    
    // Placeholders específicos para rotas
    if (config.type === 'route') {
      placeholders['HTTP_METHOD'] = config.httpMethod;
      placeholders['HTTP_METHOD_LOWERCASE'] = config.httpMethod.toLowerCase();
      placeholders['ENDPOINT'] = config.endpoint;
      placeholders['OPERATION_DESCRIPTION'] = config.description;
      placeholders['OPERATION_NAME'] = `${config.httpMethod} ${config.endpoint}`;
      placeholders['SUCCESS_STATUS_CODE'] = config.httpMethod === 'POST' ? '201' : '200';
      placeholders['SUCCESS_MESSAGE'] = this.getSuccessMessage(config.httpMethod);
    }
    
    // Placeholders específicos para componentes
    if (config.type === 'component' || config.type === 'page') {
      placeholders['COMPONENT_TYPE'] = config.componentType || 'Component';
      placeholders['DATA_TYPE'] = config.dataType || 'Item';
      placeholders['API_SERVICE'] = `${this.toCamelCase(config.name)}Service`;
    }
    
    // Placeholders específicos para hooks
    if (config.type === 'hook') {
      placeholders['DATA_TYPE'] = config.dataType || 'Data';
      placeholders['API_SERVICE'] = `${this.toCamelCase(config.dataType || 'data')}Service`;
    }
    
    this.processor.setPlaceholders(placeholders);
  }
  
  getSuccessMessage(httpMethod) {
    const messages = {
      'GET': 'Dados recuperados com sucesso',
      'POST': 'Recurso criado com sucesso',
      'PUT': 'Recurso atualizado com sucesso',
      'DELETE': 'Recurso removido com sucesso',
      'PATCH': 'Recurso atualizado com sucesso'
    };
    return messages[httpMethod] || 'Operação realizada com sucesso';
  }
  
  async generateFile(type, name, content, outputDirPath) {
    const outputDir = FileUtils.getOutputDir(outputDirPath);
    
    // Determinar nome e extensão do arquivo
    let fileName;
    if (type === 'route') {
      fileName = `${this.toKebabCase(name)}Routes.js`;
    } else if (type === 'hook') {
      fileName = `${this.toCamelCase(name)}.ts`;
    } else if (type === 'service') {
      fileName = `${this.toCamelCase(name)}.ts`;
    } else {
      fileName = `${this.toPascalCase(name)}.tsx`;
    }
    
    const outputPath = path.join(outputDir, fileName);
    
    // Verificar se arquivo já existe
    if (FileUtils.fileExists(outputPath)) {
      const overwrite = await this.prompt.confirm(
        `Arquivo já existe: ${outputPath}\nDeseja sobrescrever?`,
        false
      );
      
      if (!overwrite) {
        throw new Error('Geração cancelada pelo usuário');
      }
    }
    
    // Escrever arquivo
    FileUtils.writeFile(outputPath, content);
    Logger.success(`Arquivo criado: ${outputPath}`);
    
    return outputPath;
  }
  
  showNextSteps(type, name, outputPath) {
    Logger.title('\n📋 Próximos Passos:');
    
    if (type === 'route') {
      Logger.info('1. Registre a rota no server/index.js:');
      console.log(`   app.use('/api/${this.toKebabCase(name)}', require('./routes/${this.toKebabCase(name)}Routes'));`);
      Logger.info('2. Implemente a lógica específica nos comentários TODO');
      Logger.info('3. Teste a rota com Postman ou curl');
      Logger.info('4. Adicione validações específicas se necessário');
    }
    
    if (type === 'component' || type === 'page') {
      Logger.info('1. Importe o componente onde necessário');
      Logger.info('2. Substitua os comentários TODO com sua implementação');
      Logger.info('3. Configure as props e tipos específicos');
      Logger.info('4. Teste o componente na interface');
      
      if (type === 'page') {
        Logger.info('5. Adicione a rota no React Router se necessário');
      }
    }
    
    if (type === 'hook') {
      Logger.info('1. Importe o hook nos componentes que precisam');
      Logger.info('2. Configure o serviço de API correspondente');
      Logger.info('3. Implemente a lógica específica nos TODOs');
      Logger.info('4. Teste o hook em diferentes cenários');
    }
    
    Logger.info(`\n📁 Arquivo gerado: ${outputPath}`);
  }
  
  // Utilitários de formatação de string
  toPascalCase(str) {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => c ? c.toUpperCase() : '')
      .replace(/^(.)/, (_, c) => c.toUpperCase());
  }
  
  toCamelCase(str) {
    const pascal = this.toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
  }
  
  toKebabCase(str) {
    return str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]+/g, '-')
      .toLowerCase();
  }
}

// Função principal
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  
  if (args.includes('--list') || args.includes('-l')) {
    showAvailableGenerators();
    return;
  }
  
  const [type, name, ...options] = args;
  
  if (!type || !name) {
    Logger.error('Tipo e nome são obrigatórios');
    showHelp();
    process.exit(1);
  }
  
  const generator = new CodeGenerator();
  await generator.generate(type, name, options);
}

function showHelp() {
  console.log(`
🚀 WUZAPI Manager Code Generator

Uso:
  npm run generate <type> <name> [options]
  node scripts/generate.js <type> <name> [options]

Tipos disponíveis:
  route      - Gera uma nova rota backend
  component  - Gera um novo componente React
  page       - Gera uma nova página React
  hook       - Gera um custom hook React
  service    - Gera um service para API

Exemplos:
  npm run generate route admin-users
  npm run generate component AdminProducts
  npm run generate page UserProfile
  npm run generate hook useProducts
  npm run generate service productsService

Opções:
  --help, -h    Mostra esta ajuda
  --list, -l    Lista todos os geradores disponíveis

Para mais informações, consulte: docs/DEVELOPMENT_GUIDE.md
  `);
}

function showAvailableGenerators() {
  Logger.title('📦 Geradores Disponíveis:');
  
  Object.entries(GENERATORS).forEach(([type, config]) => {
    console.log(`\n${type}:`);
    console.log(`  ${config.description}`);
    console.log(`  Templates: ${config.templates.join(', ')}`);
    console.log(`  Saída: ${config.outputDir}`);
  });
}

// Executar se chamado diretamente
if (require.main === module) {
  main().catch(error => {
    Logger.error(`Erro fatal: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { CodeGenerator, TemplateProcessor, FileUtils, Logger };