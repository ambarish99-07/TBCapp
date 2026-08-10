import { Link, useLocation } from "react-router-dom";

const LINKS = [
  { to: "/orders", label: "Orders" },
  { to: "/bulk-orders", label: "Bulk Orders" },
];

export function AdminNav() {
  const location = useLocation();
  return (
    <nav style={{ display: "flex", gap: 16, marginBottom: 24, borderBottom: "1px solid #E4DCD3", paddingBottom: 8 }}>
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
