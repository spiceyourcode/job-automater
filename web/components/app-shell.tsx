"use client";

import { useState } from "react";
import { RealtimeListener } from "@/components/realtime-listener";
import { KeyboardShortcuts } from "@/components/keyboard-shortcuts";
import { TopNav } from "@/components/top-nav";
import { IconRail } from "@/components/icon-rail";

export function AppShell({
  children,
  title,
}: {
  children: React.ReactNode;
  title?: string;
}) {
  const [showIconRail, setShowIconRail] = useState(true);

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

      <TopNav
        title={title}
        onToggleIconRail={() => setShowIconRail((v) => !v)}
        showIconRail={showIconRail}
      />

      <div className="flex flex-1 overflow-hidden">
        {showIconRail && <IconRail />}

        <main className="flex-1 overflow-y-auto" id="main-content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}