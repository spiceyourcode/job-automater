"use client";

import { useEffect, useState, useTransition } from "react";
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
  const [pending, startTransition] = useTransition();

  const load = () => {
    startTransition(async () => {
      const res = await listNotificationsAction();
      if (res.ok && res.data) {
        setItems(res.data.notifications);
        setUnread(res.data.unreadCount);
      }
    });
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
          if (!open) load();
        }}
      >
        <Bell className="h-4 w-4" />
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
              onClick={() => {
                startTransition(async () => {
                  await markAllNotificationsReadAction();
                  load();
                });
              }}
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
                    onClick={() => {
                      startTransition(async () => {
                        if (!n.isRead) await markNotificationReadAction(n.id);
                        load();
                      });
                    }}
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
