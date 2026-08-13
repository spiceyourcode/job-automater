import { ProfileSettingsEditor } from "@/components/profile-settings-editor";
import { fetchOwnProfile } from "@/lib/actions/profile";

export default async function ProfileSettingsPage() {
  const result = await fetchOwnProfile();

  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Profile</h1>
        <p className="text-sm text-muted-foreground">
          Edit skills and preferences. Salary is stored as integer cents.
        </p>
      </div>
      {!result.ok || !result.data ? (
        <p className="text-sm text-destructive" role="alert">
          {result.ok ? "Profile missing" : result.error}
        </p>
      ) : (
        <ProfileSettingsEditor profile={result.data} />
      )}
    </div>
  );
}
