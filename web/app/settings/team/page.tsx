import { cookies } from "next/headers";
import { logoutAction } from "@/lib/actions/auth";
import { listTeamMembersAction } from "@/lib/actions/team";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { TeamManager } from "@/components/team-manager";

const API_URL =
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

async function fetchMyRole(): Promise<string | null> {
  const token = (await cookies()).get("access_token")?.value;
  if (!token) return null;
  try {
    const res = await fetch(`${API_URL}/api/v1/team`, {
      headers: { authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { role?: string };
    return body.role ?? null;
  } catch {
    return null;
  }
}

export default async function TeamSettingsPage() {
  const [result, role] = await Promise.all([
    listTeamMembersAction(),
    fetchMyRole(),
  ]);
  const members = result.ok ? (result.data?.members ?? []) : [];
  const canManage = role === "owner";

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            JobAutomater
          </span>
          <nav className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/dashboard">Dashboard</a>
            </Button>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="sm"
                className="cursor-pointer"
              >
                Sign out
              </Button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-2xl font-semibold tracking-tight">Team</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Owner / Member / Viewer roles. Sources are shared; applications stay
          private to each member.
        </p>
        <Separator className="my-6" />
        {!result.ok ? (
          <p className="text-sm text-destructive">{result.error}</p>
        ) : (
          <TeamManager initialMembers={members} canManage={canManage} />
        )}
      </main>
    </div>
  );
}
