/**
 * AffiliateService - Affiliate program management
 * 
 * Handles affiliate registration, referral tracking, commission calculation,
 * and payout processing.
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.4, 12.5
 */

const { logger } = require('../utils/logger');
const { getStripeClient } = require('../utils/stripeClient');
const SupabaseService = require('./SupabaseService');
const { v4: uuidv4 } = require('uuid');

class AffiliateService {
  /**
   * Register a user as an affiliate
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async registerAffiliate(userId) {
    try {
      // Generate unique affiliate ID
      const affiliateId = `aff_${uuidv4().substring(0, 8)}`;

      // Update account with affiliate ID
      const { data, error } = await SupabaseService.adminClient
        .from('accounts')
        .update({
          affiliate_id: affiliateId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;

      logger.info('Affiliate registered', { userId, affiliateId });
      return { affiliateId, account: data };
    } catch (error) {
      logger.error('Failed to register affiliate', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Track a referral from an affiliate
   * @param {string} affiliateId - Affiliate ID
   * @param {string} referredUserId - Referred user ID
   * @returns {Promise<Object>}
   */
  static async trackReferral(affiliateId, referredUserId) {
    try {
      // Get affiliate account
      const { data: affiliateAccount, error: affiliateError } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, user_id')
        .eq('affiliate_id', affiliateId)
        .single();

      if (affiliateError || !affiliateAccount) {
        throw new Error('Affiliate not found');
      }

      // Get commission rate from settings
      const commissionRate = await this.getCommissionRate();

      // Create referral record
      const { data, error } = await SupabaseService.adminClient
        .from('affiliate_referrals')
        .insert({
          affiliate_account_id: affiliateAccount.id,
          referred_account_id: referredUserId,
          commission_rate: commissionRate,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // Update referred user's account
      await SupabaseService.adminClient
        .from('accounts')
        .update({
          referred_by: affiliateId,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', referredUserId);

      logger.info('Referral tracked', { affiliateId, referredUserId });
      return data;
    } catch (error) {
      logger.error('Failed to track referral', { error: error.message, affiliateId });
      throw error;
    }
  }

  /**
   * Calculate commission for a purchase
   * @param {number} purchaseAmount - Purchase amount in cents
   * @param {number} commissionRate - Commission rate (0-1)
   * @returns {number} Commission amount in cents
   */
  static calculateCommission(purchaseAmount, commissionRate) {
    return Math.floor(purchaseAmount * commissionRate);
  }

  /**
   * Process an affiliate sale and calculate commission
   * @param {string} paymentIntentId - Stripe payment intent ID
   * @param {string} referredUserId - User who made the purchase
   * @param {number} amount - Purchase amount in cents
   * @returns {Promise<Object|null>}
   */
  static async processAffiliateSale(paymentIntentId, referredUserId, amount) {
    try {
      // Get referral record
      const { data: referral, error: referralError } = await SupabaseService.adminClient
        .from('affiliate_referrals')
        .select('*, affiliate_account:affiliate_account_id(user_id, stripe_account_id)')
        .eq('referred_account_id', referredUserId)
        .eq('status', 'pending')
        .single();

      if (referralError || !referral) {
        // No referral found - not an affiliate sale
        return null;
      }

      // Calculate commission
      const commission = this.calculateCommission(amount, referral.commission_rate);

      // Update referral with commission
      const { error: updateError } = await SupabaseService.adminClient
        .from('affiliate_referrals')
        .update({
          status: 'converted',
          total_commission_earned: referral.total_commission_earned + commission,
        })
        .eq('id', referral.id);

      if (updateError) throw updateError;

      // If affiliate has a connected Stripe account, transfer commission
      if (referral.affiliate_account?.stripe_account_id) {
        await this.transferCommission(
          referral.affiliate_account.stripe_account_id,
          commission,
          paymentIntentId
        );
      }

      logger.info('Affiliate sale processed', { 
        referralId: referral.id, 
        commission,
        paymentIntentId 
      });

      return { referral, commission };
    } catch (error) {
      logger.error('Failed to process affiliate sale', { error: error.message });
      throw error;
    }
  }


  /**
   * Transfer commission to affiliate's connected account
   * @param {string} accountId - Stripe connected account ID
   * @param {number} amount - Amount in cents
   * @param {string} paymentIntentId - Original payment intent ID
   * @returns {Promise<Object>}
   */
  static async transferCommission(accountId, amount, paymentIntentId) {
    try {
      const stripe = await getStripeClient();
      if (!stripe) throw new Error('Stripe not configured');

      const transfer = await stripe.transfers.create({
        amount,
        currency: 'brl',
        destination: accountId,
        transfer_group: paymentIntentId,
        metadata: {
          type: 'affiliate_commission',
          payment_intent: paymentIntentId,
        },
      });

      logger.info('Commission transferred', { transferId: transfer.id, accountId, amount });
      return transfer;
    } catch (error) {
      logger.error('Failed to transfer commission', { error: error.message, accountId });
      throw error;
    }
  }

  /**
   * Get affiliate earnings summary
   * @param {string} userId - User ID
   * @returns {Promise<Object>}
   */
  static async getAffiliateEarnings(userId) {
    try {
      // Get account
      const { data: account, error: accountError } = await SupabaseService.adminClient
        .from('accounts')
        .select('id, affiliate_id')
        .eq('user_id', userId)
        .single();

      if (accountError || !account?.affiliate_id) {
        return {
          totalEarned: 0,
          pendingPayout: 0,
          paidOut: 0,
          referralCount: 0,
          conversionRate: 0,
        };
      }

      // Get referrals
      const { data: referrals, error: referralsError } = await SupabaseService.adminClient
        .from('affiliate_referrals')
        .select('status, total_commission_earned')
        .eq('affiliate_account_id', account.id);

      if (referralsError) throw referralsError;

      const totalReferrals = referrals?.length || 0;
      const convertedReferrals = referrals?.filter(r => r.status === 'converted') || [];
      const paidReferrals = referrals?.filter(r => r.status === 'paid') || [];

      const totalEarned = referrals?.reduce((sum, r) => sum + (r.total_commission_earned || 0), 0) || 0;
      const paidOut = paidReferrals.reduce((sum, r) => sum + (r.total_commission_earned || 0), 0);
      const pendingPayout = totalEarned - paidOut;

      return {
        totalEarned,
        pendingPayout,
        paidOut,
        referralCount: totalReferrals,
        conversionRate: totalReferrals > 0 ? convertedReferrals.length / totalReferrals : 0,
      };
    } catch (error) {
      logger.error('Failed to get affiliate earnings', { error: error.message, userId });
      throw error;
    }
  }

  /**
   * Process payouts for affiliates who reached threshold
   * @param {string} affiliateUserId - Optional specific affiliate to process
   * @returns {Promise<Array>}
   */
  static async processPayouts(affiliateUserId = null) {
    try {
      const payoutThreshold = await this.getPayoutThreshold();
      const processedPayouts = [];

      // Build query
      let query = SupabaseService.adminClient
        .from('accounts')
        .select('id, user_id, stripe_account_id, affiliate_id')
        .not('affiliate_id', 'is', null)
        .not('stripe_account_id', 'is', null);

      if (affiliateUserId) {
        query = query.eq('user_id', affiliateUserId);
      }

      const { data: affiliates, error } = await query;
      if (error) throw error;

      for (const affiliate of affiliates || []) {
        const earnings = await this.getAffiliateEarnings(affiliate.user_id);
        
        if (earnings.pendingPayout >= payoutThreshold) {
          try {
            // Transfer pending amount
            const stripe = await getStripeClient();
            if (!stripe) continue;

            const payout = await stripe.payouts.create(
              {
                amount: earnings.pendingPayout,
                currency: 'brl',
              },
              { stripeAccount: affiliate.stripe_account_id }
            );

            // Mark referrals as paid
            await SupabaseService.adminClient
              .from('affiliate_referrals')
              .update({ status: 'paid' })
              .eq('affiliate_account_id', affiliate.id)
              .eq('status', 'converted');

            processedPayouts.push({
              affiliateId: affiliate.affiliate_id,
              amount: earnings.pendingPayout,
              payoutId: payout.id,
            });

            logger.info('Affiliate payout processed', { 
              affiliateId: affiliate.affiliate_id, 
              amount: earnings.pendingPayout 
            });
          } catch (payoutError) {
            logger.error('Failed to process payout for affiliate', { 
              error: payoutError.message, 
              affiliateId: affiliate.affiliate_id 
            });
          }
        }
      }

      return processedPayouts;
    } catch (error) {
      logger.error('Failed to process payouts', { error: error.message });
      throw error;
    }
  }

  /**
   * Get commission rate from settings
   * @returns {Promise<number>}
   */
  static async getCommissionRate() {
    try {
      const { data } = await SupabaseService.adminClient
        .from('global_settings')
        .select('value')
        .eq('key', 'affiliate_commission_rate')
        .single();

      return data?.value?.rate || 0.10; // Default 10%
    } catch (error) {
      return 0.10; // Default 10%
    }
  }

  /**
   * Get payout threshold from settings
   * @returns {Promise<number>}
   */
  static async getPayoutThreshold() {
    try {
      const { data } = await SupabaseService.adminClient
        .from('global_settings')
        .select('value')
        .eq('key', 'affiliate_payout_threshold')
        .single();

      return data?.value?.threshold || 10000; // Default R$100.00
    } catch (error) {
      return 10000; // Default R$100.00
    }
  }

  /**
   * Update affiliate program configuration
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  static async updateConfig(config) {
    try {
      const { commissionRate, payoutThreshold, enabled } = config;

      const settings = [
        { key: 'affiliate_commission_rate', value: { rate: commissionRate } },
        { key: 'affiliate_payout_threshold', value: { threshold: payoutThreshold } },
        { key: 'affiliate_program_enabled', value: { enabled } },
      ];

      for (const setting of settings) {
        const { data: existing } = await SupabaseService.adminClient
          .from('global_settings')
          .select('id')
          .eq('key', setting.key)
          .single();

        if (existing) {
          await SupabaseService.adminClient
            .from('global_settings')
            .update({ value: setting.value, updated_at: new Date().toISOString() })
            .eq('key', setting.key);
        } else {
          await SupabaseService.adminClient
            .from('global_settings')
            .insert({ key: setting.key, value: setting.value });
        }
      }

      logger.info('Affiliate config updated', config);
    } catch (error) {
      logger.error('Failed to update affiliate config', { error: error.message });
      throw error;
    }
  }

  /**
   * Get affiliate program configuration
   * @returns {Promise<Object>}
   */
  static async getConfig() {
    try {
      const { data: settings } = await SupabaseService.adminClient
        .from('global_settings')
        .select('key, value')
        .in('key', ['affiliate_commission_rate', 'affiliate_payout_threshold', 'affiliate_program_enabled']);

      const config = {
        commissionRate: 0.10,
        payoutThreshold: 10000,
        enabled: false,
      };

      for (const setting of settings || []) {
        switch (setting.key) {
          case 'affiliate_commission_rate':
            config.commissionRate = setting.value?.rate || 0.10;
            break;
          case 'affiliate_payout_threshold':
            config.payoutThreshold = setting.value?.threshold || 10000;
            break;
          case 'affiliate_program_enabled':
            config.enabled = setting.value?.enabled || false;
            break;
        }
      }

      return config;
    } catch (error) {
      logger.error('Failed to get affiliate config', { error: error.message });
      return {
        commissionRate: 0.10,
        payoutThreshold: 10000,
        enabled: false,
      };
    }
  }
}

module.exports = AffiliateService;
