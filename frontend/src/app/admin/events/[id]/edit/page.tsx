"use client";

import { useParams } from "next/navigation";

import EventForm from "@/components/EventForm";
import RequireAuth from "@/components/RequireAuth";
import { Alert, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { eventsApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";

function EditEvent() {
  const { id } = useParams<{ id: string }>();
  // The public endpoint already returns everything the form needs.
  const { data: event, error, errorStatus, loading, reload } = useFetch(() => eventsApi.get(id), [id]);

  if (loading && !event) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !event) {
    const notFound = errorStatus === 404;
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Alert tone="error" onRetry={notFound ? undefined : reload}>
          {notFound ? "Event not found" : (error ?? "Failed to load event")}
        </Alert>
        <LinkButton href="/admin" variant="secondary">
          Back to dashboard
        </LinkButton>
      </div>
    );
  }

  return (
    <>
      <PageHeader title="Edit event" subtitle={event.title} />
      {/* key forces a fresh form if the event is reloaded */}
      <EventForm key={event.updated_at} event={event} />
    </>
  );
}

export default function EditEventPage() {
  return (
    <RequireAuth admin>
      <EditEvent />
    </RequireAuth>
  );
}
