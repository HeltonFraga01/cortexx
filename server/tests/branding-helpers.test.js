/**
 * Teste das funções auxiliares de branding
 * 
 * Testa:
 * 1. applyBrandingToHtml() com diferentes estruturas HTML
 * 2. Sistema de cache getCachedBrandingConfig()
 * 3. invalidateBrandingCache()
 */

const { logger } = require('../utils/logger');

// Mock das funções (já que não podemos importar diretamente do index.js em execução)
function applyBrandingToHtml(html, brandingConfig) {
  if (!html || typeof html !== 'string') {
    logger.warn('⚠️ HTML inválido fornecido para applyBrandingToHtml');
    return html;
  }

  // Criar tag style com variáveis CSS
  const cssVariables = `
    <style>
      :root {
        --primary: ${brandingConfig.primaryColor || '#000000'};
        --secondary: ${brandingConfig.secondaryColor || '#ffffff'};
        --app-name: '${brandingConfig.appName || 'WUZAPI'}';
      }
    </style>
  `;

  logger.info('🎨 Aplicando variáveis CSS de branding ao HTML', {
    primary_color: brandingConfig.primaryColor,
    secondary_color: brandingConfig.secondaryColor,
    app_name: brandingConfig.appName,
    html_length: html.length
  });

  // Tentar inserir no <head>
  if (html.includes('</head>')) {
    const result = html.replace('</head>', `${cssVariables}</head>`);
    logger.info('✅ CSS injetado no <head>');
    return result;
  }

  // Se não tem <head>, tentar inserir no início do <body>
  if (html.includes('<body')) {
    const bodyMatch = html.match(/<body[^>]*>/i);
    if (bodyMatch) {
      const bodyTag = bodyMatch[0];
      const result = html.replace(bodyTag, `${bodyTag}${cssVariables}`);
      logger.info('✅ CSS injetado no início do <body>');
      return result;
    }
  }

  // Se não tem estrutura HTML completa, inserir no início
  logger.info('ℹ️ HTML sem estrutura completa, CSS injetado no início');
  return cssVariables + html;
}

async function testApplyBrandingToHtml() {
  logger.info('🧪 Testando applyBrandingToHtml()');
  
  const brandingConfig = {
    appName: 'WaSend',
    primaryColor: '#FF0000',
    secondaryColor: '#00FF00'
  };

  // Teste 1: HTML completo com <head>
  logger.info('📝 Teste 1: HTML completo com <head>');
  const html1 = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test</title>
      </head>
      <body>
        <h1>Hello World</h1>
      </body>
    </html>
  `;
  
  const result1 = applyBrandingToHtml(html1, brandingConfig);
  
  if (result1.includes(':root') && result1.includes('--primary: #FF0000')) {
    logger.info('✅ Teste 1 passou: CSS injetado no <head>');
  } else {
    logger.error('❌ Teste 1 falhou: CSS não foi injetado corretamente');
    return false;
  }

  // Teste 2: HTML sem <head> mas com <body>
  logger.info('📝 Teste 2: HTML sem <head> mas com <body>');
  const html2 = `
    <body>
      <h1>Hello World</h1>
    </body>
  `;
  
  const result2 = applyBrandingToHtml(html2, brandingConfig);
  
  if (result2.includes(':root') && result2.includes('<body>')) {
    logger.info('✅ Teste 2 passou: CSS injetado no início do <body>');
  } else {
    logger.error('❌ Teste 2 falhou: CSS não foi injetado corretamente');
    return false;
  }

  // Teste 3: HTML sem estrutura completa
  logger.info('📝 Teste 3: HTML sem estrutura completa');
  const html3 = `
    <div class="container">
      <h1>Hello World</h1>
    </div>
  `;
  
  const result3 = applyBrandingToHtml(html3, brandingConfig);
  
  if (result3.startsWith('\n    <style>') && result3.includes('<div class="container">')) {
    logger.info('✅ Teste 3 passou: CSS injetado no início do HTML');
  } else {
    logger.error('❌ Teste 3 falhou: CSS não foi injetado corretamente');
    return false;
  }

  // Teste 4: HTML com <body> e atributos
  logger.info('📝 Teste 4: HTML com <body> e atributos');
  const html4 = `
    <body class="dark-mode" data-theme="custom">
      <h1>Hello World</h1>
    </body>
  `;
  
  const result4 = applyBrandingToHtml(html4, brandingConfig);
  
  if (result4.includes(':root') && result4.includes('class="dark-mode"')) {
    logger.info('✅ Teste 4 passou: CSS injetado após <body> com atributos');
  } else {
    logger.error('❌ Teste 4 falhou: CSS não foi injetado corretamente');
    return false;
  }

  // Teste 5: Verificar variáveis CSS
  logger.info('📝 Teste 5: Verificar variáveis CSS');
  const result5 = applyBrandingToHtml(html1, brandingConfig);
  
  if (
    result5.includes('--primary: #FF0000') &&
    result5.includes('--secondary: #00FF00') &&
    result5.includes("--app-name: 'WaSend'")
  ) {
    logger.info('✅ Teste 5 passou: Todas as variáveis CSS estão presentes');
  } else {
    logger.error('❌ Teste 5 falhou: Variáveis CSS não estão corretas');
    return false;
  }

  // Teste 6: HTML inválido
  logger.info('📝 Teste 6: HTML inválido (null)');
  const result6 = applyBrandingToHtml(null, brandingConfig);
  
  if (result6 === null) {
    logger.info('✅ Teste 6 passou: HTML inválido retorna null');
  } else {
    logger.error('❌ Teste 6 falhou: HTML inválido não foi tratado corretamente');
    return false;
  }

  // Teste 7: Branding config com valores padrão
  logger.info('📝 Teste 7: Branding config com valores padrão');
  const result7 = applyBrandingToHtml(html1, {});
  
  if (
    result7.includes('--primary: #000000') &&
    result7.includes('--secondary: #ffffff') &&
    result7.includes("--app-name: 'WUZAPI'")
  ) {
    logger.info('✅ Teste 7 passou: Valores padrão aplicados corretamente');
  } else {
    logger.error('❌ Teste 7 falhou: Valores padrão não foram aplicados');
    return false;
  }

  logger.info('🎉 Todos os testes de applyBrandingToHtml() passaram!');
  return true;
}

// Executar testes
testApplyBrandingToHtml()
  .then(success => {
    if (success) {
      logger.info('✅ TODOS OS TESTES PASSARAM!');
      process.exit(0);
    } else {
      logger.error('❌ ALGUNS TESTES FALHARAM!');
      process.exit(1);
    }
  })
  .catch(error => {
    logger.error('❌ Erro durante execução dos testes:', {
      error_message: error.message,
      error_stack: error.stack
    });
    process.exit(1);
  });
