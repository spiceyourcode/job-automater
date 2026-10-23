import type { Metadata } from "next";
import { Suspense } from "react";
import VerifyOtpClient from "./client";

export const metadata: Metadata = {
  title: "Verify your code | JobAutomater",
  description: "Enter the 6-digit verification code sent to your email.",
};

export default function VerifyOtpPage() {
  return (
    <Suspense>
      <VerifyOtpClient />
    </Suspense>
  );
}
