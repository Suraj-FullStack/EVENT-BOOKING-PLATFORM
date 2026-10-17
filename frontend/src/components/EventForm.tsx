"use client";

/**
 * Create/edit form for events. Used by both admin pages so validation and
 * layout stay identical. The backend is the real validator - this just
 * catches the obvious mistakes before a round trip.
 */
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { adminApi, ApiError } from "@/lib/api";
import { fromDateTimeLocal, toDateTimeLocal } from "@/lib/format";
import type { Event, EventInput } from "@/lib/types";

import { Alert, Button, Card, Field, Input, Textarea } from "./ui";

interface FormState {
  title: string;
  description: string;
  starts_at: string; // datetime-local value
  venue: string;
  total_seats: string;
}

function toState(event?: Event): FormState {
  return {
    title: event?.title ?? "",
    description: event?.description ?? "",
    starts_at: event ? toDateTimeLocal(event.starts_at) : "",
    venue: event?.venue ?? "",
    total_seats: event ? String(event.total_seats) : "",
  };
}

function validate(v: FormState, minSeats: number) {
  const errors: Record<string, string> = {};
  if (v.title.trim().length < 3) errors.title = "Title needs at least 3 characters";
  if (!v.description.trim()) errors.description = "Please add a description";
  if (!v.starts_at || Number.isNaN(new Date(v.starts_at).getTime())) errors.starts_at = "Pick a valid date and time";
  if (v.venue.trim().length < 2) errors.venue = "Venue needs at least 2 characters";
  const seats = Number(v.total_seats);
  if (!Number.isInteger(seats) || seats < 1) errors.total_seats = "Seats must be a whole number of at least 1";
  else if (seats < minSeats) errors.total_seats = `Can't go below ${minSeats} - that many seats are already booked`;
  return errors;
}

export default function EventForm({ event }: { event?: Event }) {
  const router = useRouter();
  const isEdit = !!event;
  const minSeats = event?.booked_seats ?? 1;

  const [values, setValues] = useState<FormState>(toState(event));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function update(field: keyof FormState, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(values, minSeats);
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    const payload: EventInput = {
      title: values.title.trim(),
      description: values.description.trim(),
      starts_at: fromDateTimeLocal(values.starts_at),
      venue: values.venue.trim(),
      total_seats: Number(values.total_seats),
    };

    setSaving(true);
    try {
      if (isEdit) await adminApi.update(event.id, payload);
      else await adminApi.create(payload);
      router.push("/admin");
      router.refresh();
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (Object.keys(fe).length) setErrors(fe);
        else if (err.code === "capacity_below_bookings") setErrors({ total_seats: err.message });
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <form onSubmit={handleSubmit} noValidate className="space-y-5" id="event-form">
        {formError && <Alert tone="error">{formError}</Alert>}

        <Field label="Title" htmlFor="title" error={errors.title}>
          <Input id="title" value={values.title} onChange={(e) => update("title", e.target.value)} error={!!errors.title} maxLength={200} />
        </Field>

        <Field label="Description" htmlFor="description" error={errors.description}>
          <Textarea id="description" value={values.description} onChange={(e) => update("description", e.target.value)} error={!!errors.description} maxLength={5000} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Date & time" htmlFor="starts_at" error={errors.starts_at} hint="Shown in your local timezone">
            <Input id="starts_at" type="datetime-local" value={values.starts_at} onChange={(e) => update("starts_at", e.target.value)} error={!!errors.starts_at} />
          </Field>

          <Field
            label="Total seats"
            htmlFor="total_seats"
            error={errors.total_seats}
            hint={isEdit && event.booked_seats > 0 ? `${event.booked_seats} already booked` : undefined}
          >
            <Input id="total_seats" type="number" min={minSeats} step={1} value={values.total_seats} onChange={(e) => update("total_seats", e.target.value)} error={!!errors.total_seats} />
          </Field>
        </div>

        <Field label="Venue" htmlFor="venue" error={errors.venue}>
          <Input id="venue" value={values.venue} onChange={(e) => update("venue", e.target.value)} error={!!errors.venue} maxLength={200} />
        </Field>

        <div className="flex items-center justify-end gap-2 border-t border-slate-100 pt-5">
          <Link href="/admin" className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
            Cancel
          </Link>
          <Button type="submit" loading={saving}>
            {isEdit ? "Save changes" : "Create event"}
          </Button>
        </div>
      </form>
    </Card>
  );
}
