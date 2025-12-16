/**
 * ReportFilters Component
 * Filter controls for campaign reports
 * 
 * Requirements: 3.3
 */

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar, Filter, X, Search } from 'lucide-react';
import { ReportFilters as ReportFiltersType, CampaignStatus } from '@/services/reportService';

interface ReportFiltersProps {
  filters: ReportFiltersType;
  onFiltersChange: (filters: ReportFiltersType) => void;
  onApply: () => void;
  onClear: () => void;
}

const STATUS_OPTIONS: { value: CampaignStatus; label: string }[] = [
  { value: 'scheduled', label: 'Agendada' },
  { value: 'running', label: 'Em execução' },
  { value: 'paused', label: 'Pausada' },
  { value: 'completed', label: 'Concluída' },
  { value: 'cancelled', label: 'Cancelada' },
  { value: 'failed', label: 'Falhou' },
];

export function ReportFilters({
  filters,
  onFiltersChange,
  onApply,
  onClear,
}: ReportFiltersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleDateChange = (field: 'start' | 'end', value: string) => {
    onFiltersChange({
      ...filters,
      dateRange: {
        ...filters.dateRange,
        [field]: value,
      } as { start: string; end: string },
    });
  };

  const handleStatusToggle = (status: CampaignStatus) => {
    const currentStatuses = filters.status || [];
    const newStatuses = currentStatuses.includes(status)
      ? currentStatuses.filter((s) => s !== status)
      : [...currentStatuses, status];
    
    onFiltersChange({
      ...filters,
      status: newStatuses.length > 0 ? newStatuses : undefined,
    });
  };

  const hasActiveFilters = 
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    (filters.status && filters.status.length > 0) ||
    filters.instance;

  const activeFilterCount = [
    filters.dateRange?.start || filters.dateRange?.end,
    filters.status && filters.status.length > 0,
    filters.instance,
  ].filter(Boolean).length;

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsExpanded(!isExpanded)}
            className="flex items-center gap-2"
          >
            <Filter className="h-4 w-4" />
            Filtros
            {activeFilterCount > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeFilterCount}
              </Badge>
            )}
          </Button>
          
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="text-muted-foreground"
            >
              <X className="h-4 w-4 mr-1" />
              Limpar filtros
            </Button>
          )}
        </div>

        {isExpanded && (
          <div className="space-y-4">
            {/* Date Range */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data inicial
                </Label>
                <Input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) => handleDateChange('start', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  Data final
                </Label>
                <Input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) => handleDateChange('end', e.target.value)}
                />
              </div>
            </div>

            {/* Status Filter */}
            <div className="space-y-2">
              <Label>Status</Label>
              <div className="flex flex-wrap gap-2">
                {STATUS_OPTIONS.map((option) => {
                  const isSelected = filters.status?.includes(option.value);
                  return (
                    <Badge
                      key={option.value}
                      variant={isSelected ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => handleStatusToggle(option.value)}
                    >
                      {option.label}
                    </Badge>
                  );
                })}
              </div>
            </div>

            {/* Instance Filter */}
            <div className="space-y-2">
              <Label>Instância</Label>
              <Select
                value={filters.instance || 'all'}
                onValueChange={(value) =>
                  onFiltersChange({
                    ...filters,
                    instance: value === 'all' ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todas as instâncias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as instâncias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Apply Button */}
            <div className="flex justify-end">
              <Button onClick={onApply} className="flex items-center gap-2">
                <Search className="h-4 w-4" />
                Aplicar Filtros
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ReportFilters;
