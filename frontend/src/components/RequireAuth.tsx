"use client";

/**
 * Client-side route guard. Redirects anonymous visitors to /login (and
 * non-admins away from admin pages). This is purely UX - every protected
 * API call is independently authorised by the backend.
 */
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/context/AuthContext";

import { Spinner } from "./ui";

export default function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (admin && user.role !== "admin") {
      router.replace("/");
    }
  }, [loading, user, admin, router, pathname]);

  if (loading || !user || (admin && user.role !== "admin")) {
    return (
      <div className="flex justify-center py-24 text-brand-600">
        <Spinner size="lg" />
      </div>
    );
  }
  return <>{children}</>;
}
