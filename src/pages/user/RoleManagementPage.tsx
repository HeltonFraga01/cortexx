/**
 * RoleManagementPage
 * 
 * Page for managing roles in user dashboard.
 * 
 * Requirements: 5.1, 5.2
 */

import { useState, useCallback } from 'react'
import { RoleListUser } from '@/components/user/RoleListUser'
import { CustomRoleDialogUser } from '@/components/user/CustomRoleDialogUser'
import type { CustomRole } from '@/types/multi-user'

export default function RoleManagementPage() {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<CustomRole | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleRefresh = useCallback(() => {
    setRefreshKey(prev => prev + 1)
  }, [])

  const handleCreate = () => {
    setSelectedRole(null)
    setDialogOpen(true)
  }

  const handleEdit = (role: CustomRole) => {
    setSelectedRole(role)
    setDialogOpen(true)
  }

  return (
    <div className="container mx-auto py-6 px-4 sm:px-6 lg:px-8">
      <RoleListUser
        key={refreshKey}
        onCreateRole={handleCreate}
        onEditRole={handleEdit}
      />

      <CustomRoleDialogUser
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        role={selectedRole}
        onSuccess={handleRefresh}
      />
    </div>
  )
}
