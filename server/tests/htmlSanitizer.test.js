/**
 * Testes para HTML Sanitizer
 * 
 * NOTA: O sanitizer está em MODO PERMISSIVO para administradores confiáveis.
 * Apenas validações de tamanho são aplicadas.
 * Scripts, eval, iframes, etc. são PERMITIDOS.
 */

const { test } = require('node:test');
const assert = require('node:assert');
const htmlSanitizer = require('../utils/htmlSanitizer');

test('HTML Sanitizer - deve aceitar HTML simples e seguro', () => {
  const html = '<div><h1>Hello World</h1><p>Test</p></div>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
  assert.strictEqual(result.errors, undefined);
});

test('HTML Sanitizer - deve aceitar inline scripts', () => {
  const html = '<script>console.log("Hello");</script>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

test('HTML Sanitizer - deve aceitar inline styles', () => {
  const html = '<style>body { color: red; }</style>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

test('HTML Sanitizer - deve aceitar data URLs', () => {
  const html = '<img src="data:image/png;base64,iVBORw0KGgo=" />';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: Scripts externos são PERMITIDOS para admins confiáveis
test('HTML Sanitizer - deve aceitar scripts externos (modo permissivo)', () => {
  const html = '<script src="https://cdn.example.com/lib.js"></script>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: eval() é PERMITIDO para admins confiáveis
test('HTML Sanitizer - deve aceitar eval() (modo permissivo)', () => {
  const html = '<script>eval("console.log(1)");</script>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: Function() constructor é PERMITIDO para admins confiáveis
test('HTML Sanitizer - deve aceitar Function() constructor (modo permissivo)', () => {
  const html = '<script>new Function("console.log(1)")();</script>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: iframes externos são PERMITIDOS para admins confiáveis
test('HTML Sanitizer - deve aceitar iframes externos (modo permissivo)', () => {
  const html = '<iframe src="https://example.com"></iframe>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: javascript: URLs são PERMITIDOS para admins confiáveis
test('HTML Sanitizer - deve aceitar javascript: URLs (modo permissivo)', () => {
  const html = '<a href="javascript:void(0)">Click</a>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});

// MODO PERMISSIVO: Sem avisos sobre imagens sem alt
test('HTML Sanitizer - deve aceitar imagens sem alt (modo permissivo)', () => {
  const html = '<img src="test.jpg" />';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
  // Warnings podem ou não existir dependendo da configuração
  assert.ok(Array.isArray(result.warnings));
});

// MODO PERMISSIVO: Sem avisos sobre tags obsoletas
test('HTML Sanitizer - deve aceitar tags obsoletas (modo permissivo)', () => {
  const html = '<font color="red">Old style</font>';
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
  // Warnings podem ou não existir dependendo da configuração
  assert.ok(Array.isArray(result.warnings));
});

test('HTML Sanitizer - deve rejeitar HTML maior que 1MB', () => {
  const html = 'a'.repeat(1024 * 1024 + 1);
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, false);
  assert.ok(result.errors.some(e => e.includes('tamanho máximo')));
});

test('HTML Sanitizer - deve avisar sobre HTML maior que 500KB', () => {
  const html = 'a'.repeat(512 * 1024 + 1);
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.ok(result.warnings.some(w => w.includes('grande')));
});

test('HTML Sanitizer - deve rejeitar HTML vazio ou inválido', () => {
  const result1 = htmlSanitizer.validateAndSanitize('');
  assert.strictEqual(result1.success, false);
  
  const result2 = htmlSanitizer.validateAndSanitize(null);
  assert.strictEqual(result2.success, false);
  
  const result3 = htmlSanitizer.validateAndSanitize(undefined);
  assert.strictEqual(result3.success, false);
});

test('HTML Sanitizer - deve aceitar HTML complexo e seguro', () => {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial; }
        .container { max-width: 1200px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>Welcome</h1>
        <p>This is a test</p>
        <script>
          document.addEventListener('DOMContentLoaded', function() {
            console.log('Page loaded');
          });
        </script>
      </div>
    </body>
    </html>
  `;
  
  const result = htmlSanitizer.validateAndSanitize(html);
  
  assert.strictEqual(result.success, true);
  assert.strictEqual(result.sanitized, html);
});
