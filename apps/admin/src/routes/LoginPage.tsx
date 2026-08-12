import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext.js";

export function LoginPage() {
  const { login } = useAdminAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await login({ identifier: email, password });
      navigate("/orders");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    }
  }

  return (
    <div style={{ maxWidth: 360, margin: "80px auto" }}>
      <h1>Lickyeat Admin</h1>
      <form onSubmit={handleSubmit}>
        <div>
          <input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
        </div>
        <div style={{ marginTop: 8 }}>
          <input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </div>
        {error && <p style={{ color: "#B3261E" }}>{error}</p>}
        <button type="submit" style={{ marginTop: 16 }}>
          Log In
        </button>
      </form>
    </div>
  );
}
