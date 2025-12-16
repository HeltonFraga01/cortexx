import { Routes, Route } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import AdminOverview from '@/components/admin/AdminOverview';
import AdminUsers from '@/components/admin/AdminUsers';
import EditUserPage from '@/components/admin/EditUserPage';
import CreateUserPage from '@/components/admin/CreateUserPage';
import AdminSettings from '@/components/admin/AdminSettings';
import AdminDatabases from '@/components/admin/AdminDatabases';
import DatabaseConnectionNew from '@/components/admin/DatabaseConnectionNew';
import DatabaseConnectionEdit from '@/components/admin/DatabaseConnectionEdit';
import TablePermissionsManager from '@/components/admin/TablePermissionsManager';
import AvailableTablesList from '@/components/admin/AvailableTablesList';
import ThemesListPage from '@/pages/admin/ThemesListPage';
import PageBuilderPage from '@/pages/admin/PageBuilderPage';
import MultiUserManagement from '@/pages/admin/MultiUserManagement';
// Admin User Management - Plan, Subscription, Audit, Reports
import PlansManagementPage from '@/pages/admin/PlansManagementPage';
import BotQuotaConfigPage from '@/pages/admin/BotQuotaConfigPage';
import { UserDetailPage } from '@/components/admin/UserDetailPage';
import { AdminAuditLogList } from '@/components/admin/AdminAuditLogList';
import { ReportGenerator } from '@/components/admin/ReportGenerator';

const AdminDashboard = () => {
  return (
    <AdminLayout>
      <Routes>
        <Route path="/" element={<AdminOverview />} />
        <Route path="/users" element={<AdminUsers />} />
        <Route path="/users/new" element={<CreateUserPage />} />
        <Route path="/users/edit/:userId" element={<EditUserPage />} />
        <Route path="/users/:userId" element={<UserDetailPage />} />
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
        <Route path="/settings" element={<AdminSettings />} />
      </Routes>
    </AdminLayout>
  );
};

export default AdminDashboard;