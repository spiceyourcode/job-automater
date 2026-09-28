import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { DeleteAuthCookieAndRedirect } from "@/components/delete-auth-cookie";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export default async function JobsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");

  if (!token?.value) {
    redirect("/login");
  }

  try {
    await jwtVerify(token.value, JWT_SECRET);
  } catch {
    // Token is invalid - render client component to delete cookie and redirect
    return <DeleteAuthCookieAndRedirect />;
  }

  if (cookieStore.get("onboarding_complete")?.value !== "1") {
    redirect("/onboarding");
  }

  return <AppShell title="Jobs">{children}</AppShell>;
}
