import type { RequestHandler } from "express";
import type { Env } from "../../config/env.js";
import { OrderModel } from "../../db/models/Order.model.js";
import { sendNewOrderAlert } from "../../integrations/whatsapp/sendOrderAlert.js";
import { advanceLoyaltyOrderCount } from "../orders/loyaltyAdvance.js";
import { createRazorpayOrder } from "./razorpay.client.js";
import { verifyRazorpaySignature } from "./verifySignature.js";

async function findOrderByIdAndToken(orderId: string, accessToken: string) {
  const order = await OrderModel.findById(orderId);
  if (!order || order.accessToken !== accessToken) return null;
  return order;
}

export function createRazorpayOrderHandler(env: Env): RequestHandler {
  return async (req, res) => {
    const { orderId, accessToken } = req.body as { orderId?: string; accessToken?: string };
    if (!orderId || !accessToken) {
      res.status(400).json({ error: "orderId and accessToken are required" });
      return;
    }

    const order = await findOrderByIdAndToken(orderId, accessToken);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (order.payment.method !== "razorpay" || order.payment.status !== "pending") {
      res.status(400).json({ error: "Order is not awaiting a Razorpay payment" });
      return;
    }

    const razorpayOrder = await createRazorpayOrder(env, order.totals.total, order.orderNumber);
    order.payment.razorpayOrderId = razorpayOrder.id;
    await order.save();

    res.json({
      razorpayOrderId: razorpayOrder.id,
      amount: razorpayOrder.amount,
      currency: razorpayOrder.currency,
      keyId: env.RAZORPAY_KEY_ID,
    });
  };
}

export function verifyRazorpayPaymentHandler(env: Env): RequestHandler {
  return async (req, res) => {
    const { orderId, accessToken, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body as {
      orderId?: string;
      accessToken?: string;
      razorpay_order_id?: string;
      razorpay_payment_id?: string;
      razorpay_signature?: string;
    };

    if (!orderId || !accessToken || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      res.status(400).json({ error: "Missing required verification fields" });
      return;
    }

    const order = await findOrderByIdAndToken(orderId, accessToken);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    if (!env.RAZORPAY_KEY_SECRET) {
      res.status(503).json({ error: "Payment verification is not configured" });
      return;
    }
    if (order.payment.razorpayOrderId !== razorpay_order_id) {
      res.status(400).json({ error: "Razorpay order id does not match this order" });
      return;
    }

    const isValid = verifyRazorpaySignature(
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      env.RAZORPAY_KEY_SECRET
    );

    if (!isValid) {
      order.payment.status = "failed";
      await order.save();
      res.status(400).json({ error: "Payment signature verification failed" });
      return;
    }

    order.payment.status = "paid";
    order.payment.razorpayPaymentId = razorpay_payment_id;
    await order.save();

    // Loyalty order count and the new-order WhatsApp alert only fire here, after
    // genuine payment confirmation — never at order-creation time for online payment.
    if (order.userId) {
      await advanceLoyaltyOrderCount(String(order.userId));
    }
    sendNewOrderAlert(env, {
      orderNumber: order.orderNumber,
      total: order.totals.total,
      customerName: order.customer?.name ?? order.delivery.fullName,
      recipientName: order.deliveryFor === "recipient" ? order.delivery.fullName : undefined,
    }).catch((err) => console.error("[payments] new-order alert threw unexpectedly:", err));

    res.json({ order });
  };
}
