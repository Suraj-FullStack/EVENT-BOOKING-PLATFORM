"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, EmptyState, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { adminApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-1 text-2xl font-bold text-slate-900">{value}</dd>
    </div>
  );
}

function Attendees() {
  const { id } = useParams<{ id: string }>();
  const { data, error, errorStatus, loading, reload } = useFetch(() => adminApi.attendees(id), [id]);
  const notFound = errorStatus === 404;

  if (loading && !data) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner size="lg" />
      </div>
    );
  }
  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg space-y-4">
        <Alert tone="error" onRetry={notFound ? undefined : reload}>
          {notFound ? "Event not found" : (error ?? "Failed to load attendees")}
        </Alert>
        <LinkButton href="/admin" variant="secondary">Back to dashboard</LinkButton>
      </div>
    );
  }

  const { event, attendees, active_count } = data;

  return (
    <>
      <Link href="/admin" className="text-sm text-brand-600 hover:underline">
        ← Dashboard
      </Link>
      <div className="mt-2">
        <PageHeader
          title="Attendees"
          subtitle={`${event.title} · ${formatDateTime(event.starts_at)} · ${event.venue}`}
          action={<LinkButton href={`/admin/events/${event.id}/edit`} variant="secondary">Edit event</LinkButton>}
        />
      </div>

      <dl className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Capacity" value={event.total_seats} />
        <Stat label="Active bookings" value={active_count} />
        <Stat label="Seats left" value={event.available_seats} />
        <Stat label="Cancelled" value={attendees.length - active_count} />
      </dl>

      {attendees.length === 0 ? (
        <EmptyState title="No bookings yet" body="Nobody has booked a seat for this event so far." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <table id="attendees-table" className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Email</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Booked</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {attendees.map((a, i) => (
                <tr key={a.booking_id} className={a.status === "cancelled" ? "text-slate-400" : ""}>
                  <td className="px-4 py-3 tabular-nums">{i + 1}</td>
                  <td className="px-4 py-3 font-medium">{a.name}</td>
                  <td className="px-4 py-3">{a.email}</td>
                  <td className="px-4 py-3">
                    <Badge tone={a.status === "active" ? "green" : "slate"}>{a.status === "active" ? "Confirmed" : "Cancelled"}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {formatDateTime(a.booked_at)}
                    {a.cancelled_at && <div className="text-xs">cancelled {formatDateTime(a.cancelled_at)}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

export default function AttendeesPage() {
  return (
    <RequireAuth admin>
      <Attendees />
    </RequireAuth>
  );
}
