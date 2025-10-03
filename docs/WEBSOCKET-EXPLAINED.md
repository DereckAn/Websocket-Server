# 🔌 WebSocket Explicado - Para Frontend admin_mich

## ¿Por qué hay un `if` para distinguir tipos de WebSocket?

El servidor maneja **DOS sistemas completamente diferentes**:

### Sistema 1: Juego Gomoku
```
Jugador A → ws://localhost:3000/ws/gomoku/ABC123
Jugador B → ws://localhost:3000/ws/gomoku/ABC123
             ↓
    Comparten la misma partida en room ABC123
    Se envían movimientos entre ellos
```

### Sistema 2: Admin Dashboard (Square)
```
Admin Dashboard → ws://localhost:3000/admin
                       ↓
              Recibe notificaciones de órdenes
              cuando Square envía webhooks
```

Son **dos WebSockets completamente separados** con propósitos diferentes.

---

## 🔄 Flujo Completo - Cómo Funciona

### 1️⃣ Frontend se conecta

**Código en admin_mich (tu frontend):**

```javascript
// En tu página admin_mich, por ejemplo en useEffect de React o cuando cargue la página

const ws = new WebSocket('ws://localhost:3000/admin');

ws.onopen = () => {
  console.log('✅ Conectado al servidor de notificaciones de Square');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('📨 Mensaje recibido del servidor:', message);

  // Aquí manejas los diferentes tipos de mensajes
  switch(message.type) {
    case 'connected':
      console.log('Bienvenida del servidor:', message.data);
      break;

    case 'new-order':
      // ¡AQUÍ RECIBES LA ORDEN NUEVA!
      console.log('🆕 Nueva orden de Square:', message.data);
      showNotification(message.data); // Tu función para mostrar la orden
      addOrderToList(message.data);   // Agregar a la lista
      break;

    case 'order-updated':
      console.log('🔄 Orden actualizada:', message.data);
      updateOrderInList(message.data);
      break;

    case 'test-event':
      console.log('🧪 Evento de prueba:', message.data);
      break;

    case 'ping':
      // El servidor te envía ping cada 30 segundos para mantener la conexión
      console.log('💓 Ping del servidor');
      break;
  }
};

ws.onerror = (error) => {
  console.error('❌ Error en WebSocket:', error);
};

ws.onclose = () => {
  console.log('🔌 Desconectado del servidor');
  // Aquí podrías intentar reconectar automáticamente
  setTimeout(() => {
    console.log('🔄 Intentando reconectar...');
    // Reconectar (llamar de nuevo a la función de conexión)
  }, 5000);
};
```

### 2️⃣ ¿Qué pasa en el servidor cuando te conectas?

```
Tu frontend: ws = new WebSocket('ws://localhost:3000/admin')
                 ↓
server.ts: detecta upgrade request
                 ↓
routes/index.ts: handleWebSocketUpgrade()
  → path === '/admin' → SquareRoutes.handleWebSocketUpgrade()
                 ↓
squareRoutes.ts: server.upgrade(request, { data: { wsType: 'admin' } })
                 ↓
                 MARCA el WebSocket como tipo 'admin' ✅
                 ↓
server.ts: websocket.open(ws)
  → wsType === 'admin' → SquareController.handleAdminWebSocketOpen(ws)
                 ↓
AdminWebSocketService.handleConnection(ws)
  → Genera clientId único: 'admin_abc123'
  → Guarda tu conexión en Map: connections.set('admin_abc123', { ws, clientId, ... })
  → Te envía mensaje de bienvenida:
    {
      type: 'connected',
      data: { clientId: 'admin_abc123', message: 'Connected to Square admin dashboard' }
    }
```

### 3️⃣ Square envía un webhook

```
Square POS: Se crea una orden
                 ↓
Square servers: POST https://tuservidor.com/webhooks/square
                 ↓
SquareController.handleWebhook()
  → Verifica firma HMAC
  → Procesa el evento
  → Extrae la orden
                 ↓
AdminWebSocketService.broadcastNewOrder(order)
  → Recorre TODAS las conexiones guardadas en el Map
  → Para cada conexión: ws.send(JSON.stringify({
      type: 'new-order',
      data: order,
      timestamp: '2025-01-15T10:30:00.000Z'
    }))
                 ↓
Tu frontend: ws.onmessage se ejecuta
  → Recibes el mensaje
  → Muestras la orden en tu dashboard ✅
```

---

## 🎯 ¿Necesitas "suscribirte"?

**Respuesta corta:** NO necesitas suscribirte explícitamente.

**¿Por qué?**
- Cuando te conectas a `ws://localhost:3000/admin`, el servidor **automáticamente** te agrega a la lista de conexiones
- Cuando llega una orden, el servidor **automáticamente** envía el mensaje a TODAS las conexiones activas
- Es un sistema de **broadcast** (difusión): todos los que estén conectados reciben el mensaje

**Diferencia con otros sistemas:**
```
❌ Sistema con suscripciones (ej: Redis Pub/Sub):
   ws.send({ action: 'subscribe', channel: 'orders' })  // Necesitas suscribirte

✅ Sistema de broadcast (este servidor):
   Solo te conectas → Ya recibes todo automáticamente
```

---

## 📋 Ejemplo Completo - React Component

```typescript
// AdminDashboard.tsx
import { useEffect, useState } from 'react';

interface Order {
  id: string;
  state: string;
  totalMoney: { amount: number; currency: string };
  // ... más campos
}

export function AdminDashboard() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [wsConnected, setWsConnected] = useState(false);
  const [ws, setWs] = useState<WebSocket | null>(null);

  useEffect(() => {
    // Conectar al WebSocket cuando el componente monta
    const websocket = new WebSocket('ws://localhost:3000/admin');

    websocket.onopen = () => {
      console.log('✅ Conectado a notificaciones de Square');
      setWsConnected(true);
    };

    websocket.onmessage = (event) => {
      const message = JSON.parse(event.data);

      if (message.type === 'new-order') {
        console.log('🆕 Nueva orden recibida:', message.data);

        // Agregar la orden nueva al principio de la lista
        setOrders(prev => [message.data, ...prev]);

        // Mostrar notificación
        showBrowserNotification('Nueva orden de Square', message.data.id);

        // Reproducir sonido
        playNotificationSound();
      }

      if (message.type === 'order-updated') {
        console.log('🔄 Orden actualizada:', message.data);

        // Actualizar la orden en la lista
        setOrders(prev =>
          prev.map(order =>
            order.id === message.data.id ? message.data : order
          )
        );
      }
    };

    websocket.onerror = (error) => {
      console.error('❌ Error en WebSocket:', error);
      setWsConnected(false);
    };

    websocket.onclose = () => {
      console.log('🔌 Desconectado');
      setWsConnected(false);

      // Reconectar después de 5 segundos
      setTimeout(() => {
        console.log('🔄 Reconectando...');
        // Llamar de nuevo a este useEffect o crear función de conexión
      }, 5000);
    };

    setWs(websocket);

    // Cleanup al desmontar el componente
    return () => {
      websocket.close();
    };
  }, []);

  const sendTestEvent = () => {
    if (ws && wsConnected) {
      ws.send(JSON.stringify({
        type: 'test-event',
        data: { message: 'Prueba desde frontend' }
      }));
    }
  };

  return (
    <div className="admin-dashboard">
      <div className="status-bar">
        {wsConnected ? (
          <span className="connected">✅ Conectado</span>
        ) : (
          <span className="disconnected">❌ Desconectado</span>
        )}
        <button onClick={sendTestEvent}>Enviar evento de prueba</button>
      </div>

      <div className="orders-list">
        <h2>Órdenes Recientes ({orders.length})</h2>
        {orders.map(order => (
          <div key={order.id} className="order-card">
            <h3>{order.id}</h3>
            <p>Estado: {order.state}</p>
            <p>Total: ${order.totalMoney.amount / 100} {order.totalMoney.currency}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function showBrowserNotification(title: string, body: string) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

function playNotificationSound() {
  const audio = new Audio('/notification.mp3');
  audio.play();
}
```

---

## 🧪 Cómo Probar

### Paso 1: Iniciar servidor
```bash
cd bun-server
bun run src/server.ts
```

### Paso 2: Abrir consola del navegador

En tu página admin_mich, abre la consola y pega:

```javascript
const ws = new WebSocket('ws://localhost:3000/admin');

ws.onopen = () => console.log('✅ CONECTADO');

ws.onmessage = (e) => {
  const msg = JSON.parse(e.data);
  console.log('📨 MENSAJE:', msg);
};

ws.onerror = (e) => console.error('❌ ERROR:', e);

ws.onclose = () => console.log('🔌 CERRADO');
```

**Deberías ver:**
```
✅ CONECTADO
📨 MENSAJE: { type: 'connected', data: { clientId: 'admin_abc123', ... } }
```

### Paso 3: Enviar webhook de prueba

En otra terminal:
```bash
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"test": "orden de prueba"}'
```

**En la consola del navegador deberías ver:**
```
📨 MENSAJE: { type: 'test-event', data: { ... } }
```

### Paso 4: Simular webhook real de Square

```bash
# En el servidor, deberías ver logs y el frontend recibir el mensaje
curl -X POST http://localhost:3000/webhooks/square \
  -H "Content-Type: application/json" \
  -H "x-square-hmacsha256-signature: test" \
  -d '{
    "type": "order.created",
    "data": {
      "id": "order_test_123",
      "object": {
        "id": "order_test_123",
        "location_id": "loc_123",
        "state": "OPEN",
        "total_money": { "amount": 5000, "currency": "USD" }
      }
    }
  }'
```

---

## 🔍 Debugging

### Ver conexiones activas

```bash
curl http://localhost:3000/square/connections
```

Deberías ver tu conexión:
```json
{
  "activeConnections": 1,
  "connections": [
    {
      "clientId": "admin_abc123",
      "connectedAt": "2025-01-15T10:30:00.000Z",
      "isAlive": true
    }
  ]
}
```

### Ver logs del servidor

El servidor mostrará:
```
[INFO] 🔌 WebSocket upgrade request: /admin
[INFO] 👤 Admin client connected: admin_abc123 (total: 1)
[INFO] 📢 Broadcasting to 1 admin clients: new-order
[INFO] ✅ Broadcast complete: 1 successful, 0 failed
```

---

## ❓ Preguntas Frecuentes

### ¿Puedo tener múltiples pestañas conectadas?

**SÍ.** Cada pestaña tendrá su propia conexión y TODAS recibirán las notificaciones.

```
Pestaña 1: admin_abc123 ✅
Pestaña 2: admin_def456 ✅
Pestaña 3: admin_ghi789 ✅
    ↓
Nueva orden → Las 3 reciben el mensaje
```

### ¿Qué pasa si se cae la conexión?

El servidor tiene keep-alive (ping cada 30s), pero deberías implementar reconexión automática:

```javascript
function connectWebSocket() {
  const ws = new WebSocket('ws://localhost:3000/admin');

  ws.onclose = () => {
    console.log('Desconectado. Reconectando en 5s...');
    setTimeout(connectWebSocket, 5000);
  };

  // ... otros handlers
}
```

### ¿Necesito autenticación?

Actualmente NO, pero en producción **deberías agregar**:
- Token JWT en query params: `ws://server.com/admin?token=abc123`
- Validar el token en `handleConnection()`
- Solo aceptar conexiones autorizadas

---

## 📝 Resumen

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué el `if` en server.ts? | Para distinguir entre WebSocket de gomoku y de admin |
| ¿Necesito suscribirme? | NO - Al conectarte ya recibes todo automáticamente |
| ¿Cómo me conecto? | `new WebSocket('ws://localhost:3000/admin')` |
| ¿Qué recibo? | Mensajes con `type: 'new-order'` cuando Square envía webhooks |
| ¿Puedo enviar mensajes? | SÍ - `ws.send()` para ping, get-stats, test-event |

---

**El flujo es simple:**
```
Frontend conecta → Servidor guarda conexión → Webhook llega → Servidor envía a todos ✅
```

¡No necesitas suscribirte a nada! Solo conecta y escucha. 🎧
