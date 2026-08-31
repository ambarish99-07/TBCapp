import type { MenuItem, Order, User } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { OrderTable } from "../components/OrderTable.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";

type CustomerProfile = Pick<User, "id" | "fullName" | "phone" | "email">;

export function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerProfile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [selectedNames, setSelectedNames] = useState<string[]>([]);
  const [customName, setCustomName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setIsLoading(true);
      const [customerRes, ordersRes, itemsRes] = await Promise.all([
        adminClient.get<{ customer: CustomerProfile }>(`/admin/customers/${id}`),
        adminClient.get<{ orders: Order[] }>("/admin/orders", { params: { userId: id } }),
        adminClient.get<{ items: MenuItem[] }>("/menu/search"),
      ]);
      setCustomer(customerRes.data.customer);
      setOrders(ordersRes.data.orders);
      setMenuItems(itemsRes.data.items);
      setIsLoading(false);
    }
    load();
  }, [id]);

  // The dishes this customer has actually ordered before — surfaced first as quick-pick chips,
  // since "recommend the same item again" is the most common case.
  const orderedItemNames = Array.from(new Set(orders.flatMap((order) => order.items.map((line) => line.signatureName))));

  function toggleName(name: string) {
    setSelectedNames((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function addCustomName() {
    const trimmed = customName.trim();
    if (!trimmed || selectedNames.includes(trimmed)) return;
    setSelectedNames((prev) => [...prev, trimmed]);
    setCustomName("");
  }

  async function handleSend() {
    setError(null);
    setSentMessage(null);
    if (selectedNames.length === 0) {
      setError("Choose at least one item to recommend.");
      return;
    }
    setIsSending(true);
    try {
      await adminClient.post(`/admin/customers/${id}/recommend`, { itemNames: selectedNames });
      setSentMessage(`Sent: ${selectedNames.join(", ")}`);
      setSelectedNames([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send recommendation");
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div>
        <PageHeader title="Customer" />
        <p className="text-sm text-muted">Loading…</p>
      </div>
    );
  }

  if (!customer) {
    return (
      <div>
        <PageHeader title="Customer not found" action={<Link to="/customers" className="text-sm font-semibold text-primary-dark hover:underline">‹ Back to Customers</Link>} />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title={customer.fullName}
        description={[customer.phone, customer.email].filter(Boolean).join(" · ") || "No contact info on file"}
        action={
          <Link to="/customers" className="text-sm font-semibold text-primary-dark hover:underline">
            ‹ Back to Customers
          </Link>
        }
      />

      <Card title="Order History" className="mb-6">
        {orders.length === 0 ? <EmptyState message="No orders yet." /> : <OrderTable orders={orders} />}
      </Card>

      <Card title="Send a Recommendation" description="Pick items to suggest — sent as a WhatsApp message.">
        {orderedItemNames.length > 0 && (
          <div className="mb-4">
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Ordered Before</p>
            <div className="flex flex-wrap gap-2">
              {orderedItemNames.map((name) => (
                <button
                  key={name}
                  onClick={() => toggleName(name)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedNames.includes(name) ? "border-primary bg-primary/10 text-primary-dark" : "border-border text-text hover:bg-surface"
                  }`}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Or Any Other Menu Item</p>
          <div className="flex flex-wrap gap-2">
            {menuItems
              .filter((item) => !orderedItemNames.includes(item.signatureName))
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => toggleName(item.signatureName)}
                  className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                    selectedNames.includes(item.signatureName)
                      ? "border-primary bg-primary/10 text-primary-dark"
                      : "border-border text-text hover:bg-surface"
                  }`}
                >
                  {item.signatureName}
                </button>
              ))}
          </div>
        </div>

        <div className="mb-4 flex items-center gap-2">
          <Input
            placeholder="Type a custom item name…"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addCustomName();
              }
            }}
            className="flex-1"
          />
          <Button variant="secondary" onClick={addCustomName}>
            Add
          </Button>
        </div>

        {selectedNames.length > 0 && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wide text-muted">Selected:</span>
            {selectedNames.map((name) => (
              <span key={name} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary-dark">
                {name}
                <button onClick={() => toggleName(name)} className="font-bold">
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <Button onClick={handleSend} disabled={isSending || selectedNames.length === 0}>
          {isSending ? "Sending…" : "Send via WhatsApp"}
        </Button>
        {sentMessage && <p className="mt-3 text-sm font-medium text-success">{sentMessage}</p>}
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
      </Card>
    </div>
  );
}
