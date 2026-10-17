/**
 * Types mirroring the FastAPI response schemas (backend/app/schemas).
 * If a field changes on the backend it should change here too.
 */

export type Role = "user" | "admin";

export interface User {
  id: number;
  name: string;
  email: string;
  role: Role;
  created_at: string;
}

export interface Event {
  id: number;
  title: string;
  description: string;
  starts_at: string; // ISO 8601 with offset
  venue: string;
  total_seats: number;
  booked_seats: number;
  available_seats: number;
  is_full: boolean;
  is_past: boolean;
  created_at: string;
  updated_at: string;
}

export interface EventListResponse {
  items: Event[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export type BookingStatus = "active" | "cancelled";

export interface Booking {
  id: number;
  event_id: number;
  status: BookingStatus;
  created_at: string;
  cancelled_at: string | null;
  event: Pick<Event, "id" | "title" | "starts_at" | "venue">;
  is_past: boolean;
  can_cancel: boolean;
}

export interface Attendee {
  booking_id: number;
  user_id: number;
  name: string;
  email: string;
  status: BookingStatus;
  booked_at: string;
  cancelled_at: string | null;
}

export interface AttendeeListResponse {
  event: Event;
  attendees: Attendee[];
  active_count: number;
}

export interface EventInput {
  title: string;
  description: string;
  starts_at: string;
  venue: string;
  total_seats: number;
}

/** The error envelope every non-2xx API response uses. */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: { field: string; message: string }[];
  };
}
