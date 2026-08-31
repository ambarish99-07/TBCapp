import type { Order } from "@tbc/shared-types";
import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
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
  const navigate = useNavigate();

  // Shared by both a genuine freshly-arrived order and sendTestAlert below, so "send a test alert"
  // triggers the exact same banner + beep + OS notification a real order does, not a lookalike.
  const raiseAlert = useCallback(
    (orders: Order[]) => {
      setNewOrders((prev) => [...prev, ...orders]);
      playAlertSound();
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        for (const order of orders) {
          // requireInteraction keeps it on screen (as a real OS toast, overlapping whatever else
          // has focus — a game included) until the admin clicks or dismisses it, instead of the
          // browser's default ~5s auto-hide, which is easy to miss mid-game.
          const notification = new Notification("New order — start preparing", {
            body: `${order.orderNumber} · ${order.delivery.fullName} · ₹${order.totals.total}`,
            tag: order.id,
            requireInteraction: true,
          });
          notification.onclick = () => {
            window.focus();
            navigate(`/orders/${order.id}`);
            notification.close();
          };
        }
      }
    },
    [navigate]
  );

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
        raiseAlert(freshlyArrived);
      }
    } catch {
      // A transient poll failure shouldn't kill the alert loop — it just tries again next interval.
    }
  }, [raiseAlert]);

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

  // A synthetic, never-persisted order — only the fields the banner/notification actually render
  // are filled in. Lets an admin confirm the *full* alert (banner included, not just the OS popup)
  // works before relying on it, without waiting for a real order.
  const sendTestAlert = useCallback(() => {
    const testOrder = {
      id: `test-${Date.now()}`,
      orderNumber: "TEST-0000",
      delivery: { fullName: "Test Customer" },
      totals: { total: 299 },
    } as unknown as Order;
    raiseAlert([testOrder]);
  }, [raiseAlert]);

  return { newOrders, dismiss, dismissAll, sendTestAlert };
}
