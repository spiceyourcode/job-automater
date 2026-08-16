"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";
import {
  listNotificationsAction,
  markAllNotificationsReadAction,
  markNotificationReadAction,
  type NotificationItem,
} from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [pending, setPending] = useState(false);

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
    void load();
    const t = setInterval(() => void load(), 60_000);
    const onRealtime = () => void load();
    window.addEventListener("jobautomater:notification", onRealtime);
    return () => {
      clearInterval(t);
      window.removeEventListener("jobautomater:notification", onRealtime);
    };
  }, [load]);

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

  return (
    <div className="relative">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="relative cursor-pointer"
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
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
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {items.length === 0 ? (
              <li className="px-2 py-6 text-center text-xs text-muted-foreground">
                No notifications yet.
              </li>
            ) : (
              items.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    className="w-full cursor-pointer rounded-md px-2 py-2 text-left hover:bg-accent"
                    onClick={() =>
                      void run(async () => {
                        if (!n.isRead) await markNotificationReadAction(n.id);
                      })
                    }
                  >
                    <p className="text-sm font-medium leading-snug">{n.title}</p>
                    {n.message ? (
                      <p className="text-xs text-muted-foreground">{n.message}</p>
                    ) : null}
                    {!n.isRead ? (
                      <span className="text-[10px] text-destructive">Unread</span>
                    ) : null}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
