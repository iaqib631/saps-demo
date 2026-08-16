"use client";

import { useRouter } from "next/navigation";

export default function HeroSection() {
  const router = useRouter();

  return (
    <section
      id="hero"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{ backgroundColor: "#FAFBFD" }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-[800px] h-[800px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #C5F0E8 0%, transparent 70%)" }} />
        <div className="absolute -bottom-60 -left-40 w-[700px] h-[700px] rounded-full opacity-20" style={{ background: "radial-gradient(circle, #D8E8F8 0%, transparent 70%)" }} />
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[600px] h-[600px] rounded-full opacity-10" style={{ background: "radial-gradient(circle, #E8E0F0 0%, transparent 70%)" }} />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.06 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="heroGrid" width="60" height="60" patternUnits="userSpaceOnUse">
              <circle cx="30" cy="30" r="1" fill="#4A90C4" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#heroGrid)" />
        </svg>
      </div>

      <div className="absolute top-[20%] right-[5%] w-px h-64 opacity-30" style={{ background: "linear-gradient(to bottom, transparent, #7EC8E3, transparent)" }} />
      <div className="absolute top-[25%] right-[8%] w-px h-48 opacity-20" style={{ background: "linear-gradient(to bottom, transparent, #A8D8EA, transparent)" }} />
      <div className="absolute bottom-[30%] left-[10%] w-px h-56 opacity-25" style={{ background: "linear-gradient(to bottom, transparent, #C5B8E0, transparent)" }} />

      <div className="relative z-10 w-full max-w-[1280px] mx-auto px-6 lg:px-10 pt-20 pb-16 flex flex-col lg:flex-row items-center gap-12 lg:gap-16">
        <div className="lg:w-[55%] flex flex-col gap-6">
          <div className="flex items-center gap-3 mb-1">
            <img 
              src="/airvault-logo.png"
              alt="AirVault"
              className="h-10 lg:h-12 w-auto"
            />
          </div>

          <h1 className="text-[40px] lg:text-[64px] font-extrabold leading-[1.08] tracking-tight" style={{ color: "#0B2545" }}>
            The Future of<br />
            <span style={{ background: "linear-gradient(135deg, #5BA4C5, #7B8FCE)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Smart Air Cargo
            </span>{" "}
            Operations
          </h1>

          <p className="text-[16px] lg:text-[18px] leading-relaxed max-w-[540px]" style={{ color: "#64748B" }}>
            AirVault unifies warehouse operations, cargo visibility, gate handling, ULD workflows, planning, compliance, and operational intelligence into one seamless platform — purpose-built for modern airport cargo terminals.
          </p>

          <div className="flex items-center gap-4 pt-2">
            <button
              onClick={() => router.push("/login")}
              className="h-12 px-8 rounded-full text-[15px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap hover:shadow-xl hover:scale-[1.04] active:scale-[0.97]"
              style={{ background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)", boxShadow: "0 8px 32px rgba(91,164,197,0.3)" }}
            >
              Login
            </button>
          </div>

          <div className="flex items-center gap-6 pt-6">
            {[
              { value: "99.9%", label: "Uptime" },
              { value: "50M+", label: "AWBs Processed" },
              { value: "24/7", label: "Live Operations" },
            ].map((stat) => (
              <div key={stat.label} className="flex flex-col gap-1">
                <span className="text-[22px] lg:text-[26px] font-extrabold" style={{ color: "#0B2545" }}>{stat.value}</span>
                <span className="text-[12px] font-medium uppercase tracking-wider" style={{ color: "#94A3B8" }}>{stat.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:w-[45%] relative flex items-center justify-center">
          <div className="absolute inset-0 rounded-[40px] opacity-40 blur-3xl" style={{ background: "radial-gradient(circle at center, #C5F0E8 0%, #D8E8F8 50%, transparent 100%)" }} />

          <div className="relative w-full max-w-[520px] aspect-[4/3] rounded-[28px] overflow-hidden shadow-2xl" style={{ border: "1px solid rgba(180,210,240,0.4)", background: "linear-gradient(145deg, #F0F5FA, #E8F0F8)" }}>
            <img
              src="/hero-infographic.jpg"
              alt="AirVault Platform"
              className="w-full h-full object-cover object-top"
            />

            <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(200,230,245,0.25) 0%, transparent 60%)" }} />

            <div className="absolute bottom-6 left-6 right-6 flex items-center gap-2">
              <div className="flex-1 h-10 rounded-xl flex items-center px-4 gap-2" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(180,210,240,0.4)" }}>
                <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: "#22C55E" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#0B2545" }}>Live Operations</span>
                <span className="text-[11px] ml-auto" style={{ color: "#64748B" }}>+47 AWB/hr</span>
              </div>
              <div className="h-10 w-10 rounded-xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.8)", backdropFilter: "blur(12px)", border: "1px solid rgba(180,210,240,0.4)" }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#5BA4C5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
              </div>
            </div>
          </div>

          <div className="absolute -right-2 top-10 w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg z-20" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", border: "1px solid rgba(180,210,240,0.4)" }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5BA4C5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>

          <div className="absolute -left-3 bottom-16 w-12 h-12 rounded-xl flex items-center justify-center shadow-lg z-20" style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(16px)", border: "1px solid rgba(200,180,230,0.4)" }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#8B7EC8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
            </svg>
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-10 animate-bounce">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19" /><polyline points="19 12 12 19 5 12" />
        </svg>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none" style={{ background: "linear-gradient(to top, #FAFBFD, transparent)" }} />
    </section>
  );
}