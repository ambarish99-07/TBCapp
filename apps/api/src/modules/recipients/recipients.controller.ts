import { SaveRecipientRequestSchema } from "@tbc/shared-types";
import type { RequestHandler } from "express";
import { SavedRecipientModel } from "../../db/models/SavedRecipient.model.js";

export const listRecipients: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const recipients = await SavedRecipientModel.find({ userId: req.user.userId }).sort({ createdAt: -1 });
  res.json({ recipients });
};

export const createRecipient: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SaveRecipientRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid recipient payload", details: parsed.error.flatten() });
    return;
  }

  const recipient = await SavedRecipientModel.create({ ...parsed.data, userId: req.user.userId });
  res.status(201).json({ recipient });
};

export const updateRecipient: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const parsed = SaveRecipientRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid recipient payload", details: parsed.error.flatten() });
    return;
  }

  const recipient = await SavedRecipientModel.findOneAndUpdate(
    { _id: req.params.id, userId: req.user.userId },
    parsed.data,
    { new: true }
  );
  if (!recipient) {
    res.status(404).json({ error: "Saved recipient not found" });
    return;
  }
  res.json({ recipient });
};

export const deleteRecipient: RequestHandler = async (req, res) => {
  if (!req.user) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const result = await SavedRecipientModel.deleteOne({ _id: req.params.id, userId: req.user.userId });
  if (result.deletedCount === 0) {
    res.status(404).json({ error: "Saved recipient not found" });
    return;
  }
  res.status(204).send();
};
