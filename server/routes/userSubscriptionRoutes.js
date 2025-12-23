/**
 * User Subscription Routes
 * 
 * Endpoints for users to view their own subscription, quotas, and features.
 * Uses existing services with user context.
 * 
 * Requirements: 1.1, 1.2, 1.3, 1.5, 6.1, 6.2, 7.1
 */

const express = require('express');
const router = express.Router();
const { requireUser, getUserId, getUserToken } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const SubscriptionService = require('../services/SubscriptionService');
const QuotaService = require('../services/QuotaService');
const FeatureFlagService = require('../services/FeatureFlagService');

// Services initialized at module level (use SupabaseService internally)
const subscriptionService = new SubscriptionService();
const quotaService = new QuotaService();
const featureFlagService = new FeatureFlagService();

/**
 * GET /api/user/subscription
 * Get current user's subscription details
 */
router.get('/subscription', requireUser, async (req, res) => {
  const userId = getUserId(req);
  try {
    
    
    const subscription = await subscriptionService.getUserSubscription(userId);
    
    if (!subscription) {
      return res.status(404).json({
        success: false,
        error: 'Assinatura não encontrada'
      });
    }
    
    res.json({
      success: true,
      data: subscription
    });
  } catch (error) {
    logger.error('Failed to get user subscription', {
      error: error.message,
      userId
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar assinatura'
    });
  }
});

/**
 * GET /api/user/quotas
 * Get current user's quotas with usage
 */
router.get('/quotas', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const userToken = getUserToken(req);
  try {
    
    
    const quotas = await quotaService.getUserQuotas(userId, userToken);
    
    // Add warning and exceeded flags
    const quotasWithStatus = quotas.map(quota => ({
      ...quota,
      warning: quota.percentage >= 80 && quota.percentage < 100,
      exceeded: quota.percentage >= 100
    }));
    
    res.json({
      success: true,
      data: quotasWithStatus
    });
  } catch (error) {
    logger.error('Failed to get user quotas', {
      error: error.message,
      userId
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar quotas'
    });
  }
});

/**
 * GET /api/user/quotas/:quotaType
 * Get specific quota status for current user
 */
router.get('/quotas/:quotaType', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const userToken = getUserToken(req);
  const { quotaType } = req.params;
  try {
    
    
    const status = await quotaService.checkQuota(userId, quotaType, 1, userToken);
    const threshold = await quotaService.checkAlertThreshold(userId, quotaType);
    
    res.json({
      success: true,
      data: {
        ...status,
        warning: threshold.nearThreshold,
        exceeded: status.usage >= status.limit
      }
    });
  } catch (error) {
    logger.error('Failed to get quota status', {
      error: error.message,
      userId,
      quotaType
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar quota'
    });
  }
});

/**
 * GET /api/user/features
 * Get current user's features
 */
router.get('/features', requireUser, async (req, res) => {
  const userId = getUserId(req);
  try {
    
    
    const features = await featureFlagService.getUserFeatures(userId);
    
    res.json({
      success: true,
      data: features
    });
  } catch (error) {
    logger.error('Failed to get user features', {
      error: error.message,
      userId
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar features'
    });
  }
});

/**
 * GET /api/user/features/:featureName
 * Check if a specific feature is enabled for current user
 */
router.get('/features/:featureName', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const { featureName } = req.params;
  try {
    
    
    const enabled = await featureFlagService.isFeatureEnabled(userId, featureName);
    const features = await featureFlagService.getUserFeatures(userId);
    const feature = features.find(f => f.featureName === featureName);
    
    res.json({
      success: true,
      data: {
        featureName,
        enabled,
        source: feature?.source || 'plan'
      }
    });
  } catch (error) {
    logger.error('Failed to check feature', {
      error: error.message,
      userId,
      featureName
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao verificar feature'
    });
  }
});

/**
 * GET /api/user/account-summary
 * Get a summary of subscription, quotas, and features for dashboard
 * 
 * Always returns consistent data structure even when user has no subscription.
 * Uses SubscriptionEnsurer to assign default plan if missing.
 * 
 * Requirements: 3.1, 3.2, 3.3, 3.4, 5.2, 5.3
 */
router.get('/account-summary', requireUser, async (req, res) => {
  const userId = getUserId(req);
  const userToken = getUserToken(req);
  try {
    
    // Ensure user has a subscription (assign default plan if missing)
    const SubscriptionEnsurer = require('../services/SubscriptionEnsurer');
    const subscriptionEnsurer = new SubscriptionEnsurer(null);
    
    // Fetch data with error handling for each service
    let subscription = null;
    let quotas = [];
    let features = [];
    
    try {
      // First ensure subscription exists, then get it
      await subscriptionEnsurer.ensureSubscription(userId);
      subscription = await subscriptionService.getUserSubscription(userId);
    } catch (err) {
      logger.warn('Failed to get subscription, using defaults', { userId, error: err.message });
    }
    
    try {
      // Pass userToken for accurate resource counting (webhooks, campaigns, bots)
      quotas = await quotaService.getUserQuotas(userId, userToken);
    } catch (err) {
      logger.warn('Failed to get quotas, using defaults', { userId, error: err.message });
      // Return default quotas structure if service fails
      const defaultQuotas = await subscriptionEnsurer.getDefaultQuotas();
      quotas = Object.entries(defaultQuotas).map(([key, value]) => ({
        quotaType: key.replace(/([A-Z])/g, '_$1').toLowerCase().replace(/^_/, ''),
        limit: value,
        currentUsage: 0,
        percentage: 0,
        remaining: value,
        allowed: true,
        source: 'plan',
        overrideReason: null
      }));
    }
    
    try {
      features = await featureFlagService.getUserFeatures(userId);
    } catch (err) {
      logger.warn('Failed to get features, using defaults', { userId, error: err.message });
    }
    
    // Calculate summary stats with warning and exceeded flags
    const quotasWithStatus = quotas.map(quota => ({
      ...quota,
      warning: quota.percentage >= 80 && quota.percentage < 100,
      exceeded: quota.percentage >= 100
    }));
    
    const warningQuotas = quotasWithStatus.filter(q => q.warning).length;
    const exceededQuotas = quotasWithStatus.filter(q => q.exceeded).length;
    const enabledFeatures = features.filter(f => f.enabled).length;
    const totalFeatures = features.length;
    
    res.json({
      success: true,
      data: {
        subscription,
        quotas: quotasWithStatus,
        features,
        summary: {
          planName: subscription?.plan?.name || 'Plano Gratuito',
          status: subscription?.status || 'active',
          warningQuotas,
          exceededQuotas,
          enabledFeatures,
          totalFeatures
        }
      }
    });
  } catch (error) {
    logger.error('Failed to get account summary', {
      error: error.message,
      stack: error.stack,
      userId
    });
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar resumo da conta'
    });
  }
});

module.exports = router;
