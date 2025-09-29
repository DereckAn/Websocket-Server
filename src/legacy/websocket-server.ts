import type { AdminConnection, WebSocketMessage } from './types';
import { generateId, log } from './utils';

// Admin connections storage
const adminConnections = new Map<string, AdminConnection>();

// Broadcast message to all connected admin clients
export function broadcastToAdmins(message: WebSocketMessage): void {
  const connectedClients = adminConnections.size;
  
  if (connectedClients === 0) {
    log('debug', 'No admin clients connected for broadcast');
    return;
  }

  log('debug', `Broadcasting to ${connectedClients} admin clients:`, {
    type: message.type,
    timestamp: message.timestamp
  });

  let successCount = 0;
  let failureCount = 0;

  for (const [clientId, connection] of adminConnections) {
    try {
      connection.ws.send(JSON.stringify(message));
      successCount++;
    } catch (error) {
      log('warn', `Failed to send message to admin client ${clientId}:`, error);
      adminConnections.delete(clientId);
      failureCount++;
    }
  }

  log('info', `Broadcast complete: ${successCount} successful, ${failureCount} failed`);
}

// Handle WebSocket connection
export function handleWebSocketConnection(ws: any): void {
  log('info', 'New WebSocket connection established');
  
  // Send initial connection message
  const welcomeMessage: WebSocketMessage = {
    type: 'connected',
    message: 'Connected to Square Webhook & WebSocket Server',
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(welcomeMessage));
}

// Handle WebSocket messages
export function handleWebSocketMessage(ws: any, message: string | Buffer): void {
  try {
    const data = JSON.parse(typeof message === 'string' ? message : new TextDecoder().decode(message));
    
    log('debug', 'WebSocket message received:', { type: data.type });
    
    switch (data.type) {
      case 'admin-connect':
        handleAdminConnect(ws, data);
        break;
        
      case 'ping':
        handlePing(ws);
        break;
        
      default:
        log('warn', `Unknown message type: ${data.type}`);
        sendErrorMessage(ws, `Unknown message type: ${data.type}`);
    }
  } catch (error) {
    log('error', 'Error parsing WebSocket message:', error);
    sendErrorMessage(ws, 'Invalid message format');
  }
}

// Handle admin connection
function handleAdminConnect(ws: any, data: any): void {
  const clientId = generateId();
  
  const adminConnection: AdminConnection = {
    ws,
    clientId,
    connectedAt: new Date()
  };
  
  adminConnections.set(clientId, adminConnection);
  
  const response: WebSocketMessage = {
    type: 'connected',
    data: {
      clientId,
      message: 'Connected to admin dashboard'
    },
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(response));
  
  log('info', `Admin client connected: ${clientId}`, {
    totalConnections: adminConnections.size
  });
}

// Handle ping messages
function handlePing(ws: any): void {
  const pongMessage: WebSocketMessage = {
    type: 'ping',
    timestamp: new Date().toISOString()
  };
  
  ws.send(JSON.stringify(pongMessage));
}

// Send error message
function sendErrorMessage(ws: any, errorMessage: string): void {
  const errorResponse: WebSocketMessage = {
    type: 'error',
    message: errorMessage,
    timestamp: new Date().toISOString()
  };
  
  try {
    ws.send(JSON.stringify(errorResponse));
  } catch (error) {
    log('error', 'Failed to send error message:', error);
  }
}

// Handle WebSocket disconnection
export function handleWebSocketClose(ws: any): void {
  // Find and remove the disconnected client
  const adminConnection = Array.from(adminConnections.values()).find(conn => conn.ws === ws);
  
  if (adminConnection) {
    adminConnections.delete(adminConnection.clientId);
    
    const connectionDuration = Date.now() - adminConnection.connectedAt.getTime();
    
    log('info', `Admin client disconnected: ${adminConnection.clientId}`, {
      connectionDuration: `${Math.round(connectionDuration / 1000)}s`,
      remainingConnections: adminConnections.size
    });
  } else {
    log('debug', 'Unknown WebSocket connection closed');
  }
}

// Keep-alive mechanism - send ping to all connected clients
export function startKeepAlive(): void {
  const keepAliveInterval = 30000; // 30 seconds
  
  setInterval(() => {
    if (adminConnections.size > 0) {
      broadcastToAdmins({
        type: 'ping',
        timestamp: new Date().toISOString()
      });
    }
  }, keepAliveInterval);
  
  log('info', `Keep-alive mechanism started (${keepAliveInterval}ms interval)`);
}

// Get connection stats
export function getConnectionStats() {
  return {
    adminConnections: adminConnections.size,
    connections: Array.from(adminConnections.values()).map(conn => ({
      clientId: conn.clientId,
      connectedAt: conn.connectedAt.toISOString(),
      uptime: Date.now() - conn.connectedAt.getTime()
    }))
  };
}