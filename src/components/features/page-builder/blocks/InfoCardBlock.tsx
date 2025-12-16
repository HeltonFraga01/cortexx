/**
 * Info Card Block
 * 
 * Displays information in a card format with label and value.
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { BlockComponentProps } from '@/types/page-builder';

export function InfoCardBlockComponent({
  block,
  record,
  connection,
}: BlockComponentProps) {
  const { 
    fieldName,
    label,
    showConnectionInfo = false,
  } = block.props;

  // If showing connection info
  if (showConnectionInfo) {
    return (
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Conexão
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium">{connection.name}</p>
          <p className="text-sm text-muted-foreground">{connection.type}</p>
        </CardContent>
      </Card>
    );
  }

  // Get value from field
  const value = fieldName ? record[fieldName] : null;
  const displayLabel = label || fieldName || 'Campo';

  // Format value for display
  const formatValue = (val: any): string => {
    if (val === null || val === undefined) return '-';
    if (val instanceof Date) return val.toLocaleDateString('pt-BR');
    if (typeof val === 'object') return JSON.stringify(val);
    return String(val);
  };

  return (
    <Card className="bg-muted/30">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {displayLabel}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="font-medium">{formatValue(value)}</p>
      </CardContent>
    </Card>
  );
}

export default InfoCardBlockComponent;
