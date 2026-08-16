"use client";

import { usePathname } from "next/navigation";
import AppShell from "@/components/AppShell";
import { AuthProvider } from "@/components/auth/AuthContext";
import AuthGuard from "@/components/auth/AuthGuard";
import { SiteProvider } from "@/components/site/SiteContext";

/**
 * Routes that render bare, with no sidebar and no header.
 *
 * The rule is not "public" but "has no workspace to frame": a visitor on any of
 * these is either not signed in or has just been told they cannot be, so a nav
 * rail full of modules they cannot open is noise at best and misleading at
 * worst. This list previously named six /uld-message-builder/* auth screens;
 * those folded into /login and /auth/*, and the entries moved with them.
 */
const NO_APP_SHELL_PATHS = [
  "/",
  "/login",
  "/auth/no-access",
  "/auth/session-expired",
  "/auth/permission-denied",
];

export default function LayoutClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const skipShell = NO_APP_SHELL_PATHS.includes(pathname);

  if (skipShell) {
    return <>{children}</>;
  }

  return (
    <AuthProvider>
      <AuthGuard>
        <SiteProvider>
          <AppShell>{children}</AppShell>
        </SiteProvider>
      </AuthGuard>
    </AuthProvider>
  );
}