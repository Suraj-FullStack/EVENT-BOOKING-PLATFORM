"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";

import { AvailabilityBadge } from "@/components/EventCard";
import { Alert, Button, Card, LinkButton, Spinner } from "@/components/ui";
import { useAuth } from "@/context/AuthContext";
import { ApiError, eventsApi } from "@/lib/api";
import { formatDate, formatTime } from "@/lib/format";
import { useFetch } from "@/lib/useFetch";

export default function EventDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const { data: event, error: loadError, errorStatus, loading, reload } = useFetch(() => eventsApi.get(id), [id]);
  const error = loadError ? { message: errorStatus === 404 ? "Event not found" : loadError, notFound: errorStatus === 404 } : null;

  const [booking, setBooking] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  async function handleBook() {
    if (!event) return;
    setBooking(true);
    setBookingError(null);
    try {
      await eventsApi.book(event.id);
      setBookingSuccess(true);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.push(`/login?next=/events/${event.id}`);
        return;
      }
      setBookingError(err instanceof ApiError ? err.message : "Booking failed, please try again");
    } finally {
      setBooking(false);
      reload(); // refresh seat counts either way - someone else may have taken the seat
    }
  }

  if (loading && !event) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner size="lg" />
      </div>
    );
  }

  if (error && !event) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{error.notFound ? "Event not found" : "Something went wrong"}</h1>
        <p className="mt-2 text-slate-600">
          {error.notFound ? "This event may have been removed." : error.message}
        </p>
        <div className="mt-6 flex justify-center gap-2">
          {!error.notFound && (
            <Button variant="secondary" onClick={reload}>
              Try again
            </Button>
          )}
          <LinkButton href="/">Back to events</LinkButton>
        </div>
      </div>
    );
  }

  if (!event) return null;

  const canBook = !event.is_past && !event.is_full;

  return (
    <article className="mx-auto max-w-4xl">
      <Link href="/" className="text-sm text-brand-600 hover:underline">
        ← All events
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_320px]">
        <section>
          <div className="flex flex-wrap items-center gap-3">
            <AvailabilityBadge event={event} />
            <time dateTime={event.starts_at} className="text-sm font-medium text-slate-600">
              {formatDate(event.starts_at)} at {formatTime(event.starts_at)}
            </time>
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{event.title}</h1>
          <p className="mt-1 text-slate-600">{event.venue}</p>

          <div className="prose prose-slate mt-6 max-w-none">
            <h2 className="text-lg font-semibold text-slate-900">About this event</h2>
            <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{event.description}</p>
          </div>
        </section>

        <aside>
          <Card className="sticky top-6">
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-slate-500">Date</dt>
                <dd className="font-medium text-slate-900">{formatDate(event.starts_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Time</dt>
                <dd className="font-medium text-slate-900">{formatTime(event.starts_at)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Venue</dt>
                <dd className="text-right font-medium text-slate-900">{event.venue}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Total seats</dt>
                <dd className="font-medium text-slate-900">{event.total_seats}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-slate-500">Available</dt>
                <dd className={`font-semibold ${event.is_full ? "text-red-600" : "text-green-700"}`}>
                  {event.available_seats}
                </dd>
              </div>
            </dl>

            <div className="mt-5 h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden>
              <div
                className={`h-full ${event.is_full ? "bg-red-500" : "bg-brand-500"}`}
                style={{ width: `${Math.min(100, (event.booked_seats / event.total_seats) * 100)}%` }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {bookingSuccess && (
                <Alert tone="success">
                  Seat booked! View it in <Link href="/bookings" className="font-medium underline">My bookings</Link>.
                </Alert>
              )}
              {bookingError && <Alert tone="error">{bookingError}</Alert>}

              {event.is_past ? (
                <Alert tone="info">This event has already taken place, so bookings are closed.</Alert>
              ) : event.is_full ? (
                <Alert tone="warning">This event is sold out. If someone cancels, a seat will reappear here.</Alert>
              ) : authLoading ? (
                <Button className="w-full" disabled>
                  <Spinner size="sm" />
                </Button>
              ) : user ? (
                <Button id="book-button" className="w-full" onClick={handleBook} loading={booking} disabled={!canBook || bookingSuccess}>
                  {bookingSuccess ? "Booked" : "Book a seat"}
                </Button>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm text-slate-600">Log in or create an account to book a seat.</p>
                  <div className="grid grid-cols-2 gap-2">
                    <LinkButton href={`/login?next=/events/${event.id}`} variant="secondary">
                      Log in
                    </LinkButton>
                    <LinkButton href={`/register?next=/events/${event.id}`}>Sign up</LinkButton>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </aside>
      </div>
    </article>
  );
}
