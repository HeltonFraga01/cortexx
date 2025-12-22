/**
 * Stripe Validators
 * 
 * Zod schemas for validating Stripe-related input.
 * 
 * Requirements: 1.2, 1.4
 */

const { z } = require('zod');

/**
 * Schema for Stripe settings
 */
const stripeSettingsSchema = z.object({
  secretKey: z.string()
    .min(1, 'Secret key is required')
    .refine(val => val.startsWith('sk_'), {
      message: 'Secret key must start with sk_',
    }),
  publishableKey: z.string()
    .min(1, 'Publishable key is required')
    .refine(val => val.startsWith('pk_'), {
      message: 'Publishable key must start with pk_',
    }),
  webhookSecret: z.string()
    .optional()
    .refine(val => !val || val.startsWith('whsec_'), {
      message: 'Webhook secret must start with whsec_',
    }),
  connectEnabled: z.boolean().optional().default(false),
});

/**
 * Schema for webhook secret only
 */
const webhookSecretSchema = z.object({
  webhookSecret: z.string()
    .min(1, 'Webhook secret is required')
    .refine(val => val.startsWith('whsec_'), {
      message: 'Webhook secret must start with whsec_',
    }),
});

/**
 * Schema for checkout session creation
 */
const checkoutSessionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  successUrl: z.string().url('Invalid success URL'),
  cancelUrl: z.string().url('Invalid cancel URL'),
});

/**
 * Schema for credit purchase
 */
const creditPurchaseSchema = z.object({
  packageId: z.string().uuid('Invalid package ID'),
  quantity: z.number().int().positive().optional().default(1),
});

/**
 * Schema for reseller pricing
 */
const resellerPricingSchema = z.object({
  packageId: z.string().uuid('Invalid package ID'),
  customPriceCents: z.number().int().positive('Price must be positive'),
});

/**
 * Schema for affiliate configuration
 */
const affiliateConfigSchema = z.object({
  commissionRate: z.number().min(0).max(1).optional().default(0.10),
  payoutThreshold: z.number().int().positive().optional().default(5000),
  enabled: z.boolean().optional().default(true),
});

/**
 * Validate webhook secret only
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateWebhookSecret(data) {
  return webhookSecretSchema.parse(data);
}

/**
 * Validate Stripe settings
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateStripeSettings(data) {
  return stripeSettingsSchema.parse(data);
}

/**
 * Validate checkout session data
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateCheckoutSession(data) {
  return checkoutSessionSchema.parse(data);
}

/**
 * Validate credit purchase data
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateCreditPurchase(data) {
  return creditPurchaseSchema.parse(data);
}

/**
 * Validate reseller pricing data
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateResellerPricing(data) {
  return resellerPricingSchema.parse(data);
}

/**
 * Validate affiliate config data
 * @param {Object} data - Data to validate
 * @returns {Object} Validated data
 * @throws {z.ZodError} If validation fails
 */
function validateAffiliateConfig(data) {
  return affiliateConfigSchema.parse(data);
}

module.exports = {
  stripeSettingsSchema,
  webhookSecretSchema,
  checkoutSessionSchema,
  creditPurchaseSchema,
  resellerPricingSchema,
  affiliateConfigSchema,
  validateStripeSettings,
  validateWebhookSecret,
  validateCheckoutSession,
  validateCreditPurchase,
  validateResellerPricing,
  validateAffiliateConfig,
};
