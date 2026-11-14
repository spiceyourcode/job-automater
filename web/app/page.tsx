import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { landingFaqSchema } from "@/components/marketing/landing-faq-data";

export const metadata: Metadata = {
  title: "JobAutomater — Approval-first job search automation",
  description:
    "Collect roles, score fit against your CV, and draft grounded applications. Nothing submits until you approve. Start free.",
  openGraph: {
    title: "JobAutomater — Your job search, orchestrated",
    description:
      "Curated sources, explainable match scores, and human approval on every application.",
    type: "website",
  },
};

export default async function HomePage() {
  const jar = await cookies();
  const token = jar.get("access_token")?.value;
  if (token) {
    const onboarded = jar.get("onboarding_complete")?.value === "1";
    redirect(onboarded ? "/dashboard" : "/onboarding");
  }

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(landingFaqSchema) }}
      />
      <LandingPage />
    </>
  );
}
