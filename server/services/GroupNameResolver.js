/**
 * GroupNameResolver Service
 * 
 * Centralized service for resolving group names from multiple sources.
 * Handles extraction from webhooks, validation, API fetching, and database updates.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const SupabaseService = require('./SupabaseService');

/**
 * Check if a group name is invalid and needs to be fetched from WUZAPI
 * 
 * @param {string|null} name - The group name to validate
 * @returns {boolean} True if the name is invalid and needs to be fetched
 */
function isInvalidGroupName(name) {
  // Null or empty name is invalid
  if (!name || name.trim().length === 0) {
    return true;
  }
  
  // Name is only digits - likely a JID without @g.us
  if (/^\d+$/.test(name)) {
    return true;
  }
  
  // Name contains @g.us - it's a raw JID
  if (name.includes('@g.us')) {
    return true;
  }
  
  // Name starts with "Grupo " followed by digits - it's a previous fallback
  if (/^Grupo \d+/.test(name)) {
    return true;
  }
  
  return false;
}

class GroupNameResolver {
  /**
   * Create a new GroupNameResolver instance
   * 
   * @param {Object} customLogger - Logger instance (optional, uses default if not provided)
   */
  constructor(customLogger = null) {
    this.logger = customLogger || logger;
    this.nameCache = new Map(); // groupJid -> { name, timestamp }
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes
    this.apiCallQueue = [];
    this.maxConcurrentCalls = 5;
    this.activeCalls = 0;
    
    this.logger.info('GroupNameResolver initialized', {
      cacheTTL: this.cacheTTL,
      maxConcurrentCalls: this.maxConcurrentCalls
    });
  }

  /**
   * Extract group name from webhook payload
   * Checks multiple fields in priority order and nested structures
   * Supports: GroupName, Name, Subject, ChatName, GroupSubject, GroupDescription, Title
   * Also checks nested structures like data.GroupInfo.Name, data.data.Name
   * 
   * @param {Object} webhookData - Raw webhook data from WUZAPI
   * @returns {Object} { name: string|null, source: string, fields: Object }
   */
  extractFromWebhook(webhookData) {
    if (!webhookData) {
      this.logger.warn('Webhook data is null or undefined');
      return { name: null, source: 'none', fields: {} };
    }
    
    // Helper function to safely get nested value
    const getNestedValue = (obj, paths) => {
      for (const path of paths) {
        const keys = path.split('.');
        let value = obj;
        for (const key of keys) {
          if (value && typeof value === 'object') {
            value = value[key] || value[key.charAt(0).toLowerCase() + key.slice(1)];
          } else {
            value = null;
            break;
          }
        }
        if (value) return value;
      }
      return null;
    };
    
    // Extract all possible name fields from webhook (top level)
    const fields = {
      GroupName: webhookData.GroupName || webhookData.groupName || null,
      Name: webhookData.Name || webhookData.name || null,
      Subject: webhookData.Subject || webhookData.subject || null,
      ChatName: webhookData.ChatName || webhookData.chatName || null,
      GroupSubject: webhookData.GroupSubject || webhookData.groupSubject || null,
      GroupDescription: webhookData.GroupDescription || webhookData.groupDescription || null,
      Title: webhookData.Title || webhookData.title || null
    };
    
    // Check nested structures (common patterns in WUZAPI webhooks)
    const nestedPaths = [
      'GroupInfo.Name',
      'GroupInfo.GroupName',
      'GroupInfo.Subject',
      'data.GroupInfo.Name',
      'data.GroupInfo.GroupName',
      'data.data.Name',
      'data.data.GroupName',
      'Info.GroupName',
      'Info.Name',
      'Info.Subject'
    ];
    
    // Try to extract from nested structures
    for (const path of nestedPaths) {
      const nestedValue = getNestedValue(webhookData, [path, path.toLowerCase()]);
      if (nestedValue && typeof nestedValue === 'string') {
        // Add to fields object with path as key for logging
        const fieldKey = `nested.${path}`;
        if (!fields[fieldKey]) {
          fields[fieldKey] = nestedValue;
        }
      }
    }
    
    // Log all available fields for debugging
    this.logger.debug('Webhook fields for group name extraction', {
      topLevelFields: {
        GroupName: fields.GroupName,
        Name: fields.Name,
        Subject: fields.Subject,
        ChatName: fields.ChatName,
        GroupSubject: fields.GroupSubject,
        GroupDescription: fields.GroupDescription,
        Title: fields.Title
      },
      nestedFields: Object.keys(fields).filter(k => k.startsWith('nested.')),
      webhookKeys: Object.keys(webhookData),
      webhookStructure: JSON.stringify(webhookData).substring(0, 500)
    });
    
    // Try each field in priority order
    const fieldPriority = [
      'GroupName',
      'Name',
      'Subject',
      'GroupSubject',
      'ChatName',
      'Title',
      'GroupDescription'
    ];
    
    // Also check nested fields
    const nestedFieldKeys = Object.keys(fields).filter(k => k.startsWith('nested.'));
    fieldPriority.push(...nestedFieldKeys);
    
    for (const fieldName of fieldPriority) {
      const value = fields[fieldName];
      if (value && typeof value === 'string' && !isInvalidGroupName(value)) {
        this.logger.info('Group name extracted from webhook', {
          name: value,
          field: fieldName,
          isValid: true,
          allFieldsChecked: fieldPriority.length
        });
        return { name: value, source: 'webhook', fields };
      } else if (value && typeof value === 'string') {
        this.logger.debug('Webhook field found but invalid', {
          field: fieldName,
          value: value.substring(0, 50),
          reason: isInvalidGroupName(value) ? 'Invalid format' : 'Not a string'
        });
      }
    }
    
    this.logger.debug('No valid group name found in webhook fields', {
      fieldsChecked: fieldPriority.length,
      sampleFields: Object.entries(fields).slice(0, 5).map(([k, v]) => ({ [k]: v?.substring?.(0, 30) || v }))
    });
    return { name: null, source: 'none', fields };
  }

  /**
   * Validate if a group name is valid
   * 
   * @param {string|null} name - Name to validate
   * @returns {Object} { isValid: boolean, reason: string }
   */
  validateGroupName(name) {
    // Null or empty name is invalid
    if (!name || name.trim().length === 0) {
      return { isValid: false, reason: 'Name is null or empty' };
    }
    
    // Name is only digits - likely a JID without @g.us
    if (/^\d+$/.test(name)) {
      return { isValid: false, reason: 'Name is only digits (likely a JID)' };
    }
    
    // Name contains @g.us - it's a raw JID
    if (name.includes('@g.us')) {
      return { isValid: false, reason: 'Name contains @g.us (raw JID)' };
    }
    
    // Name starts with "Grupo " followed by digits - it's a previous fallback
    if (/^Grupo \d+/.test(name)) {
      return { isValid: false, reason: 'Name is a fallback format (Grupo + digits)' };
    }
    
    // Name is valid
    return { isValid: true, reason: 'Valid group name' };
  }

  /**
   * Format fallback group name from JID
   * 
   * @param {string} groupJid - Group JID (e.g., "120363043775639115@g.us")
   * @returns {string} Formatted fallback name (e.g., "Grupo 12036304...")
   */
  formatFallbackGroupName(groupJid) {
    if (!groupJid) {
      return 'Grupo desconhecido';
    }
    
    // Extract group number from JID (before @g.us)
    const groupNumber = groupJid.split('@')[0];
    
    // Truncate if longer than 8 digits
    const truncatedNumber = groupNumber.length > 8 
      ? groupNumber.substring(0, 8) + '...' 
      : groupNumber;
    
    return `Grupo ${truncatedNumber}`;
  }

  /**
   * Fetch group name from WUZAPI API with retry logic
   * 
   * @param {string} groupJid - Group JID
   * @param {string} userToken - User token for authentication
   * @param {Object} options - { maxRetries: 3, retryDelay: 1000 }
   * @returns {Promise<Object>} { name: string, source: 'api'|'fallback', success: boolean }
   */
  async fetchFromAPI(groupJid, userToken, options = {}) {
    const maxRetries = options.maxRetries || 3;
    const baseDelay = options.retryDelay || 1000;
    const wuzapiBaseUrl = process.env.WUZAPI_BASE_URL || 'https://wzapi.wasend.com.br';
    
    // Wait if too many concurrent calls
    while (this.activeCalls >= this.maxConcurrentCalls) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    this.activeCalls++;
    
    try {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          this.logger.info('Fetching group name from WUZAPI', {
            groupJid,
            attempt,
            maxRetries,
            wuzapiBaseUrl
          });
          
          const startTime = Date.now();
          
          // WUZAPI /group/info accepts both query parameter and JSON body
          // Using query parameter for better compatibility (some HTTP clients don't send body with GET)
          const url = new URL(`${wuzapiBaseUrl}/group/info`);
          url.searchParams.set('groupJID', groupJid);
          
          const requestConfig = {
            method: 'GET',
            url: url.toString(),
            headers: { 
              'Token': userToken,
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            // Also send in body for servers that expect it
            data: { GroupJID: groupJid },
            timeout: 10000
          };
          
          this.logger.info('Making WUZAPI API request', {
            url: requestConfig.url,
            bodyData: requestConfig.data,
            hasToken: !!userToken,
            tokenPreview: userToken ? userToken.substring(0, 8) + '...' : 'none'
          });
          
          const response = await axios(requestConfig);
          
          const responseTime = Date.now() - startTime;
          
          this.logger.info('WUZAPI /group/info response', {
            groupJid,
            status: response.status,
            responseTime,
            hasData: !!response.data,
            dataKeys: response.data ? Object.keys(response.data) : [],
            nestedDataKeys: response.data?.data ? Object.keys(response.data.data) : [],
            responsePreview: JSON.stringify(response.data).substring(0, 300)
          });
          
          // Extract group name from response
          // WUZAPI returns: { code: 200, data: { Name: "...", ... }, success: true }
          // Try both paths: response.data.data.Name (nested) and response.data.Name (direct)
          const groupName = response.data?.data?.Name || response.data?.Name;
          
          if (groupName) {
            // Validate that the returned name is not invalid
            const validation = this.validateGroupName(groupName);
            if (validation.isValid) {
              this.logger.info('Group name fetched from API', {
                groupJid,
                name: groupName,
                apiEndpoint: '/group/info',
                responseTime
              });
              
              return { name: groupName, source: 'api', success: true };
            }
            
            this.logger.warn('WUZAPI returned invalid group name', { 
              groupJid,
              returnedName: groupName,
              reason: validation.reason
            });
          } else {
            // No valid name in response
            this.logger.warn('Group name not found in WUZAPI response', { 
              groupJid,
              responseData: JSON.stringify(response.data).substring(0, 200)
            });
          }
          
          // Don't retry if we got a response but no valid name
          break;
          
        } catch (error) {
          this.logger.error('API fetch failed', {
            groupJid,
            attempt,
            maxRetries,
            error: error.message,
            status: error.response?.status,
            responseData: error.response?.data ? JSON.stringify(error.response.data).substring(0, 200) : 'none',
            code: error.code
          });
          
          // If this was the last attempt, break
          if (attempt >= maxRetries) {
            break;
          }
          
          // Calculate exponential backoff delay
          const delay = baseDelay * Math.pow(2, attempt - 1);
          this.logger.debug('Retrying after delay', { groupJid, delay, attempt });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
      
      // All retries failed or no valid name found - use fallback
      const fallbackName = this.formatFallbackGroupName(groupJid);
      this.logger.warn('Using fallback group name', {
        groupJid,
        reason: 'API unavailable or returned invalid name',
        fallbackName
      });
      
      return { name: fallbackName, source: 'fallback', success: false };
      
    } finally {
      this.activeCalls--;
    }
  }

  /**
   * Update conversation name in database
   * 
   * @param {number} conversationId - Conversation ID
   * @param {string} name - New name
   * @param {string} source - Source of the name ('webhook'|'api'|'fallback')
   * @returns {Promise<boolean>} Success status
   */
  async updateConversationName(conversationId, name, source) {
    try {
      const timestamp = new Date().toISOString();
      
      const { error } = await SupabaseService.update('conversations', conversationId, {
        contact_name: name,
        name_source: source,
        name_updated_at: timestamp
      });
      
      if (error) throw error;
      
      this.logger.info('Conversation name updated', {
        conversationId,
        name,
        source,
        timestamp
      });
      
      return true;
    } catch (error) {
      this.logger.error('Failed to update conversation name', {
        conversationId,
        name,
        source,
        error: error.message
      });
      return false;
    }
  }

  /**
   * Resolve group name using all available sources
   * Priority: webhook (if valid) > database (if valid) > API > fallback
   * Always updates when webhook contains a valid name, even if one exists in database
   * 
   * @param {string} groupJid - Group JID
   * @param {Object} webhookData - Webhook payload (optional)
   * @param {string} userToken - User token
   * @param {string} userId - User ID
   * @returns {Promise<Object>} { name: string, source: string, updated: boolean, previousName: string, timestamp: string }
   */
  async resolveGroupName(groupJid, webhookData, userToken, userId) {
    const timestamp = new Date().toISOString();
    
    this.logger.debug('Resolving group name', {
      groupJid,
      hasWebhookData: !!webhookData,
      userId: userId?.substring(0, 8) + '...'
    });
    
    let resolvedName = null;
    let resolvedSource = null;
    let conversationId = null;
    let previousName = null;
    let nameFromWebhook = null;
    
    // Step 1: Try to extract from webhook (highest priority)
    if (webhookData) {
      const webhookExtraction = this.extractFromWebhook(webhookData);
      if (webhookExtraction.name) {
        nameFromWebhook = webhookExtraction.name;
        resolvedName = nameFromWebhook;
        resolvedSource = 'webhook';
        this.logger.info('Group name extracted from webhook', {
          groupJid,
          name: resolvedName,
          source: resolvedSource,
          field: webhookExtraction.fields
        });
      }
    }
    
    // Step 2: Check database for existing conversation
    try {
      const { data: conversations, error: convError } = await SupabaseService.queryAsAdmin('conversations', (query) =>
        query.select('id, contact_name, name_source, name_updated_at')
          .eq('user_id', userId)
          .eq('contact_jid', groupJid)
      );
      
      if (convError) throw convError;
      
      if (conversations && conversations.length > 0) {
        const conversation = conversations[0];
        conversationId = conversation.id;
        previousName = conversation.contact_name;
        
        this.logger.debug('Found existing conversation in database', {
          groupJid,
          conversationId,
          previousName,
          previousSource: conversation.name_source,
          hasWebhookName: !!nameFromWebhook
        });
        
        // If we have a name from webhook, always use it (even if same as database)
        // This ensures we update the timestamp and potentially refresh stale data
        if (nameFromWebhook) {
          // Compare names (case-insensitive and trimmed)
          const namesMatch = previousName && 
            previousName.trim().toLowerCase() === nameFromWebhook.trim().toLowerCase();
          
          if (!namesMatch) {
            this.logger.info('Webhook name differs from database, will update', {
              groupJid,
              previousName,
              newName: nameFromWebhook,
              previousSource: conversation.name_source
            });
          } else {
            this.logger.debug('Webhook name matches database, will update timestamp', {
              groupJid,
              name: nameFromWebhook
            });
          }
        } else {
          // If we don't have a name from webhook, check if database has a valid one
          const validation = this.validateGroupName(conversation.contact_name);
          if (validation.isValid) {
            resolvedName = conversation.contact_name;
            resolvedSource = conversation.name_source || 'database';
            this.logger.info('Using valid group name from database', {
              groupJid,
              name: resolvedName,
              source: resolvedSource,
              lastUpdated: conversation.name_updated_at
            });
          } else {
            this.logger.debug('Database name is invalid', {
              groupJid,
              databaseName: conversation.contact_name,
              reason: validation.reason
            });
          }
        }
      }
    } catch (error) {
      this.logger.error('Error checking database for conversation', {
        groupJid,
        error: error.message
      });
    }
    
    // Step 3: If still no valid name OR current name is invalid (fallback format), fetch from API
    const shouldFetchFromAPI = !resolvedName || isInvalidGroupName(resolvedName);
    
    this.logger.info('Checking if should fetch from API', {
      groupJid,
      resolvedName,
      shouldFetchFromAPI,
      isInvalid: resolvedName ? isInvalidGroupName(resolvedName) : 'no name'
    });
    
    if (shouldFetchFromAPI) {
      this.logger.info('Fetching group name from API because current name is invalid or missing', {
        groupJid,
        currentName: resolvedName,
        reason: !resolvedName ? 'no name' : 'invalid format'
      });
      
      const apiResult = await this.fetchFromAPI(groupJid, userToken);
      
      // Only use API result if it's valid (not a fallback)
      if (apiResult.success) {
        resolvedName = apiResult.name;
        resolvedSource = apiResult.source;
        
        this.logger.info('Using group name from API', {
          groupJid,
          name: resolvedName,
          source: resolvedSource
        });
      } else {
        // API failed, use fallback only if we don't have any name
        if (!resolvedName) {
          resolvedName = apiResult.name;
          resolvedSource = apiResult.source;
        }
        
        this.logger.warn('API fetch failed, using fallback or keeping current', {
          groupJid,
          name: resolvedName,
          source: resolvedSource,
          apiSuccess: apiResult.success
        });
      }
    }
    
    // Step 4: Update database if we have a conversation
    // Always update when webhook has a valid name, even if it matches (to update timestamp)
    // Also update if name changed or if we got a name from API/fallback and DB has invalid name
    let updated = false;
    if (conversationId) {
      const namesMatch = previousName && 
        previousName.trim().toLowerCase() === resolvedName.trim().toLowerCase();
      
      // Update if:
      // 1. Name from webhook (always update to refresh timestamp)
      // 2. Name changed
      // 3. Previous name was invalid and we now have a valid one
      const shouldUpdate = nameFromWebhook || 
        !namesMatch || 
        (previousName && isInvalidGroupName(previousName) && !isInvalidGroupName(resolvedName));
      
      if (shouldUpdate) {
        updated = await this.updateConversationName(conversationId, resolvedName, resolvedSource);
        
        if (updated) {
          // Invalidate cache when name is updated
          this.nameCache.delete(groupJid);
          
          this.logger.info('Group name updated in database', {
            conversationId,
            groupJid,
            oldName: previousName,
            newName: resolvedName,
            source: resolvedSource,
            reason: nameFromWebhook ? 'webhook update' : 
                   !namesMatch ? 'name changed' : 
                   'invalid name replaced'
          });
        }
      } else {
        this.logger.debug('Group name unchanged, skipping database update', {
          groupJid,
          name: resolvedName
        });
      }
    }
    
    // Update cache (only if not invalidated above)
    if (!updated || !this.nameCache.has(groupJid)) {
      this.nameCache.set(groupJid, { name: resolvedName, timestamp: Date.now() });
    }
    
    return {
      name: resolvedName,
      source: resolvedSource,
      updated,
      previousName,
      timestamp
    };
  }
}

module.exports = GroupNameResolver;

