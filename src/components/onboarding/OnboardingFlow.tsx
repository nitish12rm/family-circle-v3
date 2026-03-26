"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { useFamilyStore } from "@/store/familyStore";
import { api } from "@/lib/api";
import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Profile, Family } from "@/types";

type Step = "profile" | "family";

export default function OnboardingFlow() {
  const router = useRouter();
  const { token, user, setProfile } = useAuthStore();
  const { setFamilies, addFamily } = useFamilyStore();
  const [step, setStep] = useState<Step>("profile");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [profileForm, setProfileForm] = useState({
    phone: "",
    dob: "",
    status: "",
  });
  const [familyMode, setFamilyMode] = useState<"create" | "join">("create");
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  useEffect(() => {
    if (!token) router.replace("/auth");
  }, [token, router]);

  const handleProfileNext = async () => {
    setLoading(true);
    setError("");
    try {
      const p = await api.patch<Profile>("/api/profile", profileForm);
      setProfile(p);
      setStep("family");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setLoading(false);
    }
  };

  const handleFamilyCreate = async () => {
    if (!familyName.trim()) {
      setError("Family name is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const family = await api.post<Family>("/api/families", {
        name: familyName,
      });
      addFamily(family);
      await completeOnboarding();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setLoading(false);
    }
  };

  const handleFamilyJoin = async () => {
    if (!inviteCode.trim()) {
      setError("Invite code is required");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await api.post<{ family: Family }>(`/api/join/${inviteCode.trim()}`, {});
      const families = await api.get<Family[]>("/api/families");
      setFamilies(families);
      // Go to tree so the placement modal fires automatically
      await completeOnboarding("/tree");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
      setLoading(false);
    }
  };

  const completeOnboarding = async (nextRoute = "/feed") => {
    const p = await api.patch<Profile>("/api/profile", {
      onboarding_complete: true,
    });
    setProfile(p);
    router.replace(nextRoute);
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Steps indicator */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {(["profile", "family"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-all ${
                  step === s
                    ? "bg-accent text-white shadow-glow-sm"
                    : i < ["profile", "family"].indexOf(step)
                    ? "bg-success text-white"
                    : "bg-bg-3 text-text-muted"
                }`}
              >
                {i + 1}
              </div>
              {i < 1 && <div className="w-8 h-px bg-border" />}
            </div>
          ))}
        </div>

        <div className="bg-bg-2 border border-border rounded-2xl p-6 shadow-card">
          {step === "profile" && (
            <>
              <h2 className="text-lg font-semibold text-text mb-1">
                About You
              </h2>
              <p className="text-sm text-text-muted mb-5">
                Tell us a bit about yourself, {user?.name?.split(" ")[0]}.
              </p>
              <div className="flex flex-col gap-4">
                <Input
                  label="Date of Birth"
                  type="date"
                  value={profileForm.dob}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, dob: e.target.value })
                  }
                />
                <Input
                  label="Phone"
                  type="tel"
                  placeholder="+1 (555) 000-0000"
                  value={profileForm.phone}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, phone: e.target.value })
                  }
                />
                <Input
                  label="Status / Bio"
                  placeholder="e.g. Parent, Student, Engineer..."
                  value={profileForm.status}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, status: e.target.value })
                  }
                />
                {error && (
                  <p className="text-sm text-error">{error}</p>
                )}
                <Button
                  onClick={handleProfileNext}
                  loading={loading}
                  className="w-full"
                >
                  Continue
                </Button>
                <button
                  onClick={() => setStep("family")}
                  className="text-sm text-text-muted hover:text-text text-center transition-colors"
                >
                  Skip for now
                </button>
              </div>
            </>
          )}

          {step === "family" && (
            <>
              <h2 className="text-lg font-semibold text-text mb-1">
                Your Family
              </h2>
              <p className="text-sm text-text-muted mb-5">
                Create a new family or join one with an invite code.
              </p>

              {/* Toggle */}
              <div className="flex bg-bg-3 rounded-xl p-1 mb-5">
                {(["create", "join"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setFamilyMode(m)}
                    className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
                      familyMode === m
                        ? "bg-bg-2 text-text shadow-sm"
                        : "text-text-muted"
                    }`}
                  >
                    {m === "create" ? "Create" : "Join"}
                  </button>
                ))}
              </div>

              <div className="flex flex-col gap-4">
                {familyMode === "create" ? (
                  <Input
                    label="Family Name"
                    placeholder="The Smith Family"
                    value={familyName}
                    onChange={(e) => setFamilyName(e.target.value)}
                  />
                ) : (
                  <Input
                    label="Invite Code"
                    placeholder="Enter 12-character code"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                  />
                )}

                {error && <p className="text-sm text-error">{error}</p>}

                <Button
                  onClick={
                    familyMode === "create"
                      ? handleFamilyCreate
                      : handleFamilyJoin
                  }
                  loading={loading}
                  className="w-full"
                >
                  {familyMode === "create" ? "Create Family" : "Join Family"}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
