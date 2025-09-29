# 🧪 GUÍA DE TESTING RÁPIDO

**Objetivo**: Validar el servidor Gomoku recién implementado
**Tiempo estimado**: 30-45 minutos
**Estado**: Lista para ejecutar

---

## 🚀 INICIO RÁPIDO

### 1. **Iniciar el Servidor**
```bash
cd /Users/laruina/Documents/GIT/bun-server

# Verificar que compile
bun run build

# Iniciar en modo desarrollo
bun run dev
```

**Esperado**:
```bash
🚀 Starting Gomoku Game Server...
📍 Environment: development
🔗 Port: 3000
✅ Gomoku Game Server started successfully!
🎮 Server running at http://0.0.0.0:3000
```

---

## 🔍 TESTING BÁSICO (10 minutos)

### 2. **Health Check**
```bash
curl http://localhost:3000/health
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "timestamp": "2025-09-28T...",
    "uptime": 5.2,
    "version": "1.0.0"
  },
  "message": "Service is healthy"
}
```

### 3. **API Status**
```bash
curl http://localhost:3000/api/status
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "api": {
      "version": "1.0.0",
      "name": "Gomoku Game Server"
    },
    "server": {
      "uptime": "1m 30s",
      "memory": "45.2 MB",
      "platform": "darwin"
    },
    "endpoints": {
      "game": "/api/gomoku/*",
      "admin": "/api/admin/*",
      "websocket": "/ws/gomoku/*",
      "health": "/health"
    }
  }
}
```

### 4. **Quick Start Game**
```bash
curl -X POST http://localhost:3000/api/gomoku/quick-start \
  -H "Content-Type: application/json" \
  -d '{"playerSymbol": "X"}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "gameId": "game_abc123_def456",
    "roomId": "ABC123",
    "playerId": "player_xyz789",
    "playerSymbol": "X",
    "aiSymbol": "O",
    "wsEndpoint": "ws://localhost:3000/ws/gomoku/ABC123",
    "gameState": {
      "board": [[null, null, ...], ...],
      "currentPlayer": "X",
      "status": "active"
    }
  }
}
```

**⚠️ IMPORTANTE**: Guardar `gameId` para siguientes tests.

---

## 🎯 TESTING DE MOVIMIENTOS (10 minutos)

### 5. **Realizar Movimiento**
```bash
# Usar el gameId del paso anterior
GAME_ID="game_abc123_def456"  # Reemplazar con el real

curl -X POST http://localhost:3000/api/gomoku/game/$GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{"row": 7, "col": 7}'
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "move": {
      "row": 7,
      "col": 7,
      "player": "X",
      "timestamp": "2025-09-28T..."
    },
    "gameState": {
      "board": [...],
      "currentPlayer": "O",
      "status": "active",
      "moves": [...]
    },
    "aiMove": {
      "row": 8,
      "col": 8,
      "score": 150,
      "timeElapsed": 1250,
      "nodesSearched": 15420,
      "depth": 6,
      "confidence": 0.8
    }
  }
}
```

**✅ Verificar**:
- ✅ La IA respondió con un movimiento válido
- ✅ `timeElapsed` < 2000ms
- ✅ `nodesSearched` > 1000 (indicando búsqueda profunda)
- ✅ El tablero se actualizó correctamente

### 6. **Obtener Estado del Juego**
```bash
curl http://localhost:3000/api/gomoku/game/$GAME_ID/state
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "gameId": "game_abc123_def456",
    "board": [...],
    "currentPlayer": "X",
    "status": "active",
    "moves": [
      {"row": 7, "col": 7, "player": "X"},
      {"row": 8, "col": 8, "player": "O"}
    ]
  }
}
```

---

## 🔌 TESTING WEBSOCKET (10 minutos)

### 7. **Testing WebSocket con JavaScript**

Crear archivo temporal `ws-test.html`:
```html
<!DOCTYPE html>
<html>
<body>
  <div id="output"></div>
  <script>
    const output = document.getElementById('output');
    const ws = new WebSocket('ws://localhost:3000/ws/gomoku/ABC123');

    ws.onopen = () => {
      output.innerHTML += '<p>✅ WebSocket conectado</p>';
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      output.innerHTML += `<p>📨 ${data.type}: ${JSON.stringify(data.data)}</p>`;
    };

    ws.onerror = (error) => {
      output.innerHTML += `<p>❌ Error: ${error}</p>`;
    };

    ws.onclose = () => {
      output.innerHTML += '<p>🔌 WebSocket cerrado</p>';
    };
  </script>
</body>
</html>
```

**Abrir en browser**: `file:///path/to/ws-test.html`

**Esperado**:
- ✅ "WebSocket conectado" aparece
- ✅ Mensajes de tipo 'ping' cada 30 segundos

### 8. **Testing WebSocket con wscat (alternativo)**
```bash
# Si tienes wscat instalado
npm install -g wscat
wscat -c ws://localhost:3000/ws/gomoku/ABC123
```

---

## ⚙️ TESTING ADMIN ENDPOINTS (5 minutos)

### 9. **Estadísticas del Servidor**
```bash
curl http://localhost:3000/api/admin/stats
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "games": {
      "active": 1,
      "total": 1
    },
    "players": {
      "active": 1,
      "total": 1
    },
    "ai": {
      "cacheSize": 5,
      "totalCalculations": 1,
      "avgResponseTime": 1250
    },
    "websockets": {
      "activeConnections": 1,
      "totalMessages": 15
    }
  }
}
```

### 10. **Lista de Salas Activas**
```bash
curl http://localhost:3000/api/admin/rooms
```

**Esperado**:
```json
{
  "success": true,
  "data": {
    "rooms": [
      {
        "roomId": "ABC123",
        "gameId": "game_abc123_def456",
        "players": 1,
        "status": "active",
        "createdAt": "2025-09-28T...",
        "lastActivity": "2025-09-28T..."
      }
    ],
    "total": 1
  }
}
```

---

## 🚨 TESTING DE ERRORES (5 minutos)

### 11. **Movimiento Inválido**
```bash
curl -X POST http://localhost:3000/api/gomoku/game/$GAME_ID/move \
  -H "Content-Type: application/json" \
  -d '{"row": 7, "col": 7}'  # Misma posición que antes
```

**Esperado**:
```json
{
  "success": false,
  "error": "Cell already occupied"
}
```

### 12. **Game ID Inexistente**
```bash
curl http://localhost:3000/api/gomoku/game/game_invalid/state
```

**Esperado**:
```json
{
  "success": false,
  "error": "Game not found",
  "code": "NOT_FOUND"
}
```

### 13. **Rate Limiting** (crear 6 juegos rápido)
```bash
for i in {1..6}; do
  curl -X POST http://localhost:3000/api/gomoku/quick-start \
    -H "Content-Type: application/json" \
    -d '{"playerSymbol": "X"}'
done
```

**Esperado en el 6º request**:
```json
{
  "success": false,
  "error": "Too many games created. Please wait before creating another game.",
  "retryAfter": 590
}
```

---

## ✅ CHECKLIST DE VALIDACIÓN

### **Funcionalidad Básica**:
- ✅ Servidor inicia sin errores
- ✅ Health check responde
- ✅ API status muestra información correcta

### **Funcionalidad de Juego**:
- ✅ Quick start crea juego exitosamente
- ✅ Movimientos se procesan correctamente
- ✅ IA responde en <2 segundos
- ✅ Estado del juego se actualiza

### **WebSocket**:
- ✅ Conexión WebSocket se establece
- ✅ Mensajes de ping/pong funcionan
- ✅ Sin errores de conexión

### **Admin Endpoints**:
- ✅ Estadísticas se muestran correctamente
- ✅ Lista de salas es precisa

### **Error Handling**:
- ✅ Movimientos inválidos se rechazan
- ✅ Game IDs inexistentes retornan 404
- ✅ Rate limiting funciona

### **Performance**:
- ✅ IA response time <2000ms
- ✅ API response time <100ms
- ✅ WebSocket latency <50ms

---

## 🐛 TROUBLESHOOTING

### **Servidor no inicia**:
```bash
# Verificar puerto no esté ocupado
lsof -i :3000

# Verificar dependencies
bun install

# Verificar TypeScript
bun run type-check
```

### **WebSocket no conecta**:
```bash
# Verificar en logs del servidor:
# Debe mostrar: "🔌 WebSocket upgrade request: /ws/gomoku/ABC123"
```

### **IA muy lenta**:
```bash
# En logs debe mostrar AI performance:
# "🧠 AI move calculated in 1250ms (depth: 6, nodes: 15420)"
# Si >3000ms, revisar configuración
```

### **Rate limiting muy agresivo**:
```bash
# Ajustar en src/middleware/rateLimit.ts:
gameCreation: { windowMs: 10min, maxRequests: 10 }  # Aumentar a 10
```

---

## 📊 MÉTRICAS ESPERADAS

### **Response Times**:
- Health check: <10ms
- Quick start: <100ms
- Move processing: <50ms
- AI calculation: <2000ms
- WebSocket message: <10ms

### **AI Performance**:
- Nodes searched: >1000 por movimiento
- Search depth: 4-8 typical, hasta 12 máximo
- Cache hit rate: >50% después de varios movimientos
- Confidence score: >0.5 para movimientos buenos

### **Memory Usage**:
- Startup: ~30MB
- Con 1 juego activo: ~35MB
- Con 5 juegos activos: ~50MB
- Con 15 juegos activos: <100MB

---

## 🎯 CRITERIOS DE ÉXITO

**✅ TESTING EXITOSO si**:
1. Todos los endpoints responden correctamente
2. IA genera movimientos válidos en <2 segundos
3. WebSocket conecta sin errores
4. Rate limiting previene abuso
5. Error handling es apropiado
6. Performance está dentro de rangos esperados

**❌ NECESITA FIXES si**:
1. Cualquier endpoint retorna 500 error
2. IA toma >3 segundos o hace movimientos inválidos
3. WebSocket no conecta o se desconecta
4. Rate limiting no funciona
5. Memory usage >200MB con pocos juegos

---

## 🚀 DESPUÉS DEL TESTING

**Si testing es exitoso**:
→ Proceder a **Fase 3: Integración Frontend**

**Si hay issues**:
→ Documentar bugs en GitHub issues
→ Priorizar fixes críticos
→ Re-testing después de fixes

---

*Guía de testing actualizada - Ready for execution*