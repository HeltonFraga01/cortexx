/**
 * ContactsFilters Component
 * 
 * Filtros avançados inline para contatos.
 * Permite busca por texto, filtro por tags e presença de nome.
 * Implementa debouncing de 300ms para a busca.
 */

import { useState, useEffect, useCallback } from 'react';
import { Search, X, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ContactFilters } from '@/services/contactsService';
import { Tag } from '@/services/contactsStorageService';

interface ContactsFiltersProps {
  filters: ContactFilters;
  onFiltersChange: (filters: ContactFilters) => void;
  availableTags: Tag[];
  resultCount: number;
  totalCount: number;
  hasActiveFilters: boolean;
  onSelectAllFiltered?: () => void;
}

export function ContactsFilters({
  filters,
  onFiltersChange,
  availableTags,
  resultCount,
  totalCount,
  hasActiveFilters,
  onSelectAllFiltered,
}: ContactsFiltersProps) {
  const [expanded, setExpanded] = useState(false);
  const [searchInput, setSearchInput] = useState(filters.search);
  const [isSearching, setIsSearching] = useState(false);

  // Sincronizar searchInput com filters.search quando filters mudar externamente
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Debounce da busca - 300ms
  useEffect(() => {
    // Mostrar indicador de busca se houver diferença
    if (searchInput !== filters.search) {
      setIsSearching(true);
    }

    const timeoutId = setTimeout(() => {
      if (searchInput !== filters.search) {
        onFiltersChange({ ...filters, search: searchInput });
      }
      setIsSearching(false);
    }, 300);

    return () => {
      clearTimeout(timeoutId);
      setIsSearching(false);
    };
  }, [searchInput]); // Apenas searchInput como dependência para evitar loops

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value);
  }, []);

  const handleTagToggle = (tagId: string) => {
    const newTags = filters.tags.includes(tagId)
      ? filters.tags.filter(t => t !== tagId)
      : [...filters.tags, tagId];
    onFiltersChange({ ...filters, tags: newTags });
  };

  const handleHasNameChange = (value: boolean | null) => {
    onFiltersChange({ ...filters, hasName: value });
  };

  const handleClearFilters = () => {
    onFiltersChange({
      search: '',
      tags: [],
      hasName: null,
    });
  };

  return (
    <Card className="transition-all duration-300 hover:shadow-md">
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-all duration-200"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        aria-controls="filters-content"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(!expanded);
          }
        }}
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Filtros Avançados</CardTitle>
            {hasActiveFilters && (
              <Badge 
                variant="secondary" 
                className="ml-2 animate-in transition-all duration-200" 
                aria-label={`${filters.tags.length + (filters.hasName !== null ? 1 : 0) + (filters.search ? 1 : 0)} filtros ativos`}
              >
                {filters.tags.length + (filters.hasName !== null ? 1 : 0) + (filters.search ? 1 : 0)} ativos
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span 
              className="text-sm text-muted-foreground transition-all duration-300"
              role="status"
              aria-live="polite"
              aria-atomic="true"
            >
              Mostrando {resultCount.toLocaleString()} de {totalCount.toLocaleString()} contatos
            </span>
            {expanded ? 
              <ChevronUp className="h-4 w-4 transition-transform duration-200" aria-hidden="true" /> : 
              <ChevronDown className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
            }
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="space-y-4 animate-in" id="filters-content">
          {/* Busca */}
          <div className="space-y-2">
            <label htmlFor="contact-search" className="text-sm font-medium">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="contact-search"
                placeholder="Buscar por nome ou telefone..."
                value={searchInput}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-9 pr-9"
                aria-label="Buscar contatos por nome ou telefone"
                aria-describedby={isSearching ? "search-status" : undefined}
              />
              {isSearching ? (
                <div 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  role="status"
                  aria-live="polite"
                  id="search-status"
                >
                  <Loader2 className="h-4 w-4 animate-spin" aria-label="Buscando contatos" />
                </div>
              ) : searchInput ? (
                <button
                  onClick={() => handleSearchChange('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label="Limpar busca"
                  type="button"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              ) : null}
            </div>
          </div>

          {/* Filtros de Nome */}
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Presença de Nome</legend>
            <div className="flex items-center gap-4" role="group" aria-label="Filtros de presença de nome">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="has-name"
                  checked={filters.hasName === true}
                  onCheckedChange={(checked) => 
                    handleHasNameChange(checked ? true : null)
                  }
                  aria-label="Filtrar apenas contatos com nome"
                />
                <label
                  htmlFor="has-name"
                  className="text-sm cursor-pointer"
                >
                  Apenas com nome
                </label>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="no-name"
                  checked={filters.hasName === false}
                  onCheckedChange={(checked) => 
                    handleHasNameChange(checked ? false : null)
                  }
                  aria-label="Filtrar apenas contatos sem nome"
                />
                <label
                  htmlFor="no-name"
                  className="text-sm cursor-pointer"
                >
                  Apenas sem nome
                </label>
              </div>
            </div>
          </fieldset>

          {/* Filtro por Tags */}
          {availableTags.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium">Tags</legend>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filtros de tags">
                {availableTags.map(tag => (
                  <Badge
                    key={tag.id}
                    variant={filters.tags.includes(tag.id) ? "default" : "outline"}
                    className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                    style={filters.tags.includes(tag.id) ? {
                      backgroundColor: tag.color,
                      borderColor: tag.color,
                    } : undefined}
                    onClick={() => handleTagToggle(tag.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTagToggle(tag.id);
                      }
                    }}
                    tabIndex={0}
                    role="checkbox"
                    aria-checked={filters.tags.includes(tag.id)}
                    aria-label={`Filtrar por tag ${tag.name}`}
                  >
                    {tag.name}
                  </Badge>
                ))}
              </div>
            </fieldset>
          )}

          {/* Ações */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 pt-2 border-t">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <span 
                className="text-sm text-muted-foreground"
                role="status"
                aria-live="polite"
                aria-atomic="true"
              >
                {resultCount === totalCount 
                  ? `${totalCount.toLocaleString()} contatos`
                  : `${resultCount.toLocaleString()} de ${totalCount.toLocaleString()}`
                }
              </span>
              {hasActiveFilters && onSelectAllFiltered && resultCount > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={onSelectAllFiltered}
                  className="w-full sm:w-auto"
                  aria-label={`Selecionar todos os ${resultCount.toLocaleString()} contatos filtrados`}
                >
                  <span className="hidden sm:inline">Selecionar {resultCount.toLocaleString()} filtrados</span>
                  <span className="sm:hidden">Selecionar {resultCount.toLocaleString()}</span>
                </Button>
              )}
            </div>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearFilters}
                className="w-full sm:w-auto"
                aria-label="Limpar todos os filtros"
              >
                <X className="h-4 w-4 mr-2" aria-hidden="true" />
                Limpar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
