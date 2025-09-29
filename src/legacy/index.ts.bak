import { 
  handleSquareWebhook, 
  handleTestEndpoint, 
  handleHealthCheck, 
  handleStatusCheck, 
  handleCorsPrelight,
  handleOrderLookup 
} from './webhook-handler';
import { 
  handleWebSocketConnection, 
  handleWebSocketMessage, 
  handleWebSocketClose, 
  startKeepAlive 
} from './websocket-server';
import { validateEnvironmentVariables, log } from './utils';

// Validate environment variables on startup
if (!validateEnvironmentVariables()) {
  log('error', 'Server startup failed due to missing environment variables');
  process.exit(1);
}

// Start keep-alive mechanism for WebSocket connections
startKeepAlive();

// Create the main server
const server = Bun.serve({
  port: parseInt(process.env.WEBHOOK_PORT || '3000'),
  async fetch(request, server) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCorsPrelight();
    }
    
    // Handle WebSocket upgrade
    const upgradeHeader = request.headers.get('upgrade');
    if (upgradeHeader === 'websocket') {
      if (server.upgrade(request)) {
        return undefined; // Connection was upgraded
      }
      return new Response('WebSocket upgrade failed', { status: 400 });
    }
    
    // Route handlers
    switch (true) {
      case path === '/webhooks/square':
        if (request.method === 'POST') {
          return handleSquareWebhook(request);
        }
        break;
        
      case path === '/test':
        if (request.method === 'POST') {
          return handleTestEndpoint(request);
        }
        break;
        
      case path === '/health':
        if (request.method === 'GET') {
          return handleHealthCheck();
        }
        break;
        
      case path === '/status':
        if (request.method === 'GET') {
          return handleStatusCheck();
        }
        break;
        
      case path.startsWith('/orders/'):
        if (request.method === 'GET') {
          return handleOrderLookup(request);
        }
        break;
        
      case path === '/':
        return new Response(JSON.stringify({
          name: 'Square Webhook & WebSocket Server',
          version: '1.0.0',
          status: 'running',
          endpoints: {
            webhooks: '/webhooks/square (POST)',
            test: '/test (POST)',
            health: '/health (GET)',
            status: '/status (GET)',
            orders: '/orders/{orderId} (GET)',
            websocket: 'ws://localhost:3000'
          }
        }), {
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
          }
        });
    }
    
    // Default 404 response
    return new Response(JSON.stringify({ error: 'Not Found' }), { 
      status: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*'
      }
    });
  },
  error(error) {
    log('error', 'Server error:', error);
    return new Response('Internal Server Error', { status: 500 });
  },
  websocket: {
    open(ws) {
      handleWebSocketConnection(ws);
    },
    message(ws, message) {
      handleWebSocketMessage(ws, message);
    },
    close(ws) {
      handleWebSocketClose(ws);
    }
  }
});

// Graceful shutdown handling
process.on('SIGINT', () => {
  log('info', 'Received SIGINT, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('info', 'Received SIGTERM, shutting down gracefully...');
  server.stop();
  process.exit(0);
});

// Log server startup
log('info', '=== SQUARE WEBHOOK & WEBSOCKET SERVER STARTED ===');
log('info', `Server running at http://localhost:${server.port}`);
log('info', `WebSocket endpoint: ws://localhost:${server.port}`);
log('info', `Square webhook endpoint: http://localhost:${server.port}/webhooks/square`);
log('info', `Health check: http://localhost:${server.port}/health`);
log('info', `Status check: http://localhost:${server.port}/status`);
log('info', `Test endpoint: http://localhost:${server.port}/test`);
log('info', `Environment: ${process.env.SQUARE_ENVIRONMENT || 'sandbox'}`);
log('info', `CORS Origin: ${process.env.CORS_ORIGIN || '*'}`);
log('info', `Log Level: ${process.env.LOG_LEVEL || 'info'}`);
log('info', '=== SERVER READY FOR CONNECTIONS ===');