import { Briefcase } from "lucide-react";
import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

export default function DashboardPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
          <span className="font-semibold text-sm tracking-tight">
            JobAutomater
          </span>
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
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-16">
        <div className="flex flex-col items-center gap-6 text-center">
          <div className="rounded-full border p-4 text-muted-foreground">
            <Briefcase className="h-8 w-8" aria-hidden />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              Your dashboard is ready
            </h1>
            <p className="text-muted-foreground max-w-sm text-sm">
              Applications, job matches and AI-generated documents will appear
              here once you set up your profile and connect your first source.
            </p>
          </div>
          <Separator className="max-w-xs" />
          <p className="text-xs text-muted-foreground">
            Phase 1 scaffold — more features coming in Phase 2
          </p>
        </div>
      </main>
    </div>
  );
}
