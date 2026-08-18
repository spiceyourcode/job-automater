import { AuthShell } from "@/components/auth-shell";

export default function AuthSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
