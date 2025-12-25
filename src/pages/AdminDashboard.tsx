import { Routes, Route, Navigate } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import AdminLayout from '@/components/admin/AdminLayout';

// Lazy load all admin pages for better code splitting
const AdminOverview = lazy(() => import('@/components/admin/AdminOverview'));
const PlansManagementPage = lazy(() => import('@/pages/admin/PlansManagementPage'));
const AdminAuditLogList = lazy(() => import('@/components/admin/AdminAuditLogList').then(m => ({ default: m.AdminAuditLogList })));
const ReportGenerator = lazy(() => import('@/components/admin/ReportGenerator').then(m => ({ default: m.ReportGenerator })));
const AdminDatabases = lazy(() => import('@/components/admin/AdminDatabases'));
const DatabaseConnectionNew = lazy(() => import('@/components/admin/DatabaseConnectionNew'));
const DatabaseConnectionEdit = lazy(() => import('@/components/admin/DatabaseConnectionEdit'));
const ThemesListPage = lazy(() => import('@/pages/admin/ThemesListPage'));
const PageBuilderPage = lazy(() => import('@/pages/admin/PageBuilderPage'));
const TablePermissionsManager = lazy(() => import('@/components/admin/TablePermissionsManager'));
const AvailableTablesList = lazy(() => import('@/components/admin/AvailableTablesList'));
const MultiUserManagement = lazy(() => import('@/pages/admin/MultiUserManagement'));
const BotQuotaConfigPage = lazy(() => import('@/pages/admin/BotQuotaConfigPage'));
const StripeAdminPage = lazy(() => import('@/pages/admin/StripeAdminPage'));
const AdminSettings = lazy(() => import('@/components/admin/AdminSettings'));
const SupabaseUserEditPage = lazy(() => import('@/pages/admin/SupabaseUserEditPage'));
const EditUserPage = lazy(() => import('@/components/admin/EditUserPage'));

// Simple loading component for inner routes
const InnerLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const AdminDashboard = () => {
  return (
    <AdminLayout>
      <Suspense fallback={<InnerLoading />}>
        <Routes>
          <Route path="/" element={<AdminOverview />} />
          
          {/* Rotas de Caixas de Entrada (Inboxes) - Páginas funcionais */}
          <Route path="/inboxes" element={<Navigate to="/admin/multi-user" replace />} />
          <Route path="/inboxes/new" element={<Navigate to="/admin/multi-user" replace />} />
          <Route path="/inboxes/edit/:userId" element={<EditUserPage />} />
          <Route path="/inboxes/:userId" element={<EditUserPage />} />
          
          {/* Rotas antigas de "users" - Redirects para multi-user ou páginas funcionais */}
          <Route path="/users" element={<Navigate to="/admin/multi-user" replace />} />
          <Route path="/users/new" element={<Navigate to="/admin/multi-user" replace />} />
          <Route path="/users/edit/:userId" element={<EditUserPage />} />
          <Route path="/users/:userId" element={<EditUserPage />} />
          
          <Route path="/supabase-users/edit/:userId" element={<SupabaseUserEditPage />} />
          <Route path="/plans" element={<PlansManagementPage />} />
          <Route path="/audit" element={<AdminAuditLogList />} />
          <Route path="/reports" element={<ReportGenerator />} />
          <Route path="/databases" element={<AdminDatabases />} />
          <Route path="/databases/new" element={<DatabaseConnectionNew />} />
          <Route path="/databases/edit/:id" element={<DatabaseConnectionEdit />} />
          <Route path="/page-builder" element={<ThemesListPage />} />
          <Route path="/page-builder/new" element={<PageBuilderPage />} />
          <Route path="/page-builder/:themeId" element={<PageBuilderPage />} />
          <Route path="/table-permissions" element={<TablePermissionsManager />} />
          <Route path="/tables" element={<AvailableTablesList />} />
          <Route path="/multi-user" element={<MultiUserManagement />} />
          <Route path="/bot-quotas" element={<BotQuotaConfigPage />} />
          <Route path="/stripe" element={<StripeAdminPage />} />
          <Route path="/stripe" element={<StripeAdminPage />} />
          <Route path="/settings" element={<AdminSettings />} />
        </Routes>
      </Suspense>
    </AdminLayout>
  );
};

export default AdminDashboard;