"use client";
import { useState, useRef } from "react";
import { Heart, MessageCircle, X, Send, Trash2, ExternalLink, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import Spinner from "@/components/ui/Spinner";
import { formatPostDate } from "@/lib/formatDate";
import type { Post, PostComment } from "@/types";

const CONTENT_LIMIT = 180;

interface LikerProfile { id: string; name: string; avatar?: string }

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  navigable?: boolean;
  onLikeToggle?: (postId: string, liked: boolean, likeCount: number) => void;
}

export default function PostCard({ post, onDelete, navigable = true, onLikeToggle }: PostCardProps) {
  const { user, profile } = useAuthStore();
  const router = useRouter();

  const [likedByMe, setLikedByMe] = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [liking, setLiking] = useState(false);
  const [expanded, setExpanded] = useState(false);

  // Likers modal
  const [likersOpen, setLikersOpen] = useState(false);
  const [allLikers, setAllLikers] = useState<LikerProfile[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);

  // Post delete confirm
  const [deletePostOpen, setDeletePostOpen] = useState(false);

  // Comments sheet
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostComment[]>([]);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [commentCount, setCommentCount] = useState(post.comment_count ?? 0);
  const [deleteCommentId, setDeleteCommentId] = useState<string | null>(null);
  const commentsEndRef = useRef<HTMLDivElement>(null);

  // Lightbox
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const isLong = post.content.length > CONTENT_LIMIT;
  const displayContent = isLong && !expanded
    ? post.content.slice(0, CONTENT_LIMIT).trimEnd() + "…"
    : post.content;

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;
    const newLiked = !likedByMe;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
    setLikedByMe(newLiked);
    setLikeCount(newCount);
    setLiking(true);
    try {
      const res = await api.post<{ liked: boolean; like_count: number }>(`/api/posts/${post.id}/like`, {});
      setLikedByMe(res.liked);
      setLikeCount(res.like_count);
      onLikeToggle?.(post.id, res.liked, res.like_count);
    } catch {
      setLikedByMe(!newLiked);
      setLikeCount(likeCount);
    } finally {
      setLiking(false);
    }
  };

  const openLikers = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (likeCount === 0) return;
    setLikersOpen(true);
    if (allLikers.length === 0) {
      setLoadingLikers(true);
      try {
        const data = await api.get<LikerProfile[]>(`/api/posts/${post.id}/likes`);
        setAllLikers(data);
      } finally {
        setLoadingLikers(false);
      }
    }
  };

  const openComments = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setCommentsOpen(true);
    if (comments.length === 0) {
      setLoadingComments(true);
      try {
        const data = await api.get<PostComment[]>(`/api/posts/${post.id}/comments`);
        setComments(data);
      } finally {
        setLoadingComments(false);
      }
    }
  };

  const submitComment = async () => {
    const text = commentText.trim();
    if (!text || sendingComment) return;
    setSendingComment(true);
    try {
      const newComment = await api.post<PostComment>(`/api/posts/${post.id}/comments`, { content: text });
      setComments((prev) => [...prev, newComment]);
      setCommentCount((c) => c + 1);
      setCommentText("");
      setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
    } finally {
      setSendingComment(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await api.delete(`/api/posts/${post.id}/comments?commentId=${commentId}`);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      setCommentCount((n) => Math.max(0, n - 1));
    } catch {
      // silent fail
    } finally {
      setDeleteCommentId(null);
    }
  };

  const media = post.media_urls ?? [];
  const previewLikers = post.likers ?? [];

  return (
    <>
      <div
        className={`bg-bg-2 border border-border rounded-2xl overflow-hidden ${navigable ? "cursor-pointer active:scale-[0.995] transition-transform" : ""}`}
        onClick={() => navigable && router.push(`/post/${post.id}`)}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 pt-4 pb-3">
          <button onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author_id}`); }}>
            <Avatar src={post.author?.avatar} name={post.author?.name} size={36} />
          </button>
          <div className="flex-1 min-w-0">
            <button
              onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author_id}`); }}
              className="text-sm font-semibold text-text hover:text-accent transition-colors leading-tight"
            >
              {post.author?.name ?? "Unknown"}
            </button>
            <p className="text-xs text-text-faint mt-0.5">
              {formatPostDate(post.created_at)}
            </p>
          </div>
          {onDelete && post.author_id === user?.id && (
            <button
              onClick={(e) => { e.stopPropagation(); setDeletePostOpen(true); }}
              className="p-1 text-text-faint hover:text-error transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
        </div>

        {/* Content with see more/less */}
        <div className="px-4 pb-3" onClick={(e) => e.stopPropagation()}>
          <p className="text-sm text-text whitespace-pre-wrap leading-relaxed">{displayContent}</p>
          {isLong && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="text-xs text-accent font-medium mt-1 hover:text-accent-hover transition-colors"
            >
              {expanded ? "see less" : "see more"}
            </button>
          )}
        </div>

        {/* Media — object-contain so full image is visible */}
        {media.length > 0 && (
          <div className={`grid gap-0.5 ${media.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {media.slice(0, 4).map((url, i) => (
              <div
                key={i}
                className={`relative overflow-hidden bg-black ${media.length === 1 ? "aspect-[4/3]" : "aspect-square"} cursor-pointer`}
                onClick={(e) => { e.stopPropagation(); setLightboxIndex(i); }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="" className="w-full h-full object-contain" />
                {i === 3 && media.length > 4 && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center pointer-events-none">
                    <span className="text-white font-bold text-xl">+{media.length - 4}</span>
                  </div>
                )}
                {navigable && i !== 3 && (
                  <div className="absolute bottom-2 right-2 pointer-events-none">
                    <span className="flex items-center gap-1 bg-black/50 text-white text-[10px] px-2 py-0.5 rounded-full backdrop-blur-sm">
                      <ExternalLink size={9} />
                      View post
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Likers row — stacked avatars + name summary */}
        {likeCount > 0 && (
          <button
            onClick={openLikers}
            className="flex items-center gap-2 px-4 pt-3 pb-1 w-full text-left hover:opacity-80 transition-opacity"
          >
            {/* Stacked avatars */}
            <div className="flex -space-x-2">
              {previewLikers.slice(0, 3).map((liker) => (
                <div key={liker.id} className="w-5 h-5 rounded-full ring-2 ring-bg-2 overflow-hidden shrink-0">
                  <Avatar src={liker.avatar} name={liker.name} size={20} />
                </div>
              ))}
            </div>
            {/* Like summary text */}
            <span className="text-xs text-text-muted">
              {likeCount === 1
                ? `Liked by ${previewLikers[0]?.name ?? "1 person"}`
                : previewLikers[0]
                ? `Liked by ${previewLikers[0].name} and ${likeCount - 1} other${likeCount - 1 > 1 ? "s" : ""}`
                : `${likeCount} likes`}
            </span>
          </button>
        )}

        {/* Actions row */}
        <div className="flex items-center gap-1 px-3 py-2 border-t border-border/50 mt-2">
          <button
            onClick={handleLike}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-bg-3 transition-colors group flex-1 justify-center"
          >
            <Heart
              size={17}
              className={likedByMe ? "fill-red-500 text-red-500" : "text-text-faint group-hover:text-red-400 transition-colors"}
              strokeWidth={likedByMe ? 0 : 2}
            />
            <span className={`text-xs font-medium ${likedByMe ? "text-red-500" : "text-text-faint"}`}>
              Like{likeCount > 0 ? ` · ${likeCount}` : ""}
            </span>
          </button>
          <button
            onClick={openComments}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl hover:bg-bg-3 text-text-faint hover:text-text transition-colors flex-1 justify-center"
          >
            <MessageCircle size={17} strokeWidth={2} />
            <span className="text-xs font-medium">
              Comment{commentCount > 0 ? ` · ${commentCount}` : ""}
            </span>
          </button>
        </div>
      </div>

      {/* Comments sheet */}
      {commentsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setCommentsOpen(false)}
        >
          <div
            className="bg-bg w-full max-w-xl rounded-t-3xl overflow-hidden flex flex-col max-h-[80vh]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1 shrink-0">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
              <h2 className="text-sm font-semibold text-text">{commentCount} Comment{commentCount !== 1 ? "s" : ""}</h2>
              <button onClick={() => setCommentsOpen(false)} className="p-1 text-text-faint hover:text-text">
                <X size={16} />
              </button>
            </div>

            {/* Comments list */}
            <div className="overflow-y-auto flex-1 py-2">
              {loadingComments ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : comments.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-8">No comments yet. Be the first!</p>
              ) : (
                comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-3 px-5 py-3">
                    <button onClick={() => { setCommentsOpen(false); router.push(`/profile/${c.author_id}`); }}>
                      <Avatar src={c.author?.avatar} name={c.author?.name} size={36} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2">
                        <button
                          onClick={() => { setCommentsOpen(false); router.push(`/profile/${c.author_id}`); }}
                          className="text-xs font-semibold text-text hover:text-accent transition-colors"
                        >
                          {c.author?.name ?? "Unknown"}
                        </button>
                        <span className="text-[10px] text-text-faint">
                          {formatPostDate(c.created_at)}
                        </span>
                      </div>
                      <p className="text-sm text-text mt-0.5 whitespace-pre-wrap leading-relaxed">{c.content}</p>
                    </div>
                    {c.author_id === user?.id && (
                      <button
                        onClick={() => setDeleteCommentId(c.id)}
                        className="p-1.5 text-text-faint hover:text-error transition-colors shrink-0 mt-0.5"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))
              )}
              <div ref={commentsEndRef} />
            </div>

            {/* Pinned input */}
            <div className="shrink-0 border-t border-border px-4 py-3 flex items-center gap-3 pb-safe">
              <Avatar src={profile?.avatar} name={user?.name} size={32} />
              <input
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submitComment(); } }}
                placeholder="Add a comment…"
                className="flex-1 bg-bg-2 rounded-xl px-3 py-2 text-sm text-text placeholder:text-text-faint outline-none border border-border focus:border-accent transition-colors"
              />
              <button
                onClick={submitComment}
                disabled={!commentText.trim() || sendingComment}
                className="p-2 rounded-xl bg-accent text-white disabled:opacity-40 transition-opacity"
              >
                {sendingComment ? <Spinner size={16} /> : <Send size={16} />}
              </button>
            </div>
            <div className="pb-6 shrink-0" />
          </div>
        </div>
      )}

      {/* Likers modal */}
      {likersOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => setLikersOpen(false)}
        >
          <div
            className="bg-bg w-full max-w-xl rounded-t-3xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-border rounded-full" />
            </div>
            <div className="flex items-center justify-between px-5 py-3 border-b border-border">
              <h2 className="text-sm font-semibold text-text">{likeCount} Like{likeCount !== 1 ? "s" : ""}</h2>
              <button onClick={() => setLikersOpen(false)} className="p-1 text-text-faint hover:text-text">
                <X size={16} />
              </button>
            </div>
            <div className="overflow-y-auto max-h-72 py-2">
              {loadingLikers ? (
                <div className="flex justify-center py-8"><Spinner /></div>
              ) : allLikers.length === 0 ? (
                <p className="text-center text-text-muted text-sm py-8">No likes yet.</p>
              ) : (
                allLikers.map((liker) => (
                  <button
                    key={liker.id}
                    onClick={() => { setLikersOpen(false); router.push(`/profile/${liker.id}`); }}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-bg-2 transition-colors"
                  >
                    <Avatar src={liker.avatar} name={liker.name} size={40} />
                    <p className="text-sm font-medium text-text">{liker.name}</p>
                    <Heart size={14} className="ml-auto fill-red-500 text-red-500" strokeWidth={0} />
                  </button>
                ))
              )}
            </div>
            {/* safe area bottom padding */}
            <div className="pb-6" />
          </div>
        </div>
      )}

      {/* Delete post confirmation */}
      {deletePostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setDeletePostOpen(false)}>
          <div className="bg-bg rounded-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text mb-1">Delete post?</h3>
            <p className="text-xs text-text-muted mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletePostOpen(false)}
                className="flex-1 py-2 rounded-xl border border-border text-sm text-text-muted hover:bg-bg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setDeletePostOpen(false); onDelete?.(post.id); }}
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Lightbox */}
      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-[60] bg-black/95 flex items-center justify-center"
          onClick={() => setLightboxIndex(null)}
        >
          {/* Close */}
          <button
            className="absolute top-4 right-4 p-2 text-white/80 hover:text-white z-10"
            onClick={() => setLightboxIndex(null)}
          >
            <X size={22} />
          </button>

          {/* Prev */}
          {media.length > 1 && lightboxIndex > 0 && (
            <button
              className="absolute left-3 p-2 text-white/70 hover:text-white z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i ?? 1) - 1); }}
            >
              <ChevronLeft size={28} />
            </button>
          )}

          {/* Image */}
          <div className="w-full h-full flex items-center justify-center px-12 py-16" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={media[lightboxIndex]}
              alt=""
              className="max-w-full max-h-full object-contain"
            />
          </div>

          {/* Next */}
          {media.length > 1 && lightboxIndex < media.length - 1 && (
            <button
              className="absolute right-3 p-2 text-white/70 hover:text-white z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex((i) => (i ?? 0) + 1); }}
            >
              <ChevronRight size={28} />
            </button>
          )}

          {/* View post button — only in feed (navigable) */}
          {navigable && (
            <button
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white text-xs font-medium px-4 py-2 rounded-full transition-colors z-10"
              onClick={(e) => { e.stopPropagation(); setLightboxIndex(null); router.push(`/post/${post.id}`); }}
            >
              <ExternalLink size={12} />
              View post
            </button>
          )}
        </div>
      )}

      {/* Delete comment confirmation */}
      {deleteCommentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-6" onClick={() => setDeleteCommentId(null)}>
          <div className="bg-bg rounded-2xl p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-text mb-1">Delete comment?</h3>
            <p className="text-xs text-text-muted mb-4">This cannot be undone.</p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeleteCommentId(null)}
                className="flex-1 py-2 rounded-xl border border-border text-sm text-text-muted hover:bg-bg-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteComment(deleteCommentId)}
                className="flex-1 py-2 rounded-xl bg-error text-white text-sm font-medium hover:opacity-90 transition-opacity"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
