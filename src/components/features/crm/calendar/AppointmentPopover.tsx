/**
 * Appointment Popover Component
 * 
 * Displays appointment details with quick actions.
 * 
 * Requirements: 8.1, 8.2, 8.3 (CRM Contact Calendar)
 */

import { useState } from 'react'
import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import {
  Calendar,
  Clock,
  DollarSign,
  X,
  Check,
  Ban,
  Edit,
  Trash2,
  AlertCircle,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import type { Appointment, AppointmentStatus } from '@/types/appointment'
import {
  formatPrice,
  formatDuration,
  getStatusInfo,
  getPaymentStatusInfo,
  isAppointmentOverdue
} from '@/services/appointmentService'

interface AppointmentPopoverProps {
  appointment: Appointment
  onClose: () => void
  onConfirm: (id: string) => Promise<void>
  onComplete: (id: string) => Promise<void>
  onCancel: (id: string, reason?: string) => Promise<void>
  onNoShow: (id: string) => Promise<void>
  onEdit: (appointment: Appointment) => void
  onDelete: (id: string) => Promise<void>
  showContactLink?: boolean
  onViewContact?: (appointment: Appointment) => void
}

export function AppointmentPopover({
  appointment,
  onClose,
  onConfirm,
  onComplete,
  onCancel,
  onNoShow,
  onEdit,
  onDelete,
  showContactLink = false,
  onViewContact
}: AppointmentPopoverProps) {
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const statusInfo = getStatusInfo(appointment.status)
  const isOverdue = isAppointmentOverdue(appointment)
  const startTime = new Date(appointment.start_time)
  const endTime = new Date(appointment.end_time)
  const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000)

  const financialRecord = appointment.financial_record?.[0]
  const paymentInfo = financialRecord ? getPaymentStatusInfo(financialRecord.payment_status) : null

  const handleAction = async (action: () => Promise<void>) => {
    setIsLoading(true)
    try {
      await action()
    } finally {
      setIsLoading(false)
    }
  }

  const handleConfirmCancel = async () => {
    await handleAction(() => onCancel(appointment.id, cancelReason || undefined))
    setShowCancelDialog(false)
  }

  const handleConfirmDelete = async () => {
    await handleAction(() => onDelete(appointment.id))
    setShowDeleteDialog(false)
  }

  const canConfirm = appointment.status === 'scheduled'
  const canComplete = ['scheduled', 'confirmed'].includes(appointment.status)
  const canCancel = ['scheduled', 'confirmed'].includes(appointment.status)
  const canNoShow = ['scheduled', 'confirmed'].includes(appointment.status)
  const canEdit = ['scheduled', 'confirmed'].includes(appointment.status)
  const canDelete = appointment.status !== 'completed'

  return (
    <>
      <Card className="w-80 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                {appointment.title}
                {isOverdue && (
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                )}
              </CardTitle>
              {appointment.service && (
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: appointment.service.color }}
                  />
                  <span className="text-sm text-muted-foreground">
                    {appointment.service.name}
                  </span>
                </div>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Contact Link */}
          {showContactLink && appointment.contact && (
            <div className="flex items-center gap-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <button
                onClick={() => onViewContact?.(appointment)}
                className="text-primary hover:underline font-medium"
              >
                {appointment.contact.name || appointment.contact.phone}
              </button>
            </div>
          )}

          {/* Status */}
          <div className="flex items-center gap-2">
            <Badge className={`${statusInfo.bgColor} ${statusInfo.color}`}>
              {statusInfo.label}
            </Badge>
            {isOverdue && (
              <Badge variant="outline" className="text-orange-600 border-orange-300">
                Atrasado
              </Badge>
            )}
          </div>

          {/* Date & Time */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                {format(startTime, "EEEE, d 'de' MMMM", { locale: ptBR })}
              </span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4" />
              <span>
                {format(startTime, 'HH:mm')} - {format(endTime, 'HH:mm')}
                <span className="ml-1">({formatDuration(durationMinutes)})</span>
              </span>
            </div>
          </div>

          {/* Price & Payment */}
          {appointment.price_cents > 0 && (
            <div className="flex items-center justify-between p-2 bg-muted/50 rounded-md">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {formatPrice(appointment.price_cents)}
                </span>
              </div>
              {paymentInfo && (
                <Badge className={`${paymentInfo.bgColor} ${paymentInfo.color}`}>
                  {paymentInfo.label}
                </Badge>
              )}
            </div>
          )}

          {/* Notes */}
          {appointment.notes && (
            <div className="text-sm">
              <p className="text-muted-foreground text-xs mb-1">Observações:</p>
              <p className="text-sm">{appointment.notes}</p>
            </div>
          )}

          {/* Cancellation Reason */}
          {appointment.status === 'cancelled' && appointment.cancellation_reason && (
            <div className="text-sm p-2 bg-red-50 rounded-md">
              <p className="text-red-600 text-xs mb-1">Motivo do cancelamento:</p>
              <p className="text-sm text-red-700">{appointment.cancellation_reason}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            {canConfirm && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(() => onConfirm(appointment.id))}
                disabled={isLoading}
              >
                <Check className="h-3 w-3 mr-1" />
                Confirmar
              </Button>
            )}
            {canComplete && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(() => onComplete(appointment.id))}
                disabled={isLoading}
              >
                <Check className="h-3 w-3 mr-1" />
                Concluir
              </Button>
            )}
            {canNoShow && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleAction(() => onNoShow(appointment.id))}
                disabled={isLoading}
              >
                <AlertCircle className="h-3 w-3 mr-1" />
                Não compareceu
              </Button>
            )}
            {canCancel && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowCancelDialog(true)}
                disabled={isLoading}
              >
                <Ban className="h-3 w-3 mr-1" />
                Cancelar
              </Button>
            )}
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onEdit(appointment)}
                disabled={isLoading}
              >
                <Edit className="h-3 w-3 mr-1" />
                Editar
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
                onClick={() => setShowDeleteDialog(true)}
                disabled={isLoading}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Excluir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja cancelar este agendamento?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="mt-2"
              rows={3}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel}>
              Cancelar Agendamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Agendamento</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O agendamento será permanentemente removido.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default AppointmentPopover
