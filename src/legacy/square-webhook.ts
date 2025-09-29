import { SquareClient } from 'square';
import crypto from 'crypto';

// Square client configuration
const squareClient = new SquareClient({
  token: process.env.SQUARE_ACCESS_TOKEN,
  environment: process.env.SQUARE_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
});

export interface SquareWebhookEvent {
  type: string;
  data: {
    id?: string;
    object?: {
      id: string;
    };
  };
}

export interface SquareOrder {
  id: string;
  state: string;
  locationId: string;
  lineItems?: any[];
  totalMoney?: {
    amount: bigint;
    currency: string;
  };
  createdAt?: string;
  closedAt?: string;
  tenders?: any[];
}

// Function to verify Square webhook signature
export function verifySquareWebhookSignature(
  body: string,
  signature: string,
  webhookUrl: string
): boolean {
  if (!process.env.SQUARE_WEBHOOK_SIGNATURE_KEY) {
    console.error('SQUARE_WEBHOOK_SIGNATURE_KEY not configured');
    return false;
  }

  const stringToSign = webhookUrl + body;
  const hmac = crypto.createHmac('sha256', process.env.SQUARE_WEBHOOK_SIGNATURE_KEY);
  hmac.update(stringToSign);
  const expectedSignature = hmac.digest('base64');

  return expectedSignature === signature;
}

// Function to get Square order details by ID
export async function getSquareOrderById(orderId: string): Promise<SquareOrder | null> {
  try {
    const response = await squareClient.orders.get({
      orderId
    });
    
    if (response.result.order) {
      // Handle BigInt serialization
      const order = JSON.parse(JSON.stringify(response.result.order, (key, value) => 
        typeof value === 'bigint' ? value.toString() : value
      ));
      
      console.log('Square API Response:', JSON.stringify(order, null, 2));
      return order;
    }
    
    return null;
  } catch (error) {
    console.error('Error fetching Square order:', error);
    return null;
  }
}

// Function to validate if order should be processed (only COMPLETED orders)
export function isValidOrder(order: SquareOrder): boolean {
  return order.state === 'COMPLETED';
}

// Function to process Square webhook events
export async function processSquareWebhook(events: SquareWebhookEvent[]): Promise<SquareOrder[]> {
  const processedOrders: SquareOrder[] = [];

  for (const event of events) {
    if (['order.created', 'order.updated'].includes(event.type)) {
      const orderId = event.data?.id || event.data?.object?.id;
      
      if (!orderId) {
        console.error('Order ID not found in event:', event);
        continue;
      }

      console.log('Processing order ID:', orderId);

      try {
        const order = await getSquareOrderById(orderId);
        
        if (order && isValidOrder(order)) {
          console.log(`Order ${orderId} is valid and completed`);
          processedOrders.push(order);
        } else {
          console.log(`Order ${orderId} is not valid or not completed`);
        }
      } catch (error) {
        console.error(`Error processing order ${orderId}:`, error);
      }
    }
  }

  return processedOrders;
}