# ⚡ Quick Reference - Cortexx

Referência rápida para comandos e soluções mais comuns.

---

## 🚀 Deploy

```bash
# Deploy completo (recomendado)
./deploy.sh

# Verificar status
npm run docker:check

# Ver logs
npm run docker:logs
```

---

## 🔧 Fix Erro 404 do Traefik

```bash
# Solução rápida (30 segundos)
docker service update --force cortexx_cortexx

# Verificar se resolveu
curl -I https://cloudapi.wasend.com.br/health
```

**Documentação:** [docs/TRAEFIK_404_FIX.md](docs/TRAEFIK_404_FIX.md)

---

## 📊 Comandos Mais Usados

```bash
# Status do serviço
docker service ps cortexx_cortexx

# Logs em tempo real
docker service logs -f cortexx_cortexx

# Diagnóstico completo
npm run docker:check

# Entrar no contêiner
docker exec -it $(docker ps -q -f name=cortexx) sh

# Backup do banco
docker cp $(docker ps -q -f name=cortexx):/app/data/cloudapi.db ./backup.db
```

---

## 🐛 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| Erro 404 | `docker service update --force cortexx_cortexx` |
| Serviço não inicia | `npm run docker:check` → Ver logs |
| Health check falha | `docker service logs cortexx_cortexx \| grep health` |
| Alto uso de memória | Verificar logs, considerar aumentar limite |
| Banco travado | Verificar WAL mode, aumentar timeout |

**Documentação:** [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)

---

## 📚 Documentação

| Documento | Quando Usar |
|-----------|-------------|
| [README.md](README.md) | Visão geral do projeto |
| [DOCKER_QUICK_START.md](DOCKER_QUICK_START.md) | Primeiro deploy |
| [docs/DEPLOYMENT_SCRIPTS.md](docs/DEPLOYMENT_SCRIPTS.md) | Entender scripts de deploy |
| [docs/TRAEFIK_404_FIX.md](docs/TRAEFIK_404_FIX.md) | Resolver erro 404 |
| [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md) | Problemas diversos |
| [docs/DOCKER_SWARM_CHEATSHEET.md](docs/DOCKER_SWARM_CHEATSHEET.md) | Referência de comandos |

---

## 🔗 Links Úteis

- **Frontend Dev:** http://localhost:5173
- **Backend Dev:** http://localhost:3000
- **Produção:** https://cloudapi.wasend.com.br
- **Health Check:** https://cloudapi.wasend.com.br/health

---

## 💡 Dicas

1. **Sempre use `./deploy.sh`** ao invés de `docker stack deploy` direto
2. **Execute `npm run docker:check`** após cada deploy
3. **Monitore logs** nos primeiros minutos após deploy
4. **Faça backup** do banco antes de atualizações importantes
5. **Documente mudanças** em variáveis de ambiente

---

## 🆘 Precisa de Ajuda?

1. Verifique [docs/TROUBLESHOOTING.md](docs/TROUBLESHOOTING.md)
2. Execute `npm run docker:check` para diagnóstico
3. Consulte [docs/INDEX.md](docs/INDEX.md) para documentação completa

---

**Versão:** 1.5.46  
**Última atualização:** Dezembro 2025
