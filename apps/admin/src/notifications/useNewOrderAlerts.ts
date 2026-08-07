import type { Order } from "@tbc/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { playAlertSound } from "./alertSound.js";

const POLL_INTERVAL_MS = 8000;

/**
 * Polls for orders in "received" status (the ones that need prep started) and
 * raises an SOS-style alert — beep + browser notification + a banner the admin
 * has to dismiss — the moment a genuinely new one shows up. The first poll
 * after (re)enabling establishes the baseline silently, so pre-existing orders
 * already in the queue don't trigger a false alarm on page load/login.
 */
export function useNewOrderAlerts(enabled: boolean) {
  const [newOrders, setNewOrders] = useState<Order[]>([]);
  const knownOrderIds = useRef<Set<string> | null>(null);

  const poll = useCallback(async () => {
    try {
      const { data } = await adminClient.get<{ orders: Order[] }>("/admin/orders", {
        params: { status: "received" },
      });
      const currentIds = new Set(data.orders.map((order) => order.id));

      if (knownOrderIds.current === null) {
        knownOrderIds.current = currentIds;
        return;
      }

      const freshlyArrived = data.orders.filter((order) => !knownOrderIds.current!.has(order.id));
      knownOrderIds.current = currentIds;

      if (freshlyArrived.length > 0) {
        setNewOrders((prev) => [...prev, ...freshlyArrived]);
        playAlertSound();
        if (typeof Notification !== "undefined" && Notification.permission === "granted") {
          for (const order of freshlyArrived) {
            new Notification("New order — start preparing", {
              body: `${order.orderNumber} · ${order.delivery.fullName} · ₹${order.totals.total}`,
              tag: order.id,
            });
          }
        }
      }
    } catch {
      // A transient poll failure shouldn't kill the alert loop — it just tries again next interval.
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    knownOrderIds.current = null;
    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [enabled, poll]);

  const dismiss = useCallback((orderId: string) => {
    setNewOrders((prev) => prev.filter((order) => order.id !== orderId));
  }, []);

  const dismissAll = useCallback(() => setNewOrders([]), []);

  return { newOrders, dismiss, dismissAll };
}
