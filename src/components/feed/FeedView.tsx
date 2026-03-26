"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, RefreshCw, Image as ImageIcon, X } from "lucide-react";
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
import type { Post } from "@/types";

export default function FeedView() {
  const { activeFamilyId } = useFamilyStore();
  const { profile } = useAuthStore();
  const { showToast } = useUIStore();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [content, setContent] = useState("");
  const [uploading, setUploading] = useState(false);
  const [mediaUrls, setMediaUrls] = useState<string[]>([]);
  const [posting, setPosting] = useState(false);

  const loadPosts = useCallback(async () => {
    if (!activeFamilyId) return;
    try {
      const data = await api.get<Post[]>(
        `/api/families/${activeFamilyId}/posts`
      );
      setPosts(data);
    } catch {
      showToast("Failed to load posts", "error");
    } finally {
      setLoading(false);
    }
  }, [activeFamilyId, showToast]);

  useEffect(() => {
    setLoading(true);
    loadPosts();
  }, [loadPosts]);

  // Poll every 10s
  useEffect(() => {
    const interval = setInterval(loadPosts, 10000);
    return () => clearInterval(interval);
  }, [loadPosts]);

  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
      const formData = new FormData();
      formData.append("file", toUpload);
      formData.append("folder", "family-circle-v3/posts");
      const res = await api.upload<{ url: string }>("/api/upload", formData);
      setMediaUrls((prev) => [...prev, res.url]);
    } catch {
      showToast("Failed to upload image", "error");
    } finally {
      setUploading(false);
    }
  };

  const handlePost = async () => {
    if (!content.trim() || !activeFamilyId) return;
    setPosting(true);
    try {
      const post = await api.post<Post>(
        `/api/families/${activeFamilyId}/posts`,
        { content, media_urls: mediaUrls }
      );
      setPosts((prev) => [post, ...prev]);
      setContent("");
      setMediaUrls([]);
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
      await api.delete(
        `/api/families/${activeFamilyId}/posts?postId=${postId}`
      );
      setPosts((prev) => prev.filter((p) => p.id !== postId));
      showToast("Post deleted", "info");
    } catch {
      showToast("Failed to delete post", "error");
    }
  };

  if (!activeFamilyId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-20 text-center">
        <p className="text-text-muted">No family selected.</p>
        <Button variant="secondary" onClick={() => window.location.href = "/family"}>
          Go to Family
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-lg font-semibold text-text">Feed</h1>
        <div className="flex gap-2">
          <button
            onClick={() => { setLoading(true); loadPosts(); }}
            className="p-2 rounded-xl hover:bg-bg-2 text-text-muted hover:text-text transition-colors"
          >
            <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
          </button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus size={14} /> Post
          </Button>
        </div>
      </div>

      {/* Posts */}
      {loading && posts.length === 0 ? (
        <div className="flex justify-center py-20">
          <Spinner />
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-text-muted text-sm">No posts yet.</p>
          <p className="text-text-faint text-xs mt-1">
            Be the first to share something!
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={post}
              onDelete={handleDelete}
              onLikeToggle={(postId, liked, likeCount) => {
                setPosts((prev) =>
                  prev.map((p) =>
                    p.id === postId ? { ...p, liked_by_me: liked, like_count: likeCount } : p
                  )
                );
              }}
            />
          ))}
        </div>
      )}

      {/* Create post modal */}
      <Modal
        open={createOpen}
        onClose={() => { setCreateOpen(false); setContent(""); setMediaUrls([]); }}
        title="New Post"
      >
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <Avatar src={profile?.avatar} name={profile?.name} size={36} />
            <Textarea
              placeholder="What's on your mind?"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={4}
              className="flex-1"
            />
          </div>

          {mediaUrls.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {mediaUrls.map((url, i) => (
                <div key={i} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="rounded-xl w-full h-28 object-cover" />
                  <button
                    onClick={() => setMediaUrls((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                  >
                    <X size={12} className="text-white" />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-text-muted hover:text-text cursor-pointer transition-colors">
              {uploading ? <Spinner size={16} /> : <ImageIcon size={16} />}
              <span>Add Photo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleMediaUpload}
                disabled={uploading}
              />
            </label>
            <Button
              onClick={handlePost}
              loading={posting}
              disabled={!content.trim()}
              size="sm"
            >
              Post
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
