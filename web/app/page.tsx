import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingPage } from "@/components/landing-page";

export default async function HomePage() {
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (token) {
    const onboarded = jar.get("onboarding_complete")?.value === "1";
    redirect(onboarded ? "/dashboard" : "/onboarding");
  }
  return <LandingPage />;
}
