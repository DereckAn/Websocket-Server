# ✅ Checklist Pre-Producción

## Estado Actual del Proyecto

### ✅ Completado (Listo para Producción)

| Componente | Estado | Notas |
|------------|--------|-------|
| Logging estructurado | ✅ | Migración 100% completa |
| Square webhook integration | ✅ | Código correcto, servicios inicializados |
| AdminWebSocketService | ✅ | Keep-alive, broadcasting, cleanup |
| Graceful shutdown | ✅ | Handlers registrados para todos los servicios |
| Health checks | ✅ | `/health`, `/square/health` |
| Rate limiting | ✅ | Configurado para webhooks y API |
| CORS | ✅ | Middleware implementado |
| Error handling | ✅ | Try-catch en todos los endpoints |
| WebSocket routing | ✅ | Gomoku y Admin separados correctamente |
| Cleanup services | ✅ | Auto-limpieza de recursos |
| Documentation | ✅ | Completa y actualizada |

---

## ✅ CRÍTICO - Arreglado

### 1. Square API Call Habilitada

**Archivo:** `src/services/SquareService.ts:235`

**Arreglado:**
```typescript
const { result } = await this.squareClient.ordersApi.retrieveOrder(orderId);

if (!result.order) {
  logger.warn(`Order not found in Square API: ${orderId}`);
  return null;
}

logger.info(`✅ Order retrieved from Square API: ${orderId}`);
return result.order as SquareOrder;
```

**Estado:** ✅ **COMPLETADO**

---

## ⚠️ Configuración Requerida

### 2. Variables de Entorno de Producción

**Archivo:** `.env`

**Verificar que estas variables tengan valores de PRODUCCIÓN:**

```bash
# Square - PRODUCCIÓN
SQUARE_ACCESS_TOKEN=EAAxxxxx  # ⚠️ Token de PRODUCCIÓN (no sandbox)
SQUARE_WEBHOOK_SIGNATURE_KEY=xxxxx  # ⚠️ Signature key de PRODUCCIÓN
SQUARE_ENVIRONMENT=production  # ⚠️ Cambiar de 'sandbox' a 'production'

# URLs de Producción
WEBHOOK_URL=https://api.tudominio.com/webhooks/square  # ⚠️ URL real

# CORS - Incluir dominio de admin_mich
ALLOWED_ORIGINS=https://admin-mich.tudominio.com,https://tudominio.com

# Server
NODE_ENV=production
PORT=3000
LOG_LEVEL=info  # No 'debug' en producción

# Gomoku (valores por defecto están bien)
MAX_ACTIVE_ROOMS=1000
ROOM_CLEANUP_INTERVAL=300000
INACTIVE_ROOM_TIMEOUT=1800000
AI_MAX_TIME_PER_MOVE=10000

# Rate Limiting (valores por defecto están bien)
MAX_GAME_CREATIONS_PER_MINUTE=5
MAX_MOVES_PER_MINUTE=60
```

**Estado:** ⚠️ **VERIFICAR Y ACTUALIZAR**

---

### 3. Configuración en Square Dashboard

**URL:** https://developer.squareup.com/apps

**Pasos:**

1. ✅ Seleccionar tu aplicación
2. ✅ Ir a **Webhooks**
3. ✅ Agregar webhook URL: `https://api.tudominio.com/webhooks/square`
4. ✅ Suscribirse a eventos:
   - `order.created`
   - `order.updated`
   - `order.fulfilled`
5. ✅ Copiar **Signature Key** a `.env`
6. ✅ Cambiar a modo **PRODUCTION** (no sandbox)

**Estado:** ⚠️ **CONFIGURAR**

---

### 4. Deployment Setup

**Plataforma recomendada:** Railway, Render, DigitalOcean, AWS

**Pasos generales:**

1. ✅ Conectar repositorio Git
2. ✅ Configurar build command:
   ```bash
   bun install
   ```
3. ✅ Configurar start command:
   ```bash
   bun run src/server.ts
   ```
4. ✅ Configurar variables de entorno (copiar del .env)
5. ✅ Habilitar HTTPS/SSL (requerido para webhooks)
6. ✅ Configurar dominio custom o usar el provisto

**Estado:** ⚠️ **CONFIGURAR**

---

## 🧪 Testing Pre-Producción

### Test 1: Servidor Local con Variables de Producción

```bash
# Temporalmente cambiar .env a valores de producción
NODE_ENV=production bun run src/server.ts
```

**Verificar logs:**
```
[INFO] ✅ Square client initialized: { environment: 'production', tokenPresent: true }
[INFO] 🔌 Admin WebSocket service initialized
[INFO] 💓 Admin keep-alive started (30000ms interval)
```

### Test 2: Health Checks

```bash
curl http://localhost:3000/square/health
```

**Esperado:**
```json
{
  "success": true,
  "data": {
    "square": {
      "status": "healthy",
      "details": {
        "configured": true,
        "clientInitialized": true
      }
    }
  }
}
```

### Test 3: WebSocket Connection

```javascript
const ws = new WebSocket('ws://localhost:3000/admin');
ws.onopen = () => console.log('✅ Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
```

### Test 4: Square API Call (Después de descomentar)

```bash
# Buscar una orden real
curl http://localhost:3000/orders/ORDER_ID_REAL
```

**Esperado:** Datos reales de la orden de Square

---

## 🚀 Pasos para Deploy

### Día antes del deploy:

- [ ] Arreglar Square API call (descomentar línea 236)
- [ ] Actualizar .env con valores de producción
- [ ] Probar localmente con variables de producción
- [ ] Verificar que todos los health checks pasen
- [ ] Verificar que WebSocket conecte correctamente

### Día del deploy:

1. **Deploy del servidor:**
   - [ ] Hacer push del código a Git
   - [ ] Configurar variables de entorno en la plataforma
   - [ ] Deploy y verificar logs
   - [ ] Probar health check: `https://api.tudominio.com/health`

2. **Configurar Square webhooks:**
   - [ ] Ir a Square Dashboard → Webhooks
   - [ ] Agregar URL: `https://api.tudominio.com/webhooks/square`
   - [ ] Copiar signature key a variables de entorno
   - [ ] Suscribirse a eventos de orders
   - [ ] Enviar test webhook desde Square

3. **Probar integración completa:**
   - [ ] Abrir admin_mich en producción
   - [ ] Conectar WebSocket a `wss://api.tudominio.com/admin`
   - [ ] Verificar conexión exitosa
   - [ ] Desde Square Dashboard, enviar test webhook
   - [ ] Verificar que admin_mich recibe el mensaje
   - [ ] Crear orden real en Square POS
   - [ ] Verificar que aparece en admin_mich

4. **Monitoreo:**
   - [ ] Configurar alertas para errores
   - [ ] Monitorear logs: `LOG_LEVEL=info`
   - [ ] Verificar métricas: `/square/stats`
   - [ ] Verificar conexiones: `/square/connections`

---

## 📊 Post-Deploy Verification

### Inmediatamente después del deploy:

```bash
# 1. Health check general
curl https://api.tudominio.com/health

# 2. Square health check
curl https://api.tudominio.com/square/health

# 3. Square stats
curl https://api.tudominio.com/square/stats

# 4. Conexiones activas
curl https://api.tudominio.com/square/connections
```

### Prueba end-to-end:

1. Abrir admin_mich
2. Verificar que WebSocket conecta (ver consola del navegador)
3. Crear orden en Square POS
4. Verificar que aparece en admin_mich en tiempo real
5. Verificar logs del servidor

---

## 🔒 Security Checklist

- [ ] HTTPS habilitado (requerido para webhooks de Square)
- [ ] Variables de entorno no expuestas en código
- [ ] CORS configurado solo para dominios autorizados
- [ ] Rate limiting activo
- [ ] Webhook signature verification activa
- [ ] LOG_LEVEL=info (no debug en producción)
- [ ] No hay console.log en código de producción ✅
- [ ] Error messages no exponen detalles internos

---

## 🐛 Troubleshooting

### Problema: Webhooks no llegan

**Verificar:**
1. URL de webhook correcta en Square Dashboard
2. HTTPS habilitado (HTTP no funciona)
3. Signature key correcto en .env
4. Logs del servidor: `LOG_LEVEL=debug` temporalmente

### Problema: WebSocket no conecta

**Verificar:**
1. URL correcta: `wss://` (no `ws://` en producción)
2. CORS permite el origen del frontend
3. Firewall permite conexiones WebSocket
4. Logs: Buscar "Admin client connected"

### Problema: Square API calls fallan

**Verificar:**
1. Línea 236 de SquareService.ts descomentada
2. SQUARE_ACCESS_TOKEN válido y de producción
3. SQUARE_ENVIRONMENT=production
4. Permisos correctos en Square Dashboard

---

## 📝 Resumen

### ✅ BLOQUEADORES - NINGUNO

¡Todo el código está listo para producción!

### ⚠️ CONFIGURACIÓN REQUERIDA (antes de deploy):

1. **Variables de entorno** - Actualizar `.env` con valores de producción
2. **Square Dashboard** - Configurar webhooks con URL de producción
3. **Deployment** - Deploy a plataforma (Railway/Render/etc)

### ✅ CÓDIGO LISTO:

- ✅ Código completo y funcional
- ✅ Square API call habilitada
- ✅ Servicios inicializados correctamente
- ✅ Logging estructurado
- ✅ Error handling
- ✅ Health checks
- ✅ WebSocket broadcasting
- ✅ Documentation completa

---

## 🎯 TL;DR - Pasos Finales

**El código está 100% listo. Solo necesitas configuración:**

1. ✅ ~~Descomentar línea 236~~ **YA HECHO**
2. ⚠️ **Actualizar .env** con valores de producción
3. ⚠️ **Deploy** a plataforma (Railway/Render/etc)
4. ⚠️ **Configurar webhooks** en Square Dashboard
5. ⚠️ **Probar** orden real de Square → admin_mich

**Tiempo estimado:** 30-45 minutos (solo configuración)

---

**Última actualización:** 15 de Enero, 2025
**Estado:** ✅ **Código listo - Solo requiere configuración**
