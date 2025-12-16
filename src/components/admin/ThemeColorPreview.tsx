import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Moon, Sun, Check, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import {
  calculateContrastRatio,
  validateContrast,
  suggestContrastAdjustment,
  hexToHSL,
  hexToRGB,
  getRelativeLuminance,
  calculateForeground,
} from '@/services/themeColorManager';

interface ThemeColorPreviewProps {
  primaryColor: string;
  secondaryColor: string;
  primaryForeground?: string | null;
  secondaryForeground?: string | null;
}

export const ThemeColorPreview: React.FC<ThemeColorPreviewProps> = ({
  primaryColor,
  secondaryColor,
  primaryForeground,
  secondaryForeground,
}) => {
  const [previewMode, setPreviewMode] = useState<'light' | 'dark'>('light');

  const togglePreviewMode = () => {
    setPreviewMode((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Determinar qual cor usar baseado no modo
  const currentColor = previewMode === 'dark' ? primaryColor : secondaryColor;

  // Determinar cor de texto (foreground)
  const currentForeground = useMemo(() => {
    if (previewMode === 'dark') {
      if (primaryForeground) return primaryForeground;
      // Fallback cálculo automático
      try {
        const hsl = hexToHSL(primaryColor);
        const fgHsl = calculateForeground(hsl);
        // Converter HSL de volta para hex ou usar variável CSS (simplificação aqui: usar preto/branco aproximado)
        // Para preview preciso, ideal seria converter HSL->Hex, mas vamos usar a lógica de luminosidade
        const rgb = hexToRGB(primaryColor);
        const lum = getRelativeLuminance(rgb);
        return lum > 0.5 ? '#1C1917' : '#FAFAF9';
      } catch {
        return '#FAFAF9';
      }
    } else {
      if (secondaryForeground) return secondaryForeground;
      try {
        const hsl = hexToHSL(secondaryColor);
        const rgb = hexToRGB(secondaryColor);
        const lum = getRelativeLuminance(rgb);
        return lum > 0.5 ? '#1C1917' : '#FAFAF9';
      } catch {
        return '#FAFAF9';
      }
    }
  }, [previewMode, primaryColor, secondaryColor, primaryForeground, secondaryForeground]);

  // Calcular contraste para dark mode (primaryColor com fundo escuro E primaryForeground com primaryColor)
  const darkModeContrast = useMemo(() => {
    try {
      const darkBackground = '#1C1917'; // Dark mode background

      // Contraste com fundo da página
      const bgRatio = calculateContrastRatio(primaryColor, darkBackground);
      const bgValidation = validateContrast(bgRatio);

      // Contraste do texto no botão (foreground vs background)
      const fgColor = primaryForeground || (getRelativeLuminance(hexToRGB(primaryColor)) > 0.5 ? '#1C1917' : '#FAFAF9');
      const textRatio = calculateContrastRatio(fgColor, primaryColor);
      const textValidation = validateContrast(textRatio);
      const textAdjustment = suggestContrastAdjustment(primaryColor, fgColor);

      return {
        bgRatio,
        bgValidation,
        textRatio,
        textValidation,
        textAdjustment
      };
    } catch {
      return null;
    }
  }, [primaryColor, primaryForeground]);

  // Calcular contraste para light mode
  const lightModeContrast = useMemo(() => {
    try {
      const lightBackground = '#FAFAF9'; // Light mode background

      // Contraste com fundo da página
      const bgRatio = calculateContrastRatio(secondaryColor, lightBackground);
      const bgValidation = validateContrast(bgRatio);

      // Contraste do texto no botão
      const fgColor = secondaryForeground || (getRelativeLuminance(hexToRGB(secondaryColor)) > 0.5 ? '#1C1917' : '#FAFAF9');
      const textRatio = calculateContrastRatio(fgColor, secondaryColor);
      const textValidation = validateContrast(textRatio);
      const textAdjustment = suggestContrastAdjustment(secondaryColor, fgColor);

      return {
        bgRatio,
        bgValidation,
        textRatio,
        textValidation,
        textAdjustment
      };
    } catch {
      return null;
    }
  }, [secondaryColor, secondaryForeground]);

  const currentContrast = previewMode === 'dark' ? darkModeContrast : lightModeContrast;

  return (
    <Card className="border-2">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Preview de Cores</CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={togglePreviewMode}
            className="gap-2"
          >
            {previewMode === 'light' ? (
              <>
                <Sun className="h-4 w-4" />
                Light
              </>
            ) : (
              <>
                <Moon className="h-4 w-4" />
                Dark
              </>
            )}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Preview de Botões */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Botões</h4>
          <div className="flex flex-wrap gap-3">
            <Button
              style={{
                backgroundColor: currentColor,
                color: currentForeground,
              }}
            >
              <Check className="h-4 w-4 mr-2" />
              Botão Primário
            </Button>
            <Button
              variant="outline"
              style={{
                borderColor: currentColor,
                color: currentColor,
              }}
            >
              Botão Outline
            </Button>
            <Button
              variant="ghost"
              style={{
                color: currentColor,
              }}
            >
              Botão Ghost
            </Button>
          </div>
        </div>

        {/* Preview de Badges */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Badges</h4>
          <div className="flex flex-wrap gap-2">
            <Badge
              style={{
                backgroundColor: currentColor,
                color: currentForeground,
              }}
            >
              Badge Primário
            </Badge>
            <Badge
              variant="outline"
              style={{
                borderColor: currentColor,
                color: currentColor,
              }}
            >
              Badge Outline
            </Badge>
            <Badge
              variant="secondary"
              style={{
                backgroundColor: `${currentColor}20`,
                color: currentColor,
              }}
            >
              Badge Secundário
            </Badge>
          </div>
        </div>

        {/* Preview de Card */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">Cards</h4>
          <Card
            className="border-2"
            style={{
              borderColor: currentColor,
            }}
          >
            <CardHeader>
              <CardTitle
                className="text-sm"
                style={{
                  color: currentColor,
                }}
              >
                Card com Tema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Este é um exemplo de card usando a cor do tema selecionado.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Preview de Sidebar */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Elementos de Sidebar
          </h4>
          <div className="space-y-2">
            <div
              className="flex items-center gap-3 p-3 rounded-lg"
              style={{
                backgroundColor: `${currentColor}15`,
              }}
            >
              <div
                className="w-2 h-8 rounded-full"
                style={{
                  backgroundColor: currentColor,
                }}
              />
              <span
                className="text-sm font-medium"
                style={{
                  color: currentColor,
                }}
              >
                Item de Menu Ativo
              </span>
            </div>
            <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
              <div className="w-2 h-8 rounded-full bg-muted" />
              <span className="text-sm text-muted-foreground">
                Item de Menu Inativo
              </span>
            </div>
          </div>
        </div>

        {/* Preview de Links e Acentos */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground">
            Links e Acentos
          </h4>
          <div className="space-y-2">
            <p className="text-sm">
              Este é um texto com{' '}
              <a
                href="#"
                className="underline"
                style={{
                  color: currentColor,
                }}
                onClick={(e) => e.preventDefault()}
              >
                link colorido
              </a>{' '}
              usando a cor do tema.
            </p>
            <div className="flex items-center gap-2">
              <div
                className="w-4 h-4 rounded-full"
                style={{
                  backgroundColor: currentColor,
                }}
              />
              <span className="text-sm">Indicador de status ativo</span>
            </div>
          </div>
        </div>

        {/* Validação de Contraste */}
        {currentContrast && (
          <div className="pt-4 border-t space-y-3">
            <h4 className="text-sm font-medium text-muted-foreground">
              Validação de Contraste WCAG
            </h4>

            {/* Contraste Texto vs Botão */}
            <div
              className={`p-4 rounded-lg border-2 ${currentContrast.textValidation.isValid
                ? 'bg-green-50 dark:bg-green-950 border-green-500'
                : 'bg-amber-50 dark:bg-amber-950 border-amber-500'
                }`}
            >
              <div className="flex items-start gap-3">
                {currentContrast.textValidation.isValid ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      Texto no Botão
                    </span>
                    <Badge
                      variant={
                        currentContrast.textValidation.level === 'fail'
                          ? 'destructive'
                          : 'default'
                      }
                      className={
                        currentContrast.textValidation.level === 'AAA'
                          ? 'bg-green-600'
                          : currentContrast.textValidation.level === 'AA'
                            ? 'bg-blue-600'
                            : ''
                      }
                    >
                      {currentContrast.textValidation.level === 'fail'
                        ? 'Falhou'
                        : currentContrast.textValidation.level}
                    </Badge>
                  </div>

                  <div className="text-xs space-y-1">
                    <p>
                      <span className="font-medium">Razão:</span>{' '}
                      {currentContrast.textRatio}:1
                    </p>
                    <p className="text-muted-foreground">
                      Legibilidade do texto dentro dos botões
                    </p>
                  </div>

                  {currentContrast.textAdjustment.needsAdjustment && (
                    <div className="pt-2 border-t border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-muted-foreground">
                        {currentContrast.textAdjustment.suggestion}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Contraste Cor vs Fundo */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Visibilidade (vs Fundo)</p>
                <div className="flex items-center gap-2">
                  {currentContrast.bgValidation.isValid ? (
                    <CheckCircle2 className="h-3 w-3 text-green-600" />
                  ) : (
                    <X className="h-3 w-3 text-amber-600" />
                  )}
                  <span>{currentContrast.bgValidation.ratio}:1</span>
                </div>
              </div>
            </div>

            {/* Mostrar contraste para ambos os modos */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Dark Mode</p>
                {darkModeContrast && (
                  <div className="flex items-center gap-2">
                    {darkModeContrast.bgValidation.isValid ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <X className="h-3 w-3 text-amber-600" />
                    )}
                    <span>{darkModeContrast.bgValidation.ratio}:1</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {darkModeContrast.bgValidation.level}
                    </Badge>
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <p className="font-medium text-muted-foreground">Light Mode</p>
                {lightModeContrast && (
                  <div className="flex items-center gap-2">
                    {lightModeContrast.bgValidation.isValid ? (
                      <CheckCircle2 className="h-3 w-3 text-green-600" />
                    ) : (
                      <X className="h-3 w-3 text-amber-600" />
                    )}
                    <span>{lightModeContrast.bgValidation.ratio}:1</span>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1 py-0 h-4"
                    >
                      {lightModeContrast.bgValidation.level}
                    </Badge>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Informação sobre as cores */}
        <div className="pt-4 border-t space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Cor Dark Mode:</span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: primaryColor }}
              />
              <code className="px-2 py-1 bg-muted rounded">{primaryColor}</code>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Cor Light Mode:</span>
            <div className="flex items-center gap-2">
              <div
                className="w-6 h-6 rounded border"
                style={{ backgroundColor: secondaryColor }}
              />
              <code className="px-2 py-1 bg-muted rounded">
                {secondaryColor}
              </code>
            </div>
          </div>
        </div>
      </CardContent>
    </Card >
  );
};
