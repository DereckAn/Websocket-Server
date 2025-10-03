# 🐳 Docker Deployment Guide

## Configuración Docker para Bun Server

### 📋 Archivos Incluidos

- **Dockerfile** - Multi-stage build optimizado para producción
- **.dockerignore** - Excluye archivos innecesarios del build
- **docker-compose.yml** - Orquestación para desarrollo local

---

## 🚀 Quick Start

### Opción 1: Docker Compose (Recomendado para desarrollo)

```bash
# 1. Crear archivo .env (si no existe)
cp .env.example .env

# 2. Editar variables de entorno
nano .env

# 3. Iniciar el servidor
docker-compose up -d

# 4. Ver logs
docker-compose logs -f

# 5. Detener el servidor
docker-compose down
```

### Opción 2: Docker CLI (Para producción)

```bash
# 1. Build de la imagen
docker build -t gomoku-server:latest .

# 2. Run del contenedor
docker run -d \
  --name gomoku-server \
  -p 3000:3000 \
  --env-file .env \
  gomoku-server:latest

# 3. Ver logs
docker logs -f gomoku-server

# 4. Detener y remover
docker stop gomoku-server
docker rm gomoku-server
```

---

## 🔧 Configuración

### Variables de Entorno Requeridas

Crear archivo `.env` en la raíz del proyecto:

```bash
# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# CORS
ALLOWED_ORIGINS=https://tu-frontend.vercel.app

# Square API
SQUARE_ACCESS_TOKEN=tu_token_de_produccion
SQUARE_WEBHOOK_SIGNATURE_KEY=tu_signature_key
SQUARE_ENVIRONMENT=production
WEBHOOK_URL=https://tu-dominio.com/webhooks/square

# Gomoku (opcional - usar defaults)
MAX_ACTIVE_ROOMS=1000
ROOM_CLEANUP_INTERVAL=300000
INACTIVE_ROOM_TIMEOUT=1800000
AI_MAX_TIME_PER_MOVE=10000

# Rate Limiting (opcional)
MAX_GAME_CREATIONS_PER_MINUTE=5
MAX_MOVES_PER_MINUTE=60
```

---

## 📦 Build Multi-Stage

El Dockerfile usa 3 stages para optimización:

### Stage 1: Dependencies
- Instala solo dependencias de producción
- Usa `--frozen-lockfile` para reproducibilidad

### Stage 2: Builder (opcional)
- Type checking con TypeScript
- Comentado por defecto para builds más rápidos

### Stage 3: Production
- Imagen final mínima
- Usuario no-root para seguridad
- Health checks configurados

---

## 🔍 Health Checks

El contenedor incluye health checks automáticos:

```bash
# Verificar estado del contenedor
docker ps

# El estado debe ser "healthy" después de 5-10 segundos
```

**Endpoint:** `http://localhost:3000/health`

**Intervalo:** 30 segundos

---

## 📊 Monitoreo y Logs

### Ver logs en tiempo real
```bash
# Docker Compose
docker-compose logs -f

# Docker CLI
docker logs -f gomoku-server
```

### Logs estructurados en JSON
Todos los logs están en formato JSON:
```json
{
  "timestamp": "2025-01-15T10:30:00.000Z",
  "level": "info",
  "message": "Server started successfully",
  "data": { "port": 3000 }
}
```

### Filtrar logs por nivel
```bash
# Solo errores
docker logs gomoku-server 2>&1 | grep '"level":"error"'

# Solo warnings
docker logs gomoku-server 2>&1 | grep '"level":"warn"'
```

---

## 🌐 Despliegue en Otras Máquinas

### Método 1: Docker Registry (Recomendado)

```bash
# 1. Tag de la imagen
docker tag gomoku-server:latest tu-usuario/gomoku-server:v1.0.0

# 2. Push al registry (Docker Hub)
docker push tu-usuario/gomoku-server:v1.0.0

# 3. En la máquina destino
docker pull tu-usuario/gomoku-server:v1.0.0
docker run -d \
  --name gomoku-server \
  -p 3000:3000 \
  --env-file .env \
  tu-usuario/gomoku-server:v1.0.0
```

### Método 2: Export/Import (Sin registry)

```bash
# 1. En la máquina origen - Exportar imagen
docker save gomoku-server:latest | gzip > gomoku-server.tar.gz

# 2. Transferir archivo a máquina destino
scp gomoku-server.tar.gz usuario@servidor:/tmp/

# 3. En la máquina destino - Importar imagen
gunzip -c gomoku-server.tar.gz | docker load

# 4. Ejecutar
docker run -d \
  --name gomoku-server \
  -p 3000:3000 \
  --env-file .env \
  gomoku-server:latest
```

### Método 3: Git + Build (Para desarrollo)

```bash
# En cualquier máquina
git clone https://github.com/tu-usuario/gomoku-server.git
cd gomoku-server
docker-compose up -d
```

---

## 🔒 Seguridad

### ✅ Mejores Prácticas Implementadas

1. **Usuario no-root** - El contenedor corre como usuario `bunjs` (uid 1001)
2. **Multi-stage build** - Imagen final mínima sin dev dependencies
3. **Health checks** - Monitoreo automático del estado del contenedor
4. **Resource limits** - Límites de CPU y memoria en docker-compose
5. **.dockerignore** - No incluye archivos sensibles (.env, .git, etc.)

### ⚠️ Importante

- **NUNCA** commitear archivos `.env` al repositorio
- **NUNCA** incluir tokens/secrets en el Dockerfile
- Usar `.env.example` como plantilla sin valores reales
- Rotar secrets regularmente en producción

---

## 🛠️ Troubleshooting

### Problema: Contenedor no inicia

```bash
# Ver logs
docker logs gomoku-server

# Verificar variables de entorno
docker exec gomoku-server env

# Entrar al contenedor para debugging
docker exec -it gomoku-server sh
```

### Problema: Puerto ya en uso

```bash
# Cambiar puerto en docker-compose.yml o usar variable
PORT=3001 docker-compose up -d

# O en Docker CLI
docker run -d -p 3001:3000 --env-file .env gomoku-server:latest
```

### Problema: Build falla

```bash
# Limpiar cache y rebuild
docker build --no-cache -t gomoku-server:latest .

# Ver build detallado
docker build --progress=plain -t gomoku-server:latest .
```

### Problema: Health check falla

```bash
# Verificar que el servidor responde
docker exec gomoku-server curl -f http://localhost:3000/health

# Deshabilitar health check temporalmente (docker-compose.yml)
# Comentar la sección healthcheck
```

### Problema: Contenedor usa mucha memoria

```bash
# Ver uso de recursos
docker stats gomoku-server

# Ajustar límites en docker-compose.yml
deploy:
  resources:
    limits:
      memory: 256M  # Reducir de 512M a 256M
```

---

## 📈 Optimizaciones

### Build más rápido

```dockerfile
# En Dockerfile, comentar type checking
# RUN bun run type-check
```

### Imagen más pequeña

```bash
# Usar alpine variant (si está disponible)
FROM oven/bun:1-alpine AS runner

# Ver tamaño de la imagen
docker images gomoku-server
```

### Hot reload en desarrollo

```bash
# Ya configurado en docker-compose.yml
volumes:
  - ./src:/app/src:ro
```

---

## 🚢 Despliegue en Cloud

### Railway (con Docker)

```bash
# Railway detectará automáticamente el Dockerfile
railway up
```

### AWS ECS/Fargate

```bash
# 1. Push a ECR
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag gomoku-server:latest <account-id>.dkr.ecr.us-east-1.amazonaws.com/gomoku-server:latest
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/gomoku-server:latest

# 2. Crear task definition y service en ECS
```

### Google Cloud Run

```bash
# 1. Tag y push a GCR
docker tag gomoku-server:latest gcr.io/<project-id>/gomoku-server:latest
docker push gcr.io/<project-id>/gomoku-server:latest

# 2. Deploy
gcloud run deploy gomoku-server \
  --image gcr.io/<project-id>/gomoku-server:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### DigitalOcean App Platform

```bash
# DigitalOcean detectará el Dockerfile automáticamente
# Solo configura variables de entorno en el dashboard
```

---

## 🧪 Testing

### Probar localmente

```bash
# 1. Build
docker build -t gomoku-server:test .

# 2. Run con variables de test
docker run -d \
  --name gomoku-test \
  -p 3000:3000 \
  -e NODE_ENV=test \
  -e LOG_LEVEL=debug \
  gomoku-server:test

# 3. Probar endpoints
curl http://localhost:3000/health
curl http://localhost:3000/api/status

# 4. Cleanup
docker stop gomoku-test
docker rm gomoku-test
```

---

## 📝 Comandos Útiles

```bash
# Ver todas las imágenes
docker images

# Eliminar imágenes sin usar
docker image prune -a

# Ver todos los contenedores
docker ps -a

# Eliminar contenedores detenidos
docker container prune

# Acceder al shell del contenedor
docker exec -it gomoku-server sh

# Copiar archivos desde/hacia contenedor
docker cp gomoku-server:/app/logs/app.log ./app.log

# Ver uso de recursos en tiempo real
docker stats

# Inspeccionar contenedor
docker inspect gomoku-server
```

---

## ✅ Checklist Pre-Deploy

- [ ] Archivo `.env` configurado con valores de producción
- [ ] `NODE_ENV=production`
- [ ] `SQUARE_ACCESS_TOKEN` de producción (no sandbox)
- [ ] `ALLOWED_ORIGINS` configurado correctamente
- [ ] Build exitoso: `docker build -t gomoku-server:latest .`
- [ ] Test local: `docker run` con variables de producción
- [ ] Health check responde: `curl http://localhost:3000/health`
- [ ] Logs estructurados funcionando
- [ ] Resource limits configurados (si necesario)

---

**Última actualización:** 15 de Enero, 2025
**Docker version:** 20.10+
**Bun version:** 1.0+
**Status:** ✅ Listo para deploy
