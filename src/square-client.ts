import { SquareClient } from 'square';
import type { SquareOrder, SquareWebhookEvent } from './types';
import { log, handleBigIntSerialization, formatOrderForDisplay } from './utils';
import crypto from 'crypto';

// Initialize Square client
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

export { squareClient };

// Function to verify Square webhook signature
export function verifySquareWebhookSignature(
  body: string,
  signature: string,
  webhookUrl: string
): boolean {
  if (!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
    log('error', 'SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
    return false;
  }

  try {
    const stringToSign = webhookUrl + body;
    const hmac = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
    hmac.update(stringToSign);
    const expectedSignature = hmac.digest('base64');

    const isValid = expectedSignature === signature;
    log('debug', `Signature verification: ${isValid ? 'VALID' : 'INVALID'}`, {
      expected: expectedSignature,
      received: signature,
      stringToSign: stringToSign.substring(0, 100) + '...'
    });

    return isValid;
  } catch (error) {
    log('error', 'Error verifying webhook signature:', error);
    return false;
  }
}

// Function to get Square order details by ID
export async function getSquareOrderById(orderId: string): Promise<SquareOrder | null> {
  try {
    log('info', `Fetching order details from Square API: ${orderId}`);
    
    const response = await squareClient.orders.get({
      orderId
    });
    
    if (response.order) {
      const order = JSON.parse(JSON.stringify(response.order, handleBigIntSerialization));
      
      log('debug', 'Square API Response received:', {
        orderId: order.id,
        state: order.state,
        itemCount: order.lineItems?.length || 0
      });
      
      return order;
    }
    
    log('warn', `No order found for ID: ${orderId}`);
    return null;
  } catch (error) {
    log('error', `Error fetching Square order ${orderId}:`, error);
    return null;
  }
}

// Function to validate if order should be processed (only COMPLETED orders)
export function isValidOrder(order: SquareOrder): boolean {
  const isCompleted = order.state === 'COMPLETED';
  
  log('debug', `Order validation for ${order.id}:`, {
    state: order.state,
    isValid: isCompleted
  });
  
  return isCompleted;
}

// Function to process Square webhook events
export async function processSquareWebhook(events: SquareWebhookEvent[]): Promise<SquareOrder[]> {
  const processedOrders: SquareOrder[] = [];

  log('info', `Processing ${events.length} webhook events`);

  for (const event of events) {
    if (['order.created', 'order.updated'].includes(event.type)) {
      const orderId = event.data?.id || event.data?.object?.id;
      
      if (!orderId) {
        log('warn', 'Order ID not found in event:', event);
        continue;
      }

      log('info', `Processing ${event.type} for order: ${orderId}`);

      try {
        const order = await getSquareOrderById(orderId);
        
        if (order && isValidOrder(order)) {
          const formattedOrder = formatOrderForDisplay(order);
          processedOrders.push(formattedOrder);
          
          log('info', `Order ${orderId} processed successfully - COMPLETED state`);
        } else if (order) {
          log('info', `Order ${orderId} skipped - state: ${order.state} (not COMPLETED)`);
        }
      } catch (error) {
        log('error', `Error processing order ${orderId}:`, error);
      }
    } else {
      log('debug', `Ignoring event type: ${event.type}`);
    }
  }

  log('info', `Webhook processing complete. ${processedOrders.length} orders ready for broadcast`);
  return processedOrders;
}