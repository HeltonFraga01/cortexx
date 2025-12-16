/**
 * TeamDialog Component
 * 
 * Create/edit team form with member management.
 * 
 * Requirements: 5.1, 5.2, 5.5
 */

import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Users, Loader2, UserPlus, UserMinus, Search } from 'lucide-react'
import { toast } from 'sonner'

import type { 
  TeamWithStats, 
  TeamMember,
  Agent,
  CreateTeamDTO, 
  UpdateTeamDTO 
} from '@/types/multi-user'
import { createTeam, updateTeam, getTeam, addTeamMember, removeTeamMember } from '@/services/account-teams'
import { listAgents } from '@/services/account-agents'

const teamSchema = z.object({
  name: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100, 'Nome muito longo'),
  description: z.string().max(500, 'Descrição muito longa').optional(),
  allowAutoAssign: z.boolean().default(true),
})

type TeamFormData = z.infer<typeof teamSchema>

interface TeamDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  team?: TeamWithStats | null
  onSuccess?: () => void
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Proprietário',
  administrator: 'Administrador',
  agent: 'Agente',
  viewer: 'Visualizador',
}

const AVAILABILITY_COLORS: Record<string, string> = {
  online: 'bg-green-500',
  busy: 'bg-yellow-500',
  offline: 'bg-gray-400',
}

export function TeamDialog({ open, onOpenChange, team, onSuccess }: TeamDialogProps) {
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState('details')
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([])
  const [availableAgents, setAvailableAgents] = useState<Agent[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')
  const [selectedAgents, setSelectedAgents] = useState<Set<string>>(new Set())
  const [addingMembers, setAddingMembers] = useState(false)
  const [removingMember, setRemovingMember] = useState<string | null>(null)

  const isEditing = !!team

  const form = useForm<TeamFormData>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: '',
      description: '',
      allowAutoAssign: true,
    },
  })

  const loadTeamData = useCallback(async () => {
    if (!team?.id) return
    try {
      setLoadingMembers(true)
      const teamData = await getTeam(team.id)
      setTeamMembers(teamData.members || [])
    } catch (error) {
      console.error('Error loading team data:', error)
      toast.error('Erro ao carregar dados da equipe')
    } finally {
      setLoadingMembers(false)
    }
  }, [team?.id])

  const loadAvailableAgents = useCallback(async () => {
    try {
      const agents = await listAgents({ status: 'active' })
      setAvailableAgents(agents)
    } catch (error) {
      console.error('Error loading agents:', error)
    }
  }, [])

  useEffect(() => {
    if (open) {
      if (team) {
        form.reset({
          name: team.name,
          description: team.description || '',
          allowAutoAssign: team.allowAutoAssign,
        })
        loadTeamData()
      } else {
        form.reset({ name: '', description: '', allowAutoAssign: true })
        setTeamMembers([])
      }
      loadAvailableAgents()
      setActiveTab('details')
      setSelectedAgents(new Set())
      setMemberSearch('')
    }
  }, [open, team, form, loadTeamData, loadAvailableAgents])

  const handleSubmit = async (data: TeamFormData) => {
    try {
      setLoading(true)
      if (isEditing && team) {
        const updateData: UpdateTeamDTO = {
          name: data.name,
          description: data.description || undefined,
          allowAutoAssign: data.allowAutoAssign,
        }
        await updateTeam(team.id, updateData)
        toast.success('Equipe atualizada com sucesso!')
      } else {
        const createData: CreateTeamDTO = {
          name: data.name,
          description: data.description || undefined,
          allowAutoAssign: data.allowAutoAssign,
        }
        await createTeam(createData)
        toast.success('Equipe criada com sucesso!')
      }
      onSuccess?.()
      handleClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao salvar equipe')
    } finally {
      setLoading(false)
    }
  }

  const handleAddMembers = async () => {
    if (!team?.id || selectedAgents.size === 0) return
    try {
      setAddingMembers(true)
      const promises = Array.from(selectedAgents).map(agentId => 
        addTeamMember(team.id, agentId)
      )
      await Promise.all(promises)
      toast.success(`${selectedAgents.size} membro(s) adicionado(s)`)
      setSelectedAgents(new Set())
      loadTeamData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao adicionar membros')
    } finally {
      setAddingMembers(false)
    }
  }

  const handleRemoveMember = async (agentId: string) => {
    if (!team?.id) return
    try {
      setRemovingMember(agentId)
      await removeTeamMember(team.id, agentId)
      toast.success('Membro removido da equipe')
      loadTeamData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Erro ao remover membro')
    } finally {
      setRemovingMember(null)
    }
  }

  const handleClose = () => {
    form.reset()
    setTeamMembers([])
    setSelectedAgents(new Set())
    setMemberSearch('')
    onOpenChange(false)
  }

  const toggleAgentSelection = (agentId: string) => {
    const newSelected = new Set(selectedAgents)
    if (newSelected.has(agentId)) {
      newSelected.delete(agentId)
    } else {
      newSelected.add(agentId)
    }
    setSelectedAgents(newSelected)
  }

  const memberIds = new Set(teamMembers.map(m => m.id))
  const filteredAvailableAgents = availableAgents
    .filter(agent => !memberIds.has(agent.id))
    .filter(agent => 
      agent.name.toLowerCase().includes(memberSearch.toLowerCase()) ||
      agent.email.toLowerCase().includes(memberSearch.toLowerCase())
    )

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            {isEditing ? 'Editar Equipe' : 'Nova Equipe'}
          </DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize as informações da equipe e gerencie os membros.'
              : 'Crie uma nova equipe para organizar seus agentes.'}
          </DialogDescription>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="details">Detalhes</TabsTrigger>
            <TabsTrigger value="members" disabled={!isEditing}>
              Membros {isEditing && `(${teamMembers.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="details" className="flex-1 overflow-auto mt-4">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nome da Equipe</FormLabel>
                      <FormControl>
                        <Input placeholder="Ex: Suporte Técnico" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Descrição (opcional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Descreva o propósito desta equipe..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="allowAutoAssign"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Auto-Atribuição</FormLabel>
                        <FormDescription>
                          Permitir que conversas sejam automaticamente atribuídas a membros desta equipe.
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch checked={field.value} onCheckedChange={field.onChange} />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter className="pt-4">
                  <Button type="button" variant="outline" onClick={handleClose} disabled={loading}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={loading}>
                    {loading ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</>
                    ) : isEditing ? 'Salvar Alterações' : 'Criar Equipe'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="members" className="flex-1 overflow-hidden flex flex-col mt-4">
            {loadingMembers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4 flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-hidden flex flex-col">
                  <h4 className="text-sm font-medium mb-2">Membros Atuais ({teamMembers.length})</h4>
                  {teamMembers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum membro na equipe</p>
                    </div>
                  ) : (
                    <ScrollArea className="flex-1 border rounded-md">
                      <div className="p-2 space-y-1">
                        {teamMembers.map((member) => (
                          <div key={member.id} className="flex items-center justify-between p-2 rounded-md hover:bg-muted/50">
                            <div className="flex items-center gap-3">
                              <div className="relative">
                                <Avatar className="h-8 w-8">
                                  <AvatarImage src={member.avatarUrl} />
                                  <AvatarFallback className="text-xs">{getInitials(member.name)}</AvatarFallback>
                                </Avatar>
                                <span className={`absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-background ${AVAILABILITY_COLORS[member.availability]}`} />
                              </div>
                              <div>
                                <p className="text-sm font-medium">{member.name}</p>
                                <p className="text-xs text-muted-foreground">{member.email}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">{ROLE_LABELS[member.role]}</Badge>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => handleRemoveMember(member.id)}
                                disabled={removingMember === member.id}
                              >
                                {removingMember === member.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserMinus className="h-4 w-4" />}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <h4 className="text-sm font-medium flex items-center gap-2">
                    <UserPlus className="h-4 w-4" />
                    Adicionar Membros
                  </h4>
                  
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar agentes..."
                      value={memberSearch}
                      onChange={(e) => setMemberSearch(e.target.value)}
                      className="pl-8"
                    />
                  </div>

                  <ScrollArea className="h-[150px] border rounded-md">
                    <div className="p-2 space-y-1">
                      {filteredAvailableAgents.length === 0 ? (
                        <div className="text-center py-4 text-muted-foreground text-sm">
                          {memberSearch ? 'Nenhum agente encontrado' : 'Todos os agentes já são membros'}
                        </div>
                      ) : (
                        filteredAvailableAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 cursor-pointer"
                            onClick={() => toggleAgentSelection(agent.id)}
                          >
                            <Checkbox checked={selectedAgents.has(agent.id)} onCheckedChange={() => toggleAgentSelection(agent.id)} />
                            <Avatar className="h-8 w-8">
                              <AvatarImage src={agent.avatarUrl} />
                              <AvatarFallback className="text-xs">{getInitials(agent.name)}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              <p className="text-xs text-muted-foreground truncate">{agent.email}</p>
                            </div>
                            <Badge variant="outline" className="text-xs">{ROLE_LABELS[agent.role]}</Badge>
                          </div>
                        ))
                      )}
                    </div>
                  </ScrollArea>

                  {selectedAgents.size > 0 && (
                    <Button onClick={handleAddMembers} disabled={addingMembers} className="w-full">
                      {addingMembers ? (
                        <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Adicionando...</>
                      ) : (
                        <><UserPlus className="h-4 w-4 mr-2" />Adicionar {selectedAgents.size} Membro(s)</>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

export default TeamDialog
