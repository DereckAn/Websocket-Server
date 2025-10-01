# 🐛 Errores Encontrados y Soluciones Implementadas

## 📋 Resumen de Problemas Críticos

Durante el desarrollo del servidor Gomoku, encontramos y resolvimos **6 errores críticos** que podrían impactar proyectos similares con Bun, WebSocket y arquitecturas tiempo real.

---

## 🔥 **Error #1: Múltiples Instancias del Servidor**

### **Síntoma**
```bash
❌ Failed to start server. Is port 3000 in use?
Error: listen EADDRINUSE :::3000
```

### **Causa Raíz**
Bun tiene un comportamiento especial donde **auto-ejecuta** archivos que exportan un servidor con `export default server`. Esto causaba que se crearan **múltiples instancias** del servidor simultáneamente.

### **Código Problemático**
```typescript
// ❌ PROBLEMÁTICO - Bun auto-ejecuta esto
const server = Bun.serve({
  port: 3000,
  fetch: handleRequest,
});

export default server; // ← ESTO CAUSA EL PROBLEMA
```

### **Solución Implementada**
```typescript
// ✅ SOLUCIÓN - Comentar el export default
const server = Bun.serve({
  port: 3000,
  fetch: handleRequest,
});

// export default server; // Comentado para evitar Bun auto-serve
console.log('🎮 Server running at http://0.0.0.0:3000');
```

### **Lección Aprendida**
- Bun es diferente a Node.js en manejo de exports
- Siempre comentar `export default server` en Bun
- Usar logs explícitos para confirmar una sola instancia

---

## 🌐 **Error #2: Headers CORS Duplicados**

### **Síntoma**
```bash
❌ The 'Access-Control-Allow-Origin' header contains multiple values
❌ 'http://localhost:3001, *'
```

### **Causa Raíz**
El middleware CORS añadía headers **sin verificar** si ya existían, causando duplicación cuando tanto el controlador como el middleware establecían los mismos headers.

### **Código Problemático**
```typescript
// ❌ PROBLEMÁTICO - Siempre añade headers
export const corsMiddleware = (response: Response): Response => {
  response.headers.set('Access-Control-Allow-Origin', '*');
  response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  return response;
};
```

### **Solución Implementada**
```typescript
// ✅ SOLUCIÓN - Middleware inteligente
export const corsMiddleware = (response: Response): Response => {
  // Solo añadir si no existen
  if (!response.headers.get('Access-Control-Allow-Origin')) {
    response.headers.set('Access-Control-Allow-Origin', '*');
  }
  if (!response.headers.get('Access-Control-Allow-Methods')) {
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  }

  return response;
};

// También excluir OPTIONS requests
if (request.method === 'OPTIONS') {
  return new Response(null, { status: 204 }); // Sin middleware
}
```

### **Lección Aprendida**
- Siempre verificar headers existentes antes de añadir
- OPTIONS requests necesitan manejo especial
- Middleware debe ser "inteligente", no ciego

---

## 🔌 **Error #3: Fallas de Conexión WebSocket**

### **Síntomas**
```bash
❌ WebSocket upgrade failed
❌ Missing playerId or gameId in WebSocket request
❌ Origin not allowed: null
```

### **Causa Raíz**
Múltiples problemas en la configuración WebSocket:
1. URL incompleta sin parámetros requeridos
2. Validación muy estricta de origen
3. Headers de WebSocket mal configurados

### **Código Problemático**
```typescript
// ❌ PROBLEMÁTICO - URL incompleta
const wsURL = `${baseURL}/ws/gomoku/${roomId}`;

// ❌ PROBLEMÁTICO - Validación muy estricta
const origin = request.headers.get('origin');
if (origin !== 'http://localhost:3001') {
  return new Response('Origin not allowed', { status: 403 });
}
```

### **Solución Implementada**
```typescript
// ✅ SOLUCIÓN - URL completa con parámetros
const getWebSocketURL = (roomId: string, playerId?: string, gameId?: string) => {
  const baseURL = process.env.NEXT_PUBLIC_GOMOKU_WS_URL || 'ws://localhost:3000';
  let url = `${baseURL}/ws/gomoku/${roomId}`;

  if (playerId && gameId) {
    url += `?playerId=${playerId}&gameId=${gameId}`;
  }

  return url;
};

// ✅ SOLUCIÓN - Validación flexible
const allowedOrigins = ['http://localhost:3001', 'http://localhost:3000'];
const origin = request.headers.get('origin');

if (origin && !allowedOrigins.includes(origin)) {
  console.warn(`⚠️ WebSocket from unknown origin: ${origin}`);
  // Permitir pero log de advertencia en desarrollo
}
```

### **Backend - Validación Robusta**
```typescript
// ✅ SOLUCIÓN - Validación mejorada en servidor
const url = new URL(request.url);
const playerId = url.searchParams.get('playerId');
const gameId = url.searchParams.get('gameId');

if (!playerId || !gameId) {
  console.error('❌ Missing playerId or gameId in WebSocket request');
  return new Response('Missing required parameters', { status: 400 });
}
```

### **Lección Aprendida**
- WebSocket URLs deben incluir todos los parámetros necesarios
- Validación de origen debe ser flexible en desarrollo
- Logging detallado es crucial para debug de WebSocket

---

## 🎯 **Error #4: Player ID Required en API**

### **Síntoma**
```bash
❌ Player ID is required
❌ Move rejected: missing playerId
```

### **Causa Raíz**
Desincronización entre frontend y backend: la API esperaba `playerId` en el cuerpo de la petición, pero el frontend no lo enviaba.

### **Código Problemático**
```typescript
// ❌ FRONTEND - No enviaba playerId
const response = await fetch(`${this.baseURL}/api/gomoku/game/${gameId}/move`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ row, col }), // ← Falta playerId
});

// ❌ BACKEND - Esperaba playerId
if (!requestData.playerId) {
  return this.errorResponse('Player ID is required', 400);
}
```

### **Solución Implementada**
```typescript
// ✅ FRONTEND - Incluir playerId
async makeMove(gameId: string, row: number, col: number, playerId: string): Promise<MoveResponse> {
  const response = await fetch(`${this.baseURL}/api/gomoku/game/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ row, col, playerId }), // ✅ Incluido
  });
}

// ✅ BACKEND - Validación consistente
const validation = this.validateMoveRequest(moveData, gameId);
if (!validation.isValid) {
  return this.errorResponse(validation.error!, 400);
}

private static validateMoveRequest(data: any, gameId: string) {
  if (!data.playerId) {
    return { isValid: false, error: 'Player ID is required' };
  }
  // ... más validaciones
}
```

### **Lección Aprendida**
- APIs deben tener contratos claros y documentados
- Frontend y backend deben mantenerse sincronizados
- Validación debe ser explícita y descriptiva

---

## 🔄 **Error #5: Loading Infinito en Movimientos**

### **Síntoma**
```bash
✅ Movimiento procesado correctamente en servidor
❌ Frontend queda en "Processing move..." infinitamente
❌ WebSocket no recibe actualizaciones
```

### **Causa Raíz**
**Error crítico de arquitectura**: El controlador HTTP procesaba movimientos correctamente, pero **no enviaba actualizaciones WebSocket**. Los clientes esperaban notificaciones tiempo real que nunca llegaban.

### **Flujo Problemático**
```
1. Cliente → HTTP POST /move ✅
2. Servidor procesa movimiento ✅
3. IA calcula respuesta ✅
4. HTTP response enviado ✅
5. WebSocket broadcast... ❌ NUNCA SUCEDÍA
```

### **Código Problemático**
```typescript
// ❌ PROBLEMÁTICO - Sin WebSocket broadcast
static async makeMove(request: Request, gameId: string): Promise<Response> {
  const moveResult = await GameService.makeMove(moveData);

  if (moveResult.success) {
    console.log(`✅ Move processed for game ${gameId}`);
    return this.successResponse(moveResult); // ← Solo HTTP response
  }
}
```

### **Solución Implementada**
```typescript
// ✅ SOLUCIÓN - Broadcast WebSocket después de HTTP
static async makeMove(request: Request, gameId: string): Promise<Response> {
  const moveResult = await GameService.makeMove(moveData);

  if (moveResult.success) {
    console.log(`✅ Move processed for game ${gameId}`);

    // 🔥 CRUCIAL: Broadcast via WebSocket
    console.log(`🔌 🚀 About to broadcast move update...`);
    this.broadcastMoveUpdate(moveResult);

    return this.successResponse(moveResult);
  }
}

// ✅ Método de broadcast completo
private static async broadcastMoveUpdate(moveResult: any): Promise<void> {
  try {
    const { default: WebSocketService } = await import('../services/WebSocketService');

    if (!moveResult.gameState || !moveResult.move) {
      console.log('🔌 ⚠️ Cannot broadcast: missing gameState or move');
      return;
    }

    const roomId = moveResult.gameState.id.replace('game_', '');
    const room = await GameService.getRoom(roomId);

    if (!room) {
      console.log(`🔌 ⚠️ Cannot broadcast: room ${roomId} not found`);
      return;
    }

    // Broadcast movimiento del jugador
    WebSocketService.broadcastToRoom(room.id, {
      type: 'move_made',
      gameId: moveResult.gameState.id,
      roomId: room.id,
      data: {
        move: moveResult.move,
        gameState: moveResult.gameState,
        playerId: moveResult.move.playerId
      },
      timestamp: new Date()
    });

    // Si hay movimiento IA, enviarlo también
    if (moveResult.aiMove) {
      WebSocketService.broadcastToRoom(room.id, {
        type: 'ai_thinking',
        gameId: moveResult.gameState.id,
        data: { message: 'AI is thinking...', estimatedTime: 1000 },
        timestamp: new Date()
      });

      setTimeout(() => {
        WebSocketService.broadcastToRoom(room.id, {
          type: 'ai_move',
          gameId: moveResult.gameState.id,
          data: {
            move: moveResult.aiMove,
            gameState: moveResult.gameState,
            aiStats: {
              timeElapsed: moveResult.aiMove.timeElapsed,
              nodesSearched: moveResult.aiMove.nodesSearched || 0,
              confidence: moveResult.aiMove.confidence || 0.5
            }
          },
          timestamp: new Date()
        });
      }, 100);
    }
  } catch (error) {
    console.error('❌ Error broadcasting move update:', error);
  }
}
```

### **Lección Aprendida**
- HTTP API y WebSocket deben trabajar **en conjunto**
- Arquitecturas tiempo real necesitan **doble comunicación**
- Siempre verificar que ambos canales funcionen
- **Requerir restart de servidor** para cambios críticos

---

## ⚡ **Error #6: IA Extremadamente Lenta**

### **Síntomas**
```bash
❌ AI taking 5+ minutes per move
❌ Client timeout after 30 seconds
❌ Server hitting memory limits
```

### **Causa Raíz**
Configuración inicial de IA demasiado agresiva: búsqueda profundidad 16, sin límites de tiempo efectivos, algoritmo sub-óptimo.

### **Configuración Problemática**
```typescript
// ❌ PROBLEMÁTICO - Configuración extrema
private static readonly AI_CONFIG = {
  maxDepth: 16,           // Demasiado profundo
  maxTimePerMove: 10000,  // 10 segundos teóricos
  // Sin control real de tiempo
};
```

### **Solución Implementada**
```typescript
// ✅ SOLUCIÓN - Configuración balanceada
private static readonly AI_CONFIG = {
  maxDepth: 12,                   // Profundidad óptima
  maxTimePerMove: 5000,           // 5 segundos reales
  useTranspositionTable: true,    // Caché de posiciones
  useIterativeDeepening: true,    // Búsqueda incremental
  useAlphaBetaPruning: true,      // Poda agresiva
};

// ✅ Control real de tiempo
for (let depth = 1; depth <= this.AI_CONFIG.maxDepth; depth++) {
  const timeElapsed = Date.now() - startTime;

  // Usar 80% del tiempo disponible
  if (timeElapsed > this.AI_CONFIG.maxTimePerMove * 0.8) {
    console.log(`⏰ AI time limit reached at depth ${depth}`);
    break;
  }

  // ... búsqueda en profundidad actual
}
```

### **Optimizaciones Adicionales**
```typescript
// ✅ Generación selectiva de movimientos
private static generateOrderedMoves(board: Board, player: GameSymbol): Position[] {
  // Solo considerar top 25 movimientos más prometedores
  const maxMoves = Math.min(moves.length, 25);
  return moves.slice(0, maxMoves).map(m => m.position);
}

// ✅ Caché de transposición
private static transpositionTable: Map<string, {
  score: number;
  depth: number;
  bestMove: Position | null;
}> = new Map();
```

### **Lección Aprendida**
- IA en servidor necesita **límites estrictos de tiempo**
- Iterative deepening es crucial para responsividad
- Caché y poda son esenciales para performance
- Balancear fuerza vs velocidad según UX

---

## 📊 **Resumen de Impacto**

| Error | Tiempo para Resolver | Impacto en UX | Lección Clave |
|-------|---------------------|---------------|---------------|
| Múltiples servidores | 2 horas | Alto | Bun es diferente a Node.js |
| CORS duplicados | 1 hora | Medio | Middleware inteligente |
| WebSocket fallas | 4 horas | Crítico | URLs completas + validación flexible |
| Player ID missing | 1 hora | Alto | Contratos API claros |
| Loading infinito | 6 horas | Crítico | HTTP + WebSocket integrados |
| IA lenta | 3 horas | Crítico | Límites de tiempo reales |

### **Total Tiempo Debug**: ~17 horas
### **Errores Críticos Resueltos**: 6/6 ✅
### **Estado Final**: Servidor estable y performante

---

## 🛡️ **Prevención para Futuros Proyectos**

### **Checklist Pre-Desarrollo**
- [ ] Documentar contratos API explícitamente
- [ ] Probar WebSocket URLs con parámetros completos
- [ ] Configurar CORS desde el inicio
- [ ] Establecer límites de performance para IA
- [ ] Planificar integración HTTP + WebSocket

### **Herramientas de Debug Recomendadas**
```typescript
// Logger detallado
console.log(`🔌 📤 Sending to ${connectionId}:`, message.type);

// Verificación de estado
if (!moveResult.gameState || !moveResult.move) {
  console.log('🔌 ⚠️ Cannot broadcast: missing data');
  return;
}

// Timing de performance
const timeElapsed = Date.now() - startTime;
console.log(`🤖 AI decision time: ${timeElapsed}ms`);
```

### **Testing de Integración**
```bash
# Verificar servidor único
ps aux | grep bun

# Test CORS
curl -H "Origin: http://localhost:3001" http://localhost:3000/health

# Test WebSocket
wscat -c "ws://localhost:3000/ws/gomoku/TEST?playerId=test&gameId=test"

# Test API completa
curl -X POST http://localhost:3000/api/gomoku/quick-start -d '{}'
```

---

**Documentación actualizada**: Octubre 2024
**Errores documentados**: 6 críticos + soluciones
**Estado**: Servidor estable en producción ✅