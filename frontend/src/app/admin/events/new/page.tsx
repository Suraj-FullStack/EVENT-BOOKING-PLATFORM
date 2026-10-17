"use client";

import EventForm from "@/components/EventForm";
import RequireAuth from "@/components/RequireAuth";
import { PageHeader } from "@/components/ui";

export default function NewEventPage() {
  return (
    <RequireAuth admin>
      <PageHeader title="Create event" subtitle="Fill in the details below. Everything is required." />
      <EventForm />
    </RequireAuth>
  );
}
