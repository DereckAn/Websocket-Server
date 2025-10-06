// =================================================================
// ONLINE ORDER CONTROLLER - HTTP handlers for online orders
// =================================================================

import { AdminWebSocketService } from "../services/AdminWebSocketService";
import { OnlineOrderService } from "../services/OnlineOrderService";
import { logger } from "../utils/logger";
import ResponseView from "../views/ResponseView";

/**
 * OnlineOrderController - Handles HTTP requests for online orders
 *
 * Responsibilities:
 * - Parse and validate HTTP requests
 * - Call OnlineOrderService
 * - Broadcast to admin clients via WebSocket
 * - Return HTTP responses
 */

export class OnlineOrderController {
  static async handleCreateOrder(req: Request): Promise<Response> {
    try {
      logger.info("Received new online order request");

      // Parse request body
      let orderData: any;
      try {
        orderData = await req.json();
      } catch (parseError) {
        logger.warn("Invalid JSON in request body", { error: parseError });
        return ResponseView.badRequest("Invalid JSON in request body");
      }

      // validate that we have
      if (!orderData) {
        logger.warn("Missing order data in request body");
        return ResponseView.badRequest("Missing order data in request body");
      }

      // Log request info
      logger.debug("📦 Order data received:", {
        userEmail: orderData.userInfo?.email,
        items: orderData.validatedTicket?.items?.length,
        total: orderData.totals?.total,
      });

      // Create order via service
      const result = await OnlineOrderService.createOnlineOrder(orderData);

      // Handle service result
      if (!result.success) {
        logger.warn("Failed to create online order", {
          error: result.error,
          errors: result.errors,
        });
        return ResponseView.badRequest(
          result.error || "Failed to create online order",
          { errors: result.errors }
        );
      }

      // Broadcast to admin client via WebSockets
      if (result.order) {
        logger.info("Broadcasting new online order to admin clients", {
          orderId: result.order.id,
        });
        AdminWebSocketService.broadcastOnlineOrder(result.order);
      }

      // Return success response
      logger.info("Online order created successfully", {
        orderId: result.order?.id,
      });

      return ResponseView.success(
        {
          orderId: result.order?.id,
          squareOrderId: result.order?.officialTicket.squareOrderId,
          message: "Order created successfully",
        },
        "Order created successfully"
      );
    } catch (error) {
      logger.error("Unexpected error in handleCreateOrder", { error });
      return ResponseView.internalServerError("Unexpected error");
    }
  }

  static async handleUpdateOrderStatus(req: Request): Promise<Response> {
    try {
      const url = new URL(req.url);
      const orderId = url.pathname.split("/")[3]; // /api/orders/:id/status

      if (!orderId) return ResponseView.badRequest("Missing order ID in URL");

      // Parse request body
      let data: any;
      try {
        data = await req.json();
      } catch (parseError) {
        logger.warn("Invalid JSON in request body", { error: parseError });
        return ResponseView.badRequest("Invalid JSON in request body");
      }

      const { fulfillmentState } = data;
      if (!fulfillmentState)
        return ResponseView.badRequest("Missing fulfillmentState in body");

      // Validate State
      const validStates = [
        "PROPOSED",
        "RESERVED",
        "PREPARED",
        "COMPLETED",
        "CANCELED",
        "FAILED",
      ];
      if (!validStates.includes(fulfillmentState)) {
        return ResponseView.badRequest("Invalid fulfillmentState value");
      }

      logger.info("Updating order status", {
        orderId,
        newState: fulfillmentState,
      });

      // Call service
      const result = await OnlineOrderService.updateOrderStatus(
        orderId,
        fulfillmentState
      );

      if (!result.success) {
        logger.warn("Failed to update order status", { error: result.error });
        return ResponseView.badRequest(
          result.error || "Failed to update order status"
        );
      }

      logger.info("Order status updated successfully", { orderId });

      return ResponseView.success(
        {
          orderId,
          newState: fulfillmentState,
        },
        "Order status updated successfully"
      );
    } catch (error) {
      logger.error("Unexpected error in handleUpdateOrderStatus", { error });
      return ResponseView.internalServerError("Unexpected error");
    }
  }

  /**
   * Gets request information for logging
   */
  static getRequestInfo(request: Request): {
    method: string;
    path: string;
    contentLength: number;
    userAgent: string | undefined;
  } {
    const url = new URL(request.url);

    return {
      method: request.method,
      path: url.pathname,
      contentLength: parseInt(request.headers.get("content-length") || "0"),
      userAgent: request.headers.get("user-agent") ?? undefined,
    };
  }
}

export default OnlineOrderController;
