import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Suspense, lazy } from 'react';
import UserLayout from '@/components/user/UserLayout';
import { DraftProvider } from '@/contexts/DraftContext';
import { AgentProvider } from '@/contexts/AgentContext';
import { RouteLoadingSkeleton } from '@/components/shared/RouteLoadingSkeleton';

// Lazy load all user pages for better code splitting
const UserOverview = lazy(() => import('@/components/user/UserOverview'));
const UserMessages = lazy(() => import('@/components/user/UserMessages'));
const UserSettings = lazy(() => import('@/components/user/UserSettings'));
const DirectEditPage = lazy(() => import('@/components/user/DirectEditPage'));
const UserDatabaseModern = lazy(() => import('@/components/user/UserDatabaseModern'));
const AddRecordPage = lazy(() => import('@/components/user/AddRecordPage').then(m => ({ default: m.AddRecordPage })));
const UserTablesList = lazy(() => import('@/components/user/UserTablesList').then(m => ({ default: m.UserTablesList })));
const GenericTablePage = lazy(() => import('@/components/user/GenericTablePage').then(m => ({ default: m.GenericTablePage })));
const UserContacts = lazy(() => import('@/pages/UserContacts'));
const ChatInboxPage = lazy(() => import('@/pages/ChatInboxPage'));
// Messaging System Modular Pages
const MessagingPage = lazy(() => import('@/pages/MessagingPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const OutboxPage = lazy(() => import('@/pages/OutboxPage'));
const ReportsPage = lazy(() => import('@/pages/ReportsPage'));
// Account Management Pages
const AccountSettingsPage = lazy(() => import('@/pages/user/AccountSettingsPage'));
const AgentManagementPage = lazy(() => import('@/pages/user/AgentManagementPage'));
const TeamManagementPage = lazy(() => import('@/pages/user/TeamManagementPage'));
const InboxManagementPage = lazy(() => import('@/pages/user/InboxManagementPage'));
const RoleManagementPage = lazy(() => import('@/pages/user/RoleManagementPage'));
const AuditLogPage = lazy(() => import('@/pages/user/AuditLogPage'));
const ResellerDashboardPage = lazy(() => import('@/pages/user/ResellerDashboardPage'));
const UserInboxEditPage = lazy(() => import('@/components/user/UserInboxEditPage'));
// CRM Pages
const CRMDashboardPage = lazy(() => import('@/components/features/crm/CRMDashboardPage').then(m => ({ default: m.CRMDashboardPage })));
const ContactDetailPage = lazy(() => import('@/components/features/crm/ContactDetailPage').then(m => ({ default: m.ContactDetailPage })));
const SegmentsPage = lazy(() => import('@/components/features/crm/SegmentsPage').then(m => ({ default: m.SegmentsPage })));
const CustomFieldsManagementPage = lazy(() => import('@/components/features/crm/CustomFieldsManagementPage').then(m => ({ default: m.CustomFieldsManagementPage })));

// Simple loading component for inner routes
const InnerLoading = () => (
  <div className="flex items-center justify-center min-h-[400px]">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

const UserDashboard = () => {
  return (
    <UserLayout>
      <AgentProvider>
      <DraftProvider>
        <Suspense fallback={<InnerLoading />}>
          <Routes>
            <Route path="/" element={<UserOverview />} />
            <Route path="/dashboard" element={<UserOverview />} />
            <Route path="/messages" element={<UserMessages />} />
            
            {/* Legacy disparador - redirect to new messaging system */}
            <Route path="/disparador" element={<Navigate to="/user/mensagens" replace />} />
            
            {/* New Messaging System Routes */}
            <Route path="/mensagens" element={<MessagingPage />} />
            <Route path="/mensagens/templates" element={<TemplatesPage />} />
            <Route path="/mensagens/caixa" element={<OutboxPage />} />
            <Route path="/mensagens/relatorios" element={<ReportsPage />} />
            
            {/* Chat Inbox */}
            <Route path="/chat" element={<ChatInboxPage />} />
            
            <Route path="/contacts" element={<UserContacts />} />
            
            {/* CRM Routes */}
            <Route path="/crm" element={<CRMDashboardPage />} />
            <Route path="/contacts/:contactId" element={<ContactDetailPage />} />
            <Route path="/segments" element={<SegmentsPage />} />
            <Route path="/custom-fields" element={<CustomFieldsManagementPage />} />
            
            {/* Database routes */}
            <Route path="/database" element={<UserDatabaseModern />} />
            <Route path="/database/:connectionId/add" element={<AddRecordPage />} />
            <Route path="/database/:connectionId/edit/:recordId" element={<DirectEditPage />} />
            
            {/* Table access routes */}
            <Route path="/tables" element={<UserTablesList />} />
            <Route path="/tables/:tableName" element={<GenericTablePage />} />
            
            {/* Redirect old "Meu Banco" route */}
            <Route path="/meu-banco" element={<Navigate to="/user/database" replace />} />
            
            <Route path="/settings" element={<UserSettings />} />
            
            {/* Account Management Routes */}
            <Route path="/account" element={<AccountSettingsPage />} />
            <Route path="/agents" element={<AgentManagementPage />} />
            <Route path="/teams" element={<TeamManagementPage />} />
            <Route path="/inboxes" element={<InboxManagementPage />} />
            <Route path="/inboxes/edit/:inboxId" element={<UserInboxEditPage />} />
            <Route path="/roles" element={<RoleManagementPage />} />
            <Route path="/audit" element={<AuditLogPage />} />
            <Route path="/reseller" element={<ResellerDashboardPage />} />
          </Routes>
        </Suspense>
      </DraftProvider>
      </AgentProvider>
    </UserLayout>
  );
};

export default UserDashboard;