/**
 * Template HTML padrão para a página inicial customizada
 * 
 * Este template serve como ponto de partida para personalização
 * e demonstra o uso de variáveis CSS do tema.
 * 
 * Baseado no Guia de Landing Pages SaaS com estrutura de 9 seções
 * para máxima conversão e engajamento.
 */

/**
 * Gera o HTML padrão da landing page com o nome da aplicação
 * @param appName - Nome da aplicação (padrão: 'WUZAPI')
 * @returns HTML da landing page com placeholders substituídos
 */
export const getDefaultHomeHtml = (appName: string = 'WUZAPI'): string => {
  return DEFAULT_HOME_HTML_TEMPLATE
    .replace(/\{\{APP_NAME\}\}/g, appName)
    .replace(/\{\{APP_NAME_MANAGER\}\}/g, `${appName} Manager`);
};

const DEFAULT_HOME_HTML_TEMPLATE = `<!-- 
  Template Landing Page SaaS - {{APP_NAME}}
  
  Variáveis CSS disponíveis:
  - var(--primary-color): Cor primária do tema
  - var(--secondary-color): Cor secundária do tema
-->

<style>
  .wuzapi-landing {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    line-height: 1.6;
    color: #1f2937;
  }
  .wuzapi-hero {
    background: linear-gradient(135deg, var(--primary-color, #2563eb) 0%, #1e40af 100%);
    color: white;
    padding: 5rem 2rem;
    text-align: center;
    border-radius: 1rem;
    margin-bottom: 3rem;
  }
  .wuzapi-btn {
    display: inline-block;
    padding: 0.875rem 2rem;
    border-radius: 0.5rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.3s;
    margin: 0.5rem;
  }
  .wuzapi-btn-primary {
    background: white;
    color: #2563eb;
  }
  .wuzapi-btn-primary:hover {
    background: #f3f4f6;
  }
  .wuzapi-btn-outline {
    border: 2px solid white;
    color: white;
  }
  .wuzapi-btn-outline:hover {
    background: white;
    color: #2563eb;
  }
  .wuzapi-feature-card {
    background: white;
    padding: 2rem;
    border-radius: 1rem;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    transition: transform 0.3s, box-shadow 0.3s;
  }
  .wuzapi-feature-card:hover {
    transform: translateY(-8px);
    box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
  }
  .wuzapi-section {
    padding: 4rem 2rem;
    max-width: 1200px;
    margin: 0 auto;
  }
  .wuzapi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
    gap: 2rem;
    margin-top: 3rem;
  }
</style>

<div class="wuzapi-landing">
  <!-- Hero Section -->
  <section class="wuzapi-hero">
    <h1 style="font-size: 3rem; font-weight: bold; margin-bottom: 1.5rem;">
      Gestão Inteligente de Dados<br/>e Integrações WhatsApp
    </h1>
    <p style="font-size: 1.25rem; opacity: 0.9; max-width: 700px; margin: 0 auto 2rem;">
      Conecte bancos de dados, automatize processos e gerencie suas comunicações em uma única plataforma moderna e segura
    </p>
    <div>
      <a href="/databases" class="wuzapi-btn wuzapi-btn-primary">Acessar Bancos de Dados</a>
      <a href="#features" class="wuzapi-btn wuzapi-btn-outline">Conhecer Recursos</a>
    </div>
  </section>

  <!-- Prova Social -->
  <section style="text-align: center; padding: 2rem; background: white; border-radius: 0.5rem; margin-bottom: 2rem;">
    <p style="color: #6b7280; font-size: 0.875rem; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 1rem;">
      Tecnologias Integradas
    </p>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 2rem; opacity: 0.6;">
      <span style="font-weight: bold; color: #4b5563;">PostgreSQL</span>
      <span style="font-weight: bold; color: #4b5563;">MySQL</span>
      <span style="font-weight: bold; color: #4b5563;">NocoDB</span>
      <span style="font-weight: bold; color: #4b5563;">WhatsApp API</span>
    </div>
  </section>

  <!-- O Problema -->
  <section class="wuzapi-section" style="background: #f9fafb; border-radius: 1rem; margin-bottom: 2rem;">
    <h2 style="font-size: 2.5rem; font-weight: bold; text-align: center; margin-bottom: 1.5rem;">
      Gerenciar dados e integrações não deveria ser complicado
    </h2>
    <p style="font-size: 1.125rem; text-align: center; color: #6b7280; max-width: 800px; margin: 0 auto 3rem;">
      Empresas perdem tempo alternando entre múltiplas ferramentas e lidando com integrações complexas
    </p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1.5rem;">
      <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">⚠️</div>
        <h3 style="font-weight: 600; margin-bottom: 0.5rem;">Ferramentas Dispersas</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">Múltiplos sistemas sem integração</p>
      </div>
      <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🐌</div>
        <h3 style="font-weight: 600; margin-bottom: 0.5rem;">Processos Lentos</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">Configurações complexas e demoradas</p>
      </div>
      <div style="background: white; padding: 1.5rem; border-radius: 0.5rem; text-align: center;">
        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔒</div>
        <h3 style="font-weight: 600; margin-bottom: 0.5rem;">Falta de Controle</h3>
        <p style="color: #6b7280; font-size: 0.875rem;">Dificuldade em gerenciar acessos</p>
      </div>
    </div>
  </section>

  <!-- A Solução -->
  <section class="wuzapi-section" id="features">
    <h2 style="font-size: 2.5rem; font-weight: bold; text-align: center; margin-bottom: 1.5rem;">
      Uma plataforma. Todas as suas necessidades.
    </h2>
    <p style="font-size: 1.125rem; text-align: center; color: #6b7280; margin-bottom: 3rem;">
      {{APP_NAME}} centraliza gestão de dados, integrações e automação em uma interface moderna
    </p>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem; text-align: center;">
      <div>
        <div style="background: #dbeafe; width: 4rem; height: 4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 2rem;">🔌</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">1. Conecte</h3>
        <p style="color: #6b7280;">Adicione suas fontes de dados em minutos</p>
      </div>
      <div>
        <div style="background: #d1fae5; width: 4rem; height: 4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 2rem;">📊</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">2. Visualize</h3>
        <p style="color: #6b7280;">Acesse dados com visualizações modernas</p>
      </div>
      <div>
        <div style="background: #e9d5ff; width: 4rem; height: 4rem; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem; font-size: 2rem;">⚡</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">3. Automatize</h3>
        <p style="color: #6b7280;">Integre WhatsApp e outras APIs</p>
      </div>
    </div>
  </section>

  <!-- Features -->
  <section class="wuzapi-section" style="background: #f9fafb; border-radius: 1rem;">
    <h2 style="font-size: 2.5rem; font-weight: bold; text-align: center; margin-bottom: 3rem;">
      Recursos que impulsionam sua produtividade
    </h2>
    <div class="wuzapi-grid">
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🗄️</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Múltiplas Conexões</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Conecte PostgreSQL, MySQL, NocoDB e APIs externas</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Configuração simplificada</li>
          <li>✓ Suporte a múltiplos bancos</li>
          <li>✓ Conexões seguras</li>
        </ul>
      </div>
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">👥</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Gestão de Usuários</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Controle granular de acessos e permissões</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Perfis admin e usuário</li>
          <li>✓ Permissões personalizadas</li>
          <li>✓ Auditoria de acessos</li>
        </ul>
      </div>
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">📱</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Integração WhatsApp</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Gerencie instâncias e automatize comunicações</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Múltiplas instâncias</li>
          <li>✓ Envio automatizado</li>
          <li>✓ Webhooks e eventos</li>
        </ul>
      </div>
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🎨</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">White Label</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Personalize cores, logo e conteúdo</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Branding customizado</li>
          <li>✓ Temas personalizados</li>
          <li>✓ Editor de HTML</li>
        </ul>
      </div>
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">📊</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Visualizações Avançadas</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Tabelas, Kanban, calendário e mais</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Múltiplas visualizações</li>
          <li>✓ Filtros e ordenação</li>
          <li>✓ Exportação de dados</li>
        </ul>
      </div>
      <div class="wuzapi-feature-card">
        <div style="font-size: 2.5rem; margin-bottom: 1rem;">🔒</div>
        <h3 style="font-size: 1.25rem; font-weight: 600; margin-bottom: 0.75rem;">Segurança Avançada</h3>
        <p style="color: #6b7280; margin-bottom: 1rem;">Proteção de dados com criptografia</p>
        <ul style="color: #6b7280; font-size: 0.875rem; list-style: none; padding: 0;">
          <li>✓ Autenticação segura</li>
          <li>✓ Rate limiting</li>
          <li>✓ Logs de auditoria</li>
        </ul>
      </div>
    </div>
  </section>

  <!-- CTA Final -->
  <section style="background: linear-gradient(135deg, var(--primary-color, #2563eb) 0%, #1e40af 100%); color: white; padding: 4rem 2rem; text-align: center; border-radius: 1rem; margin-top: 3rem;">
    <h2 style="font-size: 2.5rem; font-weight: bold; margin-bottom: 1.5rem;">
      Pronto para transformar sua gestão de dados?
    </h2>
    <p style="font-size: 1.125rem; opacity: 0.9; margin-bottom: 2rem;">
      Comece agora e simplifique suas operações
    </p>
    <a href="/databases" class="wuzapi-btn wuzapi-btn-primary" style="font-size: 1.125rem;">
      Acessar Plataforma
    </a>
  </section>

  <!-- Footer -->
  <footer style="text-align: center; padding: 2rem; margin-top: 3rem; color: #6b7280; font-size: 0.875rem;">
    <p>© 2025 {{APP_NAME_MANAGER}}. Todos os direitos reservados.</p>
  </footer>
</div>`;

// Export both the function and the template constant for backward compatibility
export const DEFAULT_HOME_HTML = getDefaultHomeHtml();
export { DEFAULT_HOME_HTML_TEMPLATE };
