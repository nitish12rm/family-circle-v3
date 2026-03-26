import AppShell from "@/components/layout/AppShell";
import UserProfileView from "@/components/profile/UserProfileView";

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  return (
    <AppShell>
      <UserProfileView userId={userId} />
    </AppShell>
  );
}
