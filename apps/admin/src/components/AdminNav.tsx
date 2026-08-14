import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/orders", label: "Orders" },
  { to: "/bulk-orders", label: "Bulk Orders" },
  { to: "/brands", label: "Brands" },
  { to: "/tiffin-plans", label: "Tiffin Plans" },
  { to: "/tiffin-deliveries", label: "Tiffin Deliveries" },
];

export function AdminNav() {
  const location = useLocation();
  return (
    <nav style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24, borderBottom: "1px solid #E4DCD3", paddingBottom: 8 }}>
      <span style={{ fontWeight: 800, color: "#E8792C", marginRight: 8 }}>Lickyeat</span>
      {LINKS.map((link) => (
        <Link
          key={link.to}
          to={link.to}
          style={{ fontWeight: location.pathname.startsWith(link.to) ? 700 : 400, color: "#6B3F2A", textDecoration: "none" }}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
