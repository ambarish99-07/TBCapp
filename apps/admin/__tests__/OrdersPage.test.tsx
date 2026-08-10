import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { adminClient } from "../src/api/adminClient.js";
import { OrdersPage } from "../src/routes/OrdersPage.js";
import { MemoryRouter } from "react-router-dom";

vi.mock("../src/api/adminClient.js", () => ({
  adminClient: { get: vi.fn() },
}));

const mockOrder = {
  id: "order1",
  accessToken: "tok",
  orderNumber: "TBC-AAAAAAAA-BBBB",
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

describe("OrdersPage", () => {
  it("renders the order list returned by the admin API", async () => {
    vi.mocked(adminClient.get).mockImplementation((url: string) => {
      if (url === "/admin/brands") return Promise.resolve({ data: { brands: [] } });
      return Promise.resolve({ data: { orders: [mockOrder] } });
    });

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("TBC-AAAAAAAA-BBBB")).toBeInTheDocument());
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(screen.getByText("received")).toBeInTheDocument();
  });

  it("shows an empty state when there are no orders for the filter", async () => {
    vi.mocked(adminClient.get).mockImplementation((url: string) => {
      if (url === "/admin/brands") return Promise.resolve({ data: { brands: [] } });
      return Promise.resolve({ data: { orders: [] } });
    });

    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );

    await waitFor(() => expect(screen.getByText("No orders match this filter.")).toBeInTheDocument());
  });
});
