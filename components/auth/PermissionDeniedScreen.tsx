"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, User, Shield, FileText, Key, Send, LayoutDashboard } from "lucide-react";
import { useAuth } from "./AuthContext";

export default function PermissionDeniedScreen() {
  const router = useRouter();
  const { user, requestAccess } = useAuth();

  const handleRequestAccess = () => {
    requestAccess();
    router.push("/login");
  };

  return (
    <div className="min-h-screen flex items-start justify-center px-4 pt-6" style={{ backgroundColor: "#F8FAFC" }}>
      <div className="w-full max-w-[880px]">
        <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm">
          <div className="p-8 border-b border-[#F1F5F9]">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
                <ShieldAlert size={24} className="text-[#DC2626]" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h1 className="text-[20px] font-bold text-[#0F172A]">Permission Denied</h1>
                </div>
                <p className="text-[14px] text-[#64748B] leading-relaxed">
                  You are signed in, but your role does not have permission to access this message builder.
                </p>
              </div>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="w-9 h-9 rounded-lg bg-[#EBF0F7] flex items-center justify-center flex-shrink-0">
                  <User size={16} className="text-[#0B2545]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Current User</p>
                  <p className="text-[14px] font-semibold text-[#0F172A]">{user?.fullName || "Unknown"}</p>
                  <p className="text-[12px] text-[#64748B]">{user?.username || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="w-9 h-9 rounded-lg bg-[#FEF3C7] flex items-center justify-center flex-shrink-0">
                  <Shield size={16} className="text-[#D97706]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Current Role</p>
                  <p className="text-[14px] font-semibold text-[#0F172A]">{user?.role || "—"}</p>
                  <p className="text-[12px] text-[#64748B]">{user?.organization || "—"}</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="w-9 h-9 rounded-lg bg-[#DCFCE7] flex items-center justify-center flex-shrink-0">
                  <FileText size={16} className="text-[#16A34A]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Requested Module</p>
                  <p className="text-[14px] font-semibold text-[#0F172A]">ULD Message Builder</p>
                  <p className="text-[12px] text-[#64748B]">UCM / SCM / LUC</p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <div className="w-9 h-9 rounded-lg bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
                  <Key size={16} className="text-[#DC2626]" />
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wide">Required Permission</p>
                  <p className="text-[14px] font-semibold text-[#0F172A]">Message Builder Access</p>
                  <p className="text-[12px] text-[#64748B]">Operations Administrator or above</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleRequestAccess}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl text-[14px] font-bold text-white cursor-pointer transition-colors hover:opacity-90 whitespace-nowrap"
                style={{ backgroundColor: "#0B2545" }}
              >
                <Send size={16} />
                Request Access
              </button>
              <button
                onClick={() => router.push("/")}
                className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl border border-[#E2E8F0] text-[14px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
              >
                <LayoutDashboard size={16} />
                Return to Dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}