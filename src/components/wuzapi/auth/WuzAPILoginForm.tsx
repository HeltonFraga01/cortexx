/**
 * WuzAPI Login Form Component
 * Baseado no dashboard original da WuzAPI com melhorias de UX
 */

import { useState } from "react";
import { useBrandingConfig } from '@/hooks/useBranding';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, Shield, User, Eye, EyeOff } from "lucide-react";
import { useWuzAPIAuth } from "@/contexts/WuzAPIAuthContext";

interface WuzAPILoginFormProps {
  onSuccess?: () => void;
  className?: string;
}

export const WuzAPILoginForm = ({ onSuccess, className }: WuzAPILoginFormProps) => {
  const { loginAsAdmin, loginAsUser, isLoading } = useWuzAPIAuth();
  const brandingConfig = useBrandingConfig();
  
  // Estados para formulário admin
  const [adminForm, setAdminForm] = useState({
    baseUrl: "https://wzapi.wasend.com.br/api",
    adminToken: "",
  });
  
  // Estados para formulário usuário
  const [userForm, setUserForm] = useState({
    userToken: "",
    phoneNumber: "",
  });
  
  // Estados de UI
  const [showAdminToken, setShowAdminToken] = useState(false);
  const [showUserToken, setShowUserToken] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // HANDLERS DE FORMULÁRIO
  // ============================================================================

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!adminForm.baseUrl || !adminForm.adminToken) {
      setError("Todos os campos são obrigatórios");
      return;
    }

    try {
      const success = await loginAsAdmin(adminForm.baseUrl, adminForm.adminToken);
      if (success) {
        onSuccess?.();
      }
    } catch (error) {
      setError("Erro inesperado durante o login");
      console.error("Erro no login admin:", error);
    }
  };

  const handleUserLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!userForm.userToken) {
      setError("Token de usuário é obrigatório");
      return;
    }

    try {
      const success = await loginAsUser(
        userForm.userToken,
        userForm.phoneNumber || undefined
      );
      if (success) {
        onSuccess?.();
      }
    } catch (error) {
      setError("Erro inesperado durante o login");
      console.error("Erro no login usuário:", error);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className={`w-full max-w-md mx-auto ${className}`}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{brandingConfig.appName} Manager</CardTitle>
          <CardDescription>
            Faça login para acessar o painel de controle
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="admin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Admin
              </TabsTrigger>
              <TabsTrigger value="user" className="flex items-center gap-2">
                <User className="w-4 h-4" />
                Usuário
              </TabsTrigger>
            </TabsList>

            {/* ============================================================================ */}
            {/* TAB ADMIN */}
            {/* ============================================================================ */}
            <TabsContent value="admin">
              <form onSubmit={handleAdminLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="baseUrl">URL da API</Label>
                  <Input
                    id="baseUrl"
                    type="url"
                    placeholder="https://wzapi.wasend.com.br/api"
                    value={adminForm.baseUrl}
                    onChange={(e) =>
                      setAdminForm(prev => ({ ...prev, baseUrl: e.target.value }))
                    }
                    disabled={isLoading}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminToken">Token Admin</Label>
                  <div className="relative">
                    <Input
                      id="adminToken"
                      type={showAdminToken ? "text" : "password"}
                      value={adminForm.adminToken}
                      onChange={(e) =>
                        setAdminForm(prev => ({ ...prev, adminToken: e.target.value }))
                      }
                      disabled={isLoading}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowAdminToken(!showAdminToken)}
                      disabled={isLoading}
                    >
                      {showAdminToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <Shield className="mr-2 h-4 w-4" />
                      Login Admin
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>

            {/* ============================================================================ */}
            {/* TAB USUÁRIO */}
            {/* ============================================================================ */}
            <TabsContent value="user">
              <form onSubmit={handleUserLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="userToken">Token de Usuário</Label>
                  <div className="relative">
                    <Input
                      id="userToken"
                      type={showUserToken ? "text" : "password"}
                      value={userForm.userToken}
                      onChange={(e) =>
                        setUserForm(prev => ({ ...prev, userToken: e.target.value }))
                      }
                      disabled={isLoading}
                      required
                      className="pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowUserToken(!showUserToken)}
                      disabled={isLoading}
                    >
                      {showUserToken ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phoneNumber">Número de Telefone (Opcional)</Label>
                  <Input
                    id="phoneNumber"
                    type="tel"
                    placeholder="+55 11 99999-9999"
                    value={userForm.phoneNumber}
                    onChange={(e) =>
                      setUserForm(prev => ({ ...prev, phoneNumber: e.target.value }))
                    }
                    disabled={isLoading}
                  />
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Conectando...
                    </>
                  ) : (
                    <>
                      <User className="mr-2 h-4 w-4" />
                      Login Usuário
                    </>
                  )}
                </Button>
              </form>
            </TabsContent>
          </Tabs>

          {/* ============================================================================ */}
          {/* INFORMAÇÕES ADICIONAIS */}
          {/* ============================================================================ */}
          <div className="mt-6 text-center text-sm text-muted-foreground">
            <p>
              <strong>Admin:</strong> Acesso completo ao sistema
            </p>
            <p>
              <strong>Usuário:</strong> Acesso limitado às suas instâncias
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default WuzAPILoginForm;