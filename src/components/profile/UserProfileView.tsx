"use client";
import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, FileText, ImageIcon, GraduationCap, Target, Calendar, Search, Eye, Download } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import DocPreviewModal from "@/components/documents/DocPreviewModal";
import { formatDistanceToNow } from "date-fns";

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

  const categories = useMemo(() => {
    if (!data) return [];
    const cats = Array.from(new Set(data.documents.map((d) => d.category)));
    return ["All", ...cats];
  }, [data]);

  const filteredDocs = useMemo(() => {
    if (!data) return [];
    return data.documents.filter((d) => {
      const matchesSearch =
        !search ||
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        (d.description ?? "").toLowerCase().includes(search.toLowerCase());
      const matchesCategory = activeCategory === "All" || d.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [data, search, activeCategory]);

  const groupedDocs = useMemo(() => {
    if (activeCategory !== "All") return null;
    const groups: Record<string, PublicDocument[]> = {};
    for (const doc of filteredDocs) {
      if (!groups[doc.category]) groups[doc.category] = [];
      groups[doc.category].push(doc);
    }
    return groups;
  }, [filteredDocs, activeCategory]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Spinner />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-text-muted text-sm">{error || "Profile not found"}</p>
        <button onClick={() => router.back()} className="text-accent text-sm">Go back</button>
      </div>
    );
  }

  const { profile, posts, documents, stats } = data;
  const isOwnProfile = user?.id === userId;

  const DocCard = ({ doc }: { doc: PublicDocument }) => (
    <div className="flex items-center gap-3 bg-bg-2 border border-border rounded-2xl p-4">
      <div className="w-10 h-10 bg-bg-3 rounded-xl flex items-center justify-center shrink-0 text-lg">
        {fileIcon(doc.mime_type)}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{doc.name}</p>
        {doc.description && (
          <p className="text-xs text-text-muted truncate mt-0.5">{doc.description}</p>
        )}
        <p className="text-xs text-text-faint mt-0.5">
          {formatBytes(doc.file_size)} · {formatDistanceToNow(new Date(doc.created_at), { addSuffix: true })}
        </p>
      </div>
      <div className="flex gap-1 shrink-0">
        <button
          onClick={() => setPreviewDoc(doc)}
          className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
          title="Preview"
        >
          <Eye size={14} />
        </button>
        <a
          href={doc.file_path}
          target="_blank"
          rel="noreferrer"
          className="p-2 rounded-lg hover:bg-bg-3 text-text-muted hover:text-text transition-colors"
          title="Download"
        >
          <Download size={14} />
        </a>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      {/* Back header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-bg z-10">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-text">{profile.name}</h1>
        {isOwnProfile && (
          <button
            onClick={() => router.push("/profile")}
            className="ml-auto text-xs text-accent font-medium"
          >
            Edit
          </button>
        )}
      </div>

      {/* Profile header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start gap-4 mb-4">
          <Avatar name={profile.name} src={profile.avatar} size={80} />
          <div className="flex-1 min-w-0 pt-1">
            <h2 className="text-xl font-bold text-text">{profile.name}</h2>
            {profile.status && (
              <p className="text-sm text-text-muted mt-1">{profile.status}</p>
            )}
            <p className="text-xs text-text-faint mt-1">
              Member since {new Date(profile.created_at).toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="flex gap-6 border-y border-border py-3 mb-4">
          <div className="text-center">
            <p className="text-lg font-bold text-text">{stats.posts}</p>
            <p className="text-xs text-text-muted">Posts</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text">{stats.families}</p>
            <p className="text-xs text-text-muted">Families</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-text">{documents.length}</p>
            <p className="text-xs text-text-muted">Docs</p>
          </div>
        </div>

        {/* Info rows */}
        <div className="flex flex-col gap-2.5">
          {profile.dob && (
            <div className="flex items-center gap-2.5 text-sm text-text-muted">
              <Calendar size={14} className="text-text-faint shrink-0" />
              <span>Born {profile.dob}</span>
            </div>
          )}
          {profile.education && (
            <div className="flex items-center gap-2.5 text-sm text-text-muted">
              <GraduationCap size={14} className="text-text-faint shrink-0" />
              <span>{profile.education}</span>
            </div>
          )}
          {profile.goals && (
            <div className="flex items-start gap-2.5 text-sm text-text-muted">
              <Target size={14} className="text-text-faint shrink-0 mt-0.5" />
              <span>{profile.goals}</span>
            </div>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-border sticky top-[52px] bg-bg z-10">
        {(["posts", "documents"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-3 text-sm font-medium border-b-2 transition-colors capitalize ${
              tab === t
                ? "border-accent text-accent"
                : "border-transparent text-text-muted hover:text-text"
            }`}
          >
            {t === "posts" ? (
              <span className="flex items-center justify-center gap-1.5"><ImageIcon size={14} /> Posts</span>
            ) : (
              <span className="flex items-center justify-center gap-1.5"><FileText size={14} /> Docs</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="px-4 py-4">
        {tab === "posts" && (
          posts.length === 0 ? (
            <div className="text-center py-16">
              <ImageIcon size={32} className="mx-auto text-text-faint mb-3" />
              <p className="text-text-muted text-sm">No posts yet.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {posts.map((post) => (
                <div key={post.id} className="bg-bg-2 border border-border rounded-2xl p-4">
                  {post.media_urls.length > 0 && (
                    <div className={`grid gap-1 mb-3 rounded-xl overflow-hidden ${post.media_urls.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                      {post.media_urls.slice(0, 4).map((url, i) => (
                        <img key={i} src={url} alt="" className="w-full aspect-square object-cover" />
                      ))}
                    </div>
                  )}
                  <p className="text-sm text-text leading-relaxed">{post.content}</p>
                  <p className="text-xs text-text-faint mt-2">
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </p>
                </div>
              ))}
            </div>
          )
        )}

        {tab === "documents" && (
          documents.length === 0 ? (
            <div className="text-center py-16">
              <FileText size={32} className="mx-auto text-text-faint mb-3" />
              <p className="text-text-muted text-sm">No public documents.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* Search bar */}
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

              {/* Category filter chips */}
              {categories.length > 2 && (
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                  {categories.map((cat) => (
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
                    </button>
                  ))}
                </div>
              )}

              {filteredDocs.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-text-muted text-sm">No documents match your search.</p>
                </div>
              ) : activeCategory !== "All" || !groupedDocs ? (
                <div className="flex flex-col gap-3">
                  {filteredDocs.map((doc) => <DocCard key={doc.id} doc={doc} />)}
                </div>
              ) : (
                Object.entries(groupedDocs).map(([cat, catDocs]) => (
                  <div key={cat}>
                    <p className="text-xs font-semibold text-text-muted uppercase tracking-wide mb-2">{cat}</p>
                    <div className="flex flex-col gap-2">
                      {catDocs.map((doc) => <DocCard key={doc.id} doc={doc} />)}
                    </div>
                  </div>
                ))
              )}
            </div>
          )
        )}
      </div>

      <DocPreviewModal
        doc={previewDoc}
        onClose={() => setPreviewDoc(null)}
      />
    </div>
  );
}
