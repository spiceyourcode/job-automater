import { NextResponse, type NextRequest } from "next/server";

const AUTH_COOKIES = ["access_token", "refresh_token", "onboarding_complete"];

/** Clears httpOnly auth cookies server-side, then sends the user to login. */
export async function GET(request: NextRequest) {
  const url = new URL("/login", request.url);
  url.searchParams.set("reason", "session_expired");

  const response = NextResponse.redirect(url);
  for (const name of AUTH_COOKIES) {
    response.cookies.set(name, "", { maxAge: 0, path: "/" });
  }
  return response;
}
