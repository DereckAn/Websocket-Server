import { verifySquareWebhookSignature, processSquareWebhook, getSquareOrderById } from './square-client';
import { broadcastToAdmins } from './websocket-server';
import { createCorsHeaders, log, formatOrderForDisplay } from './utils';
import type { WebSocketMessage } from './types';

// Handle Square webhook endpoint
export async function handleSquareWebhook(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const signature = request.headers.get('x-square-hmacsha256-signature');
    const body = await request.text();
    
    log('info', '=== SQUARE WEBHOOK RECEIVED ===');
    log('debug', 'Webhook details:', {
      signature: signature ? 'present' : 'missing',
      bodyLength: body.length,
      bodyPreview: body.substring(0, 200) + '...'
    });
    
    // Parse body first to check for test events
    let parsedBody;
    try {
      parsedBody = JSON.parse(body);
    } catch (parseError) {
      log('error', 'Failed to parse webhook body:', parseError);
      return new Response(JSON.stringify({ error: 'Invalid JSON' }), { 
        status: 400,
        headers: createCorsHeaders()
      });
    }
    
    // Handle test events (skip signature verification)
    if (parsedBody.type === 'test') {
      log('info', 'Processing test event, skipping signature verification');
      
      const testMessage: WebSocketMessage = {
        type: 'test-event',
        data: {
          message: 'Test webhook received successfully',
          timestamp: new Date().toISOString(),
          data: parsedBody.data
        }
      };
      
      broadcastToAdmins(testMessage);
      
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Test event processed' 
      }), {
        headers: createCorsHeaders()
      });
    }
    
    // Verify signature for real webhooks
    if (!signature) {
      log('error', 'Missing signature in webhook request');
      return new Response(JSON.stringify({ error: 'Missing signature' }), { 
        status: 400,
        headers: createCorsHeaders()
      });
    }
    
    // Use the exact webhook URL registered with Square
    const webhookUrl = process.env.WEBHOOK_URL || `${url.protocol}//${url.host}/webhooks/square`;
    
    log('debug', 'Webhook signature verification details:', {
      webhookUrl,
      signaturePresent: !!signature,
      bodyLength: body.length
    });
    
    const isValidSignature = verifySquareWebhookSignature(body, signature, webhookUrl);
    
    if (!isValidSignature) {
      log('error', 'Invalid signature - webhook rejected');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { 
        status: 403,
        headers: createCorsHeaders()
      });
    }
    
    // Process webhook events
    const events = parsedBody.events || [parsedBody];
    const processedOrders = await processSquareWebhook(events);
    
    // Broadcast new orders to admin clients
    for (const order of processedOrders) {
      const orderMessage: WebSocketMessage = {
        type: 'new-order',
        data: order,
        timestamp: new Date().toISOString()
      };
      
      broadcastToAdmins(orderMessage);
      
      log('info', `New order broadcasted: ${order.id}`);
    }
    
    log('info', '=== SQUARE WEBHOOK PROCESSED SUCCESSFULLY ===');
    return new Response(JSON.stringify({ 
      success: true,
      processedOrders: processedOrders.length 
    }), {
      headers: createCorsHeaders()
    });
    
  } catch (error) {
    log('error', '=== SQUARE WEBHOOK ERROR ===', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), { 
      status: 500,
      headers: createCorsHeaders()
    });
  }
}

// Handle test endpoint
export async function handleTestEndpoint(request: Request): Promise<Response> {
  try {
    const body = await request.json();
    
    log('info', 'Test event received from admin panel');
    
    const testMessage: WebSocketMessage = {
      type: 'test-event',
      data: {
        message: 'Test event from admin panel',
        timestamp: new Date().toISOString(),
        data: body
      }
    };
    
    broadcastToAdmins(testMessage);
    
    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Test event sent to all connected clients' 
    }), {
      headers: createCorsHeaders()
    });
  } catch (error) {
    log('error', 'Error processing test request:', error);
    return new Response(JSON.stringify({ error: 'Invalid request' }), { 
      status: 400,
      headers: createCorsHeaders()
    });
  }
}

// Handle health check endpoint
export function handleHealthCheck(): Response {
  const healthData = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.SQUARE_ENVIRONMENT || 'sandbox',
    version: '1.0.0'
  };
  
  log('debug', 'Health check requested');
  
  return new Response(JSON.stringify(healthData), {
    headers: createCorsHeaders()
  });
}

// Handle status endpoint
export function handleStatusCheck(): Response {
  const { getConnectionStats } = require('./websocket-server');
  const connectionStats = getConnectionStats();
  
  const statusData = {
    ...connectionStats,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
    }
  };
  
  log('debug', 'Status check requested');
  
  return new Response(JSON.stringify(statusData), {
    headers: createCorsHeaders()
  });
}

// Handle order lookup by ID
export async function handleOrderLookup(request: Request): Promise<Response> {
  try {
    const url = new URL(request.url);
    const orderId = url.pathname.split('/orders/')[1];
    
    if (!orderId) {
      log('warn', 'Order ID missing in request');
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        status: 400,
        headers: createCorsHeaders()
      });
    }

    // Validate order ID format (Square order IDs are alphanumeric)
    if (!/^[a-zA-Z0-9_-]+$/.test(orderId)) {
      log('warn', `Invalid order ID format: ${orderId}`);
      return new Response(JSON.stringify({ error: 'Invalid order ID format' }), {
        status: 400,
        headers: createCorsHeaders()
      });
    }

    log('info', `Looking up order: ${orderId}`);

    const order = await getSquareOrderById(orderId);
    
    if (!order) {
      log('info', `Order not found: ${orderId}`);
      return new Response(JSON.stringify({ 
        error: 'Order not found',
        orderId 
      }), {
        status: 404,
        headers: createCorsHeaders()
      });
    }

    // Format order for consistent response
    const formattedOrder = formatOrderForDisplay(order);
    
    log('info', `Order found and returned: ${orderId}`, {
      state: order.state,
      itemCount: order.lineItems?.length || 0
    });

    return new Response(JSON.stringify({
      success: true,
      order: formattedOrder
    }), {
      headers: createCorsHeaders()
    });

  } catch (error) {
    log('error', 'Error in order lookup:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: createCorsHeaders()
    });
  }
}

// Handle CORS preflight requests
export function handleCorsPrelight(): Response {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-square-hmacsha256-signature',
    }
  });
}