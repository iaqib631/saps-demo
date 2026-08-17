"use client";

// Relocated from /uld-message-builder/permission-denied. This is the app's only RBAC-refusal
// surface — AuthGuard sends every route here on authState "permission_denied" — so it cannot
// live inside the ULD module's namespace.
// The screen itself is unchanged: PermissionDeniedScreen stays in components/auth/ and keeps
// its content.
//
// The local AuthProvider is deliberate and carried over from the old route. PermissionDeniedScreen
// calls useAuth() to name the current user and role, and this page has to work whether or not the
// shell wraps it: LayoutClient supplies an AuthProvider on shelled routes, but auth screens have
// historically been listed in NO_APP_SHELL_PATHS and rendered bare. Nesting a provider is harmless;
// missing one throws. Keeping it here means the screen renders correctly under both arrangements.
import { AuthProvider } from "@/components/auth/AuthContext";
import PermissionDeniedScreen from "@/components/auth/PermissionDeniedScreen";

export default function PermissionDeniedPage() {
  return (
    <AuthProvider>
      <PermissionDeniedScreen />
    </AuthProvider>
  );
}
