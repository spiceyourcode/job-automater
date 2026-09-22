"use client";

import { RealtimeListener } from "@/components/realtime-listener";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { TopNav } from "@/components/top-nav";

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:ring-2 focus:ring-ring"
      >
        Skip to main content
      </a>
      <RealtimeListener />
      <KeyboardShortcuts />

      <TopNav title={title} />

      <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}