// Square webhook event types
export interface SquareWebhookEvent {
  type: string;
  data: {
    id?: string;
    object?: {
      id: string;
    };
  };
}

// Square order interface
export interface SquareOrder {
  id: string;
  state: string;
  locationId: string;
  lineItems?: Array<{
    name: string;
    variationName?: string;
    quantity: string;
    totalMoney: {
      amount: number;
      currency: string;
    };
  }>;
  totalMoney?: {
    amount: number;
    currency: string;
  };
  createdAt?: string;
  closedAt?: string;
  tenders?: Array<{
    type: string;
    amountMoney: {
      amount: number;
      currency: string;
    };
    cardDetails?: {
      status: string;
    };
  }>;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'connected' | 'new-order' | 'test-event' | 'ping' | 'error';
  data?: any;
  message?: string;
  timestamp?: string;
}

// Admin connection interface
export interface AdminConnection {
  ws: any;
  clientId: string;
  connectedAt: Date;
}

// Server configuration
export interface ServerConfig {
  webhookPort: number;
  websocketPort: number;
  corsOrigin: string;
  nodeEnv: 'development' | 'production';
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}