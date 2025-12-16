import { Routes, Route, Navigate } from 'react-router-dom'
import { useAgentAuth } from '@/contexts/AgentAuthContext'
import AgentLayout from '@/components/agent/AgentLayout'
import AgentOverview from '@/components/agent/AgentOverview'
import AgentInboxesPage from '@/components/agent/AgentInboxesPage'
import AgentContactsPage from '@/components/agent/AgentContactsPage'
import AgentChatPage from '@/components/agent/AgentChatPage'
import AgentMessagingPage from '@/components/agent/AgentMessagingPage'
import AgentTemplatesPage from '@/components/agent/AgentTemplatesPage'
import AgentOutboxPage from '@/components/agent/AgentOutboxPage'
import AgentReportsPage from '@/components/agent/AgentReportsPage'
import AgentProfilePage from '@/components/agent/AgentProfilePage'
import AgentSettingsPage from '@/components/agent/AgentSettingsPage'
import AgentDatabasePage from '@/components/agent/AgentDatabasePage'
import AgentDatabaseEditPage from '@/components/agent/AgentDatabaseEditPage'

export default function AgentDashboard() {
  const { agent, isLoading } = useAgentAuth()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!agent) {
    return <Navigate to="/agent/login" replace />
  }

  return (
    <AgentLayout>
      <Routes>
        <Route index element={<AgentOverview />} />
        <Route path="inboxes" element={<AgentInboxesPage />} />
        <Route path="contacts" element={<AgentContactsPage />} />
        <Route path="chat" element={<AgentChatPage />} />
        <Route path="messaging" element={<AgentMessagingPage />} />
        <Route path="messaging/templates" element={<AgentTemplatesPage />} />
        <Route path="messaging/outbox" element={<AgentOutboxPage />} />
        <Route path="messaging/reports" element={<AgentReportsPage />} />
        <Route path="profile" element={<AgentProfilePage />} />
        <Route path="settings" element={<AgentSettingsPage />} />
        {/* Database routes */}
        <Route path="database/:connectionId" element={<AgentDatabasePage />} />
        <Route path="database/:connectionId/edit/:recordId" element={<AgentDatabaseEditPage />} />
        <Route path="*" element={<Navigate to="/agent" replace />} />
      </Routes>
    </AgentLayout>
  )
}
