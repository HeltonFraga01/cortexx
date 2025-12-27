/**
 * Stripe Webhook Routes
 * 
 * Handles incoming Stripe webhook events for subscription and payment sync.
 * This route does NOT use authentication middleware - Stripe signature is verified instead.
 * 
 * Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

const router = require('express').Router();
const { logger } = require('../utils/logger');
const StripeService = require('../services/StripeService');
const SubscriptionService = require('../services/SubscriptionService');
const SupabaseService = require('../services/SupabaseService');
const ContactPurchaseService = require('../services/ContactPurchaseService');

/**
 * Get webhook secret from global_settings
 */
async function getWebhookSecret() {
  try {
    const { data } = await SupabaseService.adminClient
      .from('global_settings')
      .select('value')
      .eq('key', 'stripe_webhook_secret')
      .single();

    if (!data?.value?.key) return null;
    
    // Decrypt if needed
    const key = data.value.key;
    if (key.startsWith('enc:')) {
      return key.substring(4);
    }
    return key;
  } catch (error) {
    logger.error('Failed to get webhook secret', { error: error.message });
    return null;
  }
}

/**
 * Log webhook event to database
 */
async function logWebhookEvent(event, processed, errorMessage = null) {
  try {
    await SupabaseService.adminClient
      .from('stripe_webhook_events')
      .insert({
        stripe_event_id: event.id,
        event_type: event.type,
        payload: event,
        processed,
        error_message: errorMessage,
      });
  } catch (error) {
    logger.error('Failed to log webhook event', { 
      error: error.message, 
      eventId: event.id 
    });
  }
}

/**
 * Handle checkout.session.completed event
 * Activates subscription after successful payment
 */
async function handleCheckoutCompleted(session) {
  const metadata = session.metadata || {};
  const { userId, accountId, planId, type, creditAmount } = metadata;

  logger.info('Processing checkout.session.completed', { 
    sessionId: session.id, 
    userId, 
    planId,
    type,
  });

  // Handle credit purchase
  if (type === 'credit_purchase' && creditAmount) {
    await handleCreditPurchase(accountId, parseInt(creditAmount), session.id);
    return;
  }

  // Handle subscription
  if (session.mode === 'subscription' && session.subscription) {
    const subscriptionService = new SubscriptionService();
    
    // Get or create account for user
    let targetAccountId = accountId;
    if (!targetAccountId && userId) {
      targetAccountId = await subscriptionService.getAccountIdFromUserId(userId);
      if (!targetAccountId) {
        targetAccountId = await subscriptionService.createAccountForUser(userId);
      }
    }

    if (!targetAccountId) {
      logger.error('No account found for checkout session', { sessionId: session.id, userId });
      return;
    }

    // Update subscription with Stripe ID
    const { data: existingSub } = await SupabaseService.adminClient
      .from('user_subscriptions')
      .select('id')
      .eq('account_id', targetAccountId)
      .single();

    if (existingSub) {
      await SupabaseService.adminClient
        .from('user_subscriptions')
        .update({
          stripe_subscription_id: session.subscription,
          plan_id: planId,
          status: 'active',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingSub.id);
    } else {
      // Create new subscription record
      await SupabaseService.adminClient
        .from('user_subscriptions')
        .insert({
          account_id: targetAccountId,
          plan_id: planId,
          stripe_subscription_id: session.subscription,
          status: 'active',
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        });
    }

    // Update customer ID on account if not set
    if (session.customer) {
      await SupabaseService.adminClient
        .from('accounts')
        .update({ stripe_customer_id: session.customer })
        .eq('id', targetAccountId);
    }

    logger.info('Subscription activated from checkout', { 
      accountId: targetAccountId, 
      subscriptionId: session.subscription 
    });
  }

  // CRM Integration: Create purchase for one-time payments
  if (session.mode === 'payment') {
    await createCRMPurchaseFromCheckout(session);
  }
}

/**
 * Handle credit purchase
 */
async function handleCreditPurchase(accountId, creditAmount, sessionId) {
  if (!accountId || !creditAmount) return;

  // Get current balance
  const { data: lastTx } = await SupabaseService.adminClient
    .from('credit_transactions')
    .select('balance_after')
    .eq('account_id', accountId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  const currentBalance = lastTx?.balance_after || 0;
  const newBalance = currentBalance + creditAmount;

  // Create credit transaction
  await SupabaseService.adminClient
    .from('credit_transactions')
    .insert({
      account_id: accountId,
      type: 'purchase',
      amount: creditAmount,
      balance_after: newBalance,
      stripe_invoice_id: sessionId,
      description: `Credit purchase: ${creditAmount} credits`,
    });

  logger.info('Credits granted from purchase', { 
    accountId, 
    creditAmount, 
    newBalance 
  });
}

/**
 * Handle customer.subscription.updated event
 */
async function handleSubscriptionUpdated(subscription) {
  logger.info('Processing customer.subscription.updated', { 
    subscriptionId: subscription.id,
    status: subscription.status,
  });

  // Find subscription by Stripe ID
  const { data: localSub } = await SupabaseService.adminClient
    .from('user_subscriptions')
    .select('id, account_id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!localSub) {
    logger.warn('Local subscription not found for Stripe subscription', { 
      stripeSubscriptionId: subscription.id 
    });
    return;
  }

  // Map Stripe status to local status
  const statusMap = {
    active: 'active',
    past_due: 'past_due',
    canceled: 'cancelled',
    unpaid: 'past_due',
    trialing: 'trial',
    incomplete: 'past_due',
    incomplete_expired: 'expired',
  };

  const localStatus = statusMap[subscription.status] || subscription.status;

  // Update local subscription
  await SupabaseService.adminClient
    .from('user_subscriptions')
    .update({
      status: localStatus,
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', localSub.id);

  logger.info('Subscription updated from webhook', { 
    subscriptionId: localSub.id, 
    status: localStatus 
  });
}

/**
 * Handle customer.subscription.deleted event
 */
async function handleSubscriptionDeleted(subscription) {
  logger.info('Processing customer.subscription.deleted', { 
    subscriptionId: subscription.id 
  });

  // Find and update local subscription
  const { data: localSub } = await SupabaseService.adminClient
    .from('user_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (localSub) {
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', localSub.id);

    logger.info('Subscription marked as canceled', { subscriptionId: localSub.id });
  }
}

/**
 * Handle invoice.payment_failed event
 */
async function handlePaymentFailed(invoice) {
  logger.info('Processing invoice.payment_failed', { 
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });

  // Find account by customer ID
  const { data: account } = await SupabaseService.adminClient
    .from('accounts')
    .select('id')
    .eq('stripe_customer_id', invoice.customer)
    .single();

  if (account) {
    // Update subscription status to past_due
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .update({
        status: 'past_due',
        updated_at: new Date().toISOString(),
      })
      .eq('account_id', account.id);

    // TODO: Send notification to user about failed payment
    logger.info('Subscription marked as past_due due to payment failure', { 
      accountId: account.id 
    });
  }
}

/**
 * Handle invoice.paid event (for credit purchases and CRM integration)
 */
async function handleInvoicePaid(invoice) {
  logger.info('Processing invoice.paid', { 
    invoiceId: invoice.id,
    customerId: invoice.customer,
  });

  // Check if this is a credit purchase by looking at metadata
  const lineItem = invoice.lines?.data?.[0];
  const metadata = lineItem?.metadata || {};

  if (metadata.type === 'credit_purchase' && metadata.creditAmount) {
    // Find account by customer ID
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (account) {
      await handleCreditPurchase(account.id, parseInt(metadata.creditAmount), invoice.id);
    }
  }

  // CRM Integration: Create purchase record for contact matching
  await createCRMPurchaseFromInvoice(invoice);
}

/**
 * Create CRM purchase record from Stripe invoice
 * Matches contact by email/phone and creates purchase for LTV tracking
 * Requirements: 9.5 (Contact CRM Evolution)
 */
async function createCRMPurchaseFromInvoice(invoice) {
  try {
    // Skip if no customer or amount
    if (!invoice.customer || !invoice.amount_paid || invoice.amount_paid <= 0) {
      return;
    }

    // Get customer details from Stripe
    const customerEmail = invoice.customer_email;
    const customerName = invoice.customer_name;
    const customerPhone = invoice.customer_phone;

    // Find account by Stripe customer ID
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, tenant_id')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (!account) {
      logger.debug('No account found for Stripe customer, skipping CRM purchase', {
        customerId: invoice.customer
      });
      return;
    }

    // Check if purchase already exists (by external_id)
    const existingQueryFn = (query) => query
      .select('id')
      .eq('external_id', invoice.id)
      .eq('account_id', account.id)
      .single();

    const { data: existingPurchase } = await SupabaseService.adminClient
      .from('contact_purchases')
      .select('id')
      .eq('external_id', invoice.id)
      .eq('account_id', account.id)
      .single();

    if (existingPurchase) {
      logger.debug('CRM purchase already exists for invoice', { invoiceId: invoice.id });
      return;
    }

    // Build product description from line items
    const productNames = (invoice.lines?.data || [])
      .map(line => line.description || line.price?.product?.name)
      .filter(Boolean)
      .join(', ');

    // Process webhook purchase (will find or create contact)
    const result = await ContactPurchaseService.processWebhookPurchase(
      account.id,
      account.tenant_id,
      {
        phone: customerPhone,
        email: customerEmail,
        customerName: customerName,
        externalId: invoice.id,
        amountCents: invoice.amount_paid,
        currency: (invoice.currency || 'brl').toUpperCase(),
        productName: productNames || 'Stripe Payment',
        description: `Invoice ${invoice.number || invoice.id}`,
        metadata: {
          stripeInvoiceId: invoice.id,
          stripeCustomerId: invoice.customer,
          invoiceNumber: invoice.number,
          subscriptionId: invoice.subscription,
          source: 'stripe_webhook'
        }
      }
    );

    if (result.duplicate) {
      logger.debug('Duplicate CRM purchase from invoice', { invoiceId: invoice.id });
    } else {
      logger.info('CRM purchase created from Stripe invoice', {
        invoiceId: invoice.id,
        purchaseId: result.purchase?.id,
        contactId: result.contact?.id,
        contactCreated: result.contactCreated,
        amountCents: invoice.amount_paid
      });
    }
  } catch (error) {
    // Log but don't fail the webhook - CRM integration is secondary
    logger.warn('Failed to create CRM purchase from invoice', {
      error: error.message,
      invoiceId: invoice.id
    });
  }
}

/**
 * Create CRM purchase from checkout session
 * Called when checkout.session.completed for one-time payments
 * Requirements: 9.5 (Contact CRM Evolution)
 */
async function createCRMPurchaseFromCheckout(session) {
  try {
    // Skip subscription checkouts (handled via invoice.paid)
    if (session.mode === 'subscription') {
      return;
    }

    // Skip if no amount
    if (!session.amount_total || session.amount_total <= 0) {
      return;
    }

    const metadata = session.metadata || {};
    const { accountId } = metadata;

    if (!accountId) {
      logger.debug('No accountId in checkout metadata, skipping CRM purchase');
      return;
    }

    // Get account tenant
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id, tenant_id')
      .eq('id', accountId)
      .single();

    if (!account) {
      return;
    }

    // Get customer details
    const customerEmail = session.customer_details?.email;
    const customerName = session.customer_details?.name;
    const customerPhone = session.customer_details?.phone;

    // Process webhook purchase
    const result = await ContactPurchaseService.processWebhookPurchase(
      account.id,
      account.tenant_id,
      {
        phone: customerPhone,
        email: customerEmail,
        customerName: customerName,
        externalId: session.id,
        amountCents: session.amount_total,
        currency: (session.currency || 'brl').toUpperCase(),
        productName: metadata.productName || 'Checkout Payment',
        description: `Checkout ${session.id}`,
        metadata: {
          stripeSessionId: session.id,
          stripeCustomerId: session.customer,
          source: 'stripe_checkout'
        }
      }
    );

    if (!result.duplicate) {
      logger.info('CRM purchase created from checkout', {
        sessionId: session.id,
        purchaseId: result.purchase?.id,
        contactId: result.contact?.id
      });
    }
  } catch (error) {
    logger.warn('Failed to create CRM purchase from checkout', {
      error: error.message,
      sessionId: session.id
    });
  }
}

/**
 * Handle customer.subscription.created event
 * Best Practice: Handle subscription creation separately from checkout
 */
async function handleSubscriptionCreated(subscription) {
  logger.info('Processing customer.subscription.created', { 
    subscriptionId: subscription.id,
    customerId: subscription.customer,
    status: subscription.status,
  });

  // Find account by customer ID
  const { data: account } = await SupabaseService.adminClient
    .from('accounts')
    .select('id')
    .eq('stripe_customer_id', subscription.customer)
    .single();

  if (!account) {
    logger.warn('Account not found for subscription', { 
      customerId: subscription.customer,
      subscriptionId: subscription.id,
    });
    return;
  }

  // Check if subscription already exists
  const { data: existingSub } = await SupabaseService.adminClient
    .from('user_subscriptions')
    .select('id')
    .eq('stripe_subscription_id', subscription.id)
    .single();

  if (!existingSub) {
    // Create new subscription record
    await SupabaseService.adminClient
      .from('user_subscriptions')
      .insert({
        account_id: account.id,
        stripe_subscription_id: subscription.id,
        status: subscription.status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      });

    logger.info('Subscription record created from webhook', { 
      accountId: account.id, 
      subscriptionId: subscription.id,
    });
  }
}

/**
 * Handle payment_intent.succeeded event
 * Best Practice: Track successful payments for analytics
 */
async function handlePaymentIntentSucceeded(paymentIntent) {
  logger.info('Processing payment_intent.succeeded', { 
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // Log payment for analytics (optional - can be used for reporting)
  // This is informational - actual subscription/credit updates happen via other events
}

/**
 * Handle payment_intent.payment_failed event
 * Best Practice: Track failed payments for debugging and customer support
 */
async function handlePaymentIntentFailed(paymentIntent) {
  logger.warn('Processing payment_intent.payment_failed', { 
    paymentIntentId: paymentIntent.id,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    lastError: paymentIntent.last_payment_error?.message,
    declineCode: paymentIntent.last_payment_error?.decline_code,
  });

  // Find account by customer ID if available
  if (paymentIntent.customer) {
    const { data: account } = await SupabaseService.adminClient
      .from('accounts')
      .select('id')
      .eq('stripe_customer_id', paymentIntent.customer)
      .single();

    if (account) {
      // TODO: Send notification to user about failed payment
      logger.info('Payment failed for account', { 
        accountId: account.id,
        paymentIntentId: paymentIntent.id,
      });
    }
  }
}

/**
 * POST /api/webhooks/stripe
 * Main webhook endpoint
 */
router.post('/', async (req, res) => {
  const signature = req.headers['stripe-signature'];
  
  if (!signature) {
    logger.warn('Webhook received without signature');
    return res.status(400).json({ error: 'Missing signature' });
  }

  try {
    // Get webhook secret
    const webhookSecret = await getWebhookSecret();
    
    if (!webhookSecret) {
      logger.error('Webhook secret not configured');
      return res.status(500).json({ error: 'Webhook not configured' });
    }

    // Verify signature and construct event
    let event;
    try {
      event = StripeService.verifyWebhookSignature(req.body, signature, webhookSecret);
    } catch (err) {
      logger.error('Webhook signature verification failed', { error: err.message });
      return res.status(400).json({ error: 'Invalid signature' });
    }

    // Check for duplicate events
    const { data: existingEvent } = await SupabaseService.adminClient
      .from('stripe_webhook_events')
      .select('id')
      .eq('stripe_event_id', event.id)
      .single();

    if (existingEvent) {
      logger.info('Duplicate webhook event ignored', { eventId: event.id });
      return res.json({ received: true, duplicate: true });
    }

    // Process event based on type
    // Best Practice: Handle all relevant webhook events for complete payment lifecycle
    try {
      switch (event.type) {
        case 'checkout.session.completed':
          await handleCheckoutCompleted(event.data.object);
          break;

        case 'customer.subscription.created':
          await handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          await handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          await handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        case 'invoice.paid':
          await handleInvoicePaid(event.data.object);
          break;

        case 'payment_intent.succeeded':
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentIntentFailed(event.data.object);
          break;

        default:
          logger.debug('Unhandled webhook event type', { type: event.type });
      }

      // Log successful processing
      await logWebhookEvent(event, true);
      
    } catch (processingError) {
      logger.error('Error processing webhook event', { 
        error: processingError.message,
        eventType: event.type,
        eventId: event.id,
      });
      
      // Log failed processing
      await logWebhookEvent(event, false, processingError.message);
      
      // Still return 200 to prevent Stripe retries for processing errors
      return res.json({ received: true, error: processingError.message });
    }

    res.json({ received: true });
  } catch (error) {
    logger.error('Webhook handler error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
