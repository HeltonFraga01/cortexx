# Guia de Teste - Importação de Contatos

## Problema Identificado

Os contatos do WUZAPI estão vindo com JIDs no formato `@lid` (Local ID) ao invés de `@s.whatsapp.net`. Este é um formato usado pelo WhatsApp para identificadores locais.

## Exemplo de Resposta Real

```json
{
  "70368828092521@lid": {
    "BusinessName": "",
    "FirstName": "",
    "Found": true,
    "FullName": "",
    "PushName": "Everton Correia",
    "RedactedPhone": "+55∙∙∙∙∙∙∙∙∙01"
  }
}
```

## Correções Aplicadas

1. **Suporte para formato @lid**: O código agora aceita tanto `@s.whatsapp.net` quanto `@lid`
2. **Extração de número do RedactedPhone**: Quando o JID é `@lid`, extraímos o número do campo `RedactedPhone`
3. **Limpeza de caracteres especiais**: Removemos os caracteres `∙` e `+` para obter apenas os dígitos
4. **Logging aprimorado**: Adicionado logs detalhados para debug

## Como Testar

### 1. Teste Direto da API WUZAPI

Execute o script de teste para ver exatamente o que a API retorna:

```bash
node server/test-wuzapi-contacts.js SEU_TOKEN_AQUI
```

Este script irá:
- Fazer uma requisição direta para o WUZAPI
- Mostrar os primeiros 5 contatos
- Analisar os formatos de JID (@s.whatsapp.net vs @lid)
- Mostrar quantos contatos têm RedactedPhone
- Testar a extração de números

### 2. Teste via API Local

Com o servidor rodando, teste o endpoint local:

```bash
curl -X GET \
  -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3001/api/user/contacts/import/wuzapi?instance=SEU_TOKEN"
```

### 3. Teste via Interface

1. Acesse o sistema
2. Faça login com seu token
3. Vá para "Disparador de Mensagens" → "Envio em Massa"
4. Clique em "Importar Contatos" → "Agenda WUZAPI"
5. Clique em "Importar da Agenda"

## O Que Observar

### Nos Logs do Servidor

Procure por estas mensagens:

```
Verificando token do usuário
Token verificado com sucesso
Importando contatos do WUZAPI
Contatos importados do WUZAPI
```

O log de "Contatos importados" deve mostrar:
- `total`: Número de contatos válidos processados
- `totalRaw`: Número total de contatos retornados pela API
- `sampleJIDs`: Exemplos de JIDs (para ver o formato)
- `sampleContacts`: Exemplos de contatos processados

### Na Interface

- Deve aparecer uma mensagem de sucesso: "X contatos importados da agenda WUZAPI"
- Os contatos devem aparecer na tabela com:
  - Telefone formatado: (XX) XXXXX-XXXX
  - Nome do contato (se disponível)

## Possíveis Problemas

### 1. RedactedPhone com Números Parciais

Se o `RedactedPhone` vier como `"+55∙∙∙∙∙∙∙∙∙01"`, só conseguimos extrair os dígitos visíveis. Neste caso:
- Extraímos: "5501"
- Validação pode falhar por número incompleto

**Solução**: Nesses casos, o contato será filtrado como inválido. Isso é esperado para números redacted.

### 2. Nenhum Contato Importado

Se nenhum contato for importado, verifique:

1. **Token válido?**
   ```bash
   # Teste o token diretamente
   curl -H "Token: SEU_TOKEN" https://wzapi.wasend.com.br/session/status
   ```

2. **Contatos na agenda?**
   ```bash
   # Veja quantos contatos existem
   node server/test-wuzapi-contacts.js SEU_TOKEN
   ```

3. **Formato dos números**
   - Números devem ter entre 10 e 13 dígitos
   - Formato brasileiro: 55 + DDD + número

### 3. Erro 401 (Unauthorized)

- Verifique se está logado no sistema
- Verifique se o token está sendo passado corretamente
- Veja os logs do navegador (Console do DevTools)

### 4. Erro 404 (Not Found)

- Verifique se o servidor está rodando
- Verifique se as rotas foram registradas corretamente
- Reinicie o servidor se necessário

## Logs Úteis para Debug

### Frontend (Console do Navegador)

```javascript
// Procure por:
DisparadorWrapper - Token status: { hasUser: true, hasUserToken: true, ... }
🚀 API Request: GET /user/contacts/import/wuzapi
✅ API Response: GET /user/contacts/import/wuzapi
```

### Backend (Terminal do Servidor)

```json
{
  "message": "Verificando token do usuário",
  "hasAuthHeader": true,
  "authHeaderValue": "Bearer ..."
}

{
  "message": "Importando contatos do WUZAPI",
  "instance": "...",
  "userToken": "..."
}

{
  "message": "Contatos importados do WUZAPI",
  "total": 50,
  "totalRaw": 100,
  "sampleJIDs": ["70368828092521@lid", "..."],
  "sampleContacts": [...]
}
```

## Próximos Passos

Após testar:

1. **Se funcionar**: Ótimo! A importação está funcionando corretamente.

2. **Se não funcionar**: 
   - Execute o script de teste: `node server/test-wuzapi-contacts.js SEU_TOKEN`
   - Copie a saída completa
   - Verifique os logs do servidor
   - Compartilhe os resultados para análise

## Comandos Rápidos

```bash
# Instalar dependências (se necessário)
npm install

# Rodar servidor em modo dev
npm run dev:full

# Testar API WUZAPI diretamente
node server/test-wuzapi-contacts.js SEU_TOKEN

# Ver logs do servidor em tempo real
# (já aparece automaticamente com npm run dev:full)

# Testar endpoint local
curl -X GET \
  -H "Authorization: Bearer SEU_TOKEN" \
  "http://localhost:3001/api/user/contacts/import/wuzapi?instance=SEU_TOKEN"
```

## Notas Importantes

1. **@lid vs @s.whatsapp.net**: Ambos os formatos são válidos e suportados
2. **RedactedPhone**: Pode conter números parcialmente ocultos (∙∙∙)
3. **Validação**: Números com menos de 10 dígitos são filtrados
4. **Normalização**: Números são normalizados para formato brasileiro (55 + DDD + número)

## Suporte

Se encontrar problemas:
1. Execute o script de teste
2. Verifique os logs do servidor
3. Verifique o console do navegador
4. Compartilhe os resultados para análise
