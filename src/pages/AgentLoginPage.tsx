import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

/**
 * Legacy Agent Login Page - Redirects to Unified Login
 * Requirement: 1.2 - Legacy route redirect
 * 
 * This page is kept for backward compatibility.
 * It redirects to the unified login page with the agent tab selected.
 */
const AgentLoginPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Preserve existing query parameters and add tab=agent
    const params = new URLSearchParams(searchParams);
    params.set('tab', 'agent');
    navigate(`/login?${params.toString()}`, { replace: true });
  }, [navigate, searchParams]);

  // Show nothing while redirecting
  return null;
};

export default AgentLoginPage;
