// =================================================================
// ONLINE ORDER SERVICE - Business logic for online order processing
// =================================================================

import squareClient from "../config/square-client";
import { supabase } from "../config/supabase-client";
import { OnlineOrderModel } from "../models/OnlineOrderModel";
import { logger } from "../utils/logger";
// import { v4 as uuidv4 } from "uuid";

interface OrderResult {
  success: boolean;
  order?: any;
  error?: string;
  errors?: string[];
}

export class OnlineOrderService {
  private static async processPayment(
    paymentToken: string,
    orderId: string,
    amount: number,
    idempotencyKey: string,
    customerId?: string,
    verificationToken?: string
  ): Promise<{ success: boolean; paymentId?: string; error?: string }> {
    try {
      logger.info("💳 Processing payment...", {
        orderId,
        amount,
        customerId,
      });

      const paymentRequest: any = {
        idempotencyKey: `${idempotencyKey}-payment`,
        sourceId: paymentToken,
        amountMoney: {
          amount: BigInt(amount), // En centavos
          currency: "USD",
        },
        orderId: orderId,
        customerId: customerId,
        locationId: "LWYT37RKZNR7Y",
        autocomplete: true,
      };

      // Agregar verification token si existe (para 3D Secure)
      if (verificationToken) {
        paymentRequest.verificationToken = verificationToken;
      }

      const response = await squareClient.payments.create(paymentRequest);

      if (!response.payment) {
        logger.error("❌ Payment failed:", response.errors);
        return {
          success: false,
          error: response.errors?.[0]?.detail || "Payment failed",
        };
      }

      logger.info("✅ Payment successful:", {
        paymentId: response.payment.id,
        status: response.payment.status,
      });

      return {
        success: true,
        paymentId: response.payment.id,
      };
    } catch (error) {
      logger.error("❌ Payment processing error:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Payment failed",
      };
    }
  }

  static async createOnlineOrder(orderData: any): Promise<OrderResult> {
    // const idempotencykey = crypto.randomUUID();

    try {
      logger.info("Processing new online order...", {
        userEmail: orderData.userInfo?.email,
        items: orderData.validatedTicket?.items?.length || 0,
      });

      //step 1: VAlidate order data
      const validation = OnlineOrderModel.validateOnlineOrder(orderData);
      if (!validation.isValid) {
        logger.warn("Order validation failed", { errors: validation.errors });
        return {
          success: false,
          error: "Invalid order data",
          errors: validation.errors,
        };
      }

      //step 2: Format order for Square
      const squareOrderData = OnlineOrderModel.formatOrderForSquare(orderData);
      logger.debug("Formatted order for Square", { squareOrderData });

      //step 3: Create order in Square
      logger.info("Creating order in Square...");
      const squareResponse = await squareClient.orders.create({
        idempotencyKey: orderData.idempotencyKeyValue,
        order: squareOrderData,
      });

      if (!squareResponse.order) {
        logger.error("Failed to create order in Square", {
          errors: squareResponse.errors,
        });
        return {
          success: false,
          error: "Failed to create order in Square",
        };
      }

      logger.info("Order created in Square", {
        orderId: squareResponse.order.id,
      });

      //step 4: Process payment
      if (!orderData.paymentToken) {
        logger.error("❌ Missing payment token");
        return {
          success: false,
          error: "Payment token is required",
        };
      }

      const paymentResult = await this.processPayment(
        orderData.paymentToken,
        squareResponse.order.id,
        orderData.validatedTicket.total, // Total en centavos
        orderData.idempotencyKeyValue,
        orderData.userInfo.squareCustomerId,
        orderData.verificationToken
      );

      if (!paymentResult.success) {
        logger.error("❌ Payment failed, canceling order...");

        // Cancelar la orden en Square
        try {
          await squareClient.orders.update({
            orderId: squareResponse.order.id,
            order: {
              version: squareResponse.order.version,
              state: "CANCELED",
              locationId: "LWYT37RKZNR7Y",
            },
          });
        } catch (cancelError) {
          logger.error("Failed to cancel order:", cancelError);
        }

        return {
          success: false,
          error: paymentResult.error || "Payment processing failed",
        };
      }

      logger.info("✅ Payment processed successfully");

      //step 5: Format order for Supabase
      const dbOrderData = OnlineOrderModel.formatOrderForDatabase(
        orderData,
        squareResponse.order,
        orderData.idempotencyKeyValue
      );

      dbOrderData.squarePaymentId = paymentResult.paymentId;

      //step 6: Insert into Supabase
      logger.info("Inserting order into Supabase...");
      const { data: dbOrder, error: orderError } = await supabase
        .from("Order")
        .insert([dbOrderData])
        .select()
        .single();

      if (orderError || !dbOrder) {
        logger.error("Failed to insert order into Supabase", {
          error: orderError,
        });
        return {
          success: false,
          error: "Failed to insert order into Supabase",
        };
      }

      logger.info("Order inserted into Supabase", { orderId: dbOrder.id });

      // step 7: Save order Items
      const dbItems = OnlineOrderModel.formatOrderItemsForDatabase(
        orderData,
        dbOrder.id
      );
      const { data: saveItems, error: itemsError } = await supabase
        .from("OrderItem")
        .insert(dbItems)
        .select();

      if (itemsError || !saveItems) {
        logger.error("Failed to insert order items into Supabase", {
          error: itemsError,
        });
        return {
          success: false,
          error: "Failed to insert order items into Supabase",
        };
      }

      logger.info("Order items inserted into Supabase", {
        orderId: dbOrder.id,
      });

      // step 8: Save modifiers for each item
      for (let i = 0; i < orderData.cartItems.length; i++) {
        const cartItem = orderData.cartItems[i];
        const dbItem = saveItems[i];

        if (
          cartItem.selectedModifiers &&
          cartItem.selectedModifiers.length > 0
        ) {
          const modifiers = OnlineOrderModel.formatModifiersForDatabase(
            cartItem,
            dbItem.id
          );

          const { error: modError } = await supabase
            .from("Modifier")
            .insert(modifiers);

          if (modError) {
            logger.warn("⚠️ Failed to save modifiers for item:", {
              itemId: dbItem.id,
              error: modError,
            });
          }
        }
      }

      // Step 9: Fetch complete order with items and modifiers
      const { data: completeOrder, error: fetchError } = await supabase
        .from("Order")
        .select(
          `
            *,
            user:userId (*),
            items:OrderItem (
              *,
              modifiers:Modifier (*)
            )
          `
        )
        .eq("id", dbOrder.id)
        .single();

      if (fetchError || !completeOrder) {
        logger.error("❌ Failed to fetch complete order:", fetchError);
        return {
          success: false,
          error: "Failed to fetch complete order",
        };
      }

      // Step 10: Format for admin display
      const adminOrder = OnlineOrderModel.formatOrderForAdmin(
        completeOrder,
        completeOrder.items
      );

      logger.info("✅ Online order created successfully:", {
        orderId: dbOrder.id,
        squareOrderId: squareResponse.order.id,
        total: orderData.totals.total,
      });

      return {
        success: true,
        order: adminOrder,
      };
    } catch (error) {
      logger.error("Unexpected error in createOnlineOrder", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected error occurred",
      };
    }
  }

  static async updateOrderStatus(
    orderId: string,
    fulfillmentState: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      logger.info(
        `Updating order ${orderId} status to 
  ${fulfillmentState}...`,
        {
          orderId,
          fulfillmentState,
        }
      );

      // 1. Obtener datos de Supabase (rápido)
      const { data: order, error: fetchError } = await supabase
        .from("Order")
        .select("squareOrderId, fulfillmentUid, squareVersion")
        .eq("squareOrderId", orderId)
        .single();

      if (fetchError || !order?.squareOrderId) {
        logger.error("Order not found in Supabase", {
          orderId,
          error: fetchError,
        });
        return { success: false, error: "Order not found" };
      }

      // 2. Si falta fulfillmentUid o version, consultar Square
      let fulfillmentUid = order.fulfillmentUid;
      let version = order.squareVersion;

      if (!fulfillmentUid || !version) {
        logger.info("Missing data in Supabase, fetching from Square", {
          orderId,
          squareOrderId: order.squareOrderId,
        });

        const { order: squareOrder } = await squareClient.orders.get({
          orderId: order.squareOrderId,
        });

        fulfillmentUid = squareOrder?.fulfillments?.[0]?.uid;
        version = squareOrder?.version;

        if (!fulfillmentUid || !version) {
          logger.error("Missing fulfillment data from Square", { orderId });
          return { success: false, error: "Missing fulfillment data" };
        }

        logger.info("Retrieved missing data from Square", {
          orderId,
          fulfillmentUid,
          version,
        });
      }

      // 3. Intentar actualizar con versión de Supabase
      try {
        logger.info("Attempting to update order in Square", {
          squareOrderId: order.squareOrderId,
          fulfillmentUid,
          version,
        });

        const response = await squareClient.orders.update({
          orderId: order.squareOrderId,
          order: {
            version: version,
            fulfillments: [
              {
                uid: fulfillmentUid,
                state: fulfillmentState as any,
              },
            ],
            locationId: "LWYT37RKZNR7Y",
          },
        });

        if (!response.order) {
          logger.error("Square API returned no order", { response });
          return { success: false, error: "Failed to update order in  Square" };
        }

        logger.info("Order updated in Square successfully", {
          orderId,
          newVersion: response.order.version,
        });

        // 4. Actualizar versión en Supabase
        const { error: updateError } = await supabase
          .from("Order")
          .update({
            squareVersion: response.order.version,
            fulfillmentUid: fulfillmentUid, // Por si faltaba
            orderStatus: this.mapSquareStateToOrderStatus(fulfillmentState),
          })
          .eq("squareOrderId", orderId);

        if (updateError) {
          logger.warn("Failed to update version in Supabase", {
            orderId,
            error: updateError,
          });
          // No retornar error, Square ya se actualizó
        }

        return { success: true };
      } catch (updateError: any) {
        // 5. Si falla por versión incorrecta, reintentar con versión  actual
        if (
          updateError.errors?.some(
            (e: any) =>
              e.code === "CONFLICT" ||
              e.code === "VERSION_MISMATCH" ||
              e.category === "INVALID_REQUEST_ERROR"
          )
        ) {
          logger.warn(
            "Version conflict detected, fetching current  version from Square",
            {
              orderId,
              error: updateError.errors,
            }
          );

          // Obtener versión actual de Square
          const { order: currentOrder } = await squareClient.orders.get({
            orderId: order.squareOrderId,
          });

          if (!currentOrder || !currentOrder.version) {
            logger.error("Failed to retrieve current order from Square", {
              orderId,
            });
            return {
              success: false,
              error: "Failed to retrieve order from Square",
            };
          }

          logger.info("Retrying update with current version from Square", {
            orderId,
            currentVersion: currentOrder.version,
          });

          // Reintentar con versión correcta
          const retryResponse = await squareClient.orders.update({
            orderId: order.squareOrderId,
            order: {
              version: currentOrder.version,
              fulfillments: [
                {
                  uid: currentOrder.fulfillments?.[0]?.uid ?? null,
                  state: fulfillmentState as any,
                },
              ],
              locationId: "LWYT37RKZNR7Y",
            },
          });

          if (!retryResponse.order) {
            logger.error("Retry failed - Square API returned no order");
            return {
              success: false,
              error: "Failed to update order after retry",
            };
          }

          logger.info("Order updated successfully after retry", {
            orderId,
            newVersion: retryResponse.order.version,
          });

          // Actualizar Supabase con datos correctos
          await supabase
            .from("Order")
            .update({
              squareVersion: retryResponse.order.version,
              fulfillmentUid: currentOrder.fulfillments?.[0]?.uid,
              orderStatus: this.mapSquareStateToOrderStatus(fulfillmentState),
            })
            .eq("squareOrderId", orderId);

          return { success: true };
        }

        // Si es otro error, lanzarlo
        throw updateError;
      }
    } catch (error) {
      logger.error("Unexpected error in updateOrderStatus", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
        fullError: JSON.stringify(error, Object.getOwnPropertyNames(error)),
        orderId,
        fulfillmentState,
      });
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unexpected error occurred",
      };
    }
  }

  private static mapSquareStateToOrderStatus(state: string): string {
    const stateMap: Record<string, string> = {
      PROPOSED: "Created",
      PREPARED: "Preparing",
      COMPLETED: "Ready",
      CANCELED: "Canceled",
    };
    return stateMap[state] || "Created";
  }

  static getStats(): {
    serviceName: string;
    status: string;
  } {
    return {
      serviceName: "OnlineOrderService",
      status: "active",
    };
  }
}
