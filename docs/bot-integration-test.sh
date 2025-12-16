#!/bin/bash

# Script de teste para integração de bot externo
# 
# Uso:
#   chmod +x docs/bot-integration-test.sh
#   ./docs/bot-integration-test.sh

# Configurações
API_URL="http://localhost:3000"
WUZAPI_TOKEN="SEU_TOKEN_AQUI"
PHONE="5531999999999"
BOT_ID="1"

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Teste de Integração de Bot Externo"
echo "========================================="
echo ""

# Verificar se o token foi configurado
if [ "$WUZAPI_TOKEN" = "SEU_TOKEN_AQUI" ]; then
    echo -e "${RED}❌ ERRO: Configure o WUZAPI_TOKEN no script antes de executar${NC}"
    echo ""
    echo "Edite o arquivo e substitua 'SEU_TOKEN_AQUI' pelo seu token real"
    exit 1
fi

# Verificar se o telefone foi configurado
if [ "$PHONE" = "5531999999999" ]; then
    echo -e "${YELLOW}⚠️  AVISO: Usando número de telefone padrão${NC}"
    echo "Edite o script para usar um número real se necessário"
    echo ""
fi

echo "Configurações:"
echo "  API URL: $API_URL"
echo "  Token: ${WUZAPI_TOKEN:0:8}..."
echo "  Phone: $PHONE"
echo "  Bot ID: $BOT_ID"
echo ""

# Teste 1: Enviar mensagem de texto
echo "========================================="
echo "Teste 1: Enviar mensagem de texto"
echo "========================================="

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$API_URL/api/bot/send/text" \
  -H "token: $WUZAPI_TOKEN" \
  -H "bot-id: $BOT_ID" \
  -H "Content-Type: application/json" \
  -d "{
    \"Phone\": \"$PHONE\",
    \"Body\": \"🤖 Teste de integração de bot - $(date '+%Y-%m-%d %H:%M:%S')\",
    \"skip_webhook\": true,
    \"bot_name\": \"Bot de Teste\"
  }")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "Status HTTP: $HTTP_CODE"
echo ""

if [ "$HTTP_CODE" = "200" ]; then
    echo -e "${GREEN}✅ Sucesso!${NC}"
    echo ""
    echo "Resposta:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extrair IDs da resposta
    MESSAGE_ID=$(echo "$BODY" | jq -r '.data.messageId' 2>/dev/null)
    CONVERSATION_ID=$(echo "$BODY" | jq -r '.data.conversationId' 2>/dev/null)
    
    if [ "$MESSAGE_ID" != "null" ] && [ "$MESSAGE_ID" != "" ]; then
        echo -e "${GREEN}Message ID: $MESSAGE_ID${NC}"
    fi
    
    if [ "$CONVERSATION_ID" != "null" ] && [ "$CONVERSATION_ID" != "" ]; then
        echo -e "${GREEN}Conversation ID: $CONVERSATION_ID${NC}"
    fi
else
    echo -e "${RED}❌ Falha!${NC}"
    echo ""
    echo "Resposta de erro:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    echo ""
    
    # Diagnóstico de erros comuns
    if echo "$BODY" | grep -q "CSRF"; then
        echo -e "${YELLOW}Diagnóstico: Erro de CSRF token${NC}"
        echo "Solução: Reinicie o servidor após adicionar os endpoints /api/bot/* às exceções de CSRF"
    elif echo "$BODY" | grep -q "Unauthorized"; then
        echo -e "${YELLOW}Diagnóstico: Token inválido${NC}"
        echo "Solução: Verifique se o token WUZAPI está correto"
    elif echo "$BODY" | grep -q "Invalid Phone"; then
        echo -e "${YELLOW}Diagnóstico: Número de telefone inválido${NC}"
        echo "Solução: Use formato DDI+DDD+número (ex: 5531999999999)"
    fi
fi

echo ""
echo "========================================="
echo "Teste concluído"
echo "========================================="
echo ""
echo "Próximos passos:"
echo "1. Verifique os logs do servidor: tail -f server/logs/app-*.log"
echo "2. Acesse a interface e verifique se a mensagem apareceu no histórico"
echo "3. Procure por 'Bot proxy: Message sent and stored' nos logs"
echo ""
