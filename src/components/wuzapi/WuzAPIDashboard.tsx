/**
 * WuzAPI Dashboard Component
 * Layout principal do dashboard baseado na interface original da WuzAPI
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Settings,
  Users,
  MessageSquare,
  Shield,
  LogOut,
  User,
  ChevronDown,
  Smartphone,
  Database,
  Webhook,
  Cloud,
  Lock,
  History,
  QrCode,
  UserPlus,
} from "lucide-react";
import { useWuzAPIAuth } from "@/contexts/WuzAPIAuthContext";
import { useBrandingConfig } from "@/hooks/useBranding";
import { WuzAPILoginForm } from "./auth/WuzAPILoginForm";

interface WuzAPIDashboardProps {
  className?: string;
}

export const WuzAPIDashboard = ({ className }: WuzAPIDashboardProps) => {
  const { user, isAuthenticated, logout } = useWuzAPIAuth();
  const brandingConfig = useBrandingConfig();
  const [activeTab, setActiveTab] = useState("instances");

  // ============================================================================
  // RENDER LOGIN SE NÃO AUTENTICADO
  // ============================================================================

  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <WuzAPILoginForm />
      </div>
    );
  }

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleLogout = () => {
    logout();
  };

  // ============================================================================
  // RENDER DASHBOARD
  // ============================================================================

  return (
    <div className={`min-h-screen bg-background ${className}`}>
      {/* ============================================================================ */}
      {/* HEADER */}
      {/* ============================================================================ */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {brandingConfig.logoUrl ? (
                <img 
                  src={brandingConfig.logoUrl} 
                  alt={`${brandingConfig.appName} Logo`}
                  className="h-8 w-auto object-contain"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <h1 className="text-2xl font-bold text-primary">{brandingConfig.appName} Manager</h1>
              )}
              <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                {user.role === "admin" ? "Administrador" : "Usuário"}
              </Badge>
            </div>

            <div className="flex items-center space-x-4">
              {user.phoneNumber && (
                <div className="text-sm text-muted-foreground">
                  <Smartphone className="inline w-4 h-4 mr-1" />
                  {user.phoneNumber}
                </div>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="flex items-center space-x-2">
                    <User className="w-4 h-4" />
                    <span>{user.role === "admin" ? "Admin" : "Usuário"}</span>
                    <ChevronDown className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Minha Conta</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Settings className="mr-2 h-4 w-4" />
                    Configurações
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout}>
                    <LogOut className="mr-2 h-4 w-4" />
                    Sair
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* ============================================================================ */}
      {/* MAIN CONTENT */}
      {/* ============================================================================ */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6">
            <TabsTrigger value="instances" className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              <span className="hidden sm:inline">Instâncias</span>
            </TabsTrigger>
            <TabsTrigger value="config" className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="hidden sm:inline">Chat</span>
            </TabsTrigger>
            <TabsTrigger value="groups" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="hidden sm:inline">Grupos</span>
            </TabsTrigger>
            <TabsTrigger value="advanced" className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span className="hidden sm:inline">Avançado</span>
            </TabsTrigger>
            {user.role === "admin" && (
              <TabsTrigger value="admin" className="flex items-center gap-2">
                <UserPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Admin</span>
              </TabsTrigger>
            )}
          </TabsList>

          {/* ============================================================================ */}
          {/* TAB INSTÂNCIAS */}
          {/* ============================================================================ */}
          <TabsContent value="instances" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="w-5 h-5" />
                  Gerenciamento de Instâncias
                </CardTitle>
                <CardDescription>
                  Crie, configure e monitore suas instâncias WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Smartphone className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Componente de instâncias será implementado aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================================ */}
          {/* TAB CONFIGURAÇÕES */}
          {/* ============================================================================ */}
          <TabsContent value="config" className="space-y-6">
            <div className="grid gap-6 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Database className="w-5 h-5" />
                    S3 Storage
                  </CardTitle>
                  <CardDescription>
                    Configure armazenamento de mídia na nuvem
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Configuração S3 em desenvolvimento</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Webhook className="w-5 h-5" />
                    Webhooks
                  </CardTitle>
                  <CardDescription>
                    Configure endpoints para receber eventos
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <Webhook className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Configuração de webhooks em desenvolvimento</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Lock className="w-5 h-5" />
                    HMAC Security
                  </CardTitle>
                  <CardDescription>
                    Configure autenticação HMAC para webhooks
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <Lock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Configuração HMAC em desenvolvimento</p>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <History className="w-5 h-5" />
                    Message History
                  </CardTitle>
                  <CardDescription>
                    Configure retenção de histórico de mensagens
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-4 text-muted-foreground">
                    <History className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p>Configuração de histórico em desenvolvimento</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* ============================================================================ */}
          {/* TAB CHAT */}
          {/* ============================================================================ */}
          <TabsContent value="chat" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5" />
                  Funcionalidades de Chat
                </CardTitle>
                <CardDescription>
                  Envie mensagens, gerencie contatos e visualize conversas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Funcionalidades de chat serão implementadas aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================================ */}
          {/* TAB GRUPOS */}
          {/* ============================================================================ */}
          <TabsContent value="groups" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Gerenciamento de Grupos
                </CardTitle>
                <CardDescription>
                  Crie, configure e gerencie grupos WhatsApp
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Gerenciamento de grupos será implementado aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================================ */}
          {/* TAB AVANÇADO */}
          {/* ============================================================================ */}
          <TabsContent value="advanced" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <QrCode className="w-5 h-5" />
                  Recursos Avançados
                </CardTitle>
                <CardDescription>
                  Pair Code, QR Code e configurações avançadas
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Recursos avançados serão implementados aqui</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ============================================================================ */}
          {/* TAB ADMIN (apenas para administradores) */}
          {/* ============================================================================ */}
          {user.role === "admin" && (
            <TabsContent value="admin" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserPlus className="w-5 h-5" />
                    Administração
                  </CardTitle>
                  <CardDescription>
                    Gerencie usuários e configurações do sistema
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-8 text-muted-foreground">
                    <UserPlus className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Funcionalidades administrativas serão implementadas aqui</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}
        </Tabs>
      </main>
    </div>
  );
};

export default WuzAPIDashboard;