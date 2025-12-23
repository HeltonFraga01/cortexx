/**
 * ContactsService - Service for managing contacts in Supabase
 * 
 * Handles contact CRUD operations, tags, groups, import from WhatsApp,
 * and migration from localStorage.
 * 
 * Requirements: 1.1-1.5, 2.1-2.5, 3.1-3.4, 4.1-4.4, 6.1-6.4, 7.2-7.3, 8.1-8.4, 9.1-9.4
 */

const { logger } = require('../utils/logger');
const supabaseService = require('./SupabaseService');

// Default pagination settings
const DEFAULT_PAGE_SIZE = 50;
const MAX_PAGE_SIZE = 100;

class ContactsService {
  // ==================== CONTACTS CRUD ====================

  /**
   * Get contacts with pagination and filters
   * @param {string} accountId - Account UUID
   * @param {Object} options - Query options
   * @returns {Promise<{data: Object[], total: number, page: number, pageSize: number}>}
   */
  async getContacts(accountId, options = {}) {
    try {
      const {
        page = 1,
        pageSize = DEFAULT_PAGE_SIZE,
        search = '',
        tagIds = [],
        groupId = null,
        hasName = null,
        sourceInboxId = null,
        sortBy = 'created_at',
        sortOrder = 'desc'
      } = options;

      const limit = Math.min(pageSize, MAX_PAGE_SIZE);
      const offset = (page - 1) * limit;

      // Build query
      const queryFn = (query) => {
        let q = query
          .select(`
            *, 
            contact_tag_members(tag_id),
            source_inbox:inboxes(id, name, phone_number)
          `, { count: 'exact' })
          .eq('account_id', accountId);

        // Search filter
        if (search) {
          q = q.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
        }

        // Has name filter
        if (hasName === true) {
          q = q.not('name', 'is', null);
        } else if (hasName === false) {
          q = q.is('name', null);
        }

        // Source inbox filter
        if (sourceInboxId !== null) {
          if (sourceInboxId === 'null' || sourceInboxId === '') {
            // Filter for manual contacts (no source inbox)
            q = q.is('source_inbox_id', null);
          } else {
            // Filter for specific inbox
            q = q.eq('source_inbox_id', sourceInboxId);
          }
        }

        // Sort
        const ascending = sortOrder === 'asc';
        q = q.order(sortBy, { ascending });

        // Pagination
        q = q.range(offset, offset + limit - 1);

        return q;
      };

      const { data: contacts, count, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) {
        throw error;
      }

      // Filter by tags if specified (post-query filter for complex tag logic)
      let filteredContacts = contacts || [];
      if (tagIds.length > 0) {
        filteredContacts = filteredContacts.filter(contact => {
          const contactTagIds = (contact.contact_tag_members || []).map(m => m.tag_id);
          return tagIds.some(tagId => contactTagIds.includes(tagId));
        });
      }

      // Filter by group if specified
      if (groupId) {
        const { data: groupMembers } = await supabaseService.queryAsAdmin('contact_group_members', 
          (q) => q.select('contact_id').eq('group_id', groupId)
        );
        const groupContactIds = (groupMembers || []).map(m => m.contact_id);
        filteredContacts = filteredContacts.filter(c => groupContactIds.includes(c.id));
      }

      // Format contacts
      const formattedContacts = filteredContacts.map(c => this.formatContact(c));

      return {
        data: formattedContacts,
        total: count || 0,
        page,
        pageSize: limit
      };
    } catch (error) {
      logger.error('Failed to get contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get contact by ID
   * @param {string} accountId - Account UUID
   * @param {string} contactId - Contact UUID
   * @returns {Promise<Object|null>}
   */
  async getContactById(accountId, contactId) {
    try {
      const queryFn = (query) => query
        .select(`
          *,
          contact_tag_members(tag_id, contact_tags(id, name, color)),
          contact_group_members(group_id, contact_groups(id, name))
        `)
        .eq('id', contactId)
        .eq('account_id', accountId)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return contact ? this.formatContactWithRelations(contact) : null;
    } catch (error) {
      logger.error('Failed to get contact by ID', { error: error.message, accountId, contactId });
      throw error;
    }
  }

  /**
   * Create a new contact
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} contactData - Contact data
   * @param {Object} createdBy - Creator info { id, type: 'account'|'agent' }
   * @returns {Promise<Object>}
   */
  async createContact(accountId, tenantId, contactData, createdBy) {
    try {
      // Validate phone uniqueness
      const existing = await this.getContactByPhone(accountId, contactData.phone);
      if (existing) {
        throw new Error('CONTACT_PHONE_EXISTS');
      }

      const data = {
        tenant_id: tenantId,
        account_id: accountId,
        phone: contactData.phone,
        name: contactData.name || null,
        avatar_url: contactData.avatarUrl || null,
        whatsapp_jid: contactData.whatsappJid || null,
        source: contactData.source || 'manual',
        metadata: contactData.metadata || {},
        created_by: createdBy.id,
        created_by_type: createdBy.type
      };

      const { data: contact, error } = await supabaseService.insert('contacts', data);

      if (error) {
        throw error;
      }

      logger.info('Contact created', { contactId: contact.id, accountId });

      return this.formatContact(contact);
    } catch (error) {
      logger.error('Failed to create contact', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a contact
   * @param {string} accountId - Account UUID
   * @param {string} contactId - Contact UUID
   * @param {Object} updates - Update data
   * @param {Object} updatedBy - Updater info { id, type: 'account'|'agent' }
   * @returns {Promise<Object>}
   */
  async updateContact(accountId, contactId, updates, updatedBy) {
    try {
      // Verify contact exists and belongs to account
      const existing = await this.getContactById(accountId, contactId);
      if (!existing) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // If phone is being updated, check uniqueness
      if (updates.phone && updates.phone !== existing.phone) {
        const phoneExists = await this.getContactByPhone(accountId, updates.phone);
        if (phoneExists) {
          throw new Error('CONTACT_PHONE_EXISTS');
        }
      }

      const data = {
        updated_at: new Date().toISOString(),
        updated_by: updatedBy.id,
        updated_by_type: updatedBy.type
      };

      if (updates.phone !== undefined) data.phone = updates.phone;
      if (updates.name !== undefined) data.name = updates.name;
      if (updates.avatarUrl !== undefined) data.avatar_url = updates.avatarUrl;
      if (updates.whatsappJid !== undefined) data.whatsapp_jid = updates.whatsappJid;
      if (updates.metadata !== undefined) data.metadata = updates.metadata;

      const { data: contact, error } = await supabaseService.update('contacts', contactId, data);

      if (error) {
        throw error;
      }

      logger.info('Contact updated', { contactId, accountId });

      return this.formatContact(contact);
    } catch (error) {
      logger.error('Failed to update contact', { error: error.message, accountId, contactId });
      throw error;
    }
  }

  /**
   * Delete multiple contacts
   * @param {string} accountId - Account UUID
   * @param {string[]} contactIds - Contact UUIDs to delete
   * @returns {Promise<{deleted: number}>}
   */
  async deleteContacts(accountId, contactIds) {
    try {
      if (!contactIds || contactIds.length === 0) {
        return { deleted: 0 };
      }

      const queryFn = (query) => query
        .delete()
        .eq('account_id', accountId)
        .in('id', contactIds);

      const { error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Contacts deleted', { count: contactIds.length, accountId });

      return { deleted: contactIds.length };
    } catch (error) {
      logger.error('Failed to delete contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get contact by phone number
   * @param {string} accountId - Account UUID
   * @param {string} phone - Phone number
   * @returns {Promise<Object|null>}
   */
  async getContactByPhone(accountId, phone) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .eq('phone', phone)
        .single();

      const { data: contact, error } = await supabaseService.queryAsAdmin('contacts', queryFn);

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return contact ? this.formatContact(contact) : null;
    } catch (error) {
      logger.error('Failed to get contact by phone', { error: error.message, accountId, phone });
      throw error;
    }
  }


  // ==================== IMPORT & MERGE ====================

  /**
   * Import contacts from WhatsApp (optimized batch processing)
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object[]} contacts - Contacts from WhatsApp
   * @param {Object} createdBy - Creator info { id, type }
   * @returns {Promise<{imported: number, updated: number, skipped: number}>}
   */
  async importFromWhatsApp(accountId, tenantId, contacts, createdBy) {
    try {
      logger.info('Starting WhatsApp import', { 
        accountId, 
        totalContacts: contacts.length 
      });

      // Step 1: Normalize and validate all contacts
      const normalizedContacts = [];
      let skipped = 0;

      for (const contact of contacts) {
        const phone = this.normalizePhone(contact.phone || contact.jid);
        
        // Skip invalid phones (empty, too short, or too long - likely group JIDs)
        if (!phone || phone.length < 8 || phone.length > 15) {
          skipped++;
          continue;
        }

        normalizedContacts.push({
          phone,
          name: contact.name || null,
          whatsappJid: contact.jid || null,
          avatarUrl: contact.avatarUrl || null,
          importHash: this.generateImportHash({
            phone,
            name: contact.name || null,
            whatsappJid: contact.jid || null,
            avatarUrl: contact.avatarUrl || null
          })
        });
      }

      logger.info('Contacts normalized', { 
        valid: normalizedContacts.length, 
        skipped 
      });

      if (normalizedContacts.length === 0) {
        return { imported: 0, updated: 0, skipped };
      }

      // Step 2: Fetch all existing contacts for this account in one query
      const existingQueryFn = (query) => query
        .select('id, phone, name, whatsapp_jid, avatar_url, import_hash')
        .eq('account_id', accountId);

      const { data: existingContacts, error: fetchError } = await supabaseService.queryAsAdmin('contacts', existingQueryFn);

      if (fetchError) {
        throw fetchError;
      }

      // Create a map for quick lookup
      const existingByPhone = new Map((existingContacts || []).map(c => [c.phone, c]));

      logger.info('Existing contacts fetched', { 
        existingCount: existingByPhone.size 
      });

      // Step 3: Separate contacts into new, updated, and unchanged
      const toInsert = [];
      const toUpdate = [];
      let unchanged = 0;
      const now = new Date().toISOString();

      for (const contact of normalizedContacts) {
        const existing = existingByPhone.get(contact.phone);

        if (existing) {
          // Check if data has changed using import hash
          if (existing.import_hash !== contact.importHash) {
            toUpdate.push({
              id: existing.id,
              name: contact.name,
              whatsapp_jid: contact.whatsappJid || existing.whatsapp_jid,
              avatar_url: contact.avatarUrl || existing.avatar_url,
              import_hash: contact.importHash,
              last_import_at: now,
              updated_at: now,
              updated_by: createdBy.id,
              updated_by_type: createdBy.type
            });
          } else {
            unchanged++;
          }
        } else {
          toInsert.push({
            tenant_id: tenantId,
            account_id: accountId,
            phone: contact.phone,
            name: contact.name,
            whatsapp_jid: contact.whatsappJid,
            avatar_url: contact.avatarUrl,
            source: 'whatsapp',
            import_hash: contact.importHash,
            last_import_at: now,
            metadata: { importedAt: now },
            created_by: createdBy.id,
            created_by_type: createdBy.type
          });
        }
      }

      logger.info('Contacts categorized', { 
        toInsert: toInsert.length, 
        toUpdate: toUpdate.length, 
        unchanged 
      });

      // Step 4: Batch insert new contacts
      let imported = 0;
      if (toInsert.length > 0) {
        // Insert in batches of 100 to avoid payload limits
        const BATCH_SIZE = 100;
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          
          const insertQueryFn = (query) => query
            .insert(batch)
            .select('id');

          const { data: insertedData, error: insertError } = await supabaseService.queryAsAdmin('contacts', insertQueryFn);

          if (insertError) {
            logger.warn('Batch insert error', { 
              error: insertError.message, 
              batchIndex: i / BATCH_SIZE,
              batchSize: batch.length
            });
            // Continue with next batch instead of failing completely
          } else {
            imported += (insertedData || []).length;
          }
        }
      }

      // Step 5: Batch update existing contacts
      let updated = 0;
      if (toUpdate.length > 0) {
        // Update in batches
        const BATCH_SIZE = 100;
        for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
          const batch = toUpdate.slice(i, i + BATCH_SIZE);
          
          for (const updateData of batch) {
            const { id, ...updates } = updateData;
            const { error: updateError } = await supabaseService.update('contacts', id, updates);
            
            if (!updateError) {
              updated++;
            } else {
              logger.warn('Contact update error', { 
                error: updateError.message, 
                contactId: id 
              });
              skipped++;
            }
          }
        }
      }

      logger.info('WhatsApp import completed', { 
        accountId, 
        added: imported, 
        updated, 
        unchanged,
        totalProcessed: normalizedContacts.length
      });

      return { added: imported, updated, unchanged: skipped };
    } catch (error) {
      logger.error('Failed to import from WhatsApp', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Merge contacts (used during import)
   * @param {string} accountId - Account UUID
   * @param {Object[]} newContacts - New contacts
   * @param {Object[]} existingContacts - Existing contacts
   * @returns {Promise<{toCreate: Object[], toUpdate: Object[]}>}
   */
  async mergeContacts(accountId, newContacts, existingContacts) {
    const existingByPhone = new Map(existingContacts.map(c => [c.phone, c]));
    const toCreate = [];
    const toUpdate = [];

    for (const newContact of newContacts) {
      const phone = this.normalizePhone(newContact.phone);
      if (!phone) continue;

      const existing = existingByPhone.get(phone);

      if (existing) {
        // Check if update is needed
        if (newContact.name && newContact.name !== existing.name) {
          toUpdate.push({
            id: existing.id,
            updates: {
              name: newContact.name,
              whatsappJid: newContact.whatsappJid || existing.whatsappJid
            }
          });
        }
      } else {
        toCreate.push({
          phone,
          name: newContact.name,
          whatsappJid: newContact.whatsappJid,
          avatarUrl: newContact.avatarUrl,
          source: newContact.source || 'import'
        });
      }
    }

    return { toCreate, toUpdate };
  }

  // ==================== TAGS ====================

  /**
   * Get all tags for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object[]>}
   */
  async getTags(accountId) {
    try {
      const queryFn = (query) => query
        .select('*')
        .eq('account_id', accountId)
        .order('name', { ascending: true });

      const { data: tags, error } = await supabaseService.queryAsAdmin('contact_tags', queryFn);

      if (error) {
        throw error;
      }

      return (tags || []).map(t => this.formatTag(t));
    } catch (error) {
      logger.error('Failed to get tags', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create a new tag
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} tagData - Tag data { name, color }
   * @returns {Promise<Object>}
   */
  async createTag(accountId, tenantId, tagData) {
    try {
      // Check for duplicate name
      const queryFn = (query) => query
        .select('id')
        .eq('account_id', accountId)
        .eq('name', tagData.name)
        .single();

      const { data: existing } = await supabaseService.queryAsAdmin('contact_tags', queryFn);

      if (existing) {
        throw new Error('TAG_NAME_EXISTS');
      }

      const data = {
        tenant_id: tenantId,
        account_id: accountId,
        name: tagData.name,
        color: tagData.color || '#1f93ff'
      };

      const { data: tag, error } = await supabaseService.insert('contact_tags', data);

      if (error) {
        throw error;
      }

      logger.info('Tag created', { tagId: tag.id, accountId });

      return this.formatTag(tag);
    } catch (error) {
      logger.error('Failed to create tag', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Delete a tag
   * @param {string} accountId - Account UUID
   * @param {string} tagId - Tag UUID
   * @returns {Promise<void>}
   */
  async deleteTag(accountId, tagId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('id', tagId)
        .eq('account_id', accountId);

      const { error } = await supabaseService.queryAsAdmin('contact_tags', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Tag deleted', { tagId, accountId });
    } catch (error) {
      logger.error('Failed to delete tag', { error: error.message, accountId, tagId });
      throw error;
    }
  }

  /**
   * Add tags to contacts
   * @param {string} accountId - Account UUID
   * @param {string[]} contactIds - Contact UUIDs
   * @param {string[]} tagIds - Tag UUIDs
   * @returns {Promise<{added: number}>}
   */
  async addTagsToContacts(accountId, contactIds, tagIds) {
    try {
      let added = 0;

      for (const contactId of contactIds) {
        // Verify contact belongs to account
        const contact = await this.getContactById(accountId, contactId);
        if (!contact) continue;

        for (const tagId of tagIds) {
          try {
            // Check if already exists
            const queryFn = (query) => query
              .select('id')
              .eq('contact_id', contactId)
              .eq('tag_id', tagId)
              .single();

            const { data: existing } = await supabaseService.queryAsAdmin('contact_tag_members', queryFn);

            if (!existing) {
              await supabaseService.insert('contact_tag_members', {
                contact_id: contactId,
                tag_id: tagId
              });
              added++;
            }
          } catch (tagError) {
            // Ignore duplicate errors
            if (!tagError.message?.includes('duplicate')) {
              logger.warn('Failed to add tag to contact', { 
                error: tagError.message, 
                contactId, 
                tagId 
              });
            }
          }
        }
      }

      logger.info('Tags added to contacts', { added, accountId });

      return { added };
    } catch (error) {
      logger.error('Failed to add tags to contacts', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Remove tags from contacts
   * @param {string} accountId - Account UUID
   * @param {string[]} contactIds - Contact UUIDs
   * @param {string[]} tagIds - Tag UUIDs
   * @returns {Promise<{removed: number}>}
   */
  async removeTagsFromContacts(accountId, contactIds, tagIds) {
    try {
      const queryFn = (query) => query
        .delete()
        .in('contact_id', contactIds)
        .in('tag_id', tagIds);

      const { error } = await supabaseService.queryAsAdmin('contact_tag_members', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Tags removed from contacts', { accountId });

      return { removed: contactIds.length * tagIds.length };
    } catch (error) {
      logger.error('Failed to remove tags from contacts', { error: error.message, accountId });
      throw error;
    }
  }


  // ==================== GROUPS ====================

  /**
   * Get all groups for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Object[]>}
   */
  async getGroups(accountId) {
    try {
      const queryFn = (query) => query
        .select('*, contact_group_members(count)')
        .eq('account_id', accountId)
        .order('name', { ascending: true });

      const { data: groups, error } = await supabaseService.queryAsAdmin('contact_groups', queryFn);

      if (error) {
        throw error;
      }

      return (groups || []).map(g => this.formatGroup(g));
    } catch (error) {
      logger.error('Failed to get groups', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Create a new group
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} groupData - Group data { name, description }
   * @returns {Promise<Object>}
   */
  async createGroup(accountId, tenantId, groupData) {
    try {
      // Check for duplicate name
      const queryFn = (query) => query
        .select('id')
        .eq('account_id', accountId)
        .eq('name', groupData.name)
        .single();

      const { data: existing } = await supabaseService.queryAsAdmin('contact_groups', queryFn);

      if (existing) {
        throw new Error('GROUP_NAME_EXISTS');
      }

      const data = {
        tenant_id: tenantId,
        account_id: accountId,
        name: groupData.name,
        description: groupData.description || null
      };

      const { data: group, error } = await supabaseService.insert('contact_groups', data);

      if (error) {
        throw error;
      }

      logger.info('Group created', { groupId: group.id, accountId });

      return this.formatGroup(group);
    } catch (error) {
      logger.error('Failed to create group', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Update a group
   * @param {string} accountId - Account UUID
   * @param {string} groupId - Group UUID
   * @param {Object} updates - Update data { name, description }
   * @returns {Promise<Object>}
   */
  async updateGroup(accountId, groupId, updates) {
    try {
      // Verify group exists and belongs to account
      const queryFn = (query) => query
        .select('*')
        .eq('id', groupId)
        .eq('account_id', accountId)
        .single();

      const { data: existing, error: fetchError } = await supabaseService.queryAsAdmin('contact_groups', queryFn);

      if (fetchError || !existing) {
        throw new Error('GROUP_NOT_FOUND');
      }

      // Check for duplicate name if name is being updated
      if (updates.name && updates.name !== existing.name) {
        const nameCheckFn = (query) => query
          .select('id')
          .eq('account_id', accountId)
          .eq('name', updates.name)
          .neq('id', groupId)
          .single();

        const { data: duplicate } = await supabaseService.queryAsAdmin('contact_groups', nameCheckFn);

        if (duplicate) {
          throw new Error('GROUP_NAME_EXISTS');
        }
      }

      const data = {
        updated_at: new Date().toISOString()
      };

      if (updates.name !== undefined) data.name = updates.name;
      if (updates.description !== undefined) data.description = updates.description;

      const { data: group, error } = await supabaseService.update('contact_groups', groupId, data);

      if (error) {
        throw error;
      }

      logger.info('Group updated', { groupId, accountId });

      return this.formatGroup(group);
    } catch (error) {
      logger.error('Failed to update group', { error: error.message, accountId, groupId });
      throw error;
    }
  }

  /**
   * Delete a group
   * @param {string} accountId - Account UUID
   * @param {string} groupId - Group UUID
   * @returns {Promise<void>}
   */
  async deleteGroup(accountId, groupId) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('id', groupId)
        .eq('account_id', accountId);

      const { error } = await supabaseService.queryAsAdmin('contact_groups', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Group deleted', { groupId, accountId });
    } catch (error) {
      logger.error('Failed to delete group', { error: error.message, accountId, groupId });
      throw error;
    }
  }

  /**
   * Add contacts to a group
   * @param {string} accountId - Account UUID
   * @param {string} groupId - Group UUID
   * @param {string[]} contactIds - Contact UUIDs
   * @returns {Promise<{added: number}>}
   */
  async addContactsToGroup(accountId, groupId, contactIds) {
    try {
      // Verify group belongs to account
      const queryFn = (query) => query
        .select('id')
        .eq('id', groupId)
        .eq('account_id', accountId)
        .single();

      const { data: group } = await supabaseService.queryAsAdmin('contact_groups', queryFn);

      if (!group) {
        throw new Error('GROUP_NOT_FOUND');
      }

      let added = 0;

      for (const contactId of contactIds) {
        try {
          // Check if already exists
          const memberCheckFn = (query) => query
            .select('id')
            .eq('group_id', groupId)
            .eq('contact_id', contactId)
            .single();

          const { data: existing } = await supabaseService.queryAsAdmin('contact_group_members', memberCheckFn);

          if (!existing) {
            await supabaseService.insert('contact_group_members', {
              group_id: groupId,
              contact_id: contactId
            });
            added++;
          }
        } catch (memberError) {
          // Ignore duplicate errors
          if (!memberError.message?.includes('duplicate')) {
            logger.warn('Failed to add contact to group', { 
              error: memberError.message, 
              contactId, 
              groupId 
            });
          }
        }
      }

      logger.info('Contacts added to group', { added, groupId, accountId });

      return { added };
    } catch (error) {
      logger.error('Failed to add contacts to group', { error: error.message, accountId, groupId });
      throw error;
    }
  }

  /**
   * Remove contacts from a group
   * @param {string} accountId - Account UUID
   * @param {string} groupId - Group UUID
   * @param {string[]} contactIds - Contact UUIDs
   * @returns {Promise<{removed: number}>}
   */
  async removeContactsFromGroup(accountId, groupId, contactIds) {
    try {
      const queryFn = (query) => query
        .delete()
        .eq('group_id', groupId)
        .in('contact_id', contactIds);

      const { error } = await supabaseService.queryAsAdmin('contact_group_members', queryFn);

      if (error) {
        throw error;
      }

      logger.info('Contacts removed from group', { groupId, accountId });

      return { removed: contactIds.length };
    } catch (error) {
      logger.error('Failed to remove contacts from group', { error: error.message, accountId, groupId });
      throw error;
    }
  }

  // ==================== MIGRATION ====================

  /**
   * Migrate contacts from localStorage data
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {Object} localStorageData - Data from localStorage
   * @returns {Promise<{contacts: number, tags: number, groups: number, errors: string[]}>}
   */
  async migrateFromLocalStorage(accountId, tenantId, localStorageData) {
    try {
      const result = {
        contacts: 0,
        tags: 0,
        groups: 0,
        errors: []
      };

      const createdBy = { id: accountId, type: 'account' };

      // Migrate tags first
      const tagIdMap = new Map(); // old id -> new id
      if (localStorageData.tags && Array.isArray(localStorageData.tags)) {
        for (const tag of localStorageData.tags) {
          try {
            const newTag = await this.createTag(accountId, tenantId, {
              name: tag.name,
              color: tag.color
            });
            tagIdMap.set(tag.id, newTag.id);
            result.tags++;
          } catch (tagError) {
            if (tagError.message !== 'TAG_NAME_EXISTS') {
              result.errors.push(`Tag "${tag.name}": ${tagError.message}`);
            }
          }
        }
      }

      // Migrate groups
      const groupIdMap = new Map(); // old id -> new id
      if (localStorageData.groups && Array.isArray(localStorageData.groups)) {
        for (const group of localStorageData.groups) {
          try {
            const newGroup = await this.createGroup(accountId, tenantId, {
              name: group.name,
              description: group.description
            });
            groupIdMap.set(group.id, newGroup.id);
            result.groups++;
          } catch (groupError) {
            if (groupError.message !== 'GROUP_NAME_EXISTS') {
              result.errors.push(`Group "${group.name}": ${groupError.message}`);
            }
          }
        }
      }

      // Migrate contacts
      if (localStorageData.contacts && Array.isArray(localStorageData.contacts)) {
        for (const contact of localStorageData.contacts) {
          try {
            const newContact = await this.createContact(accountId, tenantId, {
              phone: contact.phone,
              name: contact.name,
              avatarUrl: contact.avatarUrl,
              whatsappJid: contact.whatsappJid || contact.jid,
              source: contact.source || 'import',
              metadata: contact.metadata || {}
            }, createdBy);

            // Assign tags
            if (contact.tagIds && contact.tagIds.length > 0) {
              const newTagIds = contact.tagIds
                .map(oldId => tagIdMap.get(oldId))
                .filter(Boolean);
              if (newTagIds.length > 0) {
                await this.addTagsToContacts(accountId, [newContact.id], newTagIds);
              }
            }

            // Assign to groups
            if (contact.groupIds && contact.groupIds.length > 0) {
              for (const oldGroupId of contact.groupIds) {
                const newGroupId = groupIdMap.get(oldGroupId);
                if (newGroupId) {
                  await this.addContactsToGroup(accountId, newGroupId, [newContact.id]);
                }
              }
            }

            result.contacts++;
          } catch (contactError) {
            if (contactError.message !== 'CONTACT_PHONE_EXISTS') {
              result.errors.push(`Contact "${contact.phone}": ${contactError.message}`);
            }
          }
        }
      }

      logger.info('localStorage migration completed', { 
        accountId, 
        contacts: result.contacts,
        tags: result.tags,
        groups: result.groups,
        errors: result.errors.length
      });

      return result;
    } catch (error) {
      logger.error('Failed to migrate from localStorage', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== USER CREATION ====================

  /**
   * Create a user from a contact
   * @param {string} accountId - Account UUID
   * @param {string} contactId - Contact UUID
   * @param {Object} userData - User data { email, password, name }
   * @returns {Promise<Object>}
   */
  async createUserFromContact(accountId, contactId, userData) {
    try {
      // Get contact
      const contact = await this.getContactById(accountId, contactId);
      if (!contact) {
        throw new Error('CONTACT_NOT_FOUND');
      }

      // Get account to get tenant_id
      const { data: account, error: accountError } = await supabaseService.getById('accounts', accountId);
      if (accountError || !account) {
        throw new Error('ACCOUNT_NOT_FOUND');
      }

      // Create user using UserService
      const UserService = require('./UserService');
      const user = await UserService.createUser(account.tenant_id, {
        email: userData.email,
        password: userData.password,
        name: userData.name || contact.name
      });

      // Link contact to user
      await supabaseService.update('contacts', contactId, {
        linked_user_id: user.id,
        updated_at: new Date().toISOString()
      });

      logger.info('User created from contact', { userId: user.id, contactId, accountId });

      return user;
    } catch (error) {
      logger.error('Failed to create user from contact', { error: error.message, accountId, contactId });
      throw error;
    }
  }

  // ==================== STATS ====================

  /**
   * Get contact statistics for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<{total: number, withName: number, withoutName: number, totalTags: number}>}
   */
  async getStats(accountId) {
    try {
      // Get contact counts
      const contactsQueryFn = (query) => query
        .select('id, name', { count: 'exact' })
        .eq('account_id', accountId);

      const { data: contacts, count, error: contactsError } = await supabaseService.queryAsAdmin('contacts', contactsQueryFn);

      if (contactsError) {
        throw contactsError;
      }

      const total = count || 0;
      const withName = (contacts || []).filter(c => c.name && c.name.trim() !== '').length;
      
      // For large datasets, we need to count from the full result
      // Since we're getting all contacts anyway for the name check, use that
      // But if total > 1000, we should use a more efficient query
      let actualWithName = withName;
      let actualWithoutName = total - withName;

      if (total > 1000) {
        // Use a more efficient count query for large datasets
        const withNameQueryFn = (query) => query
          .select('id', { count: 'exact', head: true })
          .eq('account_id', accountId)
          .not('name', 'is', null)
          .neq('name', '');

        const { count: withNameCount } = await supabaseService.queryAsAdmin('contacts', withNameQueryFn);
        actualWithName = withNameCount || 0;
        actualWithoutName = total - actualWithName;
      }

      // Get tags count
      const tagsQueryFn = (query) => query
        .select('id', { count: 'exact', head: true })
        .eq('account_id', accountId);

      const { count: tagsCount } = await supabaseService.queryAsAdmin('contact_tags', tagsQueryFn);

      return {
        total,
        withName: actualWithName,
        withoutName: actualWithoutName,
        totalTags: tagsCount || 0
      };
    } catch (error) {
      logger.error('Failed to get contact stats', { error: error.message, accountId });
      throw error;
    }
  }

  // ==================== HELPERS ====================

  /**
   * Normalize phone number
   * @param {string} phone - Phone number or JID
   * @returns {string|null}
   */
  normalizePhone(phone) {
    if (!phone) return null;
    
    // Remove @s.whatsapp.net suffix if present
    let normalized = phone.replace(/@s\.whatsapp\.net$/, '');
    
    // Remove all non-numeric characters
    normalized = normalized.replace(/\D/g, '');
    
    // Return null if empty
    if (!normalized) return null;
    
    return normalized;
  }

  /**
   * Format contact from database row
   * @param {Object} row - Database row
   * @returns {Object}
   */
  formatContact(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      phone: row.phone,
      name: row.name,
      avatarUrl: row.avatar_url,
      whatsappJid: row.whatsapp_jid,
      source: row.source,
      sourceInboxId: row.source_inbox_id,
      sourceInbox: row.source_inbox ? {
        id: row.source_inbox.id,
        name: row.source_inbox.name,
        phoneNumber: row.source_inbox.phone_number
      } : null,
      linkedUserId: row.linked_user_id,
      metadata: row.metadata || {},
      lastImportAt: row.last_import_at,
      createdBy: row.created_by,
      createdByType: row.created_by_type,
      updatedBy: row.updated_by,
      updatedByType: row.updated_by_type,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format contact with relations
   * @param {Object} row - Database row with joins
   * @returns {Object}
   */
  formatContactWithRelations(row) {
    const contact = this.formatContact(row);

    // Add tags
    contact.tags = (row.contact_tag_members || [])
      .filter(m => m.contact_tags)
      .map(m => ({
        id: m.contact_tags.id,
        name: m.contact_tags.name,
        color: m.contact_tags.color
      }));

    // Add groups
    contact.groups = (row.contact_group_members || [])
      .filter(m => m.contact_groups)
      .map(m => ({
        id: m.contact_groups.id,
        name: m.contact_groups.name
      }));

    return contact;
  }

  /**
   * Format tag from database row
   * @param {Object} row - Database row
   * @returns {Object}
   */
  formatTag(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      name: row.name,
      color: row.color,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Format group from database row
   * @param {Object} row - Database row
   * @returns {Object}
   */
  formatGroup(row) {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      accountId: row.account_id,
      name: row.name,
      description: row.description,
      contactCount: row.contact_group_members?.[0]?.count || 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  }

  /**
   * Import contacts from a specific inbox
   * @param {string} accountId - Account UUID
   * @param {string} tenantId - Tenant UUID
   * @param {string} inboxId - Inbox UUID to import from
   * @param {Object} createdBy - Creator info { id, type: 'account'|'agent' }
   * @returns {Promise<{added: number, updated: number, unchanged: number}>}
   */
  async importFromInbox(accountId, tenantId, inboxId, createdBy) {
    try {
      logger.info('Starting inbox import', { 
        accountId, 
        inboxId 
      });

      // Step 1: Validate inbox belongs to account and is connected
      const { data: inbox, error: inboxError } = await supabaseService.getById('inboxes', inboxId);
      
      if (inboxError || !inbox) {
        throw new Error('INBOX_NOT_FOUND');
      }

      if (inbox.account_id !== accountId) {
        throw new Error('INBOX_ACCESS_DENIED');
      }

      if (!inbox.wuzapi_connected) {
        throw new Error('INBOX_NOT_CONNECTED');
      }

      // Step 2: Fetch contacts from WUZAPI using inbox token
      const wuzapiClient = require('../utils/wuzapiClient');
      const wuzapiContacts = await wuzapiClient.getContacts(inbox.wuzapi_token);

      logger.info('Contacts fetched from WUZAPI', { 
        inboxId,
        totalContacts: wuzapiContacts.length 
      });

      // Step 3: Normalize and validate contacts with import hash
      const normalizedContacts = [];
      let skipped = 0;

      for (const contact of wuzapiContacts) {
        const phone = this.normalizePhone(contact.phone || contact.jid);
        
        // Skip invalid phones
        if (!phone || phone.length < 8 || phone.length > 15) {
          skipped++;
          continue;
        }

        const contactData = {
          phone,
          name: contact.name || null,
          whatsappJid: contact.jid || null,
          avatarUrl: contact.avatarUrl || null
        };

        // Generate import hash for change detection
        const importHash = this.generateImportHash(contactData);

        normalizedContacts.push({
          ...contactData,
          importHash
        });
      }

      logger.info('Contacts normalized', { 
        valid: normalizedContacts.length, 
        skipped 
      });

      if (normalizedContacts.length === 0) {
        return { added: 0, updated: 0, unchanged: 0 };
      }

      // Step 4: Fetch existing contacts for this account
      const existingQueryFn = (query) => query
        .select('id, phone, name, whatsapp_jid, avatar_url, import_hash, source_inbox_id')
        .eq('account_id', accountId);

      const { data: existingContacts, error: fetchError } = await supabaseService.queryAsAdmin('contacts', existingQueryFn);

      if (fetchError) {
        throw fetchError;
      }

      const existingByPhone = new Map((existingContacts || []).map(c => [c.phone, c]));

      // Step 5: Categorize contacts (new, updated, unchanged)
      const toInsert = [];
      const toUpdate = [];
      let unchanged = 0;
      const now = new Date().toISOString();

      for (const contact of normalizedContacts) {
        const existing = existingByPhone.get(contact.phone);

        if (existing) {
          // Check if data has changed using import hash
          if (existing.import_hash !== contact.importHash) {
            toUpdate.push({
              id: existing.id,
              name: contact.name,
              whatsapp_jid: contact.whatsappJid || existing.whatsapp_jid,
              avatar_url: contact.avatarUrl || existing.avatar_url,
              import_hash: contact.importHash,
              source_inbox_id: inboxId,
              last_import_at: now,
              updated_at: now,
              updated_by: createdBy.id,
              updated_by_type: createdBy.type
            });
          } else {
            unchanged++;
          }
        } else {
          toInsert.push({
            tenant_id: tenantId,
            account_id: accountId,
            phone: contact.phone,
            name: contact.name,
            whatsapp_jid: contact.whatsappJid,
            avatar_url: contact.avatarUrl,
            source: 'whatsapp',
            source_inbox_id: inboxId,
            import_hash: contact.importHash,
            last_import_at: now,
            metadata: { importedAt: now, inboxId },
            created_by: createdBy.id,
            created_by_type: createdBy.type
          });
        }
      }

      logger.info('Contacts categorized', { 
        toInsert: toInsert.length, 
        toUpdate: toUpdate.length, 
        unchanged 
      });

      // Step 6: Batch insert new contacts
      let added = 0;
      if (toInsert.length > 0) {
        const BATCH_SIZE = 100;
        for (let i = 0; i < toInsert.length; i += BATCH_SIZE) {
          const batch = toInsert.slice(i, i + BATCH_SIZE);
          
          const insertQueryFn = (query) => query
            .insert(batch)
            .select('id');

          const { data: insertedData, error: insertError } = await supabaseService.queryAsAdmin('contacts', insertQueryFn);

          if (insertError) {
            logger.warn('Batch insert error', { 
              error: insertError.message, 
              batchIndex: i / BATCH_SIZE,
              batchSize: batch.length
            });
          } else {
            added += (insertedData || []).length;
          }
        }
      }

      // Step 7: Batch update existing contacts
      let updated = 0;
      if (toUpdate.length > 0) {
        for (const updateData of toUpdate) {
          const { id, ...updates } = updateData;
          const { error: updateError } = await supabaseService.update('contacts', id, updates);
          
          if (!updateError) {
            updated++;
          } else {
            logger.warn('Contact update error', { 
              error: updateError.message, 
              contactId: id 
            });
          }
        }
      }

      logger.info('Inbox import completed', { 
        accountId, 
        inboxId,
        added, 
        updated, 
        unchanged,
        totalProcessed: normalizedContacts.length
      });

      return { added, updated, unchanged };
    } catch (error) {
      logger.error('Failed to import from inbox', { 
        error: error.message, 
        accountId, 
        inboxId 
      });
      throw error;
    }
  }

  /**
   * Generate import hash for change detection
   * @param {Object} contactData - Contact data
   * @returns {string} - SHA-256 hash
   */
  generateImportHash(contactData) {
    const crypto = require('crypto');
    const hashData = {
      phone: contactData.phone,
      name: contactData.name || '',
      whatsappJid: contactData.whatsappJid || '',
      avatarUrl: contactData.avatarUrl || ''
    };
    
    const hashString = JSON.stringify(hashData);
    return crypto.createHash('sha256').update(hashString).digest('hex').substring(0, 64);
  }

  /**
   * Merge duplicate contacts into a single contact
   * @param {string} accountId - Account UUID
   * @param {string[]} contactIds - Array of contact IDs to merge
   * @param {Object} mergeData - Merge configuration
   * @param {Object} mergedBy - User who performed the merge
   * @returns {Promise<Object>} - Merged contact
   */
  async mergeContactsForDuplicates(accountId, contactIds, mergeData, mergedBy) {
    try {
      logger.info('Starting contact merge', { 
        accountId, 
        contactIds, 
        mergedBy: mergedBy.id 
      });

      if (!contactIds || contactIds.length < 2) {
        throw new Error('At least 2 contacts required for merge');
      }

      // Start transaction
      const { data: contacts, error: fetchError } = await supabaseService.queryAsAdmin(
        'contacts',
        (query) => query
          .select(`
            *,
            contact_tag_members(tag_id),
            contact_group_members(group_id)
          `)
          .in('id', contactIds)
          .eq('account_id', accountId)
      );

      if (fetchError) throw fetchError;

      if (!contacts || contacts.length !== contactIds.length) {
        throw new Error('One or more contacts not found or access denied');
      }

      // Determine primary contact (first in the list or specified)
      const primaryContactId = mergeData.primaryContactId || contactIds[0];
      const primaryContact = contacts.find(c => c.id === primaryContactId);
      
      if (!primaryContact) {
        throw new Error('Primary contact not found');
      }

      // Collect all tags and groups from all contacts
      const allTagIds = new Set();
      const allGroupIds = new Set();

      contacts.forEach(contact => {
        (contact.contact_tag_members || []).forEach(tm => allTagIds.add(tm.tag_id));
        (contact.contact_group_members || []).forEach(gm => allGroupIds.add(gm.group_id));
      });

      // Prepare merged contact data
      const mergedContactData = {
        name: mergeData.name || primaryContact.name,
        phone: mergeData.phone || primaryContact.phone,
        avatar_url: mergeData.avatarUrl || primaryContact.avatar_url,
        whatsapp_jid: mergeData.whatsappJid || primaryContact.whatsapp_jid,
        metadata: {
          ...primaryContact.metadata,
          ...mergeData.metadata,
          mergedAt: new Date().toISOString(),
          mergedFrom: contactIds.filter(id => id !== primaryContactId)
        },
        updated_at: new Date().toISOString(),
        updated_by: mergedBy.id,
        updated_by_type: mergedBy.type
      };

      // Update primary contact with merged data
      const { data: updatedContact, error: updateError } = await supabaseService.update(
        'contacts', 
        primaryContactId, 
        mergedContactData
      );

      if (updateError) throw updateError;

      // Add all tags to primary contact (if preserveTags is true)
      if (mergeData.preserveTags !== false && allTagIds.size > 0) {
        // Remove existing tag memberships for primary contact
        await supabaseService.queryAsAdmin(
          'contact_tag_members',
          (query) => query.delete().eq('contact_id', primaryContactId)
        );

        // Add all collected tags
        const tagMemberships = Array.from(allTagIds).map(tagId => ({
          contact_id: primaryContactId,
          tag_id: tagId
        }));

        if (tagMemberships.length > 0) {
          await supabaseService.queryAsAdmin(
            'contact_tag_members',
            (query) => query.insert(tagMemberships)
          );
        }
      }

      // Add all groups to primary contact (if preserveGroups is true)
      if (mergeData.preserveGroups !== false && allGroupIds.size > 0) {
        // Remove existing group memberships for primary contact
        await supabaseService.queryAsAdmin(
          'contact_group_members',
          (query) => query.delete().eq('contact_id', primaryContactId)
        );

        // Add all collected groups
        const groupMemberships = Array.from(allGroupIds).map(groupId => ({
          contact_id: primaryContactId,
          group_id: groupId
        }));

        if (groupMemberships.length > 0) {
          await supabaseService.queryAsAdmin(
            'contact_group_members',
            (query) => query.insert(groupMemberships)
          );
        }
      }

      // Create audit log entry
      const auditData = {
        account_id: accountId,
        merged_contact_id: primaryContactId,
        source_contact_ids: contactIds,
        merge_data: {
          mergeConfiguration: mergeData,
          originalContacts: contacts.map(c => ({
            id: c.id,
            name: c.name,
            phone: c.phone,
            avatar_url: c.avatar_url,
            tags: (c.contact_tag_members || []).map(tm => tm.tag_id),
            groups: (c.contact_group_members || []).map(gm => gm.group_id)
          }))
        },
        merged_by: mergedBy.id
      };

      const { error: auditError } = await supabaseService.insert('contact_merge_audit', auditData);
      if (auditError) {
        logger.warn('Failed to create audit log', { error: auditError.message });
      }

      // Delete source contacts (except primary)
      const contactsToDelete = contactIds.filter(id => id !== primaryContactId);
      if (contactsToDelete.length > 0) {
        const { error: deleteError } = await supabaseService.queryAsAdmin(
          'contacts',
          (query) => query.delete().in('id', contactsToDelete)
        );

        if (deleteError) throw deleteError;
      }

      logger.info('Contact merge completed', { 
        accountId, 
        mergedContactId: primaryContactId,
        deletedContacts: contactsToDelete.length,
        preservedTags: allTagIds.size,
        preservedGroups: allGroupIds.size
      });

      // Return the merged contact with relations
      return this.getContactById(accountId, primaryContactId);
    } catch (error) {
      logger.error('Failed to merge contacts', { 
        error: error.message, 
        accountId, 
        contactIds 
      });
      throw error;
    }
  }

  /**
   * Dismiss a duplicate pair (mark as false positive)
   * @param {string} accountId - Account UUID
   * @param {string} contactId1 - First contact ID
   * @param {string} contactId2 - Second contact ID
   * @param {Object} dismissedBy - User who dismissed the duplicate
   * @returns {Promise<void>}
   */
  async dismissDuplicate(accountId, contactId1, contactId2, dismissedBy) {
    try {
      logger.info('Dismissing duplicate pair', { 
        accountId, 
        contactId1, 
        contactId2,
        dismissedBy: dismissedBy.id 
      });

      // Ensure consistent ordering (smaller UUID first)
      const orderedIds = [contactId1, contactId2].sort();
      
      // Verify both contacts belong to the account
      const { data: contacts, error: fetchError } = await supabaseService.queryAsAdmin(
        'contacts',
        (query) => query
          .select('id, account_id')
          .in('id', orderedIds)
          .eq('account_id', accountId)
      );

      if (fetchError) throw fetchError;

      if (!contacts || contacts.length !== 2) {
        throw new Error('One or more contacts not found or access denied');
      }

      // Insert dismissal record
      const dismissalData = {
        account_id: accountId,
        contact_id_1: orderedIds[0],
        contact_id_2: orderedIds[1],
        dismissed_by: dismissedBy.id
      };

      const { error: insertError } = await supabaseService.insert(
        'contact_duplicate_dismissals', 
        dismissalData
      );

      // Handle unique constraint violation (already dismissed)
      if (insertError && insertError.code === '23505') {
        logger.info('Duplicate pair already dismissed', { 
          accountId, 
          contactId1: orderedIds[0], 
          contactId2: orderedIds[1] 
        });
        return; // Not an error, just already dismissed
      }

      if (insertError) throw insertError;

      logger.info('Duplicate pair dismissed', { 
        accountId, 
        contactId1: orderedIds[0], 
        contactId2: orderedIds[1] 
      });
    } catch (error) {
      logger.error('Failed to dismiss duplicate', { 
        error: error.message, 
        accountId, 
        contactId1, 
        contactId2 
      });
      throw error;
    }
  }

  // ==================== DUPLICATES & MERGE ====================

  /**
   * Get duplicate contact sets for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Array>} - Array of duplicate sets
   */
  async getDuplicates(accountId) {
    try {
      logger.info('Getting duplicates', { accountId });

      const DuplicateDetector = require('./DuplicateDetector');
      
      // Get all duplicate sets
      const allDuplicates = await DuplicateDetector.detectAll(accountId);

      // Filter out dismissed pairs
      const { data: dismissals, error: dismissalError } = await supabaseService.queryAsAdmin(
        'contact_duplicate_dismissals',
        (query) => query.select('contact_id_1, contact_id_2').eq('account_id', accountId)
      );

      if (dismissalError) {
        logger.warn('Failed to fetch dismissals', { error: dismissalError.message, accountId });
      }

      const dismissedPairs = new Set();
      (dismissals || []).forEach(d => {
        const key = `${d.contact_id_1}_${d.contact_id_2}`;
        dismissedPairs.add(key);
      });

      // Filter out dismissed duplicates
      const filteredDuplicates = allDuplicates.filter(duplicateSet => {
        // Check if any pair in this set has been dismissed
        for (let i = 0; i < duplicateSet.contacts.length; i++) {
          for (let j = i + 1; j < duplicateSet.contacts.length; j++) {
            const id1 = duplicateSet.contacts[i].id;
            const id2 = duplicateSet.contacts[j].id;
            const key1 = `${id1}_${id2}`;
            const key2 = `${id2}_${id1}`;
            
            if (dismissedPairs.has(key1) || dismissedPairs.has(key2)) {
              return false; // This set has been dismissed
            }
          }
        }
        return true;
      });

      logger.info('Duplicates retrieved', { 
        accountId, 
        totalSets: allDuplicates.length,
        filteredSets: filteredDuplicates.length,
        dismissedCount: allDuplicates.length - filteredDuplicates.length
      });

      return filteredDuplicates;
    } catch (error) {
      logger.error('Failed to get duplicates', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }

  // ==================== INBOX SELECTION ====================

  /**
   * Get available inboxes for an account
   * @param {string} accountId - Account UUID
   * @returns {Promise<Array>} - Array of inbox options
   */
  async getAccountInboxes(accountId) {
    try {
      const queryFn = (query) => query
        .select('id, name, phone_number, wuzapi_connected, created_at')
        .eq('account_id', accountId)
        .order('created_at', { ascending: true });

      const { data: inboxes, error } = await supabaseService.queryAsAdmin('inboxes', queryFn);

      if (error) {
        throw error;
      }

      // Format inboxes for selection
      const formattedInboxes = (inboxes || []).map(inbox => ({
        id: inbox.id,
        name: inbox.name || `Inbox ${inbox.phone_number}`,
        phoneNumber: inbox.phone_number,
        isConnected: inbox.wuzapi_connected || false,
        lastImportAt: null // Will be populated from contact metadata if needed
      }));

      logger.info('Retrieved account inboxes', { 
        accountId, 
        inboxCount: formattedInboxes.length,
        connectedCount: formattedInboxes.filter(i => i.isConnected).length
      });

      return formattedInboxes;
    } catch (error) {
      logger.error('Failed to get account inboxes', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }
}

module.exports = new ContactsService();
