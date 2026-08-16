import {
  SINGLE_MEAL_CANCELLATION_WINDOW_MINUTES,
  type CreateSingleMealOrderRequest,
  type CreateTiffinMealPriceRequest,
  type DeliveryPartner,
  type SingleMealMenuItem,
  type TiffinSingleMealOrderStatus,
  type UpdateTiffinMealPriceRequest,
} from "@tbc/shared-types";
import type { Env } from "../../config/env.js";
import { TiffinMealPriceModel } from "../../db/models/TiffinMealPrice.model.js";
import { TiffinSingleMealOrderModel } from "../../db/models/TiffinSingleMealOrder.model.js";
import { UserModel } from "../../db/models/User.model.js";
import { sendNewSingleMealOrderAlert } from "../../integrations/whatsapp/sendNewSingleMealOrderAlert.js";
import { assertWithinDeliveryZone } from "../orders/deliveryZone.js";
import { createRazorpayOrder } from "../payments/razorpay.client.js";
import { verifyRazorpaySignature } from "../payments/verifySignature.js";
import { getSingleMealDish, resolveAddOns } from "./singleMealMenu.js";
import { resolveSingleMealTargetDate, todayIsoInIst } from "./mealOrderingWindow.js";
import { generateSingleMealOrderNumber } from "./singleMealOrderNumber.js";
import { TiffinValidationError } from "./tiffin.errors.js";

const DIET_TYPES: SingleMealMenuItem["dietType"][] = ["veg", "non-veg"];

/** Real dish photography (served from public/tiffin-images/, same static route the plan-card
 * photos use), keyed by the bare dish name — shared by Regular and Premium, which serve the same
 * sabzi/curry. Mini gets its own distinct photos below (different box/portioning), checked first. */
const DISH_IMAGE_SLUGS: Record<string, string> = {
  "Masala Pasta": "masala-pasta",
  Sandwich: "sandwich",
  "Aloo Paratha with Curd & Achar": "aloo-paratha-with-dahi-and-achar",
  Poha: "poha",
  "Sattu Paratha with Curd & Achar": "sattu-paratha-with-dahi-and-achar",
  "Puri with Chole & Achar": "puri-chola",
  "Puri with Chole": "puri-chola",
  "Idli / Dosa with Sambar & Chutney": "idli-with-sambar-and-chutney",
  "Bread Omelette": "bread-omelete",
  "Aloo Matar": "aloo-matar",
  "Aloo Gobhi": "aloo-gobhi",
  "Aloo Soyabean": "aloo-soyabean",
  "Dum Aloo": "dum-aloo",
  "Matar Paneer": "matar-paneer",
  "Mushroom Masala": "mushroom-masala",
  Rajma: "rajma",
  "Matar Mushroom": "matar-mushroom",
  "Fish Curry": "fish-curry",
  "Egg Curry": "egg-curry",
  "Mutton Curry": "mutton-and-pulao",
  "Paneer Butter Masala": "paneer-butter-masala-and-pulao",
};

/** Mini's own photos (smaller box, single carb) — checked before the shared table above. Not
 * every Mini dish has a dedicated photo yet; those fall through to the shared table instead. */
const MINI_DISH_IMAGE_SLUGS: Record<string, string> = {
  "Aloo Matar": "aloo-matar-mini",
  "Aloo Gobhi": "aloo-gobhi-mini",
  "Aloo Soyabean": "aloo-soyabean-mini",
  "Dum Aloo": "dum-aloo-mini",
  "Matar Paneer": "matar-paneer-mini",
  "Mushroom Masala": "mushroom-masala-mini",
  Rajma: "rajma-mini",
  "Egg Curry": "egg-curry-mini",
  "Chicken Curry": "chicken-curry-mini",
  "Fish Curry": "fish-curry-mini",
};

function tiffinDishImageUrl(env: Env, slug: string): string {
  return `http://localhost:${env.PORT}/tiffin-images/${slug}.png`;
}

/** There's no real rider app/dispatch system in this project — a rider is picked from this fixed
 * demo pool, deterministically by order id, once an order moves to "out-for-delivery". */
const DELIVERY_PARTNER_POOL: DeliveryPartner[] = [
  { name: "Ravi Shankar", phone: "9835012345" },
  { name: "Amit Verma", phone: "9835023456" },
  { name: "Suresh Yadav", phone: "9835034567" },
  { name: "Manoj Kumar", phone: "9835045678" },
];

function pickDeliveryPartner(orderId: string): DeliveryPartner {
  const seed = [...orderId].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return DELIVERY_PARTNER_POOL[seed % DELIVERY_PARTNER_POOL.length];
}

/**
 * Mini checks its own photos first, then falls back to the shared Regular/Premium photo for the
 * same dish (still a real, accurate photo — just not Mini's own box). Only genuinely unphotographed
 * dishes (a handful — see the reply this was requested in) fall back further to the generic
 * veg/non-veg thali photo the subscription plan cards use, and only for lunch/dinner — breakfast
 * gets no generic fallback at all, since none of the available photos represent it accurately.
 */
function resolveDishImageSlug(tier: SingleMealMenuItem["tier"], dietType: SingleMealMenuItem["dietType"], mealType: SingleMealMenuItem["mealType"], bareDishName: string): string | undefined {
  if (tier === "mini" && MINI_DISH_IMAGE_SLUGS[bareDishName]) return MINI_DISH_IMAGE_SLUGS[bareDishName];
  if (DISH_IMAGE_SLUGS[bareDishName]) return DISH_IMAGE_SLUGS[bareDishName];
  if (mealType === "breakfast") return undefined;
  return dietType === "veg" ? "veg-tiffin" : "non-veg-tiffin";
}

/** Two rows (veg + non-veg) per active price — the price is shared across diets, only the dish
 * differs. Each meal type resolves its own target date (see mealOrderingWindow.ts) — lunch/dinner
 * can be today or tomorrow depending on the ordering cutoff, breakfast is always tomorrow. */
export async function getSingleMealMenu(env: Env): Promise<SingleMealMenuItem[]> {
  const now = new Date();
  const prices = await TiffinMealPriceModel.find({ active: true }).sort({ tier: 1, mealType: 1 });

  const items: SingleMealMenuItem[] = [];
  for (const price of prices) {
    const tier = price.tier as SingleMealMenuItem["tier"];
    const mealType = price.mealType as SingleMealMenuItem["mealType"];
    const date = resolveSingleMealTargetDate(mealType, now);
    for (const dietType of DIET_TYPES) {
      const bareDishName = getSingleMealDish(tier, dietType, mealType, date);
      if (!bareDishName) continue;
      const imageSlug = resolveDishImageSlug(tier, dietType, mealType, bareDishName);
      items.push({
        tier,
        mealType,
        dietType,
        date,
        dishName: bareDishName,
        price: price.price,
        carbChoiceRequired: tier === "mini",
        imageUrl: imageSlug ? tiffinDishImageUrl(env, imageSlug) : undefined,
        addOns: resolveAddOns(tier, mealType, bareDishName),
      });
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

  const date = resolveSingleMealTargetDate(request.mealType, new Date());
  const bareDishName = getSingleMealDish(request.tier, request.dietType, request.mealType, date);
  if (!bareDishName) {
    throw new TiffinValidationError("This meal isn't available right now");
  }

  // Re-resolve the add-on catalog server-side and keep only what the customer actually picked —
  // names and prices are never trusted from the client.
  const availableAddOns = resolveAddOns(request.tier, request.mealType, bareDishName);
  const selectedAddOns = availableAddOns.filter((addOn) => request.selectedAddOns.includes(addOn.name));

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
    dishName: bareDishName,
    addOns: selectedAddOns,
    status: "placed",
    statusHistory: [{ status: "placed", at: new Date().toISOString() }],
    delivery: request.delivery,
    price: price.price,
    quantity: request.quantity,
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

  const addOnsTotal = order.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const razorpayOrder = await createRazorpayOrder(env, (order.price + addOnsTotal) * order.quantity, order.orderNumber);
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

/**
 * Cancelling within SINGLE_MEAL_CANCELLATION_WINDOW_MINUTES of placing the order refunds the full
 * amount (only meaningful if it was actually paid via Razorpay already — COD never charged
 * anything upfront); on or after that window, no refund. Nothing is charged back through
 * Razorpay here — same "record the entitled refund for the business to settle manually" approach
 * tiffin.service.ts's subscription cancellation already uses.
 */
export async function cancelSingleMealOrder(userId: string, orderId: string) {
  const order = await findOwnedOrder(userId, orderId);
  if (order.status === "cancelled" || order.status === "delivered") {
    throw new TiffinValidationError("This order can't be cancelled");
  }

  const minutesElapsed = (Date.now() - order.createdAt.getTime()) / (1000 * 60);
  const addOnsTotal = order.addOns.reduce((sum, addOn) => sum + addOn.price, 0);
  const refundAmount =
    order.payment.status === "paid" && minutesElapsed < SINGLE_MEAL_CANCELLATION_WINDOW_MINUTES
      ? (order.price + addOnsTotal) * order.quantity
      : 0;

  order.status = "cancelled";
  order.statusHistory.push({ status: "cancelled", at: new Date().toISOString() });
  if (refundAmount > 0) {
    order.payment.status = "refunded";
    order.payment.refundAmount = refundAmount;
  }
  await order.save();
  return order;
}

// --- Admin-only ---

/** Scoped to today (IST) — same day-boundary the orders themselves were dated under. */
export function listTodaysSingleMealOrders() {
  return TiffinSingleMealOrderModel.find({ date: todayIsoInIst() }).sort({ dishName: 1 });
}

export async function updateSingleMealOrderStatus(orderId: string, status: TiffinSingleMealOrderStatus) {
  const order = await TiffinSingleMealOrderModel.findById(orderId);
  if (!order) throw new TiffinValidationError("Order not found");

  order.status = status;
  order.statusHistory.push({ status, at: new Date().toISOString() });
  if (status === "out-for-delivery" && !order.deliveryPartner) {
    order.deliveryPartner = pickDeliveryPartner(String(order._id));
  }
  await order.save();
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
