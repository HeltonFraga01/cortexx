# Integração de Bots Externos - Guia Rápido

## TL;DR

Para que mensagens de bots externos apareçam no histórico, use o endpoint proxy:

```bash
curl -X POST http://localhost:3000/api/bot/send/text \
  -H "token: SEU_TOKEN_WUZAPI" \
  -H "Content-Type: application/json" \
  -d '{
    "Phone": "5531999999999",
    "Body": "Mensagem do bot",
    "skip_webhook": true
  }'
```

## Por que usar o endpoint proxy?

❌ **Problema:** Mensagens enviadas diretamente via WUZAPI não aparecem no histórico

✅ **Solução:** Use `/api/bot/send/text` - encaminha para WUZAPI E registra no histórico

## Correção Aplicada

Os endpoints `/api/bot/send/text` e `/api/bot/send/image` foram adicionados às exceções de CSRF no arquivo `server/index.js`:

```javascript
const csrfExemptPaths = [
  '/api/auth/login',
  '/api/auth/status',
  '/api/admin/database-connections',
  '/api/webhook/events',
  '/api/bot/send/text',      // ✅ Adicionado
  '/api/bot/send/image'       // ✅ Adicionado
];
```

**Importante:** Reinicie o servidor após esta alteração:
```bash
npm run server:dev
```

## Teste Rápido

```bash
# 1. Configure o token no script
nano docs/bot-integration-test.sh

# 2. Execute o teste
chmod +x docs/bot-integration-test.sh
./docs/bot-integration-test.sh
```

## Documentação Completa

Veja o guia completo em: [`docs/bot-integration-guide.md`](./bot-integration-guide.md)

Inclui:
- Todos os endpoints disponíveis
- Parâmetros detalhados
- Exemplos em Node.js, Python e PHP
- Troubleshooting completo
- Códigos de erro

## Verificação

Após enviar uma mensagem, verifique:

1. **Logs do servidor:**
   ```bash
   tail -f server/logs/app-*.log | grep "Bot proxy"
   ```
   
   Procure por: `"Bot proxy: Message sent and stored"`

2. **Interface:** Recarregue a página e verifique o histórico da conversa

3. **Banco de dados:**
   ```sql
   SELECT * FROM chat_messages 
   WHERE sender_type = 'bot' 
   ORDER BY created_at DESC 
   LIMIT 5;
   ```

## Suporte

Se encontrar problemas:

1. Verifique se o servidor foi reiniciado após a alteração
2. Confirme que o token WUZAPI está correto
3. Verifique os logs para mensagens de erro
4. Consulte a seção "Problemas Comuns" no guia completo
