import AppShell from "@/components/layout/AppShell";
import PostDetailView from "@/components/post/PostDetailView";

export default async function PostPage({
  params,
}: {
  params: Promise<{ postId: string }>;
}) {
  const { postId } = await params;
  return (
    <AppShell>
      <PostDetailView postId={postId} />
    </AppShell>
  );
}
