import { useEffect } from "react";
import { Instance } from "@/lib/types";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import InstanceCard from "./InstanceCard";
import { RefetchOptions, QueryObserverResult } from "@tanstack/react-query";

interface InstancesListProps {
  instances: Instance[];
  isLoading: boolean;
  error: Error | null;
  refetch: (
    options?: RefetchOptions
  ) => Promise<QueryObserverResult<Instance[], Error>>;
}

const InstancesList = ({
  instances,
  isLoading,
  error,
  refetch,
}: InstancesListProps) => {
  useEffect(() => {
    // Set up auto-refresh every 30 seconds
    const interval = setInterval(() => refetch(), 30000);
    return () => clearInterval(interval);
  }, [refetch]);

  if (isLoading && instances.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <div className="flex flex-col items-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
          <p className="text-muted-foreground">Carregando instâncias...</p>
        </div>
      </div>
    );
  }

  if (error && instances.length === 0) {
    return (
      <div className="flex items-center justify-center p-6 min-h-[300px] bg-muted/30 rounded-lg border border-border">
        <div className="text-center max-w-md">
          <h3 className="text-lg font-medium mb-2">Falha ao carregar instâncias</h3>
          <p className="text-muted-foreground mb-4">{error.message}</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
          >
            Tentar Novamente
          </button>
        </div>
      </div>
    );
  }

  if (instances.length === 0) {
    return (
      <div className="flex items-center justify-center p-8 min-h-[300px] bg-muted/30 rounded-lg border border-border">
        <div className="text-center max-w-md">
          <h3 className="text-xl font-medium mb-2">Nenhuma instância encontrada</h3>
          <p className="text-muted-foreground">
            Você não tem nenhuma instância Evolution API. Crie sua primeira
            instância para começar.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6">
      {instances.map((instance) => (
        <InstanceCard
          key={instance.id}
          instance={instance}
          onAction={refetch}
        />
      ))}
      {isLoading && (
        <div className="fixed bottom-4 right-4 bg-background border border-border rounded-full px-4 py-2 shadow-md flex items-center gap-2 z-50">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <span className="text-sm">Atualizando...</span>
        </div>
      )}
    </div>
  );
};

export default InstancesList;
