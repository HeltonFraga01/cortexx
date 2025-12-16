/**
 * AuditLogPage
 * 
 * Page for viewing audit logs in user dashboard.
 * 
 * Requirements: 9.1
 */

import { AuditLogUser } from '@/components/user/AuditLogUser'

export default function AuditLogPage() {
  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <AuditLogUser />
    </div>
  )
}
