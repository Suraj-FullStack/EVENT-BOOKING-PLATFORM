/**
 * Thin fetch wrapper around the FastAPI backend.
 *
 * - The base URL comes from NEXT_PUBLIC_API_BASE_URL (public, no secrets).
 * - `credentials: "include"` sends the HttpOnly auth cookie.
 * - `X-Requested-With` is the CSRF token the backend requires on writes.
 * - Non-2xx responses are turned into an ApiError with the backend's
 *   code/message so UI components can show something meaningful.
 */
import type {
  ApiErrorBody,
  AttendeeListResponse,
  Booking,
  Event,
  EventInput,
  EventListResponse,
  User,
} from "./types";

const BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  status: number;
  code: string;
  details?: { field: string; message: string }[];

  constructor(status: number, code: string, message: string, details?: ApiError["details"]) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** Map validation details to a { field: message } object for forms. */
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    for (const d of this.details ?? []) {
      if (d.field && !out[d.field]) out[d.field] = d.message;
    }
    return out;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!BASE_URL) {
    throw new ApiError(0, "config_error", "NEXT_PUBLIC_API_BASE_URL is not configured");
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    ...(init.headers as Record<string, string> | undefined),
  };
  if (init.body) headers["Content-Type"] = "application/json";

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}${path}`, { ...init, headers, credentials: "include", cache: "no-store" });
  } catch {
    throw new ApiError(0, "network_error", "Could not reach the server. Please check your connection.");
  }

  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON body - fall through */
  }

  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "http_error",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const authApi = {
  me: () => request<User>("/api/auth/me"),
  register: (data: { name: string; email: string; password: string }) =>
    request<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(data) }),
  login: (data: { email: string; password: string }) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(data) }),
  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),
};

// ---------------------------------------------------------------------------
// Public events + bookings
// ---------------------------------------------------------------------------
export const eventsApi = {
  list: (params: { page?: number; page_size?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    return request<EventListResponse>(`/api/events?${qs.toString()}`);
  },
  get: (id: number | string) => request<Event>(`/api/events/${id}`),
  book: (id: number | string) => request<Booking>(`/api/events/${id}/bookings`, { method: "POST" }),
};

export const bookingsApi = {
  mine: () => request<{ items: Booking[] }>("/api/bookings/me"),
  cancel: (id: number) => request<Booking>(`/api/bookings/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------
export const adminApi = {
  list: (params: { page?: number; page_size?: number; search?: string }) => {
    const qs = new URLSearchParams();
    if (params.page) qs.set("page", String(params.page));
    if (params.page_size) qs.set("page_size", String(params.page_size));
    if (params.search) qs.set("search", params.search);
    return request<EventListResponse>(`/api/admin/events?${qs.toString()}`);
  },
  create: (data: EventInput) =>
    request<Event>("/api/admin/events", { method: "POST", body: JSON.stringify(data) }),
  update: (id: number | string, data: Partial<EventInput>) =>
    request<Event>(`/api/admin/events/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  remove: (id: number) => request<void>(`/api/admin/events/${id}`, { method: "DELETE" }),
  attendees: (id: number | string) => request<AttendeeListResponse>(`/api/admin/events/${id}/attendees`),
};
