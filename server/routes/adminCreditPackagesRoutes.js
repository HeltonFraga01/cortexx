/**
 * Admin Credit Packages Routes
 * 
 * CRUD operations for credit packages (one-time token purchases).
 */

const router = require('express').Router();
const { authenticate, requireAdmin } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SupabaseService = require('../services/SupabaseService');

/**
 * GET /api/admin/credit-packages
 * List all credit packages
 */
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { data: packages, error } = await SupabaseService.adminClient
      .from('plans')
      .select('*')
      .eq('is_credit_package', true)
      .order('credit_amount', { ascending: true });

    if (error) throw error;

    const formatted = (packages || []).map(pkg => ({
      id: pkg.id,
      name: pkg.name,
      description: pkg.description,
      creditAmount: pkg.credit_amount,
      priceCents: pkg.price_cents,
      status: pkg.status,
      stripeProductId: pkg.stripe_product_id,
      stripePriceId: pkg.stripe_price_id,
    }));

    res.json({ success: true, data: formatted });
  } catch (error) {
    logger.error('Failed to list credit packages', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/credit-packages
 * Create a new credit package
 */
router.post('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, creditAmount, priceCents } = req.body;

    if (!name || !creditAmount || creditAmount <= 0 || priceCents < 0) {
      return res.status(400).json({ error: 'Invalid package data' });
    }

    const { data: pkg, error } = await SupabaseService.adminClient
      .from('plans')
      .insert({
        name,
        description: description || null,
        credit_amount: creditAmount,
        price_cents: priceCents,
        is_credit_package: true,
        billing_cycle: 'lifetime', // One-time purchase
        status: 'active',
        quotas: {}, // No quotas for credit packages
        features: {},
      })
      .select()
      .single();

    if (error) throw error;

    logger.info('Credit package created', { packageId: pkg.id, name });

    res.json({
      success: true,
      data: {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        creditAmount: pkg.credit_amount,
        priceCents: pkg.price_cents,
        status: pkg.status,
      },
    });
  } catch (error) {
    logger.error('Failed to create credit package', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/credit-packages/:id
 * Update a credit package
 */
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, creditAmount, priceCents, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (creditAmount !== undefined) updates.credit_amount = creditAmount;
    if (priceCents !== undefined) updates.price_cents = priceCents;
    if (status !== undefined) updates.status = status;
    updates.updated_at = new Date().toISOString();

    const { data: pkg, error } = await SupabaseService.adminClient
      .from('plans')
      .update(updates)
      .eq('id', id)
      .eq('is_credit_package', true)
      .select()
      .single();

    if (error) throw error;
    if (!pkg) {
      return res.status(404).json({ error: 'Credit package not found' });
    }

    logger.info('Credit package updated', { packageId: id });

    res.json({
      success: true,
      data: {
        id: pkg.id,
        name: pkg.name,
        description: pkg.description,
        creditAmount: pkg.credit_amount,
        priceCents: pkg.price_cents,
        status: pkg.status,
      },
    });
  } catch (error) {
    logger.error('Failed to update credit package', { error: error.message, id: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/credit-packages/:id
 * Delete a credit package (soft delete by setting status to inactive)
 */
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await SupabaseService.adminClient
      .from('plans')
      .update({ status: 'inactive', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('is_credit_package', true);

    if (error) throw error;

    logger.info('Credit package deleted', { packageId: id });

    res.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete credit package', { error: error.message, id: req.params.id });
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
