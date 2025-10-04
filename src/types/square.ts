// =================================================================
// SQUARE TYPES - Type definitions for Square webhook integration
// =================================================================

/**
 * Square Webhook Event Types
 */
export type SquareWebhookEventType =
  | 'order.created'
  | 'order.updated'
  | 'order.fulfilled'
  | 'payment.created'
  | 'payment.updated'
  | 'test';

/**
 * Square Order State
 */
export type SquareOrderState =
  | 'OPEN'
  | 'COMPLETED'
  | 'CANCELED'
  | 'DRAFT'
  | 'PENDING';

/**
 * Square Money representation
 */
export interface SquareMoney {
  amount: bigint;
  currency: string;
}

/**
 * Square Line Item
 */
export interface SquareLineItem {
  uid?: string;
  name?: string;
  quantity?: string;
  catalogObjectId?: string;
  variationName?: string;
  note?: string;
  basePrice?: SquareMoney;
  totalMoney?: SquareMoney;
  modifiers?: SquareOrderLineItemModifier[];
}

/**
 * Square Line Item Modifier
 */
export interface SquareOrderLineItemModifier {
  uid?: string;
  name?: string;
  basePrice?: SquareMoney;
  totalMoney?: SquareMoney;
}

/**
 * Square Order (raw from API)
 */
export interface SquareOrder {
  id?: string;
  locationId?: string;
  orderNumber?: string;
  referenceId?: string;
  source?: {
    name?: string;
  };
  customerId?: string;
  lineItems?: SquareLineItem[];
  taxes?: any[];
  discounts?: any[];
  serviceCharges?: any[];
  fulfillments?: any[];
  returns?: any[];
  returnAmounts?: any;
  netAmounts?: any;
  roundingAdjustment?: any;
  tenders?: any[];
  refunds?: any[];
  metadata?: Record<string, string>;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  state?: SquareOrderState;
  version?: number;
  totalMoney?: SquareMoney;
  totalTaxMoney?: SquareMoney;
  totalDiscountMoney?: SquareMoney;
  totalTipMoney?: SquareMoney;
  totalServiceChargeMoney?: SquareMoney;
  ticketName?: string;
  pricingOptions?: any;
  rewards?: any[];
}

/**
 * Square Webhook Event
 */
export interface SquareWebhookEvent {
  merchant_id?: string;
  type?: SquareWebhookEventType;
  event_id?: string;
  created_at?: string;
  data?: {
    type?: string;
    id?: string;
    object?: SquareOrder;
  };
}

/**
 * Formatted Order for Display (processed)
 */
export interface FormattedOrder {
  id: string;
  orderNumber: string | undefined;
  state: SquareOrderState;
  createdAt: string;
  updatedAt: string | undefined;
  totalAmount: {
    amount: number; // Converted from bigint
    currency: string;
    formatted: string; // e.g., "$12.50"
  };
  itemCount: number;
  items: FormattedLineItem[];
  source: string | undefined;
  customerId: string | undefined;
  locationId: string | undefined;
}

/**
 * Formatted Line Item for Display
 */
export interface FormattedLineItem {
  name: string;
  quantity: number;
  price: {
    amount: number;
    currency: string;
    formatted: string;
  };
  modifiers: string[] | undefined;
  note: string | undefined;
}

/**
 * Admin WebSocket Connection
 */
export interface AdminConnection {
  ws: any; // WebSocket instance (Bun WebSocket)
  clientId: string;
  connectedAt: Date;
  lastPing?: Date;
  isAlive: boolean;
}

/**
 * Admin WebSocket Message Types
 */
export type AdminWSMessageType =
  | 'connected'
  | 'disconnected'
  | 'new-order'
  | 'order-updated'
  | 'test-event'
  | 'ping'
  | 'pong'
  | 'error'
  | 'admin-connect'
  | 'stats';

/**
 * Admin WebSocket Message Structure
 */
export interface AdminWSMessage {
  type: AdminWSMessageType;
  data?: any;
  message?: string;
  timestamp: string;
  clientId?: string;
}

/**
 * Square Webhook Verification
 */
export interface WebhookVerification {
  isValid: boolean;
  signature: string | undefined;
  expectedSignature: string | undefined;
  error: string | undefined;
}

/**
 * Square Service Statistics
 */
export interface SquareServiceStats {
  webhooksProcessed: number;
  ordersProcessed: number;
  lastWebhookAt?: string;
  lastOrderAt?: string;
  adminConnections: number;
  uptime: number;
  errors: {
    webhookVerificationErrors: number;
    processingErrors: number;
    lastError?: string;
  };
}

/**
 * Order Processing Result
 */
export interface OrderProcessingResult {
  success: boolean;
  order: SquareOrder | undefined;
  error: string | undefined;
  eventType: SquareWebhookEventType | undefined;
}

/**
 * Webhook Processing Request
 */
export interface WebhookRequest {
  signature: string;
  body: string;
  webhookUrl: string;
}

/**
 * Webhook Processing Response
 */
export interface WebhookResponse {
  success: boolean;
  processedOrders: number;
  events: OrderProcessingResult[];
  error?: string;
}

// =================================================================
// LEGACY TYPE COMPATIBILITY
// =================================================================

/**
 * Legacy WebSocketMessage type for backward compatibility
 */
export type WebSocketMessage = AdminWSMessage;