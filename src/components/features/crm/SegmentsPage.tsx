/**
 * SegmentsPage Component
 * 
 * Main page for managing contact segments with list, create, and templates.
 * 
 * Requirements: 7.1, 7.4, 7.6 (Contact CRM Evolution)
 */

import { useState, useCallback } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
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
import { toast } from 'sonner'
import {
  Users,
  Plus,
  MoreHorizontal,
  RefreshCw,
  Trash2,
  Edit2,
  Eye,
  X,
  Check,
  Sparkles
} from 'lucide-react'
import { useConfirmDialog } from '@/hooks/useConfirmDialog'

import { SegmentBuilder } from './SegmentBuilder'
import { SegmentMembersList } from './SegmentMembersList'

import * as segmentService from '@/services/segmentService'
import type { Segment, SegmentGroup, CreateSegmentFormData } from '@/types/crm'

const PAGE_SIZE = 20

export function SegmentsPage() {
  const queryClient = useQueryClient()
  const { confirm, ConfirmDialog } = useConfirmDialog()

  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingSegment, setEditingSegment] = useState<Segment | null>(null)
  const [viewingSegment, setViewingSegment] = useState<Segment | null>(null)
  const [membersPage, setMembersPage] = useState(1)

  const [formData, setFormData] = useState<CreateSegmentFormData>({
    name: '',
    description: '',
    conditions: segmentService.createEmptyGroup()
  })

  // Fetch segments
  const { data: segments, isLoading: segmentsLoading } = useQuery({
    queryKey: ['segments'],
    queryFn: () => segmentService.getSegments()
  })

  // Fetch templates
  const { data: templates } = useQuery({
    queryKey: ['segment-templates'],
    queryFn: () => segmentService.getTemplates()
  })

  // Fetch segment members when viewing
  const { data: membersData, isLoading: membersLoading } = useQuery({
    queryKey: ['segment-members', viewingSegment?.id, membersPage],
    queryFn: () => segmentService.getSegmentMembers(viewingSegment!.id, {
      page: membersPage,
      pageSize: PAGE_SIZE
    }),
    enabled: !!viewingSegment
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateSegmentFormData) => segmentService.createSegment(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
      toast.success('Segmento criado')
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateSegmentFormData> }) =>
      segmentService.updateSegment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
      toast.success('Segmento atualizado')
      setEditingSegment(null)
      resetForm()
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => segmentService.deleteSegment(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
      toast.success('Segmento excluído')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const evaluateMutation = useMutation({
    mutationFn: (id: string) => segmentService.evaluateSegment(id),
    onSuccess: (data, id) => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
      queryClient.invalidateQueries({ queryKey: ['segment-members', id] })
      toast.success(`Segmento reavaliado: ${data.memberCount} membros`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  const createFromTemplateMutation = useMutation({
    mutationFn: (templateKey: string) => segmentService.createFromTemplate(templateKey),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['segments'] })
      toast.success('Segmento criado a partir do template')
    },
    onError: (error: Error) => {
      toast.error(error.message)
    }
  })

  // Handlers
  const resetForm = () => {
    setShowCreateForm(false)
    setFormData({
      name: '',
      description: '',
      conditions: segmentService.createEmptyGroup()
    })
  }

  const handleCreate = () => {
    const validation = segmentService.validateConditions(formData.conditions)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }
    if (!formData.name.trim()) {
      toast.error('Nome é obrigatório')
      return
    }
    createMutation.mutate(formData)
  }

  const handleUpdate = () => {
    if (!editingSegment) return
    const validation = segmentService.validateConditions(formData.conditions)
    if (!validation.valid) {
      toast.error(validation.error)
      return
    }
    updateMutation.mutate({ id: editingSegment.id, data: formData })
  }

  const handleDelete = async (segment: Segment) => {
    const confirmed = await confirm({
      title: 'Excluir Segmento',
      description: `Tem certeza que deseja excluir o segmento "${segment.name}"? Esta ação não pode ser desfeita.`,
      confirmText: 'Excluir',
      variant: 'destructive'
    })
    if (confirmed) {
      deleteMutation.mutate(segment.id)
    }
  }

  const handleEdit = (segment: Segment) => {
    setEditingSegment(segment)
    setFormData({
      name: segment.name,
      description: segment.description || '',
      conditions: segment.conditions
    })
    setShowCreateForm(true)
  }

  const handlePreview = useCallback(async () => {
    return segmentService.previewSegment(formData.conditions)
  }, [formData.conditions])

  const handleCancel = () => {
    setEditingSegment(null)
    resetForm()
  }

  // Loading state
  if (segmentsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    )
  }

  // Viewing segment members
  if (viewingSegment) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Button variant="ghost" onClick={() => setViewingSegment(null)} className="mb-2">
              ← Voltar
            </Button>
            <h1 className="text-xl font-semibold">{viewingSegment.name}</h1>
            {viewingSegment.description && (
              <p className="text-sm text-muted-foreground">{viewingSegment.description}</p>
            )}
          </div>
          <Button
            variant="outline"
            onClick={() => evaluateMutation.mutate(viewingSegment.id)}
            disabled={evaluateMutation.isPending}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${evaluateMutation.isPending ? 'animate-spin' : ''}`} />
            Reavaliar
          </Button>
        </div>

        <SegmentMembersList
          members={membersData?.data || []}
          total={membersData?.total || 0}
          page={membersPage}
          pageSize={PAGE_SIZE}
          isLoading={membersLoading}
          onPageChange={setMembersPage}
        />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Segmentos</h1>
          <p className="text-sm text-muted-foreground">
            Agrupe contatos dinamicamente com base em critérios
          </p>
        </div>
        {!showCreateForm && (
          <Button onClick={() => setShowCreateForm(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Segmento
          </Button>
        )}
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <Card className="border-2 border-primary">
          <CardHeader>
            <CardTitle className="text-base">
              {editingSegment ? 'Editar Segmento' : 'Novo Segmento'}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Condições</Label>
              <SegmentBuilder
                segment={formData.conditions}
                onChange={(conditions) => setFormData({ ...formData, conditions })}
                onPreview={handlePreview}
              />
            </div>

            <div className="flex gap-2 justify-end pt-4">
              <Button variant="outline" onClick={handleCancel}>
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
              <Button
                onClick={editingSegment ? handleUpdate : handleCreate}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                <Check className="h-4 w-4 mr-1" />
                {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : 'Salvar'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Templates */}
      {templates && templates.length > 0 && !showCreateForm && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Templates Pré-definidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {templates.map((template) => (
                <Button
                  key={template.key}
                  variant="outline"
                  size="sm"
                  onClick={() => createFromTemplateMutation.mutate(template.key)}
                  disabled={createFromTemplateMutation.isPending}
                >
                  {template.name}
                </Button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Segments List */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Users className="h-4 w-4" />
            Seus Segmentos
            <Badge variant="secondary">{segments?.length || 0}</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!segments || segments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Nenhum segmento criado ainda
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Membros</TableHead>
                  <TableHead>Última Avaliação</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segments.map((segment) => (
                  <TableRow
                    key={segment.id}
                    className="cursor-pointer"
                    onClick={() => setViewingSegment(segment)}
                  >
                    <TableCell>
                      <div>
                        <p className="font-medium">{segment.name}</p>
                        {segment.description && (
                          <p className="text-xs text-muted-foreground line-clamp-1">
                            {segment.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{segment.memberCount}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {segment.lastEvaluatedAt
                        ? new Date(segment.lastEvaluatedAt).toLocaleDateString('pt-BR')
                        : 'Nunca'}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewingSegment(segment)}>
                            <Eye className="h-4 w-4 mr-2" />
                            Ver membros
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEdit(segment)}>
                            <Edit2 className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => evaluateMutation.mutate(segment.id)}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Reavaliar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(segment)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default SegmentsPage
