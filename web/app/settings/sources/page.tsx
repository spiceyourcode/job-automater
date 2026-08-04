import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import Link from "next/link";
import { ArrowLeft, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/empty-state";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export default async function SourcesSettingsPage() {
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token");

  if (!token?.value) {
    redirect("/login");
  }
  try {
    await jwtVerify(token.value, JWT_SECRET);
  } catch {
    cookieStore.delete("access_token");
    redirect("/login");
  }
  if (cookieStore.get("onboarding_complete")?.value !== "1") {
    redirect("/onboarding");
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
          <Button asChild variant="ghost" size="sm" className="cursor-pointer">
            <Link href="/dashboard">
              <ArrowLeft className="mr-1 h-4 w-4" aria-hidden />
              Dashboard
            </Link>
          </Button>
          <span className="text-sm font-semibold tracking-tight">Sources</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Job sources
          </h1>
          <p className="text-sm text-muted-foreground">
            RSS, email, and career-page collectors will live here (Phase 2).
          </p>
        </div>

        <EmptyState
          icon={<Radio className="h-8 w-8" aria-hidden />}
          title="No sources connected"
          description="You haven’t added a job source yet. Source CRUD and Run Now ship in Phase 2 — your onboarding picks are saved for when that lands."
          action={{
            label: "Back to dashboard",
            href: "/dashboard",
            icon: <ArrowLeft className="mr-2 h-4 w-4" aria-hidden />,
          }}
        />
      </main>
    </div>
  );
}
