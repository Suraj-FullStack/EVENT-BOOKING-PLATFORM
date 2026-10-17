import Link from "next/link";

import { formatDate, formatTime } from "@/lib/format";
import type { Event } from "@/lib/types";

import { Badge } from "./ui";

export function AvailabilityBadge({ event }: { event: Event }) {
  if (event.is_past) return <Badge tone="slate">Past</Badge>;
  if (event.is_full) return <Badge tone="red">Sold out</Badge>;
  if (event.available_seats <= Math.max(2, Math.ceil(event.total_seats * 0.1)))
    return <Badge tone="amber">{event.available_seats} left</Badge>;
  return <Badge tone="green">{event.available_seats} seats available</Badge>;
}

export default function EventCard({ event }: { event: Event }) {
  return (
    <article className="event-card group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <time dateTime={event.starts_at} className="text-xs font-semibold uppercase tracking-wide text-brand-600">
          {formatDate(event.starts_at)} · {formatTime(event.starts_at)}
        </time>
        <AvailabilityBadge event={event} />
      </div>

      <h3 className="mt-2 text-lg font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
        <Link href={`/events/${event.id}`} className="after:absolute after:inset-0">
          {event.title}
        </Link>
      </h3>

      <p className="mt-2 line-clamp-2 text-sm text-slate-600">{event.description}</p>

      <dl className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-600">
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Venue</dt>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M12 22s7-7.5 7-12a7 7 0 1 0-14 0c0 4.5 7 12 7 12z" />
            <circle cx="12" cy="10" r="2.5" />
          </svg>
          <dd>{event.venue}</dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt className="sr-only">Capacity</dt>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <circle cx="9" cy="8" r="3.5" />
            <path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-5-6.3" />
          </svg>
          <dd>
            {event.booked_seats}/{event.total_seats} booked
          </dd>
        </div>
      </dl>
    </article>
  );
}
