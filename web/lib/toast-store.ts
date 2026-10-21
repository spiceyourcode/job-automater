"use client";

export type ToastItem = {
  id: string;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  duration?: number;
};

const MAX_TOASTS = 3;

let items: ToastItem[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function subscribeToasts(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getToasts() {
  return items;
}

export function pushToast(item: ToastItem) {
  const exists = items.some((t) => t.id === item.id);
  items = exists
    ? items.map((t) => (t.id === item.id ? { ...t, ...item } : t))
    : [...items, item].slice(-MAX_TOASTS);
  emit();
}

export function dismissToast(id: string) {
  if (!items.some((t) => t.id === id)) return;
  items = items.filter((t) => t.id !== id);
  emit();
}
