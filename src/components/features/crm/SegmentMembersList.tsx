/**
 * SegmentMembersList Component
 * 
 * Paginated list of segment members with bulk actions.
 * 
 * Requirements: 7.4, 7.5 (Contact CRM Evolution)
 */

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Users, MessageSquare, Download, MoreHorizontal, ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatCurrency } from '@/services/purchaseService'
import type { SegmentMember, LeadTier } from '@/types/crm'

interface SegmentMembersListProps {
  members: SegmentMember[]
  total: number
  page: number
  pageSize: number
  isLoading?: boolean
  onPageChange?: (page: number) => void
  onSendMessage?: (memberIds: string[]) => void
  onExport?: (memberIds: string[]) => void
  onMemberClick?: (memberId: string) => void
}

const tierConfig: Record<LeadTier, { label: string; color: string }> = {
  cold: { label: 'Frio', color: 'bg-gray-100 text-gray-700' },
  warm: { label: 'Morno', color: 'bg-yellow-100 text-yellow-700' },
  hot: { label: 'Quente', color: 'bg-orange-100 text-orange-700' },
  vip: { label: 'VIP', color: 'bg-purple-100 text-purple-700' }
}

export function SegmentMembersList({
  members,
  total,
  page,
  pageSize,
  isLoading,
  onPageChange,
  onSendMessage,
  onExport,
  onMemberClick
}: SegmentMembersListProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  const totalPages = Math.ceil(total / pageSize)
  const allSelected = members.length > 0 && selectedIds.size === members.length

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(members.map((m) => m.id)))
    } else {
      setSelectedIds(new Set())
    }
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    const newSet = new Set(selectedIds)
    if (checked) {
      newSet.add(id)
    } else {
      newSet.delete(id)
    }
    setSelectedIds(newSet)
  }

  const handleBulkAction = (action: 'message' | 'export') => {
    const ids = Array.from(selectedIds)
    if (ids.length === 0) return

    if (action === 'message') {
      onSendMessage?.(ids)
    } else {
      onExport?.(ids)
    }
  }

  if (isLoading && members.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Membros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Membros
            <Badge variant="secondary">{total}</Badge>
          </CardTitle>
          {selectedIds.size > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {selectedIds.size} selecionado{selectedIds.size !== 1 ? 's' : ''}
              </span>
              {onSendMessage && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('message')}>
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Mensagem
                </Button>
              )}
              {onExport && (
                <Button size="sm" variant="outline" onClick={() => handleBulkAction('export')}>
                  <Download className="h-4 w-4 mr-1" />
                  Exportar
                </Button>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Nenhum membro neste segmento
          </p>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allSelected}
                      onCheckedChange={handleSelectAll}
                    />
                  </TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Lead Score</TableHead>
                  <TableHead>LTV</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {members.map((member) => (
                  <TableRow
                    key={member.id}
                    className={cn(
                      'cursor-pointer',
                      selectedIds.has(member.id) && 'bg-muted/50'
                    )}
                    onClick={() => onMemberClick?.(member.id)}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={selectedIds.has(member.id)}
                        onCheckedChange={(checked) => handleSelectOne(member.id, !!checked)}
                      />
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{member.name || 'Sem nome'}</p>
                        <p className="text-xs text-muted-foreground">{member.phone}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{member.leadScore}</span>
                        <Badge className={cn('text-xs', tierConfig[member.leadTier].color)}>
                          {tierConfig[member.leadTier].label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(member.lifetimeValueCents)}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => onMemberClick?.(member.id)}>
                            Ver detalhes
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => onSendMessage?.([member.id])}>
                            Enviar mensagem
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <p className="text-xs text-muted-foreground">
                  Página {page} de {totalPages}
                </p>
                <div className="flex gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(page - 1)}
                    disabled={page <= 1 || isLoading}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onPageChange?.(page + 1)}
                    disabled={page >= totalPages || isLoading}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}

export default SegmentMembersList
