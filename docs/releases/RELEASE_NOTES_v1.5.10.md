# Release Notes - v1.5.10

**Data de Lançamento**: 17 de Novembro de 2025  
**Tipo**: Patch Release  
**Prioridade**: Média

## 🎯 Resumo

Correção crítica de fuso horário no calendário e melhoria na exibição de versão do sistema.

## ✨ Novidades

### Versão Dinâmica do Sistema
- Versão agora é obtida automaticamente do `package.json`
- Novo endpoint público `/api/version` para consulta da versão
- AdminSettings busca versão da API em tempo real
- Elimina necessidade de atualizar versão manualmente em múltiplos arquivos

## 🐛 Correções

### Calendário - Problema de Fuso Horário
**Problema**: Datas no banco de dados apareciam com 1 dia a menos no calendário
- Exemplo: Vencimento em 17/11/2025 aparecia como 16/11/2025

**Causa**: Conversão UTC automática ao criar objetos `Date` com strings ISO

**Solução**: 
- Parse de datas ISO agora usa construtor local `new Date(year, month, day)`
- Extrai componentes da data (ano, mês, dia) antes de criar o objeto
- Garante interpretação no fuso horário local sem conversão UTC

**Arquivos Alterados**:
- `src/components/user/CalendarView.tsx` - Função `mapRecordsToEvents()`

### Versão Hardcoded
**Problema**: Versão estava hardcoded em múltiplos arquivos
- `src/components/admin/AdminSettings.tsx` - Exibia "1.5.7"
- `server/index.js` - Health check retornava "1.5.9"

**Solução**:
- Criado endpoint `/api/version` que lê do `package.json`
- AdminSettings busca versão via API
- Health check lê versão do `package.json`
- Fonte única de verdade para versão

## 📦 Deployment

### Docker Hub

```bash
# Pull da imagem
docker pull heltonfraga/wuzapi-manager:v1.5.10

# Ou usar latest
docker pull heltonfraga/wuzapi-manager:latest
```

### Docker Swarm

```bash
# Atualizar serviço existente
docker service update --image heltonfraga/wuzapi-manager:v1.5.10 wuzapi-manager_wuzapi-manager

# Verificar status
docker service ps wuzapi-manager_wuzapi-manager

# Ver logs
docker service logs wuzapi-manager_wuzapi-manager -f
```

### Build Local

```bash
# Build multi-arquitetura
npm run deploy:official

# Ou manualmente
./deploy-multiarch.sh v1.5.10
```

## 🔧 Mudanças Técnicas

### Backend
- **Novo Endpoint**: `GET /api/version` (público)
  - Retorna: `{ success: true, version: "1.5.10" }`
- **Health Check**: Versão agora vem do `package.json`
- **Dashboard Stats**: Versão agora vem do `package.json`

### Frontend
- **AdminSettings**: Hook `useEffect` busca versão da API
- **CalendarView**: Parse de datas ISO com timezone local

### Arquivos Modificados
```
package.json                              # 1.5.9 → 1.5.10
server/package.json                       # 1.5.9 → 1.5.10
server/index.js                           # Endpoint /api/version + versão dinâmica
src/components/admin/AdminSettings.tsx    # Busca versão da API
src/components/user/CalendarView.tsx      # Fix timezone
```

## 📝 Notas de Upgrade

### De v1.5.9 para v1.5.10

1. **Sem Breaking Changes**: Atualização compatível
2. **Sem Migrations**: Nenhuma alteração no schema do banco
3. **Compatibilidade**: Totalmente compatível com v1.5.9

### Checklist de Upgrade

- [ ] Fazer backup do banco de dados (`/app/data/wuzapi.db`)
- [ ] Atualizar imagem Docker para v1.5.10
- [ ] Verificar health check (`GET /health`)
- [ ] Verificar versão no AdminSettings
- [ ] Testar calendário com datas

## 🔍 Testes Recomendados

### Calendário
1. Criar registro com data específica (ex: 17/11/2025)
2. Verificar se aparece no dia correto no calendário
3. Testar com diferentes formatos de data

### Versão
1. Acessar AdminSettings
2. Verificar se versão exibe "1.5.10"
3. Chamar `GET /api/version` e verificar resposta

## 📊 Impacto

- **Usuários**: Calendário agora exibe datas corretas
- **Admins**: Versão do sistema sempre atualizada automaticamente
- **Desenvolvedores**: Menos manutenção manual de versões

## 🔗 Links

- **Versão Anterior**: [v1.5.9](./RELEASE_NOTES_v1.5.9.md)
- **Docker Hub**: https://hub.docker.com/r/heltonfraga/wuzapi-manager
- **Repositório**: https://github.com/heltonfraga/wuzapi-manager

---

**Desenvolvido por**: WUZAPI Team  
**Licença**: MIT
