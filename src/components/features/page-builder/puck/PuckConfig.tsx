/**
 * Puck Configuration
 * 
 * Defines all available components, their fields, and categories
 * for the Puck visual editor.
 */

import type { Config, ComponentConfig } from '@measured/puck';
import { DropZone } from '@measured/puck';
import { FieldSelectField } from './fields/FieldSelectField';
import { FieldMultiSelectField } from './fields/FieldMultiSelectField';

// Import existing block components
import { HeaderBlockComponent } from '../blocks/HeaderBlock';
import { FormGridBlockComponent } from '../blocks/FormGridBlock';
import { SingleFieldBlockComponent } from '../blocks/SingleFieldBlock';
import { AvatarBlockComponent } from '../blocks/AvatarBlock';
import { SectionBlockComponent } from '../blocks/SectionBlock';
import { DividerBlockComponent } from '../blocks/DividerBlock';
import { SaveButtonBlockComponent } from '../blocks/SaveButtonBlock';
import { InfoCardBlockComponent } from '../blocks/InfoCardBlock';
import { TextBlockComponent } from '../blocks/TextBlock';
import { ImageBlockComponent } from '../blocks/ImageBlock';
import { BadgeBlockComponent } from '../blocks/BadgeBlock';
import { StatsBlockComponent } from '../blocks/StatsBlock';
import { LinkButtonBlockComponent } from '../blocks/LinkButtonBlock';
import { ListBlockComponent } from '../blocks/ListBlock';
import { TabsBlockComponent } from '../blocks/TabsBlock';

import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import type { ThemeBlock } from '@/types/page-builder';
import { cn } from '@/lib/utils';

/**
 * Context passed to all Puck components during rendering
 */
export interface PuckRenderContext {
  connection: DatabaseConnection | null;
  record: Record<string, any>;
  formData: Record<string, any>;
  fieldMetadata: FieldMetadata[];
  onRecordChange: (data: Record<string, any>) => void;
  onSave?: () => Promise<void>;
  onBack?: () => void;
  saving?: boolean;
  disabled?: boolean;
  hasChanges?: boolean;
  isPreview?: boolean;
}

// Global render context (set by PuckPageBuilder/PuckThemeRenderer)
let renderContext: PuckRenderContext = {
  connection: null,
  record: {},
  formData: {},
  fieldMetadata: [],
  onRecordChange: () => {},
  isPreview: true,
};

export function setRenderContext(context: PuckRenderContext) {
  renderContext = context;
}

export function getRenderContext(): PuckRenderContext {
  return renderContext;
}

/**
 * Wrapper to adapt existing block components to Puck format
 */
function createPuckComponent<P extends Record<string, any>>(
  BlockComponent: React.ComponentType<any>,
  defaultProps: P
): ComponentConfig<P> {
  return {
    defaultProps,
    render: (props) => {
      const ctx = getRenderContext();
      
      // Create a ThemeBlock-like structure for the existing component
      const block: ThemeBlock = {
        id: (props as any).id || 'puck-block',
        type: 'header', // Will be overridden by actual type
        props: props as Record<string, any>,
      };

      if (!ctx.connection) {
        return (
          <div className="p-4 border-2 border-dashed border-muted rounded-lg text-center text-muted-foreground">
            Selecione uma conexão para visualizar este bloco
          </div>
        );
      }

      return (
        <BlockComponent
          block={block}
          connection={ctx.connection}
          record={ctx.record}
          formData={ctx.formData}
          fieldMetadata={ctx.fieldMetadata}
          onRecordChange={ctx.onRecordChange}
          onSave={ctx.onSave}
          onBack={ctx.onBack}
          saving={ctx.saving}
          disabled={ctx.disabled}
          hasChanges={ctx.hasChanges}
          isPreview={ctx.isPreview}
        />
      );
    },
  };
}

/**
 * Create the Puck configuration with all components
 */
export function createPuckConfig(): Config {
  return {
    categories: {
      layout: {
        title: 'Layout',
        components: ['Columns', 'Container', 'Card', 'Section', 'Divider'],
      },
      fields: {
        title: 'Campos',
        components: ['FormGrid', 'SingleField'],
      },
      display: {
        title: 'Exibição',
        components: ['Header', 'Avatar', 'Text', 'Image', 'Badge', 'Stats', 'InfoCard', 'List'],
      },
      actions: {
        title: 'Ações',
        components: ['SaveButton', 'LinkButton', 'Tabs'],
      },
    },
    components: {
      // ============================================
      // LAYOUT COMPONENTS WITH DROPZONES
      // ============================================

      // Columns Component - Allows side-by-side layout with nested components
      Columns: {
        label: 'Colunas',
        defaultProps: {
          columns: 2,
          gap: 'medium',
          verticalAlign: 'top',
          distribution: 'equal',
        },
        fields: {
          columns: {
            type: 'select',
            label: 'Número de Colunas',
            options: [
              { label: '2 Colunas', value: 2 },
              { label: '3 Colunas', value: 3 },
              { label: '4 Colunas', value: 4 },
            ],
          },
          distribution: {
            type: 'select',
            label: 'Distribuição',
            options: [
              { label: 'Igual', value: 'equal' },
              { label: '1/3 + 2/3', value: '1-2' },
              { label: '2/3 + 1/3', value: '2-1' },
              { label: '1/4 + 3/4', value: '1-3' },
              { label: '3/4 + 1/4', value: '3-1' },
            ],
          },
          gap: {
            type: 'select',
            label: 'Espaçamento',
            options: [
              { label: 'Nenhum', value: 'none' },
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          verticalAlign: {
            type: 'select',
            label: 'Alinhamento Vertical',
            options: [
              { label: 'Topo', value: 'top' },
              { label: 'Centro', value: 'center' },
              { label: 'Base', value: 'bottom' },
              { label: 'Esticar', value: 'stretch' },
            ],
          },
        },
        render: ({ columns, gap, verticalAlign, distribution }) => {
          const numColumns = Number(columns) || 2;
          
          const gapValues: Record<string, string> = {
            none: '0',
            small: '0.5rem',
            medium: '1rem',
            large: '1.5rem',
          };

          const alignClasses: Record<string, string> = {
            top: 'items-start',
            center: 'items-center',
            bottom: 'items-end',
            stretch: 'items-stretch',
          };

          // Calculate column widths based on distribution
          const getGridTemplate = () => {
            if (numColumns === 2) {
              switch (distribution) {
                case '1-2': return '1fr 2fr';
                case '2-1': return '2fr 1fr';
                case '1-3': return '1fr 3fr';
                case '3-1': return '3fr 1fr';
                default: return '1fr 1fr';
              }
            }
            if (numColumns === 3) return '1fr 1fr 1fr';
            if (numColumns === 4) return '1fr 1fr 1fr 1fr';
            return '1fr 1fr';
          };

          return (
            <div
              className={cn(
                'grid w-full',
                alignClasses[verticalAlign] || alignClasses.top,
              )}
              style={{ 
                gridTemplateColumns: getGridTemplate(),
                gap: gapValues[gap] || gapValues.medium,
                minHeight: '80px' 
              }}
            >
              {Array.from({ length: numColumns }, (_, i) => (
                <div key={i} className="min-h-[60px]">
                  <DropZone zone={`column-${i}`} />
                </div>
              ))}
            </div>
          );
        },
      },

      // Container Component - Simple wrapper with padding and background
      Container: {
        label: 'Container',
        defaultProps: {
          padding: 'medium',
          background: 'none',
          border: false,
          rounded: 'medium',
          maxWidth: 'full',
        },
        fields: {
          padding: {
            type: 'select',
            label: 'Padding',
            options: [
              { label: 'Nenhum', value: 'none' },
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          background: {
            type: 'select',
            label: 'Fundo',
            options: [
              { label: 'Nenhum', value: 'none' },
              { label: 'Sutil', value: 'subtle' },
              { label: 'Card', value: 'card' },
              { label: 'Primário', value: 'primary' },
            ],
          },
          border: {
            type: 'radio',
            label: 'Borda',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
          rounded: {
            type: 'select',
            label: 'Bordas Arredondadas',
            options: [
              { label: 'Nenhum', value: 'none' },
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          maxWidth: {
            type: 'select',
            label: 'Largura Máxima',
            options: [
              { label: 'Total', value: 'full' },
              { label: 'Grande', value: 'lg' },
              { label: 'Médio', value: 'md' },
              { label: 'Pequeno', value: 'sm' },
            ],
          },
        },
        render: ({ padding, background, border, rounded, maxWidth }) => {
          const paddingClasses: Record<string, string> = {
            none: 'p-0',
            small: 'p-2',
            medium: 'p-4',
            large: 'p-6',
          };

          const bgClasses: Record<string, string> = {
            none: '',
            subtle: 'bg-muted/50',
            card: 'bg-card',
            primary: 'bg-primary/10',
          };

          const roundedClasses: Record<string, string> = {
            none: 'rounded-none',
            small: 'rounded-sm',
            medium: 'rounded-md',
            large: 'rounded-lg',
          };

          const maxWidthClasses: Record<string, string> = {
            full: 'max-w-full',
            lg: 'max-w-4xl mx-auto',
            md: 'max-w-2xl mx-auto',
            sm: 'max-w-xl mx-auto',
          };

          return (
            <div
              className={cn(
                'w-full',
                paddingClasses[padding] || paddingClasses.medium,
                bgClasses[background] || '',
                roundedClasses[rounded] || roundedClasses.medium,
                maxWidthClasses[maxWidth] || maxWidthClasses.full,
                border && 'border border-border'
              )}
              style={{ minHeight: '60px' }}
            >
              <DropZone zone="content" />
            </div>
          );
        },
      },

      // Card Component - Card wrapper with optional header
      Card: {
        label: 'Card',
        defaultProps: {
          title: '',
          padding: 'medium',
          shadow: true,
        },
        fields: {
          title: {
            type: 'text',
            label: 'Título (opcional)',
          },
          padding: {
            type: 'select',
            label: 'Padding',
            options: [
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          shadow: {
            type: 'radio',
            label: 'Sombra',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
        render: ({ title, padding, shadow }) => {
          const paddingClasses: Record<string, string> = {
            small: 'p-3',
            medium: 'p-4',
            large: 'p-6',
          };

          return (
            <div
              className={cn(
                'bg-card border border-border rounded-lg',
                shadow && 'shadow-sm',
              )}
            >
              {title && (
                <div className="px-4 py-3 border-b border-border">
                  <h3 className="font-semibold text-foreground">{title}</h3>
                </div>
              )}
              <div className={cn(paddingClasses[padding] || paddingClasses.medium)} style={{ minHeight: '60px' }}>
                <DropZone zone="card-content" />
              </div>
            </div>
          );
        },
      },

      // ============================================
      // EXISTING COMPONENTS
      // ============================================
      // Header Component
      Header: {
        ...createPuckComponent(HeaderBlockComponent, {
          titleField: '',
          subtitleField: '',
          showBackButton: true,
        }),
        label: 'Cabeçalho',
        fields: {
          titleField: {
            type: 'custom',
            label: 'Campo do Título',
            render: FieldSelectField,
          },
          subtitleField: {
            type: 'custom',
            label: 'Campo do Subtítulo',
            render: FieldSelectField,
          },
          showBackButton: {
            type: 'radio',
            label: 'Mostrar Botão Voltar',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // FormGrid Component
      FormGrid: {
        ...createPuckComponent(FormGridBlockComponent, {
          columns: 2,
          fields: [],
          title: '',
          showCard: true,
          spacing: 'normal',
        }),
        label: 'Grid de Campos',
        fields: {
          title: {
            type: 'text',
            label: 'Título da Seção',
          },
          columns: {
            type: 'select',
            label: 'Colunas',
            options: [
              { label: '1 Coluna', value: 1 },
              { label: '2 Colunas', value: 2 },
              { label: '3 Colunas', value: 3 },
            ],
          },
          fields: {
            type: 'custom',
            label: 'Campos',
            render: FieldMultiSelectField,
          },
          showCard: {
            type: 'radio',
            label: 'Mostrar Card',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
          spacing: {
            type: 'select',
            label: 'Espaçamento',
            options: [
              { label: 'Compacto', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Espaçado', value: 'relaxed' },
            ],
          },
        },
      },

      // SingleField Component
      SingleField: {
        ...createPuckComponent(SingleFieldBlockComponent, {
          fieldName: '',
          customLabel: '',
          fullWidth: false,
          showLabel: true,
        }),
        label: 'Campo Individual',
        fields: {
          fieldName: {
            type: 'custom',
            label: 'Campo',
            render: FieldSelectField,
          },
          customLabel: {
            type: 'text',
            label: 'Label Personalizado',
          },
          fullWidth: {
            type: 'radio',
            label: 'Largura Total',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // Avatar Component
      Avatar: {
        ...createPuckComponent(AvatarBlockComponent, {
          imageField: '',
          nameField: '',
          statusField: '',
          size: 'large',
          alignment: 'center',
        }),
        label: 'Avatar',
        fields: {
          imageField: {
            type: 'custom',
            label: 'Campo da Imagem',
            render: FieldSelectField,
          },
          nameField: {
            type: 'custom',
            label: 'Campo do Nome',
            render: FieldSelectField,
          },
          statusField: {
            type: 'custom',
            label: 'Campo de Status',
            render: FieldSelectField,
          },
          size: {
            type: 'select',
            label: 'Tamanho',
            options: [
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          alignment: {
            type: 'select',
            label: 'Alinhamento',
            options: [
              { label: 'Esquerda', value: 'left' },
              { label: 'Centro', value: 'center' },
              { label: 'Direita', value: 'right' },
            ],
          },
        },
      },

      // Section Component
      Section: {
        ...createPuckComponent(SectionBlockComponent, {
          title: 'Seção',
          collapsible: true,
          defaultOpen: true,
        }),
        label: 'Seção',
        fields: {
          title: {
            type: 'text',
            label: 'Título',
          },
          collapsible: {
            type: 'radio',
            label: 'Colapsável',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
          defaultOpen: {
            type: 'radio',
            label: 'Aberto por Padrão',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // Divider Component
      Divider: {
        ...createPuckComponent(DividerBlockComponent, {
          spacing: 'normal',
          showLine: true,
        }),
        label: 'Divisor',
        fields: {
          spacing: {
            type: 'select',
            label: 'Espaçamento',
            options: [
              { label: 'Compacto', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Espaçado', value: 'relaxed' },
            ],
          },
          showLine: {
            type: 'radio',
            label: 'Mostrar Linha',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // SaveButton Component
      SaveButton: {
        ...createPuckComponent(SaveButtonBlockComponent, {
          label: 'Salvar Alterações',
          position: 'right',
          variant: 'default',
          fullWidth: false,
        }),
        label: 'Botão Salvar',
        fields: {
          label: {
            type: 'text',
            label: 'Texto do Botão',
          },
          position: {
            type: 'select',
            label: 'Posição',
            options: [
              { label: 'Esquerda', value: 'left' },
              { label: 'Centro', value: 'center' },
              { label: 'Direita', value: 'right' },
            ],
          },
          fullWidth: {
            type: 'radio',
            label: 'Largura Total',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // InfoCard Component
      InfoCard: {
        ...createPuckComponent(InfoCardBlockComponent, {
          fieldName: '',
          label: '',
          showConnectionInfo: false,
        }),
        label: 'Card de Info',
        fields: {
          showConnectionInfo: {
            type: 'radio',
            label: 'Mostrar Info da Conexão',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
          fieldName: {
            type: 'custom',
            label: 'Campo',
            render: FieldSelectField,
          },
          label: {
            type: 'text',
            label: 'Label',
          },
        },
      },

      // Text Component
      Text: {
        ...createPuckComponent(TextBlockComponent, {
          textField: '',
          staticText: '',
          variant: 'body',
          alignment: 'left',
          color: 'default',
        }),
        label: 'Texto',
        fields: {
          textField: {
            type: 'custom',
            label: 'Campo do Texto',
            render: FieldSelectField,
          },
          staticText: {
            type: 'textarea',
            label: 'Texto Estático',
          },
          variant: {
            type: 'select',
            label: 'Estilo',
            options: [
              { label: 'Título 1', value: 'heading1' },
              { label: 'Título 2', value: 'heading2' },
              { label: 'Título 3', value: 'heading3' },
              { label: 'Corpo', value: 'body' },
              { label: 'Pequeno', value: 'small' },
              { label: 'Legenda', value: 'caption' },
            ],
          },
          alignment: {
            type: 'select',
            label: 'Alinhamento',
            options: [
              { label: 'Esquerda', value: 'left' },
              { label: 'Centro', value: 'center' },
              { label: 'Direita', value: 'right' },
            ],
          },
          color: {
            type: 'select',
            label: 'Cor',
            options: [
              { label: 'Padrão', value: 'default' },
              { label: 'Suave', value: 'muted' },
              { label: 'Primária', value: 'primary' },
              { label: 'Destrutiva', value: 'destructive' },
            ],
          },
        },
      },

      // Image Component
      Image: {
        ...createPuckComponent(ImageBlockComponent, {
          imageField: '',
          altTextField: '',
          size: 'medium',
          alignment: 'center',
          rounded: 'none',
          objectFit: 'cover',
        }),
        label: 'Imagem',
        fields: {
          imageField: {
            type: 'custom',
            label: 'Campo da Imagem',
            render: FieldSelectField,
          },
          altTextField: {
            type: 'custom',
            label: 'Campo do Alt Text',
            render: FieldSelectField,
          },
          size: {
            type: 'select',
            label: 'Tamanho',
            options: [
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
              { label: 'Largura Total', value: 'full' },
            ],
          },
          alignment: {
            type: 'select',
            label: 'Alinhamento',
            options: [
              { label: 'Esquerda', value: 'left' },
              { label: 'Centro', value: 'center' },
              { label: 'Direita', value: 'right' },
            ],
          },
          rounded: {
            type: 'select',
            label: 'Bordas',
            options: [
              { label: 'Sem arredondamento', value: 'none' },
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
              { label: 'Circular', value: 'full' },
            ],
          },
        },
      },

      // Badge Component
      Badge: {
        ...createPuckComponent(BadgeBlockComponent, {
          textField: '',
          staticText: '',
          variant: 'default',
          alignment: 'left',
        }),
        label: 'Badge',
        fields: {
          textField: {
            type: 'custom',
            label: 'Campo do Texto',
            render: FieldSelectField,
          },
          staticText: {
            type: 'text',
            label: 'Texto Estático',
          },
          variant: {
            type: 'select',
            label: 'Variante',
            options: [
              { label: 'Padrão', value: 'default' },
              { label: 'Secundário', value: 'secondary' },
              { label: 'Destrutivo', value: 'destructive' },
              { label: 'Contorno', value: 'outline' },
            ],
          },
          alignment: {
            type: 'select',
            label: 'Alinhamento',
            options: [
              { label: 'Esquerda', value: 'left' },
              { label: 'Centro', value: 'center' },
              { label: 'Direita', value: 'right' },
            ],
          },
        },
      },

      // Stats Component
      Stats: {
        ...createPuckComponent(StatsBlockComponent, {
          valueField: '',
          labelField: '',
          staticLabel: '',
          format: 'number',
          size: 'medium',
          showCard: true,
          alignment: 'center',
        }),
        label: 'Estatística',
        fields: {
          valueField: {
            type: 'custom',
            label: 'Campo do Valor',
            render: FieldSelectField,
          },
          labelField: {
            type: 'custom',
            label: 'Campo do Label',
            render: FieldSelectField,
          },
          staticLabel: {
            type: 'text',
            label: 'Label Estático',
          },
          format: {
            type: 'select',
            label: 'Formato',
            options: [
              { label: 'Número', value: 'number' },
              { label: 'Moeda (R$)', value: 'currency' },
              { label: 'Porcentagem', value: 'percentage' },
              { label: 'Decimal', value: 'decimal' },
            ],
          },
          size: {
            type: 'select',
            label: 'Tamanho',
            options: [
              { label: 'Pequeno', value: 'small' },
              { label: 'Médio', value: 'medium' },
              { label: 'Grande', value: 'large' },
            ],
          },
          showCard: {
            type: 'radio',
            label: 'Mostrar Card',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // LinkButton Component
      LinkButton: {
        ...createPuckComponent(LinkButtonBlockComponent, {
          urlField: '',
          staticUrl: '',
          labelField: '',
          staticLabel: 'Abrir Link',
          variant: 'default',
          size: 'default',
          alignment: 'left',
          showIcon: true,
          openInNewTab: true,
        }),
        label: 'Botão Link',
        fields: {
          urlField: {
            type: 'custom',
            label: 'Campo da URL',
            render: FieldSelectField,
          },
          staticUrl: {
            type: 'text',
            label: 'URL Estática',
          },
          labelField: {
            type: 'custom',
            label: 'Campo do Label',
            render: FieldSelectField,
          },
          staticLabel: {
            type: 'text',
            label: 'Label Estático',
          },
          variant: {
            type: 'select',
            label: 'Variante',
            options: [
              { label: 'Padrão', value: 'default' },
              { label: 'Secundário', value: 'secondary' },
              { label: 'Contorno', value: 'outline' },
              { label: 'Ghost', value: 'ghost' },
              { label: 'Link', value: 'link' },
            ],
          },
          showIcon: {
            type: 'radio',
            label: 'Mostrar Ícone',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
          openInNewTab: {
            type: 'radio',
            label: 'Abrir em Nova Aba',
            options: [
              { label: 'Sim', value: true },
              { label: 'Não', value: false },
            ],
          },
        },
      },

      // List Component
      List: {
        ...createPuckComponent(ListBlockComponent, {
          arrayField: '',
          listStyle: 'bullet',
          alignment: 'left',
          spacing: 'normal',
        }),
        label: 'Lista',
        fields: {
          arrayField: {
            type: 'custom',
            label: 'Campo do Array',
            render: FieldSelectField,
          },
          listStyle: {
            type: 'select',
            label: 'Estilo',
            options: [
              { label: 'Marcadores', value: 'bullet' },
              { label: 'Numerada', value: 'numbered' },
              { label: 'Sem marcadores', value: 'none' },
            ],
          },
          spacing: {
            type: 'select',
            label: 'Espaçamento',
            options: [
              { label: 'Compacto', value: 'compact' },
              { label: 'Normal', value: 'normal' },
              { label: 'Espaçado', value: 'relaxed' },
            ],
          },
        },
      },

      // Tabs Component
      Tabs: {
        ...createPuckComponent(TabsBlockComponent, {
          tabs: [
            { id: 'tab-1', label: 'Aba 1' },
            { id: 'tab-2', label: 'Aba 2' },
          ],
          defaultTab: 'tab-1',
        }),
        label: 'Abas',
        fields: {
          defaultTab: {
            type: 'text',
            label: 'Aba Padrão',
          },
        },
      },

    },
  };
}

// Export singleton config
export const puckConfig = createPuckConfig();
