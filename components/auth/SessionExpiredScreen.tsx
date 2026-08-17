"use client";

import Link from "next/link";
import { Clock, LogIn, Home } from "lucide-react";

export default function SessionExpiredScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-[440px] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mx-auto mb-5">
          <Clock size={32} className="text-[#F59E0B]" />
        </div>

        <h1 className="text-[20px] font-bold text-[#0F172A] mb-2">Session Expired</h1>
        <p className="text-[14px] text-[#64748B] leading-relaxed mb-8">
          Your session has expired. Sign in again to continue.
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-bold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            <LogIn size={16} />
            Sign In Again
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
          >
            <Home size={16} />
            Return to Public Home
          </Link>
        </div>
      </div>
    </div>
  );
}