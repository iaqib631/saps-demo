"use client";

import Link from "next/link";
import { ShieldOff, LogIn, UserPlus, Home, Headphones } from "lucide-react";

export default function NoAccessScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-[440px] bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-8 text-center">
        <div className="w-16 h-16 rounded-full bg-[#F59E0B]/10 flex items-center justify-center mx-auto mb-5">
          <ShieldOff size={32} className="text-[#F59E0B]" />
        </div>

        <h1 className="text-[20px] font-bold text-[#0F172A] mb-2">No Access</h1>
        <p className="text-[14px] text-[#64748B] leading-relaxed mb-8">
          You must be logged in to use this functionality.
        </p>

        <div className="flex flex-col gap-2.5">
          <Link
            href="/login"
            className="flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-bold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            <LogIn size={16} />
            Sign In
          </Link>
          <Link
            href="/login?view=request-access"
            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
          >
            <UserPlus size={16} />
            Request Access
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 h-10 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
          >
            <Home size={16} />
            Return to Home
          </Link>
        </div>

        <div className="mt-6 pt-5 border-t border-[#F1F5F9]">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B4F8B] hover:text-[#0B2545] cursor-pointer transition-colors"
          >
            <Headphones size={14} />
            Contact Support
          </Link>
        </div>
      </div>
    </div>
  );
}