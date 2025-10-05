// =================================================================
// ONLINE ORDER MODEL - Pure business logic for online orders
// =================================================================

/**
 * OnlineOrderModel - Pure functions for online order processing
 *
 * Responsibilities:
 * - Validate incoming order data from @pag_mich/
 * - Format order data for Square API
 * - Format order data for Supabase database
 * - Format order data for @admin_mich/ display
 */

export class OnlineOrderModel {
  static validateOnlineOrder(orderData: any): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!orderData.userInfo) {
      errors.push("Missing userInfo");
    } else {
      if (!orderData.userInfo.name) errors.push("Missing userInfo.name");
      if (!orderData.userInfo.email) errors.push("Missing userInfo.email");
      if (!orderData.userInfo.address) errors.push("Missing userInfo.address");
    }

    if (
      !orderData.validatedTicket?.items ||
      orderData.validatedTicket.items.length === 0
    ) {
      errors.push("No items in the order");
    }

    //validate totals
    if (
      !orderData.validatedTicket?.totals ||
      orderData.validatedTicket.totals.length <= 0
    ) {
      errors.push("Missing validatedTicket.totals");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Formats order data for Square API request
   */
  static formatOrderForSquare(orderData: any): any {
    const handoffTime = orderData.handoffDetails.isAsap
      ? new Date(Date.now() + 15 * 60000).toISOString() // ASAP = 15 min from now
      : new Date(
          `${orderData.handoffDetails.date} ${orderData.handoffDetails.time}`
        ).toISOString();

    return {
      locationId: "LWYT37RKZNR7Y",
      source: {
        name: "Online Order - hausbrock.com",
      },
      customerId: orderData.userInfo.squareCustomerId || undefined,
      lineItems: orderData.validatedTicket.items.map((item: any) => ({
        catalogObjectId: item.variationId,
        quantity: item.quantity.toString(),
        itemType: "ITEM",
        basePriceMoney: {
          amount: BigInt(item.basePrice),
          currency: "USD",
        },
        modifiers:
          item.modifierIds?.map((modId: string) => ({
            catalogObjectId: modId,
            quantity: "1",
          })) || [],
      })),
      fulfillments: [
        {
          type:
            orderData.handoffDetails.type === "pickup" ? "PICKUP" : "SHIPMENT",
          state: "PROPOSED",
          ...(orderData.handoffDetails.type === "pickup"
            ? {
                pickupDetails: {
                  recipient: {
                    customerId: orderData.userInfo.squareCustomerId,
                    displayName: `${orderData.userInfo.name}   ${orderData.userInfo.lastname}`,
                    emailAddress: orderData.userInfo.email,
                    phoneNumber: orderData.userInfo.phone,
                  },
                  scheduleType: orderData.handoffDetails.isAsap
                    ? "ASAP"
                    : "SCHEDULED",
                  pickupAt: handoffTime,
                  note: orderData.handoffDetails.notes || undefined,
                },
              }
            : {
                shipmentDetails: {
                  recipient: {
                    displayName: `${orderData.userInfo.name} ${orderData.userInfo.lastname}`,
                    emailAddress: orderData.userInfo.email,
                    phoneNumber: orderData.userInfo.phone,
                    address: {
                      addressLine1: orderData.handoffDetails.address?.street,
                      locality: orderData.handoffDetails.address?.city,
                      administrativeDistrictLevel1:
                        orderData.handoffDetails.address?.state,
                      postalCode: orderData.handoffDetails.address?.zipCode,
                      country: "US",
                    },
                  },
                  expectedShippedAt: handoffTime,
                },
              }),
        },
      ],
      state: "OPEN",
      ticketName: `${orderData.userInfo.name}'s Online Order`,
    };
  }

  /**
   * Formats order data for Supabase database
   */
  static formatOrderForDatabase(
    orderData: any,
    squareOrder: any,
    idempotencyKey: string
  ): any {
    const handoffTime = orderData.handoffDetails.isAsap
      ? new Date(Date.now() + 15 * 60000).toISOString()
      : new Date(
          `${orderData.handoffDetails.date} ${orderData.handoffDetails.time}`
        ).toISOString();

    return {
      idempotencyKey: idempotencyKey,
      userId: orderData.userInfo.id || null,
      squareOrderId: squareOrder.id,
      totalPrice: orderData.validatedTicket.subtotal / 100,
      taxes: orderData.validatedTicket.taxes / 100,
      totalPrecioWithTaxes: orderData.validatedTicket.total / 100,
      handoffOption: orderData.handoffDetails.type,
      handoffAddress:
        orderData.handoffDetails.type === "delivery"
          ? `${orderData.handoffDetails.address?.street}, ${orderData.handoffDetails.address?.city}, ${orderData.handoffDetails.address?.state} ${orderData.handoffDetails.address?.zipCode}`
          : null,
      orderStatus: "Created",
      handoffTime: handoffTime,
      ticketName: `Online - ${orderData.userInfo.name} ${orderData.userInfo.lastname}`,
      squareStatus: "OPEN",
      guestName: !orderData.userInfo.id ? orderData.userInfo.name : null,
      guestLastname: !orderData.userInfo.id
        ? orderData.userInfo.lastname
        : null,
      guestEmail: !orderData.userInfo.id ? orderData.userInfo.email : null,
      guestPhone: !orderData.userInfo.id ? orderData.userInfo.phone : null,
    };
  }

  /**
   * Formats order items for Supabase database
   */
  static formatOrderItemsForDatabase(orderData: any, orderId: string): any[] {
    return orderData.cartItems.map((item: any) => ({
      orderId: orderId,
      itemId: item.id,
      itemName: item.name,
      quantity: item.quantity,
      variationId: item.variation.id,
      variationName: item.variation.name,
      basePrice: Math.round(item.basePrice * 100), // Convert to cents
      totalPrice: Math.round(item.total * 100), // Convert to cents
      categoryParentName: item.category,
    }));
  }

  /**
   * Formats order modifiers for Supabase database
   */
  static formatModifiersForDatabase(item: any, orderItemId: string): any[] {
    if (!item.selectedModifiers || item.selectedModifiers.length === 0) {
      return [];
    }

    return item.selectedModifiers.map((mod: any) => ({
      orderItemId: orderItemId,
      name: mod.name,
      price: Math.round(mod.price * 100), // Convert to cents
    }));
  }

  /**
   * Formats database order for admin display
   */
  static formatOrderForAdmin(dbOrder: any, dbItems: any[]): any {
    return {
      id: dbOrder.id,
      idempotencyKeyValue: dbOrder.idempotencyKey,
      orderStatus: dbOrder.orderStatus,
      userInfo: {
        id: dbOrder.userId,
        name: dbOrder.userId ? dbOrder.user?.name : dbOrder.guestName,
        lastname: dbOrder.userId
          ? dbOrder.user?.lastname
          : dbOrder.guestLastname,
        email: dbOrder.userId ? dbOrder.user?.email : dbOrder.guestEmail,
        phone: dbOrder.userId ? dbOrder.user?.phone : dbOrder.guestPhone,
        role: dbOrder.userId ? "USER" : "GUEST",
        squareCustomerId: dbOrder.user?.squareCustomerId,
      },
      handoffDetails: {
        option: dbOrder.handoffOption,
        address: dbOrder.handoffAddress,
        time: dbOrder.handoffTime,
      },
      officialTicket: {
        filtercart: dbItems.map((item: any) => ({
          item_id: item.itemId,
          category_parent_name: item.categoryParentName,
          item_name: item.itemName,
          quantity: item.quantity,
          variation_id: item.variationId,
          variation_name: item.variationName,
          base_price: item.basePrice,
          total_price: item.totalPrice,
          validated_modifiers:
            item.modifiers?.map((mod: any) => ({
              name: mod.name,
              price: mod.price,
            })) || [],
        })),
        totalPrecio: Math.round(dbOrder.totalPrice * 100),
        taxes: Math.round(dbOrder.taxes * 100),
        totalPrecioWithTaxes: Math.round(dbOrder.totalPrecioWithTaxes * 100),
      },
    };
  }
}
