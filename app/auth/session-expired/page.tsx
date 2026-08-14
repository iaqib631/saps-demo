// Relocated from /uld-message-builder/session-expired. AuthGuard redirects here from every
// route in the app on authState "session_expired", so the path must be portal-neutral.
// The screen itself is unchanged: SessionExpiredScreen stays in components/auth/ and keeps
// its content. Note this is the client-side courtesy notice only — proxy.ts already handles
// real cookie expiry server-side by bouncing to /login with a ?from= return path.
import SessionExpiredScreen from "@/components/auth/SessionExpiredScreen";

export default function SessionExpiredPage() {
  return <SessionExpiredScreen />;
}
