#!/bin/bash
# Deployment health check and diagnostics script
# Verifies Docker Swarm service status and Traefik configuration

set -e

STACK_NAME="wuzapi-manager"
SERVICE_NAME="${STACK_NAME}_wuzapi-manager"
DOMAIN="cloudapi.wasend.com.br"

echo "🔍 WUZAPI Manager Deployment Diagnostics"
echo "=========================================="
echo ""

# Check if service exists
echo "1️⃣ Checking if service exists..."
if docker service ls --filter "name=${SERVICE_NAME}" --format "{{.Name}}" | grep -q "${SERVICE_NAME}"; then
    echo "   ✅ Service found: ${SERVICE_NAME}"
else
    echo "   ❌ Service not found: ${SERVICE_NAME}"
    echo "   💡 Run: ./deploy.sh"
    exit 1
fi
echo ""

# Check service replicas
echo "2️⃣ Checking service replicas..."
REPLICAS=$(docker service ls --filter "name=${SERVICE_NAME}" --format "{{.Replicas}}")
echo "   Replicas: ${REPLICAS}"
if [[ "$REPLICAS" == "1/1" ]]; then
    echo "   ✅ Service is running"
else
    echo "   ⚠️  Service may be starting or failing"
fi
echo ""

# Check service tasks
echo "3️⃣ Checking service tasks..."
docker service ps "${SERVICE_NAME}" --filter "desired-state=running" --format "table {{.Name}}\t{{.CurrentState}}\t{{.Error}}" | head -n 5
echo ""

# Check for failed tasks
FAILED_TASKS=$(docker service ps "${SERVICE_NAME}" --filter "desired-state=shutdown" --format "{{.Name}}" | wc -l)
if [ "$FAILED_TASKS" -gt 0 ]; then
    echo "   ⚠️  Found ${FAILED_TASKS} failed tasks"
    echo "   💡 Run: docker service logs ${SERVICE_NAME} --tail 50"
else
    echo "   ✅ No failed tasks"
fi
echo ""

# Check Traefik labels
echo "4️⃣ Checking Traefik labels..."
LABELS=$(docker service inspect "${SERVICE_NAME}" --format '{{json .Spec.Labels}}' | grep -o "traefik" | wc -l)
if [ "$LABELS" -gt 0 ]; then
    echo "   ✅ Traefik labels found (${LABELS} labels)"
    
    # Show key labels
    echo "   📋 Key labels:"
    docker service inspect "${SERVICE_NAME}" --format '{{range $key, $value := .Spec.Labels}}{{if eq $key "traefik.http.routers.wuzapi-manager.rule"}}   - Host: {{$value}}{{end}}{{end}}'
    docker service inspect "${SERVICE_NAME}" --format '{{range $key, $value := .Spec.Labels}}{{if eq $key "traefik.http.services.wuzapi-manager.loadbalancer.server.port"}}   - Port: {{$value}}{{end}}{{end}}'
else
    echo "   ❌ No Traefik labels found"
    echo "   💡 Check docker-compose-swarm.yaml configuration"
fi
echo ""

# Check network
echo "5️⃣ Checking network connectivity..."
NETWORKS=$(docker service inspect "${SERVICE_NAME}" --format '{{range .Spec.TaskTemplate.Networks}}{{.Target}} {{end}}')
echo "   Networks: ${NETWORKS}"
if echo "$NETWORKS" | grep -q "network_public"; then
    echo "   ✅ Connected to network_public (Traefik network)"
    
    # Count networks (should be only 1)
    NETWORK_COUNT=$(echo "$NETWORKS" | wc -w | tr -d ' ')
    if [ "$NETWORK_COUNT" -eq 1 ]; then
        echo "   ✅ Using single network (optimal)"
    else
        echo "   ℹ️  Connected to ${NETWORK_COUNT} networks"
    fi
else
    echo "   ⚠️  Not connected to network_public"
    echo "   💡 Service may not be accessible via Traefik"
fi
echo ""

# Check health
echo "6️⃣ Checking service health..."
CONTAINER_ID=$(docker ps -q -f "name=${SERVICE_NAME}")
if [ -n "$CONTAINER_ID" ]; then
    HEALTH=$(docker inspect "$CONTAINER_ID" --format '{{.State.Health.Status}}' 2>/dev/null || echo "no healthcheck")
    echo "   Health status: ${HEALTH}"
    
    if [ "$HEALTH" == "healthy" ]; then
        echo "   ✅ Service is healthy"
    elif [ "$HEALTH" == "no healthcheck" ]; then
        echo "   ℹ️  No healthcheck configured"
    else
        echo "   ⚠️  Service is ${HEALTH}"
        echo "   💡 Run: docker service logs ${SERVICE_NAME} --tail 50"
    fi
else
    echo "   ⚠️  No running container found"
fi
echo ""

# Test external access
echo "7️⃣ Testing external access..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "https://${DOMAIN}/health" --max-time 5 || echo "000")
echo "   URL: https://${DOMAIN}/health"
echo "   HTTP Status: ${HTTP_CODE}"

if [ "$HTTP_CODE" == "200" ]; then
    echo "   ✅ Service is accessible externally"
elif [ "$HTTP_CODE" == "404" ]; then
    echo "   ❌ 404 Not Found - Traefik not routing correctly"
    echo "   💡 Run: docker service update --force ${SERVICE_NAME}"
elif [ "$HTTP_CODE" == "502" ]; then
    echo "   ❌ 502 Bad Gateway - Service not responding"
    echo "   💡 Check service logs and health"
elif [ "$HTTP_CODE" == "000" ]; then
    echo "   ❌ Connection failed - DNS or network issue"
    echo "   💡 Check domain DNS and Traefik configuration"
else
    echo "   ⚠️  Unexpected status code"
fi
echo ""

# Summary
echo "=========================================="
echo "📊 Summary"
echo "=========================================="
echo ""

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ All checks passed! Service is running correctly."
    echo ""
    echo "🌐 Access your service at:"
    echo "   https://${DOMAIN}"
else
    echo "⚠️  Some issues detected. Review the checks above."
    echo ""
    echo "🔧 Quick fixes:"
    echo "   1. Force Traefik registration: docker service update --force ${SERVICE_NAME}"
    echo "   2. Check logs: docker service logs ${SERVICE_NAME} --tail 50"
    echo "   3. Redeploy: ./deploy.sh"
    echo ""
    echo "📚 For detailed troubleshooting, see:"
    echo "   docs/TROUBLESHOOTING.md"
fi
echo ""
