# Eventos de Webhook WUZAPI

## Lista Completa de Eventos Suportados

Baseado no código oficial da WUZAPI (dashboard/js/app.js), estes são todos os eventos disponíveis:

### Mensagens
- `Message` - Mensagens recebidas
- `UndecryptableMessage` - Mensagens que não puderam ser decriptadas
- `Receipt` - Confirmações de entrega e leitura
- `MediaRetry` - Tentativas de reenvio de mídia

### Grupos
- `GroupInfo` - Informações de grupos
- `JoinedGroup` - Quando alguém entra em um grupo

### Newsletter
- `NewsletterJoin` - Entrada em newsletter
- `NewsletterLeave` - Saída de newsletter
- `NewsletterMuteChange` - Mudanças no status de silenciar newsletter
- `NewsletterLiveUpdate` - Atualizações ao vivo de newsletter
- `FBMessage` - Mensagens do Facebook

### Presença
- `Presence` - Status de presença dos usuários
- `ChatPresence` - Presença específica em conversas

### Identidade e Mudanças
- `IdentityChange` - Mudanças na identidade do usuário
- `CATRefreshError` - Erros de atualização CAT

### Sincronização
- `OfflineSyncPreview` - Preview de sincronização offline
- `OfflineSyncCompleted` - Sincronização offline completada
- `HistorySync` - Sincronização do histórico de mensagens
- `AppState` - Estado da aplicação
- `AppStateSyncComplete` - Sincronização do estado do app completada

### Chamadas
- `CallOffer` - Ofertas de chamada recebidas
- `CallAccept` - Chamadas aceitas
- `CallTerminate` - Chamadas terminadas
- `CallOfferNotice` - Avisos de ofertas de chamada
- `CallRelayLatency` - Latência do relay de chamadas

### Conexão
- `Connected` - Quando conecta ao WhatsApp
- `Disconnected` - Quando desconecta do WhatsApp
- `ConnectFailure` - Falhas na conexão
- `LoggedOut` - Quando é deslogado
- `ClientOutdated` - Cliente precisa ser atualizado
- `TemporaryBan` - Bans temporários
- `StreamError` - Erros no stream de dados
- `StreamReplaced` - Stream foi substituído

### Keep Alive
- `KeepAliveRestored` - Keep alive foi restaurado
- `KeepAliveTimeout` - Timeout do keep alive

### Pairing (Pareamento)
- `PairSuccess` - Pareamento bem-sucedido
- `PairError` - Erros no pareamento
- `QR` - Eventos relacionados ao QR Code
- `QRScannedWithoutMultidevice` - QR escaneado sem suporte a múltiplos dispositivos

### Outros
- `Picture` - Mudanças de foto de perfil
- `BlocklistChange` - Mudanças na lista de bloqueio
- `Blocklist` - Eventos da lista de bloqueio
- `PrivacySettings` - Mudanças nas configurações de privacidade
- `PushNameSetting` - Configurações do nome push
- `UserAbout` - Mudanças no "sobre" do usuário

### Opção Especial
- `All` - Receber todos os tipos de eventos

## Problema Identificado e Corrigido

### Problema
Ao criar um novo usuário, se nenhum evento fosse selecionado, o sistema automaticamente marcava **todos os eventos** (`All`), o que não era o comportamento esperado.

### Código Problemático
```javascript
events: selectedEvents.length > 0 ? selectedEvents.join(",") : "All",
```

### Solução Implementada
Alterado para usar apenas o evento `Message` como padrão quando nenhum evento é selecionado:

```javascript
events: selectedEvents.length > 0 ? selectedEvents.join(",") : "Message",
```

### Localização da Correção
- **Arquivo**: `src/components/shared/forms/CreateUserForm.tsx`
- **Linha**: ~172

## Recomendações

1. **Evento Padrão**: Sempre que criar um usuário sem especificar eventos, apenas `Message` será marcado
2. **Seleção Manual**: O usuário deve selecionar manualmente os eventos desejados
3. **Opção "All"**: Use com cuidado, pois receberá TODOS os eventos possíveis, o que pode gerar muito tráfego

## Verificação dos Eventos

Todos os eventos listados acima estão implementados e disponíveis em:
- `src/components/user/UserSettings.tsx` - Lista completa para usuários
- `src/components/shared/forms/CreateUserForm.tsx` - Lista para criação de usuários
- `src/components/features/webhooks/WebhookForm.tsx` - Lista para configuração de webhooks

## Testando os Eventos

Para testar se os eventos estão funcionando corretamente:

1. Configure o webhook com a URL desejada
2. Selecione os eventos específicos que deseja receber
3. Salve a configuração
4. Realize ações no WhatsApp que disparem esses eventos
5. Verifique se o webhook está recebendo as notificações corretas

## Notas Importantes

- Os eventos são case-sensitive
- Múltiplos eventos devem ser separados por vírgula
- O evento `All` sobrescreve qualquer outra seleção
- Nem todos os eventos são disparados com frequência (ex: `TemporaryBan`, `ClientOutdated`)
