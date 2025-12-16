import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useBranding, useBrandingActions } from '@/hooks/useBranding';
import { BrandingConfigUpdate } from '@/types/branding';
import { brandingService } from '@/services/branding';
import CustomHomeHtmlEditor from './CustomHomeHtmlEditor';
import HtmlPreviewModal from './HtmlPreviewModal';
import { ThemeColorPreview } from './ThemeColorPreview';
import { getDefaultHomeHtml } from '@/constants/defaultHomeHtml';
import {
  Save,
  RefreshCw,
  RotateCcw,
  Palette,
  Image,
  Type,
  AlertCircle,
  CheckCircle,
  Eye,
  EyeOff,
  Wand2,
  Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { hexToHSL, calculateForeground, hexToRGB, getRelativeLuminance } from '@/services/themeColorManager';

interface FormData {
  appName: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  primaryForeground: string;
  secondaryForeground: string;
  supportPhone: string;
  ogImageUrl: string;
}

interface ValidationErrors {
  appName?: string;
  logoUrl?: string;
  primaryColor?: string;
  secondaryColor?: string;
  primaryForeground?: string;
  secondaryForeground?: string;
  customHomeHtml?: string;
  supportPhone?: string;
  ogImageUrl?: string;
}

const BrandingSettings: React.FC = () => {
  const { config, isLoading, error } = useBranding();
  const { updateConfig, refreshConfig, resetToDefault, previewThemeColors, cancelPreview, isPreviewActive } = useBrandingActions();

  const [formData, setFormData] = useState<FormData>({
    appName: '',
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
    primaryForeground: '',
    secondaryForeground: '',
    supportPhone: '',
    ogImageUrl: '',
  });

  const [customHomeHtml, setCustomHomeHtml] = useState<string>('');
  const [showPreview, setShowPreview] = useState(false);
  const [htmlErrors, setHtmlErrors] = useState<string[]>([]);
  const [htmlWarnings, setHtmlWarnings] = useState<string[]>([]);

  const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
  const [isSaving, setSaving] = useState(false);
  const [isRefreshing, setRefreshing] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [showColorPreview, setShowColorPreview] = useState(false);

  // Estado para rastrear a última configuração salva (não a inicial)
  const [lastSavedConfig, setLastSavedConfig] = useState<{
    appName: string;
    logoUrl: string;
    primaryColor: string;
    secondaryColor: string;
    primaryForeground: string;
    secondaryForeground: string;
    customHomeHtml: string;
    supportPhone: string;
    ogImageUrl: string;
  }>({
    appName: '',
    logoUrl: '',
    primaryColor: '',
    secondaryColor: '',
    primaryForeground: '',
    secondaryForeground: '',
    customHomeHtml: '',
    supportPhone: '',
    ogImageUrl: '',
  });

  // Sincronizar form com configuração atual
  useEffect(() => {
    const newFormData = {
      appName: config.appName || '',
      logoUrl: config.logoUrl || '',
      primaryColor: config.primaryColor || '',
      secondaryColor: config.secondaryColor || '',
      primaryForeground: config.primaryForeground || '',
      secondaryForeground: config.secondaryForeground || '',
      supportPhone: config.supportPhone || '',
      ogImageUrl: config.ogImageUrl || '',
    };
    const newHtml = config.customHomeHtml || '';

    setFormData(newFormData);
    setCustomHomeHtml(newHtml);

    // Atualizar última configuração salva
    setLastSavedConfig({
      ...newFormData,
      customHomeHtml: newHtml,
    });

    setHasChanges(false);
  }, [config]);

  // Detectar mudanças no formulário comparando com última configuração SALVA
  useEffect(() => {
    const hasFormChanges =
      formData.appName !== lastSavedConfig.appName ||
      formData.logoUrl !== lastSavedConfig.logoUrl ||
      formData.primaryColor !== lastSavedConfig.primaryColor ||
      formData.secondaryColor !== lastSavedConfig.secondaryColor ||
      formData.primaryForeground !== lastSavedConfig.primaryForeground ||
      formData.secondaryForeground !== lastSavedConfig.secondaryForeground ||
      formData.supportPhone !== lastSavedConfig.supportPhone ||
      formData.ogImageUrl !== lastSavedConfig.ogImageUrl ||
      customHomeHtml !== lastSavedConfig.customHomeHtml;

    setHasChanges(hasFormChanges);
  }, [formData, customHomeHtml, lastSavedConfig]);

  const validateForm = (): boolean => {
    const errors: ValidationErrors = {};

    // Validar nome da aplicação
    if (!formData.appName.trim()) {
      errors.appName = 'Nome da aplicação é obrigatório';
    } else if (formData.appName.length < 1 || formData.appName.length > 50) {
      errors.appName = 'Nome deve ter entre 1 e 50 caracteres';
    } else if (!/^[a-zA-Z0-9\s\-_\.]+$/.test(formData.appName)) {
      errors.appName = 'Nome contém caracteres inválidos';
    }

    // Validar URL do logo (opcional)
    if (formData.logoUrl.trim()) {
      try {
        new URL(formData.logoUrl);
      } catch {
        errors.logoUrl = 'URL inválida';
      }
    }

    // Validar cor primária (opcional)
    if (formData.primaryColor.trim()) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(formData.primaryColor)) {
        errors.primaryColor = 'Cor deve estar no formato #RRGGBB';
      }
    }

    // Validar cor secundária (opcional)
    if (formData.secondaryColor.trim()) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(formData.secondaryColor)) {
        errors.secondaryColor = 'Cor deve estar no formato #RRGGBB';
      }
    }

    // Validar cor de texto primária (opcional)
    if (formData.primaryForeground.trim()) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(formData.primaryForeground)) {
        errors.primaryForeground = 'Cor deve estar no formato #RRGGBB';
      }
    }

    // Validar cor de texto secundária (opcional)
    if (formData.secondaryForeground.trim()) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(formData.secondaryForeground)) {
        errors.secondaryForeground = 'Cor deve estar no formato #RRGGBB';
      }
    }

    // Validar telefone de suporte (opcional)
    if (formData.supportPhone.trim()) {
      // Remove caracteres não numéricos para validação
      const digitsOnly = formData.supportPhone.replace(/\D/g, '');
      if (digitsOnly.length < 10 || digitsOnly.length > 15) {
        errors.supportPhone = 'Número deve conter entre 10 e 15 dígitos (com código do país)';
      }
    }

    // Validar URL da imagem OG (opcional)
    if (formData.ogImageUrl.trim()) {
      try {
        new URL(formData.ogImageUrl);
      } catch {
        errors.ogImageUrl = 'URL inválida';
      }
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Limpar erro específico quando usuário começar a digitar
    if (validationErrors[field]) {
      setValidationErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Preview em tempo real com debounce (300ms)
  useEffect(() => {
    if (!formData.primaryColor || !formData.secondaryColor) {
      return;
    }

    // Validar formato das cores antes de aplicar preview
    const isPrimaryValid = /^#[0-9A-Fa-f]{6}$/.test(formData.primaryColor);
    const isSecondaryValid = /^#[0-9A-Fa-f]{6}$/.test(formData.secondaryColor);

    if (!isPrimaryValid || !isSecondaryValid) {
      return;
    }

    const timeoutId = setTimeout(() => {
      if (showColorPreview) {
        previewThemeColors(
          formData.primaryColor,
          formData.secondaryColor,
          formData.primaryForeground || null,
          formData.secondaryForeground || null
        );
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [formData.primaryColor, formData.secondaryColor, formData.primaryForeground, formData.secondaryForeground, showColorPreview, previewThemeColors]);

  // Cancelar preview quando componente desmontar
  useEffect(() => {
    return () => {
      if (isPreviewActive) {
        cancelPreview();
      }
    };
  }, [isPreviewActive, cancelPreview]);

  // Avisar sobre mudanças não salvas ao sair da página
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasChanges) {
        e.preventDefault();
        e.returnValue = 'Você tem alterações não salvas. Deseja realmente sair?';
        return e.returnValue;
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [hasChanges]);

  const handleToggleColorPreview = useCallback(() => {
    if (showColorPreview) {
      setShowColorPreview(false);
      cancelPreview();
    } else {
      setShowColorPreview(true);
      if (formData.primaryColor && formData.secondaryColor) {
        previewThemeColors(
          formData.primaryColor,
          formData.secondaryColor,
          formData.primaryForeground || null,
          formData.secondaryForeground || null
        );
      }
    }
  }, [showColorPreview, formData.primaryColor, formData.secondaryColor, formData.primaryForeground, formData.secondaryForeground, previewThemeColors, cancelPreview]);

  const handleResetColors = useCallback(() => {
    setFormData(prev => ({
      ...prev,
      primaryColor: '',
      secondaryColor: '',
      primaryForeground: '',
      secondaryForeground: '',
    }));
    cancelPreview();
    setShowColorPreview(false);
    toast.info('Cores resetadas para padrão');
  }, [cancelPreview]);

  const handleSave = async () => {
    if (!validateForm()) {
      toast.error('Corrija os erros antes de salvar');
      return;
    }

    setSaving(true);

    try {
      // Normalizar telefone: remover caracteres não numéricos
      const normalizedPhone = formData.supportPhone.trim().replace(/\D/g, '');

      const updates: BrandingConfigUpdate = {
        appName: formData.appName.trim(),
        logoUrl: formData.logoUrl.trim() || null,
        primaryColor: formData.primaryColor.trim() || null,
        secondaryColor: formData.secondaryColor.trim() || null,
        primaryForeground: formData.primaryForeground.trim() || null,
        secondaryForeground: formData.secondaryForeground.trim() || null,
        customHomeHtml: customHomeHtml.trim() || null,
        supportPhone: normalizedPhone || null,
        ogImageUrl: formData.ogImageUrl.trim() || null,
      };

      const success = await updateConfig(updates);

      if (success) {
        // Atualizar última configuração salva
        setLastSavedConfig({
          appName: formData.appName.trim(),
          logoUrl: formData.logoUrl.trim(),
          primaryColor: formData.primaryColor.trim(),
          secondaryColor: formData.secondaryColor.trim(),
          primaryForeground: formData.primaryForeground.trim(),
          secondaryForeground: formData.secondaryForeground.trim(),
          customHomeHtml: customHomeHtml.trim(),
          supportPhone: normalizedPhone,
          ogImageUrl: formData.ogImageUrl.trim(),
        });

        setHasChanges(false);
        setHtmlErrors([]);
        setHtmlWarnings([]);
        toast.success('Configurações salvas com sucesso!');
      } else {
        // Se falhou, tentar novamente após 2 segundos
        toast.error('Erro ao salvar. Tentando novamente...', {
          duration: 2000,
        });

        setTimeout(async () => {
          try {
            const retrySuccess = await updateConfig(updates);
            if (retrySuccess) {
              // Atualizar última configuração salva
              setLastSavedConfig({
                appName: formData.appName.trim(),
                logoUrl: formData.logoUrl.trim(),
                primaryColor: formData.primaryColor.trim(),
                secondaryColor: formData.secondaryColor.trim(),
                primaryForeground: formData.primaryForeground.trim(),
                secondaryForeground: formData.secondaryForeground.trim(),
                customHomeHtml: customHomeHtml.trim(),
                supportPhone: normalizedPhone,
                ogImageUrl: formData.ogImageUrl.trim(),
              });

              setHasChanges(false);
              setHtmlErrors([]);
              setHtmlWarnings([]);
              toast.success('Configurações salvas com sucesso!');
            } else {
              toast.error('Falha ao salvar configurações. Tente novamente mais tarde.');
            }
          } catch (retryErr) {
            console.error('Erro na tentativa de retry:', retryErr);
            toast.error('Falha ao salvar configurações. Verifique sua conexão.');
          } finally {
            setSaving(false);
          }
        }, 2000);
        return; // Não executar finally ainda
      }
    } catch (err) {
      console.error('Erro ao salvar configurações:', err);

      // Determinar tipo de erro
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido';

      if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Erro de conexão. Verifique sua internet e tente novamente.');
      } else if (errorMessage.includes('timeout')) {
        toast.error('Tempo esgotado. Tente novamente.');
      } else if (errorMessage.includes('HTML')) {
        toast.error('Erro no HTML customizado. Verifique o conteúdo.');
        setHtmlErrors([errorMessage]);
      } else {
        toast.error(`Erro ao salvar: ${errorMessage}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshConfig();
      toast.success('Configurações atualizadas');
    } catch (err) {
      toast.error('Erro ao atualizar configurações');
    } finally {
      setRefreshing(false);
    }
  };

  const handleReset = () => {
    if (window.confirm('Tem certeza que deseja resetar todas as configurações para os valores padrão?')) {
      resetToDefault();
      setFormData({
        appName: 'WUZAPI',
        logoUrl: '',
        primaryColor: '',
        secondaryColor: '',
        primaryForeground: '',
        secondaryForeground: '',
        supportPhone: '',
        ogImageUrl: '',
      });
      setCustomHomeHtml('');
    }
  };

  const handleHtmlChange = (value: string) => {
    setCustomHomeHtml(value);
    // Sem validações restritivas - admin confia no código
    setHtmlErrors([]);
    setHtmlWarnings([]);
  };

  const handlePreview = () => {
    setShowPreview(true);
  };

  const handleResetHtml = () => {
    if (window.confirm('Tem certeza que deseja resetar o HTML para o template padrão?')) {
      setCustomHomeHtml(getDefaultHomeHtml(formData.appName || 'WUZAPI'));
      toast.success('HTML resetado para o template padrão');
    }
  };

  const suggestContrast = (bgColor: string, field: 'primaryForeground' | 'secondaryForeground') => {
    if (!bgColor || !/^#[0-9A-Fa-f]{6}$/.test(bgColor)) {
      toast.error('Cor de fundo inválida para sugestão');
      return;
    }

    try {
      const hsl = hexToHSL(bgColor);
      const fgHsl = calculateForeground(hsl);

      // Converter HSL de volta para Hex é complexo sem uma lib, 
      // mas podemos usar a lógica de luminosidade para sugerir preto ou branco
      // que é o que calculateForeground faz essencialmente (retorna cores muito escuras ou muito claras)

      // Vamos simplificar e usar a lógica de luminosidade direta para sugerir #FAFAF9 ou #1C1917
      // que são as cores usadas no ThemeColorPreview
      const rgb = hexToRGB(bgColor);
      const lum = getRelativeLuminance(rgb);
      const suggestedColor = lum > 0.5 ? '#1C1917' : '#FAFAF9';

      handleInputChange(field, suggestedColor);
      toast.success('Cor de contraste sugerida aplicada');
    } catch (e) {
      console.error('Erro ao sugerir contraste:', e);
      toast.error('Erro ao calcular contraste');
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Palette className="h-5 w-5" />
            <span>Configurações de Branding</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2">Carregando configurações...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Palette className="h-5 w-5" />
          <span>Configurações de Branding</span>
          {hasChanges && (
            <Badge variant="secondary" className="ml-2">
              Alterações pendentes
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Personalize a aparência e identidade visual da aplicação
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Nome da Aplicação */}
        <div className="space-y-2">
          <Label htmlFor="appName" className="flex items-center space-x-2">
            <Type className="h-4 w-4" />
            <span>Nome da Aplicação</span>
          </Label>
          <Input
            id="appName"
            value={formData.appName}
            onChange={(e) => handleInputChange('appName', e.target.value)}
            placeholder="Ex: Minha Empresa"
            maxLength={50}
            className={validationErrors.appName ? 'border-red-500' : ''}
          />
          {validationErrors.appName && (
            <p className="text-sm text-red-500">{validationErrors.appName}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Nome que aparecerá no título das páginas e navegação
          </p>
        </div>

        {/* URL do Logo */}
        <div className="space-y-2">
          <Label htmlFor="logoUrl" className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span>URL do Logo</span>
          </Label>
          <Input
            id="logoUrl"
            type="url"
            value={formData.logoUrl}
            onChange={(e) => handleInputChange('logoUrl', e.target.value)}
            placeholder="https://exemplo.com/logo.png"
            className={validationErrors.logoUrl ? 'border-red-500' : ''}
          />
          {validationErrors.logoUrl && (
            <p className="text-sm text-red-500">{validationErrors.logoUrl}</p>
          )}
          <p className="text-xs text-muted-foreground">
            URL pública do logo da empresa (opcional)
          </p>
          {formData.logoUrl && (
            <div className="mt-2">
              <img
                src={formData.logoUrl}
                alt="Preview do logo"
                className="max-h-16 max-w-32 object-contain border rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        {/* Telefone de Suporte WhatsApp */}
        <div className="space-y-2">
          <Label htmlFor="supportPhone" className="flex items-center space-x-2">
            <Phone className="h-4 w-4" />
            <span>Telefone de Suporte (WhatsApp)</span>
          </Label>
          <Input
            id="supportPhone"
            type="tel"
            value={formData.supportPhone}
            onChange={(e) => handleInputChange('supportPhone', e.target.value)}
            placeholder="+55 11 99999-9999"
            className={validationErrors.supportPhone ? 'border-red-500' : ''}
          />
          {validationErrors.supportPhone && (
            <p className="text-sm text-red-500">{validationErrors.supportPhone}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Número do WhatsApp para suporte. Inclua o código do país (ex: 5511999999999). 
            Deixe vazio para ocultar o botão de suporte.
          </p>
        </div>

        {/* Imagem de Preview para Redes Sociais (Open Graph) */}
        <div className="space-y-2">
          <Label htmlFor="ogImageUrl" className="flex items-center space-x-2">
            <Image className="h-4 w-4" />
            <span>Imagem de Preview (Redes Sociais)</span>
          </Label>
          <Input
            id="ogImageUrl"
            type="url"
            value={formData.ogImageUrl}
            onChange={(e) => handleInputChange('ogImageUrl', e.target.value)}
            placeholder="https://exemplo.com/preview.png"
            className={validationErrors.ogImageUrl ? 'border-red-500' : ''}
          />
          {validationErrors.ogImageUrl && (
            <p className="text-sm text-red-500">{validationErrors.ogImageUrl}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Imagem exibida ao compartilhar links em redes sociais (WhatsApp, Facebook, LinkedIn, etc.).
            Tamanho recomendado: 1200x630 pixels. Se não definida, será usada a logo.
          </p>
          {formData.ogImageUrl && (
            <div className="mt-2">
              <img
                src={formData.ogImageUrl}
                alt="Preview da imagem OG"
                className="max-h-32 max-w-64 object-contain border rounded"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Cores do Tema */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Cores do Tema</h3>
              <p className="text-sm text-muted-foreground">
                Personalize as cores para modo claro e escuro
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleColorPreview}
                className="gap-2"
              >
                {showColorPreview ? (
                  <>
                    <EyeOff className="h-4 w-4" />
                    Ocultar Preview
                  </>
                ) : (
                  <>
                    <Eye className="h-4 w-4" />
                    Mostrar Preview
                  </>
                )}
              </Button>
              {(formData.primaryColor || formData.secondaryColor) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetColors}
                  className="gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Resetar Cores
                </Button>
              )}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="primaryColor" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor do Tema Dark
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="primaryColor"
                    type="color"
                    value={formData.primaryColor || '#3B82F6'}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    className="w-16 h-10 p-1 border rounded cursor-pointer"
                  />
                  <Input
                    value={formData.primaryColor}
                    onChange={(e) => handleInputChange('primaryColor', e.target.value)}
                    placeholder="#3B82F6"
                    className={`flex-1 ${validationErrors.primaryColor ? 'border-red-500' : ''}`}
                  />
                </div>
                {validationErrors.primaryColor && (
                  <p className="text-sm text-red-500">{validationErrors.primaryColor}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cor principal usada no modo escuro (botões, links, acentos)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="primaryForeground" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Cor do Texto (Dark)
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="primaryForeground"
                    type="color"
                    value={formData.primaryForeground || '#FAFAF9'}
                    onChange={(e) => handleInputChange('primaryForeground', e.target.value)}
                    className="w-16 h-10 p-1 border rounded cursor-pointer"
                  />
                  <Input
                    value={formData.primaryForeground}
                    onChange={(e) => handleInputChange('primaryForeground', e.target.value)}
                    placeholder="#FAFAF9"
                    className={`flex-1 ${validationErrors.primaryForeground ? 'border-red-500' : ''}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    title="Sugerir contraste ideal"
                    onClick={() => suggestContrast(formData.primaryColor, 'primaryForeground')}
                    disabled={!formData.primaryColor}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
                {validationErrors.primaryForeground && (
                  <p className="text-sm text-red-500">{validationErrors.primaryForeground}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cor do texto sobre a cor primária (botões, badges)
                </p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="secondaryColor" className="flex items-center gap-2">
                  <Palette className="h-4 w-4" />
                  Cor do Tema Light
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="secondaryColor"
                    type="color"
                    value={formData.secondaryColor || '#10B981'}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    className="w-16 h-10 p-1 border rounded cursor-pointer"
                  />
                  <Input
                    value={formData.secondaryColor}
                    onChange={(e) => handleInputChange('secondaryColor', e.target.value)}
                    placeholder="#10B981"
                    className={`flex-1 ${validationErrors.secondaryColor ? 'border-red-500' : ''}`}
                  />
                </div>
                {validationErrors.secondaryColor && (
                  <p className="text-sm text-red-500">{validationErrors.secondaryColor}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cor principal usada no modo claro (botões, links, acentos)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="secondaryForeground" className="flex items-center gap-2">
                  <Type className="h-4 w-4" />
                  Cor do Texto (Light)
                </Label>
                <div className="flex space-x-2">
                  <Input
                    id="secondaryForeground"
                    type="color"
                    value={formData.secondaryForeground || '#FAFAF9'}
                    onChange={(e) => handleInputChange('secondaryForeground', e.target.value)}
                    className="w-16 h-10 p-1 border rounded cursor-pointer"
                  />
                  <Input
                    value={formData.secondaryForeground}
                    onChange={(e) => handleInputChange('secondaryForeground', e.target.value)}
                    placeholder="#FAFAF9"
                    className={`flex-1 ${validationErrors.secondaryForeground ? 'border-red-500' : ''}`}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    title="Sugerir contraste ideal"
                    onClick={() => suggestContrast(formData.secondaryColor, 'secondaryForeground')}
                    disabled={!formData.secondaryColor}
                  >
                    <Wand2 className="h-4 w-4" />
                  </Button>
                </div>
                {validationErrors.secondaryForeground && (
                  <p className="text-sm text-red-500">{validationErrors.secondaryForeground}</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Cor do texto sobre a cor secundária (botões, badges)
                </p>
              </div>
            </div>
          </div>

          {/* Preview de Cores */}
          {/* Preview de Cores */}
          {showColorPreview && (
            <div className="mt-4">
              <ThemeColorPreview
                primaryColor={formData.primaryColor || '#3B82F6'}
                secondaryColor={formData.secondaryColor || '#10B981'}
                primaryForeground={formData.primaryForeground || null}
                secondaryForeground={formData.secondaryForeground || null}
              />
            </div>
          )}

          {isPreviewActive && (
            <Alert>
              <Eye className="h-4 w-4" />
              <AlertDescription>
                Preview ativo: As cores estão sendo aplicadas temporariamente. Salve para manter as alterações.
              </AlertDescription>
            </Alert>
          )}
        </div>

        <Separator />

        {/* HTML da Página Inicial */}
        <CustomHomeHtmlEditor
          value={customHomeHtml}
          onChange={handleHtmlChange}
          onPreview={handlePreview}
          onReset={handleResetHtml}
          disabled={isSaving}
          errors={htmlErrors}
          warnings={htmlWarnings}
        />

        <Separator />

        {/* Ações */}
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
              onClick={handleRefresh}
              disabled={isRefreshing}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          <Button
            variant="destructive"
            onClick={handleReset}
            className="flex items-center space-x-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span>Resetar</span>
          </Button>
        </div>

        {/* Status atual */}
        {config.updatedAt && (
          <div className="pt-4 border-t">
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4" />
              <span>
                Última atualização: {new Date(config.updatedAt).toLocaleString('pt-BR')}
              </span>
            </div>
          </div>
        )}
      </CardContent>

      {/* Modal de Preview */}
      <HtmlPreviewModal
        open={showPreview}
        onOpenChange={setShowPreview}
        html={customHomeHtml || getDefaultHomeHtml(config.appName)}
        brandingConfig={config}
      />
    </Card>
  );
};

export default BrandingSettings;