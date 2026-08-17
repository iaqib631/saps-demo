"use client";

import { useRouter } from "next/navigation";

export default function FinalCTA() {
  const router = useRouter();

  return (
    <section className="relative py-32 lg:py-40 overflow-hidden" style={{ backgroundColor: "#FFFFFF" }}>
      <div className="absolute top-0 left-0 right-0 h-32 pointer-events-none" style={{ background: "linear-gradient(to bottom, #FAFBFD, transparent)" }} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-10 right-0 w-[500px] h-[500px] rounded-full opacity-15" style={{ background: "radial-gradient(circle, #C5F0E8 0%, transparent 70%)" }} />
        <div className="absolute bottom-0 left-10 w-[400px] h-[400px] rounded-full opacity-12" style={{ background: "radial-gradient(circle, #D8E8F8 0%, transparent 70%)" }} />
      </div>

      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ opacity: 0.04 }}>
        <svg width="100%" height="100%">
          <defs>
            <pattern id="ctaGrid" width="80" height="80" patternUnits="userSpaceOnUse">
              <path d="M 80 0 L 0 0 0 80" fill="none" stroke="#5BA4C5" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ctaGrid)" />
        </svg>
      </div>

      <div className="relative z-10 max-w-[800px] mx-auto px-6 lg:px-10 text-center flex flex-col items-center gap-8">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full mb-2" style={{ backgroundColor: "rgba(200,230,245,0.3)", border: "1px solid rgba(200,230,245,0.5)" }}>
          <span className="text-[12px] font-bold tracking-widest" style={{ color: "#5BA4C5" }}>GET STARTED</span>
        </div>

        <h2 className="text-[36px] lg:text-[52px] font-extrabold leading-tight tracking-tight" style={{ color: "#0B2545" }}>
          Ready to transform your<br />cargo operations?
        </h2>

        <p className="text-[16px] lg:text-[18px] leading-relaxed max-w-[520px]" style={{ color: "#64748B" }}>
          Access AirVault and experience a unified platform built for modern airport cargo terminals.
        </p>

        <button
          onClick={() => router.push("/login")}
          className="h-14 px-10 rounded-full text-[16px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap hover:shadow-2xl hover:scale-[1.05] active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)", boxShadow: "0 12px 40px rgba(91,164,197,0.35)" }}
        >
          Login
        </button>
      </div>

      <div className="absolute -bottom-1 left-0 right-0 pointer-events-none">
        <svg viewBox="0 0 1440 120" fill="none" preserveAspectRatio="none" className="w-full h-28">
          <path d="M0 0 C480 100 960 100 1440 0 L1440 120 L0 120 Z" fill="#F0F4FA" />
        </svg>
      </div>
    </section>
  );
}