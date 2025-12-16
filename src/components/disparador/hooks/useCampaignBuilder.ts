import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { DateTime } from 'luxon';
import { bulkCampaignService, type Contact, type CampaignConfig } from '@/services/bulkCampaignService';
import { contactImportService } from '@/services/contactImportService';
import { type CampaignMessage } from '../MessageSequenceEditor';
import { type SchedulingWindow } from '../SchedulingWindowInput';

interface UseCampaignBuilderProps {
    instance: string;
    userToken: string;
    onCampaignCreated?: (campaignId: string) => void;
}

export const useCampaignBuilder = ({ instance, userToken, onCampaignCreated }: UseCampaignBuilderProps) => {
    // Form state
    const [name, setName] = useState('');

    // Message Sequence State
    const [messages, setMessages] = useState<CampaignMessage[]>([
        { id: '1', type: 'text', content: '' }
    ]);

    // Scheduling State
    const [delayMin, setDelayMin] = useState(10);
    const [delayMax, setDelayMax] = useState(20);
    const [randomizeOrder, setRandomizeOrder] = useState(true);
    const [isScheduled, setIsScheduled] = useState(false);
    const [scheduledDateTime, setScheduledDateTime] = useState<Date | null>(null);
    const [isSchedulingValid, setIsSchedulingValid] = useState(false);

    // Scheduling Window State
    const [enableWindow, setEnableWindow] = useState(false);
    const [sendingWindow, setSendingWindow] = useState<SchedulingWindow | null>(null);

    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);

    // Detected variables (from all messages)
    const [detectedVariables, setDetectedVariables] = useState<string[]>([]);

    // Load template handler
    const handleLoadTemplate = (config: Partial<CampaignConfig>) => {
        if (config.messages) setMessages(config.messages);
        if (config.delayMin) setDelayMin(config.delayMin);
        if (config.delayMax) setDelayMax(config.delayMax);
        if (typeof config.randomizeOrder !== 'undefined') setRandomizeOrder(config.randomizeOrder);

        if (config.sendingWindow) {
            setEnableWindow(true);
            setSendingWindow(config.sendingWindow);
        } else {
            setEnableWindow(false);
            setSendingWindow(null);
        }
    };

    // Current config for saving template
    const currentConfig: Partial<CampaignConfig> = {
        messages,
        delayMin,
        delayMax,
        randomizeOrder,
        sendingWindow: enableWindow && sendingWindow ? sendingWindow : undefined
    };

    // Update detected variables when messages change
    useEffect(() => {
        const allContent = messages.map(m => m.content).join(' ');
        setDetectedVariables(contactImportService.detectVariables(allContent));
    }, [messages]);

    // Handle contacts imported
    const handleContactsImported = (importedContacts: Contact[]) => {
        // Remover duplicados antes de adicionar
        const existingPhones = new Set(contacts.map(c => c.phone));
        const newContacts = importedContacts.filter(c => !existingPhones.has(c.phone));

        if (newContacts.length < importedContacts.length) {
            const duplicates = importedContacts.length - newContacts.length;
            toast.info(`${duplicates} contato(s) duplicado(s) removido(s)`);
        }

        setContacts(prev => [...prev, ...newContacts]);
    };

    // Remove contact
    const handleRemoveContact = (phone: string) => {
        setContacts(prev => prev.filter(c => c.phone !== phone));
    };

    // Clear all contacts
    const handleClearContacts = () => {
        setContacts([]);
    };

    // Insert variable into the last active message or the first one
    const insertVariable = (varName: string) => {
        const lastMsgIndex = messages.length - 1;
        const lastMsg = messages[lastMsgIndex];

        const newMessages = [...messages];
        newMessages[lastMsgIndex] = {
            ...lastMsg,
            content: lastMsg.content + `{{${varName}}}`
        };
        setMessages(newMessages);
    };

    // Validate and create campaign
    const handleCreateCampaign = async () => {
        // Validate campaign name
        if (!name || name.trim().length === 0) {
            toast.error('Nome da campanha é obrigatório');
            return;
        }

        // Validate scheduling if enabled
        if (isScheduled && !isSchedulingValid) {
            toast.error('Agendamento inválido', {
                description: 'Por favor, selecione uma data e hora válidas no futuro.',
            });
            return;
        }

        if (messages.length === 0) {
            toast.error('Adicione pelo menos uma mensagem');
            return;
        }

        // Validate messages content
        for (let i = 0; i < messages.length; i++) {
            if (!messages[i].content.trim() && messages[i].type === 'text') {
                toast.error(`A mensagem ${i + 1} está vazia`);
                return;
            }
            if (messages[i].type === 'media' && !messages[i].mediaUrl) {
                toast.error(`A mensagem ${i + 1} precisa de uma URL de mídia`);
                return;
            }
        }

        // Prepare legacy fields from the first message
        const firstMessage = messages[0];

        const config: CampaignConfig = {
            name,
            instance,
            // Legacy fields (required by DB constraints)
            messageType: firstMessage.type,
            messageContent: firstMessage.content,
            mediaUrl: firstMessage.mediaUrl,
            mediaType: firstMessage.mediaType,
            mediaFileName: firstMessage.fileName,

            // New fields
            messages: messages,
            sendingWindow: enableWindow && sendingWindow ? sendingWindow : undefined,

            delayMin,
            delayMax,
            randomizeOrder,
            isScheduled,
            scheduledAt: isScheduled && scheduledDateTime ? scheduledDateTime.toISOString() : undefined,
            contacts
        };

        // Debug: Log config before sending
        console.log('🚀 Criando campanha com config:', {
            name,
            instance: instance?.substring(0, 10) + '...',
            messageType: firstMessage.type,
            messageContentLength: firstMessage.content?.length,
            contactsCount: contacts.length,
            delayMin,
            delayMax,
            firstContact: contacts[0],
            allContacts: contacts.map(c => ({ phone: c.phone, hasName: !!c.name, hasVars: !!c.variables }))
        });

        // Validate contacts structure
        const invalidContacts = contacts.filter(c => !c.phone || typeof c.phone !== 'string');
        if (invalidContacts.length > 0) {
            toast.error('Alguns contatos estão com formato inválido', {
                description: `${invalidContacts.length} contato(s) sem número de telefone válido`
            });
            console.error('Contatos inválidos:', invalidContacts);
            return;
        }

        // Validate
        const validation = bulkCampaignService.validateCampaignConfig(config);
        if (!validation.valid) {
            console.error('❌ Validação falhou:', validation.errors);
            validation.errors.forEach(error => toast.error(error));
            return;
        }

        // Validate variables
        if (detectedVariables.length > 0) {
            const varValidation = contactImportService.validateContactVariables(contacts, detectedVariables);

            if (!varValidation.valid) {
                // Mostrar detalhes dos contatos com variáveis faltando
                const details = varValidation.missingVariables
                    .slice(0, 3)
                    .map(item => `${item.phone}: faltam ${item.missing.map(v => `{{${v}}}`).join(', ')}`)
                    .join('\n');

                const moreCount = varValidation.missingVariables.length - 3;
                const moreText = moreCount > 0 ? `\n... e mais ${moreCount} contato(s)` : '';

                toast.error(
                    `${varValidation.missingVariables.length} contato(s) sem variáveis necessárias`,
                    {
                        description: `Variáveis necessárias: ${detectedVariables.map(v => `{{${v}}}`).join(', ')}\n\n${details}${moreText}`,
                        duration: 10000
                    }
                );
                return;
            }
        }

        try {
            setLoading(true);

            const result = await bulkCampaignService.createCampaign(config);

            if (isScheduled && scheduledDateTime) {
                const luxonDateTime = DateTime.fromJSDate(scheduledDateTime).setZone('America/Sao_Paulo');
                toast.success(`Campanha "${name}" agendada com sucesso!`, {
                    description: `Será iniciada em ${luxonDateTime.toFormat("dd/MM/yyyy 'às' HH:mm")}`,
                });
            } else {
                toast.success(`Campanha "${name}" iniciada com sucesso!`);
            }

            // Reset form
            setName('');
            setMessages([{ id: crypto.randomUUID(), type: 'text', content: '' }]);
            setContacts([]);
            setScheduledDateTime(null);
            setIsSchedulingValid(false);
            setEnableWindow(false);
            setSendingWindow(null);

            onCampaignCreated?.(result.campaignId);
        } catch (error: any) {
            toast.error('Erro ao criar campanha: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const stats = contactImportService.getContactStats(contacts);

    return {
        name,
        setName,
        messages,
        setMessages,
        delayMin,
        setDelayMin,
        delayMax,
        setDelayMax,
        randomizeOrder,
        setRandomizeOrder,
        isScheduled,
        setIsScheduled,
        scheduledDateTime,
        setScheduledDateTime,
        isSchedulingValid,
        setIsSchedulingValid,
        enableWindow,
        setEnableWindow,
        sendingWindow,
        setSendingWindow,
        contacts,
        setContacts,
        loading,
        detectedVariables,
        currentConfig,
        handleLoadTemplate,
        handleContactsImported,
        handleRemoveContact,
        handleClearContacts,
        insertVariable,
        handleCreateCampaign,
        stats,
    };
};
