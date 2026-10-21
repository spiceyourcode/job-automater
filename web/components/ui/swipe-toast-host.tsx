"use client";

import { useSyncExternalStore } from "react";
import SwipeToast from "@/components/ui/swipe-toast";
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
} from "@/lib/toast-store";

const EMPTY: ToastItem[] = [];
const getServerToasts = () => EMPTY;

/** Fixed stack for inline SwipeToasts — inline mode needs a positioning parent. */
export function SwipeToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);

  return (
    <div
      className="pointer-events-none fixed right-4 bottom-4 z-[999999998] flex w-[min(356px,calc(100vw-32px))] flex-col-reverse items-end gap-2 sm:right-8 sm:bottom-8"
      aria-live="polite"
      aria-relevant="additions"
    >
      {toasts.map((toast) => (
        <SwipeToast
          key={toast.id}
          inline
          className="pointer-events-auto"
          title={toast.title}
          description={toast.description}
          actionLabel={toast.actionLabel}
          onAction={toast.onAction}
          duration={toast.duration ?? 5000}
          closeButton
          onClose={() => dismissToast(toast.id)}
        />
      ))}
    </div>
  );
}
