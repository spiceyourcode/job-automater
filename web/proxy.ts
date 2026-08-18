import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/oauth",
  "/",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token");
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

  if (isAppSurface && !token) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Authenticated but incomplete onboarding cannot use app surfaces
  if (
    (isDashboard ||
      isSettings ||
      isAnalytics ||
      isApplications ||
      isCrm ||
      isJobs) &&
    token &&
    !onboardingDone
  ) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  // Finished users hitting onboarding go to dashboard
  if (isOnboarding && token && onboardingDone) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isAuthPath && token) {
    return NextResponse.redirect(
      new URL(onboardingDone ? "/dashboard" : "/onboarding", request.url),
    );
  }

  if (!isPublicPath && !isDashboard && !isOnboarding && !isSettings && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
