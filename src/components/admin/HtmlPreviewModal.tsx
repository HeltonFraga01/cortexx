import React, { useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { X, ExternalLink } from 'lucide-react';
import { BrandingConfig } from '@/types/branding';

interface HtmlPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  html: string;
  brandingConfig: BrandingConfig;
}

export const HtmlPreviewModal: React.FC<HtmlPreviewModalProps> = ({
  open,
  onOpenChange,
  html,
  brandingConfig,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    if (open && iframeRef.current) {
      renderHtmlInIframe();
    }
  }, [open, html, brandingConfig]);

  const renderHtmlInIframe = () => {
    if (!iframeRef.current) return;

    const iframe = iframeRef.current;
    const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;

    if (!iframeDoc) return;

    try {
      // Se o HTML já é um documento completo (começa com <!DOCTYPE ou <html>)
      const isFullDocument = /^\s*<!DOCTYPE|^\s*<html/i.test(html);
      
      let fullHtml: string;
      
      if (isFullDocument) {
        // HTML já é um documento completo, usar diretamente
        fullHtml = html;
      } else {
        // HTML é apenas um fragmento, envolver em documento completo
        const cssVariables = generateCssVariables(brandingConfig);
        
        fullHtml = `
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Preview</title>
              <style>
                /* Reset básico */
                * {
                  margin: 0;
                  padding: 0;
                  box-sizing: border-box;
                }

                /* Variáveis CSS do tema */
                :root {
                  ${cssVariables}
                }

                /* Estilos base */
                body {
                  font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                  line-height: 1.6;
                  color: var(--foreground);
                  background: var(--background);
                  padding: 1rem;
                }

                /* Estilos para links */
                a {
                  color: var(--primary);
                  text-decoration: none;
                }

                a:hover {
                  text-decoration: underline;
                }

                /* Estilos para imagens */
                img {
                  max-width: 100%;
                  height: auto;
                }

                /* Estilos para código */
                code {
                  background: var(--muted);
                  padding: 0.2rem 0.4rem;
                  border-radius: 0.25rem;
                  font-family: 'Courier New', monospace;
                  font-size: 0.9em;
                }

                pre {
                  background: var(--muted);
                  padding: 1rem;
                  border-radius: 0.5rem;
                  overflow-x: auto;
                }

                pre code {
                  background: none;
                  padding: 0;
                }
              </style>
            </head>
            <body>
              ${html}
            </body>
          </html>
        `;
      }

      // Escrever HTML no iframe
      iframeDoc.open();
      iframeDoc.write(fullHtml);
      iframeDoc.close();
    } catch (error) {
      console.error('Erro ao renderizar HTML no iframe:', error);
      
      // Fallback: mostrar erro no iframe
      iframeDoc.open();
      iframeDoc.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="UTF-8">
            <style>
              body {
                font-family: system-ui, sans-serif;
                padding: 2rem;
                background: #fee;
                color: #c00;
              }
              h1 { font-size: 1.5rem; margin-bottom: 1rem; }
              pre {
                background: white;
                padding: 1rem;
                border-radius: 0.5rem;
                overflow-x: auto;
                color: #333;
              }
            </style>
          </head>
          <body>
            <h1>Erro ao renderizar HTML</h1>
            <p>Ocorreu um erro ao tentar renderizar o HTML customizado.</p>
            <pre>${String(error)}</pre>
          </body>
        </html>
      `);
      iframeDoc.close();
    }
  };

  const generateCssVariables = (config: BrandingConfig): string => {
    const variables: string[] = [];

    // Cores primária e secundária
    if (config.primaryColor) {
      variables.push(`--primary: ${config.primaryColor};`);
      variables.push(`--primary-foreground: #ffffff;`);
    } else {
      variables.push(`--primary: #3b82f6;`);
      variables.push(`--primary-foreground: #ffffff;`);
    }

    if (config.secondaryColor) {
      variables.push(`--secondary: ${config.secondaryColor};`);
      variables.push(`--secondary-foreground: #ffffff;`);
    } else {
      variables.push(`--secondary: #8b5cf6;`);
      variables.push(`--secondary-foreground: #ffffff;`);
    }

    // Cores do tema (baseadas no tema atual)
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    if (isDark) {
      variables.push(`--background: #0a0a0a;`);
      variables.push(`--foreground: #fafafa;`);
      variables.push(`--muted: #1a1a1a;`);
      variables.push(`--muted-foreground: #a1a1aa;`);
      variables.push(`--border: #27272a;`);
      variables.push(`--card: #0a0a0a;`);
      variables.push(`--card-foreground: #fafafa;`);
    } else {
      variables.push(`--background: #ffffff;`);
      variables.push(`--foreground: #0a0a0a;`);
      variables.push(`--muted: #f4f4f5;`);
      variables.push(`--muted-foreground: #71717a;`);
      variables.push(`--border: #e4e4e7;`);
      variables.push(`--card: #ffffff;`);
      variables.push(`--card-foreground: #0a0a0a;`);
    }

    // Outras variáveis úteis
    variables.push(`--radius: 0.5rem;`);

    return variables.join('\n              ');
  };

  const openInNewTab = () => {
    const newWindow = window.open('', '_blank');
    if (newWindow && iframeRef.current) {
      const iframeDoc = iframeRef.current.contentDocument;
      if (iframeDoc) {
        newWindow.document.write(iframeDoc.documentElement.outerHTML);
        newWindow.document.close();
      }
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle>Preview do HTML Customizado</DialogTitle>
              <DialogDescription>
                Visualize como o HTML será renderizado na página inicial
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={openInNewTab}
                title="Abrir em nova aba"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-hidden px-6 pb-6">
          <iframe
            ref={iframeRef}
            sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals allow-top-navigation-by-user-activation"
            className="w-full h-full border rounded-lg bg-white dark:bg-gray-950"
            title="HTML Preview"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HtmlPreviewModal;
