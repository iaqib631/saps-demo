"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "./AuthContext";

/**
 * Client-side auth affordance — NOT the security boundary.
 *
 * The real gate is proxy.ts, which runs server-side on every request, checks the
 * saps_gate cookie before any page is rendered, and redirects to /login with a
 * ?from= return path. Nothing protected reaches the browser without that cookie.
 * This component sits on top of it and does a different job: it turns the four
 * mock authState values into the explanatory screens a user should see (you are
 * not signed in / your session timed out / your role lacks this permission),
 * which a bare bounce to /login cannot express.
 *
 * Because every one of these targets is reachable from every route in the app,
 * they must be portal-neutral paths. They used to live under /uld-message-builder/*,
 * which made the whole app depend on one module's namespace; they now live under
 * /auth/*. Any path this guard redirects TO must also be listed in PUBLIC_AUTH_PATHS
 * below, or the redirect lands on a route the guard immediately redirects away
 * from again — an infinite loop.
 */
const PUBLIC_AUTH_PATHS = [
  // The real gate, and the landing point for states that have no dedicated screen.
  "/login",

  // Relocated auth screens. These are the redirect targets below.
  "/auth/no-access",
  "/auth/session-expired",
  "/auth/permission-denied",
];

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authState } = useAuth();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const isPublicAuthPath = PUBLIC_AUTH_PATHS.includes(pathname);
    const isHomePath = pathname === "/";

    if (isPublicAuthPath || isHomePath) {
      setChecking(false);
      return;
    }

    if (authState === "guest") {
      router.replace("/auth/no-access");
    } else if (authState === "session_expired") {
      router.replace("/auth/session-expired");
    } else if (authState === "permission_denied") {
      router.replace("/auth/permission-denied");
    } else if (authState === "locked") {
      // Locked and disabled have no dedicated screen of their own — the sign-in
      // screen they used to share folded into /login. The reason rides in the
      // query string so the distinction is not lost at the redirect, and /login
      // reads it (SIGN_IN_REASONS there) and explains each state differently.
      router.replace("/login?reason=locked");
    } else if (authState === "disabled") {
      router.replace("/login?reason=disabled");
    }

    setChecking(false);
  }, [authState, pathname, router]);

  if (checking) return null;

  return <>{children}</>;
}
