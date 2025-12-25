import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClientProvider } from "@tanstack/react-query";
import { createBrowserRouter, RouterProvider, useLocation, Outlet } from "react-router-dom";
import { useEffect, Suspense, lazy } from "react";
import { ThemeProvider } from "./components/ThemeProvider";
import { AuthProvider } from "./contexts/AuthContext";
import { BrandingProvider } from "./contexts/BrandingContext";
import { ImpersonationProvider } from "./contexts/ImpersonationContext";
import { WuzAPIAuthProvider } from "./contexts/WuzAPIAuthContext";
import { WuzAPIInstancesProvider } from "./contexts/WuzAPIInstancesContext";
import { AgentAuthProvider } from "./contexts/AgentAuthContext";
import { SupabaseInboxProvider } from "./contexts/SupabaseInboxContext";
import { ImpersonationBanner } from "./components/shared/ImpersonationBanner";
import { AuthErrorBoundary } from "./components/shared/AuthErrorBoundary";

import { useBrandingConfig } from "./hooks/useBranding";
import { updateAppNameMetaTags, updateDynamicFavicon, updateOgImage } from "./utils/metaTags";
import ProtectedRoute from "./components/ProtectedRoute";
import AgentProtectedRoute from "./components/AgentProtectedRoute";
import { RouteLoadingSkeleton } from "./components/shared/RouteLoadingSkeleton";
import { queryClient } from "./lib/queryClient";

// Lazy load route components (Task 2.2)
const PublicHome = lazy(() => import("./pages/PublicHome"));
const UnifiedLoginPage = lazy(() => import("./pages/UnifiedLoginPage"));
const RegisterPage = lazy(() => import("./pages/RegisterPage"));
const ResetPasswordPage = lazy(() => import("./pages/ResetPasswordPage"));
const ForcePasswordChangePage = lazy(() => import("./pages/ForcePasswordChangePage"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const UserDashboard = lazy(() => import("./pages/UserDashboard"));
const AgentDashboard = lazy(() => import("./pages/AgentDashboard"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unauthorized = lazy(() => import("./pages/Unauthorized"));
const SuperadminLogin = lazy(() => import("./pages/superadmin/SuperadminLogin"));
const SuperadminRoutes = lazy(() => import("./pages/superadmin/SuperadminRoutes"));

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

// Root layout component with PageTitle and ImpersonationBanner
const RootLayout = () => {
  return (
    <>
      <ImpersonationBanner />
      <PageTitle />
      <Suspense fallback={<RouteLoadingSkeleton />}>
        <Outlet />
      </Suspense>
    </>
  );
};

// Router configuration with v7 future flags (Task 1.3)
const router = createBrowserRouter(
  [
    {
      element: <RootLayout />,
      children: [
        { path: "/", element: <PublicHome /> },
        { path: "/login", element: <UnifiedLoginPage /> },
        { path: "/register", element: <RegisterPage /> },
        { path: "/dashboard", element: <UnifiedLoginPage /> },
        { path: "/reset-password", element: <ResetPasswordPage /> },
        { path: "/force-password-change", element: <ForcePasswordChangePage /> },
        // Legacy routes - redirect to unified login
        { path: "/agent/login", element: <UnifiedLoginPage /> },
        { path: "/user-login", element: <UnifiedLoginPage /> },
        { path: "/unauthorized", element: <Unauthorized /> },
        { path: "/superadmin/login", element: <SuperadminLogin /> },
        {
          path: "/superadmin/*",
          element: (
            <ProtectedRoute requiredRole="superadmin">
              <SuperadminRoutes />
            </ProtectedRoute>
          ),
        },
        {
          path: "/admin/*",
          element: (
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          ),
        },
        {
          path: "/user/*",
          element: (
            <ProtectedRoute requiredRole="user">
              <SupabaseInboxProvider>
                <UserDashboard />
              </SupabaseInboxProvider>
            </ProtectedRoute>
          ),
        },
        {
          path: "/agent/*",
          element: (
            <AgentAuthProvider>
              <AgentProtectedRoute>
                <AgentDashboard />
              </AgentProtectedRoute>
            </AgentAuthProvider>
          ),
        },
        { path: "*", element: <NotFound /> },
      ],
    },
  ],
  {
    future: {
      v7_startTransition: true,
      v7_relativeSplatPath: true,
      v7_fetcherPersist: true,
      v7_normalizeFormMethod: true,
      v7_partialHydration: true,
      v7_skipActionErrorRevalidation: true,
    },
  }
);

const App = () => {
  return (
    <AuthErrorBoundary fallbackPath="/login">
      <ThemeProvider defaultTheme="system">
        <AuthProvider>
          <ImpersonationProvider>
            <BrandingProvider>
              <WuzAPIAuthProvider>
                <WuzAPIInstancesProvider>
                  <QueryClientProvider client={queryClient}>
                    <TooltipProvider>
                      <Toaster />
                      <RouterProvider router={router} />
                    </TooltipProvider>
                  </QueryClientProvider>
                </WuzAPIInstancesProvider>
              </WuzAPIAuthProvider>
            </BrandingProvider>
          </ImpersonationProvider>
        </AuthProvider>
      </ThemeProvider>
    </AuthErrorBoundary>
  );
};

export default App;