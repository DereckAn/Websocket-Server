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
  static async createOnlineOrder(orderData: any): Promise<OrderResult> {
    const idempotencykey = crypto.randomUUID();

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
        idempotencyKey: idempotencykey,
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

      //step 4: Format order for Supabase
      const dbOrderData = OnlineOrderModel.formatOrderForDatabase(
        orderData,
        squareResponse.order,
        idempotencykey
      );

      //step 5: Insert into Supabase
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

      // step 6: Save order Items
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

      // step 7 : Save modifiers for each item
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

      // Step 8: Fetch complete order with items and modifiers
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

      // Step 9: Format for admin display
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
      logger.error("Unexpected error in createOnlineOrder", { error });
      return {
        success: false,
        error: "Unexpected error occurred",
      };
    }
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
