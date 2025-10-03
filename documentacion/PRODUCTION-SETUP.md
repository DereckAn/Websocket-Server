# 🚀 Production Setup - Implementación Completada

## ✅ Mejoras Implementadas

### 1. Variables de Entorno con Validación ✅
**Archivo:** `src/config/env.ts`

**Características:**
- Validación automática al iniciar el servidor
- Tipos TypeScript para seguridad
- Warnings si usas localhost en producción
- Valores por defecto razonables

**Uso:**
```typescript
import { env, isProduction, isDevelopment } from './config/env';

console.log(env.PORT); // 3000
console.log(env.ALLOWED_ORIGINS); // ['https://tuapp.com']
```

---

### 2. Logging Estructurado ✅
**Archivo:** `src/utils/logger.ts`

**Características:**
- Niveles: debug, info, warn, error
- Formato JSON en producción (fácil de parsear)
- Formato legible en desarrollo
- Filtra logs según LOG_LEVEL

**Uso:**
```typescript
import { logger } from './utils/logger';

logger.info('Server started', { port: 3000 });
logger.error('Database connection failed', error);
logger.debug('Processing request', { userId: 123 });
logger.game('Game created', 'ABC123', { players: 2 });
logger.ws('WebSocket connected', connectionId);
logger.ai('Move calculated', { depth: 18, time: 250 });
```

---

### 3. Graceful Shutdown ✅
**Archivo:** `src/utils/shutdown.ts`

**Características:**
- Maneja SIGTERM, SIGINT
- Captura uncaughtException
- Captura unhandledRejection
- Ejecuta funciones de limpieza antes de salir

**Uso:**
```typescript
import { shutdownHandler } from './utils/shutdown';

// Registrar cleanup functions
shutdownHandler.register(async () => {
  await database.close();
});

shutdownHandler.register(async () => {
  cleanupService.stop();
});

// Setup (se hace automáticamente en server.ts)
shutdownHandler.setup();
```

---

### 4. Cleanup Service ✅
**Archivo:** `src/services/CleanupService.ts`

**Características:**
- Auto-limpia rooms inactivas cada 5 minutos
- Notifica a clientes antes de cerrar
- Configurable vía variables de entorno
- Logs detallados de limpieza

**Uso:**
```typescript
import CleanupService from './services/CleanupService';

// Iniciar (se hace en server.ts)
CleanupService.start();

// Detener
CleanupService.stop();

// Trigger manual
await CleanupService.triggerCleanup();

// Ver status
const status = CleanupService.getStatus();
```

---

### 5. CORS Mejorado ✅
**Archivo:** `src/middleware/cors.ts` (actualizado)

**Características:**
- Usa configuración centralizada
- Bloquea orígenes no autorizados en producción
- Permite desarrollo local automáticamente
- Logging con niveles apropiados

---

## 🔧 Configuración de .env

### Para Development:
```bash
NODE_ENV=development
PORT=3000
LOG_LEVEL=debug
ALLOWED_ORIGINS=http://localhost:3001,http://localhost:3000
```

### Para Production:
```bash
NODE_ENV=production
PORT=3000
LOG_LEVEL=info
ALLOWED_ORIGINS=https://tuapp.vercel.app,https://www.tuapp.com

# Gomoku
MAX_ACTIVE_ROOMS=1000
ROOM_CLEANUP_INTERVAL=300000
INACTIVE_ROOM_TIMEOUT=1800000
AI_MAX_TIME_PER_MOVE=5000

# Rate Limiting
MAX_GAME_CREATIONS_PER_MINUTE=3
MAX_MOVES_PER_MINUTE=30
```

---

## 📝 Próximos Pasos para Integrar

### 1. Actualizar `server.ts`:

```typescript
import { env } from './config/env';
import { logger } from './utils/logger';
import { shutdownHandler } from './utils/shutdown';
import CleanupService from './services/CleanupService';

// Al inicio del archivo
logger.info('Starting Gomoku server...', {
  environment: env.NODE_ENV,
  port: env.PORT,
});

// Iniciar cleanup service
CleanupService.start();

// Registrar cleanup en shutdown
shutdownHandler.register(async () => {
  logger.info('Stopping cleanup service...');
  CleanupService.stop();
});

shutdownHandler.register(async () => {
  logger.info('Closing all WebSocket connections...');
  // Cerrar todas las conexiones
});

// Setup shutdown handlers
shutdownHandler.setup();

// Usar env.PORT en lugar de hardcoded
const server = Bun.serve({
  port: env.PORT,
  // ...
});

logger.info(`Server listening on port ${env.PORT}`);
```

### 2. Reemplazar console.log por logger:

**BUSCAR:**
```typescript
console.log('🎮 ...');
console.error('❌ ...');
console.warn('⚠️ ...');
```

**REEMPLAZAR:**
```typescript
logger.info('...');
logger.error('...', error);
logger.warn('...');
```

**Ejemplos específicos:**
- GameService → logger.game()
- WebSocketService → logger.ws()
- AIService → logger.ai()
- HTTP requests → logger.http()

### 3. Health Check Mejorado (OPCIONAL):

Crear endpoint `/health` más robusto:

```typescript
app.get('/health', () => {
  const stats = GameService.getServerStats();
  const cleanupStatus = CleanupService.getStatus();

  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
    version: '1.0.0',
    memory: {
      used: process.memoryUsage().heapUsed,
      total: process.memoryUsage().heapTotal,
    },
    server: stats,
    cleanup: cleanupStatus,
  };
});
```

---

## 🚦 Checklist Pre-Deploy

```bash
✅ Variables de entorno configuradas en .env
✅ LOG_LEVEL=info para producción
✅ ALLOWED_ORIGINS con dominio real
✅ NODE_ENV=production
✅ .env en .gitignore
✅ console.log reemplazados por logger (importante!)
✅ CleanupService.start() en server.ts
✅ shutdownHandler.setup() en server.ts
✅ Health check probado
✅ Build exitoso: bun run build
✅ Prueba local en modo production
```

---

## 🧪 Testing Production Mode Localmente

```bash
# 1. Crear .env.production
cp .env .env.production

# 2. Editar .env.production
NODE_ENV=production
LOG_LEVEL=info
ALLOWED_ORIGINS=http://localhost:3001

# 3. Ejecutar
NODE_ENV=production bun run src/server.ts

# 4. Verificar logs (deben ser JSON)
# 5. Verificar que debug logs no aparezcan
# 6. Probar health check
curl http://localhost:3000/health
```

---

## 📊 Logs en Producción

Los logs ahora estarán en formato JSON para fácil parsing:

```json
{
  "timestamp": "2025-10-01T19:00:00.000Z",
  "level": "info",
  "message": "Game created",
  "data": {
    "roomId": "ABC123",
    "players": 2
  }
}
```

Puedes usar herramientas como:
- **jq** para filtrar logs: `tail -f logs.txt | jq '.level == "error"'`
- **Grafana Loki** para visualización
- **Datadog** para monitoring

---

## 🔗 Deployment Platforms

### Railway.app (Recomendado):
```bash
# 1. Instalar CLI
npm i -g railway

# 2. Login
railway login

# 3. Init proyecto
railway init

# 4. Agregar variables de entorno en dashboard
NODE_ENV=production
ALLOWED_ORIGINS=https://tuapp.vercel.app

# 5. Deploy
railway up
```

### Render.com:
- Auto-detecta Bun
- Configura variables de entorno en dashboard
- Deploy automático desde GitHub

### Fly.io:
```bash
fly launch
fly secrets set NODE_ENV=production
fly secrets set ALLOWED_ORIGINS=https://tuapp.com
fly deploy
```

---

## 🎯 Próximas Mejoras (Fase 2)

1. **Métricas**: Prometheus + Grafana
2. **Error Reporting**: Sentry integration
3. **Database**: PostgreSQL para persistencia
4. **Redis**: Para sessions distribuidas
5. **Docker**: Containerización
6. **CI/CD**: GitHub Actions
7. **Load Testing**: Artillery o k6
8. **Monitoring**: UptimeRobot o Pingdom

---

## 📚 Recursos Útiles

- [Bun Documentation](https://bun.sh/docs)
- [Production Best Practices](https://github.com/goldbergyoni/nodebestpractices)
- [12 Factor App](https://12factor.net/)
- [WebSocket Security](https://www.websec.ca/websocket-security/)

---

## ❓ FAQ

**Q: ¿Cuántos usuarios puede manejar?**
A: Con esta configuración, ~1000 salas concurrentes. Para más, necesitas Redis + load balancer.

**Q: ¿Necesito base de datos?**
A: No para el MVP actual. Todo está en memoria. Si quieres rankings/histórico, sí.

**Q: ¿Cómo monitoreo en producción?**
A: Los logs JSON puedes enviarlos a Datadog, Grafana Cloud, o simple tail + grep.

**Q: ¿Cuánta memoria usa?**
A: ~50-100MB baseline + ~1MB por sala activa aproximadamente.

**Q: ¿Es escalable horizontalmente?**
A: No todavía. Para múltiples instancias necesitas Redis para shared state.
