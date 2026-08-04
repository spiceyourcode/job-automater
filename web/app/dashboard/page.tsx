import { Inbox, Plus, Radio } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/empty-state";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <span className="text-sm font-semibold tracking-tight">
            JobAutomater
          </span>
          <nav className="flex items-center gap-2" aria-label="Account">
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/settings/sources">Sources</a>
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

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-6 space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Matches and applications will show up here after your first source
            run.
          </p>
        </div>

        <Separator className="mb-2" />

        <section aria-labelledby="jobs-empty-heading">
          <h2 id="jobs-empty-heading" className="sr-only">
            Job matches
          </h2>
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title="No job matches yet"
            description="Connect a source to start collecting openings. We’ll score them against your profile and surface the best fits here."
            action={{
              label: "Add sources",
              href: "/settings/sources",
              icon: <Plus className="mr-2 h-4 w-4" aria-hidden />,
            }}
          />
        </section>

        <Separator className="my-4" />

        <section aria-labelledby="apps-empty-heading">
          <div className="flex items-center gap-2 px-4 pt-4 text-sm text-muted-foreground">
            <Radio className="h-4 w-4" aria-hidden />
            <h2 id="apps-empty-heading" className="font-medium text-foreground">
              Applications
            </h2>
          </div>
          <EmptyState
            icon={<Inbox className="h-8 w-8" aria-hidden />}
            title="No applications yet"
            description="Your pipeline is empty. Once matches arrive, generate documents and move roles into review."
          />
        </section>
      </main>
    </div>
  );
}
