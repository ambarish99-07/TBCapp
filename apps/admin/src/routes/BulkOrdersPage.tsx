import type { BulkOrderInquiry, BulkOrderInquiryStatus } from "@tbc/shared-types";
import { useEffect, useState } from "react";
import { adminClient } from "../api/adminClient.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Select } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

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

  return (
    <div>
      <PageHeader title="Bulk Order Inquiries" />
      <Card>
        {isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : inquiries.length === 0 ? (
          <EmptyState message="No bulk order inquiries yet." />
        ) : (
          <Table>
            <Thead>
              <Tr>
                <Th>Name</Th>
                <Th>Contact</Th>
                <Th>Occasion</Th>
                <Th>Quantity</Th>
                <Th>Preferred Date</Th>
                <Th>Message</Th>
                <Th>Received</Th>
                <Th>Status</Th>
              </Tr>
            </Thead>
            <tbody>
              {inquiries.map((inquiry) => (
                <Tr key={inquiry.id}>
                  <Td>{inquiry.name}</Td>
                  <Td>
                    {inquiry.phone}
                    {inquiry.email && (
                      <>
                        <br />
                        <span className="text-muted">{inquiry.email}</span>
                      </>
                    )}
                  </Td>
                  <Td>{inquiry.occasion ?? "—"}</Td>
                  <Td>{inquiry.estimatedQuantity ?? "—"}</Td>
                  <Td>{inquiry.preferredDate ?? "—"}</Td>
                  <Td>{inquiry.message ?? "—"}</Td>
                  <Td>{new Date(inquiry.createdAt).toLocaleString()}</Td>
                  <Td>
                    <Select value={inquiry.status} onChange={(e) => handleStatusChange(inquiry.id, e.target.value as BulkOrderInquiryStatus)}>
                      {STATUS_OPTIONS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </Select>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>
    </div>
  );
}
