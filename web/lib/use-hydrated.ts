"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/** False during SSR and the first client render, true once hydration is complete. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
