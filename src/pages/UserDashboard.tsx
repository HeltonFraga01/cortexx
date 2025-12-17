import { Routes, Route, Navigate } from 'react-router-dom';
import UserLayout from '@/components/user/UserLayout';
import UserOverview from '@/components/user/UserOverview';
import UserMessages from '@/components/user/UserMessages';
import UserSettings from '@/components/user/UserSettings';
import DirectEditPage from '@/components/user/DirectEditPage';
import UserDatabaseModern from '@/components/user/UserDatabaseModern';
import { AddRecordPage } from '@/components/user/AddRecordPage';
import { UserTablesList } from '@/components/user/UserTablesList';
import { GenericTablePage } from '@/components/user/GenericTablePage';
import UserContacts from '@/pages/UserContacts';
import ChatInboxPage from '@/pages/ChatInboxPage';
// Messaging System Modular Pages
import MessagingPage from '@/pages/MessagingPage';
import TemplatesPage from '@/pages/TemplatesPage';
import OutboxPage from '@/pages/OutboxPage';
import ReportsPage from '@/pages/ReportsPage';
import { DraftProvider } from '@/contexts/DraftContext';
import { AgentProvider } from '@/contexts/AgentContext';
// Account Management Pages
import AccountSettingsPage from '@/pages/user/AccountSettingsPage';
import AgentManagementPage from '@/pages/user/AgentManagementPage';
import TeamManagementPage from '@/pages/user/TeamManagementPage';
import InboxManagementPage from '@/pages/user/InboxManagementPage';
import RoleManagementPage from '@/pages/user/RoleManagementPage';
import AuditLogPage from '@/pages/user/AuditLogPage';
import ResellerDashboardPage from '@/pages/user/ResellerDashboardPage';

const UserDashboard = () => {
  return (
    <UserLayout>
      <AgentProvider>
      <DraftProvider>
        <Routes>
          <Route path="/" element={<UserOverview />} />
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
          <Route path="/roles" element={<RoleManagementPage />} />
          <Route path="/audit" element={<AuditLogPage />} />
          <Route path="/reseller" element={<ResellerDashboardPage />} />
        </Routes>
      </DraftProvider>
      </AgentProvider>
    </UserLayout>
  );
};

export default UserDashboard;