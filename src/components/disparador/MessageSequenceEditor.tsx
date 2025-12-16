import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
    Plus,
    Trash2,
    MoveUp,
    MoveDown,
    FileText,
    ImageIcon,
    Video,
    MessageSquare
} from 'lucide-react';
import { MessageVariationEditor } from '@/components/user/MessageVariationEditor';

export interface CampaignMessage {
    id: string;
    type: 'text' | 'media';
    content: string;
    mediaUrl?: string;
    mediaType?: 'image' | 'video' | 'document';
    fileName?: string;
}

interface MessageSequenceEditorProps {
    messages: CampaignMessage[];
    onChange: (messages: CampaignMessage[]) => void;
    userToken?: string;
}

export function MessageSequenceEditor({ messages, onChange, userToken }: MessageSequenceEditorProps) {
    const addMessage = () => {
        const newMessage: CampaignMessage = {
            id: crypto.randomUUID(),
            type: 'text',
            content: ''
        };
        onChange([...messages, newMessage]);
    };

    const removeMessage = (id: string) => {
        onChange(messages.filter(m => m.id !== id));
    };

    const updateMessage = (id: string, updates: Partial<CampaignMessage>) => {
        onChange(messages.map(m => m.id === id ? { ...m, ...updates } : m));
    };

    const moveMessage = (index: number, direction: 'up' | 'down') => {
        if (
            (direction === 'up' && index === 0) ||
            (direction === 'down' && index === messages.length - 1)
        ) return;

        const newMessages = [...messages];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newMessages[index], newMessages[targetIndex]] = [newMessages[targetIndex], newMessages[index]];
        onChange(newMessages);
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Sequência de Mensagens</Label>
                <Button onClick={addMessage} size="sm" variant="outline">
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Mensagem
                </Button>
            </div>

            <div className="space-y-4">
                {messages.map((message, index) => (
                    <Card key={message.id} className="relative border-l-4 border-l-primary">
                        <CardContent className="pt-6 space-y-4">
                            {/* Header with controls */}
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="bg-primary/10 text-primary rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold">
                                        {index + 1}
                                    </div>
                                    <span className="font-medium text-sm text-muted-foreground">
                                        Mensagem {index + 1}
                                    </span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={index === 0}
                                        onClick={() => moveMessage(index, 'up')}
                                    >
                                        <MoveUp className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8"
                                        disabled={index === messages.length - 1}
                                        onClick={() => moveMessage(index, 'down')}
                                    >
                                        <MoveDown className="h-4 w-4" />
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={() => removeMessage(message.id)}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>

                            {/* Message Type Selector */}
                            <div className="space-y-2">
                                <Label>Tipo de Mensagem</Label>
                                <Select
                                    value={message.type}
                                    onValueChange={(value: 'text' | 'media') => updateMessage(message.id, { type: value })}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="text">
                                            <div className="flex items-center">
                                                <MessageSquare className="h-4 w-4 mr-2" />
                                                Texto
                                            </div>
                                        </SelectItem>
                                        <SelectItem value="media">
                                            <div className="flex items-center">
                                                <ImageIcon className="h-4 w-4 mr-2" />
                                                Mídia (Imagem/Vídeo/Documento)
                                            </div>
                                        </SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Media Configuration */}
                            {message.type === 'media' && (
                                <div className="space-y-4 p-4 border rounded-lg bg-muted/50">
                                    <div className="space-y-2">
                                        <Label>Tipo de Mídia</Label>
                                        <Select
                                            value={message.mediaType || 'image'}
                                            onValueChange={(value: any) => updateMessage(message.id, { mediaType: value })}
                                        >
                                            <SelectTrigger>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="image">
                                                    <div className="flex items-center">
                                                        <ImageIcon className="h-4 w-4 mr-2" />
                                                        Imagem
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="video">
                                                    <div className="flex items-center">
                                                        <Video className="h-4 w-4 mr-2" />
                                                        Vídeo
                                                    </div>
                                                </SelectItem>
                                                <SelectItem value="document">
                                                    <div className="flex items-center">
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Documento
                                                    </div>
                                                </SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label>URL da Mídia</Label>
                                        <Input
                                            type="url"
                                            placeholder="https://exemplo.com/arquivo.jpg"
                                            value={message.mediaUrl || ''}
                                            onChange={(e) => updateMessage(message.id, { mediaUrl: e.target.value })}
                                        />
                                    </div>

                                    {message.mediaType === 'document' && (
                                        <div className="space-y-2">
                                            <Label>Nome do Arquivo</Label>
                                            <Input
                                                placeholder="documento.pdf"
                                                value={message.fileName || ''}
                                                onChange={(e) => updateMessage(message.id, { fileName: e.target.value })}
                                            />
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Message Content */}
                            <div className="space-y-2">
                                <MessageVariationEditor
                                    label={message.type === 'media' ? 'Legenda' : 'Conteúdo da Mensagem'}
                                    value={message.content}
                                    onChange={(value) => updateMessage(message.id, { content: value })}
                                    userToken={userToken}
                                    showCombinations={false}
                                />
                            </div>
                        </CardContent>
                    </Card>
                ))}

                {messages.length === 0 && (
                    <div className="text-center p-8 border-2 border-dashed rounded-lg text-muted-foreground">
                        <p>Nenhuma mensagem adicionada.</p>
                        <Button variant="link" onClick={addMessage}>
                            Clique para adicionar a primeira mensagem
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
}
