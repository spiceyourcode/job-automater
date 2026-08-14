import { NotificationPreferencesForm } from "@/components/notification-preferences-form";

export default function NotificationSettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Notifications</h1>
        <p className="text-sm text-muted-foreground">
          Choose in-app, email, and optional Slack/Telegram webhooks. Webhook
          URLs are stored on the server and never shown again.
        </p>
      </div>
      <NotificationPreferencesForm />
    </div>
  );
}
