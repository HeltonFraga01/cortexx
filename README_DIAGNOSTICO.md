# 🔍 Diagnóstico: Frontend não carrega no servidor

## 📋 Resumo do Problema

**URL:** https://cloudapi.wasend.com.br  
**Erro:** 404 page not found (texto plano)  
**Status:** Cloudflare ✅ | Traefik ✅ | Container ❌

---

## 🎯 Solução Recomendada (90% de chance de resolver)

### Causa Provável
A imagem Docker não contém o diretório `/app/dist` com o frontend buildado.

### Solução em 3 Passos

#### 1. No seu computador (desenvolvimento)
```bash
npm run deploy:official
```
⏱️ Tempo: 5-10 minutos

#### 2. No servidor (produção)
```bash
docker service update --image heltonfraga/wuzapi-manager:v1.5.47 --force wuzapi-manager_wuzapi-manager
```
⏱️ Tempo: 1-2 minutos

#### 3. Verificar
```bash
curl https://cloudapi.wasend.com.br/health
```
✅ Deve retornar JSON com status

---

## 📁 Arquivos Criados

| Arquivo | Descrição |
|---------|-----------|
| **ACAO_IMEDIATA.md** | Solução rápida em 3 passos |
| **SOLUCAO_RAPIDA.md** | Soluções detalhadas + alternativas |
| **DIAGNOSTICO_SERVIDOR.md** | Comandos de diagnóstico completo |
| **VERIFICACOES_ADICIONAIS.md** | Troubleshooting avançado |
| **diagnose-server.sh** | Script automatizado de diagnóstico |

---

## 🚀 Ordem de Execução

### Cenário 1: Solução Rápida (Recomendado)
1. Leia: `ACAO_IMEDIATA.md`
2. Execute os 3 passos
3. Verifique se funcionou

### Cenário 2: Não Funcionou
1. Leia: `SOLUCAO_RAPIDA.md`
2. Tente as soluções alternativas
3. Execute: `./diagnose-server.sh`
4. Me envie o resultado

### Cenário 3: Troubleshooting Avançado
1. Leia: `DIAGNOSTICO_SERVIDOR.md`
2. Execute os comandos manualmente
3. Leia: `VERIFICACOES_ADICIONAIS.md`
4. Execute as verificações específicas

---

## 🔧 Comandos Úteis

### Ver Status
```bash
docker service ps wuzapi-manager_wuzapi-manager
```

### Ver Logs
```bash
docker service logs -f wuzapi-manager_wuzapi-manager
```

### Testar Internamente
```bash
docker exec $(docker ps -q -f name=wuzapi-manager) wget -qO- http://localhost:3001/health
```

### Testar Porta Direta
```bash
curl http://localhost:3004/health
```

### Reiniciar Serviço
```bash
docker service update --force wuzapi-manager_wuzapi-manager
```

---

## 🎓 Entendendo o Problema

### Arquitetura
```
Browser → Cloudflare → Traefik → Container (Node.js + Express)
                                      ↓
                                  /app/dist (Frontend React)
```

### O que acontece
1. Cloudflare recebe a requisição ✅
2. Traefik roteia para o container ✅
3. Express tenta servir de `/app/dist` ❌
4. Se `/app/dist` não existe → 404

### Por que acontece
- Build do frontend não foi executado
- Dockerfile não copiou o `dist/`
- Imagem antiga sem o frontend

---

## 📊 Checklist de Verificação

Após aplicar a solução:

- [ ] `curl https://cloudapi.wasend.com.br/health` retorna JSON
- [ ] `curl https://cloudapi.wasend.com.br/` retorna HTML
- [ ] Browser carrega a interface React
- [ ] Logs mostram: "Servindo arquivos estáticos do build React"
- [ ] Sem erros nos logs
- [ ] Container está rodando: `docker ps | grep wuzapi`

---

## 🆘 Precisa de Ajuda?

Se a solução não funcionar:

1. Execute: `./diagnose-server.sh > resultado.txt`
2. Me envie o arquivo `resultado.txt`
3. Ou copie e cole a saída dos comandos:
   ```bash
   docker service ps wuzapi-manager_wuzapi-manager
   docker service logs --tail 50 wuzapi-manager_wuzapi-manager
   docker exec $(docker ps -q -f name=wuzapi-manager) ls -la /app/dist/
   ```

---

## 📝 Notas Importantes

- **Não** modifique o `docker-compose-swarm.yaml` sem necessidade
- **Sempre** use `npm run deploy:official` para build multi-arch
- **Aguarde** 60-90 segundos após `docker service update`
- **Verifique** os logs após cada mudança
- **Teste** primeiro com `curl` antes do browser

---

## ✅ Sucesso Esperado

Após a solução, você deve ver:

### No browser
- Interface React carregada
- Login funcionando
- Dashboard acessível

### Nos logs
```
✅ Servindo arquivos estáticos do build React: /app/dist
✅ WUZAPI Manager Server rodando na porta 3001
✅ Banco de dados SQLite inicializado
```

### No curl
```bash
$ curl https://cloudapi.wasend.com.br/health
{"status":"ok","database":{"status":"connected"},...}
```

---

## 🎯 Próximos Passos

1. **Agora:** Execute `ACAO_IMEDIATA.md`
2. **Se funcionar:** Pronto! ✅
3. **Se não funcionar:** Execute `diagnose-server.sh`
4. **Me envie:** Os resultados para análise

Boa sorte! 🚀
