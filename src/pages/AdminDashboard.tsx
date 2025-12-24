import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import PlansManagementPage from '@/pages/admin/PlansManagementPage';
import { AdminAuditLogList } from '@/components/admin/AdminAuditLogList';
import { ReportGenerator } from '@/components/admin/ReportGenerator';
import AdminDatabases from '@/components/admin/AdminDatabases';
import DatabaseConnectionNew from '@/components/admin/DatabaseConnectionNew';
import DatabaseConnectionEdit from '@/components/admin/DatabaseConnectionEdit';
import ThemesListPage from '@/pages/admin/ThemesListPage';
import PageBuilderPage from '@/pages/admin/PageBuilderPage';
import TablePermissionsManager from '@/components/admin/TablePermissionsManager';
import AvailableTablesList from '@/components/admin/AvailableTablesList';
import MultiUserManagement from '@/pages/admin/MultiUserManagement';
import BotQuotaConfigPage from '@/pages/admin/BotQuotaConfigPage';
import StripeAdminPage from '@/pages/admin/StripeAdminPage';
import AdminSettings from '@/components/admin/AdminSettings';
import SupabaseUserEditPage from '@/pages/admin/SupabaseUserEditPage';
import EditUserPage from '@/components/admin/EditUserPage';

const AdminDashboard = () => {
  return (
    <AdminLayout>
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
    </AdminLayout>
  );
};

export default AdminDashboard;