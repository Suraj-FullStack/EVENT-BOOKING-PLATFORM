"use client";

/**
 * Home / public event listing.
 *
 * Page and search live in the URL (?page=2&search=rust) so results are
 * shareable and the back button works. All filtering and paging happens on
 * the server - we only ever fetch one page.
 */
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import EventCard from "@/components/EventCard";
import Pagination from "@/components/Pagination";
import { Alert, EmptyState, Input, LinkButton, SkeletonCard } from "@/components/ui";
import { eventsApi } from "@/lib/api";
import { useFetch } from "@/lib/useFetch";

const PAGE_SIZE = 9;

function EventListing() {
  const router = useRouter();
  const params = useSearchParams();

  // Sanitise the URL params - anything weird falls back to defaults.
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10) || 1);
  const search = (params.get("search") ?? "").slice(0, 100);

  // Keep the input in sync with the URL (e.g. after back/forward navigation).
  const [query, setQuery] = useState(search);
  const [syncedSearch, setSyncedSearch] = useState(search);
  if (syncedSearch !== search) {
    setSyncedSearch(search);
    setQuery(search);
  }

  const { data, error, loading, reload } = useFetch(
    () => eventsApi.list({ page, page_size: PAGE_SIZE, search }),
    [page, search],
  );

  function navigate(next: { page?: number; search?: string }) {
    const qs = new URLSearchParams();
    const s = next.search ?? search;
    const p = next.page ?? 1;
    if (s) qs.set("search", s);
    if (p > 1) qs.set("page", String(p));
    router.push(qs.toString() ? `/?${qs}` : "/");
  }

  return (
    <>
      <section id="hero-section" className="mb-8 rounded-2xl bg-slate-900 px-6 py-10 text-white sm:px-10 sm:py-14">
        <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">Find your next event.</h1>
        <p className="mt-3 max-w-xl text-slate-300">
          Workshops, meetups and talks. Browse what&apos;s coming up and grab a seat before it sells out.
        </p>
        <form
          className="mt-6 flex max-w-xl gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: query.trim(), page: 1 });
          }}
          role="search"
        >
          <Input
            id="search-input"
            type="search"
            placeholder="Search events by title…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            maxLength={100}
            aria-label="Search events by title"
            className="border-transparent"
          />
          <button type="submit" className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium hover:bg-brand-700">
            Search
          </button>
        </form>
      </section>

      <section id="event-list" aria-live="polite">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-800">
            {search ? (
              <>
                Results for &ldquo;{search}&rdquo;{" "}
                <button onClick={() => navigate({ search: "", page: 1 })} className="ml-2 text-sm font-normal text-brand-600 underline">
                  clear
                </button>
              </>
            ) : (
              "Upcoming events"
            )}
          </h2>
          {data && !loading && <span className="text-sm text-slate-500">{data.total} total</span>}
        </div>

        {error && (
          <Alert tone="error" onRetry={reload}>
            {error}
          </Alert>
        )}

        {loading && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        )}

        {!loading && !error && data && data.items.length === 0 && (
          <EmptyState
            title={search ? "No events match your search" : "No upcoming events yet"}
            body={search ? "Try a different keyword." : "Check back soon - new events are added regularly."}
            action={search ? <LinkButton href="/" variant="secondary">Show all events</LinkButton> : undefined}
          />
        )}

        {!loading && !error && data && data.items.length > 0 && (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.items.map((ev) => (
                <div key={ev.id} className="relative">
                  <EventCard event={ev} />
                </div>
              ))}
            </div>
            <Pagination
              page={data.page}
              totalPages={data.total_pages}
              total={data.total}
              pageSize={data.page_size}
              onChange={(p) => navigate({ page: p })}
            />
          </>
        )}
      </section>
    </>
  );
}

export default function HomePage() {
  // useSearchParams needs a Suspense boundary for static prerendering.
  return (
    <Suspense fallback={<div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}</div>}>
      <EventListing />
    </Suspense>
  );
}
