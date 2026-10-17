import type { Metadata } from "next";
import { Inter } from "next/font/google";

import Navbar from "@/components/Navbar";
import { AuthProvider } from "@/context/AuthContext";

import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: { default: "EventBook", template: "%s · EventBook" },
  description: "Discover and book seats at upcoming events.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="flex min-h-screen flex-col font-sans">
        <AuthProvider>
          <Navbar />
          <main id="main-content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>
          <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
            EventBook · Next.js + FastAPI + PostgreSQL
          </footer>
        </AuthProvider>
      </body>
    </html>
  );
}
