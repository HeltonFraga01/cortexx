import { useImpersonation } from '@/contexts/ImpersonationContext';
import { Button } from '@/components/ui/button';
import { AlertTriangle, X, Building2, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

/**
 * ImpersonationBanner - Displays when superadmin is impersonating a tenant
 * Requirements: Task 7.3 - Visual indicator for active impersonation
 * 
 * This component renders:
 * 1. A fixed banner at the top of the page
 * 2. A spacer div to push content down so it's not hidden behind the banner
 */
export function ImpersonationBanner() {
  const { impersonation, endImpersonation, isLoading } = useImpersonation();
  const navigate = useNavigate();

  if (!impersonation.isImpersonating) {
    return null;
  }

  const handleEndImpersonation = async () => {
    const success = await endImpersonation();
    if (success) {
      toast.success('Impersonação encerrada');
      navigate('/superadmin/dashboard');
    } else {
      toast.error('Falha ao encerrar impersonação');
    }
  };

  return (
    <>
      {/* Spacer to push content down */}
      <div className="h-12" />
      
      {/* Fixed banner */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-amber-950 px-4 py-2 shadow-md h-12">
        <div className="container mx-auto flex items-center justify-between h-full">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="font-medium truncate">
                Gerenciando: {impersonation.tenantName}
              </span>
              <span className="text-amber-800 truncate">
                ({impersonation.tenantSubdomain})
              </span>
            </div>
            {impersonation.durationMinutes > 0 && (
              <div className="flex items-center gap-1 text-amber-800 text-sm flex-shrink-0">
                <Clock className="h-3 w-3" />
                <span>{impersonation.durationMinutes} min</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/superadmin/dashboard')}
              className="bg-amber-100 border-amber-600 text-amber-900 hover:bg-amber-200"
            >
              Voltar ao Superadmin
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleEndImpersonation}
              disabled={isLoading}
              className="bg-amber-900 hover:bg-amber-950"
            >
              <X className="h-4 w-4 mr-1" />
              Encerrar
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
