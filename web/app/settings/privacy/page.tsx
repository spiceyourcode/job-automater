import { Separator } from "@/components/ui/separator";
import { PrivacyControls } from "@/components/privacy-controls";

export default function PrivacySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Privacy</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        GDPR export and account deletion. Exports never include secrets or
        passwords.
      </p>
      <Separator className="my-6" />
      <PrivacyControls />
    </div>
  );
}
