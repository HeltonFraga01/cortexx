# 🚨 AÇÃO IMEDIATA - Frontend não carrega

## Problema

`https://cloudapi.wasend.com.br` retorna **404 page not found** para todas as rotas.

## Causa Mais Provável

A imagem Docker `heltonfraga/wuzapi-manager:v1.5.47` não contém o diretório `/app/dist` com o frontend buildado.

## Solução (3 passos)

### 1️⃣ Rebuild da Imagem (no seu computador)

```bash
# Fazer build do frontend + Docker multi-arch + push
npm run deploy:official
```

**Tempo estimado:** 5-10 minutos

**O que faz:**
- Build do frontend React (`vite build`)
- Build da imagem Docker para amd64 e arm64
- Push para Docker Hub

---

### 2️⃣ Atualizar Serviço (no servidor)

```bash
# SSH no servidor e executar:
docker service update \
  --image heltonfraga/wuzapi-manager:v1.5.47 \
  --force \
  wuzapi-manager_wuzapi-manager
```

**Tempo estimado:** 1-2 minutos

**O que faz:**
- Baixa a nova imagem
- Recria o container
- Aplica a atualização

---

### 3️⃣ Verificar (no servidor ou browser)

```bash
# Aguardar 60 segundos, então testar:
curl https://cloudapi.wasend.com.br/health

# Deve retornar JSON com status "ok"
```

**Ou abrir no browser:**
- https://cloudapi.wasend.com.br

---

## Se Não Funcionar

Execute o diagnóstico:

```bash
# No servidor
docker service logs --tail 50 wuzapi-manager_wuzapi-manager

# Procure por:
# ✅ "Servindo arquivos estáticos do build React"
# ❌ "Diretório dist/ não encontrado"
```

---

## Comandos Úteis

```bash
# Ver status do serviço
docker service ps wuzapi-manager_wuzapi-manager

# Ver logs em tempo real
docker service logs -f wuzapi-manager_wuzapi-manager

# Testar porta direta (bypass Traefik)
curl http://localhost:3004/health

# Reiniciar serviço
docker service update --force wuzapi-manager_wuzapi-manager
```

---

## Checklist Rápido

- [ ] Executei `npm run deploy:official` no meu computador
- [ ] Aguardei o push completar (vejo "Deploy Concluído")
- [ ] Executei `docker service update` no servidor
- [ ] Aguardei 60 segundos
- [ ] Testei `curl https://cloudapi.wasend.com.br/health`
- [ ] Abri no browser e vejo a interface React

---

## Explicação Técnica

O Dockerfile tem múltiplos estágios:

1. **frontend-builder** - Builda o React (`npm run build:production`)
2. **production** - Copia o `/app/dist` do estágio anterior

Se o build do frontend falhar ou não for copiado, o container não terá os arquivos estáticos.

O servidor Express (`server/index.js`) tenta servir de `/app/dist`:

```javascript
if (fs.existsSync(distPath)) {
  app.use(express.static(distPath));
} else {
  logger.warn('⚠️ Diretório dist/ não encontrado');
}
```

Se `dist/` não existir, todas as rotas retornam 404.

---

## Próximos Passos

1. Execute o passo 1 agora
2. Quando terminar, execute o passo 2
3. Verifique com o passo 3
4. Se não funcionar, me envie os logs
