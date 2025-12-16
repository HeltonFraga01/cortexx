/**
 * useChatApi - Hook that provides the correct chat API based on context
 * 
 * Automatically detects if running in agent mode (AgentInboxContext available)
 * and returns the appropriate API functions.
 */

import { useContext, useMemo } from 'react'
import AgentInboxContext from '@/contexts/AgentInboxContext'

// User chat API
import {
  getConversations,
  getConversation,
  updateConversation,
  markConversationAsRead,
  searchConversations,
  startConversation,
  getMessages,
  sendTextMessage,
  sendImageMessage,
  sendDocumentMessage,
  sendAudioMessage,
  getLabels,
  assignLabelToConversation,
  removeLabelFromConversation,
  getCannedResponses,
  downloadMedia,
  getContactAttributes,
  createContactAttribute,
  updateContactAttribute,
  deleteContactAttribute,
  getContactNotes,
  createContactNote,
  deleteContactNote,
  getConversationInfo,
  fetchConversationAvatar,
  getMacros,
  executeMacro,
  getPreviousConversations,
  muteConversation,
  deleteConversation,
  addPrivateNote,
  getGroupParticipants,
  sendLocationMessage,
  getBots,
  assignBotToConversation
} from '@/services/chat'

// Agent chat API
import {
  getAgentConversations,
  getAgentConversation,
  updateAgentConversation,
  markAgentConversationAsRead,
  searchAgentConversations,
  startAgentConversation,
  getAgentMessages,
  sendAgentTextMessage,
  sendAgentImageMessage,
  sendAgentDocumentMessage,
  sendAgentAudioMessage,
  getAgentLabels,
  assignAgentLabelToConversation,
  removeAgentLabelFromConversation,
  getAgentCannedResponses,
  downloadAgentMedia,
  getAgentContactAttributes,
  createAgentContactAttribute,
  updateAgentContactAttribute,
  deleteAgentContactAttribute,
  getAgentContactNotes,
  createAgentContactNote,
  deleteAgentContactNote,
  getAgentConversationInfo,
  fetchAgentConversationAvatar,
  pickupAgentConversation,
  transferAgentConversation,
  releaseAgentConversation,
  getTransferableAgents,
  getAgentBots,
  assignAgentBotToConversation,
  getAgentMacros,
  executeAgentMacro,
  getAgentPreviousConversations,
  muteAgentConversation,
  deleteAgentConversation,
  addAgentPrivateNote,
  getAgentGroupParticipants,
  sendAgentLocationMessage
} from '@/services/agent-chat'

import type { TransferableAgent, PickupResponse, TransferResponse, ReleaseResponse } from '@/services/agent-chat'

import type {
  Conversation,
  ConversationsResponse,
  ChatMessage,
  MessagesResponse,
  Label,
  CannedResponse,
  ConversationFilters,
  ContactAttribute,
  ContactNote,
  ConversationInfo,
  SendTextMessageData,
  SendImageMessageData,
  SendDocumentMessageData,
  SendAudioMessageData,
  SendLocationMessageData,
  Macro,
  MacroExecutionResult,
  PreviousConversation,
  PrivateNote,
  GroupParticipant,
  AgentBot
} from '@/types/chat'

export interface ChatApi {
  // Conversations
  getConversations: (filters?: ConversationFilters, pagination?: { limit?: number; offset?: number }) => Promise<ConversationsResponse>
  getConversation: (id: number) => Promise<Conversation>
  updateConversation: (id: number, data: { status?: string; assignedBotId?: number | null; isMuted?: boolean }) => Promise<Conversation>
  markConversationAsRead: (id: number) => Promise<void>
  searchConversations: (query: string, limit?: number) => Promise<Conversation[]>
  startConversation: (phone: string, contactInfo?: { name?: string; avatarUrl?: string }) => Promise<Conversation>
  
  // Messages
  getMessages: (conversationId: number, options?: { limit?: number; before?: string; after?: string }) => Promise<MessagesResponse>
  sendTextMessage: (conversationId: number, data: SendTextMessageData) => Promise<ChatMessage>
  sendImageMessage: (conversationId: number, data: SendImageMessageData) => Promise<ChatMessage>
  sendDocumentMessage: (conversationId: number, data: SendDocumentMessageData) => Promise<ChatMessage>
  sendAudioMessage: (conversationId: number, data: SendAudioMessageData) => Promise<ChatMessage>
  sendLocationMessage: (conversationId: number, data: SendLocationMessageData) => Promise<ChatMessage>
  
  // Labels
  getLabels: () => Promise<Label[]>
  assignLabelToConversation: (conversationId: number, labelId: number) => Promise<void>
  removeLabelFromConversation: (conversationId: number, labelId: number) => Promise<void>
  
  // Canned Responses
  getCannedResponses: (search?: string) => Promise<CannedResponse[]>
  
  // Media
  downloadMedia: (messageId: number) => Promise<{ url?: string; base64?: string; thumbnail?: string; mimeType?: string; filename?: string; error?: string }>
  
  // Contact Info
  getContactAttributes: (contactJid: string) => Promise<ContactAttribute[]>
  createContactAttribute: (contactJid: string, data: { name: string; value: string }) => Promise<ContactAttribute>
  updateContactAttribute: (contactJid: string, attributeId: number, value: string) => Promise<ContactAttribute>
  deleteContactAttribute: (contactJid: string, attributeId: number) => Promise<void>
  getContactNotes: (contactJid: string) => Promise<ContactNote[]>
  createContactNote: (contactJid: string, content: string) => Promise<ContactNote>
  deleteContactNote: (contactJid: string, noteId: number) => Promise<void>
  getConversationInfo: (conversationId: number) => Promise<ConversationInfo>
  
  // Macros
  getMacros: () => Promise<Macro[]>
  executeMacro: (macroId: number, conversationId: number) => Promise<MacroExecutionResult>
  
  // Previous Conversations
  getPreviousConversations: (contactJid: string, excludeId?: number) => Promise<PreviousConversation[]>
  
  // Conversation Operations
  muteConversation: (conversationId: number, muted: boolean) => Promise<Conversation>
  deleteConversation: (conversationId: number) => Promise<void>
  
  // Private Notes
  addPrivateNote: (conversationId: number, content: string) => Promise<PrivateNote>
  
  // Group Participants
  getGroupParticipants: (conversationId: number) => Promise<GroupParticipant[]>
  
  // Bots
  getBots: () => Promise<AgentBot[]>
  assignBotToConversation: (conversationId: number, botId: number | null) => Promise<Conversation>
  
  // Avatar
  fetchConversationAvatar: (conversationId: number) => Promise<{ avatarUrl?: string | null; conversationId?: number } | null>
  
  // Assignment (agent mode only)
  pickupConversation?: (conversationId: number) => Promise<PickupResponse>
  transferConversation?: (conversationId: number, targetAgentId: string) => Promise<TransferResponse>
  releaseConversation?: (conversationId: number) => Promise<ReleaseResponse>
  getTransferableAgents?: (conversationId: number) => Promise<TransferableAgent[]>
  
  // Mode indicator
  isAgentMode: boolean
}

/**
 * Hook that returns the appropriate chat API based on context
 */
export function useChatApi(): ChatApi {
  const agentContext = useContext(AgentInboxContext)
  const isAgentMode = !!agentContext
  
  return useMemo(() => {
    if (isAgentMode) {
      return {
        // Conversations
        getConversations: getAgentConversations,
        getConversation: getAgentConversation,
        updateConversation: updateAgentConversation,
        markConversationAsRead: markAgentConversationAsRead,
        searchConversations: searchAgentConversations,
        startConversation: startAgentConversation,
        
        // Messages
        getMessages: getAgentMessages,
        sendTextMessage: sendAgentTextMessage,
        sendImageMessage: sendAgentImageMessage,
        sendDocumentMessage: sendAgentDocumentMessage,
        sendAudioMessage: sendAgentAudioMessage,
        sendLocationMessage: sendAgentLocationMessage,
        
        // Labels
        getLabels: getAgentLabels,
        assignLabelToConversation: assignAgentLabelToConversation,
        removeLabelFromConversation: removeAgentLabelFromConversation,
        
        // Canned Responses
        getCannedResponses: getAgentCannedResponses,
        
        // Media
        downloadMedia: downloadAgentMedia,
        
        // Contact Info
        getContactAttributes: getAgentContactAttributes,
        createContactAttribute: createAgentContactAttribute,
        updateContactAttribute: updateAgentContactAttribute,
        deleteContactAttribute: deleteAgentContactAttribute,
        getContactNotes: getAgentContactNotes,
        createContactNote: createAgentContactNote,
        deleteContactNote: deleteAgentContactNote,
        getConversationInfo: getAgentConversationInfo,
        
        // Macros
        getMacros: getAgentMacros,
        executeMacro: executeAgentMacro,
        
        // Previous Conversations
        getPreviousConversations: getAgentPreviousConversations,
        
        // Conversation Operations
        muteConversation: muteAgentConversation,
        deleteConversation: deleteAgentConversation,
        
        // Private Notes
        addPrivateNote: addAgentPrivateNote,
        
        // Group Participants
        getGroupParticipants: getAgentGroupParticipants,
        
        // Bots (agent mode - uses owner's bots)
        getBots: getAgentBots,
        assignBotToConversation: assignAgentBotToConversation,
        
        // Avatar
        fetchConversationAvatar: fetchAgentConversationAvatar,
        
        // Assignment (agent mode only)
        pickupConversation: pickupAgentConversation,
        transferConversation: transferAgentConversation,
        releaseConversation: releaseAgentConversation,
        getTransferableAgents: getTransferableAgents,
        
        // Bots (agent mode - uses owner's bots)
        getBots: getAgentBots,
        assignBotToConversation: assignAgentBotToConversation,
        
        isAgentMode: true
      }
    }
    
    // User mode - use session-based API
    return {
      // Conversations
      getConversations,
      getConversation,
      updateConversation,
      markConversationAsRead,
      searchConversations,
      startConversation,
      
      // Messages
      getMessages,
      sendTextMessage,
      sendImageMessage,
      sendDocumentMessage,
      sendAudioMessage,
      sendLocationMessage,
      
      // Labels
      getLabels,
      assignLabelToConversation,
      removeLabelFromConversation,
      
      // Canned Responses
      getCannedResponses,
      
      // Media
      downloadMedia,
      
      // Contact Info
      getContactAttributes,
      createContactAttribute,
      updateContactAttribute,
      deleteContactAttribute,
      getContactNotes,
      createContactNote,
      deleteContactNote,
      getConversationInfo,
      
      // Macros
      getMacros,
      executeMacro,
      
      // Previous Conversations
      getPreviousConversations,
      
      // Conversation Operations
      muteConversation,
      deleteConversation,
      
      // Private Notes
      addPrivateNote,
      
      // Group Participants
      getGroupParticipants,
      
      // Bots
      getBots,
      assignBotToConversation,
      
      // Avatar
      fetchConversationAvatar,
      
      isAgentMode: false
    }
  }, [isAgentMode])
}

export default useChatApi
