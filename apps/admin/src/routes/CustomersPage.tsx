import type { User } from "@tbc/shared-types";
import axios from "axios";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

// The shared User type has no `createdAt` (it's stripped from the normal profile-facing shape),
// but this admin-only endpoint's own controller does select and return it — added here locally.
type CustomerSummary = Pick<User, "id" | "fullName" | "phone" | "email"> & { createdAt: string };
const PAGE_SIZE = 50;

function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const message = (err.response?.data as { error?: string } | undefined)?.error;
    if (message) return message;
  }
  return err instanceof Error ? err.message : fallback;
}

/**
 * With no search text this browses every customer, alphabetically, a page at a time — a plain
 * phone-book to look someone up for a WhatsApp recommendation or an in-app "Recommended For You"
 * pick, not just a search box that only works once you already know who you're looking for.
 */
export function CustomersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load(q: string, targetPage: number) {
    setIsLoading(true);
    setLoadError(null);
    try {
      const { data } = await adminClient.get<{ customers: CustomerSummary[]; total: number }>("/admin/customers", {
        params: { q: q || undefined, page: targetPage, pageSize: PAGE_SIZE },
      });
      setResults(data.customers);
      setTotal(data.total);
    } catch (err) {
      setLoadError(extractErrorMessage(err, "Failed to load customers"));
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load(query, page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    load(query, 1);
  }

  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Every registered customer and their phone number — browse the full list, or search to jump straight to one."
      />

      <Card className="mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            placeholder="Search by name, phone, or email — or leave blank to browse everyone"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Loading…" : "Search"}
          </Button>
        </form>
      </Card>

      <Card>
        {loadError ? (
          <p className="text-sm font-medium text-danger">{loadError}</p>
        ) : isLoading ? (
          <p className="text-sm text-muted">Loading…</p>
        ) : results.length === 0 ? (
          <EmptyState message="No matching customers." />
        ) : (
          <>
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th>Joined</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {results.map((customer) => (
                  <Tr key={customer.id}>
                    <Td className="font-semibold">{customer.fullName}</Td>
                    <Td>{customer.phone ?? "—"}</Td>
                    <Td>{customer.email ?? "—"}</Td>
                    <Td>{customer.createdAt ? new Date(customer.createdAt).toLocaleDateString() : "—"}</Td>
                    <Td>
                      <Link to={`/customers/${customer.id}`} className="text-sm font-semibold text-primary-dark hover:underline">
                        View ›
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>

            {lastPage > 1 && (
              <div className="mt-4 flex items-center justify-between text-sm text-muted">
                <span>
                  {total} customer{total === 1 ? "" : "s"} · page {page} of {lastPage}
                </span>
                <div className="flex gap-2">
                  <Button variant="secondary" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                    ‹ Prev
                  </Button>
                  <Button variant="secondary" disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
                    Next ›
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}
