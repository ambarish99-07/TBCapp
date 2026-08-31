import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminClient } from "../src/api/adminClient.js";
import { useNewOrderAlerts } from "../src/notifications/useNewOrderAlerts.js";

// The hook calls useNavigate() (to jump to an order when its notification is clicked), which
// throws outside a Router context — same reason App.tsx only ever renders it inside one.
const wrapper = MemoryRouter;

vi.mock("../src/api/adminClient.js", () => ({
  adminClient: { get: vi.fn() },
}));

vi.mock("../src/notifications/alertSound.js", () => ({
  playAlertSound: vi.fn(),
  primeAlertSound: vi.fn(),
}));

function makeOrder(id: string) {
  return {
    id,
    accessToken: "tok",
    orderNumber: `TBC-${id}`,
    userId: null,
    items: [],
    delivery: { fullName: "Jane Doe", phone: "9999999999", address: "1 Main St", city: "Patna", pincode: "800001" },
    totals: {
      subtotal: 200,
      discountAmount: 0,
      discountReason: "none",
      rewardAmount: 0,
      rewardReason: "none",
      deliveryFee: 39,
      tax: 9,
      total: 228,
    },
    isPremiumMemberAtOrder: false,
    estimatedMinutes: 35,
    status: "received",
    statusHistory: [],
    payment: { method: "cod", status: "pending" },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

// Fake timers must be active BEFORE the hook mounts so the interval it schedules is
// registered against the fake clock (switching to fake timers after the fact doesn't
// retroactively capture an already-scheduled real setInterval). testing-library's
// `waitFor` relies on real-timer retries internally, so it can't be used here at all —
// `vi.advanceTimersByTimeAsync(0)` is used instead to flush the immediate first poll.
describe("useNewOrderAlerts", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.mocked(adminClient.get).mockReset();
  });

  it("does not alert on orders that already existed at the first poll (the baseline)", async () => {
    vi.mocked(adminClient.get).mockResolvedValue({ data: { orders: [makeOrder("a")] } });

    const { result } = renderHook(() => useNewOrderAlerts(true), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(adminClient.get).toHaveBeenCalledTimes(1);
    expect(result.current.newOrders).toEqual([]);
  });

  it("alerts on an order that appears in a later poll but wasn't there at baseline", async () => {
    vi.mocked(adminClient.get).mockResolvedValueOnce({ data: { orders: [makeOrder("a")] } });
    const { result } = renderHook(() => useNewOrderAlerts(true), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(adminClient.get).mockResolvedValueOnce({ data: { orders: [makeOrder("a"), makeOrder("b")] } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });

    expect(result.current.newOrders.map((o) => o.id)).toEqual(["b"]);
  });

  it("dismiss removes just that order; dismissAll clears everything", async () => {
    vi.mocked(adminClient.get).mockResolvedValueOnce({ data: { orders: [] } });
    const { result } = renderHook(() => useNewOrderAlerts(true), { wrapper });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    vi.mocked(adminClient.get).mockResolvedValueOnce({ data: { orders: [makeOrder("a"), makeOrder("b")] } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    expect(result.current.newOrders.length).toBe(2);

    act(() => result.current.dismiss("a"));
    expect(result.current.newOrders.map((o) => o.id)).toEqual(["b"]);

    act(() => result.current.dismissAll());
    expect(result.current.newOrders).toEqual([]);
  });
});
