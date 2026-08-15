import type {
  CreateSingleMealOrderRequest,
  CreateTiffinMealPriceRequest,
  SingleMealMenuItem,
  UpdateTiffinMealPriceRequest,
} from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { TiffinMealPriceModel } from "../../db/models/TiffinMealPrice.model.js";
import { TiffinSingleMealOrderModel } from "../../db/models/TiffinSingleMealOrder.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewSingleMealOrderAlert } from "../../integrations/whatsapp/sendNewSingleMealOrderAlert.js";
import { assertWithinDeliveryZone } from "../orders/deliveryZone.js";
import { createRazorpayOrder } from "../payments/razorpay.client.js";
import { verifyRazorpaySignature } from "../payments/verifySignature.js";
import { getSingleMealDish } from "./singleMealMenu.js";
import { generateSingleMealOrderNumber } from "./singleMealOrderNumber.js";
import { TiffinValidationError } from "./tiffin.errors.js";

/** Single meals are always delivered the day after ordering, same as a fresh subscription's
 * start — there's no way to have a meal ready within minutes of ordering. */
function tomorrowIsoDate(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

const DIET_TYPES: SingleMealMenuItem["dietType"][] = ["veg", "non-veg"];

/** Two rows (veg + non-veg) per active price — the price is shared across diets, only the dish differs. */
export async function getSingleMealMenu(): Promise<SingleMealMenuItem[]> {
  const date = tomorrowIsoDate();
  const prices = await TiffinMealPriceModel.find({ active: true }).sort({ tier: 1, mealType: 1 });

  const items: SingleMealMenuItem[] = [];
  for (const price of prices) {
    const tier = price.tier as SingleMealMenuItem["tier"];
    const mealType = price.mealType as SingleMealMenuItem["mealType"];
    for (const dietType of DIET_TYPES) {
      const dishName = getSingleMealDish(tier, dietType, mealType, date);
      if (!dishName) continue;
      items.push({ tier, mealType, dietType, date, dishName, price: price.price, carbChoiceRequired: tier === "mini" });
    }
  }
  return items;
}

export async function createSingleMealOrder(env: Env, userId: string, request: CreateSingleMealOrderRequest) {
  const price = await TiffinMealPriceModel.findOne({ tier: request.tier, mealType: request.mealType, active: true });
  if (!price) {
    throw new TiffinValidationError("This meal isn't available right now");
  }
  if (request.tier === "mini" && !request.carbChoice) {
    throw new TiffinValidationError("Please choose rice or roti");
  }

  const date = tomorrowIsoDate();
  const dishName = getSingleMealDish(request.tier, request.dietType, request.mealType, date);
  if (!dishName) {
    throw new TiffinValidationError("This meal isn't available right now");
  }

  // Same zone check every TBC/TAT order and tiffin subscription already goes through.
  assertWithinDeliveryZone(request.delivery);

  const user = await UserModel.findById(userId);
  if (!user) throw new TiffinValidationError("User not found");

  const order = await TiffinSingleMealOrderModel.create({
    orderNumber: generateSingleMealOrderNumber(),
    userId,
    tier: request.tier,
    mealType: request.mealType,
    dietType: request.dietType,
    carbChoice: request.tier === "mini" ? request.carbChoice : undefined,
    date,
    dishName,
    status: "placed",
    delivery: request.delivery,
    price: price.price,
    // Charged once, upfront — same one-time Razorpay order/verify flow as subscriptions and
    // regular orders, not a separate API. COD is trusted immediately; razorpay only becomes
    // "paid" after signature verification succeeds.
    payment: { method: request.paymentMethod, status: "pending" },
  });

  if (request.paymentMethod === "cod") {
    sendNewSingleMealOrderAlert(env, {
      orderNumber: order.orderNumber,
      customerName: user.fullName,
      dishName: order.dishName,
    }).catch((err) => console.error("[tiffin] new-single-meal-order alert threw unexpectedly:", err));
  }
  // razorpay orders: the WhatsApp alert fires only in verifySingleMealRazorpayPayment, after
  // signature verification succeeds — same pattern as tiffin.service.ts's subscription flow.

  return order;
}

async function findOwnedOrder(userId: string, orderId: string) {
  const order = await TiffinSingleMealOrderModel.findOne({ _id: orderId, userId });
  if (!order) throw new TiffinValidationError("Order not found");
  return order;
}

export async function createSingleMealRazorpayOrder(env: Env, userId: string, orderId: string) {
  const order = await findOwnedOrder(userId, orderId);
  if (order.payment.method !== "razorpay" || order.payment.status !== "pending") {
    throw new TiffinValidationError("This order is not awaiting a Razorpay payment");
  }

  const razorpayOrder = await createRazorpayOrder(env, order.price, order.orderNumber);
  order.payment.razorpayOrderId = razorpayOrder.id;
  await order.save();

  return {
    razorpayOrderId: razorpayOrder.id,
    amount: razorpayOrder.amount,
    currency: razorpayOrder.currency,
    keyId: env.RAZORPAY_KEY_ID,
  };
}

export async function verifySingleMealRazorpayPayment(
  env: Env,
  userId: string,
  orderId: string,
  params: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }
) {
  const order = await findOwnedOrder(userId, orderId);
  if (!env.RAZORPAY_KEY_SECRET) {
    throw new TiffinValidationError("Payment verification is not configured");
  }
  if (order.payment.razorpayOrderId !== params.razorpay_order_id) {
    throw new TiffinValidationError("Razorpay order id does not match this order");
  }

  const isValid = verifyRazorpaySignature(
    params.razorpay_order_id,
    params.razorpay_payment_id,
    params.razorpay_signature,
    env.RAZORPAY_KEY_SECRET
  );

  if (!isValid) {
    order.payment.status = "failed";
    await order.save();
    throw new TiffinValidationError("Payment signature verification failed");
  }

  order.payment.status = "paid";
  order.payment.razorpayPaymentId = params.razorpay_payment_id;
  await order.save();

  const user = await UserModel.findById(userId);
  sendNewSingleMealOrderAlert(env, {
    orderNumber: order.orderNumber,
    customerName: user?.fullName ?? order.delivery.fullName,
    dishName: order.dishName,
  }).catch((err) => console.error("[tiffin] new-single-meal-order alert threw unexpectedly:", err));

  return order;
}

export function listMySingleMealOrders(userId: string) {
  return TiffinSingleMealOrderModel.find({ userId }).sort({ createdAt: -1 });
}

// --- Admin-only ---

/** Scoped to today, same as listTodaysScheduledMeals — a single-meal order is always placed for
 * "tomorrow" delivery, so by the time it needs prepping it's today's order. */
export function listTodaysSingleMealOrders() {
  const today = new Date().toISOString().slice(0, 10);
  return TiffinSingleMealOrderModel.find({ date: today }).sort({ dishName: 1 });
}

export async function updateSingleMealOrderStatus(orderId: string, status: string) {
  const order = await TiffinSingleMealOrderModel.findByIdAndUpdate(orderId, { status }, { new: true });
  if (!order) throw new TiffinValidationError("Order not found");
  return order;
}

export function listMealPrices() {
  return TiffinMealPriceModel.find().sort({ tier: 1, mealType: 1 });
}

export function createMealPrice(data: CreateTiffinMealPriceRequest) {
  return TiffinMealPriceModel.create(data);
}

export async function updateMealPrice(id: string, data: UpdateTiffinMealPriceRequest) {
  const price = await TiffinMealPriceModel.findByIdAndUpdate(id, data, { new: true });
  if (!price) throw new TiffinValidationError("Meal price not found");
  return price;
}
