import type { BulkOrderInquiry, BulkOrderInquiryStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";

const STATUS_OPTIONS: BulkOrderInquiryStatus[] = ["new", "contacted", "closed"];

export function BulkOrdersPage() {
  const [inquiries, setInquiries] = useState<BulkOrderInquiry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  async function reload() {
    setIsLoading(true);
    const { data } = await adminClient.get<{ inquiries: BulkOrderInquiry[] }>("/admin/bulk-order-inquiries");
    setInquiries(data.inquiries);
    setIsLoading(false);
  }

  useEffect(() => {
    reload();
  }, []);

  async function handleStatusChange(id: string, status: BulkOrderInquiryStatus) {
    await adminClient.patch(`/admin/bulk-order-inquiries/${id}/status`, { status });
    await reload();
  }

  if (isLoading) return <p>Loading…</p>;

  return (
    <div>
      <h1>Bulk Order Inquiries</h1>
      {inquiries.length === 0 ? (
        <p>No bulk order inquiries yet.</p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th align="left">Name</th>
              <th align="left">Contact</th>
              <th align="left">Occasion</th>
              <th align="left">Quantity</th>
              <th align="left">Preferred Date</th>
              <th align="left">Message</th>
              <th align="left">Received</th>
              <th align="left">Status</th>
            </tr>
          </thead>
          <tbody>
            {inquiries.map((inquiry) => (
              <tr key={inquiry.id} style={{ borderTop: "1px solid #E4DCD3" }}>
                <td>{inquiry.name}</td>
                <td>
                  {inquiry.phone}
                  {inquiry.email && (
                    <>
                      <br />
                      {inquiry.email}
                    </>
                  )}
                </td>
                <td>{inquiry.occasion ?? "—"}</td>
                <td>{inquiry.estimatedQuantity ?? "—"}</td>
                <td>{inquiry.preferredDate ?? "—"}</td>
                <td>{inquiry.message ?? "—"}</td>
                <td>{new Date(inquiry.createdAt).toLocaleString()}</td>
                <td>
                  <select value={inquiry.status} onChange={(e) => handleStatusChange(inquiry.id, e.target.value as BulkOrderInquiryStatus)}>
                    {STATUS_OPTIONS.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
