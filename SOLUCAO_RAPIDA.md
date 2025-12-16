# Solução Rápida - Frontend não carrega no servidor

## Diagnóstico Inicial

Acessei `https://cloudapi.wasend.com.br` via Chrome DevTools e identifiquei:

- ❌ Retorna: `404 page not found` (texto plano)
- ❌ Até `/health` retorna 404
- ✅ Cloudflare está funcionando (headers CF presentes)
- ✅ Traefik está respondendo (server: cloudflare)

**Conclusão:** O Traefik está recebendo as requisições, mas não está roteando para o container correto, OU o container não tem os arquivos do frontend.

---

## Solução Mais Provável: Rebuild da Imagem

A causa mais comum é que a imagem Docker não contém o diretório `dist/` com o frontend buildado.

### Passo 1: Rebuild e Push da Imagem

Execute no seu ambiente de desenvolvimento:

```bash
# Fazer build multi-arquitetura e push
npm run deploy:official
```

Isso irá:
1. Buildar o frontend (`npm run build:production`)
2. Criar imagem Docker multi-arch (amd64 + arm64)
3. Fazer push para `heltonfraga/wuzapi-manager:v1.5.47` e `:latest`

### Passo 2: Atualizar o Serviço no Servidor

Execute no servidor:

```bash
# Forçar atualização do serviço com a nova imagem
docker service update \
  --image heltonfraga/wuzapi-manager:v1.5.47 \
  --force \
  wuzapi-manager_wuzapi-manager

# Acompanhar o progresso
docker service ps wuzapi-manager_wuzapi-manager

# Ver logs
docker service logs -f wuzapi-manager_wuzapi-manager
```

### Passo 3: Verificar

```bash
# Aguardar 30-60 segundos e testar
curl https://cloudapi.wasend.com.br/health

# Deve retornar JSON com status
```

---

## Solução Alternativa 1: Problema no Traefik

Se o rebuild não resolver, o problema pode ser no roteamento do Traefik.

### Verificar Labels do Traefik

```bash
docker service inspect wuzapi-manager_wuzapi-manager \
  --format='{{json .Spec.Labels}}' | jq
```

**Verifique se existe:**
- `traefik.enable: "true"`
- `traefik.http.routers.wuzapi-manager.rule: "Host(\`cloudapi.wasend.com.br\`)"`
- `traefik.http.services.wuzapi-manager.loadbalancer.server.port: "3001"`

### Forçar Reconhecimento do Traefik

```bash
# Forçar update do serviço
docker service update --force wuzapi-manager_wuzapi-manager

# Reiniciar o Traefik (se necessário)
docker service update --force traefik_traefik
```

---

## Solução Alternativa 2: Testar Porta Direta

O docker-compose-swarm.yaml expõe a porta `3004:3001`. Teste o acesso direto:

```bash
# No servidor
curl http://localhost:3004/health

# Se funcionar, o problema é no Traefik
# Se não funcionar, o problema é no container
```

Se funcionar pela porta 3004, adicione uma regra temporária no Traefik ou ajuste o firewall.

---

## Solução Alternativa 3: Verificar Rede

```bash
# Verificar se o container está na rede correta
docker network inspect network_public | grep wuzapi

# Se não estiver, reconectar
docker service update \
  --network-add network_public \
  wuzapi-manager_wuzapi-manager
```

---

## Checklist de Verificação Pós-Deploy

Após aplicar a solução, verifique:

- [ ] `curl https://cloudapi.wasend.com.br/health` retorna JSON
- [ ] `curl https://cloudapi.wasend.com.br/` retorna HTML
- [ ] Browser carrega a interface React
- [ ] Logs não mostram erros: `docker service logs wuzapi-manager_wuzapi-manager`
- [ ] Container está rodando: `docker ps | grep wuzapi`

---

## Logs Importantes para Verificar

Após o deploy, os logs devem mostrar:

```
✅ Servindo arquivos estáticos do build React: /app/dist
✅ WUZAPI Manager Server rodando na porta 3001
✅ Banco de dados SQLite inicializado
```

Se mostrar:

```
⚠️ Diretório dist/ não encontrado
```

Então a imagem não foi buildada corretamente. Refaça o `npm run deploy:official`.

---

## Comando Completo de Deploy

Se quiser fazer tudo de uma vez:

```bash
# No ambiente de desenvolvimento
npm run deploy:official

# Aguardar o push completar, então no servidor:
docker service update \
  --image heltonfraga/wuzapi-manager:v1.5.47 \
  --force \
  wuzapi-manager_wuzapi-manager

# Aguardar 60 segundos
sleep 60

# Testar
curl https://cloudapi.wasend.com.br/health
```

---

## Se Nada Funcionar

Execute o diagnóstico completo e me envie os resultados:

```bash
chmod +x diagnose-server.sh
./diagnose-server.sh > diagnostico.txt
cat diagnostico.txt
```

Ou execute manualmente os comandos do arquivo `DIAGNOSTICO_SERVIDOR.md`.
