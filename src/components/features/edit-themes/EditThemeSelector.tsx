/**
 * Edit Theme Selector
 * 
 * Admin UI component for selecting edit page themes.
 * Displays available themes with previews and descriptions.
 * Includes both built-in themes and custom themes from Page Builder.
 */

import { useState, useMemo, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Palette, Check, ImageOff, Loader2, Edit, Plus, Blocks } from 'lucide-react';
import { themeRegistry } from './ThemeRegistry';
import { listPageBuilderThemes, type PageBuilderTheme } from '@/services/page-builder-themes';
import type { EditThemeConfig } from '@/lib/types';
import { cn } from '@/lib/utils';
import { useNavigate } from 'react-router-dom';

// Import themes to ensure registration
import './themes';

interface EditThemeSelectorProps {
  config: EditThemeConfig | null | undefined;
  onConfigChange: (config: EditThemeConfig) => void;
  connectionId?: string;
}

export function EditThemeSelector({
  config,
  onConfigChange,
  connectionId,
}: EditThemeSelectorProps) {
  const navigate = useNavigate();
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const [customThemes, setCustomThemes] = useState<PageBuilderTheme[]>([]);
  const [loadingCustom, setLoadingCustom] = useState(false);
  
  // Get available built-in themes from registry
  const builtInThemes = useMemo(() => themeRegistry.list(), []);

  // Load custom themes
  useEffect(() => {
    const loadCustomThemes = async () => {
      setLoadingCustom(true);
      try {
        const response = await listPageBuilderThemes({ connectionId });
        if (response.success && response.data?.themes) {
          setCustomThemes(response.data.themes);
        }
      } catch {
        // Silently fail - custom themes are optional
      } finally {
        setLoadingCustom(false);
      }
    };

    loadCustomThemes();
  }, [connectionId]);
  
  const enabled = config?.enabled ?? false;
  const selectedThemeId = config?.themeId ?? 'default';

  const handleToggle = (newEnabled: boolean) => {
    onConfigChange({
      enabled: newEnabled,
      themeId: newEnabled ? (config?.themeId || 'default') : 'default',
      options: config?.options,
    });
  };

  const handleThemeSelect = (themeId: string) => {
    onConfigChange({
      enabled: true,
      themeId,
      options: config?.options,
    });
  };

  const handleImageError = (themeId: string) => {
    setImageErrors(prev => new Set(prev).add(themeId));
  };

  return (
    <div className="space-y-4">
      {/* Enable/Disable Toggle */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <Label htmlFor="theme-enabled" className="text-base font-semibold">
              Tema Personalizado
            </Label>
            <p className="text-sm text-muted-foreground">
              Usar um tema diferente do padrão para a página de edição
            </p>
          </div>
        </div>
        <Switch
          id="theme-enabled"
          checked={enabled}
          onCheckedChange={handleToggle}
        />
      </div>

      {/* Theme Selection Grid */}
      {enabled && (
        <div className="space-y-6 pt-4 border-t">
          {/* Built-in Themes */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Temas Padrão</Label>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {builtInThemes.map((theme) => {
                const isSelected = selectedThemeId === theme.id;
                const hasImageError = imageErrors.has(theme.id);
                
                return (
                  <button
                    key={theme.id}
                    type="button"
                    onClick={() => handleThemeSelect(theme.id)}
                    className={cn(
                      "relative flex flex-col rounded-lg border-2 p-2 text-left transition-all hover:border-primary/50",
                      isSelected 
                        ? "border-primary bg-primary/5" 
                        : "border-muted hover:bg-muted/50"
                    )}
                    aria-pressed={isSelected}
                    aria-label={`Selecionar tema ${theme.name}`}
                  >
                    {isSelected && (
                      <div className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </div>
                    )}
                    
                    <div className="aspect-video w-full rounded bg-muted overflow-hidden mb-2">
                      {hasImageError ? (
                        <div className="flex items-center justify-center h-full">
                          <ImageOff className="h-6 w-6 text-muted-foreground" />
                        </div>
                      ) : (
                        <img
                          src={theme.preview}
                          alt={`Preview do tema ${theme.name}`}
                          className="w-full h-full object-cover"
                          onError={() => handleImageError(theme.id)}
                        />
                      )}
                    </div>
                    
                    <div className="space-y-0.5">
                      <h4 className="font-medium text-xs">{theme.name}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-1">
                        {theme.description}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Custom Themes */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-medium">Temas Personalizados</Label>
                {loadingCustom && <Loader2 className="h-3 w-3 animate-spin" />}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate('/admin/page-builder')}
              >
                <Plus className="h-3 w-3 mr-1" />
                Criar
              </Button>
            </div>
            
            {customThemes.length === 0 && !loadingCustom ? (
              <div className="text-center py-6 border border-dashed rounded-lg">
                <Blocks className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                <p className="text-xs text-muted-foreground">
                  Nenhum tema personalizado
                </p>
                <Button
                  variant="link"
                  size="sm"
                  className="text-xs h-auto p-0 mt-1"
                  onClick={() => navigate('/admin/page-builder')}
                >
                  Criar no Page Builder
                </Button>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {customThemes.map((theme) => {
                  const themeId = `custom-${theme.id}`;
                  const isSelected = selectedThemeId === themeId;
                  
                  return (
                    <button
                      key={theme.id}
                      type="button"
                      onClick={() => handleThemeSelect(themeId)}
                      className={cn(
                        "relative flex flex-col rounded-lg border-2 p-2 text-left transition-all hover:border-primary/50",
                        isSelected 
                          ? "border-primary bg-primary/5" 
                          : "border-muted hover:bg-muted/50"
                      )}
                      aria-pressed={isSelected}
                      aria-label={`Selecionar tema ${theme.name}`}
                    >
                      {isSelected && (
                        <div className="absolute top-1.5 right-1.5 rounded-full bg-primary p-0.5">
                          <Check className="h-2.5 w-2.5 text-primary-foreground" />
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-1.5 left-1.5 h-5 w-5"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/page-builder/${theme.id}`);
                        }}
                      >
                        <Edit className="h-2.5 w-2.5" />
                      </Button>
                      
                      <div className="aspect-video w-full rounded bg-muted overflow-hidden mb-2 flex items-center justify-center">
                        {theme.previewImage ? (
                          <img
                            src={theme.previewImage}
                            alt={`Preview do tema ${theme.name}`}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Blocks className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1">
                          <h4 className="font-medium text-xs">{theme.name}</h4>
                          <Badge variant="secondary" className="text-[10px] px-1 py-0">
                            Custom
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">
                          {theme.description || `${theme.schema?.blocks?.length || 0} blocos`}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EditThemeSelector;
