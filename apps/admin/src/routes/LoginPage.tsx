import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAdminAuth } from "../auth/AdminAuthContext.js";
import { Button } from "../components/ui/Button.js";
import { Input } from "../components/ui/Input.js";

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
    <div className="flex min-h-screen items-center justify-center bg-surface/40">
      <form onSubmit={handleSubmit} className="w-full max-w-sm rounded-xl border border-border bg-white p-8 shadow-sm">
        <h1 className="mb-1 text-xl font-extrabold text-primary-dark">Lickyeat</h1>
        <p className="mb-6 text-sm text-muted">Sign in to the admin dashboard</p>
        <div className="flex flex-col gap-3">
          <Input placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} type="email" />
          <Input placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} type="password" />
        </div>
        {error && <p className="mt-3 text-sm font-medium text-danger">{error}</p>}
        <Button type="submit" className="mt-5 w-full">
          Log In
        </Button>
      </form>
    </div>
  );
}
