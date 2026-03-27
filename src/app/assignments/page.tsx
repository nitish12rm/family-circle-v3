"use client";
import { Suspense } from "react";
import AppShell from "@/components/layout/AppShell";
import AssignmentsView from "@/components/assignments/AssignmentsView";
import Spinner from "@/components/ui/Spinner";

export default function AssignmentsPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="flex justify-center py-20"><Spinner /></div>}>
        <AssignmentsView />
      </Suspense>
    </AppShell>
  );
}
