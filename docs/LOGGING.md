# 📝 Sistema de Logging Estructurado

## Tabla de Contenidos
- [Descripción General](#descripción-general)
- [Configuración](#configuración)
- [Uso Básico](#uso-básico)
- [Métodos del Logger](#métodos-del-logger)
- [Ejemplos Prácticos](#ejemplos-prácticos)
- [Mejores Prácticas](#mejores-prácticas)
- [Formato de Logs](#formato-de-logs)
- [Troubleshooting](#troubleshooting)

---

## Descripción General

El servidor utiliza un sistema de **logging estructurado** que proporciona:

- ✅ **Logs estructurados en JSON** para producción
- ✅ **Logs legibles** para desarrollo
- ✅ **Filtrado por nivel** (debug, info, warn, error)
- ✅ **Métodos especializados** para diferentes contextos
- ✅ **Metadata automática** (timestamp, nivel, contexto)
- ✅ **Integración fácil** con herramientas de monitoreo

### ¿Por qué logging estructurado?

| Ventaja | Descripción |
|---------|-------------|
| **Parseabilidad** | JSON en producción → fácil de analizar con herramientas |
| **Filtrado** | Controla verbosidad con variable de entorno |
| **Contexto** | Incluye metadata rica automáticamente |
| **Búsqueda** | Encuentra logs específicos rápidamente |
| **Monitoreo** | Compatible con Datadog, CloudWatch, etc. |

---

## Configuración

### Variables de Entorno

```bash
# .env
LOG_LEVEL=info    # Opciones: debug, info, warn, error
NODE_ENV=production  # Controla formato de output
```

### Niveles de Log

| Nivel | Valor | Cuando Usar | Ejemplo |
|-------|-------|-------------|---------|
| `debug` | 0 | Información detallada de debugging | "Searching depth 5..." |
| `info` | 1 | Eventos normales del servidor | "Game created", "User connected" |
| `warn` | 2 | Situaciones inusuales pero no errores | "Rate limit approaching" |
| `error` | 3 | Errores que requieren atención | "Database connection failed" |

**Filtrado:** Solo se muestran logs del nivel configurado o superior.
```
LOG_LEVEL=warn → solo muestra warn y error
LOG_LEVEL=debug → muestra todos los niveles
```

---

## Uso Básico

### 1. Importar el Logger

```typescript
import { logger } from '@/utils/logger';
// o
import { logger } from '../utils/logger';
```

### 2. Usar los Métodos

```typescript
// Log simple
logger.info('Server started');

// Log con contexto
logger.info('User created', { userId: 'abc123', email: 'user@example.com' });

// Log de error
logger.error('Database connection failed', error);

// Log con contexto adicional
logger.error('Payment processing failed', error, {
  orderId: 'order_123',
  amount: 99.99
});
```

---

## Métodos del Logger

### Métodos Generales

#### `logger.debug(message, data?)`
Para información detallada de debugging.

```typescript
logger.debug('Searching depth', { depth: 5, timeElapsed: 150 });
```

**Cuando usar:**
- Debug de algoritmos
- Pasos intermedios de cálculos
- Información muy detallada

---

#### `logger.info(message, data?)`
Para eventos normales del sistema.

```typescript
logger.info('Server started successfully', {
  port: 3000,
  environment: 'production'
});
```

**Cuando usar:**
- Inicio/cierre de servidor
- Operaciones exitosas importantes
- Cambios de estado significativos

---

#### `logger.warn(message, data?)`
Para situaciones inusuales que no son errores.

```typescript
logger.warn('Rate limit approaching', {
  clientId: 'client_123',
  currentRate: 45,
  limit: 50
});
```

**Cuando usar:**
- Límites casi alcanzados
- Configuración subóptima
- Deprecated features en uso

---

#### `logger.error(message, error?, data?)`
Para errores que requieren atención.

```typescript
logger.error('Payment processing failed', error, {
  orderId: 'order_123',
  userId: 'user_456'
});
```

**Cuando usar:**
- Excepciones capturadas
- Operaciones fallidas
- Problemas que afectan funcionalidad

---

### Métodos Especializados

#### `logger.http(method, path, status, duration?)`
Para logs de peticiones HTTP.

```typescript
logger.http('POST', '/api/games', 201, 45);
// Output: POST /api/games 201 45ms
```

---

#### `logger.game(event, roomId?, data?)`
Para eventos de juego.

```typescript
logger.game('Game created', 'ABC123', {
  humanSymbol: 'X',
  aiSymbol: 'O'
});

logger.game('Move made', 'ABC123', {
  playerSymbol: 'X',
  row: 7,
  col: 7
});
```

---

#### `logger.ws(event, connectionId?, data?)`
Para eventos de WebSocket.

```typescript
logger.ws('WebSocket connected', 'ws_abc123', {
  playerId: 'player_123',
  roomId: 'ABC123'
});

logger.ws('Message received', 'ws_abc123', {
  messageType: 'move_request'
});
```

---

#### `logger.ai(event, data?)`
Para eventos de IA.

```typescript
logger.ai('Calculating move', {
  aiSymbol: 'O',
  gameId: 'game_ABC123'
});

logger.ai('AI final decision', {
  move: '(7, 7)',
  score: 8500,
  depth: 5,
  time: 1234
});
```

---

## Ejemplos Prácticos

### Ejemplo 1: Endpoint HTTP

```typescript
static async createGame(request: Request): Promise<Response> {
  try {
    logger.info('Game creation request received');

    const gameResult = await GameService.createQuickStartGame(requestData);

    logger.info('Game created successfully', {
      gameId: gameResult.gameId,
      roomId: gameResult.roomId
    });

    return this.successResponse(gameResult);

  } catch (error) {
    logger.error('Error creating game', error);
    return this.errorResponse('Failed to create game', 500);
  }
}
```

### Ejemplo 2: WebSocket Handler

```typescript
handleWebSocketOpen(ws: any): void {
  try {
    const { roomId, playerId } = ws.data;

    logger.ws('WebSocket connected', undefined, {
      playerId,
      roomId
    });

    const connectionId = WebSocketService.handleConnection(ws, playerId, roomId);

    logger.debug('Connection ID assigned', { connectionId });

  } catch (error) {
    logger.error('Error in WebSocket open', error);
    ws.close();
  }
}
```

### Ejemplo 3: Lógica de IA

```typescript
static async calculateBestMove(gameState: GameState): Promise<AIMove> {
  const startTime = Date.now();

  try {
    logger.ai('Calculating move', {
      aiSymbol: gameState.currentPlayer,
      gameId: gameState.id
    });

    const immediateMove = this.findImmediateMove(board, aiSymbol);

    if (immediateMove) {
      const timeElapsed = Date.now() - startTime;

      logger.ai('Found immediate move', {
        row: immediateMove.row,
        col: immediateMove.col,
        timeElapsed
      });

      return { /* ... */ };
    }

    logger.ai('Starting deep search', {
      maxDepth: this.AI_CONFIG.maxDepth,
      maxTime: this.AI_CONFIG.maxTimePerMove
    });

    // ... más lógica ...

    logger.ai('AI final decision', {
      move: `(${bestMove.row}, ${bestMove.col})`,
      score: bestScore,
      depth: searchDepth,
      time: timeElapsed
    });

    return result;

  } catch (error) {
    logger.error('AI calculation error', error);
    return fallbackMove;
  }
}
```

### Ejemplo 4: Cleanup Service

```typescript
async cleanup() {
  logger.info('Starting cleanup process');

  const allRooms = await GameService.getAllRooms();
  let cleanedCount = 0;

  for (const room of allRooms) {
    if (RoomModel.shouldCleanup(room)) {
      logger.debug('Cleaning up inactive room', { roomId: room.id });
      await GameService.deleteRoom(room.id);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    logger.info('Cleanup completed', { roomsRemoved: cleanedCount });
  } else {
    logger.debug('No rooms needed cleanup');
  }
}
```

---

## Mejores Prácticas

### ✅ DO (Hacer)

#### 1. Usar el método apropiado para el contexto
```typescript
// ✅ Bueno
logger.game('Move made', roomId, { row, col });
logger.ws('Connection established', connectionId);
logger.ai('Search complete', { depth, score });

// ❌ Malo
logger.info('Move made in room ABC with X at 7,7');
logger.info('WebSocket ws_123 connected');
```

#### 2. Incluir contexto estructurado
```typescript
// ✅ Bueno
logger.error('Payment failed', error, {
  orderId: 'order_123',
  amount: 99.99,
  userId: 'user_456'
});

// ❌ Malo
logger.error(`Payment failed for order order_123 amount 99.99`, error);
```

#### 3. Usar niveles apropiados
```typescript
// ✅ Bueno
logger.debug('Cache hit', { key, value });
logger.info('User logged in', { userId });
logger.warn('Rate limit approaching', { current: 45, limit: 50 });
logger.error('Database connection failed', error);

// ❌ Malo
logger.info('Detailed cache statistics...'); // Debería ser debug
logger.error('User logged in'); // No es un error
```

#### 4. Logs concisos pero informativos
```typescript
// ✅ Bueno
logger.info('Game created', { gameId, roomId, playerCount: 2 });

// ❌ Malo - muy verboso
logger.info('A new game has been successfully created with the following details...', {
  gameId, roomId, playerCount: 2, createdAt, updatedAt, status, /* ... */
});

// ❌ Malo - muy escaso
logger.info('Game created');
```

### ❌ DON'T (No hacer)

#### 1. No usar console.log directamente
```typescript
// ❌ Malo
console.log('Game created');

// ✅ Bueno
logger.info('Game created', { gameId });
```

#### 2. No loggear información sensible
```typescript
// ❌ Malo
logger.info('User data', {
  password: user.password,
  creditCard: user.card
});

// ✅ Bueno
logger.info('User data', {
  userId: user.id,
  email: user.email
});
```

#### 3. No loggear en loops sin throttling
```typescript
// ❌ Malo
for (let i = 0; i < 10000; i++) {
  logger.debug('Processing item', { index: i });
}

// ✅ Bueno
logger.debug('Processing items', { count: 10000 });
// ... procesar ...
logger.debug('Items processed', { count: 10000, duration });
```

#### 4. No crear logs sin contexto
```typescript
// ❌ Malo
logger.error('Failed', error);

// ✅ Bueno
logger.error('Payment processing failed', error, {
  orderId: 'order_123',
  step: 'charge_customer'
});
```

---

## Formato de Logs

### Desarrollo (NODE_ENV=development)

Formato legible con colores:

```
[2025-01-15T10:30:45.123Z] [INFO] Server started successfully
  Environment: development
  Port: 3000

[2025-01-15T10:30:50.456Z] [GAME] Game created (roomId: ABC123)
  humanSymbol: X
  aiSymbol: O

[2025-01-15T10:30:51.789Z] [ERROR] Payment processing failed
  Error: Connection timeout
    at processPayment (payment.ts:45)
    at async handleOrder (order.ts:23)
  Context:
    orderId: order_123
    amount: 99.99
```

### Producción (NODE_ENV=production)

Formato JSON para parsing:

```json
{
  "timestamp": "2025-01-15T10:30:45.123Z",
  "level": "info",
  "message": "Server started successfully",
  "data": {
    "environment": "production",
    "port": 3000
  }
}

{
  "timestamp": "2025-01-15T10:30:50.456Z",
  "level": "game",
  "message": "Game created",
  "roomId": "ABC123",
  "data": {
    "humanSymbol": "X",
    "aiSymbol": "O"
  }
}

{
  "timestamp": "2025-01-15T10:30:51.789Z",
  "level": "error",
  "message": "Payment processing failed",
  "error": {
    "message": "Connection timeout",
    "stack": "Error: Connection timeout\n    at processPayment (payment.ts:45)"
  },
  "data": {
    "orderId": "order_123",
    "amount": 99.99
  }
}
```

---

## Troubleshooting

### Problema: No veo logs de debug

**Causa:** `LOG_LEVEL` está configurado a un nivel superior.

**Solución:**
```bash
# .env
LOG_LEVEL=debug  # Cambia a debug para ver todos los logs
```

---

### Problema: Logs no tienen formato JSON en producción

**Causa:** `NODE_ENV` no está configurado correctamente.

**Solución:**
```bash
# .env
NODE_ENV=production  # Asegúrate que está en producción
```

---

### Problema: Demasiados logs en producción

**Causa:** `LOG_LEVEL` está en `debug`.

**Solución:**
```bash
# .env para producción
LOG_LEVEL=info  # O warn para solo advertencias y errores
```

---

### Problema: Error "logger is not defined"

**Causa:** Logger no importado.

**Solución:**
```typescript
// Agrega el import
import { logger } from '@/utils/logger';
// o
import { logger } from '../utils/logger';
```

---

### Problema: Logs de errores sin stack trace

**Causa:** No se está pasando el objeto error.

**Solución:**
```typescript
// ❌ Malo
logger.error('Failed to process', { error: error.message });

// ✅ Bueno
logger.error('Failed to process', error);
```

---

## Integración con Herramientas de Monitoreo

### Datadog

Los logs en formato JSON son automáticamente parseables:

```typescript
// Tu código
logger.error('Payment failed', error, { orderId: 'order_123' });

// En Datadog podrás filtrar por:
// - level:error
// - message:"Payment failed"
// - orderId:"order_123"
```

### CloudWatch

Similar a Datadog, CloudWatch Insights puede parsear JSON:

```sql
-- Query ejemplo en CloudWatch Insights
fields @timestamp, message, data.orderId
| filter level = "error"
| filter message like /Payment/
```

### Loki (Grafana)

```promql
{app="gomoku-server"} |= "error" | json
```

---

## Migración desde console.log

Si tienes código legacy con `console.log`, aquí está la guía de migración:

| Antes | Después |
|-------|---------|
| `console.log('Message')` | `logger.info('Message')` |
| `console.log('Message', data)` | `logger.info('Message', data)` |
| `console.warn('Warning')` | `logger.warn('Warning')` |
| `console.error('Error:', error)` | `logger.error('Error', error)` |
| `console.debug('Debug')` | `logger.debug('Debug')` |

**Script de migración automática:**
```bash
# Reemplazar console.log con logger.info
sed -i '' 's/console\.log(/logger.info(/g' src/**/*.ts

# Reemplazar console.error con logger.error
sed -i '' 's/console\.error(/logger.error(/g' src/**/*.ts

# Reemplazar console.warn con logger.warn
sed -i '' 's/console\.warn(/logger.warn(/g' src/**/*.ts
```

⚠️ **Nota:** Revisa manualmente después del reemplazo para asegurar correcto uso de métodos especializados.

---

## Referencias

- **Implementación:** `src/utils/logger.ts`
- **Configuración:** `src/config/env.ts`
- **Ejemplos de uso:** Ver cualquier controlador en `src/controllers/`

---

## Changelog

| Versión | Fecha | Cambios |
|---------|-------|---------|
| 2.0.0 | 2025-01-15 | Sistema de logging estructurado implementado completamente |
| 1.0.0 | 2024-12-01 | Logger básico con console.log |
