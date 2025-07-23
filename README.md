# 🚀 Square Webhook & WebSocket Server

A high-performance Bun server that receives Square webhooks and broadcasts order updates in real-time via WebSockets. Built specifically for restaurant teams to see completed orders instantly without the limitations of Vercel's timeout and rate limiting.

## 📋 Overview

This server replaces the problematic SSE (Server-Sent Events) implementation with reliable WebSocket connections, solving:

- ✅ **504 Gateway Timeout errors** from Vercel's 10-second limit
- ✅ **429 Rate Limiting errors** from frequent SSE reconnections  
- ✅ **Connection drops** and unreliable real-time updates
- ✅ **Memory-efficient processing** of 100+ orders/day
- ✅ **Zero-cost deployment** options (Railway, Render, Fly.io)

## 🏗️ Architecture

```
Square POS → Webhook → Bun Server → WebSocket → Next.js Admin Dashboard
```

**Key Features:**
- **HMAC SHA256 signature verification** for webhook security
- **WebSocket broadcasting** to multiple admin clients
- **Completed orders only** filtering (all orders are terminal orders)
- **Structured logging** with configurable levels
- **Health checks** and status monitoring
- **Docker containerization** ready for deployment

## 🚀 Quick Start

### Prerequisites

- [Bun](https://bun.sh) >= 1.0.0
- Square Developer Account with webhook configured
- Optional: Docker for containerized deployment

### Local Development

1. **Clone and setup:**
```bash
cd bun-server
bun install
```

2. **Configure environment:**
```bash
cp .env.example .env
# Edit .env with your Square credentials
```

3. **Start development server:**
```bash
bun run dev
```

The server starts at `http://localhost:3000` with hot reload enabled.

### Docker Development

```bash
# Development with hot reload
docker-compose --profile dev up webhook-server-dev

# Production mode
docker-compose up webhook-server
```

## ⚙️ Configuration

### Environment Variables

| Variable | Required | Description | Example |
|----------|----------|-------------|---------|
| `SQUARE_ACCESS_TOKEN` | ✅ | Square API access token | `EAAAl...` |
| `SQUARE_WEBHOOK_SIGNATURE_KEY` | ✅ | Webhook signature verification key | `wbhk_...` |
| `SQUARE_APPLICATION_ID` | ✅ | Square application ID | `sq0idp-...` |
| `SQUARE_ENVIRONMENT` | ✅ | `sandbox` or `production` | `sandbox` |
| `WEBHOOK_PORT` | ❌ | Server port (default: 3000) | `3000` |
| `CORS_ORIGIN` | ❌ | Allowed CORS origin | `https://yourdomain.vercel.app` |
| `LOG_LEVEL` | ❌ | Logging level | `info` |
| `NODE_ENV` | ❌ | Environment mode | `production` |

### Square Webhook Configuration

In your Square Developer Dashboard:

1. **Webhook URL:** `https://your-server.railway.app/webhooks/square`
2. **Events:** `order.created`, `order.updated`
3. **Signature key:** Copy to `SQUARE_WEBHOOK_SIGNATURE_KEY`

## 🛠️ API Endpoints

### Webhook Endpoints
- `POST /webhooks/square` - Receives Square webhook events
- `POST /test` - Send test events to connected clients

### Monitoring Endpoints
- `GET /health` - Health check with server status
- `GET /status` - Detailed connection and memory stats
- `GET /` - Server information and available endpoints

### WebSocket Connection
- `ws://localhost:3000` - WebSocket endpoint for real-time updates

## 📡 WebSocket Integration

### Client Connection (Next.js)

Replace your existing SSE code with:

```javascript
// Connect to WebSocket server
const ws = new WebSocket('ws://localhost:3000'); // Development
// const ws = new WebSocket('wss://your-server.railway.app'); // Production

// Handle connection
ws.onopen = () => {
  // Send admin connection message
  ws.send(JSON.stringify({ type: 'admin-connect' }));
};

// Handle messages
ws.onmessage = (event) => {
  const { type, data, timestamp } = JSON.parse(event.data);
  
  switch (type) {
    case 'connected':
      console.log('Connected to webhook server:', data);
      setIsConnected(true);
      break;
      
    case 'new-order':
      console.log('New completed order received:', data);
      // All orders are terminal orders - no need to distinguish
      setEvents((prev) => [
        {
          id: Date.now().toString(),
          timestamp: timestamp || new Date().toISOString(),
          type: 'new-order',
          data: data,
          isTerminalOrder: true // Always true
        },
        ...prev.slice(0, 49) // Keep last 50 events
      ]);
      break;
      
    case 'test-event':
      console.log('Test event received:', data);
      break;
      
    case 'ping':
      // Keep-alive ping, update connection status
      setLastEventTime(timestamp);
      break;
      
    case 'error':
      console.error('WebSocket error:', data);
      break;
  }
};

// Handle connection close
ws.onclose = () => {
  setIsConnected(false);
  // Implement reconnection logic here
};

// Handle errors
ws.onerror = (error) => {
  console.error('WebSocket error:', error);
  setIsConnected(false);
};
```

### Message Types

The server sends these WebSocket message types:

```typescript
{
  type: 'connected',        // Initial connection confirmation
  type: 'new-order',        // New completed order from Square
  type: 'test-event',       // Test message from admin panel
  type: 'ping',            // Keep-alive heartbeat
  type: 'error'            // Error notifications
}
```

## 🐳 Docker Deployment

### Build Options

```bash
# Development with hot reload
docker-compose --profile dev up

# Production build
docker-compose up

# Build specific target
docker build --target production -t webhook-server .
```

### Resource Usage

The container is optimized for low-traffic restaurant use:
- **Memory limit:** 256MB
- **CPU limit:** 0.5 cores
- **Suitable for:** 100+ orders/day

## 🚢 Deployment Options

### Railway (Recommended - Free)

1. **Connect repository:**
```bash
railway login
railway init
railway up
```

2. **Set environment variables** in Railway dashboard

3. **Update Next.js WebSocket URL:**
```javascript
const wsUrl = 'wss://your-app-name.up.railway.app';
```

### Render (Alternative - Free Tier)

1. Connect GitHub repository
2. Set environment variables  
3. Deploy with auto-deploy enabled

### Fly.io (Alternative)

```bash
fly launch
fly deploy
```

## 🧪 Testing

### Test Webhook Locally

```bash
# Send test webhook
curl -X POST http://localhost:3000/test \
  -H "Content-Type: application/json" \
  -d '{"message": "Test from admin panel"}'
```

### Test Square Webhook

Use Square's webhook testing tool in Developer Dashboard or:

```bash
# Simulate Square webhook (with proper signature)
curl -X POST http://localhost:3000/webhooks/square \
  -H "Content-Type: application/json" \
  -H "x-square-hmacsha256-signature: YOUR_SIGNATURE" \
  -d '{"events": [{"type": "order.created", "data": {"id": "test-order-123"}}]}'
```

### Health Check

```bash
curl http://localhost:3000/health
```

## 📊 Monitoring

### Logs

Structured logging with configurable levels:

```bash
# View logs in Docker
docker-compose logs -f webhook-server

# Local development
bun run dev # Logs to console
```

### Metrics

The `/status` endpoint provides:
- Active WebSocket connections
- Memory usage
- Uptime statistics
- Connection details

### Health Checks

- Docker health checks every 30 seconds
- HTTP health endpoint at `/health`
- Automatic container restart on failure

## 🔧 Development

### Project Structure

```
bun-server/
├── src/
│   ├── index.ts              # Main server entry point
│   ├── webhook-handler.ts     # Webhook endpoint logic
│   ├── websocket-server.ts   # WebSocket server management
│   ├── square-client.ts      # Square API integration
│   ├── types.ts             # TypeScript type definitions
│   └── utils.ts             # Utility functions
├── Dockerfile               # Multi-stage Docker build
├── docker-compose.yml       # Development & production setup
├── package.json            # Dependencies and scripts
├── tsconfig.json           # TypeScript configuration
└── .env.example           # Environment variables template
```

### Available Scripts

```bash
bun run dev          # Development with hot reload
bun run start        # Production server
bun run build        # Build for production
bun run test         # Run tests
bun run type-check   # TypeScript validation
```

## 🔒 Security

### HMAC Verification

All Square webhooks are verified using HMAC SHA256:

```typescript
const stringToSign = webhookUrl + requestBody;
const expectedSignature = crypto
  .createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)
  .update(stringToSign)
  .digest('base64');
```

### CORS Configuration

Configure `CORS_ORIGIN` to restrict access:

```env
# Development
CORS_ORIGIN=http://localhost:3000

# Production  
CORS_ORIGIN=https://your-admin-dashboard.vercel.app
```

### Container Security

- Runs as non-root user
- Minimal Alpine Linux base image
- No unnecessary packages installed

## 🔍 Troubleshooting

### Common Issues

**Connection Refused:**
```bash
# Check if server is running
curl http://localhost:3000/health
```

**Webhook Signature Errors:**
- Verify `SQUARE_WEBHOOK_SIGNATURE_KEY` matches Square dashboard
- Check webhook URL includes protocol (`https://`)

**WebSocket Connection Drops:**
- Implement reconnection logic in client
- Check network connectivity
- Verify CORS settings

**Memory Issues:**
- Monitor `/status` endpoint
- Increase Docker memory limits if needed
- Check for memory leaks in logs

### Debug Mode

Set `LOG_LEVEL=debug` for detailed logging:

```env
LOG_LEVEL=debug
```

## 📈 Performance

### Optimization for Restaurant Use

- **Memory efficient:** < 100MB typical usage
- **Low CPU:** Handles 100+ orders/day easily  
- **Fast startup:** < 2 seconds
- **Reliable:** Auto-restart on failures

### Scaling

For higher traffic:
- Increase Docker resource limits
- Use Redis for multi-instance state sharing
- Implement database storage for order history

## 📄 License

MIT License - see LICENSE file for details.

---

**🍽️ Built for restaurant teams who need reliable, real-time order notifications without the complexity and costs of enterprise solutions.**