/**
 * PreviewRecordSelector Component
 * 
 * Allows selecting a record from the connected database to preview
 * real data while building the page layout.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, Eye } from 'lucide-react';
import { databaseConnectionsService } from '@/services/database-connections';
import type { DatabaseConnection } from '@/lib/types';

interface PreviewRecordSelectorProps {
  connection: DatabaseConnection | null;
  onRecordSelect: (record: Record<string, unknown> | null) => void;
  selectedRecordId?: string | null;
  compact?: boolean;
}

interface RecordOption {
  id: string;
  label: string;
  record: Record<string, unknown>;
}

export function PreviewRecordSelector({
  connection,
  onRecordSelect,
  selectedRecordId,
  compact = false,
}: PreviewRecordSelectorProps) {
  const [records, setRecords] = useState<RecordOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(selectedRecordId || null);

  // Load records when connection changes
  useEffect(() => {
    if (!connection || !connection.id) {
      setRecords([]);
      setSelectedId(null);
      onRecordSelect(null);
      return;
    }

    const loadRecords = async () => {
      setLoading(true);
      try {
        // Fetch records using the database connections service
        // Connection ID can be string (UUID) or number
        const connectionId = connection.id;
        
        // Use admin endpoint to get table data for preview
        const response = await databaseConnectionsService.getTableData(connectionId, 50, 0);

        if (response && Array.isArray(response)) {
          const options: RecordOption[] = response.map((record: Record<string, unknown>, index: number) => {
            // Try to find a good label field (title, name, etc.)
            const labelField = findLabelField(record);
            const id = String(record.Id || record.id || record.ID || index);
            const label = labelField 
              ? String(record[labelField] || `Registro ${id}`)
              : `Registro ${id}`;

            return {
              id,
              label: label.length > 40 ? label.substring(0, 40) + '...' : label,
              record,
            };
          });

          setRecords(options);

          // Auto-select first record if none selected
          if (options.length > 0 && !selectedId) {
            setSelectedId(options[0].id);
            onRecordSelect(options[0].record);
          }
        }
      } catch (error) {
        console.error('Failed to load preview records:', error);
        setRecords([]);
      } finally {
        setLoading(false);
      }
    };

    loadRecords();
  }, [connection]);

  // Handle record selection
  const handleSelect = useCallback((value: string) => {
    setSelectedId(value);
    const selected = records.find(r => r.id === value);
    onRecordSelect(selected?.record || null);
  }, [records, onRecordSelect]);

  // Don't render if no connection
  if (!connection) {
    return null;
  }

  if (compact) {
    return (
      <Select
        value={selectedId || ''}
        onValueChange={handleSelect}
        disabled={loading || records.length === 0}
      >
        <SelectTrigger className="h-8 text-sm w-full">
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>Carregando...</span>
            </div>
          ) : (
            <SelectValue placeholder="Selecione um registro..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {records.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <div className="flex items-center gap-2">
                <Eye className="h-3 w-3 text-muted-foreground" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
          {records.length === 0 && !loading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhum registro encontrado
            </div>
          )}
        </SelectContent>
      </Select>
    );
  }

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground">
        Registro de Preview
      </label>
      <Select
        value={selectedId || ''}
        onValueChange={handleSelect}
        disabled={loading || records.length === 0}
      >
        <SelectTrigger>
          {loading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Carregando registros...</span>
            </div>
          ) : (
            <SelectValue placeholder="Selecione um registro para preview..." />
          )}
        </SelectTrigger>
        <SelectContent>
          {records.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <span>{option.label}</span>
              </div>
            </SelectItem>
          ))}
          {records.length === 0 && !loading && (
            <div className="px-2 py-1.5 text-sm text-muted-foreground">
              Nenhum registro encontrado
            </div>
          )}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Selecione um registro para visualizar dados reais no editor
      </p>
    </div>
  );
}

/**
 * Find the best field to use as a label for the record
 */
function findLabelField(record: Record<string, unknown>): string | null {
  const priorityFields = [
    'title', 'Title', 'TITLE',
    'name', 'Name', 'NAME',
    'nome', 'Nome', 'NOME',
    'titulo', 'Titulo', 'TITULO',
    'label', 'Label', 'LABEL',
    'description', 'Description',
    'email', 'Email', 'EMAIL',
  ];

  for (const field of priorityFields) {
    if (record[field] && typeof record[field] === 'string') {
      return field;
    }
  }

  // Find first string field that's not an ID
  for (const [key, value] of Object.entries(record)) {
    if (
      typeof value === 'string' &&
      value.length > 0 &&
      value.length < 100 &&
      !key.toLowerCase().includes('id') &&
      !key.startsWith('_')
    ) {
      return key;
    }
  }

  return null;
}

export default PreviewRecordSelector;
