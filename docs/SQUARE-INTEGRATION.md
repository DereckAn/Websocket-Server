# 🟦 Square Webhook Integration Guide

## Overview

This document explains the Square webhook integration that sends real-time order notifications to the admin_mich dashboard.

**Status:** ✅ Fully implemented and ready to use

---

## Architecture

### Flow Diagram

```
Square POS
    │
    │ (webhook POST)
    ▼
/webhooks/square
    │
    ├─► Verify signature (HMAC SHA256)
    ├─► Process webhook events
    ├─► Extract order data
    │
    ▼
AdminWebSocketService.broadcastNewOrder()
    │
    ▼
All connected admin clients (/admin WebSocket)
    │
    ▼
admin_mich dashboard (real-time update)
```

### Components

| Component | File | Responsibility |
|-----------|------|----------------|
| **SquareController** | `src/controllers/SquareController.ts` | HTTP request handling |
| **SquareService** | `src/services/SquareService.ts` | Business logic, signature verification |
| **AdminWebSocketService** | `src/services/AdminWebSocketService.ts` | WebSocket management, broadcasting |
| **SquareRoutes** | `src/routes/squareRoutes.ts` | Route configuration |
| **OrderModel** | `src/models/OrderModel.ts` | Order validation, formatting |

---

## Endpoints

### HTTP Endpoints

| Method | Path | Description |
|--------|------|-------------|
| POST | `/webhooks/square` | Square webhook receiver |
| GET | `/orders/{orderId}` | Order lookup by ID |
| POST | `/test` | Test event from admin panel |
| GET | `/square/health` | Square integration health check |
| GET | `/square/stats` | Square service statistics |
| GET | `/square/connections` | Active admin connections |
| POST | `/square/cleanup` | Cleanup stale connections |

### WebSocket Endpoint

| Path | Description |
|------|-------------|
| `ws://localhost:3000/admin` | Admin dashboard WebSocket connection |

---

## Setup

### 1. Environment Variables

```bash
# .env
SQUARE_ACCESS_TOKEN=your_square_access_token
SQUARE_WEBHOOK_SIGNATURE_KEY=your_webhook_signature_key
SQUARE_ENVIRONMENT=sandbox  # or 'production'
WEBHOOK_URL=https://yourdomain.com/webhooks/square
```

### 2. Square Dashboard Configuration

1. Go to [Square Developer Dashboard](https://developer.squareup.com/apps)
2. Select your application
3. Navigate to **Webhooks**
4. Add webhook URL: `https://yourdomain.com/webhooks/square`
5. Subscribe to events:
   - `order.created`
   - `order.updated`
   - `order.fulfilled`
6. Copy the **Signature Key** to `SQUARE_WEBHOOK_SIGNATURE_KEY`

### 3. Start Server

```bash
# Development
bun run dev

# Production
NODE_ENV=production bun run src/server.ts
```

The server will:
- ✅ Initialize SquareService (creates Square API client)
- ✅ Initialize AdminWebSocketService (starts keep-alive mechanism)
- ✅ Register shutdown handlers for cleanup

---

## Testing

### Test 1: Health Check

```bash
curl http://localhost:3000/square/health
```

**Expected response:**
```json
{
  "success": true,
  "data": {
    "square": {
      "status": "healthy",
      "details": {
        "configured": true,
        "clientInitialized": true,
        "recentErrors": false,
        "uptime": 123.45
      }
    },
    "statistics": {
      "webhooksProcessed": 0,
      "ordersProcessed": 0,
      "adminConnections": 0
    },
    "connections": {
      "activeConnections": 0,
      "connections": []
    }
  }
}
```

### Test 2: WebSocket Connection

**Frontend code (admin_mich):**
```javascript
const ws = new WebSocket('ws://localhost:3000/admin');

ws.onopen = () => {
  console.log('Connected to admin dashboard');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('Message received:', message);

  if (message.type === 'new-order') {
    // Display order in dashboard
    displayNewOrder(message.data);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected from admin dashboard');
};
```

### Test 3: Test Event

```bash
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{
    "testData": "Hello from admin panel",
    "timestamp": "2025-01-15T10:30:00Z"
  }'
```

**Expected:**
- ✅ Server processes test event
- ✅ Broadcasts to all connected admin clients
- ✅ Admin dashboard receives message with type `test-event`

### Test 4: Square Webhook (from Square)

Square will send webhooks automatically when orders are created/updated. You can also test manually:

```bash
# Create signature (replace with your signature key)
SIGNATURE_KEY="your_signature_key"
WEBHOOK_URL="http://localhost:3000/webhooks/square"
BODY='{"type":"order.created","data":{"id":"order_123","object":{"id":"order_123","location_id":"loc_123","state":"OPEN"}}}'

# Calculate signature
SIGNATURE=$(echo -n "${WEBHOOK_URL}${BODY}" | openssl dgst -sha256 -hmac "$SIGNATURE_KEY" -binary | base64)

# Send webhook
curl -X POST http://localhost:3000/webhooks/square \
  -H "Content-Type: application/json" \
  -H "x-square-hmacsha256-signature: $SIGNATURE" \
  -d "$BODY"
```

**Expected:**
- ✅ Server verifies signature
- ✅ Processes order event
- ✅ Broadcasts to admin clients
- ✅ Admin dashboard shows new order

---

## Message Types

### Sent by Server

| Type | Description | Data |
|------|-------------|------|
| `connected` | Client connected successfully | `{ clientId, message, serverInfo }` |
| `new-order` | New order received | Full order object |
| `order-updated` | Order was updated | Updated order object |
| `test-event` | Test event processed | Test data with server info |
| `ping` | Keep-alive ping | `{ timestamp }` |
| `pong` | Response to client ping | `{ timestamp, clientId }` |
| `stats` | Statistics response | `{ square, connections }` |
| `error` | Error occurred | `{ error: "message" }` |

### Sent by Client

| Type | Description | Data |
|------|-------------|------|
| `admin-connect` | Initial connection | Optional metadata |
| `ping` | Keep-alive ping | Optional timestamp |
| `get-stats` | Request statistics | - |
| `test-event` | Trigger test event | Test data |

---

## Monitoring

### Connection Statistics

```bash
curl http://localhost:3000/square/connections
```

**Response:**
```json
{
  "success": true,
  "data": {
    "activeConnections": 2,
    "connections": [
      {
        "clientId": "admin_abc123",
        "connectedAt": "2025-01-15T10:30:00.000Z",
        "uptime": 45000,
        "lastPing": "2025-01-15T10:30:45.000Z",
        "isAlive": true
      }
    ]
  }
}
```

### Service Statistics

```bash
curl http://localhost:3000/square/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "square": {
      "webhooksProcessed": 42,
      "ordersProcessed": 38,
      "adminConnections": 2,
      "uptime": 3600.5,
      "lastWebhookAt": "2025-01-15T10:30:00.000Z",
      "lastOrderAt": "2025-01-15T10:30:00.000Z",
      "errors": {
        "webhookVerificationErrors": 0,
        "processingErrors": 0
      }
    },
    "connections": {
      "activeConnections": 2
    },
    "server": {
      "uptime": 3600.5,
      "memory": {
        "used": 45,
        "total": 128
      },
      "environment": "production"
    }
  }
}
```

---

## Troubleshooting

### No orders appearing in dashboard

**Check:**
1. ✅ Admin WebSocket connected? → Check browser console
2. ✅ Square webhook configured? → Check Square Dashboard
3. ✅ Signature key correct? → Check `.env` file
4. ✅ Server receiving webhooks? → Check server logs

**Logs to look for:**
```
[INFO] 📥 Square webhook received
[INFO] ✅ Order processed: order_123 (OPEN)
[INFO] 📢 Broadcasting to 2 admin clients: new-order
```

### WebSocket not connecting

**Check:**
1. Server is running
2. WebSocket URL is correct: `ws://localhost:3000/admin` (or your domain)
3. CORS allows WebSocket origin
4. Firewall allows WebSocket connections

**Test connection:**
```bash
wscat -c ws://localhost:3000/admin
```

### Signature verification failing

**Common issues:**
- Wrong signature key in `.env`
- WEBHOOK_URL doesn't match actual URL (must be exact)
- Body has been modified before verification
- Wrong encoding (must be base64)

**Enable debug logging:**
```bash
LOG_LEVEL=debug bun run src/server.ts
```

---

## Security

### Webhook Security

- ✅ **Signature verification**: Every webhook verified with HMAC SHA256
- ✅ **Test events**: Test events skip signature verification (safe)
- ✅ **Rate limiting**: Applied to all endpoints
- ✅ **Origin validation**: WebSocket connections validate origin
- ✅ **Connection timeout**: Stale connections auto-removed (60s)

### Admin Dashboard Security

**Recommended:**
- Add authentication to `/admin` WebSocket endpoint
- Use HTTPS/WSS in production
- Implement IP whitelisting for sensitive endpoints
- Add API key or token authentication

---

## Production Deployment

### Checklist

- [ ] Set `NODE_ENV=production`
- [ ] Configure `SQUARE_ACCESS_TOKEN` (production token)
- [ ] Configure `SQUARE_WEBHOOK_SIGNATURE_KEY` (production key)
- [ ] Set `SQUARE_ENVIRONMENT=production`
- [ ] Update `WEBHOOK_URL` to production domain
- [ ] Configure Square webhooks to production URL
- [ ] Enable HTTPS/SSL
- [ ] Test webhook delivery
- [ ] Monitor logs for errors
- [ ] Set up alerting for webhook failures

### Environment Variables

```bash
# Production .env
NODE_ENV=production
PORT=3000
LOG_LEVEL=info

# Square
SQUARE_ACCESS_TOKEN=your_production_token
SQUARE_WEBHOOK_SIGNATURE_KEY=your_production_signature_key
SQUARE_ENVIRONMENT=production
WEBHOOK_URL=https://api.yourdomain.com/webhooks/square

# CORS
ALLOWED_ORIGINS=https://admin.yourdomain.com,https://yourdomain.com
```

---

## Code References

### Key Files

- **Webhook handling**: `src/controllers/SquareController.ts:31-121`
- **Signature verification**: `src/services/SquareService.ts:69-110`
- **Broadcasting**: `src/services/AdminWebSocketService.ts:218-226`
- **WebSocket upgrade**: `src/routes/squareRoutes.ts:84-103`
- **Server initialization**: `src/server.ts:43-45`

### Adding New Message Types

**1. Update types** (`src/types/square.ts`):
```typescript
export type AdminWSMessageType =
  | 'connected'
  | 'new-order'
  | 'your-new-type'  // Add here
  // ...
```

**2. Add handler** (`src/services/AdminWebSocketService.ts`):
```typescript
static handleMessage(ws: any, message: string | Buffer): void {
  // ...
  switch (data.type) {
    case 'your-new-type':
      this.handleYourNewType(connection, data);
      break;
  }
}

private static handleYourNewType(connection: AdminConnection, data: any): void {
  // Your logic here
}
```

**3. Add broadcast method** (if needed):
```typescript
static broadcastYourNewType(data: any): void {
  const message: AdminWSMessage = {
    type: 'your-new-type',
    data,
    timestamp: new Date().toISOString()
  };

  this.broadcastToAdmins(message);
}
```

---

## Resources

- [Square Webhooks Documentation](https://developer.squareup.com/docs/webhooks-api/what-it-does)
- [Bun WebSocket Documentation](https://bun.sh/docs/api/websockets)
- [LOGGING.md](./LOGGING.md) - Logging system guide
- [PRODUCTION-SETUP.md](./PRODUCTION-SETUP.md) - Production deployment guide

---

## Support

For issues or questions:
1. Check server logs: `LOG_LEVEL=debug`
2. Check Square Dashboard webhook logs
3. Test with `/test` endpoint first
4. Verify environment variables
5. Check this documentation

---

**Last Updated:** January 15, 2025
**Status:** ✅ Production Ready
