"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, FileText, Grid3X3, GraduationCap, Target, Calendar,
  Search, Eye, Download, MessageCircle, Globe, Lock, Heart,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import DocPreviewModal from "@/components/documents/DocPreviewModal";
import { downloadFile } from "@/lib/downloadFile";

interface PublicProfile {
  id: string;
  name: string;
  avatar?: string;
  status?: string;
  dob?: string;
  education?: string;
  goals?: string;
  gender?: string;
  created_at: string;
}

interface PublicPost {
  id: string;
  content: string;
  media_urls: string[];
  family_id: string;
  like_count?: number;
  comment_count?: number;
  created_at: string;
}

interface PublicDocument {
  id: string;
  name: string;
  file_path: string;
  file_size: number;
  mime_type: string;
  description?: string;
  category: string;
  visibility: string;
  created_at: string;
}

interface ProfileData {
  profile: PublicProfile;
  posts: PublicPost[];
  documents: PublicDocument[];
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

export default function UserProfileView({ userId }: { userId: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [data, setData] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("posts");
  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState("All");
  const [previewDoc, setPreviewDoc] = useState<PublicDocument | null>(null);

  useEffect(() => {
    api
      .get<ProfileData>(`/api/profiles/${userId}`)
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load profile"))
      .finally(() => setLoading(false));
  }, [userId]);

  const isOwnProfile = user?.id === userId;

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
    const map: Record<string, PublicDocument[]> = {};
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

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-text-muted text-sm">{error || "Profile not found"}</p>
        <button onClick={() => router.back()} className="text-accent text-sm">Go back</button>
      </div>
    );
  }

  const { profile, posts, stats } = data;

  return (
    <div className="max-w-xl mx-auto pb-6">
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 sticky top-0 bg-bg z-10 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-text text-base">{profile.name}</h1>
        <div className="w-8" />
      </div>

      {/* Profile header — same as self profile */}
      <div className="px-4 pt-5 pb-4">
        <div className="flex items-center gap-6 mb-4">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full ring-2 ring-accent/30 overflow-hidden shrink-0">
            <Avatar src={profile.avatar} name={profile.name} size={80} />
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
          <p className="text-sm font-semibold text-text">{profile.name}</p>
          {profile.status && <p className="text-sm text-text-muted mt-0.5">{profile.status}</p>}
          <div className="flex flex-col gap-1 mt-1.5">
            {profile.education && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <GraduationCap size={12} className="text-text-faint shrink-0" /> {profile.education}
              </p>
            )}
            {profile.dob && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <Calendar size={12} className="text-text-faint shrink-0" /> Born {profile.dob}
              </p>
            )}
            {profile.goals && (
              <p className="text-xs text-text-muted flex items-center gap-1.5">
                <Target size={12} className="text-text-faint shrink-0" /> {profile.goals}
              </p>
            )}
          </div>
        </div>

        {/* Action button */}
        {!isOwnProfile && (
          <button
            onClick={() => router.push(`/chat?dm=${userId}`)}
            className="w-full flex items-center justify-center gap-2 py-1.5 text-sm font-semibold border border-border rounded-lg bg-bg-2 hover:bg-bg-3 text-text transition-colors"
          >
            <MessageCircle size={14} /> Message
          </button>
        )}
      </div>

      {/* Tab bar — icon only, same as self profile */}
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

      {/* Posts grid — same 3-column rounded tiles as self profile */}
      {tab === "posts" && (
        posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-2">
            <Grid3X3 size={36} className="text-text-faint" />
            <p className="text-text-muted text-sm">No posts yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2 px-3 pt-3">
            {posts.map((post) => {
              const media = post.media_urls ?? [];
              const likes = post.like_count ?? 0;
              const comments = post.comment_count ?? 0;
              return (
                <button
                  key={post.id}
                  onClick={() => router.push(`/post/${post.id}`)}
                  className="aspect-square overflow-hidden relative group bg-bg-2 rounded-2xl"
                >
                  {media.length > 0 ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={media[0]}
                        alt=""
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-200 flex items-center justify-center gap-4 opacity-0 group-hover:opacity-100">
                        <div className="flex items-center gap-1 text-white">
                          <Heart size={15} className="fill-white" strokeWidth={0} />
                          <span className="text-xs font-bold">{likes}</span>
                        </div>
                        <div className="flex items-center gap-1 text-white">
                          <MessageCircle size={15} className="fill-white" strokeWidth={0} />
                          <span className="text-xs font-bold">{comments}</span>
                        </div>
                      </div>
                      {media.length > 1 && (
                        <div className="absolute top-1.5 right-1.5 opacity-90">
                          <Grid3X3 size={13} className="text-white drop-shadow-sm" />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-accent/20 via-accent/10 to-transparent flex flex-col justify-between p-2.5 group-hover:from-accent/30 group-hover:via-accent/15 transition-all duration-200">
                      <span className="text-accent/40 text-3xl font-serif leading-none select-none">"</span>
                      <p className="text-[10px] text-text font-medium line-clamp-4 leading-relaxed -mt-2 text-left">
                        {post.content}
                      </p>
                      {(likes > 0 || comments > 0) && (
                        <div className="flex items-center gap-2 mt-1.5">
                          {likes > 0 && (
                            <div className="flex items-center gap-0.5">
                              <Heart size={8} className="fill-red-400 text-red-400" strokeWidth={0} />
                              <span className="text-[9px] text-text-faint font-medium">{likes}</span>
                            </div>
                          )}
                          {comments > 0 && (
                            <div className="flex items-center gap-0.5">
                              <MessageCircle size={8} className="text-text-faint" strokeWidth={1.5} />
                              <span className="text-[9px] text-text-faint font-medium">{comments}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )
      )}

      {/* Documents tab — same as self profile */}
      {tab === "documents" && (
        <div className="px-4 py-4 flex flex-col gap-4">
          {docs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-2">
              <FileText size={36} className="text-text-faint" />
              <p className="text-text-muted text-sm">No documents.</p>
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
                                <span className="text-xs text-text-faint">{formatBytes(doc.file_size)}</span>
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
                              <button
                                onClick={() => downloadFile(doc.file_path, doc.name)}
                                className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
                              >
                                <Download size={14} />
                              </button>
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

      <DocPreviewModal doc={previewDoc} onClose={() => setPreviewDoc(null)} />
    </div>
  );
}
