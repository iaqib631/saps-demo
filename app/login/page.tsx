"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Sign-in — the single public entry point.
 *
 * The retired ULD auth routes (/uld-message-builder/sign-in and
 * /uld-message-builder/forgot-password) were a client-side mock sitting on top
 * of the real gate that proxy.ts enforces on every request, so folding them in
 * here keeps the affordances and drops the second, fake authentication. What
 * survives from them is everything a signed-out visitor can actually DO:
 * remember an identifier, recover a password, and ask for an account.
 *
 * The provisioning FORM deliberately does not live here. A request that names a
 * station, an organisation and a requested role is an administrator's record,
 * so it sits on /admin/users next to the queue that approves it; this page only
 * has to make the path findable, which is the one thing it previously lacked.
 */

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Remember Me persists the USERNAME, not the session.
 *
 * The gate issues a fixed 12-hour cookie (app/api/gate/login/route.ts) and
 * ignores anything else in the request body, so a checkbox here cannot extend a
 * session without changing the server — and quietly lengthening a session is
 * not something a checkbox should do anyway. Persisting the identifier is the
 * half of the promise the client can honestly keep. Clearing the box wipes the
 * stored value, so a shared counter terminal is reset from the same control
 * that set it.
 */
const REMEMBERED_USERNAME_KEY = "airvault.login.rememberedUsername";

/** The right-hand pane is a single surface with four states, not four routes. */
type LoginView = "sign-in" | "forgot-password" | "reset-requested" | "request-access";

/**
 * Why a bounce to this page sometimes needs explaining.
 *
 * AuthGuard has a dedicated screen for the three states worth their own page
 * (/auth/no-access, /auth/session-expired, /auth/permission-denied) but none for
 * "locked" and "disabled" — those two shared the retired ULD sign-in screen, and
 * folding that screen in here left them with nowhere to say what happened. They
 * arrive as ?reason=, and without this map the redirect renders an ordinary
 * empty sign-in form: the user retypes a correct password and is refused again
 * with no idea why. The two are deliberately worded differently because the
 * remedies differ — a lockout clears itself, a disabled account does not.
 */
const SIGN_IN_REASONS: Record<string, string> = {
  locked:
    "This account is temporarily locked after repeated failed sign-ins. It unlocks on its own, or an administrator can clear it now.",
  disabled:
    "This account has been disabled. Signing in will not work until an administrator re-enables it.",
};

export default function LoginPage() {
  const router = useRouter();
  const [view, setView] = useState<LoginView>("sign-in");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [resetEmail, setResetEmail] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [reasonNotice, setReasonNotice] = useState("");

  useEffect(() => {
    // Read in an effect for the same hydration reason as the remembered username
    // below: the query string is not available to the server render.
    const params = new URLSearchParams(window.location.search);
    const reason = params.get("reason");
    if (reason && reason in SIGN_IN_REASONS) {
      setReasonNotice(SIGN_IN_REASONS[reason]);
    }
    // The four panes are states rather than routes, but /auth/no-access needs to
    // link a guest straight at the access-request pane — its whole point is that a
    // visitor with no account has somewhere to go. Only that one pane is
    // addressable; sign-in is the default and the two reset panes are outcomes of
    // submitting a form, so deep-linking them would show a result nobody asked for.
    if (params.get("view") === "request-access") {
      setView("request-access");
    }
  }, []);

  useEffect(() => {
    // Reading storage in an effect rather than in useState's initialiser keeps
    // the first client render identical to the server render — otherwise a
    // remembered username hydration-mismatches an empty server-rendered field.
    try {
      const remembered = window.localStorage.getItem(REMEMBERED_USERNAME_KEY);
      if (remembered) {
        setUsername(remembered);
        setRememberMe(true);
      }
    } catch {
      // Private-mode browsers throw on localStorage access. Losing a remembered
      // username is not worth blocking sign-in over.
    }
  }, []);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!username || !password) {
      setError("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/gate/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        try {
          if (rememberMe) {
            window.localStorage.setItem(REMEMBERED_USERNAME_KEY, username);
          } else {
            window.localStorage.removeItem(REMEMBERED_USERNAME_KEY);
          }
        } catch {
          // See above — storage failures must not swallow a successful sign-in.
        }
        const params = new URLSearchParams(window.location.search);
        const from = params.get("from") || "/";
        router.replace(from);
        router.refresh();
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || "Invalid username or password.");
      setLoading(false);
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  };

  const handleResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError("");
    if (!resetEmail.trim() || !EMAIL_PATTERN.test(resetEmail)) {
      setResetError("Please enter a valid email address.");
      return;
    }
    setResetSubmitting(true);
    // Mock-data prototype: nothing is dispatched. The delay exists so the
    // confirmation does not appear instantly, which would read as "the form
    // did not submit" rather than "the request went out".
    await new Promise((r) => setTimeout(r, 900));
    setResetSubmitting(false);
    setView("reset-requested");
  };

  const goToSignIn = () => {
    setView("sign-in");
    setResetError("");
  };

  return (
    <div
      className="fixed inset-0 flex overflow-hidden"
      style={{ backgroundColor: "#FAFBFD" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-60 -left-40 w-[700px] h-[700px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #C5F0E8 0%, transparent 70%)" }}
        />
        <div
          className="absolute -bottom-60 -right-40 w-[700px] h-[700px] rounded-full opacity-15"
          style={{ background: "radial-gradient(circle, #D8E8F8 0%, transparent 70%)" }}
        />
      </div>

      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ opacity: 0.04 }}
      >
        <svg width="100%" height="100%">
          <defs>
            <pattern
              id="signinGrid"
              width="50"
              height="50"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="25" cy="25" r="1" fill="#4A90C4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#signinGrid)" />
        </svg>
      </div>

      <div className="relative z-10 flex w-full">
        <div className="hidden lg:flex lg:w-[55%] xl:w-[58%] relative overflow-hidden">
          <div className="absolute inset-0">
            <img
              src="/login-bg.jpg"
              alt="Air Cargo Terminal"
              className="w-full h-full object-cover object-center"
            />
          </div>

          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(11,37,69,0.88) 0%, rgba(11,37,69,0.72) 40%, rgba(11,37,69,0.55) 100%)",
            }}
          />

          <div className="absolute inset-0 flex flex-col justify-end p-16">
            <div className="max-w-[480px]">
              <div className="mb-8">
                <div className="w-12 h-[3px] rounded-full mb-6" style={{ backgroundColor: "#7EC8E3" }} />
                <h2 className="text-[36px] font-extrabold text-white leading-[1.15] mb-4">
                  Command Your
                  <br />
                  Cargo Terminal
                </h2>
                <p className="text-[15px] leading-relaxed" style={{ color: "rgba(255,255,255,0.7)" }}>
                  From warehouse operations to gate management, ULD tracking to customs compliance — AirVault gives you complete visibility and control over every movement in your air cargo ecosystem.
                </p>
              </div>

              <div className="flex items-center gap-8">
                {[
                  { value: "50M+", label: "AWBs Processed" },
                  { value: "99.9%", label: "Platform Uptime" },
                  { value: "24/7", label: "Live Operations" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-1">
                    <span className="text-[22px] font-extrabold text-white">{stat.value}</span>
                    <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: "rgba(255,255,255,0.5)" }}>
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="absolute top-10 left-10">
            <img
              src="/airvault-logo.png"
              alt="AirVault"
              className="h-8 w-auto brightness-[100]"
            />
          </div>
        </div>

        {/*
          items-start + my-auto rather than items-center, because the shell is
          fixed inset-0 and the request-access view is the tallest of the four.
          A centred flex child that outgrows its scroll container has its top
          edge clipped and unreachable; auto margins centre it while it fits and
          collapse to zero when it does not, so the whole panel stays scrollable.
        */}
        <div className="flex-1 flex items-start justify-center px-6 lg:px-12 xl:px-20 overflow-y-auto py-10">
          <div className="w-full max-w-[420px] my-auto">
            <div className="lg:hidden flex items-center justify-center mb-10">
              <img
                src="/airvault-logo.png"
                alt="AirVault"
                className="h-9 w-auto"
              />
            </div>

            {view === "sign-in" && (
              <>
                <div className="mb-8">
                  <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "#0B2545" }}>
                    Welcome back
                  </h1>
                  <p className="text-[14px] mt-2" style={{ color: "#64748B" }}>
                    Sign in to your AirVault workspace
                  </p>
                </div>

                {/*
                  * Sits above the form, not inside it, because it explains why the
                  * visitor is here rather than what they just got wrong — and it must
                  * survive a failed submit that sets `error` underneath it.
                  */}
                {reasonNotice && (
                  <div
                    className="flex items-start gap-2.5 px-4 py-3 mb-5 rounded-lg text-[13px] font-medium"
                    style={{ backgroundColor: "rgba(217,119,6,0.08)", color: "#B45309" }}
                    role="status"
                  >
                    {reasonNotice}
                  </div>
                )}

                <form onSubmit={handleSignIn} className="flex flex-col gap-5" noValidate>
                  {error && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-[13px] font-medium"
                      style={{
                        backgroundColor: "rgba(220,38,38,0.06)",
                        color: "#DC2626",
                        border: "1px solid rgba(220,38,38,0.15)",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {error}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: "#334155" }}>
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        autoComplete="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="Enter your username"
                        className="w-full h-11 pl-10 pr-4 rounded-lg text-[14px] outline-none transition-all duration-200 border"
                        style={{
                          backgroundColor: "#F8FAFC",
                          borderColor: "#E2E8F0",
                          color: "#0F172A",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#7EC8E3";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(126,200,227,0.15)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E2E8F0";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: "#334155" }}>
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full h-11 pl-10 pr-10 rounded-lg text-[14px] outline-none transition-all duration-200 border"
                        style={{
                          backgroundColor: "#F8FAFC",
                          borderColor: "#E2E8F0",
                          color: "#0F172A",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#7EC8E3";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(126,200,227,0.15)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E2E8F0";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] cursor-pointer transition-colors"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                            <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                            <path d="m14.12 14.12a3 3 0 1 1-4.24-4.24" />
                            <line x1="1" y1="1" x2="23" y2="23" />
                          </svg>
                        ) : (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                            <circle cx="12" cy="12" r="3" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="w-4 h-4 rounded accent-[#5BA4C5] cursor-pointer"
                      />
                      <span className="text-[13px]" style={{ color: "#64748B" }}>
                        Remember Me
                      </span>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setResetEmail("");
                        setResetError("");
                        setView("forgot-password");
                      }}
                      className="text-[13px] font-semibold cursor-pointer hover:underline"
                      style={{ color: "#5BA4C5" }}
                    >
                      Forgot password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full rounded-lg text-[15px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)",
                      boxShadow: "0 4px 20px rgba(91,164,197,0.3)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow = "0 8px 28px rgba(91,164,197,0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 4px 20px rgba(91,164,197,0.3)";
                    }}
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg
                          className="animate-spin"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        >
                          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                        </svg>
                        Signing in...
                      </span>
                    ) : (
                      "Sign In"
                    )}
                  </button>
                </form>

                <p className="text-center text-[13px] mt-8" style={{ color: "#94A3B8" }}>
                  Need access?{" "}
                  <button
                    type="button"
                    onClick={() => setView("request-access")}
                    className="font-semibold cursor-pointer transition-colors hover:underline"
                    style={{ color: "#5BA4C5" }}
                  >
                    Request access
                  </button>
                </p>
              </>
            )}

            {view === "forgot-password" && (
              <>
                <div className="mb-8">
                  <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "#0B2545" }}>
                    Reset your password
                  </h1>
                  <p className="text-[14px] mt-2 leading-relaxed" style={{ color: "#64748B" }}>
                    Enter your registered email address and we will send you a link to reset your password.
                  </p>
                </div>

                <form onSubmit={handleResetRequest} className="flex flex-col gap-5" noValidate>
                  {resetError && (
                    <div
                      className="flex items-center gap-2.5 px-4 py-3 rounded-lg text-[13px] font-medium"
                      style={{
                        backgroundColor: "rgba(220,38,38,0.06)",
                        color: "#DC2626",
                        border: "1px solid rgba(220,38,38,0.15)",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                      </svg>
                      {resetError}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[13px] font-semibold" style={{ color: "#334155" }}>
                      Email Address
                    </label>
                    <div className="relative">
                      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8]">
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <rect x="2" y="4" width="20" height="16" rx="2" />
                          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                        </svg>
                      </div>
                      <input
                        type="email"
                        autoComplete="email"
                        value={resetEmail}
                        onChange={(e) => setResetEmail(e.target.value)}
                        placeholder="ahmed@shaheen-airport.com"
                        className="w-full h-11 pl-10 pr-4 rounded-lg text-[14px] outline-none transition-all duration-200 border"
                        style={{
                          backgroundColor: "#F8FAFC",
                          borderColor: "#E2E8F0",
                          color: "#0F172A",
                        }}
                        onFocus={(e) => {
                          e.currentTarget.style.borderColor = "#7EC8E3";
                          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(126,200,227,0.15)";
                        }}
                        onBlur={(e) => {
                          e.currentTarget.style.borderColor = "#E2E8F0";
                          e.currentTarget.style.boxShadow = "none";
                        }}
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetSubmitting}
                    className="h-12 w-full rounded-lg text-[15px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
                    style={{
                      background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)",
                      boxShadow: "0 4px 20px rgba(91,164,197,0.3)",
                    }}
                  >
                    {resetSubmitting ? "Sending..." : "Send Reset Link"}
                  </button>
                </form>

                <p className="text-center text-[13px] mt-8" style={{ color: "#94A3B8" }}>
                  Remembered it?{" "}
                  <button
                    type="button"
                    onClick={goToSignIn}
                    className="font-semibold cursor-pointer transition-colors hover:underline"
                    style={{ color: "#5BA4C5" }}
                  >
                    Back to sign in
                  </button>
                </p>
              </>
            )}

            {view === "reset-requested" && (
              <div className="text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-6"
                  style={{ backgroundColor: "rgba(22,163,74,0.10)" }}
                >
                  <svg
                    width="30"
                    height="30"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#16A34A"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                </div>
                <h1 className="text-[24px] font-extrabold tracking-tight mb-3" style={{ color: "#0B2545" }}>
                  Reset Link Sent
                </h1>
                {/*
                  Worded so it does not disclose whether the account exists. The
                  same sentence is returned for a registered address and an
                  unregistered one, which is what stops this form being used to
                  enumerate who holds an AirVault account.
                */}
                <p className="text-[14px] leading-relaxed mb-8" style={{ color: "#64748B" }}>
                  If an account exists for <strong style={{ color: "#334155" }}>{resetEmail}</strong>, you will
                  receive a password reset link shortly.
                </p>
                <button
                  type="button"
                  onClick={goToSignIn}
                  className="h-12 w-full rounded-lg text-[15px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap"
                  style={{
                    background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)",
                    boxShadow: "0 4px 20px rgba(91,164,197,0.3)",
                  }}
                >
                  Return to Sign In
                </button>
              </div>
            )}

            {view === "request-access" && (
              <>
                <div className="mb-6">
                  <h1 className="text-[28px] font-extrabold tracking-tight" style={{ color: "#0B2545" }}>
                    Request access
                  </h1>
                  <p className="text-[14px] mt-2 leading-relaxed" style={{ color: "#64748B" }}>
                    AirVault accounts are provisioned by a site administrator — there is no self-service sign-up.
                    Send your administrator the details below and they will raise the request on
                    Admin &rsaquo; Users, where it sits pending approval until it is granted.
                  </p>
                </div>

                {/*
                  A checklist, not a second copy of the form. The provisioning
                  form itself lives on /admin/users because the record it creates
                  is an administrator's; duplicating it on a public page would
                  reintroduce exactly the split this fold-in removed.
                */}
                <div
                  className="rounded-xl border p-5 mb-6"
                  style={{ backgroundColor: "#F8FAFC", borderColor: "#E2E8F0" }}
                >
                  <p className="text-[12px] font-bold uppercase tracking-wider mb-3" style={{ color: "#0B2545" }}>
                    What to send
                  </p>
                  <ul className="flex flex-col gap-2.5">
                    {[
                      "Full name and the username you want",
                      "Work email address and mobile number",
                      "Station (LHE, KHI, ISB, PEW, MUX or UET) and substation",
                      "Organization you work for",
                      "The role you are asking for — the four are listed on Roles & Permissions",
                    ].map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <svg
                          className="mt-0.5 flex-shrink-0"
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="#5BA4C5"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="text-[13px] leading-relaxed" style={{ color: "#475569" }}>
                          {item}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <p className="text-[13px] leading-relaxed mb-8" style={{ color: "#94A3B8" }}>
                  You will be notified by email once an administrator approves the request. Credentials are issued
                  after approval, never before — nobody chooses a password for an account that does not exist yet.
                </p>

                <button
                  type="button"
                  onClick={goToSignIn}
                  className="h-12 w-full rounded-lg text-[15px] font-semibold cursor-pointer transition-all duration-300 whitespace-nowrap border"
                  style={{ backgroundColor: "white", borderColor: "#E2E8F0", color: "#334155" }}
                >
                  Back to sign in
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
