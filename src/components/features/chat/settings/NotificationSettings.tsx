/**
 * NotificationSettings Component
 * 
 * Allows users to configure audio notification preferences
 */

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Bell, Volume2, VolumeX, Play } from 'lucide-react'
import { useAudioNotification, type NotificationTone, type AudioNotificationConfig } from '@/hooks/useAudioNotification'

const TONE_OPTIONS: { value: NotificationTone; label: string }[] = [
  { value: 'ding', label: 'Ding' },
  { value: 'pop', label: 'Pop' },
  { value: 'chime', label: 'Chime' },
  { value: 'bell', label: 'Sino' }
]

export function NotificationSettings() {
  const { config, updateConfig, playNotification, hasPermission } = useAudioNotification()
  const [isPlaying, setIsPlaying] = useState(false)

  const handleTestSound = async () => {
    setIsPlaying(true)
    await playNotification()
    setTimeout(() => setIsPlaying(false), 500)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Notificações Sonoras
        </CardTitle>
        <CardDescription>
          Configure como você deseja ser notificado sobre novas mensagens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Enable/Disable */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">Ativar notificações sonoras</Label>
            <p className="text-sm text-muted-foreground">
              Tocar um som quando chegar uma nova mensagem
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={config.enabled}
            onCheckedChange={(enabled) => updateConfig({ enabled })}
          />
        </div>

        {/* Play only when hidden */}
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="play-when-hidden">Tocar apenas quando a aba estiver oculta</Label>
            <p className="text-sm text-muted-foreground">
              Só toca o som se você não estiver vendo a página
            </p>
          </div>
          <Switch
            id="play-when-hidden"
            checked={config.playOnlyWhenHidden}
            onCheckedChange={(playOnlyWhenHidden) => updateConfig({ playOnlyWhenHidden })}
            disabled={!config.enabled}
          />
        </div>

        {/* Tone selection */}
        <div className="space-y-2">
          <Label htmlFor="notification-tone">Som de notificação</Label>
          <div className="flex gap-2">
            <Select
              value={config.tone}
              onValueChange={(tone: NotificationTone) => updateConfig({ tone })}
              disabled={!config.enabled}
            >
              <SelectTrigger id="notification-tone" className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TONE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={handleTestSound}
              disabled={!config.enabled || isPlaying}
              title="Testar som"
            >
              <Play className={`h-4 w-4 ${isPlaying ? 'animate-pulse' : ''}`} />
            </Button>
          </div>
        </div>

        {/* Volume */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Volume</Label>
            <span className="text-sm text-muted-foreground">
              {Math.round(config.volume * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-3">
            <VolumeX className="h-4 w-4 text-muted-foreground" />
            <Slider
              value={[config.volume]}
              onValueChange={([volume]) => updateConfig({ volume })}
              min={0}
              max={1}
              step={0.1}
              disabled={!config.enabled}
              className="flex-1"
            />
            <Volume2 className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>

        {/* Permission warning */}
        {!hasPermission && (
          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              As notificações sonoras estão bloqueadas pelo navegador. 
              Clique em qualquer lugar da página para habilitá-las.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default NotificationSettings
