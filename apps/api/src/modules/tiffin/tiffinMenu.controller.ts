import { UpsertTiffinAddOnPriceRequestSchema, UpsertTiffinDishRequestSchema, UpsertTiffinFestivalSpecialRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import * as tiffinMenuService from "./tiffinMenu.service.js";

/** Mongoose documents carry `_id`, but the shared schemas the client relies on expect `id`. */
function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

// --- Public (also used by the admin panel — there's no separate "draft" state to hide) ---

export const getWeeklyMenu: RequestHandler = async (_req, res) => {
  const dishes = await tiffinMenuService.listTiffinDishes();
  res.json({ dishes: dishes.map((d) => withId(d.toObject())) });
};

// --- Admin ---

export const listTiffinDishesAdmin: RequestHandler = async (_req, res) => {
  const dishes = await tiffinMenuService.listTiffinDishes();
  res.json({ dishes: dishes.map((d) => withId(d.toObject())) });
};

export const upsertTiffinDishAdmin: RequestHandler = async (req, res) => {
  const parsed = UpsertTiffinDishRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid dish payload", details: parsed.error.flatten() });
    return;
  }
  const dish = await tiffinMenuService.upsertTiffinDish(parsed.data);
  res.json({ dish: withId(dish.toObject()) });
};

export const listFestivalSpecialsAdmin: RequestHandler = async (_req, res) => {
  const specials = await tiffinMenuService.listFestivalSpecials();
  res.json({ specials: specials.map((s) => withId(s.toObject())) });
};

export const upsertFestivalSpecialAdmin: RequestHandler = async (req, res) => {
  const parsed = UpsertTiffinFestivalSpecialRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid festival special payload", details: parsed.error.flatten() });
    return;
  }
  const special = await tiffinMenuService.upsertFestivalSpecial(parsed.data);
  res.json({ special: withId(special.toObject()) });
};

export const deleteFestivalSpecialAdmin: RequestHandler = async (req, res) => {
  await tiffinMenuService.deleteFestivalSpecial(req.params.id);
  res.status(204).send();
};

export const listAddOnPricesAdmin: RequestHandler = async (_req, res) => {
  const prices = await tiffinMenuService.listAddOnPrices();
  res.json({ addOnPrices: prices.map((p) => withId(p.toObject())) });
};

export const upsertAddOnPriceAdmin: RequestHandler = async (req, res) => {
  const parsed = UpsertTiffinAddOnPriceRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid add-on price payload", details: parsed.error.flatten() });
    return;
  }
  const price = await tiffinMenuService.upsertAddOnPrice(parsed.data);
  res.json({ addOnPrice: withId(price.toObject()) });
};
