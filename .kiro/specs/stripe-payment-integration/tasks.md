# Implementation Plan: Stripe Payment Integration

## Overview
This plan implements complete Stripe integration for WUZAPI Manager including subscriptions, billing credits, Stripe Connect for resellers, and affiliate system.

---

## Phase 1: Core Infrastructure

- [x] 1. Database Schema Extensions
  - [x] 1.1 Create migration to extend plans table with stripe_product_id, stripe_price_id, is_credit_package, credit_amount columns
    - _Requirements: 2.4_
  - [x] 1.2 Create migration to extend accounts table with stripe_customer_id, stripe_account_id, is_reseller, reseller_credit_balance, affiliate_id, referred_by columns
    - _Requirements: 3.2, 9.2, 11.3_
  - [x] 1.3 Create migration to extend user_subscriptions table with stripe_subscription_id, cancel_at_period_end columns
    - _Requirements: 3.1, 4.3_
  - [x] 1.4 Create credit_transactions table for credit purchase/usage tracking
    - _Requirements: 6.2, 6.3_
  - [x] 1.5 Create affiliate_referrals table for referral tracking
    - _Requirements: 12.2_
  - [x] 1.6 Create stripe_webhook_events table for webhook audit logging
    - _Requirements: 5.7_
  - [x] 1.7 Create reseller_pricing table for custom reseller pricing
    - _Requirements: 14.1_

- [x] 2. Stripe SDK Setup and Core Service
  - [x] 2.1 Install stripe npm package in server
    - _Requirements: 1.1_
  - [x] 2.2 Create server/utils/stripeClient.js wrapper for Stripe SDK initialization
    - _Requirements: 1.2, 1.3_
  - [x] 2.3 Create server/services/StripeService.js with core operations (validateApiKeys, createCustomer, getCustomer, createProduct, createPrice, archiveProduct, archivePrice, createCheckoutSession, createBillingPortalSession, verifyWebhookSignature)
    - _Requirements: 1.2, 2.1, 3.1, 5.6_
  - [ ]* 2.4 Write property test for secret key masking (Property 1)
    - **Property 1: Secret Key Masking**
    - **Validates: Requirements 1.5**
  - [ ]* 2.5 Write property test for credential persistence round-trip (Property 2)
    - **Property 2: Credential Persistence Round-Trip**
    - **Validates: Requirements 1.3**

- [ ] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: Admin Stripe Configuration

- [x] 4. Admin Stripe Settings Backend
  - [x] 4.1 Create server/routes/adminStripeRoutes.js with endpoints for settings CRUD and test connection
    - POST /api/admin/stripe/settings - Save Stripe API keys
    - GET /api/admin/stripe/settings - Get Stripe settings (masked)
    - POST /api/admin/stripe/test-connection - Test API connection
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  - [x] 4.2 Create server/validators/stripeValidator.js for input validation
    - _Requirements: 1.2, 1.4_
  - [x] 4.3 Implement encrypted storage of Stripe secret key in global_settings table
    - _Requirements: 1.3_
  - [x] 4.4 Register adminStripeRoutes in server/index.js (main entry point)
    - _Requirements: 1.1_
    - _Note: Routes registered directly in server/index.js, not server/routes/index.js_

- [x] 5. Admin Stripe Settings Frontend
  - [x] 5.1 Create src/types/stripe.ts with TypeScript interfaces (StripeSettings, Subscription, PaymentMethod, CreditBalance, etc.)
    - _Requirements: 1.1_
  - [x] 5.2 Create src/services/stripe.ts frontend API client
    - _Requirements: 1.1_
  - [x] 5.3 Create src/components/admin/stripe/StripeSettings.tsx for API keys configuration
    - _Requirements: 1.1, 1.5, 1.6_
  - [x] 5.4 Add Stripe settings to admin dashboard navigation
    - _Requirements: 1.1_

- [x] 6. Plan-Stripe Sync
  - [x] 6.1 Extend PlanService.js with Stripe sync methods (syncPlanToStripe, archivePlanInStripe)
    - _Requirements: 2.1, 2.2, 2.3_
  - [x] 6.2 Add POST /api/admin/stripe/sync-plans endpoint to adminStripeRoutes.js
    - _Requirements: 2.1, 2.4_
  - [x] 6.3 Create src/components/admin/stripe/PlanSync.tsx component for plan synchronization UI
    - _Requirements: 2.4, 2.5_
  - [ ]* 6.4 Write property test for plan-product sync invariant (Property 3)
    - **Property 3: Plan-Product Sync Invariant**
    - **Validates: Requirements 2.4**

- [x] 7. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: User Subscription Flow

- [x] 8. Subscription Service Backend
  - [x] 8.1 Extend server/services/SubscriptionService.js with Stripe integration methods (createSubscriptionCheckout, syncSubscriptionFromWebhook, cancelSubscription, reactivateSubscription)
    - _Requirements: 3.1, 3.2, 4.3, 4.5_
  - [x] 8.2 Create server/routes/userBillingRoutes.js with subscription endpoints
    - GET /api/user/subscription - Get current subscription
    - POST /api/user/subscription/checkout - Create subscription checkout
    - POST /api/user/subscription/change - Change plan
    - POST /api/user/subscription/cancel - Cancel subscription
    - POST /api/user/subscription/reactivate - Reactivate subscription
    - _Requirements: 3.1, 4.1, 4.2, 4.3, 4.5_
  - [x] 8.3 Register userBillingRoutes in server/routes/index.js
    - _Requirements: 3.1_
  - [ ]* 8.4 Write property test for checkout session customer invariant (Property 4)
    - **Property 4: Checkout Session Customer Invariant**
    - **Validates: Requirements 3.2**
  - [ ]* 8.5 Write property test for cancel preserves state (Property 5)
    - **Property 5: Cancel Preserves State**
    - **Validates: Requirements 3.5**
  - [ ]* 8.6 Write property test for subscription access until period end (Property 6)
    - **Property 6: Subscription Access Until Period End**
    - **Validates: Requirements 4.4**

- [x] 9. Subscription Frontend
  - [x] 9.1 Create src/components/user/billing/SubscriptionManager.tsx for subscription management
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  - [x] 9.2 Update src/components/user/SubscriptionCard.tsx to integrate with Stripe checkout
    - _Requirements: 3.3, 3.4, 3.5_
  - [x] 9.3 Add subscription management to user account settings
    - _Requirements: 4.1_

- [x] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Stripe Webhooks

- [x] 11. Webhook Handler Backend
  - [x] 11.1 Create server/routes/stripeWebhookRoutes.js with POST /api/webhooks/stripe endpoint
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7_
  - [x] 11.2 Implement webhook signature verification using Stripe SDK
    - _Requirements: 5.6_
  - [x] 11.3 Implement checkout.session.completed handler to activate subscriptions
    - _Requirements: 5.1_
  - [x] 11.4 Implement customer.subscription.updated handler to sync subscription changes
    - _Requirements: 5.2_
  - [x] 11.5 Implement customer.subscription.deleted handler to mark subscriptions canceled
    - _Requirements: 5.3_
  - [x] 11.6 Implement invoice.payment_failed handler to update status and notify user
    - _Requirements: 5.4_
  - [x] 11.7 Implement invoice.paid handler for credit purchases
    - _Requirements: 5.5_
  - [x] 11.8 Implement webhook event logging to stripe_webhook_events table
    - _Requirements: 5.7_
  - [x] 11.9 Register stripeWebhookRoutes in server/index.js (without auth middleware)
    - _Requirements: 5.1_
    - _Note: Routes registered directly in server/index.js at /api/webhooks/stripe_
  - [ ]* 11.10 Write property test for webhook signature verification (Property 7)
    - **Property 7: Webhook Signature Verification**
    - **Validates: Requirements 5.6**
  - [ ]* 11.11 Write property test for webhook audit logging (Property 8)
    - **Property 8: Webhook Audit Logging**
    - **Validates: Requirements 5.7**

- [x] 12. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 5: Billing Credits System

- [x] 13. Credit Service Backend
  - [x] 13.1 Create server/services/CreditService.js with credit operations (createCreditPurchaseCheckout, grantCredits, getCreditBalance, recordUsage, checkLowBalance, canConsumeCredits)
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6_
  - [x] 13.2 Add credit endpoints to userBillingRoutes.js
    - GET /api/user/credits - Get credit balance
    - POST /api/user/credits/purchase - Purchase credits
    - _Requirements: 6.1, 6.4_
  - [ ]* 13.3 Write property test for credit grant on purchase (Property 9)
    - **Property 9: Credit Grant on Purchase**
    - **Validates: Requirements 5.5, 6.2**
  - [ ]* 13.4 Write property test for meter event on consumption (Property 10)
    - **Property 10: Meter Event on Consumption**
    - **Validates: Requirements 6.3**
  - [ ]* 13.5 Write property test for credit balance consistency (Property 11)
    - **Property 11: Credit Balance Consistency**
    - **Validates: Requirements 6.4**
  - [ ]* 13.6 Write property test for zero credits blocks consumption (Property 12)
    - **Property 12: Zero Credits Blocks Consumption**
    - **Validates: Requirements 6.6**

- [x] 14. Credit Frontend
  - [x] 14.1 Create src/components/user/billing/CreditBalance.tsx for credit balance display
    - _Requirements: 6.4, 6.5_
  - [x] 14.2 Create src/components/user/billing/CreditPurchase.tsx for credit package purchase
    - _Requirements: 6.1_
  - [x] 14.3 Integrate credit balance into user dashboard
    - _Requirements: 6.4_

- [x] 15. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 6: Billing History and Payment Methods

- [x] 16. Billing History Backend
  - [x] 16.1 Add billing history endpoints to userBillingRoutes.js
    - GET /api/user/billing/history - Get invoice history
    - POST /api/user/billing/portal - Create billing portal session
    - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2_

- [x] 17. Billing History Frontend
  - [x] 17.1 Create src/components/user/billing/BillingHistory.tsx for invoice history display
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  - [x] 17.2 Add billing history tab to user account settings
    - _Requirements: 7.1_

- [x] 18. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 7: Stripe Connect for Resellers

- [x] 19. Connect Service Backend
  - [x] 19.1 Create server/services/ConnectService.js with Connect operations (createConnectAccount, createAccountLink, getAccountStatus, createResellerProduct, createResellerPrice, createDestinationCharge, createLoginLink)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 10.1, 10.2_
  - [x] 19.2 Create server/routes/resellerRoutes.js with reseller endpoints
    - POST /api/reseller/connect/onboard - Start Connect onboarding
    - GET /api/reseller/connect/status - Get Connect account status
    - POST /api/reseller/connect/dashboard - Get Express Dashboard link
    - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - [x] 19.3 Register resellerRoutes in server/routes/index.js
    - _Requirements: 9.1_
  - [ ]* 19.4 Write property test for destination charge for reseller sales (Property 13)
    - **Property 13: Destination Charge for Reseller Sales**
    - **Validates: Requirements 10.2**
  - [ ]* 19.5 Write property test for application fee on reseller sales (Property 14)
    - **Property 14: Application Fee on Reseller Sales**
    - **Validates: Requirements 10.3**

- [x] 20. Connect Frontend
  - [x] 20.1 Create src/components/reseller/ConnectOnboarding.tsx for Stripe Connect setup
    - _Requirements: 9.1, 9.2, 9.5_
  - [x] 20.2 Create reseller dashboard page with Connect status
    - _Requirements: 9.3, 9.4_

- [x] 21. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 8: Reseller Sales and Wholesale

- [x] 22. Reseller Sales Backend
  - [x] 22.1 Add reseller sales endpoints to resellerRoutes.js
    - GET /api/reseller/wholesale/packages - Get wholesale packages
    - POST /api/reseller/wholesale/purchase - Purchase wholesale credits
    - GET /api/reseller/pricing - Get reseller pricing
    - PUT /api/reseller/pricing - Update reseller pricing
    - GET /api/reseller/sales - Get sales history
    - POST /api/reseller/customer/checkout - Create checkout for reseller's customer
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5, 11.1, 11.2, 11.3, 11.4, 11.5, 14.1, 14.2, 14.3, 14.4, 14.5_
  - [ ]* 22.2 Write property test for reseller balance deduction (Property 15)
    - **Property 15: Reseller Balance Deduction**
    - **Validates: Requirements 10.4, 11.4**
  - [ ]* 22.3 Write property test for wholesale purchase adds credits (Property 16)
    - **Property 16: Wholesale Purchase Adds Credits**
    - **Validates: Requirements 11.3**
  - [ ]* 22.4 Write property test for reseller price validation (Property 17)
    - **Property 17: Reseller Price Validation**
    - **Validates: Requirements 14.2**

- [x] 23. Reseller Sales Frontend
  - [x] 23.1 Create src/components/reseller/WholesalePurchase.tsx for bulk credit purchase
    - _Requirements: 11.1, 11.2_
  - [x] 23.2 Create src/components/reseller/ResellerPricing.tsx for custom pricing configuration
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_
  - [x] 23.3 Create src/components/reseller/ResellerSales.tsx for sales dashboard
    - _Requirements: 10.5_

- [x] 24. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 9: Affiliate System

- [x] 25. Affiliate Service Backend
  - [x] 25.1 Create server/services/AffiliateService.js with affiliate operations (registerAffiliate, trackReferral, calculateCommission, processAffiliateSale, getAffiliateEarnings, processPayouts)
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  - [x] 25.2 Add affiliate configuration endpoint to adminStripeRoutes.js
    - POST /api/admin/stripe/affiliate-config - Configure affiliate program
    - _Requirements: 12.1_
  - [x] 25.3 Add affiliate endpoints to resellerRoutes.js
    - GET /api/reseller/affiliate/earnings - Get affiliate earnings
    - _Requirements: 12.4_
  - [ ]* 25.4 Write property test for affiliate commission calculation (Property 18)
    - **Property 18: Affiliate Commission Calculation**
    - **Validates: Requirements 12.2**
  - [ ]* 25.5 Write property test for affiliate payment split (Property 19)
    - **Property 19: Affiliate Payment Split**
    - **Validates: Requirements 12.3**

- [x] 26. Affiliate Frontend
  - [x] 26.1 Create src/components/admin/stripe/AffiliateConfig.tsx for affiliate program configuration
    - _Requirements: 12.1_
  - [x] 26.2 Add affiliate earnings display to reseller dashboard
    - _Requirements: 12.4_

- [x] 27. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 10: Payment Analytics

- [x] 28. Analytics Backend
  - [x] 28.1 Add payment analytics endpoint to adminStripeRoutes.js
    - GET /api/admin/stripe/analytics - Payment analytics
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_

- [x] 29. Analytics Frontend
  - [x] 29.1 Create src/components/admin/stripe/PaymentAnalytics.tsx for revenue analytics dashboard
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - [x] 29.2 Add analytics to admin dashboard
    - _Requirements: 13.1_

- [x] 30. Final Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- All backend routes use CommonJS (`require()`) as per project standards
- All frontend components use TypeScript with `@/` alias imports
- Stripe test mode keys (`sk_test_`, `pk_test_`) should be used for development
- Webhook endpoint must be registered without auth middleware to receive Stripe events
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
