"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Copy, Check, UserPlus, Trash2, Users } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import Spinner from "@/components/ui/Spinner";
import type { FamilyMember, FamilyInvite, Family } from "@/types";

export default function FamilyView() {
  const { activeFamilyId, families, addFamily, setFamilies } = useFamilyStore();
  const { user } = useAuthStore();
  const { showToast } = useUIStore();
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [invites, setInvites] = useState<FamilyInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [familyName, setFamilyName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const appUrl =
    typeof window !== "undefined" ? window.location.origin : "";

  const loadData = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const [membersData, invitesData] = await Promise.all([
        api.get<FamilyMember[]>(`/api/families/${activeFamilyId}/members`),
        api.get<FamilyInvite[]>(`/api/families/${activeFamilyId}/invites`),
      ]);
      setMembers(membersData);
      setInvites(invitesData);
    } catch {
      showToast("Failed to load data", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast]);

  useEffect(() => {
    setLoading(true);
    loadData();
  }, [loadData]);

  const handleCreateFamily = async () => {
    if (!familyName.trim()) return;
    setCreating(true);
    try {
      const family = await api.post<Family>("/api/families", {
        name: familyName,
      });
      addFamily(family);
      setFamilyName("");
      setCreateOpen(false);
      showToast("Family created!", "success");
    } catch {
      showToast("Failed to create family", "error");
    } finally {
      setCreating(false);
    }
  };

  const handleJoinFamily = async () => {
    if (!inviteCode.trim()) return;
    setJoining(true);
    try {
      await api.post(`/api/join/${inviteCode.trim()}`, {});
      const updatedFamilies = await api.get<Family[]>("/api/families");
      setFamilies(updatedFamilies);
      setInviteCode("");
      setJoinOpen(false);
      showToast("Joined family!", "success");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Failed to join", "error");
    } finally {
      setJoining(false);
    }
  };

  const handleCreateInvite = async () => {
    if (!activeFamilyId) return;
    try {
      const invite = await api.post<FamilyInvite>(
        `/api/families/${activeFamilyId}/invites`,
        {}
      );
      setInvites((prev) => [...prev, invite]);
      showToast("Invite created!", "success");
    } catch {
      showToast("Failed to create invite", "error");
    }
  };

  const handleDeactivateInvite = async (inviteId: string) => {
    if (!activeFamilyId) return;
    try {
      await api.delete(
        `/api/families/${activeFamilyId}/invites?inviteId=${inviteId}`
      );
      setInvites((prev) => prev.filter((i) => i.id !== inviteId));
      showToast("Invite deactivated", "info");
    } catch {
      showToast("Failed to deactivate", "error");
    }
  };

  const copyInviteLink = (invite: FamilyInvite) => {
    const link = `${appUrl}/join/${invite.code}`;
    navigator.clipboard.writeText(link);
    setCopiedId(invite.id);
    setTimeout(() => setCopiedId(null), 2000);
    showToast("Link copied!", "success");
  };

  const activeFamily = families.find((f) => f.id === activeFamilyId);

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text">Family</h1>
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => setJoinOpen(true)}>
            <UserPlus size={14} /> Join
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> New
          </Button>
        </div>
      </div>

      {!activeFamilyId ? (
        <div className="text-center py-20">
          <Users size={40} className="mx-auto text-text-faint mb-3" />
          <p className="text-text-muted text-sm">No family yet.</p>
          <p className="text-text-faint text-xs mt-1">
            Create or join a family to get started.
          </p>
        </div>
      ) : (
        <>
          {/* Current family */}
          {activeFamily && (
            <div className="bg-bg-2 border border-border rounded-2xl p-4 mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-accent-muted border border-accent/30 rounded-xl flex items-center justify-center">
                  <Users size={18} className="text-accent" />
                </div>
                <div>
                  <p className="font-medium text-text">{activeFamily.name}</p>
                  <p className="text-xs text-text-muted">
                    {members.length} member{members.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Members */}
          <div className="bg-bg-2 border border-border rounded-2xl mb-4">
            <div className="px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Members</h2>
            </div>
            {loading ? (
              <div className="flex justify-center py-6">
                <Spinner />
              </div>
            ) : (
              <div className="divide-y divide-border">
                {members.map((member) => (
                  <div
                    key={member.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <Avatar
                      src={member.profile?.avatar}
                      name={member.profile?.name}
                      size={36}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text truncate">
                        {member.profile?.name ?? "Unknown"}
                        {member.user_id === user?.id && (
                          <span className="text-text-faint ml-1">(you)</span>
                        )}
                      </p>
                      <p className="text-xs text-text-muted">
                        {member.role === "admin" ? "Admin" : "Member"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invites */}
          <div className="bg-bg-2 border border-border rounded-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">Invite Links</h2>
              <button
                onClick={handleCreateInvite}
                className="text-xs text-accent hover:text-accent-hover transition-colors font-medium"
              >
                + New invite
              </button>
            </div>
            {invites.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-text-muted text-xs">
                  No active invites. Create one to share.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {invites.map((invite) => (
                  <div
                    key={invite.id}
                    className="flex items-center gap-3 px-4 py-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-text truncate">
                        {invite.code}
                      </p>
                      <p className="text-[10px] text-text-muted mt-0.5">
                        {invite.use_count}/{invite.max_uses} uses ·{" "}
                        {new Date(invite.expires_at) > new Date()
                          ? `Expires ${new Date(invite.expires_at).toLocaleDateString()}`
                          : "Expired"}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => copyInviteLink(invite)}
                        className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                      >
                        {copiedId === invite.id ? (
                          <Check size={14} className="text-success" />
                        ) : (
                          <Copy size={14} />
                        )}
                      </button>
                      <button
                        onClick={() => handleDeactivateInvite(invite.id)}
                        className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-error transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Family">
        <div className="flex flex-col gap-4">
          <Input
            label="Family Name"
            placeholder="The Smith Family"
            value={familyName}
            onChange={(e) => setFamilyName(e.target.value)}
          />
          <Button onClick={handleCreateFamily} loading={creating} className="w-full">
            Create
          </Button>
        </div>
      </Modal>

      {/* Join modal */}
      <Modal open={joinOpen} onClose={() => setJoinOpen(false)} title="Join Family">
        <div className="flex flex-col gap-4">
          <Input
            label="Invite Code"
            placeholder="Enter invite code"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
          />
          <Button onClick={handleJoinFamily} loading={joining} className="w-full">
            Join
          </Button>
        </div>
      </Modal>
    </div>
  );
}
