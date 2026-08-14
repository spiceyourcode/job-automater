"use client";

import { useEffect, useState, useTransition } from "react";
import {
  getNotificationPrefsAction,
  patchNotificationPrefsAction,
  type ChannelPref,
} from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";

const LABELS: Record<string, string> = {
  high_match: "High match jobs",
  interview_invitation: "Interview invitations",
  offer: "Offers",
  rejection: "Rejections",
  docs_ready: "Documents ready",
  application_confirmation: "Application confirmations",
};

export function NotificationPreferencesForm() {
  const [pending, startTransition] = useTransition();
  const [prefs, setPrefs] = useState<Record<string, ChannelPref>>({});
  const [slackConfigured, setSlackConfigured] = useState(false);
  const [telegramConfigured, setTelegramConfigured] = useState(false);
  const [slackUrl, setSlackUrl] = useState("");
  const [telegramUrl, setTelegramUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    void getNotificationPrefsAction().then((res) => {
      if (res.ok && res.data) {
        setPrefs(res.data.preferences);
        setSlackConfigured(res.data.slackConfigured);
        setTelegramConfigured(res.data.telegramConfigured);
      }
    });
  }, []);

  const toggle = (key: string, field: keyof ChannelPref) => {
    setPrefs((p) => ({
      ...p,
      [key]: { ...p[key]!, [field]: !p[key]![field] },
    }));
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const res = await patchNotificationPrefsAction({
            preferences: prefs,
            slackWebhookUrl: slackUrl.trim() ? slackUrl.trim() : undefined,
            telegramWebhookUrl: telegramUrl.trim()
              ? telegramUrl.trim()
              : undefined,
          });
          if (!res.ok) setError(res.error);
          else {
            setSaved(true);
            setSlackUrl("");
            setTelegramUrl("");
            if (slackUrl.trim()) setSlackConfigured(true);
            if (telegramUrl.trim()) setTelegramConfigured(true);
          }
        });
      }}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-muted-foreground">
              <th className="py-2 font-medium">Event</th>
              <th className="py-2 font-medium">In-app</th>
              <th className="py-2 font-medium">Email</th>
              <th className="py-2 font-medium">Slack</th>
              <th className="py-2 font-medium">Telegram</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(prefs).map(([key, value]) => (
              <tr key={key} className="border-t">
                <td className="py-2">{LABELS[key] ?? key}</td>
                {(["inApp", "email", "slack", "telegram"] as const).map(
                  (field) => (
                    <td key={field} className="py-2">
                      <input
                        type="checkbox"
                        className="cursor-pointer"
                        checked={value[field]}
                        onChange={() => toggle(key, field)}
                        aria-label={`${LABELS[key] ?? key} ${field}`}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="slack-url">
          Slack webhook URL {slackConfigured ? "(configured)" : ""}
        </label>
        <input
          id="slack-url"
          type="url"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="https://hooks.slack.com/services/…"
          value={slackUrl}
          onChange={(e) => setSlackUrl(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="tg-url">
          Telegram webhook URL {telegramConfigured ? "(configured)" : ""}
        </label>
        <input
          id="tg-url"
          type="url"
          className="h-9 w-full rounded-md border bg-background px-3 text-sm"
          placeholder="https://…"
          value={telegramUrl}
          onChange={(e) => setTelegramUrl(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {saved ? (
        <p className="text-sm text-muted-foreground">Preferences saved.</p>
      ) : null}
      <Button type="submit" className="cursor-pointer" disabled={pending}>
        Save preferences
      </Button>
    </form>
  );
}
