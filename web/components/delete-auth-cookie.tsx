"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function DeleteAuthCookieAndRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Delete cookie by setting it to expire in the past
    document.cookie = "access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    router.push("/login");
  }, [router]);

  return null;
}