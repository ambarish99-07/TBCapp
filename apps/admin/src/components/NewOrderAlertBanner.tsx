import type { Order } from "@tbc/shared-types";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { primeAlertSound } from "../notifications/alertSound.js";

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
        <div style={styles.enableBar}>
          <span>Enable desktop alerts so a new order beeps and pops up even if this tab isn't focused.</span>
          <button onClick={handleEnableAlerts}>Enable Alerts</button>
        </div>
      )}

      {newOrders.length > 0 && (
        <div style={styles.sosBar}>
          <div style={styles.sosHeader}>
            <strong>🚨 {newOrders.length} new order{newOrders.length > 1 ? "s" : ""} — start preparing</strong>
            <button onClick={onDismissAll} style={styles.dismissAllButton}>
              Dismiss all
            </button>
          </div>
          {newOrders.map((order) => (
            <div key={order.id} style={styles.orderRow}>
              <span>
                {order.orderNumber} · {order.delivery.fullName} · ₹{order.totals.total}
              </span>
              <span>
                <button
                  onClick={() => {
                    onDismiss(order.id);
                    navigate(`/orders/${order.id}`);
                  }}
                >
                  View
                </button>
                <button onClick={() => onDismiss(order.id)} style={{ marginLeft: 8 }}>
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

const styles = {
  enableBar: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    padding: "8px 16px",
    backgroundColor: "#F7F3EF",
    fontSize: 13,
  },
  sosBar: {
    padding: "12px 16px",
    backgroundColor: "#B3261E",
    color: "#fff",
  },
  sosHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  dismissAllButton: {
    background: "transparent",
    color: "#fff",
    border: "1px solid #fff",
    borderRadius: 4,
    padding: "2px 8px",
  },
  orderRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "4px 0",
    borderTop: "1px solid rgba(255,255,255,0.3)",
  },
} as const;
