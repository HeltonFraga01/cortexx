# Requirements Document

## Introduction

Este documento especifica os requisitos para corrigir o problema crítico de persistência de sessão no sistema de autenticação. O problema atual é que a sessão é criada, mas os dados do usuário (`userId`, `role`, `userToken`) não são persistidos corretamente, resultando em falhas de autenticação após o login.

O log de erro mostra claramente o problema:
```json
{
  "message": "Admin authentication failed - No active session",
  "session": {
    "sessionId": "0ZBggYRCjHqiJaKdOX2w0qdnl6_rkszN",
    "hasSession": true,
    "userId": null,
    "role": null,
    "hasToken": false
  }
}
```

A sessão existe (`hasSession: true`), mas os dados críticos estão `null`.

## Glossary

- **Session**: Objeto de sessão HTTP gerenciado pelo express-session
- **Session_Store**: Armazenamento de sessões (MemoryStore por padrão)
- **Session_ID**: Identificador único da sessão (cookie `wuzapi.sid`)
- **User_ID**: Identificador do usuário autenticado
- **Role**: Papel do usuário (`admin`, `user`, `superadmin`)
- **User_Token**: Token WUZAPI do usuário para chamadas à API
- **Session_Regeneration**: Processo de criar nova sessão destruindo a anterior
- **Session_Persistence**: Garantia de que dados da sessão são salvos no store

## Requirements

### Requirement 1: Persistência de Dados na Sessão

**User Story:** Como usuário, eu quero que meus dados de autenticação sejam persistidos corretamente na sessão, para que eu possa acessar o sistema após fazer login.

#### Acceptance Criteria

1. WHEN a user successfully logs in THEN the System SHALL persist `userId`, `role`, and `userToken` in the session
2. WHEN session data is set THEN the System SHALL call `req.session.save()` and wait for completion before responding
3. IF `req.session.save()` fails THEN the System SHALL return an error response and log the failure
4. WHEN checking authentication THEN the System SHALL verify that `userId` is not null in the session

### Requirement 2: Regeneração Segura de Sessão

**User Story:** Como desenvolvedor, eu quero que a regeneração de sessão seja feita de forma segura, para que não haja perda de dados durante o processo.

#### Acceptance Criteria

1. WHEN regenerating a session THEN the System SHALL use `req.session.regenerate()` instead of `destroy()` + manual recreation
2. WHEN `req.session.regenerate()` completes THEN the System SHALL set all session data before calling `save()`
3. IF session regeneration fails THEN the System SHALL return a 500 error with appropriate message
4. WHEN session is regenerated THEN the System SHALL log the old and new session IDs for debugging

### Requirement 3: Validação de Sessão Consistente

**User Story:** Como sistema, eu quero validar sessões de forma consistente, para que usuários não autenticados não acessem recursos protegidos.

#### Acceptance Criteria

1. WHEN validating a session THEN the System SHALL check for `userId` presence (not just session existence)
2. WHEN `userId` is null but session exists THEN the System SHALL treat as unauthenticated and return 401
3. WHEN session validation fails THEN the System SHALL log detailed diagnostic information
4. THE System SHALL NOT rely on session existence alone for authentication

### Requirement 4: Diagnóstico de Sessão

**User Story:** Como desenvolvedor, eu quero ter logs detalhados do estado da sessão, para que eu possa diagnosticar problemas de autenticação.

#### Acceptance Criteria

1. WHEN a session is created THEN the System SHALL log session ID, userId, role, and timestamp
2. WHEN a session is saved THEN the System SHALL log success or failure with session ID
3. WHEN authentication fails THEN the System SHALL log the complete session state
4. WHEN session data is missing THEN the System SHALL log which fields are null

### Requirement 5: Fallback para Sessão Corrompida

**User Story:** Como usuário, eu quero que o sistema lide graciosamente com sessões corrompidas, para que eu possa fazer login novamente sem problemas.

#### Acceptance Criteria

1. WHEN a session exists but has null userId THEN the System SHALL destroy the corrupted session
2. WHEN destroying a corrupted session THEN the System SHALL clear the session cookie
3. WHEN a corrupted session is detected THEN the System SHALL return 401 with `SESSION_CORRUPTED` code
4. THE System SHALL allow the user to login again after session corruption is handled

### Requirement 6: Sincronização de Session Store

**User Story:** Como sistema, eu quero garantir que o session store esteja sincronizado, para que os dados da sessão sejam consistentes.

#### Acceptance Criteria

1. WHEN using MemoryStore THEN the System SHALL ensure session data is written synchronously
2. WHEN `req.session.save()` is called THEN the System SHALL wait for the callback before proceeding
3. IF session store write fails THEN the System SHALL retry once before failing
4. THE System SHALL log session store operations in development mode

### Requirement 7: Cookie de Sessão Consistente

**User Story:** Como sistema, eu quero que o cookie de sessão seja configurado consistentemente, para que a sessão seja mantida entre requisições.

#### Acceptance Criteria

1. WHEN setting session cookie THEN the System SHALL use consistent options (httpOnly, secure, sameSite)
2. WHEN clearing session cookie THEN the System SHALL use the same options used to set it
3. THE Session_Cookie SHALL have a domain that allows subdomain access when configured
4. THE Session_Cookie SHALL have appropriate maxAge for session duration
