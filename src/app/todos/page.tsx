"use client";
import AppShell from "@/components/layout/AppShell";
import TodoView from "@/components/todos/TodoView";

export default function TodosPage() {
  return (
    <AppShell>
      <TodoView />
    </AppShell>
  );
}
