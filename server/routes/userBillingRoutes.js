/**
 * User Billing Routes
 * 
 * Endpoints for user subscription management, credits, and billing history.
 * All routes require user authentication.
 * 
 * Requirements: 3.1, 4.1, 4.2, 4.3, 4.5, 6.1, 6.4, 7.1, 8.1
 */

const router = require('express').Router();
const { requireUser: authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const StripeService = require('../services/StripeService');
const SubscriptionService = require('../services/SubscriptionService');
const SupabaseService = require('../services/SupabaseService');
const { validateCheckoutSession, validateCreditPurchase } = require('../validators/stripeValidator');

/**
 * Convert userId to UUID format if needed (32-char hash to UUID)
 * @param {string} userId - User ID (may be 32-char hash or UUID)
 * @returns {string} UUID formatted user ID
 */
function toUuidFormat(userId) {
  if (!userId) return userId;
  if (userId.length === 32 && !userId.includes('-')) {
    return `${userId.slice(0, 8)}-${userId.slice(8, 12)}-${userId.slice(12, 16)}-${userId.slice(16, 20)}-${userId.slice(20)}`;
  }
  return userId;
}

// ==================== Subscription Endpoints ====================

/**
 * GET /api/user/subscription
 * Get current subscription details
 */
router.get('/subscription', authenticate, async (req, res) => {
  try {
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getUserSubscription(req.session.userId);
    
    res.json({ success: true, data: subscription });
  } catch (error) {
    logger.error('Failed to get subscription', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/subscription',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/subscription/checkout
 * Create a checkout session for subscription
 */
router.post('/subscription/checkout', authenticate, async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get plan details
    const PlanService = require('../services/PlanService');
    const planService = new PlanService();
    const plan = await planService.getPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({ error: 'Plan not synced with Stripe' });
    }

    // Get or create Stripe customer
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, stripe_customer_id, name')
      .eq('owner_user_id', uuidUserId)
      .single();

    let customerId = account?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await StripeService.createCustomer(
        `user-${req.session.userId}@wuzapi.local`,
        account?.name || `User ${req.session.userId}`,
        { userId: req.session.userId, accountId: account?.id }
      );
      customerId = customer.id;

      // Save customer ID
      if (account?.id) {
        await SupabaseService.adminClient
          .from('accounts')
          .update({ stripe_customer_id: customerId })
          .eq('id', account.id);
      }
    }

    // Create checkout session
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const session = await StripeService.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      mode: 'subscription',
      successUrl: `${baseUrl}/user/account?subscription=success`,
      cancelUrl: `${baseUrl}/user/account?subscription=canceled`,
      metadata: {
        userId: req.session.userId,
        accountId: account?.id,
        planId,
      },
    });

    logger.info('Checkout session created', {
      userId: req.session?.userId,
      planId,
      sessionId: session.id,
      endpoint: '/api/user/subscription/checkout',
    });

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    logger.error('Failed to create checkout session', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/subscription/checkout',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/subscription/change
 * Change subscription plan
 */
router.post('/subscription/change', authenticate, async (req, res) => {
  try {
    const { planId } = req.body;
    
    if (!planId) {
      return res.status(400).json({ error: 'Plan ID is required' });
    }

    // Get new plan first
    const PlanService = require('../services/PlanService');
    const planService = new PlanService();
    const plan = await planService.getPlanById(planId);
    
    if (!plan) {
      return res.status(404).json({ error: 'Plan not found' });
    }

    if (!plan.stripePriceId) {
      return res.status(400).json({ error: 'Plan not synced with Stripe' });
    }

    // Get current subscription
    const subscriptionService = new SubscriptionService();
    const currentSub = await subscriptionService.getUserSubscription(req.session.userId);

    // Get or create Stripe customer
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, stripe_customer_id, name')
      .eq('owner_user_id', uuidUserId)
      .single();

    let customerId = account?.stripe_customer_id;

    if (!customerId) {
      // Create Stripe customer
      const customer = await StripeService.createCustomer(
        `user-${req.session.userId}@wuzapi.local`,
        account?.name || `User ${req.session.userId}`,
        { userId: req.session.userId, accountId: account?.id }
      );
      customerId = customer.id;

      // Save customer ID
      if (account?.id) {
        await SupabaseService.adminClient
          .from('accounts')
          .update({ stripe_customer_id: customerId })
          .eq('id', account.id);
      }
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    
    // If user has active Stripe subscription, update it; otherwise create new checkout
    if (currentSub?.stripeSubscriptionId) {
      // TODO: Implement subscription update with proration
      // For now, create a new checkout session
      const session = await StripeService.createCheckoutSession({
        customerId,
        priceId: plan.stripePriceId,
        mode: 'subscription',
        successUrl: `${baseUrl}/user/account?subscription=changed`,
        cancelUrl: `${baseUrl}/user/account?subscription=canceled`,
        metadata: {
          userId: req.session.userId,
          accountId: account?.id,
          planId,
          previousPlanId: currentSub?.planId,
          type: 'plan_change',
        },
      });

      logger.info('Plan change checkout session created', {
        userId: req.session?.userId,
        planId,
        previousPlanId: currentSub?.planId,
        sessionId: session.id,
        endpoint: '/api/user/subscription/change',
      });

      return res.json({ success: true, data: { url: session.url, sessionId: session.id } });
    }

    // No active Stripe subscription - create new checkout session
    const session = await StripeService.createCheckoutSession({
      customerId,
      priceId: plan.stripePriceId,
      mode: 'subscription',
      successUrl: `${baseUrl}/user/account?subscription=success`,
      cancelUrl: `${baseUrl}/user/account?subscription=canceled`,
      metadata: {
        userId: req.session.userId,
        accountId: account?.id,
        planId,
        type: 'new_subscription',
      },
    });

    logger.info('Subscription checkout session created (from change)', {
      userId: req.session?.userId,
      planId,
      sessionId: session.id,
      endpoint: '/api/user/subscription/change',
    });

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    logger.error('Failed to change plan', {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
      endpoint: '/api/user/subscription/change',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/subscription/cancel
 * Cancel subscription at period end
 */
router.post('/subscription/cancel', authenticate, async (req, res) => {
  try {
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getUserSubscription(req.session.userId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    if (subscription.stripeSubscriptionId) {
      // Cancel in Stripe
      await StripeService.cancelSubscription(subscription.stripeSubscriptionId, true);
    }

    // Update local status
    await subscriptionService.updateSubscriptionStatus(req.session.userId, 'cancelled');

    // Update cancel_at_period_end flag
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .update({ cancel_at_period_end: true })
      .eq('id', subscription.id);

    logger.info('Subscription canceled', {
      userId: req.session?.userId,
      subscriptionId: subscription.id,
      endpoint: '/api/user/subscription/cancel',
    });

    res.json({ success: true, message: 'Subscription will be canceled at period end' });
  } catch (error) {
    logger.error('Failed to cancel subscription', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/subscription/cancel',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/subscription/reactivate
 * Reactivate a canceled subscription
 */
router.post('/subscription/reactivate', authenticate, async (req, res) => {
  try {
    const subscriptionService = new SubscriptionService();
    const subscription = await subscriptionService.getUserSubscription(req.session.userId);
    
    if (!subscription) {
      return res.status(404).json({ error: 'No subscription found' });
    }

    if (subscription.stripeSubscriptionId) {
      // Reactivate in Stripe
      await StripeService.reactivateSubscription(subscription.stripeSubscriptionId);
    }

    // Update local status
    await subscriptionService.updateSubscriptionStatus(req.session.userId, 'active');

    // Clear cancel_at_period_end flag
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .update({ cancel_at_period_end: false })
      .eq('id', subscription.id);

    logger.info('Subscription reactivated', {
      userId: req.session?.userId,
      subscriptionId: subscription.id,
      endpoint: '/api/user/subscription/reactivate',
    });

    res.json({ success: true, message: 'Subscription reactivated' });
  } catch (error) {
    logger.error('Failed to reactivate subscription', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/subscription/reactivate',
    });
    res.status(500).json({ error: error.message });
  }
});

// ==================== Credit Endpoints ====================

/**
 * GET /api/user/credits
 * Get credit balance
 */
router.get('/credits', authenticate, async (req, res) => {
  try {
    // Get account
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, reseller_credit_balance')
      .eq('owner_user_id', uuidUserId)
      .single();

    // Get credit transactions to calculate balance
    const { data: transactions } = await SupabaseService.adminClient
      .from('credit_transactions')
      .select('amount, balance_after')
      .eq('account_id', account?.id)
      .order('created_at', { ascending: false })
      .limit(1);

    const balance = transactions?.[0]?.balance_after || 0;
    const lowBalanceThreshold = 100; // Configurable

    res.json({
      success: true,
      data: {
        available: balance,
        pending: 0,
        currency: 'BRL',
        lowBalanceThreshold,
        isLow: balance < lowBalanceThreshold,
      },
    });
  } catch (error) {
    logger.error('Failed to get credit balance', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/credits',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/user/credits/packages
 * Get available credit packages
 */
router.get('/credits/packages', authenticate, async (req, res) => {
  try {
    // Get credit packages (plans with is_credit_package = true)
    const { data: packages } = await SupabaseService.adminClient
      .from('plans')
      .select('*')
      .eq('is_credit_package', true)
      .eq('status', 'active')
      .order('credit_amount', { ascending: true });

    const formattedPackages = (packages || []).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      creditAmount: pkg.credit_amount,
      priceCents: pkg.price_cents,
      currency: 'BRL',
      isWholesale: false,
    }));

    res.json({ success: true, data: formattedPackages });
  } catch (error) {
    logger.error('Failed to get credit packages', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/credits/packages',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/credits/purchase
 * Purchase credits
 */
router.post('/credits/purchase', authenticate, async (req, res) => {
  try {
    const validated = validateCreditPurchase(req.body);
    
    // Get package
    const { data: pkg } = await SupabaseService.adminClient
      .from('plans')
      .select('*')
      .eq('id', validated.packageId)
      .eq('is_credit_package', true)
      .single();

    if (!pkg) {
      return res.status(404).json({ error: 'Credit package not found' });
    }

    if (!pkg.stripe_price_id) {
      return res.status(400).json({ error: 'Package not synced with Stripe' });
    }

    // Get or create customer
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, stripe_customer_id, name')
      .eq('owner_user_id', uuidUserId)
      .single();

    let customerId = account?.stripe_customer_id;

    if (!customerId) {
      const customer = await StripeService.createCustomer(
        `user-${req.session.userId}@wuzapi.local`,
        account?.name || `User ${req.session.userId}`,
        { userId: req.session.userId, accountId: account?.id }
      );
      customerId = customer.id;

      if (account?.id) {
        await SupabaseService.adminClient
          .from('accounts')
          .update({ stripe_customer_id: customerId })
          .eq('id', account.id);
      }
    }

    // Create checkout session for one-time payment
    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const session = await StripeService.createCheckoutSession({
      customerId,
      priceId: pkg.stripe_price_id,
      mode: 'payment',
      successUrl: `${baseUrl}/user/account?credits=success`,
      cancelUrl: `${baseUrl}/user/account?credits=canceled`,
      metadata: {
        userId: req.session.userId,
        accountId: account?.id,
        packageId: validated.packageId,
        creditAmount: pkg.credit_amount,
        type: 'credit_purchase',
      },
      quantity: validated.quantity,
    });

    logger.info('Credit purchase checkout created', {
      userId: req.session?.userId,
      packageId: validated.packageId,
      sessionId: session.id,
      endpoint: '/api/user/credits/purchase',
    });

    res.json({ success: true, data: { url: session.url, sessionId: session.id } });
  } catch (error) {
    logger.error('Failed to create credit purchase checkout', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/credits/purchase',
    });
    
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: 'Invalid input', details: error.errors });
    }
    
    res.status(500).json({ error: error.message });
  }
});

// ==================== Billing History Endpoints ====================

/**
 * GET /api/user/billing/history
 * Get invoice history
 */
router.get('/billing/history', authenticate, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = 12;

    // Get customer ID
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('stripe_customer_id')
      .eq('owner_user_id', uuidUserId)
      .single();

    if (!account?.stripe_customer_id) {
      return res.json({ success: true, data: [] });
    }

    // Get invoices from Stripe
    const invoices = await StripeService.listInvoices(account.stripe_customer_id, limit);

    const formattedInvoices = invoices.map(inv => ({
      id: inv.id,
      stripeInvoiceId: inv.id,
      amount: inv.amount_paid / 100,
      currency: inv.currency.toUpperCase(),
      status: inv.status,
      pdfUrl: inv.invoice_pdf,
      createdAt: new Date(inv.created * 1000).toISOString(),
    }));

    res.json({ success: true, data: formattedInvoices });
  } catch (error) {
    logger.error('Failed to get billing history', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/billing/history',
    });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/user/billing/portal
 * Create billing portal session
 */
router.post('/billing/portal', authenticate, async (req, res) => {
  try {
    // Get customer ID
    const uuidUserId = toUuidFormat(req.session.userId);
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('stripe_customer_id')
      .eq('owner_user_id', uuidUserId)
      .single();

    if (!account?.stripe_customer_id) {
      return res.status(400).json({ error: 'No billing account found' });
    }

    const baseUrl = process.env.FRONTEND_URL || 'http://localhost:8080';
    const session = await StripeService.createBillingPortalSession(
      account.stripe_customer_id,
      `${baseUrl}/user/account`
    );

    res.json({ success: true, data: { url: session.url } });
  } catch (error) {
    logger.error('Failed to create billing portal session', {
      error: error.message,
      userId: req.session?.userId,
      endpoint: '/api/user/billing/portal',
    });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
