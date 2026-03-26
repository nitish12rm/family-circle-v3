"use client";
import { useState } from "react";
import { Camera } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { Input, Textarea } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import type { Profile } from "@/types";

export default function ProfileView() {
  const { profile, setProfile } = useAuthStore();
  const { showToast } = useUIStore();
  const [form, setForm] = useState({
    name: profile?.name ?? "",
    dob: profile?.dob ?? "",
    phone: profile?.phone ?? "",
    status: profile?.status ?? "",
    education: profile?.education ?? "",
    goals: profile?.goals ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Profile>("/api/profile", form);
      setProfile(updated);
      showToast("Profile saved!", "success");
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "family-circle-v3/avatars");
      const { url } = await api.upload<{ url: string }>("/api/upload", formData);
      const updated = await api.patch<Profile>("/api/profile", { avatar: url });
      setProfile(updated);
      showToast("Avatar updated!", "success");
    } catch {
      showToast("Failed to upload avatar", "error");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      <h1 className="text-lg font-semibold text-text mb-4">Profile</h1>

      {/* Avatar */}
      <div className="flex justify-center mb-6">
        <div className="relative">
          <Avatar src={profile?.avatar} name={profile?.name} size={80} />
          <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent-hover transition-colors">
            {uploading ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Camera size={13} className="text-white" />
            )}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </label>
        </div>
      </div>

      {/* Form */}
      <div className="bg-bg-2 border border-border rounded-2xl p-5">
        <div className="flex flex-col gap-4">
          <Input
            label="Full Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Email"
            value={profile?.email ?? ""}
            disabled
            className="opacity-60"
          />
          <Input
            label="Date of Birth"
            type="date"
            value={form.dob}
            onChange={(e) => setForm({ ...form, dob: e.target.value })}
          />
          <Input
            label="Phone"
            type="tel"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
          />
          <Input
            label="Status / Bio"
            placeholder="e.g. Parent, Engineer..."
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />
          <Input
            label="Education"
            placeholder="e.g. BS Computer Science"
            value={form.education}
            onChange={(e) => setForm({ ...form, education: e.target.value })}
          />
          <Textarea
            label="Goals"
            placeholder="What are your goals?"
            value={form.goals}
            onChange={(e) => setForm({ ...form, goals: e.target.value })}
            rows={3}
          />
          <Button onClick={handleSave} loading={saving} className="w-full">
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
}
