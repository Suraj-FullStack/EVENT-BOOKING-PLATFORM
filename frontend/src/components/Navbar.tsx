"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";

import { useAuth } from "@/context/AuthContext";

/**
 * Top navigation. Links are role-aware but remember: hiding a link is a
 * convenience, not security - the backend enforces every permission.
 */
export default function Navbar() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function handleLogout() {
    setSigningOut(true);
    try {
      await logout();
      router.push("/");
      router.refresh();
    } finally {
      setSigningOut(false);
      setOpen(false);
    }
  }

  const linkClass = (href: string) =>
    `rounded-md px-3 py-2 text-sm font-medium transition ${
      pathname === href || (href !== "/" && pathname.startsWith(href))
        ? "bg-slate-800 text-white"
        : "text-slate-300 hover:bg-slate-800 hover:text-white"
    }`;

  const links = (
    <>
      <Link href="/" className={linkClass("/")} onClick={() => setOpen(false)}>
        Events
      </Link>
      {user && (
        <Link href="/bookings" className={linkClass("/bookings")} onClick={() => setOpen(false)}>
          My bookings
        </Link>
      )}
      {user?.role === "admin" && (
        <Link href="/admin" className={linkClass("/admin")} onClick={() => setOpen(false)}>
          Admin
        </Link>
      )}
    </>
  );

  const authArea = loading ? (
    <span className="h-8 w-24 animate-pulse rounded-md bg-slate-800" aria-hidden />
  ) : user ? (
    <div className="flex items-center gap-3">
      <span className="hidden text-sm text-slate-300 sm:inline" title={user.email}>
        Hi, {user.name.split(" ")[0]}
        {user.role === "admin" && <span className="ml-2 rounded bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-300">admin</span>}
      </span>
      <button
        onClick={handleLogout}
        disabled={signingOut}
        className="rounded-md border border-slate-600 px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
      >
        {signingOut ? "Signing out…" : "Sign out"}
      </button>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link href="/login" className="rounded-md px-3 py-1.5 text-sm text-slate-200 hover:bg-slate-800">
        Log in
      </Link>
      <Link href="/register" className="rounded-md bg-brand-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
        Sign up
      </Link>
    </div>
  );

  return (
    <nav id="main-nav" className="bg-slate-900 text-white">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-sm">EB</span>
            EventBook
          </Link>
          <div className="hidden items-center gap-1 md:flex">{links}</div>
        </div>

        <div className="hidden md:block">{authArea}</div>

        <button
          className="rounded-md p-2 text-slate-300 hover:bg-slate-800 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
          aria-expanded={open}
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {open ? <path d="M6 6l12 12M6 18L18 6" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {open && (
        <div className="border-t border-slate-800 px-4 py-3 md:hidden">
          <div className="flex flex-col gap-1">{links}</div>
          <div className="mt-3 border-t border-slate-800 pt-3">{authArea}</div>
        </div>
      )}
    </nav>
  );
}
