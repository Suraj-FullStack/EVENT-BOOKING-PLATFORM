"use client";

import Link from "next/link";
import { useState } from "react";

import ConfirmDialog from "@/components/ConfirmDialog";
import { AvailabilityBadge } from "@/components/EventCard";
import Pagination from "@/components/Pagination";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Button, EmptyState, Input, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { adminApi, ApiError } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Event } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

const PAGE_SIZE = 10;

function AdminDashboard() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const { data, error, loading, reload } = useFetch(
    () => adminApi.list({ page, page_size: PAGE_SIZE, search }),
    [page, search],
  );
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [toDelete, setToDelete] = useState<Event | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!toDelete) return;
    setDeleting(true);
    setNotice(null);
    try {
      await adminApi.remove(toDelete.id);
      setNotice({ tone: "success", text: `"${toDelete.title}" was deleted.` });
      setToDelete(null);
      reload();
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not delete event" });
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Admin dashboard"
        subtitle="Manage events and see who's attending."
        action={<LinkButton href="/admin/events/new">+ New event</LinkButton>}
      />

      <form
        className="mb-4 flex max-w-md gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setPage(1);
          setSearch(query.trim());
        }}
        role="search"
      >
        <Input id="admin-search" type="search" placeholder="Search by title…" value={query} onChange={(e) => setQuery(e.target.value)} maxLength={100} />
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {notice && (
        <div className="mb-4">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}
      {error && (
        <Alert tone="error" onRetry={reload}>
          {error}
        </Alert>
      )}

      {loading && !data && (
        <div className="flex justify-center py-16 text-brand-600">
          <Spinner size="lg" />
        </div>
      )}

      {!loading && !error && data && data.items.length === 0 && (
        <EmptyState
          title={search ? "No events match" : "No events yet"}
          body={search ? "Try another search term." : "Create your first event to get started."}
          action={!search ? <LinkButton href="/admin/events/new">Create event</LinkButton> : undefined}
        />
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
            <table id="admin-events-table" className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">Event</th>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Seats</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.items.map((ev) => (
                  <tr key={ev.id} className="hover:bg-slate-50">
                    <td className="max-w-xs px-4 py-3">
                      <Link href={`/events/${ev.id}`} className="font-medium text-slate-900 hover:text-brand-700 hover:underline">
                        {ev.title}
                      </Link>
                      <div className="truncate text-xs text-slate-500">{ev.venue}</div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatDateTime(ev.starts_at)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-700">
                      <span className="font-medium">{ev.booked_seats}</span>
                      <span className="text-slate-400"> / {ev.total_seats}</span>
                      <span className="ml-2 text-xs text-slate-500">({ev.available_seats} left)</span>
                    </td>
                    <td className="px-4 py-3">
                      <AvailabilityBadge event={ev} />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right">
                      <div className="inline-flex gap-1">
                        <Link href={`/admin/events/${ev.id}/attendees`} className="rounded-md px-2 py-1 text-brand-600 hover:bg-brand-50">
                          Attendees
                        </Link>
                        <Link href={`/admin/events/${ev.id}/edit`} className="rounded-md px-2 py-1 text-slate-700 hover:bg-slate-100">
                          Edit
                        </Link>
                        <button
                          onClick={() => setToDelete(ev)}
                          className="rounded-md px-2 py-1 text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:text-slate-300"
                          disabled={ev.booked_seats > 0}
                          title={ev.booked_seats > 0 ? "Events with bookings can't be deleted" : "Delete event"}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.total_pages} total={data.total} pageSize={data.page_size} onChange={setPage} />
        </>
      )}

      <ConfirmDialog
        open={!!toDelete}
        title="Delete this event?"
        body={toDelete ? `"${toDelete.title}" will be permanently removed. This can't be undone.` : undefined}
        confirmLabel="Delete event"
        loading={deleting}
        onConfirm={confirmDelete}
        onCancel={() => !deleting && setToDelete(null)}
      />
    </>
  );
}

export default function AdminPage() {
  return (
    <RequireAuth admin>
      <AdminDashboard />
    </RequireAuth>
  );
}
