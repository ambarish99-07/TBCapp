import type { RequestHandler } from "express";
import { z } from "zod";
import { catalogSyncConfigured, postSigned, toAppBrandId, toCanonicalBrandId } from "../catalogSync/catalogSync.service.js";

/**
 * The app admin's window into the WEBSITE's orders, customers, reviews & complaints, help requests, blog and leads —
 * every call goes to the website API's signed /internal/admin-peer endpoints (same shared secret
 * as catalog sync). Mounted inside the admin router, so only an app admin can reach these.
 */

class PeerError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function peer<T>(path: string, body: unknown = {}): Promise<T> {
  if (!catalogSyncConfigured()) throw new PeerError("The website link isn't set up on this server yet.", 503);
  let res: Response;
  try {
    res = await postSigned(`/internal/admin-peer${path}`, body);
  } catch (err) {
    throw new PeerError(`Couldn't reach the website: ${err instanceof Error ? err.message : "network error"}`, 502);
  }
  const data = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  // 400/404 are the website saying no to this request (e.g. "Cannot move from received to delivered") — pass them on.
  if (!res.ok) throw new PeerError(data.error?.message ?? `The website answered ${res.status}`, res.status === 400 || res.status === 404 ? res.status : 502);
  return data;
}

function handle(run: (req: Parameters<RequestHandler>[0]) => Promise<unknown>): RequestHandler {
  return async (req, res) => {
    try {
      res.json(await run(req));
    } catch (err) {
      if (err instanceof PeerError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (err instanceof z.ZodError) {
        res.status(400).json({ error: "Invalid request", details: err.flatten() });
        return;
      }
      throw err;
    }
  };
}

const StatusSchema = z.enum(["open", "in-progress", "resolved"]).optional();

/** Website brand ids → the app's (the-biryani-lane → TBL) so filters and names line up. */
function withAppBrand<T extends { brandId?: string }>(row: T): T {
  return row.brandId ? { ...row, brandId: toAppBrandId(row.brandId) } : row;
}

export const listWebsiteCustomers: RequestHandler = handle(async (req) => {
  const q = typeof req.query.q === "string" && req.query.q.trim() ? req.query.q.trim() : undefined;
  return peer("/customers", q ? { q } : {});
});

export const getWebsiteCustomer: RequestHandler = handle(async (req) => {
  const data = await peer<{ orders: { brandId?: string }[] }>("/customer", { id: req.params.id });
  return { ...data, orders: data.orders.map(withAppBrand) };
});

export const listWebsiteFeedback: RequestHandler = handle(async (req) => {
  const type = z.enum(["review", "complaint"]).optional().parse(req.query.type || undefined);
  const status = StatusSchema.parse(req.query.status || undefined);
  const data = await peer<{ feedback: { brandId?: string }[] }>("/feedback", { ...(type ? { type } : {}), ...(status ? { status } : {}) });
  return { feedback: data.feedback.map(withAppBrand) };
});

export const updateWebsiteFeedback: RequestHandler = handle(async (req) => {
  const body = z.object({ status: StatusSchema, adminResponse: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
  return peer("/feedback/update", { id: req.params.id, ...body });
});

export const listWebsiteSupportTickets: RequestHandler = handle(async (req) => {
  const status = StatusSchema.parse(req.query.status || undefined);
  return peer("/tickets", status ? { status } : {});
});

export const updateWebsiteSupportTicket: RequestHandler = handle(async (req) => {
  const body = z.object({ status: StatusSchema, adminReply: z.string().trim().max(1000).optional() }).parse(req.body ?? {});
  return peer("/tickets/update", { id: req.params.id, ...body });
});

// ---- Website orders, blog and leads ------------------------------------------------------------

type WebsiteOrder = { brandId?: string; brandIds?: string[]; lines?: { brandId?: string }[] };

function orderWithAppBrands<T extends WebsiteOrder>(o: T): T {
  return {
    ...withAppBrand(o),
    brandIds: o.brandIds?.map(toAppBrandId),
    lines: o.lines?.map(withAppBrand),
  };
}

export const listWebsiteOrders: RequestHandler = handle(async (req) => {
  const brandId = typeof req.query.brandId === "string" && req.query.brandId ? toCanonicalBrandId(req.query.brandId) : undefined;
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  const data = await peer<{ orders: WebsiteOrder[] }>("/orders", { ...(brandId ? { brandId } : {}), ...(status ? { status } : {}) });
  return { orders: data.orders.map(orderWithAppBrands) };
});

export const advanceWebsiteOrder: RequestHandler = handle(async (req) => {
  const { status } = z.object({ status: z.enum(["preparing", "out-for-delivery", "delivered"]) }).parse(req.body ?? {});
  const data = await peer<{ order: WebsiteOrder }>("/orders/advance", { id: req.params.id, status });
  return { order: orderWithAppBrands(data.order) };
});

// Blog bodies are validated by the website (it owns the blog schema) — passed through as-is.
const PassThrough = z.record(z.unknown());

export const listWebsiteBlogPosts: RequestHandler = handle(async () => peer("/blog"));
export const createWebsiteBlogPost: RequestHandler = handle(async (req) => peer("/blog/create", PassThrough.parse(req.body ?? {})));
export const updateWebsiteBlogPost: RequestHandler = handle(async (req) => peer("/blog/update", { slug: req.params.slug, patch: PassThrough.parse(req.body ?? {}) }));
export const deleteWebsiteBlogPost: RequestHandler = handle(async (req) => peer("/blog/delete", { slug: req.params.slug }));

export const listWebsiteLeads: RequestHandler = handle(async (req) => {
  const kind = typeof req.query.kind === "string" && req.query.kind ? req.query.kind : undefined;
  const status = typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
  return peer("/leads", { ...(kind ? { kind } : {}), ...(status ? { status } : {}), ...(req.query.callback === "1" ? { callbackOnly: true } : {}) });
});

export const updateWebsiteLead: RequestHandler = handle(async (req) => {
  const body = z.object({ status: z.string().optional(), note: z.string().trim().min(1).max(1000).optional() }).parse(req.body ?? {});
  // Notes are signed so the website's history shows where they came from.
  return peer("/leads/update", { id: req.params.id, ...body, by: "Lickyeat Admin" });
});

// ---- Website GG Tiffin: single-meal orders from today on, live subscribers, today's meals --------

export const getWebsiteTiffin: RequestHandler = handle(async () => peer("/tiffin"));

export const advanceWebsiteSingleMeal: RequestHandler = handle(async (req) => {
  const { status } = z.object({ status: z.enum(["preparing", "out-for-delivery", "delivered"]) }).parse(req.body ?? {});
  return peer("/tiffin/single-meal/advance", { id: req.params.id, status });
});
