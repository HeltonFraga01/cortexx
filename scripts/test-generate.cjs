#!/usr/bin/env node

/**
 * Script de teste para o CLI de geração de código
 * 
 * Este script testa as funcionalidades básicas do gerador
 * sem interação do usuário.
 */

const fs = require('fs');
const path = require('path');
const { CodeGenerator, TemplateProcessor, FileUtils, Logger } = require('./generate.cjs');

class TestRunner {
  constructor() {
    this.testResults = [];
    this.tempDir = path.join(__dirname, '..', 'temp-test');
  }

  async runTests() {
    Logger.title('🧪 Executando Testes do CLI de Geração');

    try {
      await this.setupTestEnvironment();
      await this.testTemplateProcessor();
      await this.testFileUtils();
      await this.testCodeGenerator();
      await this.cleanupTestEnvironment();

      this.showResults();
    } catch (error) {
      Logger.error(`Erro durante testes: ${error.message}`);
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    Logger.info('Configurando ambiente de teste...');
    
    // Criar diretório temporário
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  async cleanupTestEnvironment() {
    Logger.info('Limpando ambiente de teste...');
    
    // Remover diretório temporário
    if (fs.existsSync(this.tempDir)) {
      fs.rmSync(this.tempDir, { recursive: true, force: true });
    }
  }

  async testTemplateProcessor() {
    Logger.info('Testando TemplateProcessor...');

    const processor = new TemplateProcessor();
    
    // Teste 1: Substituição básica de placeholders
    processor.setPlaceholder('NAME', 'TestComponent');
    processor.setPlaceholder('DESCRIPTION', 'Componente de teste');
    
    const template = 'Component [NAME] - [DESCRIPTION]';
    const result = processor.process(template);
    
    this.assert(
      result === 'Component TestComponent - Componente de teste',
      'Substituição básica de placeholders',
      { expected: 'Component TestComponent - Componente de teste', actual: result }
    );

    // Teste 2: Múltiplos placeholders
    processor.setPlaceholders({
      'HTTP_METHOD': 'GET',
      'ENDPOINT': 'users'
    });
    
    const routeTemplate = '[HTTP_METHOD] /api/[ENDPOINT] - [DESCRIPTION]';
    const routeResult = processor.process(routeTemplate);
    
    this.assert(
      routeResult === 'GET /api/users - Componente de teste',
      'Múltiplos placeholders',
      { expected: 'GET /api/users - Componente de teste', actual: routeResult }
    );

    Logger.success('TemplateProcessor testado com sucesso');
  }

  async testFileUtils() {
    Logger.info('Testando FileUtils...');

    // Teste 1: Criar diretório
    const testDir = path.join(this.tempDir, 'test-dir');
    FileUtils.ensureDir(testDir);
    
    this.assert(
      fs.existsSync(testDir),
      'Criação de diretório',
      { path: testDir }
    );

    // Teste 2: Escrever arquivo
    const testFile = path.join(testDir, 'test.txt');
    const testContent = 'Conteúdo de teste';
    FileUtils.writeFile(testFile, testContent);
    
    this.assert(
      fs.existsSync(testFile),
      'Criação de arquivo',
      { path: testFile }
    );

    // Teste 3: Ler arquivo
    const readContent = fs.readFileSync(testFile, 'utf8');
    
    this.assert(
      readContent === testContent,
      'Leitura de arquivo',
      { expected: testContent, actual: readContent }
    );

    Logger.success('FileUtils testado com sucesso');
  }

  async testCodeGenerator() {
    Logger.info('Testando CodeGenerator (funcionalidades básicas)...');

    const generator = new CodeGenerator();
    
    // Teste 1: Formatação de strings
    this.assert(
      generator.toPascalCase('admin-users') === 'AdminUsers',
      'Conversão para PascalCase',
      { input: 'admin-users', expected: 'AdminUsers', actual: generator.toPascalCase('admin-users') }
    );

    this.assert(
      generator.toCamelCase('admin-users') === 'adminUsers',
      'Conversão para camelCase',
      { input: 'admin-users', expected: 'adminUsers', actual: generator.toCamelCase('admin-users') }
    );

    this.assert(
      generator.toKebabCase('AdminUsers') === 'admin-users',
      'Conversão para kebab-case',
      { input: 'AdminUsers', expected: 'admin-users', actual: generator.toKebabCase('AdminUsers') }
    );

    Logger.success('CodeGenerator testado com sucesso');
  }

  assert(condition, testName, details = {}) {
    const result = {
      name: testName,
      passed: condition,
      details: details
    };

    this.testResults.push(result);

    if (condition) {
      Logger.success(`✓ ${testName}`);
    } else {
      Logger.error(`✗ ${testName}`);
      if (details.expected && details.actual) {
        console.log(`  Esperado: ${details.expected}`);
        console.log(`  Atual: ${details.actual}`);
      }
    }
  }

  showResults() {
    const passed = this.testResults.filter(r => r.passed).length;
    const total = this.testResults.length;
    const failed = total - passed;

    Logger.title('\n📊 Resultados dos Testes:');
    Logger.info(`Total: ${total}`);
    Logger.success(`Passou: ${passed}`);
    
    if (failed > 0) {
      Logger.error(`Falhou: ${failed}`);
      
      Logger.title('\n❌ Testes que falharam:');
      this.testResults
        .filter(r => !r.passed)
        .forEach(result => {
          Logger.error(`- ${result.name}`);
        });
      
      process.exit(1);
    } else {
      Logger.success('\n🎉 Todos os testes passaram!');
    }
  }
}

// Executar testes se chamado diretamente
if (require.main === module) {
  const runner = new TestRunner();
  runner.runTests().catch(error => {
    Logger.error(`Erro fatal nos testes: ${error.message}`);
    process.exit(1);
  });
}

module.exports = { TestRunner };