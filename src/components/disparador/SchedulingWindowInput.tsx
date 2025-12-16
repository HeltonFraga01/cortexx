import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Clock, CalendarDays } from 'lucide-react';

export interface SchedulingWindow {
    startTime: string;
    endTime: string;
    days: number[]; // 0-6 (Sunday-Saturday)
}

interface SchedulingWindowInputProps {
    value: SchedulingWindow | null;
    onChange: (window: SchedulingWindow | null) => void;
    enabled: boolean;
    onEnabledChange: (enabled: boolean) => void;
}

const DAYS = [
    { id: 0, label: 'Dom' },
    { id: 1, label: 'Seg' },
    { id: 2, label: 'Ter' },
    { id: 3, label: 'Qua' },
    { id: 4, label: 'Qui' },
    { id: 5, label: 'Sex' },
    { id: 6, label: 'Sáb' },
];

export function SchedulingWindowInput({
    value,
    onChange,
    enabled,
    onEnabledChange
}: SchedulingWindowInputProps) {
    // Default values logic moved to parent component
    // useEffect(() => { ... }, ...);

    const handleTimeChange = (field: 'startTime' | 'endTime', time: string) => {
        if (!value) return;
        onChange({ ...value, [field]: time });
    };

    const handleDayToggle = (dayId: number) => {
        if (!value) return;

        const newDays = value.days.includes(dayId)
            ? value.days.filter(d => d !== dayId)
            : [...value.days, dayId].sort();

        onChange({ ...value, days: newDays });
    };

    const toggleAllDays = () => {
        if (!value) return;

        if (value.days.length === 7) {
            onChange({ ...value, days: [] });
        } else {
            onChange({ ...value, days: [0, 1, 2, 3, 4, 5, 6] });
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center space-x-2">
                <Checkbox
                    id="enable-window"
                    checked={enabled}
                    onCheckedChange={(checked) => onEnabledChange(checked as boolean)}
                />
                <Label htmlFor="enable-window" className="flex items-center gap-2 cursor-pointer font-medium">
                    <Clock className="h-4 w-4" />
                    Definir Janela de Envio (Horário Comercial)
                </Label>
            </div>

            {enabled && value && (
                <Card className="border-dashed">
                    <CardContent className="pt-6 space-y-4 sm:space-y-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="start-time" className="text-sm">Horário de Início</Label>
                                <Input
                                    id="start-time"
                                    type="time"
                                    value={value.startTime}
                                    onChange={(e) => handleTimeChange('startTime', e.target.value)}
                                    className="text-base"
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="end-time" className="text-sm">Horário de Término</Label>
                                <Input
                                    id="end-time"
                                    type="time"
                                    value={value.endTime}
                                    onChange={(e) => handleTimeChange('endTime', e.target.value)}
                                    className="text-base"
                                />
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <Label className="flex items-center gap-2 text-sm">
                                    <CalendarDays className="h-4 w-4" />
                                    Dias da Semana
                                </Label>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 text-xs w-full sm:w-auto"
                                    onClick={toggleAllDays}
                                >
                                    {value.days.length === 7 ? 'Desmarcar Todos' : 'Marcar Todos'}
                                </Button>
                            </div>

                            <div className="grid grid-cols-7 gap-1.5 sm:gap-3 max-w-md">
                                {DAYS.map((day) => (
                                    <button
                                        key={day.id}
                                        type="button"
                                        className={`
                      flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-full border-2 cursor-pointer transition-all
                      ${value.days.includes(day.id)
                                                ? 'bg-primary text-primary-foreground border-primary scale-105'
                                                : 'bg-background hover:bg-muted text-muted-foreground border-border hover:border-primary/50'}
                    `}
                                        onClick={() => handleDayToggle(day.id)}
                                        title={day.label}
                                    >
                                        <span className="text-[10px] sm:text-xs font-medium">{day.label}</span>
                                    </button>
                                ))}
                            </div>
                            {value.days.length === 0 && (
                                <p className="text-xs text-destructive">Selecione pelo menos um dia</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
