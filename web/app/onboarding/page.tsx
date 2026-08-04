import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { jwtVerify } from "jose";
import { OnboardingWizard } from "@/components/onboarding-wizard";

const JWT_SECRET = new TextEncoder().encode(process.env.JWT_SECRET ?? "");

export default async function OnboardingPage() {
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

  if (cookieStore.get("onboarding_complete")?.value === "1") {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background px-4 py-10">
      <div className="mb-8 text-center space-y-1">
        <p className="text-sm font-semibold tracking-tight">JobAutomater</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          Set up your profile
        </h1>
        <p className="text-sm text-muted-foreground max-w-md">
          A few steps so we can match roles and tailor applications — required
          fields cannot be skipped.
        </p>
      </div>
      <OnboardingWizard />
    </div>
  );
}
