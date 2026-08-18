import { AuthShell } from "@/components/auth-shell";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AuthShell>{children}</AuthShell>;
}
