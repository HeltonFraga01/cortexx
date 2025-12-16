/**
 * Tabs Block
 * 
 * Displays content organized in tabbed sections.
 * Supports child blocks within each tab.
 */

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { BlockComponentProps, ThemeBlock } from '@/types/page-builder';
import { blockRegistry } from '../BlockRegistry';

interface TabConfig {
  id: string;
  label: string;
}

export function TabsBlockComponent({
  block,
  connection,
  record,
  formData,
  fieldMetadata,
  onRecordChange,
  onSave,
  onBack,
  saving,
  disabled,
  hasChanges,
  isPreview,
}: BlockComponentProps) {
  const { 
    tabs = [],
    defaultTab,
  } = block.props;

  const tabConfigs: TabConfig[] = Array.isArray(tabs) ? tabs : [];
  const children = block.children || [];

  if (tabConfigs.length === 0) {
    return (
      <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed">
        Configure as abas nas propriedades do bloco
      </div>
    );
  }

  // Group children by their tab assignment (using columnIndex as tab index)
  const getChildrenForTab = (tabIndex: number): ThemeBlock[] => {
    return children.filter(child => (child.columnIndex || 0) === tabIndex);
  };

  // Render a child block
  const renderChildBlock = (childBlock: ThemeBlock) => {
    const definition = blockRegistry.get(childBlock.type);
    if (!definition) return null;

    const BlockComponent = definition.component;
    return (
      <BlockComponent
        key={childBlock.id}
        block={childBlock}
        connection={connection}
        record={record}
        formData={formData}
        fieldMetadata={fieldMetadata}
        onRecordChange={onRecordChange}
        onSave={onSave}
        onBack={onBack}
        saving={saving}
        disabled={disabled}
        hasChanges={hasChanges}
        isPreview={isPreview}
      />
    );
  };

  const defaultValue = defaultTab || tabConfigs[0]?.id || 'tab-0';

  return (
    <Tabs defaultValue={defaultValue} className="w-full">
      <TabsList className="w-full justify-start">
        {tabConfigs.map((tab, index) => (
          <TabsTrigger key={tab.id || `tab-${index}`} value={tab.id || `tab-${index}`}>
            {tab.label || `Aba ${index + 1}`}
          </TabsTrigger>
        ))}
      </TabsList>
      
      {tabConfigs.map((tab, index) => {
        const tabChildren = getChildrenForTab(index);
        return (
          <TabsContent 
            key={tab.id || `tab-${index}`} 
            value={tab.id || `tab-${index}`}
            className="mt-4 space-y-4"
          >
            {tabChildren.length > 0 ? (
              tabChildren.map(renderChildBlock)
            ) : (
              <div className="text-sm text-muted-foreground p-4 border rounded-lg border-dashed text-center">
                Arraste blocos para esta aba
              </div>
            )}
          </TabsContent>
        );
      })}
    </Tabs>
  );
}

export default TabsBlockComponent;
