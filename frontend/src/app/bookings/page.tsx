"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import ConfirmDialog from "@/components/ConfirmDialog";
import RequireAuth from "@/components/RequireAuth";
import { Alert, Badge, Button, EmptyState, LinkButton, PageHeader, SkeletonCard } from "@/components/ui";
import { ApiError, bookingsApi } from "@/lib/api";
import { formatDateTime } from "@/lib/format";
import type { Booking } from "@/lib/types";
import { useFetch } from "@/lib/useFetch";

function BookingRow({ booking, onCancel }: { booking: Booking; onCancel: (b: Booking) => void }) {
  const tone = booking.status === "cancelled" ? "slate" : booking.is_past ? "blue" : "green";
  const label = booking.status === "cancelled" ? "Cancelled" : booking.is_past ? "Attended" : "Confirmed";

  return (
    <li className="booking-row flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{label}</Badge>
          <time dateTime={booking.event.starts_at} className="text-xs text-slate-500">
            {formatDateTime(booking.event.starts_at)}
          </time>
        </div>
        <h3 className="mt-1.5 truncate text-base font-semibold text-slate-900">
          <Link href={`/events/${booking.event.id}`} className="hover:text-brand-700 hover:underline">
            {booking.event.title}
          </Link>
        </h3>
        <p className="text-sm text-slate-600">{booking.event.venue}</p>
        <p className="mt-1 text-xs text-slate-400">
          Booked {formatDateTime(booking.created_at)}
          {booking.cancelled_at && ` · cancelled ${formatDateTime(booking.cancelled_at)}`}
        </p>
      </div>
      {booking.can_cancel && (
        <Button variant="secondary" onClick={() => onCancel(booking)} className="shrink-0">
          Cancel booking
        </Button>
      )}
    </li>
  );
}

function Section({ title, items, onCancel }: { title: string; items: Booking[]; onCancel: (b: Booking) => void }) {
  if (items.length === 0) return null;
  return (
    <section className="mb-8">
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-500">
        {title} <span className="ml-1 font-normal text-slate-400">({items.length})</span>
      </h2>
      <ul className="space-y-3">
        {items.map((b) => (
          <BookingRow key={b.id} booking={b} onCancel={onCancel} />
        ))}
      </ul>
    </section>
  );
}

function MyBookings() {
  const { data, error, loading, reload, setData } = useFetch(() => bookingsApi.mine(), []);
  const bookings = data?.items ?? null;
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const [target, setTarget] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const groups = useMemo(() => {
    const all = bookings ?? [];
    return {
      upcoming: all.filter((b) => b.status === "active" && !b.is_past),
      past: all.filter((b) => b.status === "active" && b.is_past),
      cancelled: all.filter((b) => b.status === "cancelled"),
    };
  }, [bookings]);

  async function confirmCancel() {
    if (!target) return;
    setCancelling(true);
    setNotice(null);
    try {
      const updated = await bookingsApi.cancel(target.id);
      setData((prev) => (prev ? { items: prev.items.map((b) => (b.id === updated.id ? updated : b)) } : prev));
      setNotice({ tone: "success", text: `Your booking for "${target.event.title}" was cancelled.` });
      setTarget(null);
    } catch (err) {
      setNotice({ tone: "error", text: err instanceof ApiError ? err.message : "Could not cancel this booking" });
      setTarget(null);
      reload();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      <PageHeader title="My bookings" subtitle="Everything you've reserved, past and present." />

      {notice && (
        <div className="mb-6">
          <Alert tone={notice.tone}>{notice.text}</Alert>
        </div>
      )}

      {error && (
        <Alert tone="error" onRetry={reload}>
          {error}
        </Alert>
      )}

      {loading && !bookings && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      )}

      {!loading && !error && bookings && bookings.length === 0 && (
        <EmptyState
          title="No bookings yet"
          body="When you book a seat at an event it will show up here."
          action={<LinkButton href="/">Browse events</LinkButton>}
        />
      )}

      {!loading && !error && bookings && bookings.length > 0 && (
        <>
          <Section title="Upcoming" items={groups.upcoming} onCancel={setTarget} />
          <Section title="Past" items={groups.past} onCancel={setTarget} />
          <Section title="Cancelled" items={groups.cancelled} onCancel={setTarget} />
        </>
      )}

      <ConfirmDialog
        open={!!target}
        title="Cancel this booking?"
        body={target ? `Your seat at "${target.event.title}" will be released for someone else. You can book again later if seats remain.` : undefined}
        confirmLabel="Yes, cancel booking"
        loading={cancelling}
        onConfirm={confirmCancel}
        onCancel={() => !cancelling && setTarget(null)}
      />
    </>
  );
}

export default function BookingsPage() {
  return (
    <RequireAuth>
      <MyBookings />
    </RequireAuth>
  );
}
