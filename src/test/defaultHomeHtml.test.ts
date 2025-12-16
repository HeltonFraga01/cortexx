import { describe, it, expect } from 'vitest';
import { getDefaultHomeHtml } from '@/constants/defaultHomeHtml';

describe('getDefaultHomeHtml', () => {
  describe('Substituição de placeholders', () => {
    it('deve substituir {{APP_NAME}} com o nome fornecido', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar que o placeholder foi substituído
      expect(html).toContain('MyApp centraliza');
      expect(html).toContain('Template Landing Page SaaS - MyApp');
      
      // Verificar que não há placeholders restantes
      expect(html).not.toContain('{{APP_NAME}}');
    });

    it('deve substituir {{APP_NAME_MANAGER}} com o nome + Manager', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar que o placeholder foi substituído
      expect(html).toContain('© 2025 MyApp Manager');
      
      // Verificar que não há placeholders restantes
      expect(html).not.toContain('{{APP_NAME_MANAGER}}');
    });

    it('deve usar WUZAPI como valor padrão quando nenhum nome é fornecido', () => {
      const html = getDefaultHomeHtml();
      
      // Verificar valores padrão
      expect(html).toContain('WUZAPI centraliza');
      expect(html).toContain('Template Landing Page SaaS - WUZAPI');
      expect(html).toContain('© 2025 WUZAPI Manager');
    });

    it('deve substituir todas as ocorrências de placeholders', () => {
      const html = getDefaultHomeHtml('TestApp');
      
      // Contar ocorrências do nome da aplicação
      const appNameMatches = html.match(/TestApp/g);
      expect(appNameMatches).toBeTruthy();
      expect(appNameMatches!.length).toBeGreaterThan(1);
      
      // Verificar que não há placeholders restantes
      expect(html).not.toContain('{{APP_NAME}}');
      expect(html).not.toContain('{{APP_NAME_MANAGER}}');
    });
  });

  describe('Conteúdo do template', () => {
    it('deve conter estrutura HTML válida', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar tags essenciais
      expect(html).toContain('<style>');
      expect(html).toContain('</style>');
      expect(html).toContain('<div class="wuzapi-landing">');
      expect(html).toContain('</div>');
    });

    it('deve conter seções principais da landing page', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar seções
      expect(html).toContain('<!-- Hero Section -->');
      expect(html).toContain('<!-- Prova Social -->');
      expect(html).toContain('<!-- O Problema -->');
      expect(html).toContain('<!-- A Solução -->');
      expect(html).toContain('<!-- Features -->');
      expect(html).toContain('<!-- CTA Final -->');
      expect(html).toContain('<!-- Footer -->');
    });

    it('deve conter variáveis CSS do tema', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar uso de variáveis CSS
      expect(html).toContain('var(--primary-color');
      expect(html).toContain('var(--secondary-color');
    });

    it('deve conter classes CSS do wuzapi', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // Verificar classes CSS (não devem ser substituídas)
      expect(html).toContain('.wuzapi-landing');
      expect(html).toContain('.wuzapi-hero');
      expect(html).toContain('.wuzapi-btn');
      expect(html).toContain('.wuzapi-feature-card');
      expect(html).toContain('.wuzapi-section');
      expect(html).toContain('.wuzapi-grid');
    });
  });

  describe('Casos especiais', () => {
    it('deve lidar com nomes de aplicação com espaços', () => {
      const html = getDefaultHomeHtml('My Cool App');
      
      expect(html).toContain('My Cool App centraliza');
      expect(html).toContain('© 2025 My Cool App Manager');
    });

    it('deve lidar com nomes de aplicação com caracteres especiais', () => {
      const html = getDefaultHomeHtml('App-Name_2.0');
      
      expect(html).toContain('App-Name_2.0 centraliza');
      expect(html).toContain('© 2025 App-Name_2.0 Manager');
    });

    it('deve lidar com string vazia usando valor padrão', () => {
      const html = getDefaultHomeHtml('');
      
      // String vazia deve usar o valor padrão
      expect(html).toContain(' centraliza');
      expect(html).toContain('© 2025  Manager');
    });

    it('deve gerar HTML consistente para o mesmo nome', () => {
      const html1 = getDefaultHomeHtml('TestApp');
      const html2 = getDefaultHomeHtml('TestApp');
      
      expect(html1).toBe(html2);
    });

    it('deve gerar HTML diferente para nomes diferentes', () => {
      const html1 = getDefaultHomeHtml('App1');
      const html2 = getDefaultHomeHtml('App2');
      
      expect(html1).not.toBe(html2);
      expect(html1).toContain('App1');
      expect(html2).toContain('App2');
    });
  });

  describe('Tamanho e performance', () => {
    it('deve gerar HTML com tamanho razoável', () => {
      const html = getDefaultHomeHtml('MyApp');
      
      // HTML deve ter tamanho razoável (menos de 50KB)
      expect(html.length).toBeLessThan(50000);
      expect(html.length).toBeGreaterThan(1000);
    });

    it('deve executar rapidamente', () => {
      const start = performance.now();
      
      for (let i = 0; i < 100; i++) {
        getDefaultHomeHtml(`App${i}`);
      }
      
      const end = performance.now();
      const duration = end - start;
      
      // 100 execuções devem levar menos de 100ms
      expect(duration).toBeLessThan(100);
    });
  });
});
