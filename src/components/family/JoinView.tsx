"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useFamilyStore } from "@/store/familyStore";
import { api } from "@/lib/api";
import Button from "@/components/ui/Button";
import Spinner from "@/components/ui/Spinner";
import type { Family } from "@/types";

export default function JoinView({ code }: { code: string }) {
  const router = useRouter();
  const { token } = useAuthStore();
  const { setFamilies } = useFamilyStore();
  const [info, setInfo] = useState<{ family: { id: string; name: string } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  useEffect(() => {
    fetch(`/api/join/${code}`)
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setError("Invalid or expired invite link"))
      .finally(() => setLoading(false));
  }, [code]);

  const handleJoin = async () => {
    if (!token) {
      router.push(`/auth?redirect=/join/${code}`);
      return;
    }
    setJoining(true);
    try {
      await api.post(`/api/join/${code}`, {});
      const families = await api.get<Family[]>("/api/families");
      setFamilies(families);
      setDone(true);
      setTimeout(() => router.replace("/feed"), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="bg-bg-2 border border-border rounded-2xl p-6 shadow-card text-center">
          {loading ? (
            <Spinner />
          ) : done ? (
            <>
              <div className="w-12 h-12 bg-success/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-success text-2xl">✓</span>
              </div>
              <p className="text-text font-medium">Joined successfully!</p>
              <p className="text-text-muted text-sm mt-1">Redirecting...</p>
            </>
          ) : error ? (
            <>
              <p className="text-error font-medium">{error}</p>
              <Button
                variant="secondary"
                className="mt-4"
                onClick={() => router.push("/")}
              >
                Go Home
              </Button>
            </>
          ) : (
            <>
              <div className="w-12 h-12 bg-accent-muted border border-accent/30 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <span className="text-accent text-xl">👪</span>
              </div>
              <h1 className="text-lg font-semibold text-text">
                Join {info?.family?.name}
              </h1>
              <p className="text-text-muted text-sm mt-2 mb-5">
                You&apos;ve been invited to join this family on Family Circle.
              </p>
              <Button onClick={handleJoin} loading={joining} className="w-full">
                {token ? "Join Family" : "Sign in to Join"}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
