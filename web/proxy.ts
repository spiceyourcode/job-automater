import { decodeJwt } from "jose";
import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/oauth",
  "/auth",
  "/",
];

const API_URL =
  process.env.API_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4001";

const ACCESS_EXPIRY_SKEW_MS = 5_000;
const REFRESH_TIMEOUT_MS = 2_500;
const REFRESH_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

type RefreshedTokens = { accessToken: string; refreshToken: string };

type RefreshOutcome =
  | { status: "success"; tokens: RefreshedTokens }
  | { status: "unauthorized" }
  | { status: "error" };

function accessTokenNeedsRefresh(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp !== "number") return true;
    return exp * 1000 <= Date.now() + ACCESS_EXPIRY_SKEW_MS;
  } catch {
    return true;
  }
}

function accessTokenMaxAge(token: string): number {
  try {
    const { exp } = decodeJwt(token);
    if (typeof exp === "number") {
      return Math.max(0, Math.floor(exp - Date.now() / 1000));
    }
  } catch {
    // fall through to default
  }
  return 60 * 60;
}

async function refreshSession(refreshToken: string): Promise<RefreshOutcome> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      cache: "no-store",
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    return { status: "error" };
  }

  if (res.status === 401) return { status: "unauthorized" };
  if (!res.ok) return { status: "error" };

  const data = (await res.json().catch(() => null)) as
    | { accessToken?: unknown; refreshToken?: unknown }
    | null;
  if (
    !data ||
    typeof data.accessToken !== "string" ||
    typeof data.refreshToken !== "string"
  ) {
    return { status: "error" };
  }
  return {
    status: "success",
    tokens: {
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    },
  };
}

function shouldAttemptRefresh(request: NextRequest): boolean {
  return request.method === "GET" && !request.headers.has("next-action");
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const onboardingDone =
    request.cookies.get("onboarding_complete")?.value === "1";

  const isPublicPath = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const isAuthPath = pathname === "/login" || pathname === "/register";
  const isDashboard = pathname.startsWith("/dashboard");
  const isOnboarding = pathname.startsWith("/onboarding");
  const isSettings = pathname.startsWith("/settings");
  const isAnalytics = pathname.startsWith("/analytics");
  const isApplications = pathname.startsWith("/applications");
  const isCrm = pathname.startsWith("/crm");
  const isJobs = pathname.startsWith("/jobs");
  const isAppSurface =
    isDashboard ||
    isOnboarding ||
    isSettings ||
    isAnalytics ||
    isApplications ||
    isCrm ||
    isJobs;
  const isProtectedPath = isAppSurface || !isPublicPath;

  let accessToken = request.cookies.get("access_token")?.value;
  const refreshToken = request.cookies.get("refresh_token")?.value;

  let refreshedTokens: RefreshedTokens | null = null;
  let sessionExpired = false;

  if (
    isProtectedPath &&
    refreshToken &&
    accessTokenNeedsRefresh(accessToken) &&
    shouldAttemptRefresh(request)
  ) {
    const outcome = await refreshSession(refreshToken);
    if (outcome.status === "success") {
      refreshedTokens = outcome.tokens;
      accessToken = outcome.tokens.accessToken;
      request.cookies.set("access_token", outcome.tokens.accessToken);
      request.cookies.set("refresh_token", outcome.tokens.refreshToken);
    } else if (outcome.status === "unauthorized") {
      sessionExpired = true;
    }
  }

  const finalize = (response: NextResponse) => {
    if (refreshedTokens) {
      response.cookies.set("access_token", refreshedTokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: accessTokenMaxAge(refreshedTokens.accessToken),
        path: "/",
      });
      response.cookies.set("refresh_token", refreshedTokens.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: REFRESH_MAX_AGE_SECONDS,
        path: "/",
      });
    }
    if (sessionExpired) {
      for (const name of ["access_token", "refresh_token"]) {
        response.cookies.set(name, "", { maxAge: 0, path: "/" });
      }
    }
    return response;
  };

  const next = () =>
    NextResponse.next(
      refreshedTokens
        ? { request: { headers: new Headers(request.headers) } }
        : undefined,
    );

  if (sessionExpired) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("reason", "session_expired");
    if (pathname !== "/") loginUrl.searchParams.set("from", pathname);
    return finalize(NextResponse.redirect(loginUrl));
  }

  if (isAppSurface && !accessToken) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return finalize(NextResponse.redirect(loginUrl));
  }

  // Authenticated but incomplete onboarding cannot use app surfaces
  if (
    (isDashboard ||
      isSettings ||
      isAnalytics ||
      isApplications ||
      isCrm ||
      isJobs) &&
    accessToken &&
    !onboardingDone
  ) {
    return finalize(NextResponse.redirect(new URL("/onboarding", request.url)));
  }

  // Finished users hitting onboarding go to dashboard
  if (isOnboarding && accessToken && onboardingDone) {
    return finalize(NextResponse.redirect(new URL("/dashboard", request.url)));
  }

  if (isAuthPath && accessToken) {
    return finalize(
      NextResponse.redirect(
        new URL(onboardingDone ? "/dashboard" : "/onboarding", request.url),
      ),
    );
  }

  if (!isPublicPath && !isDashboard && !isOnboarding && !isSettings && !accessToken) {
    return finalize(NextResponse.redirect(new URL("/login", request.url)));
  }

  return finalize(next());
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
