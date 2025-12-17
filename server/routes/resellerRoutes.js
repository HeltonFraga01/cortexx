/**
 * Reseller Routes
 * 
 * Endpoints for Stripe Connect, wholesale purchases, and reseller operations.
 * All routes require user authentication.
 * 
 * Requirements: 9.1, 9.2, 9.3, 9.4, 10.1, 10.2, 11.1, 11.2, 14.1
 */

const router = require('express').Router();
const { requireAuth } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const StripeService = require('../services/StripeService');
const CreditService = require('../services/CreditService');
const SupabaseService = require('../services/SupabaseService');
const { validateResellerPricing } = require('../validators/stripeValidator');

// ==================== Stripe Connect Endpoints ====================

/**
 * POST /api/reseller/connect/onboard
 * Start Stripe Connect onboarding
 */
router.post('/connect/onboard', requireAuth, async (req, res) => {
  try {
    const { getStripeClient } = require('../utils/stripeClient');
    const stripe = await getStripeClient();
    
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    // Get account
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, stripe_account_id, name')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    let accountId = account.stripe_account_id;

    // Create Connect account if not exists
    if (!accountId) {
      const connectAccount = await stripe.accounts.create({
        type: 'express',
        country: 'BR',
        email: req.session.userEmail || `reseller-${req.session.userId}@wuzapi.local`,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_type: 'individual',
        metadata: {
          userId: req.session.userId,
          accountId: account.id,
        },
      });

      accountId = connectAccount.id;

      // Save Connect account ID
      await SupabaseService.adminClient
        .from('accounts')
        .update({ 
          stripe_account_id: accountId,
          is_reseller: true,
        })
        .eq('id', account.id);
    }

    // Create account link for onboarding
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${baseUrl}/user/reseller?refresh=true`,
      return_url: `${baseUrl}/user/reseller?success=true`,
      type: 'account_onboarding',
    });

    logger.info('Connect onboarding started', { 
      userId: req.session?.userId, 
      connectAccountId: accountId 
    });

    res.json({ success: true, data: { url: accountLink.url } });
  } catch (error) {
    logger.error('Failed to start Connect onboarding', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/connect/onboard',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/reseller/connect/status
 * Get Connect account status
 */
router.get('/connect/status', requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('stripe_account_id, is_reseller')
      .eq('owner_user_id', userId)
      .single();

    if (!account?.stripe_account_id) {
      return res.json({
        success: true,
        data: {
          accountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false,
          requiresAction: true,
        },
      });
    }

    const { getStripeClient } = require('../utils/stripeClient');
    const stripe = await getStripeClient();
    
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const connectAccount = await stripe.accounts.retrieve(account.stripe_account_id);

    res.json({
      success: true,
      data: {
        accountId: connectAccount.id,
        chargesEnabled: connectAccount.charges_enabled,
        payoutsEnabled: connectAccount.payouts_enabled,
        detailsSubmitted: connectAccount.details_submitted,
        requiresAction: !connectAccount.details_submitted || !connectAccount.charges_enabled,
      },
    });
  } catch (error) {
    logger.error('Failed to get Connect status', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/connect/status',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reseller/connect/dashboard
 * Get Express Dashboard link
 */
router.post('/connect/dashboard', requireAuth, async (req, res) => {
  try {
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('stripe_account_id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account?.stripe_account_id) {
      return res.status(400).json({ error: 'Connect account not found' });
    }

    const { getStripeClient } = require('../utils/stripeClient');
    const stripe = await getStripeClient();
    
    if (!stripe) {
      return res.status(500).json({ error: 'Stripe not configured' });
    }

    const loginLink = await stripe.accounts.createLoginLink(account.stripe_account_id);

    res.json({ success: true, data: { url: loginLink.url } });
  } catch (error) {
    logger.error('Failed to create dashboard link', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/connect/dashboard',
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== Wholesale Endpoints ====================

/**
 * GET /api/reseller/wholesale/packages
 * Get wholesale credit packages
 */
router.get('/wholesale/packages', requireAuth, async (req, res) => {
  try {
    // Get wholesale packages (credit packages with volume discounts)
    const { data: packages } = await SupabaseService.adminClient
      .from('plans')
      .select('*')
      .eq('is_credit_package', true)
      .eq('status', 'active')
      .order('credit_amount', { ascending: true });

    // Apply wholesale pricing (e.g., 20% discount for bulk)
    const wholesalePackages = (packages || []).map(pkg => ({
      id: pkg.id,
      name: `${pkg.name} (Atacado)`,
      creditAmount: pkg.credit_amount,
      priceCents: Math.round(pkg.price_cents * 0.8), // 20% discount
      currency: 'BRL',
      isWholesale: true,
      volumeDiscount: 20,
    }));

    res.json({ success: true, data: wholesalePackages });
  } catch (error) {
    logger.error('Failed to get wholesale packages', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/wholesale/packages',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/reseller/wholesale/purchase
 * Purchase wholesale credits
 */
router.post('/wholesale/purchase', requireAuth, async (req, res) => {
  try {
    const { packageId, quantity = 1 } = req.body;

    if (!packageId) {
      return res.status(400).json({ error: 'Package ID is required' });
    }

    // Verify reseller status
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, is_reseller, stripe_customer_id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account?.is_reseller) {
      return res.status(403).json({ error: 'Reseller account required' });
    }

    // Create checkout for wholesale purchase
    const session = await CreditService.createCreditPurchaseCheckout(
      account.id,
      packageId,
      quantity
    );

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    logger.error('Failed to create wholesale purchase', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/wholesale/purchase',
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== Pricing Endpoints ====================

/**
 * GET /api/reseller/pricing
 * Get reseller pricing configuration
 */
router.get('/pricing', requireAuth, async (req, res) => {
  try {
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get reseller pricing with package details
    const { data: pricing } = await SupabaseService.adminClient
      .from('reseller_pricing')
      .select(`
        *,
        plans:base_package_id (
          id,
          name,
          price_cents,
          credit_amount
        )
      `)
      .eq('reseller_account_id', account.id)
      .eq('is_active', true);

    const formattedPricing = (pricing || []).map(p => ({
      packageId: p.base_package_id,
      packageName: p.plans?.name,
      wholesaleCost: Math.round(p.plans?.price_cents * 0.8), // 20% wholesale discount
      customPrice: p.custom_price_cents,
      profitMargin: p.custom_price_cents - Math.round(p.plans?.price_cents * 0.8),
      platformFee: Math.round(p.custom_price_cents * 0.05), // 5% platform fee
    }));

    res.json({ success: true, data: formattedPricing });
  } catch (error) {
    logger.error('Failed to get reseller pricing', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/pricing',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/reseller/pricing
 * Update reseller pricing
 */
router.put('/pricing', requireAuth, async (req, res) => {
  try {
    const validated = validateResellerPricing(req.body);

    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get package to validate price
    const { data: pkg } = await SupabaseService.adminClient
      .from('plans')
      .select('price_cents')
      .eq('id', validated.packageId)
      .single();

    if (!pkg) {
      return res.status(404).json({ error: 'Package not found' });
    }

    // Validate price covers wholesale cost + platform fee
    const wholesaleCost = Math.round(pkg.price_cents * 0.8);
    const platformFee = Math.round(validated.customPriceCents * 0.05);
    const minPrice = wholesaleCost + platformFee;

    if (validated.customPriceCents < minPrice) {
      return res.status(400).json({ 
        error: `Price must be at least ${minPrice} cents to cover costs` 
      });
    }

    // Upsert pricing
    const { data: existing } = await SupabaseService.adminClient
      .from('reseller_pricing')
      .select('id')
      .eq('reseller_account_id', account.id)
      .eq('base_package_id', validated.packageId)
      .single();

    if (existing) {
      await SupabaseService.adminClient
        .from('reseller_pricing')
        .update({
          custom_price_cents: validated.customPriceCents,
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      await SupabaseService.adminClient
        .from('reseller_pricing')
        .insert({
          reseller_account_id: account.id,
          base_package_id: validated.packageId,
          custom_price_cents: validated.customPriceCents,
        });
    }

    logger.info('Reseller pricing updated', { 
      userId: req.session?.userId, 
      packageId: validated.packageId 
    });

    res.json({ success: true, message: 'Pricing updated' });
  } catch (error) {
    logger.error('Failed to update reseller pricing', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/pricing',
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// ==================== Sales Endpoints ====================

/**
 * GET /api/reseller/sales
 * Get reseller sales history
 */
router.get('/sales', requireAuth, async (req, res) => {
  try {
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get credit transfers (sales to customers)
    const { data: sales } = await SupabaseService.adminClient
      .from('credit_transactions')
      .select('*')
      .eq('account_id', account.id)
      .eq('type', 'transfer')
      .lt('amount', 0) // Outgoing transfers
      .order('created_at', { ascending: false })
      .limit(50);

    const formattedSales = (sales || []).map(sale => ({
      id: sale.id,
      amount: Math.abs(sale.amount),
      customerId: sale.metadata?.to_account_id,
      createdAt: sale.created_at,
      description: sale.description,
    }));

    res.json({ success: true, data: formattedSales });
  } catch (error) {
    logger.error('Failed to get reseller sales', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/sales',
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== Affiliate Endpoints ====================

/**
 * GET /api/reseller/affiliate/earnings
 * Get affiliate earnings
 */
router.get('/affiliate/earnings', requireAuth, async (req, res) => {
  try {
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('owner_user_id', req.session.userId)
      .single();

    if (!account) {
      return res.status(404).json({ error: 'Account not found' });
    }

    // Get affiliate referrals
    const { data: referrals } = await SupabaseService.adminClient
      .from('affiliate_referrals')
      .select('*')
      .eq('affiliate_account_id', account.id);

    const totalEarned = (referrals || []).reduce((sum, r) => sum + (r.total_commission_earned || 0), 0);
    const paidOut = (referrals || []).filter(r => r.status === 'paid').reduce((sum, r) => sum + (r.total_commission_earned || 0), 0);
    const converted = (referrals || []).filter(r => r.status === 'converted' || r.status === 'paid').length;

    res.json({
      success: true,
      data: {
        totalEarned: totalEarned / 100,
        pendingPayout: (totalEarned - paidOut) / 100,
        paidOut: paidOut / 100,
        referralCount: referrals?.length || 0,
        conversionRate: referrals?.length ? (converted / referrals.length) * 100 : 0,
      },
    });
  } catch (error) {
    logger.error('Failed to get affiliate earnings', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/reseller/affiliate/earnings',
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
