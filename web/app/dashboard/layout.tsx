import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET ?? ""
);

export default async function DashboardLayout({
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
    // Expired, forged, or otherwise invalid — clear cookie and redirect
    cookieStore.delete("access_token");
    redirect("/login");
  }

  return <>{children}</>;
}
