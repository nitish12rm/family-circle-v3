"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Spinner from "@/components/ui/Spinner";
import ChatInbox from "@/components/chat/ChatInbox";
import GroupChatView from "@/components/chat/GroupChatView";
import DMChatView from "@/components/chat/DMChatView";

function ChatRouter() {
  const searchParams = useSearchParams();
  const dmUserId = searchParams.get("dm");
  const familyId = searchParams.get("family");

  if (dmUserId) return <DMChatView userId={dmUserId} />;
  if (familyId) return <GroupChatView familyId={familyId} />;
  return <ChatInbox />;
}

export default function ChatView() {
  return (
    <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
      <ChatRouter />
    </Suspense>
  );
}
