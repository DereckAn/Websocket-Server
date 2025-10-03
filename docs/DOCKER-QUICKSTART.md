# 🐳 Docker Quick Start Guide

## ✅ Archivos Configurados

Todos los archivos Docker ya están listos:

- ✅ `Dockerfile` - Multi-stage build optimizado
- ✅ `.dockerignore` - Excluye archivos innecesarios
- ✅ `docker-compose.yml` - Orquestación para dev y producción
- ✅ `.env.example` - Plantilla de variables de entorno
- ✅ `DOCKER.md` - Documentación completa

---

## 🚀 Comandos Esenciales

### 1. Preparar Variables de Entorno

```bash
# Copiar plantilla
cp .env.example .env

# Editar con tus valores reales
nano .env
```

### 2. Desarrollo Local con Docker Compose

```bash
# Iniciar servidor de desarrollo (con hot reload)
docker-compose --profile dev up -d

# Ver logs
docker-compose logs -f gomoku-server-dev

# Detener
docker-compose --profile dev down
```

### 3. Producción con Docker Compose

```bash
# Iniciar servidor de producción
docker-compose up -d

# Ver logs
docker-compose logs -f gomoku-server

# Detener
docker-compose down
```

### 4. Build y Run Manual (sin Docker Compose)

```bash
# Build
docker build -t gomoku-server:latest .

# Run
docker run -d \
  --name gomoku-server \
  -p 3000:3000 \
  --env-file .env \
  gomoku-server:latest

# Logs
docker logs -f gomoku-server

# Stop y remove
docker stop gomoku-server && docker rm gomoku-server
```

---

## 📦 Transferir a Otras Máquinas

### Opción 1: Docker Hub (Recomendado)

```bash
# 1. Login a Docker Hub
docker login

# 2. Tag de la imagen
docker tag gomoku-server:latest tu-usuario/gomoku-server:v1.0.0

# 3. Push
docker push tu-usuario/gomoku-server:v1.0.0

# 4. En otra máquina
docker pull tu-usuario/gomoku-server:v1.0.0
docker run -d -p 3000:3000 --env-file .env tu-usuario/gomoku-server:v1.0.0
```

### Opción 2: Export/Import (Sin registry)

```bash
# En máquina origen
docker save gomoku-server:latest | gzip > gomoku-server.tar.gz

# Transferir archivo
scp gomoku-server.tar.gz user@server:/tmp/

# En máquina destino
gunzip -c gomoku-server.tar.gz | docker load
docker run -d -p 3000:3000 --env-file .env gomoku-server:latest
```

### Opción 3: Git Clone (Más simple)

```bash
# En cualquier máquina con Docker
git clone https://github.com/tu-usuario/bun-server.git
cd bun-server
cp .env.example .env
# Editar .env con valores reales
docker-compose up -d
```

---

## 🔍 Verificar que Funciona

```bash
# Health check
curl http://localhost:3000/health

# Respuesta esperada:
# {"success":true,"data":{"status":"healthy","uptime":...}}

# API status
curl http://localhost:3000/api/status

# Square health
curl http://localhost:3000/square/health
```

---

## 🐛 Troubleshooting

### Docker daemon no está corriendo

```bash
# macOS: Iniciar Docker Desktop
# Linux: sudo systemctl start docker
# Windows: Iniciar Docker Desktop
```

### Puerto 3000 ya en uso

```bash
# Cambiar puerto en docker-compose.yml
# O usar variable de entorno
PORT=3001 docker-compose up -d
```

### Ver errores de build

```bash
docker build --no-cache --progress=plain -t gomoku-server:latest .
```

### Entrar al contenedor

```bash
docker exec -it gomoku-server sh
```

---

## 📊 Monitoreo

```bash
# Ver uso de recursos
docker stats gomoku-server

# Ver logs en tiempo real
docker logs -f gomoku-server

# Ver solo errores
docker logs gomoku-server 2>&1 | grep '"level":"error"'
```

---

## 🔐 Seguridad

- ✅ Usuario no-root en contenedor
- ✅ Multi-stage build para imagen mínima
- ✅ Health checks automáticos
- ✅ Variables de entorno nunca en código
- ✅ .dockerignore excluye archivos sensibles

---

## ✅ Checklist

Antes de desplegar:

- [ ] Docker daemon corriendo
- [ ] Archivo `.env` configurado
- [ ] `NODE_ENV=production` para producción
- [ ] `SQUARE_ACCESS_TOKEN` de producción
- [ ] `ALLOWED_ORIGINS` con dominios correctos
- [ ] Build exitoso: `docker build -t gomoku-server:latest .`
- [ ] Test local funciona
- [ ] Health check responde

---

Para más detalles, ver **DOCKER.md**
