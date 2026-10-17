"use client";

import { useEffect } from "react";

import { Button, LinkButton } from "@/components/ui";

/** App-wide error boundary. Next.js renders this when a route throws. */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-2xl font-bold text-slate-900">Something went wrong</h1>
      <p className="mt-2 text-slate-600">An unexpected error occurred. You can try again or head back home.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Button variant="secondary" onClick={reset}>
          Try again
        </Button>
        <LinkButton href="/">Back to events</LinkButton>
      </div>
    </div>
  );
}
