import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { 
  Save, 
  RefreshCw, 
  RotateCcw, 
  FileCode, 
  AlertCircle, 
  CheckCircle, 
  Eye,
  Download,
  Upload,
  Info
} from 'lucide-react';
import { toast } from 'sonner';

interface LandingPageEditorProps {
  className?: string;
}

const LandingPageEditor: React.FC<LandingPageEditorProps> = ({ className }) => {
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isCustom, setIsCustom] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    loadLandingPage();
  }, []);

  useEffect(() => {
    setHasChanges(content !== originalContent);
  }, [content, originalContent]);

  const loadLandingPage = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/landing-page', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Erro ao carregar landing page');
      }

      const data = await response.json();
      
      if (data.success) {
        setContent(data.data.content);
        setOriginalContent(data.data.content);
        setIsCustom(data.data.isCustom);
      } else {
        throw new Error(data.error || 'Erro desconhecido');
      }
    } catch (error) {
      console.error('Erro ao carregar landing page:', error);
      toast.error('Erro ao carregar landing page');
    } finally {
      setIsLoading(false);
    }
  };

  const validateHtml = (html: string): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    // Verificar tags essenciais
    if (!/<html/i.test(html)) {
      errors.push('HTML deve conter tag <html>');
    }

    if (!/<head/i.test(html)) {
      errors.push('HTML deve conter tag <head>');
    }

    if (!/<body/i.test(html)) {
      errors.push('HTML deve conter tag <body>');
    }

    // Verificar fechamento de tags
    if (!/<\/html>/i.test(html)) {
      errors.push('HTML deve fechar tag </html>');
    }

    if (!/<\/head>/i.test(html)) {
      errors.push('HTML deve fechar tag </head>');
    }

    if (!/<\/body>/i.test(html)) {
      errors.push('HTML deve fechar tag </body>');
    }

    // Verificar DOCTYPE
    if (!/<!DOCTYPE html>/i.test(html)) {
      errors.push('HTML deve começar com <!DOCTYPE html>');
    }

    // Verificar tamanho (500KB)
    const maxSize = 500000;
    if (html.length > maxSize) {
      errors.push(`HTML excede o tamanho máximo de ${Math.round(maxSize / 1024)}KB`);
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  };

  const handleSave = async () => {
    // Validar HTML
    const validation = validateHtml(content);
    if (!validation.isValid) {
      setErrors(validation.errors);
      toast.error('HTML inválido. Corrija os erros antes de salvar.');
      return;
    }

    setSaving(true);
    setErrors([]);

    try {
      const response = await fetch('/api/admin/landing-page', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include',
        body: JSON.stringify({ content })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setOriginalContent(content);
        setIsCustom(true);
        setHasChanges(false);
        toast.success('Landing page salva com sucesso!');
      } else {
        throw new Error(data.error || 'Erro ao salvar');
      }
    } catch (error) {
      console.error('Erro ao salvar landing page:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar landing page');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!window.confirm('Tem certeza que deseja resetar para a landing page padrão? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      const response = await fetch('/api/admin/landing-page', {
        method: 'DELETE',
        credentials: 'include'
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Landing page resetada para padrão');
        await loadLandingPage();
      } else {
        throw new Error(data.error || 'Erro ao resetar');
      }
    } catch (error) {
      console.error('Erro ao resetar landing page:', error);
      toast.error('Erro ao resetar landing page');
    }
  };

  const handlePreview = () => {
    // Abrir preview em nova aba
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    
    // Limpar URL após 1 minuto
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `landing-page-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('Landing page baixada');
  };

  const handleUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.html,.htm';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const htmlContent = event.target?.result as string;
          setContent(htmlContent);
          toast.success('Arquivo carregado');
        };
        reader.readAsText(file);
      }
    };
    input.click();
  };

  const handleLoadTemplate = async () => {
    try {
      const response = await fetch('/paginaBase.html');
      if (response.ok) {
        const template = await response.text();
        setContent(template);
        toast.success('Template carregado');
      } else {
        throw new Error('Template não encontrado');
      }
    } catch (error) {
      toast.error('Erro ao carregar template');
    }
  };

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileCode className="h-5 w-5" />
            <span>Landing Page Completa</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sizeKB = Math.round(content.length / 1024);
  const maxSizeKB = 500;
  const sizePercent = (sizeKB / maxSizeKB) * 100;

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <FileCode className="h-5 w-5" />
          <span>Landing Page Completa</span>
          {isCustom && (
            <Badge variant="secondary">Customizada</Badge>
          )}
          {hasChanges && (
            <Badge variant="outline">Alterações pendentes</Badge>
          )}
        </CardTitle>
        <CardDescription>
          HTML completo com suporte a scripts (Tailwind, Franken UI, etc.)
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>Landing Page Completa</strong> permite usar tags <code>&lt;script&gt;</code> e HTML completo.
            Diferente do HTML Snippet (acima), este arquivo é servido diretamente na raiz <code>/</code> do site.
          </AlertDescription>
        </Alert>

        {/* Erros */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Erros de validação:</strong>
              <ul className="list-disc list-inside mt-2">
                {errors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {/* Ações rápidas */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleLoadTemplate}
          >
            <FileCode className="h-4 w-4 mr-2" />
            Carregar Template
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload HTML
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownload}
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePreview}
            disabled={!content}
          >
            <Eye className="h-4 w-4 mr-2" />
            Preview
          </Button>
        </div>

        <Separator />

        {/* Editor */}
        <div className="space-y-2">
          <Label htmlFor="landing-html">Código HTML</Label>
          <Textarea
            id="landing-html"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="<!DOCTYPE html>..."
            className="font-mono text-sm min-h-[400px]"
            spellCheck={false}
          />
          
          {/* Estatísticas */}
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{content.length.toLocaleString()} caracteres</span>
            <span className={sizePercent > 90 ? 'text-red-500' : ''}>
              {sizeKB}KB / {maxSizeKB}KB ({sizePercent.toFixed(1)}%)
            </span>
          </div>
        </div>

        <Separator />

        {/* Ações principais */}
        <div className="flex flex-wrap gap-2 justify-between">
          <div className="flex gap-2">
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasChanges}
              className="flex items-center space-x-2"
            >
              {isSaving ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </Button>

            <Button
              variant="outline"
              onClick={loadLandingPage}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Recarregar
            </Button>
          </div>

          {isCustom && (
            <Button
              variant="destructive"
              onClick={handleReset}
            >
              <RotateCcw className="h-4 w-4 mr-2" />
              Resetar para Padrão
            </Button>
          )}
        </div>

        {/* Documentação */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            <strong>Dica:</strong> Use <code>paginaBase.html</code> como template.
            Veja a documentação completa em <code>docs/Landing_Page_Customizada.md</code>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};

export default LandingPageEditor;
