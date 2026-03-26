"use client";
import { useState, useEffect, useMemo } from "react";
import {
  Camera, Grid3X3, FileText, GraduationCap, Target, Calendar,
  Eye, Download, Lock, Globe, ChevronDown, Search, Settings, X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Input, Textarea } from "@/components/ui/Input";
import DocPreviewModal from "@/components/documents/DocPreviewModal";
import { compressImage } from "@/lib/imageCompression";
import type { Profile, Document } from "@/types";
import { DOCUMENT_CATEGORIES } from "@/types";

interface OwnPost {
  id: string;
  content: string;
  media_urls: string[];
  family_id: string;
  created_at: string;
}

interface ProfileData {
  profile: { id: string; name: string; avatar?: string; status?: string; dob?: string; education?: string; goals?: string; gender?: string; created_at: string };
  posts: OwnPost[];
  documents: (Document & { category: string })[];
  stats: { posts: number; families: number };
}

type Tab = "posts" | "documents";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📄";
  if (mimeType.includes("word")) return "📝";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "📊";
  return "📎";
}

export default function ProfileView() {
  const { user, profile: storeProfile, setProfile } = useAuthStore();
  const { showToast } = useUIStore();
  const router = useRouter();

  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("posts");

  // Edit modal
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", phone: "", status: "", education: "", goals: "", gender: "" });
  const [saving, setSaving] = useState(false);

  // Avatar upload
  const [uploading, setUploading] = useState(false);

  // Documents
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);

  useEffect(() => {
    if (!user) return;
    api.get<ProfileData>(`/api/profiles/${user.id}`)
      .then(setData)
      .catch(() => showToast("Failed to load profile", "error"))
      .finally(() => setLoading(false));
  }, [user, showToast]);

  const openEdit = () => {
    setForm({
      name: storeProfile?.name ?? "",
      dob: storeProfile?.dob ?? "",
      phone: storeProfile?.phone ?? "",
      status: storeProfile?.status ?? "",
      education: storeProfile?.education ?? "",
      goals: storeProfile?.goals ?? "",
      gender: storeProfile?.gender ?? "",
    });
    setEditOpen(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.patch<Profile>("/api/profile", form);
      setProfile(updated);
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, ...updated } } : prev);
      setEditOpen(false);
      showToast("Profile updated!", "success");
    } catch {
      showToast("Failed to save", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = file.type.startsWith("image/") ? await compressImage(file) : file;
      const formData = new FormData();
      formData.append("file", compressed);
      formData.append("folder", "family-circle-v3/avatars");
      const { url } = await api.upload<{ url: string }>("/api/upload", formData);
      const updated = await api.patch<Profile>("/api/profile", { avatar: url });
      setProfile(updated);
      setData((prev) => prev ? { ...prev, profile: { ...prev.profile, avatar: url } } : prev);
      showToast("Photo updated!", "success");
    } catch {
      showToast("Failed to upload photo", "error");
    } finally {
      setUploading(false);
    }
  };

  // Documents filtering + grouping
  const docs = data?.documents ?? [];
  const presentCategories = useMemo(() => {
    const cats = Array.from(new Set(docs.map((d) => d.category || "Other")));
    return ["All", ...cats];
  }, [docs]);

  const filteredDocs = useMemo(() => {
    return docs.filter((d) => {
      const q = search.toLowerCase();
      const matchSearch = !q || d.name.toLowerCase().includes(q) || (d.description ?? "").toLowerCase().includes(q);
      const matchCat = activeCategory === "All" || (d.category || "Other") === activeCategory;
      return matchSearch && matchCat;
    });
  }, [docs, search, activeCategory]);

  const groupedDocs = useMemo(() => {
    const map: Record<string, typeof filteredDocs> = {};
    for (const doc of filteredDocs) {
      const key = doc.category || "Other";
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    }
    return Object.entries(map);
  }, [filteredDocs]);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Spinner /></div>;
  }

  const profile = data?.profile;
  const posts = data?.posts ?? [];
  const stats = data?.stats ?? { posts: 0, families: 0 };

  return (
    <div className="max-w-xl mx-auto pb-6">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-bg z-10 border-b border-border">
        <h1 className="font-semibold text-text text-base">{profile?.name ?? "Profile"}</h1>
        <button
          onClick={() => router.push("/family")}
          className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Profile header — Instagram style */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-6 mb-4">
          {/* Avatar */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full ring-2 ring-accent/30 overflow-hidden">
              <Avatar src={profile?.avatar} name={profile?.name ?? ""} size={80} />
            </div>
            <label className="absolute -bottom-0.5 -right-0.5 w-6 h-6 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent-hover transition-colors shadow-md">
              {uploading
                ? <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                : <Camera size={11} className="text-white" />}
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
            </label>
          </div>

          {/* Stats */}
          <div className="flex-1 flex justify-around">
            <div className="text-center">
              <p className="text-lg font-bold text-text leading-none">{stats.posts}</p>
              <p className="text-xs text-text-muted mt-1">Posts</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-text leading-none">{stats.families}</p>
              <p className="text-xs text-text-muted mt-1">Families</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-text leading-none">{docs.length}</p>
              <p className="text-xs text-text-muted mt-1">Docs</p>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div className="mb-3">
          <p className="text-sm font-semibold text-text">{profile?.name}</p>
          {profile?.status && <p className="text-sm text-text-muted mt-0.5">{profile.status}</p>}
          <div className="flex flex-col gap-1 mt-1.5">
            {profile?.education && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <GraduationCap size={12} className="text-text-faint shrink-0" /> {profile.education}
              </p>
            )}
            {profile?.dob && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <Calendar size={12} className="text-text-faint shrink-0" /> Born {profile.dob}
              </p>
            )}
            {profile?.goals && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <Target size={12} className="text-text-faint shrink-0" /> {profile.goals}
              </p>
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <button
            onClick={openEdit}
            className="flex-1 py-1.5 text-sm font-semibold border border-border rounded-lg bg-bg-2 hover:bg-bg-3 text-text transition-colors"
          >
            Edit Profile
          </button>
          <button
            onClick={() => router.push("/documents")}
            className="flex-1 py-1.5 text-sm font-semibold border border-border rounded-lg bg-bg-2 hover:bg-bg-3 text-text transition-colors flex items-center justify-center gap-1.5"
          >
            <FileText size={14} /> Documents
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-y border-border sticky top-[52px] bg-bg z-10">
        <button
          onClick={() => setTab("posts")}
          className={`flex-1 flex items-center justify-center py-3 transition-colors border-b-2 ${
            tab === "posts" ? "border-text text-text" : "border-transparent text-text-faint"
          }`}
        >
          <Grid3X3 size={18} strokeWidth={tab === "posts" ? 2.5 : 1.8} />
        </button>
        <button
          onClick={() => setTab("documents")}
          className={`flex-1 flex items-center justify-center py-3 transition-colors border-b-2 ${
            tab === "documents" ? "border-text text-text" : "border-transparent text-text-faint"
          }`}
        >
          <FileText size={18} strokeWidth={tab === "documents" ? 2.5 : 1.8} />
        </button>
      </div>

      {/* Posts grid — Instagram 3-column */}
      {tab === "posts" && (
        posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Grid3X3 size={36} className="text-text-faint" />
            <p className="text-text-muted text-sm">No posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-px bg-border">
            {posts.map((post) => {
              const media = post.media_urls ?? [];
              return (
                <button
                  key={post.id}
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="aspect-square bg-bg-3 overflow-hidden relative group"
                >
                  {media.length > 0 ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={media[0]}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      {media.length > 1 && (
                        <div className="absolute top-1.5 right-1.5 w-4 h-4 bg-black/60 rounded flex items-center justify-center">
                          <Grid3X3 size={8} className="text-white" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-bg-2 group-hover:bg-bg-3 transition-colors">
                      <p className="text-[10px] text-text-muted text-center line-clamp-4 leading-relaxed">
                        {post.content}
                      </p>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Documents tab */}
      {tab === "documents" && (
        <div className="px-4 py-4 flex flex-col gap-4">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText size={36} className="text-text-faint" />
              <p className="text-text-muted text-sm">No documents yet.</p>
              <button
                onClick={() => router.push("/documents")}
                className="text-accent text-xs font-medium mt-1"
              >
                Upload a document
              </button>
            </div>
          ) : (
            <>
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-faint" />
                <input
                  type="text"
                  placeholder="Search documents…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-bg-2 border border-border rounded-xl pl-8 pr-4 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>

              {/* Category chips */}
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {presentCategories.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      activeCategory === cat
                        ? "bg-accent text-white"
                        : "bg-bg-2 border border-border text-text-muted hover:text-text"
                    }`}
                  >
                    {cat}
                    {cat !== "All" && (
                      <span className="ml-1 opacity-60">
                        {docs.filter((d) => (d.category || "Other") === cat).length}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {filteredDocs.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-8">No documents match.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {groupedDocs.map(([cat, catDocs]) => (
                    <div key={cat} className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
                          {cat}
                        </span>
                        <span className="text-xs text-text-faint">{catDocs.length} doc{catDocs.length !== 1 ? "s" : ""}</span>
                        <div className="flex-1 h-px bg-border" />
                      </div>
                      <div className="flex flex-col gap-2">
                        {catDocs.map((doc) => (
                          <div key={doc.id} className="flex items-center gap-3 bg-bg-2 border border-border rounded-2xl p-4">
                            <div className="w-10 h-10 bg-bg-3 rounded-xl flex items-center justify-center shrink-0 text-lg">
                              {fileIcon(doc.mime_type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-text truncate">{doc.name}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded-md flex items-center gap-0.5 ${
                                  doc.visibility === "public"
                                    ? "bg-green-500/10 text-green-400"
                                    : "bg-bg-3 text-text-faint"
                                }`}>
                                  {doc.visibility === "public" ? <Globe size={10} /> : <Lock size={10} />}
                                  {doc.visibility === "public" ? "Public" : "Private"}
                                </span>
                                <span className="text-xs text-text-faint">
                                  {formatBytes(doc.file_size)}
                                </span>
                              </div>
                              {doc.description && (
                                <p className="text-xs text-text-faint mt-1 truncate">{doc.description}</p>
                              )}
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <button
                                onClick={() => setPreviewDoc(doc)}
                                className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                              >
                                <Eye size={14} />
                              </button>
                              <a
                                href={doc.file_path}
                                target="_blank"
                                rel="noreferrer"
                                className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                              >
                                <Download size={14} />
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Edit Profile modal */}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title="Edit Profile">
        <div className="flex flex-col gap-4">
          {/* Avatar in modal */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full overflow-hidden ring-2 ring-border">
                <Avatar src={storeProfile?.avatar} name={storeProfile?.name ?? ""} size={80} />
              </div>
              <label className="absolute -bottom-0.5 -right-0.5 w-7 h-7 bg-accent rounded-full flex items-center justify-center cursor-pointer hover:bg-accent-hover transition-colors shadow-md">
                {uploading
                  ? <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <Camera size={13} className="text-white" />}
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploading} />
              </label>
            </div>
          </div>

          <Input
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <Input
            label="Bio / Status"
            placeholder="e.g. Parent, Engineer, Dog lover…"
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value })}
          />

          {/* Gender */}
          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-medium text-text-muted">Gender</label>
            <div className="flex gap-2">
              {[{ value: "male", label: "Male" }, { value: "female", label: "Female" }, { value: "other", label: "Other" }].map((g) => (
                <button
                  key={g.value}
                  type="button"
                  onClick={() => setForm({ ...form, gender: form.gender === g.value ? "" : g.value })}
                  className={`flex-1 py-2 text-sm rounded-xl border transition-all ${
                    form.gender === g.value ? "border-accent bg-accent-muted text-accent" : "border-border bg-bg-3 text-text-muted"
                  }`}
                >
                  {g.label}
                </button>
              ))}
            </div>
          </div>

          <Input label="Date of Birth" type="date" value={form.dob} onChange={(e) => setForm({ ...form, dob: e.target.value })} />
          <Input label="Phone" type="tel" placeholder="+91 XXXXX XXXXX" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Input label="Education" placeholder="e.g. B.Tech Computer Science" value={form.education} onChange={(e) => setForm({ ...form, education: e.target.value })} />
          <Textarea label="Goals" placeholder="What are your goals?" value={form.goals} onChange={(e) => setForm({ ...form, goals: e.target.value })} rows={2} />

          <Button onClick={handleSave} loading={saving} className="w-full">Save</Button>
        </div>
      </Modal>

      <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
