"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";

export default function LandingNav() {
  const router = useRouter();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        backgroundColor: scrolled ? "rgba(250,251,253,0.85)" : "transparent",
        backdropFilter: scrolled ? "blur(16px)" : "none",
        borderBottom: scrolled ? "1px solid rgba(180,210,240,0.3)" : "1px solid transparent",
      }}
    >
      <div className="max-w-[1280px] mx-auto px-6 lg:px-10 h-[64px] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <img 
            src="/airvault-logo.png"
            alt="AirVault"
            className="h-8 w-auto"
          />
        </div>

        <div className="hidden md:flex items-center gap-8">
          <button onClick={() => scrollTo("solution")} className="text-[13px] font-medium cursor-pointer transition-colors" style={{ color: "#475569" }} onMouseEnter={(e) => e.currentTarget.style.color = "#0B2545"} onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>
            Solution
          </button>
          <button onClick={() => scrollTo("capabilities")} className="text-[13px] font-medium cursor-pointer transition-colors" style={{ color: "#475569" }} onMouseEnter={(e) => e.currentTarget.style.color = "#0B2545"} onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>
            Capabilities
          </button>
          <button onClick={() => scrollTo("flow")} className="text-[13px] font-medium cursor-pointer transition-colors" style={{ color: "#475569" }} onMouseEnter={(e) => e.currentTarget.style.color = "#0B2545"} onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>
            Flow
          </button>
          <button onClick={() => scrollTo("value")} className="text-[13px] font-medium cursor-pointer transition-colors" style={{ color: "#475569" }} onMouseEnter={(e) => e.currentTarget.style.color = "#0B2545"} onMouseLeave={(e) => e.currentTarget.style.color = "#475569"}>
            Value
          </button>
        </div>

        <button
          onClick={() => router.push("/login")}
          className="h-9 px-6 rounded-full text-[13px] font-semibold text-white cursor-pointer transition-all duration-300 whitespace-nowrap hover:shadow-lg hover:scale-[1.03] active:scale-[0.97]"
          style={{ background: "linear-gradient(135deg, #7EC8E3, #5BA4C5)" }}
        >
          Login
        </button>
      </div>
    </nav>
  );
}