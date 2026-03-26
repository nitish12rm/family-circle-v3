"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";

export default function AuthForm() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [form, setForm] = useState({ name: "", email: "", password: "", gender: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "signup" ? "/api/auth/signup" : "/api/auth/signin";
      const body =
        mode === "signup"
          ? { name: form.name, email: form.email, password: form.password, gender: form.gender || undefined }
          : { email: form.email, password: form.password };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong");

      setAuth(data.token, data.user);
      if (mode === "signup") {
        router.replace("/onboarding");
      } else {
        router.replace(data.onboarding_complete ? "/feed" : "/onboarding");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-muted border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-glow">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
              <circle cx="16" cy="10" r="5" fill="#7C5CFC" />
              <circle cx="7" cy="22" r="4" fill="#7C5CFC" opacity="0.7" />
              <circle cx="25" cy="22" r="4" fill="#7C5CFC" opacity="0.7" />
              <line x1="16" y1="15" x2="7" y2="18" stroke="#7C5CFC" strokeWidth="1.5" opacity="0.5" />
              <line x1="16" y1="15" x2="25" y2="18" stroke="#7C5CFC" strokeWidth="1.5" opacity="0.5" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-text">Family Circle</h1>
          <p className="text-text-muted text-sm mt-1">
            Your private family network
          </p>
        </div>

        {/* Card */}
        <div className="bg-bg-2 border border-border rounded-2xl p-6 shadow-card">
          <h2 className="text-lg font-semibold text-text mb-5">
            {mode === "signin" ? "Welcome back" : "Create account"}
          </h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {mode === "signup" && (
              <>
                <Input
                  label="Full Name"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  required
                />
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-text-muted">Gender</label>
                  <div className="flex gap-2">
                    {[
                      { value: "male", label: "Male" },
                      { value: "female", label: "Female" },
                      { value: "other", label: "Other" },
                    ].map((g) => (
                      <button
                        key={g.value}
                        type="button"
                        onClick={() => setForm({ ...form, gender: form.gender === g.value ? "" : g.value })}
                        className={`flex-1 py-2 text-sm rounded-xl border transition-all ${
                          form.gender === g.value
                            ? "border-accent bg-accent-muted text-accent"
                            : "border-border bg-bg-3 text-text-muted"
                        }`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />

            {error && (
              <p className="text-sm text-error bg-error/10 border border-error/20 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <Button type="submit" loading={loading} className="w-full mt-1">
              {mode === "signin" ? "Sign In" : "Create Account"}
            </Button>
          </form>

          <div className="mt-5 text-center">
            <button
              onClick={() => {
                setMode(mode === "signin" ? "signup" : "signin");
                setError("");
              }}
              className="text-sm text-text-muted hover:text-accent transition-colors"
            >
              {mode === "signin"
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
