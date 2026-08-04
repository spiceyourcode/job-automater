import { logoutAction } from "@/lib/actions/auth";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { PrivacyControls } from "@/components/privacy-controls";

export default function PrivacySettingsPage() {
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
            <Button asChild variant="ghost" size="sm" className="cursor-pointer">
              <a href="/settings/team">Team</a>
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
        <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          GDPR export and account deletion. Exports never include secrets or
          passwords.
        </p>
        <Separator className="my-6" />
        <PrivacyControls />
      </main>
    </div>
  );
}
