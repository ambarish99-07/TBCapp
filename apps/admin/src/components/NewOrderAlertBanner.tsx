import type { Order } from "@tbc/shared-types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { primeAlertSound } from "../notifications/alertSound.js";
import { Button } from "./ui/Button.js";

interface Props {
  newOrders: Order[];
  onDismiss: (orderId: string) => void;
  onDismissAll: () => void;
}

export function NewOrderAlertBanner({ newOrders, onDismiss, onDismissAll }: Props) {
  const navigate = useNavigate();
  const [notificationsEnabled, setNotificationsEnabled] = useState(
    typeof Notification !== "undefined" && Notification.permission === "granted"
  );

  async function handleEnableAlerts() {
    primeAlertSound();
    if (typeof Notification !== "undefined") {
      const result = await Notification.requestPermission();
      setNotificationsEnabled(result === "granted");
    }
  }

  return (
    <div>
      {!notificationsEnabled && (
        <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2 text-sm text-text">
          <span>Enable desktop alerts so a new order beeps and pops up even if this tab isn't focused.</span>
          <Button variant="secondary" onClick={handleEnableAlerts}>
            Enable Alerts
          </Button>
        </div>
      )}

      {newOrders.length > 0 && (
        <div className="bg-danger px-4 py-3 text-white">
          <div className="mb-2 flex items-center justify-between">
            <strong>
              🚨 {newOrders.length} new order{newOrders.length > 1 ? "s" : ""} — start preparing
            </strong>
            <button
              onClick={onDismissAll}
              className="rounded border border-white px-2 py-0.5 text-sm hover:bg-white/10"
            >
              Dismiss all
            </button>
          </div>
          {newOrders.map((order) => (
            <div key={order.id} className="flex items-center justify-between border-t border-white/30 py-1">
              <span>
                {order.orderNumber} · {order.delivery.fullName} · ₹{order.totals.total}
              </span>
              <span className="flex gap-2">
                <button
                  onClick={() => {
                    onDismiss(order.id);
                    navigate(`/orders/${order.id}`);
                  }}
                  className="underline underline-offset-2 hover:no-underline"
                >
                  View
                </button>
                <button onClick={() => onDismiss(order.id)} className="underline underline-offset-2 hover:no-underline">
                  Dismiss
                </button>
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
