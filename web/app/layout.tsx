import type { Metadata } from "next";
import RootLayoutClient from "./root-layout-client";

export const metadata: Metadata = {
  title: "JobAutomater",
  description: "AI-powered job application automation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RootLayoutClient>{children}</RootLayoutClient>;
}