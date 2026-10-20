"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Bell,
  CalendarClock,
  FileCheck,
  MailCheck,
  Sparkles,
  TriangleAlert,
  Trophy,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { AnimatedList } from "@/components/ui/animated-list";
import { Button } from "@/components/ui/button";

const ICONS: Record<string, LucideIcon> = {
  high_match: Sparkles,
  interview_invitation: CalendarClock,
  offer: Trophy,
  rejection: XCircle,
  application_confirmation: MailCheck,
  docs_ready: FileCheck,
  submit_failed: TriangleAlert,
};

const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });

function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const diff = then - Date.now();
  const abs = Math.abs(diff);
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (abs < minute) return "just now";
  if (abs < hour) return rtf.format(Math.round(diff / minute), "minute");
  if (abs < day) return rtf.format(Math.round(diff / hour), "hour");
  if (abs < 7 * day) return rtf.format(Math.round(diff / day), "day");
  return new Date(iso).toLocaleDateString();
}

function hrefFor(n: NotificationItem): string | null {
  const data = n.data ?? {};
  const jobId = typeof data.job_id === "string" ? data.job_id : null;
  const applicationId =
    typeof data.application_id === "string" ? data.application_id : null;
  if (n.type === "high_match") return jobId ? `/jobs?job=${jobId}` : null;
  if (applicationId) return `/applications/${applicationId}/review`;
  return null;
}

export function NotificationBell() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await listNotificationsAction();
      if (res.ok && res.data) {
        setItems(res.data.notifications ?? []);
        setUnread(res.data.unreadCount ?? 0);
      }
    } catch {
      // Server-action transport errors must not crash the shell
    }
  }, []);

  useEffect(() => {
    // Deferred so the initial fetch never sets state during the mount commit.
    const initial = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), 60_000);
    const onRealtime = () => void load();
    window.addEventListener("jobautomater:notification", onRealtime);
    return () => {
      clearTimeout(initial);
      clearInterval(t);
      window.removeEventListener("jobautomater:notification", onRealtime);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const run = async (fn: () => Promise<unknown>) => {
    setPending(true);
    try {
      await fn();
      await load();
    } catch {
      // ignore
    } finally {
      setPending(false);
    }
  };

  const sorted = useMemo(
    () =>
      [...items].sort(
        (a, b) =>
          b.priority - a.priority ||
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      ),
    [items],
  );

  const onItem = (n: NotificationItem) => {
    const href = hrefFor(n);
    void run(async () => {
      if (!n.isRead) await markNotificationReadAction(n.id);
    });
    if (href) {
      setOpen(false);
      router.push(href);
    }
  };

  return (
    <div ref={rootRef} className="relative">
      <p className="sr-only" aria-live="polite">
        {unread > 0 ? `${unread} unread notifications` : "No unread notifications"}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative cursor-pointer"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        aria-expanded={open}
        onClick={() => {
          setOpen((o) => !o);
          if (!open) void load();
        }}
      >
        <Bell className="h-4 w-4" aria-hidden />
        {unread > 0 ? (
          <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-destructive" />
        ) : null}
      </Button>
      {open ? (
        <div
          className="absolute right-0 z-50 mt-2 w-80 rounded-md border bg-background p-2 shadow-md"
          role="dialog"
          aria-label="Notifications"
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <p className="text-sm font-medium">Notifications</p>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 cursor-pointer text-xs"
              disabled={pending || unread === 0}
              onClick={() => void run(() => markAllNotificationsReadAction())}
            >
              Mark all read
            </Button>
          </div>
          <AnimatedList aria-label="Notifications" className="max-h-80 overflow-y-auto">
            {sorted.length === 0 ? (
              <div className="px-2 py-6 text-center text-xs text-muted-foreground">
                No notifications yet.
              </div>
            ) : (
              sorted.map((n) => {
                const Icon = ICONS[n.type] ?? Bell;
                return (
                  <div key={n.id}>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-left hover:bg-accent"
                      onClick={() => onItem(n)}
                    >
                      <Icon
                        className={`mt-0.5 h-4 w-4 shrink-0 ${
                          n.isRead ? "text-muted-foreground" : "text-foreground"
                        }`}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium leading-snug">
                            {n.title}
                          </span>
                          {!n.isRead ? (
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-destructive" />
                          ) : null}
                        </span>
                        {n.message ? (
                          <span className="block text-xs text-muted-foreground">
                            {n.message}
                          </span>
                        ) : null}
                        <span className="block text-[10px] text-muted-foreground">
                          {relativeTime(n.createdAt)}
                        </span>
                      </span>
                    </button>
                  </div>
                );
              })
            )}
          </AnimatedList>
        </div>
      ) : null}
    </div>
  );
}
