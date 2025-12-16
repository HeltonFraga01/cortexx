/**
 * PlansManagementPage
 * 
 * Complete page for managing subscription plans with list and form.
 */

import { useState } from 'react'
import { PlanList } from '@/components/admin/PlanList'
import { PlanForm } from '@/components/admin/PlanForm'
import type { Plan } from '@/types/admin-management'
import { Button } from '@/components/ui/button'
import { ArrowLeft } from 'lucide-react'

export function PlansManagementPage() {
  const [view, setView] = useState<'list' | 'create' | 'edit'>('list')
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const handleCreate = () => {
    setSelectedPlan(null)
    setView('create')
  }

  const handleEdit = (plan: Plan) => {
    setSelectedPlan(plan)
    setView('edit')
  }

  const handleSuccess = () => {
    setView('list')
    setSelectedPlan(null)
    setRefreshKey(prev => prev + 1)
  }

  const handleCancel = () => {
    setView('list')
    setSelectedPlan(null)
  }

  if (view === 'create' || view === 'edit') {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={handleCancel}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar para lista
        </Button>
        <PlanForm
          plan={selectedPlan}
          onSuccess={handleSuccess}
          onCancel={handleCancel}
        />
      </div>
    )
  }

  return (
    <PlanList
      key={refreshKey}
      onCreate={handleCreate}
      onEdit={handleEdit}
    />
  )
}

export default PlansManagementPage
