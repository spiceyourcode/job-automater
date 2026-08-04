import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SourcesManager } from "@/components/sources-manager";
import { listSourcesAction } from "@/lib/actions/sources";

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

  const listed = await listSourcesAction();
  const sources = listed.ok && listed.data ? listed.data.sources : [];

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
            Add feeds and mailboxes, then use Run now to enqueue collection.
          </p>
        </div>

        {!listed.ok && (
          <p className="mb-4 text-sm text-destructive" role="alert">
            {listed.error}
          </p>
        )}

        <SourcesManager initialSources={sources} />
      </main>
    </div>
  );
}
