/**
 * UserEditBreadcrumb Component
 * 
 * Displays breadcrumb navigation for the user edit page.
 * Shows path: Admin > Multi-Usuário > Editar [userName]
 * 
 * Requirements: 5.1
 */

import { Link } from 'react-router-dom'
import { ChevronRight, Home, Users, User } from 'lucide-react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

interface UserEditBreadcrumbProps {
  userName?: string
  userId?: string
}

export function UserEditBreadcrumb({ userName, userId }: UserEditBreadcrumbProps) {
  const displayName = userName || (userId ? `Usuário ${userId.substring(0, 8)}...` : 'Editar Usuário')

  return (
    <Breadcrumb>
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/admin" className="flex items-center gap-1 hover:text-primary">
              <Home className="h-4 w-4" />
              Admin
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbLink asChild>
            <Link to="/admin/multi-user" className="flex items-center gap-1 hover:text-primary">
              <Users className="h-4 w-4" />
              Multi-Usuário
            </Link>
          </BreadcrumbLink>
        </BreadcrumbItem>
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-1">
            <User className="h-4 w-4" />
            {displayName}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  )
}

export default UserEditBreadcrumb
