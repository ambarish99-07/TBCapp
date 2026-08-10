import { CreateBrandRequestSchema, UpdateBrandRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { BrandModel } from "../../db/models/Brand.model.js";
import { listLiveBrands as listLiveBrandsFromDb } from "./brands.service.js";

/** Mongoose documents carry `_id`, but the shared Brand schema the client relies on expects `id`. */
function withId<T extends { _id: unknown }>(doc: T): Omit<T, "_id"> & { id: string } {
  const { _id, ...rest } = doc;
  return { ...rest, id: String(_id) };
}

export const listLiveBrands: RequestHandler = async (_req, res) => {
  const brands = await listLiveBrandsFromDb();
  res.json({ brands: brands.map(withId) });
};

export const listAllBrandsAdmin: RequestHandler = async (_req, res) => {
  const brands = await BrandModel.find().sort({ createdAt: -1 }).lean();
  res.json({ brands: brands.map(withId) });
};

export const createBrand: RequestHandler = async (req, res) => {
  const parsed = CreateBrandRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid brand payload", details: parsed.error.flatten() });
    return;
  }

  const existing = await BrandModel.findById(parsed.data.id);
  if (existing) {
    res.status(409).json({ error: "A brand with this id already exists" });
    return;
  }

  const { id, ...rest } = parsed.data;
  const brand = await BrandModel.create({ _id: id, ...rest });
  res.status(201).json({ brand: withId(brand.toObject()) });
};

export const updateBrand: RequestHandler = async (req, res) => {
  const parsed = UpdateBrandRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid brand payload", details: parsed.error.flatten() });
    return;
  }

  const brand = await BrandModel.findByIdAndUpdate(req.params.id, parsed.data, { new: true, runValidators: true });
  if (!brand) {
    res.status(404).json({ error: "Brand not found" });
    return;
  }
  res.json({ brand: withId(brand.toObject()) });
};

export const deleteBrand: RequestHandler = async (req, res) => {
  await BrandModel.findByIdAndDelete(req.params.id);
  res.status(204).send();
};
