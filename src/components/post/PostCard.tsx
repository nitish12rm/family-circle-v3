"use client";
import { useState } from "react";
import { Heart, MessageCircle, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/authStore";
import { api } from "@/lib/api";
import Avatar from "@/components/ui/Avatar";
import { formatDistanceToNow } from "date-fns";
import type { Post } from "@/types";

interface PostCardProps {
  post: Post;
  onDelete?: (postId: string) => void;
  /** If true, clicking the card body navigates to the post detail page */
  navigable?: boolean;
  /** Called when like is toggled so parent can update state */
  onLikeToggle?: (postId: string, liked: boolean, likeCount: number) => void;
}

export default function PostCard({ post, onDelete, navigable = true, onLikeToggle }: PostCardProps) {
  const { user } = useAuthStore();
  const router = useRouter();
  const [likedByMe, setLikedByMe] = useState(post.liked_by_me ?? false);
  const [likeCount, setLikeCount] = useState(post.like_count ?? 0);
  const [liking, setLiking] = useState(false);

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (liking) return;
    // optimistic
    const newLiked = !likedByMe;
    const newCount = newLiked ? likeCount + 1 : likeCount - 1;
    setLikedByMe(newLiked);
    setLikeCount(newCount);
    setLiking(true);
    try {
      const res = await api.post<{ liked: boolean; like_count: number }>(
        `/api/posts/${post.id}/like`,
        {}
      );
      setLikedByMe(res.liked);
      setLikeCount(res.like_count);
      onLikeToggle?.(post.id, res.liked, res.like_count);
    } catch {
      // revert
      setLikedByMe(!newLiked);
      setLikeCount(likeCount);
    } finally {
      setLiking(false);
    }
  };

  const handleCardClick = () => {
    if (navigable) router.push(`/post/${post.id}`);
  };

  return (
    <div
      className={`bg-bg-2 border border-border rounded-2xl overflow-hidden ${navigable ? "cursor-pointer hover:border-accent/40 transition-colors" : ""}`}
      onClick={handleCardClick}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 pt-4 pb-2">
        <button
          onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author_id}`); }}
        >
          <Avatar src={post.author?.avatar} name={post.author?.name} size={36} />
        </button>
        <div className="flex-1 min-w-0">
          <button
            onClick={(e) => { e.stopPropagation(); router.push(`/profile/${post.author_id}`); }}
            className="text-sm font-semibold text-text hover:text-accent transition-colors"
          >
            {post.author?.name ?? "Unknown"}
          </button>
          <p className="text-xs text-text-faint">
            {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
          </p>
        </div>
        {onDelete && post.author_id === user?.id && (
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(post.id); }}
            className="p-1 text-text-faint hover:text-error transition-colors"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Content */}
      <p className="text-sm text-text px-4 pb-3 whitespace-pre-wrap leading-relaxed">{post.content}</p>

      {/* Media */}
      {(post.media_urls ?? []).length > 0 && (
        <div className={`grid gap-0.5 ${post.media_urls.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {post.media_urls.slice(0, 4).map((url, i) => (
            <div key={i} className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className={`w-full object-cover ${post.media_urls.length === 1 ? "max-h-80" : "h-44"}`} />
              {i === 3 && post.media_urls.length > 4 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                  <span className="text-white font-semibold text-lg">+{post.media_urls.length - 4}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-4 px-4 py-3">
        <button
          onClick={handleLike}
          className="flex items-center gap-1.5 transition-colors group"
        >
          <Heart
            size={18}
            className={likedByMe ? "fill-red-500 text-red-500" : "text-text-faint group-hover:text-red-400 transition-colors"}
            strokeWidth={likedByMe ? 0 : 1.8}
          />
          <span className={`text-xs font-medium ${likedByMe ? "text-red-500" : "text-text-faint"}`}>
            {likeCount > 0 ? likeCount : ""}
          </span>
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); if (navigable) router.push(`/post/${post.id}#comments`); }}
          className="flex items-center gap-1.5 text-text-faint hover:text-text transition-colors"
        >
          <MessageCircle size={18} strokeWidth={1.8} />
          <span className="text-xs font-medium">
            {(post.comment_count ?? 0) > 0 ? post.comment_count : ""}
          </span>
        </button>
      </div>
    </div>
  );
}
