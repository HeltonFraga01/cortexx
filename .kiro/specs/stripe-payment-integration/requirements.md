# Requirements Document

## Introduction

Este documento especifica os requisitos para integração completa do Stripe como sistema de pagamentos do WUZAPI Manager. A integração inclui:
- **Pagamentos de assinatura** para usuários finais
- **Sistema de créditos** (billing credits) para consumo de recursos (mensagens, agentes, etc.)
- **Stripe Connect** para modelo de revenda/afiliados onde usuários podem ter suas próprias contas Stripe
- **Split de pagamentos** para comissões de afiliados
- **Modelo de atacado** onde admin vende pacotes para revendedores que revendem para seus clientes

O sistema utilizará Stripe Checkout Sessions para fluxos de pagamento, Billing Credits para sistema de créditos pré-pagos, e Stripe Connect para marketplace de revendedores.

## Glossary

- **Sistema**: O WUZAPI Manager, plataforma de gerenciamento da API WhatsApp Business
- **Administrador**: Usuário com papel admin que tem acesso total às configurações do sistema
- **Usuário**: Cliente que utiliza a plataforma e assina planos de serviço
- **Revendedor**: Usuário que compra pacotes no atacado e revende para seus próprios clientes
- **Cliente Final**: Cliente do revendedor que compra pacotes menores
- **Stripe**: Gateway de pagamento para processamento de transações e gerenciamento de assinaturas
- **Stripe Connect**: Plataforma do Stripe para marketplaces que permite split de pagamentos entre contas
- **Connected Account**: Conta Stripe vinculada de um revendedor/afiliado
- **Checkout Session**: Página de pagamento hospedada pelo Stripe para coleta segura de dados de cartão
- **Webhook**: Endpoint HTTP que recebe notificações de eventos do Stripe
- **Customer**: Entidade no Stripe que representa um cliente com métodos de pagamento salvos
- **Subscription**: Assinatura recorrente vinculada a um Customer e um Price no Stripe
- **Billing Credits**: Créditos pré-pagos que podem ser consumidos por uso de recursos
- **Credit Grant**: Concessão de créditos a um cliente no Stripe
- **Meter**: Medidor de uso no Stripe para billing baseado em consumo
- **Application Fee**: Taxa cobrada pela plataforma em transações de connected accounts
- **Destination Charge**: Tipo de cobrança onde o pagamento vai para a plataforma e transfere para connected account
- **stripe_customer_id**: Identificador único do cliente no Stripe armazenado na tabela accounts
- **stripe_account_id**: Identificador da connected account do revendedor no Stripe Connect
- **stripe_subscription_id**: Identificador único da assinatura no Stripe
- **stripe_price_id**: Identificador do preço no Stripe vinculado a um plano local
- **credit_balance**: Saldo de créditos disponível para consumo

## Requirements

### Requirement 1: Configuração de Credenciais Stripe

**User Story:** As an administrator, I want to configure Stripe API credentials in the admin panel, so that the system can process payments securely.

#### Acceptance Criteria

1. WHEN an administrator accesses the payment settings section THEN the Sistema SHALL display input fields for Stripe Secret Key, Stripe Publishable Key, and Webhook Secret
2. WHEN an administrator saves Stripe credentials THEN the Sistema SHALL validate the keys by making a test API call to Stripe
3. WHEN Stripe credentials are valid THEN the Sistema SHALL persist the encrypted secret key to the global_settings table
4. WHEN Stripe credentials are invalid THEN the Sistema SHALL display a descriptive error message without saving
5. WHEN displaying the Stripe Secret Key THEN the Sistema SHALL mask the value showing only the last 4 characters
6. WHEN an administrator enables Stripe Connect THEN the Sistema SHALL configure the platform for marketplace mode

### Requirement 2: Sincronização de Planos com Stripe

**User Story:** As an administrator, I want to sync plans with Stripe products, so that pricing is managed consistently between the system and payment gateway.

#### Acceptance Criteria

1. WHEN an administrator creates a new plan THEN the Sistema SHALL create a corresponding Product and Price in Stripe
2. WHEN an administrator updates a plan price THEN the Sistema SHALL create a new Price in Stripe and archive the old one
3. WHEN an administrator deactivates a plan THEN the Sistema SHALL archive the corresponding Product in Stripe
4. WHEN syncing plans THEN the Sistema SHALL store the stripe_price_id in the plans table
5. WHEN a plan has no stripe_price_id THEN the Sistema SHALL display a warning indicating the plan is not synced with Stripe

### Requirement 3: Assinatura via Stripe Checkout

**User Story:** As a user, I want to subscribe to a plan using Stripe Checkout, so that I can pay securely without entering card details on the platform.

#### Acceptance Criteria

1. WHEN a user selects a plan to subscribe THEN the Sistema SHALL create a Stripe Checkout Session in subscription mode
2. WHEN creating a Checkout Session THEN the Sistema SHALL include the user's stripe_customer_id or create a new Customer
3. WHEN the Checkout Session is created THEN the Sistema SHALL redirect the user to the Stripe-hosted payment page
4. WHEN the user completes payment successfully THEN the Sistema SHALL redirect to a success page with subscription confirmation
5. WHEN the user cancels payment THEN the Sistema SHALL redirect to a cancel page and maintain the previous subscription state

### Requirement 4: Gerenciamento de Assinatura

**User Story:** As a user, I want to manage my subscription, so that I can upgrade, downgrade, or cancel my plan.

#### Acceptance Criteria

1. WHEN a user views their subscription THEN the Sistema SHALL display current plan, billing cycle, next payment date, and payment method
2. WHEN a user requests to change plans THEN the Sistema SHALL create a new Checkout Session for the plan change with proration
3. WHEN a user requests to cancel subscription THEN the Sistema SHALL cancel at period end in Stripe and update local status
4. WHEN a subscription is canceled THEN the Sistema SHALL maintain access until the current period ends
5. WHEN a user reactivates a canceled subscription before period end THEN the Sistema SHALL resume the subscription in Stripe

### Requirement 5: Webhooks do Stripe

**User Story:** As a system operator, I want the system to receive Stripe webhooks, so that subscription and payment changes are synchronized in real-time.

#### Acceptance Criteria

1. WHEN the Sistema receives a checkout.session.completed webhook THEN the Sistema SHALL activate the user subscription and store stripe_subscription_id
2. WHEN the Sistema receives a customer.subscription.updated webhook THEN the Sistema SHALL update the local subscription status and plan
3. WHEN the Sistema receives a customer.subscription.deleted webhook THEN the Sistema SHALL mark the local subscription as canceled
4. WHEN the Sistema receives an invoice.payment_failed webhook THEN the Sistema SHALL update subscription status to past_due and notify the user
5. WHEN the Sistema receives an invoice.paid webhook for credit purchase THEN the Sistema SHALL grant billing credits to the customer
6. WHEN processing webhooks THEN the Sistema SHALL verify the Stripe signature to prevent fraudulent requests
7. WHEN a webhook event is processed THEN the Sistema SHALL log the event details for audit purposes

### Requirement 6: Sistema de Créditos (Billing Credits)

**User Story:** As a user, I want to purchase and use credits for consumption-based features, so that I can pay for what I use.

#### Acceptance Criteria

1. WHEN a user purchases a credit package THEN the Sistema SHALL create a Checkout Session for one-time payment
2. WHEN the credit purchase is completed THEN the Sistema SHALL create a Credit Grant in Stripe for the user
3. WHEN a user consumes a resource (message, agent usage) THEN the Sistema SHALL send a meter event to Stripe
4. WHEN displaying credit balance THEN the Sistema SHALL retrieve the Credit Balance Summary from Stripe
5. WHEN credits are low THEN the Sistema SHALL notify the user with remaining balance and option to purchase more
6. WHEN credits reach zero THEN the Sistema SHALL restrict usage of consumption-based features until credits are added

### Requirement 7: Histórico de Cobrança

**User Story:** As a user, I want to view my billing history, so that I can track my payments and download invoices.

#### Acceptance Criteria

1. WHEN a user accesses billing history THEN the Sistema SHALL display a list of past invoices with date, amount, and status
2. WHEN a user clicks on an invoice THEN the Sistema SHALL provide a link to the Stripe-hosted invoice PDF
3. WHEN displaying billing history THEN the Sistema SHALL show the last 12 months of invoices with pagination for older records
4. WHEN an invoice payment fails THEN the Sistema SHALL display the failure reason and a link to update payment method

### Requirement 8: Atualização de Método de Pagamento

**User Story:** As a user, I want to update my payment method, so that I can ensure uninterrupted service.

#### Acceptance Criteria

1. WHEN a user requests to update payment method THEN the Sistema SHALL create a Stripe Billing Portal session
2. WHEN the Billing Portal session is created THEN the Sistema SHALL redirect the user to the Stripe-hosted portal
3. WHEN the user updates payment method in the portal THEN the Sistema SHALL receive a webhook confirming the update
4. WHEN displaying current payment method THEN the Sistema SHALL show the card brand and last 4 digits only

### Requirement 9: Stripe Connect para Revendedores

**User Story:** As a reseller, I want to connect my own Stripe account, so that I can receive payments directly from my customers.

#### Acceptance Criteria

1. WHEN a user enables reseller mode THEN the Sistema SHALL initiate Stripe Connect onboarding flow
2. WHEN the user completes Stripe Connect onboarding THEN the Sistema SHALL store the stripe_account_id in the accounts table
3. WHEN a reseller's connected account is active THEN the Sistema SHALL display the account status and payout settings
4. WHEN a reseller views their Stripe dashboard THEN the Sistema SHALL provide a link to the Stripe Express Dashboard
5. WHEN a connected account requires additional verification THEN the Sistema SHALL notify the reseller and provide onboarding link

### Requirement 10: Venda de Pacotes pelo Revendedor

**User Story:** As a reseller, I want to sell credit packages to my customers, so that I can monetize my WhatsApp bot service.

#### Acceptance Criteria

1. WHEN a reseller creates a credit package THEN the Sistema SHALL create a Product and Price in the reseller's connected account
2. WHEN a reseller's customer purchases a package THEN the Sistema SHALL create a Checkout Session with destination charge to the reseller
3. WHEN processing a reseller sale THEN the Sistema SHALL apply the platform application fee configured by admin
4. WHEN a reseller sale is completed THEN the Sistema SHALL grant credits to the customer and deduct from reseller's credit balance
5. WHEN displaying reseller sales THEN the Sistema SHALL show transaction history with platform fees and net amounts

### Requirement 11: Compra de Créditos no Atacado

**User Story:** As a reseller, I want to buy credits in bulk from the platform, so that I can resell them to my customers at a markup.

#### Acceptance Criteria

1. WHEN a reseller views wholesale packages THEN the Sistema SHALL display bulk credit packages with volume discounts
2. WHEN a reseller purchases a wholesale package THEN the Sistema SHALL create a Checkout Session for the bulk purchase
3. WHEN the wholesale purchase is completed THEN the Sistema SHALL add credits to the reseller's credit_balance
4. WHEN a reseller sells credits to their customer THEN the Sistema SHALL deduct from the reseller's credit_balance
5. WHEN reseller credit_balance is low THEN the Sistema SHALL notify the reseller to purchase more wholesale credits

### Requirement 12: Sistema de Afiliados com Split de Pagamento

**User Story:** As an administrator, I want to configure affiliate commissions, so that affiliates earn a percentage of referred sales.

#### Acceptance Criteria

1. WHEN an administrator configures affiliate program THEN the Sistema SHALL set the commission percentage for referrals
2. WHEN a referred user makes a purchase THEN the Sistema SHALL calculate the affiliate commission
3. WHEN processing an affiliate sale THEN the Sistema SHALL use Stripe Connect to split the payment between platform and affiliate
4. WHEN an affiliate views their earnings THEN the Sistema SHALL display total commissions, pending payouts, and payout history
5. WHEN affiliate earnings reach payout threshold THEN the Sistema SHALL transfer funds to the affiliate's connected account

### Requirement 13: Analytics de Pagamento para Admin

**User Story:** As an administrator, I want to view payment analytics, so that I can monitor revenue and subscription metrics.

#### Acceptance Criteria

1. WHEN an administrator accesses payment analytics THEN the Sistema SHALL display Monthly Recurring Revenue (MRR) and total active subscriptions
2. WHEN displaying analytics THEN the Sistema SHALL show subscription status breakdown (active, past_due, canceled, trialing)
3. WHEN displaying analytics THEN the Sistema SHALL show revenue trend for the last 6 months
4. WHEN displaying analytics THEN the Sistema SHALL show credit sales volume and consumption metrics
5. WHEN displaying analytics THEN the Sistema SHALL show affiliate program metrics (total affiliates, commissions paid, referred revenue)

### Requirement 14: Configuração de Preços pelo Revendedor

**User Story:** As a reseller, I want to configure my own pricing for credit packages, so that I can set my profit margin.

#### Acceptance Criteria

1. WHEN a reseller accesses pricing settings THEN the Sistema SHALL display configurable price fields for each credit package
2. WHEN a reseller sets a price THEN the Sistema SHALL validate that the price covers the wholesale cost plus platform fee
3. WHEN a reseller saves pricing THEN the Sistema SHALL update the Price in their connected Stripe account
4. WHEN displaying reseller pricing THEN the Sistema SHALL show the profit margin for each package
5. WHEN wholesale prices change THEN the Sistema SHALL notify resellers and suggest price adjustments

