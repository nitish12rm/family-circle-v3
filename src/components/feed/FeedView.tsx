"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { RefreshCw, ImagePlus, X, SlidersHorizontal } from "lucide-react";
import { useFamilyStore } from "@/store/familyStore";
import { useAuthStore } from "@/store/authStore";
import { useUIStore } from "@/store/uiStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Spinner from "@/components/ui/Spinner";
import { Textarea } from "@/components/ui/Input";
import PostCard from "@/components/post/PostCard";
import { compressImage } from "@/lib/imageCompression";
import type { Post, FamilyMember } from "@/types";
import { FEED_TAGS } from "@/types";

const TAG_STYLE: Record<string, { bg: string; text: string; border: string }> = {
  urgent:    { bg: "bg-red-500/15",     text: "text-red-400",     border: "border-red-500/30" },
  traveling: { bg: "bg-blue-500/15",    text: "text-blue-400",    border: "border-blue-500/30" },
  scenery:   { bg: "bg-emerald-500/15", text: "text-emerald-400", border: "border-emerald-500/30" },
  festival:  { bg: "bg-yellow-500/15",  text: "text-yellow-400",  border: "border-yellow-500/30" },
  funny:     { bg: "bg-pink-500/15",    text: "text-pink-400",    border: "border-pink-500/30" },
  food:      { bg: "bg-orange-500/15",  text: "text-orange-400",  border: "border-orange-500/30" },
  milestone: { bg: "bg-purple-500/15",  text: "text-purple-400",  border: "border-purple-500/30" },
  memory:    { bg: "bg-indigo-500/15",  text: "text-indigo-400",  border: "border-indigo-500/30" },
};

function formatLastSeen(lastSeen: string | null | undefined): string {
  if (!lastSeen) return "";
  const diffMs = Date.now() - new Date(lastSeen).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function FeedView() {
  const { activeFamilyId } = useFamilyStore();
  const { profile } = useAuthStore();
  const { showToast, openCreatePost, setOpenCreatePost } = useUIStore();

  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);

  // Create post
  const [createOpen, setCreateOpen] = useState(false);
  const [content, setContent] = useState("");
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [posting, setPosting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filters
  const [filterOpen, setFilterOpen] = useState(false);
  const [filterAuthorId, setFilterAuthorId] = useState("");
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const [filterDate, setFilterDate] = useState<"today" | "week" | "month" | "custom" | "">("");
  const [filterCustomFrom, setFilterCustomFrom] = useState("");
  const [filterCustomTo, setFilterCustomTo] = useState("");

  const activeFilterCount = (filterAuthorId ? 1 : 0) + (filterTags.length > 0 ? 1 : 0) + (filterDate ? 1 : 0);

  const loadPosts = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const data = await api.get<Post[]>(`/api/families/${activeFamilyId}/posts`);
      setPosts(data);
    } catch {
      showToast("Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast]);

  const loadMembers = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const data = await api.get<FamilyMember[]>(`/api/families/${activeFamilyId}/members`);
      setFamilyMembers(data);
    } catch { /* silent */ }
  }, [activeFamilyId]);

  useEffect(() => {
    setLoading(true);
    loadPosts();
    loadMembers();
  }, [loadPosts, loadMembers]);

  useEffect(() => {
    const interval = setInterval(loadPosts, 10000);
    return () => clearInterval(interval);
  }, [loadPosts]);

  // Open create modal when triggered from FAB
  useEffect(() => {
    if (openCreatePost) {
      setOpenCreatePost(false);
      setCreateOpen(true);
    }
  }, [openCreatePost, setOpenCreatePost]);

  // Client-side filtering
  const filteredPosts = posts.filter((post) => {
    if (filterAuthorId && post.author_id !== filterAuthorId) return false;
    if (filterTags.length > 0 && !filterTags.every((t) => post.tags?.includes(t))) return false;
    if (filterDate) {
      const postDate = new Date(post.created_at);
      const now = new Date();
      if (filterDate === "today") {
        if (postDate.toDateString() !== now.toDateString()) return false;
      } else if (filterDate === "week") {
        if (postDate < new Date(now.getTime() - 7 * 86400000)) return false;
      } else if (filterDate === "month") {
        if (postDate < new Date(now.getTime() - 30 * 86400000)) return false;
      } else if (filterDate === "custom") {
        // Skip filter if dates are invalid (from > to)
        const rangeValid = !(filterCustomFrom && filterCustomTo && filterCustomFrom > filterCustomTo);
        if (rangeValid) {
          if (filterCustomFrom && postDate < new Date(filterCustomFrom)) return false;
          if (filterCustomTo) {
            const toEnd = new Date(filterCustomTo);
            toEnd.setHours(23, 59, 59, 999);
            if (postDate > toEnd) return false;
          }
        }
      }
    }
    return true;
  });

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    const toProcess = files.slice(0, 4 - mediaUrls.length);
    if (fileInputRef.current) fileInputRef.current.value = "";
    setUploading(true);
    try {
      const urls = await Promise.all(toProcess.map(async (file) => {
        const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
        const fd = new FormData();
        fd.append("file", toUpload);
        fd.append("folder", "family-circle-v3/posts");
        return (await api.upload<{ url: string }>("/api/upload", fd)).url;
      }));
      setMediaUrls((prev) => [...prev, ...urls]);
    } catch {
      showToast("Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleEdit = (postId: string, content: string, mediaUrls: string[], tags: string[]) => {
    setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, content, media_urls: mediaUrls, tags } : p));
  };

  const handlePost = async () => {
    if (!content.trim() || !activeFamilyId) return;
    setPosting(true);
    try {
      const post = await api.post<Post>(`/api/families/${activeFamilyId}/posts`, {
        content,
        media_urls: mediaUrls,
        tags: selectedTags,
      });
      setPosts((prev) => [post, ...prev]);
      setContent("");
      setMediaUrls([]);
      setSelectedTags([]);
      setCreateOpen(false);
      showToast("Posted!", "success");
    } catch {
      showToast("Failed to post", "error");
    } finally {
      setPosting(false);
    }
  };

  const handleDelete = async (postId: string) => {
    if (!activeFamilyId) return;
    try {
      await api.delete(`/api/families/${activeFamilyId}/posts?postId=${postId}`);
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast("Post deleted", "info");
    } catch {
      showToast("Failed to delete post", "error");
    }
  };

  const clearFilters = () => { setFilterAuthorId(""); setFilterTags([]); setFilterDate(""); setFilterCustomFrom(""); setFilterCustomTo(""); };

  if (!activeFamilyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-20 text-center">
        <p className="text-text-muted">No family selected.</p>
        <Button variant="secondary" onClick={() => window.location.href = "/family"}>Go to Family</Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-semibold text-text">Feed</h1>
        <div className="flex gap-2">
          <button onClick={() => { setLoading(true); loadPosts(); }} className="p-2 rounded-xl hover:bg-bg-2 text-text-muted hover:text-text transition-colors">
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <button
            onClick={() => setFilterOpen((v) => !v)}
            className={`relative p-2 rounded-xl transition-colors ${filterOpen || activeFilterCount > 0 ? "bg-accent/15 text-accent" : "hover:bg-bg-2 text-text-muted hover:text-text"}`}
          >
            <SlidersHorizontal size={16} />
            {activeFilterCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-accent rounded-full text-[9px] text-white flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {filterOpen && (
        <div className="bg-bg-2 border border-border rounded-2xl p-3 mb-3 flex flex-col gap-3 overflow-hidden">
          {/* Members with last seen */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-text-faint uppercase tracking-wide px-0.5">Member</span>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {familyMembers.map((fm) => {
                const active = filterAuthorId === fm.user_id;
                const ls = fm.profile ? formatLastSeen((fm.profile as { last_seen?: string | null }).last_seen) : "";
                return (
                  <button
                    key={fm.user_id}
                    onClick={() => setFilterAuthorId(active ? "" : fm.user_id)}
                    className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl border transition-colors whitespace-nowrap shrink-0 ${active ? "border-accent bg-accent/10 text-accent" : "border-border bg-bg text-text-muted"}`}
                  >
                    <Avatar src={fm.profile?.avatar} name={fm.profile?.name} size={22} />
                    <div className="flex flex-col items-start leading-none gap-0.5">
                      <span className="text-xs font-medium">{fm.profile?.name ?? "Unknown"}</span>
                      {ls && <span className="text-[9px] text-text-faint">{ls}</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tags filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-text-faint uppercase tracking-wide px-0.5">Tags</span>
            <div className="flex flex-wrap gap-1.5">
              {FEED_TAGS.map((tag) => {
                const active = filterTags.includes(tag.id);
                const s = TAG_STYLE[tag.id];
                return (
                  <button
                    key={tag.id}
                    onClick={() => setFilterTags((prev) => active ? prev.filter((t) => t !== tag.id) : [...prev, tag.id])}
                    className={`text-[11px] px-2.5 py-1 rounded-full border font-medium transition-all ${active ? `${s.bg} ${s.text} ${s.border}` : "bg-bg text-text-muted border-border"}`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date filter */}
          <div className="flex flex-col gap-1.5">
            <span className="text-[10px] font-medium text-text-faint uppercase tracking-wide px-0.5">Time</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(["today", "week", "month", "custom"] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setFilterDate(filterDate === d ? "" : d)}
                  className={`py-2 rounded-xl border text-xs font-medium transition-colors ${filterDate === d ? "border-accent bg-accent/10 text-accent" : "border-border bg-bg text-text-muted"}`}
                >
                  {d === "today" ? "Today" : d === "week" ? "This week" : d === "month" ? "This month" : "Custom"}
                </button>
              ))}
            </div>
            {filterDate === "custom" && (
              <div className="flex flex-col gap-2 mt-1 bg-bg rounded-xl border border-border p-2.5">
                <p className="text-[10px] text-text-faint">Select a start and/or end date to filter posts.</p>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-text-muted px-0.5">From date</label>
                  <div className="w-full rounded-xl border border-border bg-bg-2 overflow-hidden focus-within:border-accent transition-colors">
                    <input
                      type="date"
                      value={filterCustomFrom}
                      max={filterCustomTo || undefined}
                      onChange={(e) => setFilterCustomFrom(e.target.value)}
                      className="w-full min-w-0 block bg-transparent px-3 py-2 text-sm text-text focus:outline-none"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[10px] font-medium text-text-muted px-0.5">To date</label>
                  <div className="w-full rounded-xl border border-border bg-bg-2 overflow-hidden focus-within:border-accent transition-colors">
                    <input
                      type="date"
                      value={filterCustomTo}
                      min={filterCustomFrom || undefined}
                      onChange={(e) => setFilterCustomTo(e.target.value)}
                      className="w-full min-w-0 block bg-transparent px-3 py-2 text-sm text-text focus:outline-none"
                    />
                  </div>
                </div>
                {filterCustomFrom && filterCustomTo && filterCustomFrom > filterCustomTo && (
                  <p className="text-[11px] text-red-400 px-0.5">Start date must be before end date.</p>
                )}
              </div>
            )}
          </div>

          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-xs text-text-faint hover:text-error transition-colors text-center">
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Active filter summary */}
      {!filterOpen && activeFilterCount > 0 && (
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          {filterAuthorId && (
            <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/30 px-2 py-0.5 rounded-full">
              {familyMembers.find((m) => m.user_id === filterAuthorId)?.profile?.name ?? "Member"}
              <button onClick={() => setFilterAuthorId("")}><X size={10} /></button>
            </span>
          )}
          {filterTags.map((t) => {
            const def = FEED_TAGS.find((f) => f.id === t);
            const s = TAG_STYLE[t];
            return (
              <span key={t} className={`flex items-center gap-1 text-xs border px-2 py-0.5 rounded-full ${s.bg} ${s.text} ${s.border}`}>
                {def?.emoji} {def?.label ?? t}
                <button onClick={() => setFilterTags((prev) => prev.filter((x) => x !== t))}><X size={10} /></button>
              </span>
            );
          })}
          {filterDate && (
            <span className="flex items-center gap-1 text-xs bg-accent/10 text-accent border border-accent/30 px-2 py-0.5 rounded-full">
              {filterDate === "today" ? "Today"
                : filterDate === "week" ? "This week"
                : filterDate === "month" ? "This month"
                : filterCustomFrom || filterCustomTo
                  ? `${filterCustomFrom || "…"} → ${filterCustomTo || "…"}`
                  : "Custom range"}
              <button onClick={() => { setFilterDate(""); setFilterCustomFrom(""); setFilterCustomTo(""); }}><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* Posts */}
      {loading && posts.length === 0 ? (
        <div className="flex justify-center py-20"><Spinner /></div>
      ) : filteredPosts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">{activeFilterCount > 0 ? "No posts match your filters." : "No posts yet."}</p>
          <p className="text-text-faint text-xs mt-1">{activeFilterCount > 0 ? "Try adjusting or clearing filters." : "Be the first to share something!"}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filteredPosts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onEdit={handleEdit}
              onLikeToggle={(postId, liked, likeCount) => {
                setPosts((prev) => prev.map((p) => p.id === postId ? { ...p, liked_by_me: liked, like_count: likeCount } : p));
              }}
            />
          ))}
        </div>
      )}

      {/* Create post modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setContent(""); setMediaUrls([]); setSelectedTags([]); if (fileInputRef.current) fileInputRef.current.value = ""; }}
        title="New Post"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Avatar src={profile?.avatar} name={profile?.name} size={36} />
            <Textarea placeholder="What's on your mind?" value={content} onChange={(e) => setContent(e.target.value)} rows={4} className="flex-1" />
          </div>

          {/* Tag picker */}
          <div className="flex flex-col gap-2">
            <span className="text-[11px] font-medium text-text-faint uppercase tracking-wide">Add tags</span>
            <div className="flex flex-wrap gap-2">
              {FEED_TAGS.map((tag) => {
                const active = selectedTags.includes(tag.id);
                const s = TAG_STYLE[tag.id];
                return (
                  <button
                    key={tag.id}
                    onClick={() => setSelectedTags((prev) => active ? prev.filter((t) => t !== tag.id) : [...prev, tag.id])}
                    className={`text-xs px-2.5 py-1 rounded-full border font-medium transition-all ${active ? `${s.bg} ${s.text} ${s.border}` : "bg-bg-2 text-text-muted border-border"}`}
                  >
                    {tag.emoji} {tag.label}
                  </button>
                );
              })}
            </div>
          </div>

          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="rounded-xl w-full h-28 object-cover" />
                  <button onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            {mediaUrls.length < 4 && (
              <label className="flex items-center gap-2 text-sm text-text-muted hover:text-text cursor-pointer transition-colors">
                {uploading ? <Spinner size={16} /> : <ImagePlus size={16} />}
                <span>{uploading ? "Uploading…" : `Add photo (${mediaUrls.length}/4)`}</span>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleMediaUpload} disabled={uploading} />
              </label>
            )}
            <Button onClick={handlePost} loading={posting} disabled={!content.trim()} size="sm">
              Post
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
