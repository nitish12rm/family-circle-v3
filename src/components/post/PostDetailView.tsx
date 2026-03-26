"use client";
import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import PostCard from "@/components/post/PostCard";
import { formatPostDate } from "@/lib/formatDate";
import type { Post, PostComment } from "@/types";

export default function PostDetailView({ postId }: { postId: string }) {
  const router = useRouter();
  const { user } = useAuthStore();
  const [post, setPost] = useState<Post | null>(null);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [sending, setSending] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    Promise.all([
      api.get<Post>(`/api/posts/${postId}`),
      api.get<PostComment[]>(`/api/posts/${postId}/comments`),
    ])
      .then(([p, c]) => { setPost(p); setComments(c); })
      .finally(() => setLoading(false));
  }, [postId]);

  // Focus comment input if URL has #comments
  useEffect(() => {
    if (typeof window !== "undefined" && window.location.hash === "#comments") {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [loading]);

  const handleComment = async () => {
    if (!commentText.trim() || !post) return;
    const text = commentText.trim();
    setCommentText("");
    setSending(true);
    try {
      const c = await api.post<PostComment>(`/api/posts/${postId}/comments`, { content: text });
      setComments((prev) => [...prev, c]);
      setPost((p) => p ? { ...p, comment_count: (p.comment_count ?? 0) + 1 } : p);
    } catch {
      setCommentText(text);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-20"><Spinner /></div>;
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <p className="text-text-muted text-sm">Post not found.</p>
        <button onClick={() => router.back()} className="text-accent text-sm">Go back</button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto flex flex-col" style={{ minHeight: "var(--content-h)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border sticky top-0 bg-bg z-10">
        <button
          onClick={() => router.back()}
          className="p-1.5 rounded-lg hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="font-semibold text-text">Post</h1>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-4">
        {/* Post card — not navigable since we're already on detail */}
        <PostCard
          post={post}
          navigable={false}
          onDelete={async (postId) => {
            try {
              await api.delete(`/api/families/${post.family_id}/posts?postId=${postId}`);
              router.back();
            } catch {
              // silent — toast handled by FeedView when coming from there
            }
          }}
          onEdit={(_, content, mediaUrls) =>
            setPost((p) => p ? { ...p, content, media_urls: mediaUrls } : p)
          }
          onLikeToggle={(_, liked, count) =>
            setPost((p) => p ? { ...p, liked_by_me: liked, like_count: count } : p)
          }
        />

        {/* Comments section */}
        <div id="comments" className="flex flex-col gap-1">
          <p className="text-xs font-semibold text-text-faint uppercase tracking-wide mb-2">
            {comments.length} Comment{comments.length !== 1 ? "s" : ""}
          </p>

          {comments.length === 0 ? (
            <p className="text-sm text-text-muted text-center py-6">No comments yet. Be the first!</p>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="flex gap-3 py-2.5">
                <button onClick={() => router.push(`/profile/${c.author_id}`)}>
                  <Avatar src={c.author?.avatar} name={c.author?.name} size={30} className="shrink-0 mt-0.5" />
                </button>
                <div className="flex-1 min-w-0">
                  <div className="bg-bg-2 border border-border rounded-2xl rounded-tl-sm px-3.5 py-2.5">
                    <button
                      onClick={() => router.push(`/profile/${c.author_id}`)}
                      className="text-xs font-semibold text-text hover:text-accent transition-colors"
                    >
                      {c.author?.name ?? "Unknown"}
                    </button>
                    <p className="text-sm text-text mt-0.5 leading-relaxed">{c.content}</p>
                  </div>
                  <p className="text-[10px] text-text-faint mt-1 ml-1">
                    {formatPostDate(c.created_at)}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Comment input — pinned bottom */}
      <div className="px-4 py-3 border-t border-border bg-bg shrink-0">
        <div className="flex gap-2 items-end">
          <Avatar src={user ? undefined : undefined} name={user?.name ?? ""} size={30} className="shrink-0 mb-0.5" />
          <textarea
            ref={inputRef}
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
            placeholder="Add a comment…"
            rows={1}
            className="flex-1 bg-bg-2 border border-border rounded-2xl px-4 py-2 text-sm text-text placeholder:text-text-faint focus:outline-none focus:border-accent resize-none max-h-20"
          />
          <button
            onClick={handleComment}
            disabled={!commentText.trim() || sending}
            className="w-9 h-9 bg-accent hover:bg-accent-hover disabled:opacity-40 rounded-full flex items-center justify-center transition-colors shrink-0"
          >
            {sending ? <Spinner size={14} /> : <Send size={14} className="text-white" />}
          </button>
        </div>
      </div>
    </div>
  );
}
