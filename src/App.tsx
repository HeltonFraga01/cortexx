import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { WuzAPIAuthProvider } from "./contexts/WuzAPIAuthContext";
import { WuzAPIInstancesProvider } from "./contexts/WuzAPIInstancesContext";
import { AgentAuthProvider } from "./contexts/AgentAuthContext";

import { useBrandingConfig } from "./hooks/useBranding";
import { updateAppNameMetaTags, updateDynamicFavicon, updateOgImage } from "./utils/metaTags";
import ProtectedRoute from "./components/ProtectedRoute";
import AgentProtectedRoute from "./components/AgentProtectedRoute";
import PublicHome from "./pages/PublicHome";
import UnifiedLoginPage from "./pages/UnifiedLoginPage";
import RegisterPage from "./pages/RegisterPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ForcePasswordChangePage from "./pages/ForcePasswordChangePage";
import AdminDashboard from "./pages/AdminDashboard";
import UserDashboard from "./pages/UserDashboard";
import AgentDashboard from "./pages/AgentDashboard";
import NotFound from "./pages/NotFound";
import SuperadminLogin from "./pages/superadmin/SuperadminLogin";
import SuperadminRoutes from "./pages/superadmin/SuperadminRoutes";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

// Page title component with branding support
const PageTitle = () => {
  const location = useLocation();
  const brandingConfig = useBrandingConfig();

  // Atualizar meta tags quando branding carrega
  useEffect(() => {
    const appName = brandingConfig.appName || "WUZAPI";
    
    // Atualizar meta tags Open Graph e Twitter Card
    updateAppNameMetaTags(appName);
  }, [brandingConfig.appName]);

  // Atualizar favicon dinâmico com cor primária
  useEffect(() => {
    updateDynamicFavicon(brandingConfig.primaryColor);
  }, [brandingConfig.primaryColor]);

  // Atualizar imagem OG para compartilhamento em redes sociais
  useEffect(() => {
    // Prioridade: ogImageUrl > logoUrl
    const imageUrl = brandingConfig.ogImageUrl || brandingConfig.logoUrl;
    updateOgImage(imageUrl);
  }, [brandingConfig.ogImageUrl, brandingConfig.logoUrl]);

  // Atualizar título da página baseado na rota
  useEffect(() => {
    const appName = brandingConfig.appName || "WUZAPI";
    let title = appName;

    if (location.pathname === "/") {
      title = `Login | ${appName}`;
    } else if (location.pathname.startsWith("/admin")) {
      if (location.pathname.includes("/users/edit/")) {
        title = `Editar Usuário | ${appName}`;
      } else {
        title = `Admin Dashboard | ${appName}`;
      }
    } else if (location.pathname.startsWith("/user")) {
      title = `User Dashboard | ${appName}`;
    } else if (location.pathname === "*") {
      title = `Page Not Found | ${appName}`;
    }

    document.title = title;
  }, [location, brandingConfig.appName]);

  return null;
};

const App = () => {
  return (
    <ThemeProvider defaultTheme="system">
      <AuthProvider>
        <BrandingProvider>
          <WuzAPIAuthProvider>
            <WuzAPIInstancesProvider>
              <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                  <Toaster />
                  <BrowserRouter>
                    <PageTitle />
                    <Routes>
                      <Route path="/" element={<PublicHome />} />
                      <Route path="/login" element={<UnifiedLoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/dashboard" element={<UnifiedLoginPage />} />
                      <Route path="/reset-password" element={<ResetPasswordPage />} />
                      <Route path="/force-password-change" element={<ForcePasswordChangePage />} />
                      {/* Legacy routes - redirect to unified login */}
                      <Route path="/agent/login" element={<UnifiedLoginPage />} />
                      <Route path="/user-login" element={<UnifiedLoginPage />} />
                      <Route path="/superadmin/login" element={<SuperadminLogin />} />
                      <Route
                        path="/superadmin/*"
                        element={
                          <ProtectedRoute requiredRole="superadmin">
                            <SuperadminRoutes />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/admin/*"
                        element={
                          <ProtectedRoute requiredRole="admin">
                            <AdminDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/user/*"
                        element={
                          <ProtectedRoute requiredRole="user">
                            <UserDashboard />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/agent/*"
                        element={
                          <AgentAuthProvider>
                            <AgentProtectedRoute>
                              <AgentDashboard />
                            </AgentProtectedRoute>
                          </AgentAuthProvider>
                        }
                      />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </TooltipProvider>
              </QueryClientProvider>
            </WuzAPIInstancesProvider>
          </WuzAPIAuthProvider>
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;