import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, X, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';

interface ImpersonationBannerProps {
  tenantName: string;
  tenantSubdomain: string;
  onEndImpersonation?: () => void;
}

/**
 * Impersonation Banner Component
 * Requirements: 4.4 - Display "Impersonating: {tenant}" banner with exit button
 */
const ImpersonationBanner = ({ 
  tenantName, 
  tenantSubdomain, 
  onEndImpersonation 
}: ImpersonationBannerProps) => {
  const [isEnding, setIsEnding] = useState(false);

  const handleEndImpersonation = async () => {
    try {
      setIsEnding(true);
      
      const response = await fetch('/api/superadmin/end-impersonation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Impersonation ended successfully');
        
        // Call the callback if provided
        if (onEndImpersonation) {
          onEndImpersonation();
        } else {
          // Default behavior: redirect to superadmin dashboard
          window.location.href = '/superadmin/dashboard';
        }
      } else {
        throw new Error(data.error || 'Failed to end impersonation');
      }
    } catch (error) {
      console.error('Error ending impersonation:', error);
      toast.error('Failed to end impersonation');
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950/20 mb-4">
      <Shield className="h-4 w-4 text-orange-600" />
      <AlertDescription className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="font-medium text-orange-800 dark:text-orange-200">
            Impersonating: {tenantName}
          </span>
          <div className="flex items-center space-x-1 text-sm text-orange-600 dark:text-orange-400">
            <ExternalLink className="h-3 w-3" />
            <span>{tenantSubdomain}.cortexx.online</span>
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleEndImpersonation}
          disabled={isEnding}
          className="border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300 dark:hover:bg-orange-900/20"
        >
          {isEnding ? (
            'Ending...'
          ) : (
            <>
              <X className="h-4 w-4 mr-1" />
              Exit Impersonation
            </>
          )}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default ImpersonationBanner;