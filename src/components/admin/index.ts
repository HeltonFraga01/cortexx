/**
 * Admin Components Index
 * 
 * Este arquivo exporta os componentes administrativos do sistema.
 * Inclui aliases deprecated para compatibilidade retroativa.
 */

// ============================================================================
// INBOX (CAIXA DE ENTRADA) - NOMENCLATURA PREFERIDA
// ============================================================================

export { InboxList } from './InboxList';
export { default as CreateInboxForm } from './CreateInboxForm';
export { default as InboxEditForm } from './InboxEditForm';
export type { EditInboxFormData } from './InboxEditForm';

// ============================================================================
// ALIASES DEPRECATED (COMPATIBILIDADE RETROATIVA)
// ============================================================================

/**
 * @deprecated Use InboxList instead. Este export será removido em versão futura.
 * 
 * O termo "WuzapiUsersList" era confuso pois sugeria uma lista de usuários,
 * quando na verdade lista caixas de entrada WhatsApp.
 */
export { InboxList as WuzapiUsersList } from './InboxList';

/**
 * @deprecated Use CreateInboxForm instead. Este export será removido em versão futura.
 */
export { CreateUserForm } from './CreateInboxForm';

/**
 * @deprecated Use InboxEditForm instead. Este export será removido em versão futura.
 */
export { UserEditForm } from './InboxEditForm';
