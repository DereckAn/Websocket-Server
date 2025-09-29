// Utility functions for the webhook server

export function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function log(level: 'debug' | 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logLevel = process.env.LOG_LEVEL || 'info';
  
  const levels = { debug: 0, info: 1, warn: 2, error: 3 };
  
  if (levels[level] >= levels[logLevel as keyof typeof levels]) {
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
    
    if (data) {
      console.log(`${prefix} ${message}`, data);
    } else {
      console.log(`${prefix} ${message}`);
    }
  }
}

export function handleBigIntSerialization(key: string, value: any): any {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  return value;
}

export function createCorsHeaders(origin?: string) {
  return {
    'Access-Control-Allow-Origin': origin || process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-square-hmacsha256-signature',
    'Content-Type': 'application/json'
  };
}

export function validateEnvironmentVariables(): boolean {
  const required = [
    'SQUARE_ACCESS_TOKEN',
    'SQUARE_WEBHOOK_SIGNATURE_KEY',
    'SQUARE_APPLICATION_ID'
  ];
  
  const missing = required.filter(env => !process.env[env]);
  
  if (missing.length > 0) {
    log('error', 'Missing required environment variables:', missing);
    return false;
  }
  
  return true;
}

export function formatOrderForDisplay(order: any): any {
  return {
    id: order.id,
    state: order.state,
    locationId: order.locationId,
    lineItems: order.lineItems?.map((item: any) => ({
      name: item.name,
      variationName: item.variationName,
      quantity: item.quantity,
      totalMoney: {
        amount: typeof item.totalMoney?.amount === 'bigint' 
          ? item.totalMoney.amount.toString() 
          : item.totalMoney?.amount,
        currency: item.totalMoney?.currency
      }
    })),
    totalMoney: {
      amount: typeof order.totalMoney?.amount === 'bigint' 
        ? order.totalMoney.amount.toString() 
        : order.totalMoney?.amount,
      currency: order.totalMoney?.currency
    },
    createdAt: order.createdAt,
    closedAt: order.closedAt,
    tenders: order.tenders?.map((tender: any) => ({
      type: tender.type,
      amountMoney: {
        amount: typeof tender.amountMoney?.amount === 'bigint' 
          ? tender.amountMoney.amount.toString() 
          : tender.amountMoney?.amount,
        currency: tender.amountMoney?.currency
      },
      cardDetails: tender.cardDetails
    }))
  };
}