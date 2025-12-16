/**
 * Block Registration
 * 
 * This module registers all available blocks with the BlockRegistry.
 * Import this module to ensure all blocks are registered.
 */

import { blockRegistry } from '../BlockRegistry';
import { HeaderBlockComponent } from './HeaderBlock';
import { FormGridBlockComponent } from './FormGridBlock';
import { SingleFieldBlockComponent } from './SingleFieldBlock';
import { AvatarBlockComponent } from './AvatarBlock';
import { SectionBlockComponent } from './SectionBlock';
import { DividerBlockComponent } from './DividerBlock';
import { SaveButtonBlockComponent } from './SaveButtonBlock';
import { InfoCardBlockComponent } from './InfoCardBlock';
// New blocks
import { TextBlockComponent } from './TextBlock';
import { ImageBlockComponent } from './ImageBlock';
import { BadgeBlockComponent } from './BadgeBlock';
import { StatsBlockComponent } from './StatsBlock';
import { LinkButtonBlockComponent } from './LinkButtonBlock';
import { ListBlockComponent } from './ListBlock';
import { TabsBlockComponent } from './TabsBlock';
import { RowBlockComponent } from './RowBlock';
import type { BlockDefinition } from '@/types/page-builder';
import { 
  LayoutTemplate, 
  FormInput, 
  Type, 
  User, 
  PanelTop, 
  Minus, 
  Save, 
  Info,
  // New icons
  AlignLeft,
  Image,
  Tag,
  BarChart3,
  ExternalLink,
  List,
  Layers,
  Columns,
} from 'lucide-react';

// Header Block Definition
const headerBlock: BlockDefinition = {
  type: 'header',
  name: 'Cabeçalho',
  description: 'Título da página com botão voltar',
  icon: PanelTop,
  category: 'layout',
  defaultProps: {
    titleField: '',
    subtitleField: '',
    showBackButton: true,
  },
  propsSchema: [
    {
      name: 'titleField',
      label: 'Campo do Título',
      type: 'field-select',
      helperText: 'Deixe vazio para usar o nome da conexão',
    },
    {
      name: 'subtitleField',
      label: 'Campo do Subtítulo',
      type: 'field-select',
      helperText: 'Deixe vazio para usar texto padrão',
    },
    {
      name: 'showBackButton',
      label: 'Mostrar Botão Voltar',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  component: HeaderBlockComponent,
};

// Form Grid Block Definition
const formGridBlock: BlockDefinition = {
  type: 'form-grid',
  name: 'Grid de Campos',
  description: 'Grade de campos do formulário',
  icon: LayoutTemplate,
  category: 'fields',
  defaultProps: {
    columns: 2,
    fields: [],
    title: '',
    showCard: true,
    spacing: 'normal',
  },
  propsSchema: [
    {
      name: 'title',
      label: 'Título da Seção',
      type: 'string',
      helperText: 'Deixe vazio para não mostrar título',
    },
    {
      name: 'columns',
      label: 'Colunas',
      type: 'select',
      options: [
        { value: '1', label: '1 Coluna' },
        { value: '2', label: '2 Colunas' },
        { value: '3', label: '3 Colunas' },
      ],
      defaultValue: '2',
    },
    {
      name: 'fields',
      label: 'Campos',
      type: 'field-multi-select',
      helperText: 'Selecione os campos a exibir',
    },
    {
      name: 'showCard',
      label: 'Mostrar Card',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'spacing',
      label: 'Espaçamento',
      type: 'select',
      options: [
        { value: 'compact', label: 'Compacto' },
        { value: 'normal', label: 'Normal' },
        { value: 'relaxed', label: 'Espaçado' },
      ],
      defaultValue: 'normal',
    },
  ],
  component: FormGridBlockComponent,
};

// Single Field Block Definition
const singleFieldBlock: BlockDefinition = {
  type: 'single-field',
  name: 'Campo Individual',
  description: 'Um único campo do formulário',
  icon: FormInput,
  category: 'fields',
  defaultProps: {
    fieldName: '',
    customLabel: '',
    fullWidth: false,
    showLabel: true,
  },
  propsSchema: [
    {
      name: 'fieldName',
      label: 'Campo',
      type: 'field-select',
      required: true,
    },
    {
      name: 'customLabel',
      label: 'Label Personalizado',
      type: 'string',
      helperText: 'Deixe vazio para usar o label padrão',
    },
    {
      name: 'fullWidth',
      label: 'Largura Total',
      type: 'boolean',
      defaultValue: false,
    },
  ],
  component: SingleFieldBlockComponent,
};

// Avatar Block Definition
const avatarBlock: BlockDefinition = {
  type: 'avatar',
  name: 'Avatar',
  description: 'Imagem de perfil com nome',
  icon: User,
  category: 'display',
  defaultProps: {
    imageField: '',
    nameField: '',
    statusField: '',
    size: 'large',
    alignment: 'center',
  },
  propsSchema: [
    {
      name: 'imageField',
      label: 'Campo da Imagem',
      type: 'field-select',
    },
    {
      name: 'nameField',
      label: 'Campo do Nome',
      type: 'field-select',
    },
    {
      name: 'statusField',
      label: 'Campo de Status',
      type: 'field-select',
      helperText: 'Exibido como badge',
    },
    {
      name: 'size',
      label: 'Tamanho',
      type: 'select',
      options: [
        { value: 'small', label: 'Pequeno' },
        { value: 'medium', label: 'Médio' },
        { value: 'large', label: 'Grande' },
      ],
      defaultValue: 'large',
    },
    {
      name: 'alignment',
      label: 'Alinhamento',
      type: 'select',
      options: [
        { value: 'left', label: 'Esquerda' },
        { value: 'center', label: 'Centro' },
        { value: 'right', label: 'Direita' },
      ],
      defaultValue: 'center',
    },
  ],
  component: AvatarBlockComponent,
};

// Section Block Definition
const sectionBlock: BlockDefinition = {
  type: 'section',
  name: 'Seção',
  description: 'Container colapsável para agrupar blocos',
  icon: Type,
  category: 'layout',
  defaultProps: {
    title: 'Seção',
    collapsible: true,
    defaultOpen: true,
  },
  propsSchema: [
    {
      name: 'title',
      label: 'Título',
      type: 'string',
      required: true,
      defaultValue: 'Seção',
    },
    {
      name: 'collapsible',
      label: 'Colapsável',
      type: 'boolean',
      defaultValue: true,
    },
    {
      name: 'defaultOpen',
      label: 'Aberto por Padrão',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  component: SectionBlockComponent,
  allowChildren: true,
};

// Divider Block Definition
const dividerBlock: BlockDefinition = {
  type: 'divider',
  name: 'Divisor',
  description: 'Linha divisória entre seções',
  icon: Minus,
  category: 'layout',
  defaultProps: {
    spacing: 'normal',
    showLine: true,
  },
  propsSchema: [
    {
      name: 'spacing',
      label: 'Espaçamento',
      type: 'select',
      options: [
        { value: 'compact', label: 'Compacto' },
        { value: 'normal', label: 'Normal' },
        { value: 'relaxed', label: 'Espaçado' },
      ],
      defaultValue: 'normal',
    },
    {
      name: 'showLine',
      label: 'Mostrar Linha',
      type: 'boolean',
      defaultValue: true,
    },
  ],
  component: DividerBlockComponent,
};

// Save Button Block Definition
const saveButtonBlock: BlockDefinition = {
  type: 'save-button',
  name: 'Botão Salvar',
  description: 'Botão para salvar alterações',
  icon: Save,
  category: 'actions',
  defaultProps: {
    label: 'Salvar Alterações',
    position: 'right',
    variant: 'default',
    fullWidth: false,
  },
  propsSchema: [
    {
      name: 'label',
      label: 'Texto do Botão',
      type: 'string',
      defaultValue: 'Salvar Alterações',
    },
    {
      name: 'position',
      label: 'Posição',
      type: 'select',
      options: [
        { value: 'left', label: 'Esquerda' },
        { value: 'center', label: 'Centro' },
        { value: 'right', label: 'Direita' },
      ],
      defaultValue: 'right',
    },
    {
      name: 'fullWidth',
      label: 'Largura Total',
      type: 'boolean',
      defaultValue: false,
    },
  ],
  component: SaveButtonBlockComponent,
};

// Info Card Block Definition
const infoCardBlock: BlockDefinition = {
  type: 'info-card',
  name: 'Card de Info',
  description: 'Card com informação de um campo',
  icon: Info,
  category: 'display',
  defaultProps: {
    fieldName: '',
    label: '',
    showConnectionInfo: false,
  },
  propsSchema: [
    {
      name: 'showConnectionInfo',
      label: 'Mostrar Info da Conexão',
      type: 'boolean',
      defaultValue: false,
      helperText: 'Exibe nome e tipo da conexão',
    },
    {
      name: 'fieldName',
      label: 'Campo',
      type: 'field-select',
      helperText: 'Ignorado se "Mostrar Info da Conexão" estiver ativo',
    },
    {
      name: 'label',
      label: 'Label',
      type: 'string',
      helperText: 'Deixe vazio para usar o nome do campo',
    },
  ],
  component: InfoCardBlockComponent,
};

// Text Block Definition
const textBlock: BlockDefinition = {
  type: 'text',
  name: 'Texto',
  description: 'Exibe texto estático ou de um campo',
  icon: AlignLeft,
  category: 'display',
  defaultProps: {
    textField: '',
    staticText: '',
    variant: 'body',
    alignment: 'left',
    color: 'default',
  },
  propsSchema: [
    { name: 'textField', label: 'Campo do Texto', type: 'field-select', helperText: 'Deixe vazio para usar texto estático' },
    { name: 'staticText', label: 'Texto Estático', type: 'string' },
    { name: 'variant', label: 'Estilo', type: 'select', options: [
      { value: 'heading1', label: 'Título 1' },
      { value: 'heading2', label: 'Título 2' },
      { value: 'heading3', label: 'Título 3' },
      { value: 'body', label: 'Corpo' },
      { value: 'small', label: 'Pequeno' },
      { value: 'caption', label: 'Legenda' },
    ], defaultValue: 'body' },
    { name: 'alignment', label: 'Alinhamento', type: 'select', options: [
      { value: 'left', label: 'Esquerda' },
      { value: 'center', label: 'Centro' },
      { value: 'right', label: 'Direita' },
    ], defaultValue: 'left' },
    { name: 'color', label: 'Cor', type: 'select', options: [
      { value: 'default', label: 'Padrão' },
      { value: 'muted', label: 'Suave' },
      { value: 'primary', label: 'Primária' },
      { value: 'destructive', label: 'Destrutiva' },
    ], defaultValue: 'default' },
  ],
  component: TextBlockComponent,
};

// Image Block Definition
const imageBlock: BlockDefinition = {
  type: 'image',
  name: 'Imagem',
  description: 'Exibe uma imagem de um campo URL',
  icon: Image,
  category: 'display',
  defaultProps: {
    imageField: '',
    altTextField: '',
    size: 'medium',
    alignment: 'center',
    rounded: 'none',
    objectFit: 'cover',
  },
  propsSchema: [
    { name: 'imageField', label: 'Campo da Imagem', type: 'field-select', required: true },
    { name: 'altTextField', label: 'Campo do Alt Text', type: 'field-select' },
    { name: 'size', label: 'Tamanho', type: 'select', options: [
      { value: 'small', label: 'Pequeno' },
      { value: 'medium', label: 'Médio' },
      { value: 'large', label: 'Grande' },
      { value: 'full', label: 'Largura Total' },
    ], defaultValue: 'medium' },
    { name: 'alignment', label: 'Alinhamento', type: 'select', options: [
      { value: 'left', label: 'Esquerda' },
      { value: 'center', label: 'Centro' },
      { value: 'right', label: 'Direita' },
    ], defaultValue: 'center' },
    { name: 'rounded', label: 'Bordas', type: 'select', options: [
      { value: 'none', label: 'Sem arredondamento' },
      { value: 'small', label: 'Pequeno' },
      { value: 'medium', label: 'Médio' },
      { value: 'large', label: 'Grande' },
      { value: 'full', label: 'Circular' },
    ], defaultValue: 'none' },
  ],
  component: ImageBlockComponent,
};

// Badge Block Definition
const badgeBlock: BlockDefinition = {
  type: 'badge',
  name: 'Badge',
  description: 'Exibe um badge/tag de status',
  icon: Tag,
  category: 'display',
  defaultProps: {
    textField: '',
    staticText: '',
    variant: 'default',
    alignment: 'left',
  },
  propsSchema: [
    { name: 'textField', label: 'Campo do Texto', type: 'field-select' },
    { name: 'staticText', label: 'Texto Estático', type: 'string' },
    { name: 'variant', label: 'Variante', type: 'select', options: [
      { value: 'default', label: 'Padrão' },
      { value: 'secondary', label: 'Secundário' },
      { value: 'destructive', label: 'Destrutivo' },
      { value: 'outline', label: 'Contorno' },
    ], defaultValue: 'default' },
    { name: 'alignment', label: 'Alinhamento', type: 'select', options: [
      { value: 'left', label: 'Esquerda' },
      { value: 'center', label: 'Centro' },
      { value: 'right', label: 'Direita' },
    ], defaultValue: 'left' },
  ],
  component: BadgeBlockComponent,
};

// Stats Block Definition
const statsBlock: BlockDefinition = {
  type: 'stats',
  name: 'Estatística',
  description: 'Exibe um valor numérico com label',
  icon: BarChart3,
  category: 'display',
  defaultProps: {
    valueField: '',
    labelField: '',
    staticLabel: '',
    format: 'number',
    size: 'medium',
    showCard: true,
    alignment: 'center',
  },
  propsSchema: [
    { name: 'valueField', label: 'Campo do Valor', type: 'field-select', required: true },
    { name: 'labelField', label: 'Campo do Label', type: 'field-select' },
    { name: 'staticLabel', label: 'Label Estático', type: 'string' },
    { name: 'format', label: 'Formato', type: 'select', options: [
      { value: 'number', label: 'Número' },
      { value: 'currency', label: 'Moeda (R$)' },
      { value: 'percentage', label: 'Porcentagem' },
      { value: 'decimal', label: 'Decimal' },
    ], defaultValue: 'number' },
    { name: 'size', label: 'Tamanho', type: 'select', options: [
      { value: 'small', label: 'Pequeno' },
      { value: 'medium', label: 'Médio' },
      { value: 'large', label: 'Grande' },
    ], defaultValue: 'medium' },
    { name: 'showCard', label: 'Mostrar Card', type: 'boolean', defaultValue: true },
  ],
  component: StatsBlockComponent,
};

// Link Button Block Definition
const linkButtonBlock: BlockDefinition = {
  type: 'link-button',
  name: 'Botão Link',
  description: 'Botão que abre um link',
  icon: ExternalLink,
  category: 'actions',
  defaultProps: {
    urlField: '',
    staticUrl: '',
    labelField: '',
    staticLabel: 'Abrir Link',
    variant: 'default',
    size: 'default',
    alignment: 'left',
    showIcon: true,
    openInNewTab: true,
  },
  propsSchema: [
    { name: 'urlField', label: 'Campo da URL', type: 'field-select' },
    { name: 'staticUrl', label: 'URL Estática', type: 'string' },
    { name: 'labelField', label: 'Campo do Label', type: 'field-select' },
    { name: 'staticLabel', label: 'Label Estático', type: 'string', defaultValue: 'Abrir Link' },
    { name: 'variant', label: 'Variante', type: 'select', options: [
      { value: 'default', label: 'Padrão' },
      { value: 'secondary', label: 'Secundário' },
      { value: 'outline', label: 'Contorno' },
      { value: 'ghost', label: 'Ghost' },
      { value: 'link', label: 'Link' },
    ], defaultValue: 'default' },
    { name: 'showIcon', label: 'Mostrar Ícone', type: 'boolean', defaultValue: true },
    { name: 'openInNewTab', label: 'Abrir em Nova Aba', type: 'boolean', defaultValue: true },
  ],
  component: LinkButtonBlockComponent,
};

// List Block Definition
const listBlock: BlockDefinition = {
  type: 'list',
  name: 'Lista',
  description: 'Exibe uma lista de itens',
  icon: List,
  category: 'display',
  defaultProps: {
    arrayField: '',
    listStyle: 'bullet',
    alignment: 'left',
    spacing: 'normal',
  },
  propsSchema: [
    { name: 'arrayField', label: 'Campo do Array', type: 'field-select', required: true, helperText: 'Campo com array ou texto separado por vírgulas' },
    { name: 'listStyle', label: 'Estilo', type: 'select', options: [
      { value: 'bullet', label: 'Marcadores' },
      { value: 'numbered', label: 'Numerada' },
      { value: 'none', label: 'Sem marcadores' },
    ], defaultValue: 'bullet' },
    { name: 'spacing', label: 'Espaçamento', type: 'select', options: [
      { value: 'compact', label: 'Compacto' },
      { value: 'normal', label: 'Normal' },
      { value: 'relaxed', label: 'Espaçado' },
    ], defaultValue: 'normal' },
  ],
  component: ListBlockComponent,
};

// Tabs Block Definition
const tabsBlock: BlockDefinition = {
  type: 'tabs',
  name: 'Abas',
  description: 'Organiza conteúdo em abas',
  icon: Layers,
  category: 'layout',
  defaultProps: {
    tabs: [
      { id: 'tab-1', label: 'Aba 1' },
      { id: 'tab-2', label: 'Aba 2' },
    ],
    defaultTab: 'tab-1',
  },
  propsSchema: [
    { name: 'tabs', label: 'Abas', type: 'string', helperText: 'Configure as abas no formato JSON' },
    { name: 'defaultTab', label: 'Aba Padrão', type: 'string' },
  ],
  component: TabsBlockComponent,
  allowChildren: true,
};

// Row Block Definition
const rowBlock: BlockDefinition = {
  type: 'row',
  name: 'Linha/Colunas',
  description: 'Container com 1-4 colunas',
  icon: Columns,
  category: 'layout',
  defaultProps: {
    columns: 2,
    columnWidths: ['50%', '50%'],
    gap: 'medium',
    verticalAlign: 'top',
    stackOnMobile: true,
  },
  propsSchema: [
    { name: 'columns', label: 'Colunas', type: 'select', options: [
      { value: '1', label: '1 Coluna' },
      { value: '2', label: '2 Colunas' },
      { value: '3', label: '3 Colunas' },
      { value: '4', label: '4 Colunas' },
    ], defaultValue: '2' },
    { name: 'gap', label: 'Espaçamento', type: 'select', options: [
      { value: 'none', label: 'Nenhum' },
      { value: 'small', label: 'Pequeno' },
      { value: 'medium', label: 'Médio' },
      { value: 'large', label: 'Grande' },
    ], defaultValue: 'medium' },
    { name: 'verticalAlign', label: 'Alinhamento Vertical', type: 'select', options: [
      { value: 'top', label: 'Topo' },
      { value: 'center', label: 'Centro' },
      { value: 'bottom', label: 'Base' },
      { value: 'stretch', label: 'Esticar' },
    ], defaultValue: 'top' },
    { name: 'stackOnMobile', label: 'Empilhar no Mobile', type: 'boolean', defaultValue: true },
  ],
  component: RowBlockComponent,
  allowChildren: true,
};

// Register all blocks
export function registerAllBlocks(): void {
  blockRegistry.clear();
  
  // Existing blocks
  blockRegistry.register(headerBlock);
  blockRegistry.register(formGridBlock);
  blockRegistry.register(singleFieldBlock);
  blockRegistry.register(avatarBlock);
  blockRegistry.register(sectionBlock);
  blockRegistry.register(dividerBlock);
  blockRegistry.register(saveButtonBlock);
  blockRegistry.register(infoCardBlock);
  
  // New blocks
  blockRegistry.register(textBlock);
  blockRegistry.register(imageBlock);
  blockRegistry.register(badgeBlock);
  blockRegistry.register(statsBlock);
  blockRegistry.register(linkButtonBlock);
  blockRegistry.register(listBlock);
  blockRegistry.register(tabsBlock);
  blockRegistry.register(rowBlock);
}

// Auto-register blocks on module load
registerAllBlocks();

// Export block definitions
export {
  headerBlock,
  formGridBlock,
  singleFieldBlock,
  avatarBlock,
  sectionBlock,
  dividerBlock,
  saveButtonBlock,
  infoCardBlock,
  // New blocks
  textBlock,
  imageBlock,
  badgeBlock,
  statsBlock,
  linkButtonBlock,
  listBlock,
  tabsBlock,
  rowBlock,
};

// Export block components
export { HeaderBlockComponent } from './HeaderBlock';
export { FormGridBlockComponent } from './FormGridBlock';
export { SingleFieldBlockComponent } from './SingleFieldBlock';
export { AvatarBlockComponent } from './AvatarBlock';
export { SectionBlockComponent } from './SectionBlock';
export { DividerBlockComponent } from './DividerBlock';
export { SaveButtonBlockComponent } from './SaveButtonBlock';
export { InfoCardBlockComponent } from './InfoCardBlock';
// New block components
export { TextBlockComponent } from './TextBlock';
export { ImageBlockComponent } from './ImageBlock';
export { BadgeBlockComponent } from './BadgeBlock';
export { StatsBlockComponent } from './StatsBlock';
export { LinkButtonBlockComponent } from './LinkButtonBlock';
export { ListBlockComponent } from './ListBlock';
export { TabsBlockComponent } from './TabsBlock';
export { RowBlockComponent } from './RowBlock';
