import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { AppProvider } from "@/lib/store";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Goal Goal Gadget",
  description:
    "Goal management for ambitious people. Break big goals into milestone trees and clear them level by level.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${geist.className} min-h-screen bg-zinc-50 text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100`}
      >
        <AppProvider>
          <header className="border-b border-zinc-200 dark:border-zinc-800">
            <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
              <Link href="/" className="text-lg font-bold tracking-tight">
                Goal Goal Gadget{" "}
                <span className="hidden text-sm font-normal text-zinc-500 sm:inline">
                  level up your goals
                </span>
              </Link>
              <nav className="flex gap-4 text-sm">
                <Link href="/" className="hover:underline">
                  Goals
                </Link>
                <Link href="/account" className="hover:underline">
                  Account
                </Link>
                <Link
                  href="/upgrade"
                  className="font-medium text-amber-600 hover:underline dark:text-amber-400"
                >
                  Pro
                </Link>
              </nav>
            </div>
          </header>
          <main className="mx-auto max-w-2xl px-4 py-6">{children}</main>
        </AppProvider>
      </body>
    </html>
  );
}
