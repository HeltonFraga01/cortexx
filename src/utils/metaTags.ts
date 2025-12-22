/**
 * Atualiza uma meta tag HTML dinamicamente
 * Suporta tanto property (Open Graph) quanto name (Twitter Card)
 * 
 * @param property - Nome da propriedade da meta tag (ex: 'og:title', 'twitter:title')
 * @param content - Conteúdo a ser definido na meta tag
 */
export function updateMetaTag(property: string, content: string): void {
  // Tenta encontrar meta tag por property (Open Graph)
  let meta = document.querySelector(`meta[property="${property}"]`)!;
  
  // Se não encontrou, tenta por name (Twitter Card e outras)
  if (!meta) {
    meta = document.querySelector(`meta[name="${property}"]`)!;
  }
  
  // Se ainda não existe, cria uma nova meta tag
  if (!meta) {
    meta = document.createElement('meta');
    
    // Define se usa property ou name baseado no prefixo
    if (property.startsWith('og:') || property.startsWith('twitter:')) {
      meta.setAttribute('property', property);
    } else {
      meta.setAttribute('name', property);
    }
    
    document.head.appendChild(meta);
  }
  
  // Atualiza o conteúdo
  meta.content = content;
}

/**
 * Atualiza todas as meta tags relacionadas ao nome da aplicação
 * 
 * @param appName - Nome da aplicação configurado no branding
 */
export function updateAppNameMetaTags(appName: string): void {
  const appTitle = `${appName} Manager`;
  const description = `Gerencie suas instâncias ${appName} de forma eficiente`;
  
  // Atualizar título da página
  document.title = appTitle;
  
  // Atualizar meta tags Open Graph
  updateMetaTag('og:title', appTitle);
  updateMetaTag('og:site_name', appTitle);
  updateMetaTag('og:description', description);
  updateMetaTag('og:url', window.location.origin);
  
  // Atualizar meta tags Twitter Card
  updateMetaTag('twitter:title', appTitle);
  updateMetaTag('twitter:description', description);
}

/**
 * Atualiza a imagem de preview para compartilhamento em redes sociais
 * 
 * @param imageUrl - URL da imagem OG (recomendado: 1200x630 pixels)
 */
export function updateOgImage(imageUrl: string | null): void {
  if (imageUrl) {
    updateMetaTag('og:image', imageUrl);
    updateMetaTag('twitter:image', imageUrl);
  }
}

/**
 * Gera um SVG de favicon dinâmico com ícone de balão de chat
 * 
 * @param primaryColor - Cor de fundo do favicon (formato hex)
 * @returns String SVG do favicon
 */
export function generateFaviconSvg(primaryColor: string): string {
  // Default to a nice blue if no color is set
  const bgColor = primaryColor || '#3B82F6';
  
  // SVG with chat bubble icon (similar to MessageCircle from lucide)
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
      <rect width="64" height="64" rx="12" fill="${bgColor}"/>
      <path 
        d="M32 14C21.507 14 13 21.163 13 30c0 4.419 2.345 8.354 6 11.32V50l7.32-4.392C28.107 46.52 30.02 47 32 47c10.493 0 19-7.163 19-17s-8.507-17-19-17z" 
        fill="none" 
        stroke="white" 
        stroke-width="3" 
        stroke-linecap="round" 
        stroke-linejoin="round"
      />
      <circle cx="24" cy="30" r="2.5" fill="white"/>
      <circle cx="32" cy="30" r="2.5" fill="white"/>
      <circle cx="40" cy="30" r="2.5" fill="white"/>
    </svg>
  `;
  
  return svg;
}

/**
 * Converte string SVG para data URL
 * 
 * @param svg - String SVG
 * @returns Data URL do SVG
 */
export function svgToDataUrl(svg: string): string {
  const encoded = encodeURIComponent(svg.trim());
  return `data:image/svg+xml,${encoded}`;
}

/**
 * Atualiza o favicon do documento
 * 
 * @param dataUrl - Data URL do favicon (SVG ou imagem)
 */
export function updateFavicon(dataUrl: string): void {
  // Remove existing favicon links
  const existingLinks = document.querySelectorAll('link[rel*="icon"]');
  existingLinks.forEach(link => link.remove());
  
  // Create new favicon link
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/svg+xml';
  link.href = dataUrl;
  document.head.appendChild(link);
}

/**
 * Atualiza o favicon com a cor primária do sistema
 * 
 * @param primaryColor - Cor primária do branding (formato hex)
 */
export function updateDynamicFavicon(primaryColor: string | null): void {
  const svg = generateFaviconSvg(primaryColor || '#3B82F6');
  const dataUrl = svgToDataUrl(svg);
  updateFavicon(dataUrl);
}
