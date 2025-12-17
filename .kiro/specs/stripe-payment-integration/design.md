# Design Document: Stripe Payment Integration

## Overview

Este documento descreve o design técnico para integração completa do Stripe como sistema de pagamentos do WUZAPI Manager. A arquitetura suporta:

1. **Pagamentos de assinatura** - Checkout Sessions para planos recorrentes
2. **Sistema de créditos** - Billing Credits para consumo de recursos
3. **Marketplace de revendedores** - Stripe Connect para modelo de revenda
4. **Sistema de afiliados** - Split de pagamentos com comissões

A integração segue as melhores práticas do Stripe:
- Checkout Sessions para fluxos de pagamento (nunca Charges API)
- Billing Portal para gerenciamento de métodos de pagamento
- Webhooks para sincronização em tempo real
- Stripe Connect com destination charges para marketplace

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WUZAPI Manager                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  Frontend (React)                                                            │
│  ├── src/components/admin/stripe/          # Admin Stripe settings          │
│  │   ├── StripeSettings.tsx                # API keys configuration         │
│  │   ├── PlanSync.tsx                      # Plan-Product sync              │
│  │   ├── AffiliateConfig.tsx               # Affiliate program config       │
│  │   └── PaymentAnalytics.tsx              # Revenue analytics              │
│  ├── src/components/user/billing/          # User billing components        │
│  │   ├── SubscriptionManager.tsx           # Subscription management        │
│  │   ├── CreditBalance.tsx                 # Credit balance display         │
│  │   ├── CreditPurchase.tsx                # Credit package purchase        │
│  │   └── BillingHistory.tsx                # Invoice history                │
│  ├── src/components/reseller/              # Reseller components            │
│  │   ├── ConnectOnboarding.tsx             # Stripe Connect setup           │
│  │   ├── WholesalePurchase.tsx             # Bulk credit purchase           │
│  │   ├── ResellerPricing.tsx               # Custom pricing config          │
│  │   └── ResellerSales.tsx                 # Sales dashboard                │
│  └── src/services/stripe.ts                # Stripe API client              │
│                                                                              │
│  Backend (Node.js + Express)                                                 │
│  ├── server/routes/                                                          │
│  │   ├── adminStripeRoutes.js              # Admin Stripe endpoints         │
│  │   ├── userBillingRoutes.js              # User billing endpoints         │
│  │   ├── resellerRoutes.js                 # Reseller endpoints             │
│  │   └── stripeWebhookRoutes.js            # Webhook handler                │
│  ├── server/services/                                                        │
│  │   ├── StripeService.js                  # Core Stripe operations         │
│  │   ├── SubscriptionService.js            # Subscription management        │
│  │   ├── CreditService.js                  # Credit/billing credits         │
│  │   ├── ConnectService.js                 # Stripe Connect operations      │
│  │   └── AffiliateService.js               # Affiliate commissions          │
│  └── server/utils/                                                           │
│      └── stripeClient.js                   # Stripe SDK wrapper             │
│                                                                              │
│  Database (Supabase/PostgreSQL)                                              │
│  ├── global_settings                       # Stripe API keys (encrypted)    │
│  ├── plans                                 # + stripe_product_id, stripe_price_id │
│  ├── accounts                              # + stripe_customer_id, stripe_account_id │
│  ├── subscriptions                         # + stripe_subscription_id       │
│  ├── credit_transactions                   # Credit purchase/usage log      │
│  ├── affiliate_referrals                   # Referral tracking              │
│  └── webhook_events                        # Webhook audit log              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Stripe APIs                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│  • Checkout Sessions API      - Payment pages                                │
│  • Customers API              - Customer management                          │
│  • Products/Prices API        - Plan synchronization                         │
│  • Subscriptions API          - Recurring billing                            │
│  • Billing Credits API        - Credit grants and meters                     │
│  • Billing Portal API         - Self-service portal                          │
│  • Connect API                - Marketplace/reseller accounts                │
│  • Webhooks                   - Real-time event notifications                │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### Backend Services

#### StripeService.js
```javascript
/**
 * Core Stripe operations wrapper
 */
class StripeService {
  // Configuration
  async validateApiKeys(secretKey, publishableKey)
  async getAccountInfo()
  
  // Customers
  async createCustomer(email, name, metadata)
  async getCustomer(customerId)
  async updateCustomer(customerId, data)
  
  // Products & Prices
  async createProduct(name, description, metadata)
  async createPrice(productId, unitAmount, currency, recurring)
  async archiveProduct(productId)
  async archivePrice(priceId)
  
  // Checkout
  async createCheckoutSession(options)
  async createBillingPortalSession(customerId, returnUrl)
  
  // Webhooks
  async verifyWebhookSignature(payload, signature, secret)
}
```

#### SubscriptionService.js
```javascript
/**
 * Subscription lifecycle management
 */
class SubscriptionService {
  async createSubscriptionCheckout(userId, planId)
  async changePlan(userId, newPlanId)
  async cancelSubscription(userId, cancelAtPeriodEnd)
  async reactivateSubscription(userId)
  async getSubscriptionDetails(userId)
  async syncSubscriptionFromWebhook(stripeSubscription)
}
```

#### CreditService.js
```javascript
/**
 * Billing credits and usage metering
 */
class CreditService {
  // Credit Grants
  async createCreditPurchaseCheckout(userId, packageId)
  async grantCredits(userId, amount, category, expiresAt)
  async getCreditBalance(userId)
  
  // Usage Metering
  async recordUsage(userId, meterId, quantity, timestamp)
  async getUsageSummary(userId, startDate, endDate)
  
  // Notifications
  async checkLowBalance(userId, threshold)
  async canConsumeCredits(userId, amount)
}
```

#### ConnectService.js
```javascript
/**
 * Stripe Connect for resellers
 */
class ConnectService {
  // Onboarding
  async createConnectAccount(userId, email)
  async createAccountLink(accountId, returnUrl, refreshUrl)
  async getAccountStatus(accountId)
  
  // Reseller Operations
  async createResellerProduct(accountId, name, description)
  async createResellerPrice(accountId, productId, amount, currency)
  async createDestinationCharge(amount, currency, destinationAccountId, applicationFee)
  
  // Express Dashboard
  async createLoginLink(accountId)
}
```

#### AffiliateService.js
```javascript
/**
 * Affiliate program management
 */
class AffiliateService {
  async registerAffiliate(userId)
  async trackReferral(affiliateId, referredUserId)
  async calculateCommission(purchaseAmount, commissionRate)
  async processAffiliateSale(paymentIntentId, affiliateId)
  async getAffiliateEarnings(affiliateId)
  async processPayouts(affiliateId)
}
```

### Frontend Services

#### src/services/stripe.ts
```typescript
/**
 * Frontend Stripe API client
 */
export const stripeService = {
  // Subscriptions
  createSubscriptionCheckout: (planId: string) => Promise<{ url: string }>
  getSubscription: () => Promise<Subscription>
  changePlan: (newPlanId: string) => Promise<{ url: string }>
  cancelSubscription: () => Promise<void>
  
  // Credits
  getCreditBalance: () => Promise<CreditBalance>
  purchaseCredits: (packageId: string) => Promise<{ url: string }>
  
  // Billing
  getBillingHistory: (page: number) => Promise<Invoice[]>
  openBillingPortal: () => Promise<{ url: string }>
  
  // Reseller
  startConnectOnboarding: () => Promise<{ url: string }>
  getConnectStatus: () => Promise<ConnectStatus>
  purchaseWholesale: (packageId: string) => Promise<{ url: string }>
  updateResellerPricing: (pricing: ResellerPricing) => Promise<void>
}
```

### API Endpoints

#### Admin Stripe Routes
```
POST   /api/admin/stripe/settings          # Save Stripe API keys
GET    /api/admin/stripe/settings          # Get Stripe settings (masked)
POST   /api/admin/stripe/test-connection   # Test API connection
POST   /api/admin/stripe/sync-plans        # Sync plans with Stripe
GET    /api/admin/stripe/analytics         # Payment analytics
POST   /api/admin/stripe/affiliate-config  # Configure affiliate program
```

#### User Billing Routes
```
GET    /api/user/subscription              # Get current subscription
POST   /api/user/subscription/checkout     # Create subscription checkout
POST   /api/user/subscription/change       # Change plan
POST   /api/user/subscription/cancel       # Cancel subscription
POST   /api/user/subscription/reactivate   # Reactivate subscription
GET    /api/user/credits                   # Get credit balance
POST   /api/user/credits/purchase          # Purchase credits
GET    /api/user/billing/history           # Get invoice history
POST   /api/user/billing/portal            # Create billing portal session
```

#### Reseller Routes
```
POST   /api/reseller/connect/onboard       # Start Connect onboarding
GET    /api/reseller/connect/status        # Get Connect account status
POST   /api/reseller/connect/dashboard     # Get Express Dashboard link
GET    /api/reseller/wholesale/packages    # Get wholesale packages
POST   /api/reseller/wholesale/purchase    # Purchase wholesale credits
GET    /api/reseller/pricing               # Get reseller pricing
PUT    /api/reseller/pricing               # Update reseller pricing
GET    /api/reseller/sales                 # Get sales history
POST   /api/reseller/customer/checkout     # Create checkout for reseller's customer
```

#### Webhook Routes
```
POST   /api/webhooks/stripe                # Main Stripe webhook endpoint
```

## Data Models

### Database Schema Extensions

```sql
-- Extend plans table
ALTER TABLE plans ADD COLUMN stripe_product_id VARCHAR(255);
ALTER TABLE plans ADD COLUMN stripe_price_id VARCHAR(255);
ALTER TABLE plans ADD COLUMN is_credit_package BOOLEAN DEFAULT FALSE;
ALTER TABLE plans ADD COLUMN credit_amount INTEGER;

-- Extend accounts table
ALTER TABLE accounts ADD COLUMN stripe_customer_id VARCHAR(255);
ALTER TABLE accounts ADD COLUMN stripe_account_id VARCHAR(255); -- For Connect
ALTER TABLE accounts ADD COLUMN is_reseller BOOLEAN DEFAULT FALSE;
ALTER TABLE accounts ADD COLUMN reseller_credit_balance INTEGER DEFAULT 0;
ALTER TABLE accounts ADD COLUMN affiliate_id VARCHAR(255);
ALTER TABLE accounts ADD COLUMN referred_by VARCHAR(255);

-- Subscriptions table (new or extend existing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  plan_id UUID REFERENCES plans(id),
  stripe_subscription_id VARCHAR(255) UNIQUE,
  status VARCHAR(50) NOT NULL, -- active, past_due, canceled, trialing
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  canceled_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit transactions
CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES accounts(id),
  type VARCHAR(50) NOT NULL, -- purchase, grant, consumption, transfer
  amount INTEGER NOT NULL, -- positive for credit, negative for debit
  balance_after INTEGER NOT NULL,
  stripe_credit_grant_id VARCHAR(255),
  stripe_invoice_id VARCHAR(255),
  description TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Affiliate referrals
CREATE TABLE affiliate_referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  affiliate_account_id UUID REFERENCES accounts(id),
  referred_account_id UUID REFERENCES accounts(id),
  status VARCHAR(50) DEFAULT 'pending', -- pending, converted, paid
  commission_rate DECIMAL(5,4) DEFAULT 0.10, -- 10%
  total_commission_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Webhook events log
CREATE TABLE webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id VARCHAR(255) UNIQUE,
  event_type VARCHAR(100) NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT FALSE,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reseller pricing
CREATE TABLE reseller_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reseller_account_id UUID REFERENCES accounts(id),
  base_package_id UUID REFERENCES plans(id),
  custom_price_cents INTEGER NOT NULL,
  stripe_price_id VARCHAR(255),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### TypeScript Interfaces

```typescript
// src/types/stripe.ts

export interface StripeSettings {
  secretKeyMasked: string
  publishableKey: string
  webhookSecretMasked: string
  connectEnabled: boolean
  isConfigured: boolean
}

export interface Subscription {
  id: string
  planId: string
  planName: string
  status: 'active' | 'past_due' | 'canceled' | 'trialing'
  currentPeriodStart: string
  currentPeriodEnd: string
  cancelAtPeriodEnd: boolean
  paymentMethod?: PaymentMethod
}

export interface PaymentMethod {
  brand: string
  last4: string
  expMonth: number
  expYear: number
}

export interface CreditBalance {
  available: number
  pending: number
  currency: string
  lowBalanceThreshold: number
  isLow: boolean
}

export interface CreditPackage {
  id: string
  name: string
  creditAmount: number
  priceCents: number
  currency: string
  isWholesale: boolean
  volumeDiscount?: number
}

export interface Invoice {
  id: string
  stripeInvoiceId: string
  amount: number
  currency: string
  status: 'paid' | 'open' | 'void' | 'uncollectible'
  pdfUrl: string
  createdAt: string
}

export interface ConnectStatus {
  accountId: string
  chargesEnabled: boolean
  payoutsEnabled: boolean
  detailsSubmitted: boolean
  requiresAction: boolean
  dashboardUrl?: string
}

export interface ResellerPricing {
  packageId: string
  packageName: string
  wholesaleCost: number
  customPrice: number
  profitMargin: number
  platformFee: number
}

export interface AffiliateEarnings {
  totalEarned: number
  pendingPayout: number
  paidOut: number
  referralCount: number
  conversionRate: number
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

Based on the prework analysis, the following correctness properties have been identified:

### Property 1: Secret Key Masking
*For any* Stripe secret key string, the masked output SHALL show only the last 4 characters preceded by asterisks.
**Validates: Requirements 1.5**

### Property 2: Credential Persistence Round-Trip
*For any* valid Stripe credentials, saving and then retrieving SHALL return the same decrypted values.
**Validates: Requirements 1.3**

### Property 3: Plan-Product Sync Invariant
*For any* plan that has been synced, the plan SHALL have a non-null stripe_price_id stored in the database.
**Validates: Requirements 2.4**

### Property 4: Checkout Session Customer Invariant
*For any* Checkout Session created, the session SHALL have a valid stripe_customer_id (either existing or newly created).
**Validates: Requirements 3.2**

### Property 5: Cancel Preserves State
*For any* user who cancels payment during checkout, the subscription state SHALL remain unchanged from before the checkout attempt.
**Validates: Requirements 3.5**

### Property 6: Subscription Access Until Period End
*For any* canceled subscription, the user SHALL maintain access until current_period_end timestamp.
**Validates: Requirements 4.4**

### Property 7: Webhook Signature Verification
*For any* webhook payload, valid Stripe signatures SHALL pass verification and invalid signatures SHALL be rejected.
**Validates: Requirements 5.6**

### Property 8: Webhook Audit Logging
*For any* processed webhook event, a corresponding entry SHALL exist in the webhook_events table.
**Validates: Requirements 5.7**

### Property 9: Credit Grant on Purchase
*For any* completed credit purchase (invoice.paid), a Credit Grant SHALL be created with the correct amount.
**Validates: Requirements 5.5, 6.2**

### Property 10: Meter Event on Consumption
*For any* resource consumption (message sent, agent usage), a meter event SHALL be sent to Stripe.
**Validates: Requirements 6.3**

### Property 11: Credit Balance Consistency
*For any* user, the displayed credit balance SHALL match the Credit Balance Summary from Stripe.
**Validates: Requirements 6.4**

### Property 12: Zero Credits Blocks Consumption
*For any* user with zero credit balance, consumption-based features SHALL be restricted.
**Validates: Requirements 6.6**

### Property 13: Destination Charge for Reseller Sales
*For any* purchase from a reseller's customer, the Checkout Session SHALL use destination charge to the reseller's connected account.
**Validates: Requirements 10.2**

### Property 14: Application Fee on Reseller Sales
*For any* reseller sale, the platform application fee SHALL be applied according to admin configuration.
**Validates: Requirements 10.3**

### Property 15: Reseller Balance Deduction
*For any* reseller sale, the sold credit amount SHALL be deducted from the reseller's credit_balance.
**Validates: Requirements 10.4, 11.4**

### Property 16: Wholesale Purchase Adds Credits
*For any* completed wholesale purchase, the credit amount SHALL be added to the reseller's credit_balance.
**Validates: Requirements 11.3**

### Property 17: Reseller Price Validation
*For any* reseller price configuration, the price SHALL be greater than or equal to wholesale cost plus platform fee.
**Validates: Requirements 14.2**

### Property 18: Affiliate Commission Calculation
*For any* referred purchase, the affiliate commission SHALL equal purchase_amount * commission_rate.
**Validates: Requirements 12.2**

### Property 19: Affiliate Payment Split
*For any* affiliate sale, the payment SHALL be split between platform and affiliate according to commission rate.
**Validates: Requirements 12.3**

## Error Handling

### Stripe API Errors
```javascript
// server/utils/stripeErrorHandler.js
function handleStripeError(error) {
  const errorMap = {
    'card_declined': { status: 400, message: 'Card was declined' },
    'expired_card': { status: 400, message: 'Card has expired' },
    'incorrect_cvc': { status: 400, message: 'Incorrect CVC' },
    'processing_error': { status: 500, message: 'Processing error, please try again' },
    'rate_limit': { status: 429, message: 'Too many requests, please wait' },
    'invalid_api_key': { status: 401, message: 'Invalid API configuration' },
    'resource_missing': { status: 404, message: 'Resource not found' }
  }
  
  const mapped = errorMap[error.code] || { status: 500, message: 'Payment error' }
  return { ...mapped, stripeCode: error.code }
}
```

### Webhook Error Handling
```javascript
// Retry logic for failed webhook processing
async function processWebhookWithRetry(event, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      await processWebhookEvent(event)
      return { success: true }
    } catch (error) {
      if (attempt === maxRetries) {
        await logWebhookError(event, error)
        throw error
      }
      await delay(Math.pow(2, attempt) * 1000) // Exponential backoff
    }
  }
}
```

### Credit Consumption Errors
```javascript
// Graceful degradation when credits are insufficient
async function consumeCreditsWithFallback(userId, amount, feature) {
  const balance = await getCreditBalance(userId)
  
  if (balance.available < amount) {
    return {
      success: false,
      error: 'insufficient_credits',
      balance: balance.available,
      required: amount,
      purchaseUrl: await createCreditPurchaseUrl(userId)
    }
  }
  
  return await recordUsage(userId, feature, amount)
}
```

## Testing Strategy

### Testing Framework
- **Backend**: Node.js test runner with Vitest for property-based tests
- **Frontend**: Vitest + React Testing Library
- **Property-Based Testing**: fast-check library
- **E2E**: Cypress with Stripe test mode

### Unit Tests
- Stripe service methods with mocked Stripe SDK
- Credit calculation and balance operations
- Webhook signature verification
- Commission calculations

### Property-Based Tests
Each correctness property will be implemented as a property-based test using fast-check:

```javascript
// Example: Property 1 - Secret Key Masking
import { fc } from 'fast-check'

describe('maskSecretKey', () => {
  it('should show only last 4 characters', () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 5 }), // Secret keys are at least 5 chars
        (secretKey) => {
          const masked = maskSecretKey(secretKey)
          const last4 = secretKey.slice(-4)
          return masked.endsWith(last4) && 
                 masked.startsWith('*'.repeat(masked.length - 4))
        }
      )
    )
  })
})
```

### Integration Tests
- Stripe API integration with test mode keys
- Webhook endpoint with test events
- Connect account creation flow
- Checkout session creation and completion

### Test Configuration
```javascript
// vitest.config.ts
export default {
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html']
    }
  }
}
```

### Stripe Test Mode
- Use `sk_test_` keys for all development and testing
- Use Stripe CLI for local webhook testing: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
- Test cards: `4242424242424242` (success), `4000000000000002` (decline)

