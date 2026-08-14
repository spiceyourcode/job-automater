import { cookies } from "next/headers";
import { type NextRequest } from "next/server";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

/** Proxies owner-scoped analytics export; auth cookie stays httpOnly (HG-1). */
export async function GET(req: NextRequest) {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) {
    return new Response("Unauthorized", { status: 401 });
  }

  const qs = req.nextUrl.searchParams.toString();
  const res = await fetch(
    `${API_URL}/api/v1/analytics/export${qs ? `?${qs}` : ""}`,
    {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    },
  );

  const headers = new Headers();
  const contentType = res.headers.get("content-type");
  const disposition = res.headers.get("content-disposition");
  if (contentType) headers.set("content-type", contentType);
  if (disposition) headers.set("content-disposition", disposition);

  return new Response(await res.arrayBuffer(), {
    status: res.status,
    headers,
  });
}
