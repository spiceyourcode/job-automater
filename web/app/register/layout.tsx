import { AuthShell } from "@/components/auth-shell";

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
