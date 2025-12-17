/**
 * Response Transformer Utility
 * 
 * Centralized utility for transforming data between backend (database) and frontend formats.
 * Handles:
 * - snake_case to camelCase key conversion
 * - Database boolean (0/1) to JavaScript boolean conversion
 * - Entity-specific transformations
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.4, 3.4, 3.5
 */

/**
 * Convert database boolean (0/1) to JavaScript boolean
 * Handles edge cases: null, undefined, "0", "1", 0, 1, true, false
 * 
 * @param {any} value - Value to convert
 * @returns {boolean} JavaScript boolean
 */
function toBoolean(value) {
  if (value === null || value === undefined) return false;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    return lower === '1' || lower === 'true';
  }
  return Boolean(value);
}

/**
 * Convert snake_case string to camelCase
 * 
 * @param {string} str - snake_case string
 * @returns {string} camelCase string
 */
function snakeToCamel(str) {
  if (typeof str !== 'string') return str;
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Transform object keys from snake_case to camelCase
 * Optionally converts specified fields to boolean
 * 
 * @param {any} obj - Object to transform
 * @param {string[]} booleanFields - Array of field names (in camelCase) to convert to boolean
 * @returns {any} Transformed object
 */
function transformKeys(obj, booleanFields = []) {
  if (obj === null || obj === undefined) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map(item => transformKeys(item, booleanFields));
  }
  
  if (typeof obj === 'object' && obj.constructor === Object) {
    const transformed = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        const camelKey = snakeToCamel(key);
        let value = obj[key];
        
        // Convert boolean fields
        if (booleanFields.includes(camelKey)) {
          value = toBoolean(value);
        } else if (value !== null && typeof value === 'object') {
          value = transformKeys(value, booleanFields);
        }
        
        transformed[camelKey] = value;
      }
    }
    return transformed;
  }
  
  return obj;
}

/**
 * Transform conversation data from database format to API format
 * 
 * @param {Object} conv - Conversation row from database
 * @param {Array} labels - Labels array (optional)
 * @param {Object} botInfo - Bot info object (optional)
 * @returns {Object} Transformed conversation
 */
function transformConversation(conv, labels = [], botInfo = null) {
  if (!conv) return null;
  
  // Build assigned agent info if available
  const assignedAgent = conv.assigned_agent_id ? {
    id: conv.assigned_agent_id,
    name: conv.assigned_agent_name || null,
    avatarUrl: conv.assigned_agent_avatar_url || null
  } : null;
  
  return {
    id: conv.id,
    userId: conv.user_id,
    contactJid: conv.contact_jid,
    contactName: conv.contact_name,
    contactAvatarUrl: conv.contact_avatar_url,
    lastMessageAt: conv.last_message_at,
    lastMessagePreview: conv.last_message_preview,
    unreadCount: conv.unread_count,
    assignedBotId: conv.assigned_bot_id,
    assignedAgentId: conv.assigned_agent_id,
    inboxId: conv.inbox_id,
    status: conv.status,
    isMuted: toBoolean(conv.is_muted),
    createdAt: conv.created_at,
    updatedAt: conv.updated_at,
    labels: labels,
    assignedBot: botInfo,
    assignedAgent: assignedAgent
  };
}

/**
 * Transform bot data from database format to API format
 * 
 * @param {Object} bot - Bot row from database
 * @returns {Object} Transformed bot
 */
function transformBot(bot) {
  if (!bot) return null;
  
  return {
    id: bot.id,
    userId: bot.user_id,
    name: bot.name,
    description: bot.description,
    avatarUrl: bot.avatar_url,
    outgoingUrl: bot.outgoing_url,
    accessToken: bot.access_token,
    status: bot.status,
    priority: bot.priority ?? 999,
    isDefault: toBoolean(bot.is_default),
    includeHistory: toBoolean(bot.include_history),
    createdAt: bot.created_at,
    updatedAt: bot.updated_at
  };
}

/**
 * Transform webhook data from database format to API format
 * 
 * @param {Object} webhook - Webhook row from database
 * @returns {Object} Transformed webhook
 */
function transformWebhook(webhook) {
  if (!webhook) return null;
  
  // Parse events JSON string if needed
  let events = webhook.events;
  if (typeof events === 'string') {
    try {
      events = JSON.parse(events);
    } catch {
      events = [];
    }
  }
  
  return {
    id: webhook.id,
    userId: webhook.user_id,
    url: webhook.url,
    events: events || [],
    secret: webhook.secret,
    isActive: toBoolean(webhook.is_active),
    successCount: webhook.success_count,
    failureCount: webhook.failure_count,
    lastDeliveryAt: webhook.last_delivery_at,
    lastError: webhook.last_error,
    createdAt: webhook.created_at,
    updatedAt: webhook.updated_at
  };
}

/**
 * Transform message data from database format to API format
 * 
 * @param {Object} msg - Message row from database
 * @returns {Object} Transformed message
 */
function transformMessage(msg) {
  if (!msg) return null;
  
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    messageId: msg.message_id,
    direction: msg.direction,
    messageType: msg.message_type,
    content: msg.content,
    mediaUrl: msg.media_url,
    mediaMimeType: msg.media_mime_type,
    mediaFilename: msg.media_filename,
    replyToMessageId: msg.reply_to_message_id,
    status: msg.status,
    isPrivateNote: toBoolean(msg.is_private_note),
    senderType: msg.sender_type,
    senderBotId: msg.sender_bot_id,
    participantJid: msg.participant_jid,
    participantName: msg.participant_name,
    isEdited: toBoolean(msg.is_edited),
    isDeleted: toBoolean(msg.is_deleted),
    pollData: msg.poll_data,
    interactiveData: msg.interactive_data,
    timestamp: msg.timestamp,
    createdAt: msg.created_at
  };
}

module.exports = {
  toBoolean,
  snakeToCamel,
  transformKeys,
  transformConversation,
  transformBot,
  transformWebhook,
  transformMessage
};
