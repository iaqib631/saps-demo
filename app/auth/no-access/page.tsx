// Relocated from /uld-message-builder/no-access. This was never a ULD screen — AuthGuard
// sends EVERY route in the app here when authState is "guest", so it belongs under a
// portal-neutral /auth/* prefix rather than inside one module's namespace.
// The screen itself is unchanged: NoAccessScreen stays in components/auth/ and keeps its content.
import NoAccessScreen from "@/components/auth/NoAccessScreen";

export default function NoAccessPage() {
  return <NoAccessScreen />;
}
