import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Home, AlertTriangle } from "lucide-react";
import { Link } from "react-router-dom";
import { useBrandingConfig } from "@/hooks/useBranding";
import { EmptyState } from "@/components/ui-custom";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const brandingConfig = useBrandingConfig();

  useEffect(() => {
    console.error(
      "404 Error: User attempted to access non-existent route:",
      location.pathname
    );

    // Verificar se estamos em uma rota de erro conhecida
    const errorRoutes = ["404", "error", "not-found", "notfound"];
    const currentPathSegment =
      location.pathname.split("/").pop()?.toLowerCase() || "";

    if (errorRoutes.includes(currentPathSegment)) {
      console.log(
        "Detectado padrão de rota de erro, redirecionando para home..."
      );
      // Redirecionar para a home após um pequeno atraso (para mostrar a página brevemente)
      const timer = setTimeout(() => {
        navigate("/");
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="text-center bg-card p-8 rounded-lg border border-border shadow-lg max-w-md w-full">
        {brandingConfig.logoUrl ? (
          <img
            src={brandingConfig.logoUrl}
            alt={`${brandingConfig.appName} Logo`}
            className="h-16 w-auto mx-auto mb-6"
            onError={(e) => {
              e.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex justify-center mb-6">
            <div className="p-4 rounded-full bg-destructive/10">
              <AlertTriangle className="h-12 w-12 text-destructive" />
            </div>
          </div>
        )}
        <h1 className="text-5xl font-bold mb-4 text-foreground">404</h1>
        <p className="text-xl text-muted-foreground mb-6">Página não encontrada</p>
        <Link to="/">
          <Button className="mx-auto">
            <Home className="h-4 w-4 mr-2" />
            Voltar ao Início
          </Button>
        </Link>
      </div>
    </div>
  );
};

export default NotFound;
