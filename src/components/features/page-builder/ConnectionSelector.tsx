/**
 * ConnectionSelector Component
 * 
 * Dropdown to select a database connection for the page builder.
 * Loads available fields when a connection is selected.
 */

import { useEffect, useState } from 'react';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Database, AlertCircle } from 'lucide-react';
import { databaseConnectionsService } from '@/services/database-connections';
import type { DatabaseConnection, FieldMetadata } from '@/lib/types';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface ConnectionSelectorProps {
  selectedConnectionId: string | null;
  onConnectionChange: (connection: DatabaseConnection | null, fields: FieldMetadata[]) => void;
  disabled?: boolean;
  compact?: boolean;
}

/**
 * Convert field mappings from connection to FieldMetadata array
 */
function extractFieldsFromConnection(connection: DatabaseConnection): FieldMetadata[] {
  const fieldMappings = connection.fieldMappings || connection.field_mappings || [];
  
  return fieldMappings.map((mapping, index) => ({
    columnName: mapping.columnName,
    label: mapping.label || mapping.columnName,
    type: 'TEXT' as const, // Default type, will be refined when editing
    visible: mapping.visible ?? true,
    editable: mapping.editable ?? true,
    required: false,
    order: index,
  }));
}

export function ConnectionSelector({
  selectedConnectionId,
  onConnectionChange,
  disabled = false,
  compact = false,
}: ConnectionSelectorProps) {
  const [connections, setConnections] = useState<DatabaseConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingFields, setLoadingFields] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch available connections
  useEffect(() => {
    const fetchConnections = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const data = await databaseConnectionsService.getAllConnections();
        setConnections(data);
      } catch (err) {
        setError('Erro ao carregar conexões de banco de dados');
      } finally {
        setLoading(false);
      }
    };

    fetchConnections();
  }, []);

  // Load fields when there's an initial selectedConnectionId
  useEffect(() => {
    if (!loading && selectedConnectionId && connections.length > 0) {
      const connection = connections.find(c => c.id === selectedConnectionId);
      if (connection) {
        loadFieldsForConnection(connection);
      }
    }
  }, [loading, selectedConnectionId, connections.length]);

  // Load fields for a connection
  const loadFieldsForConnection = async (connection: DatabaseConnection) => {
    setLoadingFields(true);
    
    try {
      if (connection.type === 'NOCODB') {
        const columns = await databaseConnectionsService.getNocoDBColumns(connection);
        const fields: FieldMetadata[] = columns.map((col, index) => ({
          columnName: col.column_name,
          label: col.title || col.column_name,
          type: col.uidt as FieldMetadata['type'] || 'TEXT',
          visible: true,
          editable: true,
          required: false,
          order: index,
        }));
        onConnectionChange(connection, fields);
      } else {
        const fields = extractFieldsFromConnection(connection);
        onConnectionChange(connection, fields);
      }
    } catch (err) {
      const fields = extractFieldsFromConnection(connection);
      onConnectionChange(connection, fields);
    } finally {
      setLoadingFields(false);
    }
  };

  // Handle connection selection
  const handleConnectionSelect = async (connectionId: string) => {
    const connection = connections.find(c => c.id === connectionId) || null;
    
    if (!connection) {
      onConnectionChange(null, []);
      return;
    }

    await loadFieldsForConnection(connection);
  };

  if (loading) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground h-8">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando...</span>
        </div>
      );
    }
    return (
      <div className="space-y-2">
        <Label>Conexão de Banco de Dados</Label>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Carregando conexões...</span>
        </div>
      </div>
    );
  }

  if (error) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-destructive h-8">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">Erro ao carregar</span>
        </div>
      );
    }
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (connections.length === 0) {
    if (compact) {
      return (
        <div className="flex items-center gap-2 text-muted-foreground h-8">
          <Database className="h-4 w-4" />
          <span className="text-sm">Nenhuma conexão</span>
        </div>
      );
    }
    return (
      <Alert>
        <Database className="h-4 w-4" />
        <AlertDescription>
          Nenhuma conexão de banco de dados configurada. 
          Configure uma conexão antes de criar temas.
        </AlertDescription>
      </Alert>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-muted-foreground shrink-0" />
        <Select
          value={selectedConnectionId || ''}
          onValueChange={handleConnectionSelect}
          disabled={disabled || loadingFields}
        >
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder="Selecione conexão..." />
          </SelectTrigger>
          <SelectContent>
            {connections.map((conn) => (
              <SelectItem key={conn.id} value={conn.id || ''}>
                {conn.name} ({conn.type})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loadingFields && (
          <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="connection-select">Conexão de Banco de Dados</Label>
      <Select
        value={selectedConnectionId || ''}
        onValueChange={handleConnectionSelect}
        disabled={disabled || loadingFields}
      >
        <SelectTrigger id="connection-select" className="w-full">
          <SelectValue placeholder="Selecione uma conexão" />
        </SelectTrigger>
        <SelectContent>
          {connections.map((conn) => (
            <SelectItem key={conn.id} value={conn.id || ''}>
              {conn.name} ({conn.type})
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {loadingFields && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          <span className="text-xs">Carregando campos...</span>
        </div>
      )}
    </div>
  );
}
