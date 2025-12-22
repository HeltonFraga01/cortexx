# Requirements Document

## Introduction

Este documento define os requisitos para migrar o sistema de contatos do localStorage para o banco de dados Supabase, implementando isolamento multi-tenant adequado e permitindo interações entre usuários dentro do mesmo tenant.

Atualmente, os contatos são armazenados no localStorage do navegador, o que causa:
- Perda de dados ao trocar de navegador/dispositivo
- Impossibilidade de compartilhar contatos entre usuários do mesmo tenant
- Falta de isolamento adequado entre tenants
- Impossibilidade de usar contatos como base para conversas internas

A nova arquitetura permitirá:
- Persistência centralizada no Supabase
- Isolamento por tenant com RLS (Row Level Security)
- Compartilhamento de contatos entre usuários do mesmo tenant
- Possibilidade de transformar contatos em usuários internos para comunicação

## Glossary

- **Contact**: Registro de um contato importado do WhatsApp ou criado manualmente, contendo telefone, nome e metadados
- **Contact_Tag**: Etiqueta para categorização de contatos
- **Contact_Group**: Agrupamento lógico de contatos para organização
- **Tenant**: Organização/empresa que utiliza o sistema (isolamento multi-tenant)
- **Account**: Conta de usuário dentro de um tenant
- **User**: Usuário final que pode ser criado a partir de um contato
- **Contact_Service**: Serviço backend responsável por operações CRUD de contatos
- **RLS**: Row Level Security - mecanismo do PostgreSQL para isolamento de dados

## Requirements

### Requirement 1: Persistência de Contatos no Supabase

**User Story:** As a user, I want my contacts to be saved in the database, so that I don't lose them when switching browsers or devices.

#### Acceptance Criteria

1. WHEN a user imports contacts from WhatsApp, THE Contact_Service SHALL save them to the Supabase database with tenant_id and account_id
2. WHEN a user creates a new contact manually, THE Contact_Service SHALL persist it to the database immediately
3. WHEN a user updates a contact, THE Contact_Service SHALL update the record in the database
4. WHEN a user deletes contacts, THE Contact_Service SHALL remove them from the database
5. WHEN a user loads the contacts page, THE Contact_Service SHALL fetch contacts from the database instead of localStorage

### Requirement 2: Isolamento Multi-Tenant e por Account

**User Story:** As a system administrator, I want contacts to be isolated by tenant and account, so that each user's data is properly segregated.

#### Acceptance Criteria

1. THE Database SHALL have RLS policies that filter contacts by tenant_id AND account_id
2. WHEN a user queries contacts, THE Contact_Service SHALL only return contacts belonging to their account
3. WHEN an agent queries contacts, THE Contact_Service SHALL return contacts from their associated account
4. WHEN a user creates a contact, THE Contact_Service SHALL automatically set the tenant_id and account_id based on the authenticated user
5. IF a user attempts to access contacts from another account, THEN THE Contact_Service SHALL return an empty result or error

### Requirement 3: Tags Persistentes

**User Story:** As a user, I want my contact tags to be saved in the database, so that I can organize contacts consistently across sessions.

#### Acceptance Criteria

1. WHEN a user creates a tag, THE Contact_Service SHALL save it to the database with tenant_id
2. WHEN a user assigns tags to contacts, THE Contact_Service SHALL create the association in the database
3. WHEN a user removes a tag from a contact, THE Contact_Service SHALL remove the association from the database
4. WHEN a user deletes a tag, THE Contact_Service SHALL remove all associations and the tag itself

### Requirement 4: Grupos de Contatos Persistentes

**User Story:** As a user, I want my contact groups to be saved in the database, so that I can organize contacts into groups that persist.

#### Acceptance Criteria

1. WHEN a user creates a group, THE Contact_Service SHALL save it to the database with tenant_id and account_id
2. WHEN a user adds contacts to a group, THE Contact_Service SHALL create the associations in the database
3. WHEN a user removes contacts from a group, THE Contact_Service SHALL remove the associations from the database
4. WHEN a user deletes a group, THE Contact_Service SHALL remove all associations and the group itself

### Requirement 5: Compartilhamento Hierárquico de Contatos (User → Agents → Teams)

**User Story:** As a user, I want my agents and team members to access my contacts based on their permissions, so that they can help manage customer relationships.

#### Acceptance Criteria

1. WHEN a user loads contacts, THE Contact_Service SHALL return only contacts belonging to their account (account_id)
2. WHEN an agent loads contacts, THE Contact_Service SHALL return contacts from the account they belong to
3. THE Contact_Service SHALL include the account_id in each contact record to establish ownership
4. WHEN an agent attempts to modify a contact, THE Contact_Service SHALL verify the agent has the required permission (read/write/delete)
5. THE Database SHALL enforce that contacts are isolated by account_id, not shared across different users' accounts within the same tenant
6. WHEN a team member accesses contacts, THE Contact_Service SHALL apply the same permission rules as agents

### Requirement 6: Migração de Dados do LocalStorage

**User Story:** As an existing user, I want my contacts from localStorage to be migrated to the database, so that I don't lose my existing data.

#### Acceptance Criteria

1. WHEN a user with existing localStorage contacts accesses the contacts page, THE System SHALL detect and offer to migrate the data
2. WHEN the user confirms migration, THE Contact_Service SHALL import all localStorage contacts to the database
3. WHEN migration is complete, THE System SHALL clear the localStorage data to prevent duplicates
4. IF migration fails, THEN THE System SHALL preserve the localStorage data and show an error message

### Requirement 7: Criação de Usuário a partir de Contato

**User Story:** As an administrator, I want to convert a contact into a system user, so that they can access the platform and communicate internally.

#### Acceptance Criteria

1. WHEN an administrator selects a contact for user creation, THE System SHALL display a form with pre-filled data from the contact
2. WHEN the user creation form is submitted, THE Contact_Service SHALL create a new user record linked to the contact
3. WHEN a contact is converted to a user, THE Contact_Service SHALL mark the contact as having an associated user
4. THE System SHALL allow communication between users created from contacts within the same tenant

### Requirement 8: Performance e Paginação

**User Story:** As a user with many contacts, I want the contacts list to load quickly, so that I can work efficiently.

#### Acceptance Criteria

1. WHEN loading contacts, THE Contact_Service SHALL implement server-side pagination
2. THE Contact_Service SHALL support filtering by name, phone, tags, and groups at the database level
3. WHEN searching contacts, THE Contact_Service SHALL use database indexes for efficient queries
4. THE System SHALL display loading states while fetching data from the database

### Requirement 9: Sincronização com WhatsApp

**User Story:** As a user, I want to re-import contacts from WhatsApp without losing my tags and groups, so that I can keep my contact list updated.

#### Acceptance Criteria

1. WHEN re-importing contacts, THE Contact_Service SHALL merge new contacts with existing ones using phone number as the unique key
2. WHEN merging contacts, THE Contact_Service SHALL preserve existing tags and group memberships
3. WHEN a contact exists in both sources, THE Contact_Service SHALL update the name if the WhatsApp name is newer
4. THE Contact_Service SHALL track the last import date for each contact

### Requirement 10: Auditoria de Alterações

**User Story:** As an administrator, I want to track changes to contacts, so that I can audit who modified what and when.

#### Acceptance Criteria

1. WHEN a contact is created, THE Contact_Service SHALL record the creator and timestamp
2. WHEN a contact is updated, THE Contact_Service SHALL record the modifier and timestamp
3. THE Database SHALL maintain created_at and updated_at timestamps for all contact-related records
4. THE Contact_Service SHALL include the account_id of the user who performed each operation

### Requirement 11: Permissões de Agentes para Contatos

**User Story:** As a user, I want to control what my agents can do with my contacts, so that I can delegate tasks while maintaining control.

#### Acceptance Criteria

1. WHEN a user configures agent permissions, THE System SHALL allow setting read/write/delete permissions for contacts
2. WHEN an agent with read-only permission attempts to modify a contact, THE Contact_Service SHALL reject the operation
3. WHEN an agent with write permission modifies a contact, THE Contact_Service SHALL allow the operation and record the agent_id
4. WHEN an agent with delete permission removes a contact, THE Contact_Service SHALL allow the operation and record the agent_id
5. THE Contact_Service SHALL check agent permissions before any contact operation
