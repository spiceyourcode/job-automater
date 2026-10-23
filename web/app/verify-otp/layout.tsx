import type { ReactNode } from "react";

export default function VerifyOtpLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center p-4">
      {children}
    </div>
  );
}
