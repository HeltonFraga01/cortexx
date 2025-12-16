# Design Document

## Overview

This design enhances the group name identification system in the WhatsApp chat interface. The current implementation already has basic functionality for detecting invalid group names and fetching from the WUZAPI API, but needs improvements in:

1. **Webhook field extraction**: Better extraction of group names from multiple webhook fields
2. **Logging and observability**: Comprehensive logging for debugging name resolution issues
3. **Automatic updates**: Real-time updates when group names change
4. **Resilience**: Better handling of API failures and fallback strategies
5. **Centralized logic**: A single source of truth for group name resolution

## Architecture

### Current System

```
┌─────────────────────────────────────────────────────────────┐
│                    WUZAPI Webhook                           │
│  { Info: { GroupName, Name, Subject, ChatName, ... } }     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            ChatMessageHandler.handleMessageEvent            │
│  - Extract group name from webhook fields                   │
│  - Validate using isInvalidGroupName()                      │
│  - Fetch from API if invalid                                │
│  - Store in conversations table                             │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Conversations Table                        │
│  { id, user_id, contact_jid, contact_name, ... }           │
└─────────────────────────────────────────────────────────────┘
```

### Enhanced System

```
┌─────────────────────────────────────────────────────────────┐
│                    WUZAPI Webhook                           │
│  { Info: { GroupName, Name, Subject, ChatName, ... } }     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│         GroupNameResolver (NEW COMPONENT)                   │
│  - extractFromWebhook(webhookData)                          │
│  - validateGroupName(name)                                  │
│  - fetchFromAPI(groupJid, userToken)                        │
│  - resolveGroupName(groupJid, webhookData, userToken)       │
│  - updateConversationName(conversationId, name, source)     │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│            ChatMessageHandler.handleMessageEvent            │
│  - Use GroupNameResolver for all name operations            │
│  - Enhanced logging at each step                            │
│  - Broadcast updates via WebSocket                          │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                  Conversations Table                        │
│  { id, user_id, contact_jid, contact_name,                 │
│    name_source, name_updated_at }  (NEW FIELDS)            │
└─────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. GroupNameResolver Service (NEW)

**Location**: `server/services/GroupNameResolver.js`

**Purpose**: Centralized service for all group name resolution logic

**Interface**:

```javascript
class GroupNameResolver {
  constructor(db, logger)
  
  /**
   * Extract group name from webhook payload
   * @param {Object} webhookData - Raw webhook data from WUZAPI
   * @returns {Object} { name: string|null, source: string, fields: Object }
   */
  extractFromWebhook(webhookData)
  
  /**
   * Validate if a group name is valid
   * @param {string|null} name - Name to validate
   * @returns {Object} { isValid: boolean, reason: string }
   */
  validateGroupName(name)
  
  /**
   * Fetch group name from WUZAPI API with retry logic
   * @param {string} groupJid - Group JID
   * @param {string} userToken - User token for authentication
   * @param {Object} options - { maxRetries: 3, retryDelay: 1000 }
   * @returns {Promise<Object>} { name: string, source: 'api'|'fallback', success: boolean }
   */
  async fetchFromAPI(groupJid, userToken, options = {})
  
  /**
   * Resolve group name using all available sources
   * Priority: webhook (if valid) > database (if valid) > API > fallback
   * @param {string} groupJid - Group JID
   * @param {Object} webhookData - Webhook payload (optional)
   * @param {string} userToken - User token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { name: string, source: string, updated: boolean }
   */
  async resolveGroupName(groupJid, webhookData, userToken, userId)
  
  /**
   * Update conversation name in database
   * @param {number} conversationId - Conversation ID
   * @param {string} name - New name
   * @param {string} source - Source of the name ('webhook'|'api'|'fallback')
   * @returns {Promise<boolean>} Success status
   */
  async updateConversationName(conversationId, name, source)
  
  /**
   * Format fallback group name from JID
   * @param {string} groupJid - Group JID
   * @returns {string} Formatted fallback name
   */
  formatFallbackGroupName(groupJid)
}
```

### 2. Enhanced ChatMessageHandler

**Location**: `server/webhooks/chatMessageHandler.js`

**Changes**:
- Add `GroupNameResolver` as a dependency
- Replace inline name resolution logic with `GroupNameResolver` calls
- Add comprehensive logging at each step
- Broadcast name updates via WebSocket

**Modified Methods**:

```javascript
class ChatMessageHandler {
  constructor(db, chatHandler = null) {
    this.db = db
    this.chatService = new ChatService(db)
    this.chatHandler = chatHandler
    this.groupNameResolver = new GroupNameResolver(db, logger) // NEW
    // ... existing code
  }
  
  async handleMessageEvent(userToken, data, timestamp) {
    // ... existing extraction logic ...
    
    if (isGroupMessage) {
      // NEW: Use GroupNameResolver instead of inline logic
      const nameResolution = await this.groupNameResolver.resolveGroupName(
        contactJid,
        messageInfo, // webhook data
        userToken,
        userId
      )
      
      contactName = nameResolution.name
      
      // If name was updated, broadcast via WebSocket
      if (nameResolution.updated && this.chatHandler) {
        this.chatHandler.broadcastConversationUpdate({
          id: conversation.id,
          contact_name: contactName,
          name_source: nameResolution.source,
          name_updated_at: new Date().toISOString()
        })
      }
      
      logger.info('Group name resolved', {
        groupJid: contactJid,
        name: contactName,
        source: nameResolution.source,
        updated: nameResolution.updated
      })
    }
    
    // ... rest of existing code ...
  }
}
```

### 3. Database Schema Changes

**Migration**: `server/migrations/038_enhance_group_names.js`

**Changes to `conversations` table**:

```sql
ALTER TABLE conversations ADD COLUMN name_source TEXT DEFAULT NULL;
ALTER TABLE conversations ADD COLUMN name_updated_at TEXT DEFAULT NULL;

-- name_source values: 'webhook', 'api', 'fallback', NULL (for individual chats)
-- name_updated_at: ISO timestamp of last name update
```

### 4. Enhanced Logging

**Log Levels and Messages**:

```javascript
// DEBUG level - detailed extraction
logger.debug('Webhook fields for group name', {
  groupJid,
  availableFields: {
    GroupName: webhookData.GroupName,
    Name: webhookData.Name,
    Subject: webhookData.Subject,
    ChatName: webhookData.ChatName
  }
})

// INFO level - resolution steps
logger.info('Group name extracted from webhook', {
  groupJid,
  name,
  field: 'GroupName',
  isValid: true
})

logger.info('Group name fetched from API', {
  groupJid,
  name,
  apiEndpoint: '/group/info',
  responseTime: 234
})

// WARN level - fallbacks
logger.warn('Using fallback group name', {
  groupJid,
  reason: 'API unavailable',
  fallbackName: 'Grupo 12036304...'
})

// ERROR level - failures
logger.error('Failed to fetch group name from API', {
  groupJid,
  error: error.message,
  status: error.response?.status,
  retryAttempt: 2,
  maxRetries: 3
})
```

## Data Models

### Conversations Table (Enhanced)

```javascript
{
  id: INTEGER PRIMARY KEY,
  user_id: TEXT NOT NULL,
  contact_jid: TEXT NOT NULL,
  contact_name: TEXT,
  contact_avatar_url: TEXT,
  status: TEXT DEFAULT 'open',
  assigned_bot_id: INTEGER,
  last_message_at: TEXT,
  last_message_preview: TEXT,
  unread_count: INTEGER DEFAULT 0,
  created_at: TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at: TEXT DEFAULT CURRENT_TIMESTAMP,
  
  // NEW FIELDS
  name_source: TEXT DEFAULT NULL,      // 'webhook', 'api', 'fallback', NULL
  name_updated_at: TEXT DEFAULT NULL   // ISO timestamp
}
```

### GroupNameResolution Result Object

```javascript
{
  name: string,           // Resolved group name
  source: string,         // 'webhook', 'api', 'fallback'
  updated: boolean,       // Whether the name was updated in DB
  previousName: string,   // Previous name (if updated)
  timestamp: string       // ISO timestamp of resolution
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Webhook field extraction completeness

*For any* WUZAPI webhook containing a group message, if any of the fields (GroupName, Name, Subject, ChatName) contain a valid group name, then the extraction function should return that name.

**Validates: Requirements 1.1**

### Property 2: Name validation consistency

*For any* string value, the validation function should return the same result regardless of when or how many times it is called with that value.

**Validates: Requirements 1.2**

### Property 3: Database update idempotency

*For any* conversation and valid group name, updating the conversation name multiple times with the same name should result in the same database state as updating it once.

**Validates: Requirements 1.3**

### Property 4: Name source priority

*For any* group conversation, when multiple name sources are available (webhook, database, API), the system should always prefer the most reliable source in this order: valid webhook name > valid database name > API name > fallback.

**Validates: Requirements 1.4, 3.2**

### Property 5: WebSocket broadcast consistency

*For any* name update that changes the stored name, a WebSocket broadcast should be sent to all connected clients with the conversation ID and new name.

**Validates: Requirements 3.5**

### Property 6: API retry exponential backoff

*For any* failed API call, the retry delay should increase exponentially (1s, 2s, 4s) up to the maximum number of retries.

**Validates: Requirements 4.4**

### Property 7: Fallback name format

*For any* group JID, the fallback name should follow the format "Grupo [first 8 digits]..." and should never be empty.

**Validates: Requirements 4.3**

### Property 8: Centralized function usage

*For any* code path that needs a group name, it should use the GroupNameResolver service and not implement its own resolution logic.

**Validates: Requirements 5.1**

## Error Handling

### API Failures

```javascript
// Retry with exponential backoff
async fetchFromAPI(groupJid, userToken, options = {}) {
  const maxRetries = options.maxRetries || 3
  const baseDelay = options.retryDelay || 1000
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await axios.get(...)
      return { name: response.data.data.Name, source: 'api', success: true }
    } catch (error) {
      logger.error('API fetch failed', {
        groupJid,
        attempt,
        maxRetries,
        error: error.message
      })
      
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  // All retries failed - use fallback
  return {
    name: this.formatFallbackGroupName(groupJid),
    source: 'fallback',
    success: false
  }
}
```

### Invalid Webhook Data

```javascript
extractFromWebhook(webhookData) {
  if (!webhookData) {
    logger.warn('Webhook data is null or undefined')
    return { name: null, source: 'none', fields: {} }
  }
  
  const fields = {
    GroupName: webhookData.GroupName || null,
    Name: webhookData.Name || null,
    Subject: webhookData.Subject || null,
    ChatName: webhookData.ChatName || null
  }
  
  // Try each field in priority order
  for (const [fieldName, value] of Object.entries(fields)) {
    if (value && this.validateGroupName(value).isValid) {
      return { name: value, source: 'webhook', fields }
    }
  }
  
  return { name: null, source: 'none', fields }
}
```

### Database Errors

```javascript
async updateConversationName(conversationId, name, source) {
  try {
    await this.db.query(
      `UPDATE conversations 
       SET contact_name = ?, name_source = ?, name_updated_at = ? 
       WHERE id = ?`,
      [name, source, new Date().toISOString(), conversationId]
    )
    return true
  } catch (error) {
    logger.error('Failed to update conversation name', {
      conversationId,
      name,
      source,
      error: error.message
    })
    return false
  }
}
```

## Testing Strategy

### Unit Tests

**File**: `server/services/GroupNameResolver.test.js`

Tests for individual methods:

```javascript
describe('GroupNameResolver', () => {
  describe('extractFromWebhook', () => {
    it('should extract from GroupName field first', () => {
      const webhook = { GroupName: 'My Group', Name: 'Other' }
      const result = resolver.extractFromWebhook(webhook)
      expect(result.name).toBe('My Group')
      expect(result.source).toBe('webhook')
    })
    
    it('should try Name field if GroupName is invalid', () => {
      const webhook = { GroupName: '12345@g.us', Name: 'Valid Group' }
      const result = resolver.extractFromWebhook(webhook)
      expect(result.name).toBe('Valid Group')
    })
    
    it('should return null if all fields are invalid', () => {
      const webhook = { GroupName: '12345', Name: '67890' }
      const result = resolver.extractFromWebhook(webhook)
      expect(result.name).toBeNull()
    })
  })
  
  describe('validateGroupName', () => {
    it('should reject null or empty names', () => {
      expect(resolver.validateGroupName(null).isValid).toBe(false)
      expect(resolver.validateGroupName('').isValid).toBe(false)
      expect(resolver.validateGroupName('   ').isValid).toBe(false)
    })
    
    it('should reject pure digit names', () => {
      expect(resolver.validateGroupName('12345').isValid).toBe(false)
    })
    
    it('should reject names containing @g.us', () => {
      expect(resolver.validateGroupName('12345@g.us').isValid).toBe(false)
    })
    
    it('should accept valid group names', () => {
      expect(resolver.validateGroupName('My Group').isValid).toBe(true)
      expect(resolver.validateGroupName('Família 2024').isValid).toBe(true)
    })
  })
  
  describe('formatFallbackGroupName', () => {
    it('should format short JIDs', () => {
      const result = resolver.formatFallbackGroupName('1234@g.us')
      expect(result).toBe('Grupo 1234')
    })
    
    it('should truncate long JIDs', () => {
      const result = resolver.formatFallbackGroupName('120363043775639115@g.us')
      expect(result).toBe('Grupo 12036304...')
    })
  })
})
```

### Integration Tests

**File**: `server/tests/integration/groupNameResolution.test.js`

Tests for end-to-end flows:

```javascript
describe('Group Name Resolution Integration', () => {
  it('should resolve name from webhook when valid', async () => {
    const webhook = { GroupName: 'Test Group', Chat: '12345@g.us' }
    const result = await resolver.resolveGroupName(
      '12345@g.us',
      webhook,
      'test-token',
      'test-user'
    )
    
    expect(result.name).toBe('Test Group')
    expect(result.source).toBe('webhook')
  })
  
  it('should fetch from API when webhook name is invalid', async () => {
    // Mock API response
    nock('https://wzapi.wasend.com.br')
      .get('/group/info')
      .reply(200, { data: { Name: 'API Group' } })
    
    const webhook = { GroupName: '12345', Chat: '12345@g.us' }
    const result = await resolver.resolveGroupName(
      '12345@g.us',
      webhook,
      'test-token',
      'test-user'
    )
    
    expect(result.name).toBe('API Group')
    expect(result.source).toBe('api')
  })
  
  it('should use fallback when API fails', async () => {
    // Mock API failure
    nock('https://wzapi.wasend.com.br')
      .get('/group/info')
      .reply(500)
    
    const webhook = { GroupName: '12345', Chat: '120363043775639115@g.us' }
    const result = await resolver.resolveGroupName(
      '120363043775639115@g.us',
      webhook,
      'test-token',
      'test-user'
    )
    
    expect(result.name).toBe('Grupo 12036304...')
    expect(result.source).toBe('fallback')
  })
})
```

### Property-Based Tests

**File**: `server/services/GroupNameResolver.property.test.js`

Tests using fast-check library:

```javascript
const fc = require('fast-check')

describe('GroupNameResolver Property Tests', () => {
  describe('Property 2: Name validation consistency', () => {
    it('should return same validation result for same input', () => {
      fc.assert(
        fc.property(
          fc.string(),
          (name) => {
            const result1 = resolver.validateGroupName(name)
            const result2 = resolver.validateGroupName(name)
            return result1.isValid === result2.isValid &&
                   result1.reason === result2.reason
          }
        ),
        { numRuns: 100 }
      )
    })
  })
  
  describe('Property 7: Fallback name format', () => {
    it('should always return non-empty formatted name', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }).map(s => `${s}@g.us`),
          (groupJid) => {
            const fallback = resolver.formatFallbackGroupName(groupJid)
            return fallback.length > 0 && fallback.startsWith('Grupo ')
          }
        ),
        { numRuns: 100 }
      )
    })
  })
})
```

## Performance Considerations

### Caching Strategy

```javascript
class GroupNameResolver {
  constructor(db, logger) {
    this.db = db
    this.logger = logger
    this.nameCache = new Map() // groupJid -> { name, timestamp }
    this.cacheTTL = 5 * 60 * 1000 // 5 minutes
  }
  
  async resolveGroupName(groupJid, webhookData, userToken, userId) {
    // Check cache first
    const cached = this.nameCache.get(groupJid)
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug('Using cached group name', { groupJid, name: cached.name })
      return { name: cached.name, source: 'cache', updated: false }
    }
    
    // ... resolution logic ...
    
    // Update cache
    this.nameCache.set(groupJid, { name: resolvedName, timestamp: Date.now() })
    
    return result
  }
}
```

### API Rate Limiting

```javascript
class GroupNameResolver {
  constructor(db, logger) {
    this.db = db
    this.logger = logger
    this.apiCallQueue = []
    this.maxConcurrentCalls = 5
    this.activeCalls = 0
  }
  
  async fetchFromAPI(groupJid, userToken, options = {}) {
    // Wait if too many concurrent calls
    while (this.activeCalls >= this.maxConcurrentCalls) {
      await new Promise(resolve => setTimeout(resolve, 100))
    }
    
    this.activeCalls++
    try {
      // ... API call logic ...
    } finally {
      this.activeCalls--
    }
  }
}
```

## Security Considerations

1. **Input Validation**: All webhook data should be validated before processing
2. **SQL Injection**: Use parameterized queries for all database operations
3. **API Token Security**: Never log full user tokens, only first 8 characters
4. **XSS Prevention**: Sanitize group names before displaying in UI (already handled by React)

## Deployment Strategy

1. **Database Migration**: Run migration 038 to add new columns
2. **Deploy Service**: Deploy GroupNameResolver service
3. **Update Handler**: Deploy updated ChatMessageHandler
4. **Monitor Logs**: Watch for any errors in name resolution
5. **Gradual Rollout**: Can be deployed without downtime as it's backward compatible
