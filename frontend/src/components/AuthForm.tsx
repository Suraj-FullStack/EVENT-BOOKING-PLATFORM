"use client";

/**
 * Login and register share almost everything, so one component handles both.
 * Client-side validation gives instant feedback; the backend re-validates.
 */
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/api";

import { Alert, Button, Card, Field, Input } from "./ui";

type Mode = "login" | "register";

function validate(mode: Mode, v: { name: string; email: string; password: string }) {
  const errors: Record<string, string> = {};
  if (mode === "register" && v.name.trim().length < 2) errors.name = "Please enter your name (2+ characters)";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) errors.email = "Enter a valid email address";
  if (mode === "register" && v.password.length < 8) errors.password = "Password must be at least 8 characters";
  if (mode === "login" && !v.password) errors.password = "Enter your password";
  return errors;
}

/** Only allow relative redirects so ?next= can't send users off-site. */
function safeNext(raw: string | null): string {
  return raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : "/";
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const { user, loading, login, register } = useAuth();

  const [values, setValues] = useState({ name: "", email: "", password: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Already signed in? No need to see this page.
  useEffect(() => {
    if (!loading && user) router.replace(next);
  }, [loading, user, next, router]);

  function update(field: keyof typeof values, value: string) {
    setValues((v) => ({ ...v, [field]: value }));
    if (errors[field]) setErrors((e) => ({ ...e, [field]: "" }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    const clientErrors = validate(mode, values);
    if (Object.keys(clientErrors).length) return setErrors(clientErrors);

    setSubmitting(true);
    try {
      if (mode === "login") await login(values.email, values.password);
      else await register(values.name, values.email, values.password);
      router.replace(next);
    } catch (err) {
      if (err instanceof ApiError) {
        const fe = err.fieldErrors;
        if (Object.keys(fe).length) setErrors(fe);
        else setFormError(err.message);
      } else {
        setFormError("Something went wrong. Please try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const isLogin = mode === "login";

  return (
    <div className="mx-auto max-w-md py-8">
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-bold text-slate-900">{isLogin ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-sm text-slate-600">
          {isLogin ? "Log in to book seats and manage your bookings." : "It only takes a minute."}
        </p>
      </div>

      <Card>
        <form onSubmit={handleSubmit} noValidate className="space-y-4" id={`${mode}-form`}>
          {formError && <Alert tone="error">{formError}</Alert>}

          {!isLogin && (
            <Field label="Full name" htmlFor="name" error={errors.name}>
              <Input id="name" autoComplete="name" value={values.name} onChange={(e) => update("name", e.target.value)} error={!!errors.name} />
            </Field>
          )}

          <Field label="Email" htmlFor="email" error={errors.email}>
            <Input id="email" type="email" autoComplete="email" value={values.email} onChange={(e) => update("email", e.target.value)} error={!!errors.email} />
          </Field>

          <Field label="Password" htmlFor="password" error={errors.password} hint={isLogin ? undefined : "At least 8 characters"}>
            <Input
              id="password"
              type="password"
              autoComplete={isLogin ? "current-password" : "new-password"}
              value={values.password}
              onChange={(e) => update("password", e.target.value)}
              error={!!errors.password}
            />
          </Field>

          <Button type="submit" className="w-full" loading={submitting}>
            {isLogin ? "Log in" : "Create account"}
          </Button>
        </form>
      </Card>

      <p className="mt-4 text-center text-sm text-slate-600">
        {isLogin ? (
          <>
            New here?{" "}
            <Link href={`/register?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-medium text-brand-600 hover:underline">
              Log in
            </Link>
          </>
        )}
      </p>
    </div>
  );
}
