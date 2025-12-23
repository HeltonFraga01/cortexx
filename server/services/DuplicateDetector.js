/**
 * DuplicateDetector Service
 * Detects duplicate contacts based on phone numbers and name similarity
 * Requirements: 3.1, 3.2, 3.3
 */

const SupabaseService = require('./SupabaseService');
const { logger } = require('../utils/logger');

class DuplicateDetector {
  /**
   * Normalizes phone number for comparison
   * Removes all non-digit characters
   * @param {string} phone - Phone number to normalize
   * @returns {string} - Normalized phone number (digits only)
   */
  static normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return '';
    return phone.replace(/[^0-9]/g, '');
  }

  /**
   * Calculates name similarity using Jaro-Winkler algorithm
   * @param {string} name1 - First name
   * @param {string} name2 - Second name
   * @returns {number} - Similarity score between 0 and 1
   */
  static calculateNameSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    if (name1 === name2) return 1;

    // Convert to lowercase for comparison
    const s1 = name1.toLowerCase().trim();
    const s2 = name2.toLowerCase().trim();

    if (s1 === s2) return 1;
    if (s1.length === 0 || s2.length === 0) return 0;

    // Jaro similarity
    const jaroSimilarity = this._calculateJaro(s1, s2);
    
    // Jaro-Winkler adds prefix bonus
    const prefixLength = this._getCommonPrefixLength(s1, s2, 4);
    const jaroWinkler = jaroSimilarity + (0.1 * prefixLength * (1 - jaroSimilarity));

    return Math.min(jaroWinkler, 1);
  }

  /**
   * Calculates Jaro similarity
   * @private
   */
  static _calculateJaro(s1, s2) {
    const len1 = s1.length;
    const len2 = s2.length;

    if (len1 === 0 && len2 === 0) return 1;
    if (len1 === 0 || len2 === 0) return 0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    if (matchWindow < 0) return 0;

    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);

    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);

      for (let j = start; j < end; j++) {
        if (s2Matches[j] || s1[i] !== s2[j]) continue;
        s1Matches[i] = true;
        s2Matches[j] = true;
        matches++;
        break;
      }
    }

    if (matches === 0) return 0;

    // Count transpositions
    let k = 0;
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    return (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;
  }

  /**
   * Gets common prefix length up to maxLength
   * @private
   */
  static _getCommonPrefixLength(s1, s2, maxLength) {
    let prefixLength = 0;
    const minLength = Math.min(s1.length, s2.length, maxLength);

    for (let i = 0; i < minLength; i++) {
      if (s1[i] === s2[i]) {
        prefixLength++;
      } else {
        break;
      }
    }

    return prefixLength;
  }

  /**
   * Detects all types of duplicates for an account
   * @param {string} accountId - Account ID to check
   * @returns {Promise<Array>} - Array of duplicate sets
   */
  static async detectAll(accountId) {
    try {
      logger.info('Starting duplicate detection', { accountId });

      const [exactPhoneDuplicates, similarPhoneDuplicates, similarNameDuplicates] = await Promise.all([
        this.detectExactPhoneDuplicates(accountId),
        this.detectSimilarPhoneDuplicates(accountId),
        this.detectSimilarNameDuplicates(accountId)
      ]);

      const allDuplicates = [
        ...exactPhoneDuplicates,
        ...similarPhoneDuplicates,
        ...similarNameDuplicates
      ];

      logger.info('Duplicate detection completed', { 
        accountId, 
        totalSets: allDuplicates.length,
        exactPhone: exactPhoneDuplicates.length,
        similarPhone: similarPhoneDuplicates.length,
        similarName: similarNameDuplicates.length
      });

      return allDuplicates;
    } catch (error) {
      logger.error('Duplicate detection failed', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }

  /**
   * Detects contacts with identical phone numbers
   * @param {string} accountId - Account ID to check
   * @returns {Promise<Array>} - Array of duplicate sets
   */
  static async detectExactPhoneDuplicates(accountId) {
    try {
      // Get all contacts with their phones normalized using queryAsAdmin
      const { data: contacts, error } = await SupabaseService.queryAsAdmin(
        'contacts',
        (query) => query
          .select('id, name, phone, avatar_url, created_at')
          .eq('account_id', accountId)
          .not('phone', 'is', null)
          .neq('phone', '')
          .order('phone', { ascending: true })
          .order('created_at', { ascending: true })
      );

      if (error) throw error;

      const duplicateSets = [];
      const phoneGroups = {};

      // Group contacts by normalized phone
      (contacts || []).forEach(contact => {
        const normalizedPhone = this.normalizePhone(contact.phone);
        if (!normalizedPhone) return;

        if (!phoneGroups[normalizedPhone]) {
          phoneGroups[normalizedPhone] = [];
        }
        phoneGroups[normalizedPhone].push(contact);
      });

      // Create duplicate sets for phones with multiple contacts
      Object.entries(phoneGroups).forEach(([phone, contactList]) => {
        if (contactList.length > 1) {
          duplicateSets.push({
            id: `exact_phone_${phone}`,
            type: 'exact_phone',
            contacts: contactList,
            similarity: 1.0,
            phone: phone
          });
        }
      });

      return duplicateSets;
    } catch (error) {
      logger.error('Exact phone duplicate detection failed', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }

  /**
   * Detects contacts with similar phone numbers (same digits, different formatting)
   * @param {string} accountId - Account ID to check
   * @returns {Promise<Array>} - Array of duplicate sets
   */
  static async detectSimilarPhoneDuplicates(accountId) {
    try {
      // This is essentially the same as exact phone duplicates since we normalize
      // But we keep it separate for potential future enhancements
      return this.detectExactPhoneDuplicates(accountId);
    } catch (error) {
      logger.error('Similar phone duplicate detection failed', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }

  /**
   * Detects contacts with similar names using fuzzy matching
   * @param {string} accountId - Account ID to check
   * @param {number} threshold - Similarity threshold (0-1), default 0.8
   * @returns {Promise<Array>} - Array of duplicate sets
   */
  static async detectSimilarNameDuplicates(accountId, threshold = 0.8) {
    try {
      // Get all contacts with names using queryAsAdmin
      const { data: contacts, error } = await SupabaseService.queryAsAdmin(
        'contacts',
        (query) => query
          .select('id, name, phone, avatar_url, created_at')
          .eq('account_id', accountId)
          .not('name', 'is', null)
          .neq('name', '')
          .order('name', { ascending: true })
          .order('created_at', { ascending: true })
      );

      if (error) throw error;

      // Filter out contacts with names shorter than 3 characters (after trimming)
      const filteredContacts = (contacts || []).filter(c => 
        c.name && c.name.trim().length > 2
      );

      const duplicateSets = [];
      const processed = new Set();

      // Compare each contact with every other contact
      for (let i = 0; i < filteredContacts.length; i++) {
        if (processed.has(filteredContacts[i].id)) continue;

        const similarContacts = [filteredContacts[i]];
        processed.add(filteredContacts[i].id);

        for (let j = i + 1; j < filteredContacts.length; j++) {
          if (processed.has(filteredContacts[j].id)) continue;

          const similarity = this.calculateNameSimilarity(
            filteredContacts[i].name, 
            filteredContacts[j].name
          );

          if (similarity >= threshold) {
            similarContacts.push(filteredContacts[j]);
            processed.add(filteredContacts[j].id);
          }
        }

        // Create duplicate set if we found similar names
        if (similarContacts.length > 1) {
          const avgSimilarity = similarContacts.length > 2 
            ? this._calculateAverageSimilarity(similarContacts)
            : this.calculateNameSimilarity(similarContacts[0].name, similarContacts[1].name);

          duplicateSets.push({
            id: `similar_name_${similarContacts[0].id}`,
            type: 'similar_name',
            contacts: similarContacts,
            similarity: avgSimilarity,
            baseName: similarContacts[0].name
          });
        }
      }

      return duplicateSets;
    } catch (error) {
      logger.error('Similar name duplicate detection failed', { 
        error: error.message, 
        accountId 
      });
      throw error;
    }
  }

  /**
   * Calculates average similarity for a group of contacts
   * @private
   */
  static _calculateAverageSimilarity(contacts) {
    if (contacts.length < 2) return 1;

    let totalSimilarity = 0;
    let comparisons = 0;

    for (let i = 0; i < contacts.length; i++) {
      for (let j = i + 1; j < contacts.length; j++) {
        totalSimilarity += this.calculateNameSimilarity(
          contacts[i].name, 
          contacts[j].name
        );
        comparisons++;
      }
    }

    return comparisons > 0 ? totalSimilarity / comparisons : 1;
  }
}

module.exports = DuplicateDetector;