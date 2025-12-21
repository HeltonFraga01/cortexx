import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';

/**
 * Legacy Login Page - Redirects to Unified Login
 * 
 * This page exists for backward compatibility.
 * All login functionality has been consolidated into UnifiedLoginPage at /login
 */
const LoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Preserve any query parameters when redirecting
    const params = searchParams.toString();
    const redirectUrl = params ? `/login?${params}` : '/login';
    navigate(redirectUrl, { replace: true });
  }, [navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
};

export default LoginPage;
