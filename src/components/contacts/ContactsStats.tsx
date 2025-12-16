/**
 * ContactsStats Component
 * 
 * Exibe estatísticas dos contatos em cards com gradientes clicáveis.
 * Permite aplicar filtros relacionados ao clicar nas estatísticas.
 */

import { Users, UserCheck, UserX, Tags } from 'lucide-react';
import { CardContent } from '@/components/ui/card';
import { GradientCard, getIconClasses, type GradientVariant } from '@/components/ui-custom';
import { cn } from '@/lib/utils';
import { ContactStats } from '@/services/contactsService';
import { ContactFilters } from '@/services/contactsService';

interface ContactsStatsProps {
  stats: ContactStats;
  onFilterApply: (filters: Partial<ContactFilters>) => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  variant: GradientVariant;
  onClick: () => void;
  ariaLabel: string;
  animationDelay?: string;
  disabled?: boolean;
}

function StatCard({ 
  title, 
  value, 
  subtitle, 
  icon: Icon, 
  variant, 
  onClick, 
  ariaLabel,
  animationDelay,
  disabled = false
}: StatCardProps) {
  const iconClasses = getIconClasses(variant);
  
  return (
    <GradientCard
      variant={variant}
      className={cn(
        "transition-all duration-200 stagger-fade-in",
        !disabled && "cursor-pointer hover:scale-[1.02] hover:shadow-lg focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2"
      )}
      style={animationDelay ? { animationDelay } : undefined}
      onClick={!disabled ? onClick : undefined}
      onKeyDown={!disabled ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
      tabIndex={!disabled ? 0 : undefined}
      role={!disabled ? "button" : undefined}
      aria-label={ariaLabel}
    >
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </div>
          <div className={cn('p-3 rounded-xl', iconClasses)}>
            <Icon className="w-5 h-5" aria-hidden="true" />
          </div>
        </div>
      </CardContent>
    </GradientCard>
  );
}

export function ContactsStats({ stats, onFilterApply }: ContactsStatsProps) {
  const handleTotalClick = () => {
    onFilterApply({ search: '', tags: [], hasName: null });
  };

  const handleWithNameClick = () => {
    onFilterApply({ hasName: true });
  };

  const handleWithoutNameClick = () => {
    onFilterApply({ hasName: false });
  };

  const handleTagsClick = () => {
    // Não aplica filtro específico
  };

  const getPercentage = (value: number) => {
    return stats.total > 0 
      ? `${((value / stats.total) * 100).toFixed(1)}% do total`
      : '0% do total';
  };

  return (
    <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4" role="region" aria-label="Estatísticas de contatos">
      <StatCard
        title="Total de Contatos"
        value={stats.total}
        subtitle="Clique para ver todos"
        icon={Users}
        variant="blue"
        onClick={handleTotalClick}
        ariaLabel={`Total de ${stats.total.toLocaleString()} contatos. Clique para ver todos`}
      />

      <StatCard
        title="Com Nome"
        value={stats.withName}
        subtitle={getPercentage(stats.withName)}
        icon={UserCheck}
        variant="green"
        onClick={handleWithNameClick}
        ariaLabel={`${stats.withName.toLocaleString()} contatos com nome, ${getPercentage(stats.withName)}. Clique para filtrar`}
        animationDelay="0.1s"
      />

      <StatCard
        title="Sem Nome"
        value={stats.withoutName}
        subtitle={getPercentage(stats.withoutName)}
        icon={UserX}
        variant="orange"
        onClick={handleWithoutNameClick}
        ariaLabel={`${stats.withoutName.toLocaleString()} contatos sem nome, ${getPercentage(stats.withoutName)}. Clique para filtrar`}
        animationDelay="0.2s"
      />

      <StatCard
        title="Tags"
        value={stats.totalTags}
        subtitle={stats.totalTags === 0 
          ? 'Nenhuma tag criada'
          : stats.totalTags === 1
          ? '1 tag disponível'
          : `${stats.totalTags} tags disponíveis`
        }
        icon={Tags}
        variant="purple"
        onClick={handleTagsClick}
        ariaLabel={stats.totalTags === 0 
          ? 'Nenhuma tag criada'
          : `${stats.totalTags} tags disponíveis`
        }
        animationDelay="0.3s"
        disabled={stats.totalTags === 0}
      />
    </div>
  );
}
