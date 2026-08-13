"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(2),
});

export type ActionState = { error?: string } | undefined;

async function setAuthCookies(tokens: {
  accessToken: string;
  refreshToken: string;
}) {
  const cookieStore = await cookies();
  cookieStore.set("access_token", tokens.accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 15,
    path: "/",
  });
  cookieStore.set("refresh_token", tokens.refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function loginAction(input: {
  email: string;
  password: string;
}): Promise<ActionState> {
  const parsed = loginSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return { error: (body?.error as string | undefined) ?? "Invalid credentials" };
  }

  const data = (await res.json()) as {
    tokens: { accessToken: string; refreshToken: string };
  };
  await setAuthCookies(data.tokens);

  // Incomplete onboarding → wizard; complete → dashboard
  const { fetchOwnProfile, setOnboardingCompleteCookie } = await import("./profile");
  const { profileMeetsOnboardingRequirements } = await import("../onboarding");
  const profileResult = await fetchOwnProfile();
  if (profileResult.ok && profileResult.data) {
    const gate = profileMeetsOnboardingRequirements(profileResult.data);
    if (gate.ok) {
      await setOnboardingCompleteCookie(true);
      redirect("/dashboard");
    }
  }
  await setOnboardingCompleteCookie(false);
  redirect("/onboarding");
}

export async function registerAction(input: {
  email: string;
  password: string;
  name: string;
}): Promise<ActionState> {
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      error: (body?.error as string | undefined) ?? "Registration failed",
    };
  }

  const data = (await res.json()) as {
    tokens: { accessToken: string; refreshToken: string };
  };
  await setAuthCookies(data.tokens);
  redirect("/onboarding");
}

export async function logoutAction(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value;

  if (token) {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    }).catch(() => {});
  }

  cookieStore.delete("access_token");
  cookieStore.delete("refresh_token");
  cookieStore.delete("onboarding_complete");
  redirect("/login");
}

export async function forgotPasswordAction(input: {
  email: string;
}): Promise<ActionState> {
  const parsed = z.object({ email: z.string().email() }).safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/forgot-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    if (!res.ok) return { error: "Could not start password reset" };
    return undefined;
  } catch {
    return { error: "Network error — is the API running?" };
  }
}

export async function resetPasswordAction(input: {
  token: string;
  password: string;
}): Promise<ActionState> {
  const parsed = z
    .object({
      token: z.string().min(20),
      password: z.string().min(8),
    })
    .safeParse(input);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Validation failed" };
  }
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/reset-password`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        error: (body?.error as string | undefined) ?? "Reset failed",
      };
    }
    return undefined;
  } catch {
    return { error: "Network error — is the API running?" };
  }
}

export async function verifyEmailAction(input: {
  token: string;
}): Promise<ActionState> {
  const parsed = z.object({ token: z.string().min(20) }).safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid verification link" };
  }
  try {
    const res = await fetch(`${API_URL}/api/v1/auth/verify-email`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        error: (body?.error as string | undefined) ?? "Verification failed",
      };
    }
    return undefined;
  } catch {
    return { error: "Network error — is the API running?" };
  }
}

/** One-time OAuth exchange code → httpOnly cookies (HG-1). */
export async function completeOAuthAction(input: {
  code: string;
}): Promise<ActionState> {
  const parsed = z.object({ code: z.string().min(20).max(128) }).safeParse(input);
  if (!parsed.success) {
    return { error: "Invalid OAuth session" };
  }

  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/oauth/exchange`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: parsed.data.code }),
      cache: "no-store",
    });
  } catch {
    return { error: "Network error — is the API running?" };
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    return {
      error: (body?.error as string | undefined) ?? "OAuth sign-in failed",
    };
  }

  const data = (await res.json()) as {
    tokens: { accessToken: string; refreshToken: string };
  };
  await setAuthCookies(data.tokens);

  const { fetchOwnProfile, setOnboardingCompleteCookie } = await import(
    "./profile"
  );
  const { profileMeetsOnboardingRequirements } = await import("../onboarding");
  const profileResult = await fetchOwnProfile();
  if (profileResult.ok && profileResult.data) {
    const gate = profileMeetsOnboardingRequirements(profileResult.data);
    if (gate.ok) {
      await setOnboardingCompleteCookie(true);
      redirect("/dashboard");
    }
  }
  await setOnboardingCompleteCookie(false);
  redirect("/onboarding");
}
