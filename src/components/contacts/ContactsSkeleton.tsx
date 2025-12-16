/**
 * ContactsSkeleton Component
 * 
 * Skeleton loaders para estados de carregamento de contatos.
 * Melhora a percepção de performance durante operações assíncronas.
 * Inclui efeito shimmer para melhor feedback visual.
 */

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

interface ContactsSkeletonProps {
  rows?: number;
}

export function ContactsSkeleton({ rows = 5 }: ContactsSkeletonProps) {
  return (
    <div className="space-y-4 animate-in">
      {/* Skeleton para filtros */}
      <Card className="overflow-hidden">
        <CardHeader>
          <Skeleton className="h-6 w-48 shimmer" />
        </CardHeader>
      </Card>

      {/* Skeleton para tabela */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {/* Cabeçalho da tabela */}
          <div className="flex items-center border-b bg-muted/50 p-4">
            <Skeleton className="h-4 w-4 mr-4 shimmer" />
            <Skeleton className="h-4 w-32 mr-4 shimmer" />
            <Skeleton className="h-4 w-48 mr-4 shimmer" />
            <Skeleton className="h-4 w-24 shimmer" />
          </div>

          {/* Linhas da tabela com stagger animation */}
          {Array.from({ length: rows }).map((_, i) => (
            <div 
              key={i} 
              className="flex items-center border-b p-4 stagger-fade-in"
              style={{ animationDelay: `${i * 0.05}s` }}
            >
              <Skeleton className="h-4 w-4 mr-4 shimmer" />
              <Skeleton className="h-4 w-32 mr-4 shimmer" />
              <Skeleton className="h-4 w-48 mr-4 shimmer" />
              <Skeleton className="h-4 w-24 mr-4 shimmer" />
              <Skeleton className="h-8 w-16 shimmer" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

/**
 * ContactsStatsSkeleton Component
 * 
 * Skeleton loader para cards de estatísticas com animação stagger.
 */
export function ContactsStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card 
          key={i} 
          className="overflow-hidden stagger-fade-in"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-24 shimmer" />
            <Skeleton className="h-4 w-4 rounded-full shimmer" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16 mb-2 shimmer" />
            <Skeleton className="h-3 w-32 shimmer" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/**
 * ContactsTableSkeleton Component
 * 
 * Skeleton loader específico para a tabela de contatos com shimmer effect.
 */
export function ContactsTableSkeleton({ rows = 10 }: ContactsSkeletonProps) {
  return (
    <div className="border rounded-lg overflow-hidden animate-in">
      {/* Cabeçalho */}
      <div className="flex items-center border-b bg-muted/50 p-3">
        <div className="w-12 px-4">
          <Skeleton className="h-4 w-4 shimmer" />
        </div>
        <div className="w-44 px-4">
          <Skeleton className="h-4 w-24 shimmer" />
        </div>
        <div className="flex-[2] px-4">
          <Skeleton className="h-4 w-16 shimmer" />
        </div>
        <div className="flex-1 px-4">
          <Skeleton className="h-4 w-12 shimmer" />
        </div>
        <div className="w-24 px-4">
          <Skeleton className="h-4 w-16 shimmer" />
        </div>
      </div>

      {/* Linhas com stagger animation */}
      {Array.from({ length: rows }).map((_, i) => (
        <div 
          key={i} 
          className="flex items-center border-b p-3 stagger-fade-in"
          style={{ animationDelay: `${i * 0.03}s` }}
        >
          <div className="w-12 px-4">
            <Skeleton className="h-4 w-4 shimmer" />
          </div>
          <div className="w-44 px-4">
            <Skeleton className="h-4 w-32 shimmer" />
          </div>
          <div className="flex-[2] px-4">
            <Skeleton className="h-4 w-40 shimmer" />
          </div>
          <div className="flex-1 px-4 flex gap-1">
            <Skeleton className="h-6 w-16 rounded-full shimmer" />
            <Skeleton className="h-6 w-16 rounded-full shimmer" />
          </div>
          <div className="w-24 px-4 flex gap-1 justify-end">
            <Skeleton className="h-8 w-8 shimmer" />
            <Skeleton className="h-8 w-8 shimmer" />
          </div>
        </div>
      ))}
    </div>
  );
}
