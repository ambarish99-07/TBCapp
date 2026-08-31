import type { Order } from "@tbc/shared-types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { primeAlertSound } from "../notifications/alertSound.js";
import { Button } from "./ui/Button.js";

interface Props {
  newOrders: Order[];
  onDismiss: (orderId: string) => void;
  onDismissAll: () => void;
  onSendTestAlert: () => void;
}

type PermissionState = "granted" | "denied" | "default" | "unsupported";

function currentPermission(): PermissionState {
  if (typeof Notification === "undefined") return "unsupported";
  return Notification.permission;
}

export function NewOrderAlertBanner({ newOrders, onDismiss, onDismissAll, onSendTestAlert }: Props) {
  const navigate = useNavigate();
  const [permission, setPermission] = useState<PermissionState>(currentPermission());

  async function handleEnableAlerts() {
    primeAlertSound();
    if (typeof Notification !== "undefined") {
      const result = await Notification.requestPermission();
      setPermission(result);
    }
  }

  function handleTestAlert() {
    primeAlertSound();
    onSendTestAlert();
  }

  return (
    <div>
      {permission === "denied" && (
        <div className="flex items-center justify-between gap-3 bg-danger-soft px-4 py-2 text-sm text-danger">
          <span>
            Desktop alerts are blocked for this site. Click the lock/info icon in the browser's address bar → Notifications
            → Allow, then reload this page.
          </span>
        </div>
      )}
      {(permission === "default" || permission === "unsupported") && (
        <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2 text-sm text-text">
          <span>
            Enable desktop alerts so a new order beeps and pops up on screen — even over another app or a full-screen
            game — as long as this browser stays open (it can be minimized).
          </span>
          <Button variant="secondary" onClick={handleEnableAlerts}>
            Enable Alerts
          </Button>
        </div>
      )}
      {permission === "granted" && (
        <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2 text-sm text-text">
          <span>
            Desktop alerts are on. On Windows, check that Focus Assist isn't set to silence notifications during
            full-screen apps, or a game could still block the popup.
          </span>
          <Button variant="secondary" onClick={handleTestAlert} title="Shows the full alert — banner, beep, and desktop popup — just like a real order">
            Send Test Alert
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
