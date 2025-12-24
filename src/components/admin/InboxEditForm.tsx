/**
 * InboxEditForm - Componente para editar caixas de entrada WhatsApp
 * 
 * Uma "caixa de entrada" (inbox) é uma instância de conexão WhatsApp via WUZAPI.
 * Este componente é um wrapper do UserEditForm com nomenclatura atualizada.
 * 
 * @see UserEditForm para a implementação completa
 */

import UserEditForm, { EditUserFormData } from './UserEditForm';
import type { Inbox } from '@/services/wuzapi';
import type { SupabaseUser, CreateSupabaseUserDTO, UpdateSupabaseUserDTO } from '@/services/admin-users';

/**
 * Dados do formulário de edição de inbox.
 * Alias para EditUserFormData com nomenclatura atualizada.
 */
export type EditInboxFormData = EditUserFormData;

/**
 * Props do componente InboxEditForm
 */
interface InboxEditFormProps {
  /** Dados da caixa de entrada a ser editada */
  inbox: Inbox;
  /** Dados atuais do formulário */
  formData: EditInboxFormData;
  /** Callback quando os dados do formulário mudam */
  onFormChange: (data: EditInboxFormData) => void;
  /** Callback quando o formulário é submetido */
  onSubmit: () => void;
  /** Callback quando a edição é cancelada */
  onCancel: () => void;
  /** Indica se está carregando */
  loading?: boolean;
  /** Indica se há alterações não salvas */
  hasChanges?: boolean;
  /** Callback para gerar QR Code */
  onGenerateQR?: () => void;
  /** Callback para remover do banco de dados */
  onDeleteFromDB?: () => void;
  /** Callback para remoção completa */
  onDeleteFull?: () => void;
  /** Usuário Supabase vinculado (se houver) */
  supabaseUser?: SupabaseUser | null;
  /** Callback para vincular usuário Supabase existente */
  onLinkSupabaseUser?: (email: string) => Promise<void>;
  /** Callback para criar novo usuário Supabase */
  onCreateSupabaseUser?: (data: CreateSupabaseUserDTO) => Promise<void>;
  /** Callback para atualizar usuário Supabase */
  onUpdateSupabaseUser?: (data: UpdateSupabaseUserDTO) => Promise<void>;
  /** Callback para desvincular usuário Supabase */
  onUnlinkSupabaseUser?: () => Promise<void>;
}

/**
 * Formulário de edição de caixa de entrada WhatsApp.
 * 
 * Este componente permite editar as configurações de uma caixa de entrada,
 * incluindo nome, webhook, eventos e vinculação com conta Supabase.
 */
const InboxEditForm = ({ 
  inbox,
  formData,
  onFormChange,
  onSubmit,
  onCancel,
  loading,
  hasChanges,
  onGenerateQR,
  onDeleteFromDB,
  onDeleteFull,
  supabaseUser,
  onLinkSupabaseUser,
  onCreateSupabaseUser,
  onUpdateSupabaseUser,
  onUnlinkSupabaseUser
}: InboxEditFormProps) => {
  // O InboxEditForm é um wrapper do UserEditForm com nomenclatura atualizada
  // A prop "inbox" é passada como "user" para o componente interno
  return (
    <UserEditForm
      user={inbox}
      formData={formData}
      onFormChange={onFormChange}
      onSubmit={onSubmit}
      onCancel={onCancel}
      loading={loading}
      hasChanges={hasChanges}
      onGenerateQR={onGenerateQR}
      onDeleteFromDB={onDeleteFromDB}
      onDeleteFull={onDeleteFull}
      supabaseUser={supabaseUser}
      onLinkSupabaseUser={onLinkSupabaseUser}
      onCreateSupabaseUser={onCreateSupabaseUser}
      onUpdateSupabaseUser={onUpdateSupabaseUser}
      onUnlinkSupabaseUser={onUnlinkSupabaseUser}
    />
  );
};

export default InboxEditForm;

/**
 * @deprecated Use InboxEditForm instead. Este export será removido em versão futura.
 */
export { default as UserEditForm } from './UserEditForm';
