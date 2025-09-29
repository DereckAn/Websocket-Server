// =================================================================
// ORDER MODEL - Pure business logic for Square orders
// =================================================================

import type {
  SquareOrder,
  FormattedOrder,
  FormattedLineItem,
  SquareMoney,
  SquareLineItem,
  SquareOrderState
} from '../types/square';

/**
 * OrderModel - Pure functions for order processing
 *
 * Why pure functions?
 * - Predictable and testable
 * - No side effects or external dependencies
 * - Easy to reason about and debug
 * - Reusable across different contexts
 */
export class OrderModel {

  /**
   * Formats a raw Square order for display
   */
  static formatOrderForDisplay(order: SquareOrder): FormattedOrder {
    const totalAmount = this.formatMoney(order.totalMoney);
    const items = this.formatLineItems(order.lineItems || []);

    return {
      id: order.id || 'unknown',
      orderNumber: order.orderNumber,
      state: order.state || 'OPEN',
      createdAt: order.createdAt || new Date().toISOString(),
      updatedAt: order.updatedAt,
      totalAmount,
      itemCount: items.length,
      items,
      source: order.source?.name,
      customerId: order.customerId,
      locationId: order.locationId
    };
  }

  /**
   * Formats Square money to display format
   */
  static formatMoney(money?: SquareMoney): {
    amount: number;
    currency: string;
    formatted: string;
  } {
    if (!money) {
      return {
        amount: 0,
        currency: 'USD',
        formatted: '$0.00'
      };
    }

    const amount = Number(money.amount) / 100; // Square uses cents
    const currency = money.currency || 'USD';

    const formatted = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount);

    return {
      amount,
      currency,
      formatted
    };
  }

  /**
   * Formats line items for display
   */
  static formatLineItems(lineItems: SquareLineItem[]): FormattedLineItem[] {
    return lineItems.map(item => this.formatLineItem(item));
  }

  /**
   * Formats a single line item
   */
  static formatLineItem(item: SquareLineItem): FormattedLineItem {
    const price = this.formatMoney(item.totalMoney || item.basePrice);
    const quantity = parseInt(item.quantity || '1');

    const modifiers = item.modifiers?.map(mod => mod.name || 'Unknown modifier') || [];

    return {
      name: item.name || item.variationName || 'Unknown item',
      quantity,
      price,
      modifiers: modifiers.length > 0 ? modifiers : undefined,
      note: item.note
    };
  }

  /**
   * Validates if an order is valid for processing
   */
  static validateOrder(order: SquareOrder): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!order.id) {
      errors.push('Order ID is required');
    }

    if (!order.state) {
      errors.push('Order state is required');
    }

    if (!order.lineItems || order.lineItems.length === 0) {
      errors.push('Order must have at least one line item');
    }

    // Validate line items
    order.lineItems?.forEach((item, index) => {
      if (!item.name && !item.variationName) {
        errors.push(`Line item ${index + 1} is missing name`);
      }

      if (!item.quantity || parseInt(item.quantity) <= 0) {
        errors.push(`Line item ${index + 1} has invalid quantity`);
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Extracts key information for logging
   */
  static extractOrderSummary(order: SquareOrder): {
    id: string;
    state: SquareOrderState;
    itemCount: number;
    totalAmount: string;
    createdAt: string;
  } {
    const totalAmount = this.formatMoney(order.totalMoney);

    return {
      id: order.id || 'unknown',
      state: order.state || 'OPEN',
      itemCount: order.lineItems?.length || 0,
      totalAmount: totalAmount.formatted,
      createdAt: order.createdAt || new Date().toISOString()
    };
  }

  /**
   * Determines if an order state change is significant
   */
  static isSignificantStateChange(
    previousState?: SquareOrderState,
    newState?: SquareOrderState
  ): boolean {
    if (!previousState || !newState) return true;

    // Significant changes that should trigger notifications
    const significantTransitions = [
      'OPEN -> COMPLETED',
      'OPEN -> CANCELED',
      'PENDING -> COMPLETED',
      'PENDING -> CANCELED'
    ];

    const transition = `${previousState} -> ${newState}`;
    return significantTransitions.includes(transition);
  }

  /**
   * Calculates order metrics for analytics
   */
  static calculateOrderMetrics(order: SquareOrder): {
    revenue: number;
    itemCount: number;
    averageItemPrice: number;
    hasModifiers: boolean;
    hasDiscounts: boolean;
    orderComplexity: 'simple' | 'moderate' | 'complex';
  } {
    const totalAmount = this.formatMoney(order.totalMoney);
    const itemCount = order.lineItems?.length || 0;
    const averageItemPrice = itemCount > 0 ? totalAmount.amount / itemCount : 0;

    const hasModifiers = order.lineItems?.some(item =>
      item.modifiers && item.modifiers.length > 0
    ) || false;

    const hasDiscounts = (order.discounts?.length || 0) > 0;

    // Determine complexity
    let orderComplexity: 'simple' | 'moderate' | 'complex' = 'simple';
    if (itemCount > 5 || hasModifiers || hasDiscounts) {
      orderComplexity = itemCount > 10 ? 'complex' : 'moderate';
    }

    return {
      revenue: totalAmount.amount,
      itemCount,
      averageItemPrice,
      hasModifiers,
      hasDiscounts,
      orderComplexity
    };
  }

  /**
   * Sanitizes order data for safe logging
   */
  static sanitizeOrderForLogging(order: SquareOrder): any {
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      state: order.state,
      itemCount: order.lineItems?.length || 0,
      totalAmount: this.formatMoney(order.totalMoney).formatted,
      createdAt: order.createdAt,
      locationId: order.locationId,
      source: order.source?.name,
      // Remove sensitive data
      customerId: order.customerId ? '***' : undefined,
      metadata: Object.keys(order.metadata || {}).length
    };
  }

  /**
   * Handles BigInt serialization for JSON responses
   */
  static handleBigIntSerialization(obj: any): any {
    return JSON.parse(JSON.stringify(obj, (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value;
    }));
  }

  /**
   * Validates order ID format
   */
  static isValidOrderId(orderId: string): boolean {
    // Square order IDs are typically alphanumeric with underscores and dashes
    return /^[a-zA-Z0-9_-]+$/.test(orderId) && orderId.length > 0;
  }

  /**
   * Extracts customer information safely
   */
  static extractCustomerInfo(order: SquareOrder): {
    hasCustomer: boolean;
    customerId: string | undefined;
    isReturningCustomer: boolean;
  } {
    const hasCustomer = !!order.customerId;

    return {
      hasCustomer,
      customerId: hasCustomer ? order.customerId : undefined,
      isReturningCustomer: hasCustomer // Could be enhanced with actual customer lookup
    };
  }
}