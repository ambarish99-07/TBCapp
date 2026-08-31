import type { User } from "@tbc/shared-types";
import { useState } from "react";
import { Link } from "react-router-dom";
import { adminClient } from "../api/adminClient.js";
import { Button } from "../components/ui/Button.js";
import { Card } from "../components/ui/Card.js";
import { EmptyState } from "../components/ui/EmptyState.js";
import { Input } from "../components/ui/Input.js";
import { PageHeader } from "../components/ui/PageHeader.js";
import { Table, Td, Th, Thead, Tr } from "../components/ui/Table.js";

type CustomerSummary = Pick<User, "id" | "fullName" | "phone" | "email">;

export function CustomersPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CustomerSummary[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    const { data } = await adminClient.get<{ customers: CustomerSummary[] }>("/admin/customers", { params: { q: query.trim() } });
    setResults(data.customers);
    setIsSearching(false);
  }

  return (
    <div>
      <PageHeader title="Customers" description="Look up a customer's order history and send them a product recommendation." />

      <Card className="mb-6">
        <form onSubmit={handleSearch} className="flex items-center gap-2">
          <Input
            placeholder="Search by name, phone, or email"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1"
          />
          <Button type="submit" disabled={isSearching}>
            {isSearching ? "Searching…" : "Search"}
          </Button>
        </form>
      </Card>

      {hasSearched && (
        <Card>
          {results.length === 0 ? (
            <EmptyState message="No matching customers." />
          ) : (
            <Table>
              <Thead>
                <Tr>
                  <Th>Name</Th>
                  <Th>Phone</Th>
                  <Th>Email</Th>
                  <Th></Th>
                </Tr>
              </Thead>
              <tbody>
                {results.map((customer) => (
                  <Tr key={customer.id}>
                    <Td className="font-semibold">{customer.fullName}</Td>
                    <Td>{customer.phone ?? "—"}</Td>
                    <Td>{customer.email ?? "—"}</Td>
                    <Td>
                      <Link to={`/customers/${customer.id}`} className="text-sm font-semibold text-primary-dark hover:underline">
                        View ›
                      </Link>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}
    </div>
  );
}
