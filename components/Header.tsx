"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, ChevronDown, Search } from "lucide-react";
import { useAuth } from "./auth/AuthContext";
import SiteSwitcher from "./site/SiteSwitcher";

interface HeaderProps {
  portalName: string;
  onToggleDrawer: (content: string) => void;
  onOpenUserMenu: () => void;
  userMenuOpen: boolean;
  onToggleNotifications: () => void;
  notificationsOpen: boolean;
  onToggleMobileSidebar: () => void;
}

export default function Header({
  portalName,
  onToggleDrawer,
  onOpenUserMenu,
  userMenuOpen,
  onToggleNotifications,
  notificationsOpen,
  onToggleMobileSidebar,
}: HeaderProps) {
  const [searchFocused, setSearchFocused] = useState(false);
  const { user, logout } = useAuth();
  const router = useRouter();

  const initials = user
    ? user.fullName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "??";

  // Sign-out lands on /login, not on the old ULD sign-in screen. /login is the app's
  // only real gate — proxy.ts checks the saps_gate cookie server-side and bounces every
  // protected route there — so it is the one place a signed-out user can sign back in.
  // The ULD-namespaced sign-in screen is being folded into it.
  const handleSignOut = () => {
    logout();
    router.push("/login");
  };

  return (
    <header
      className="h-[64px] w-full flex items-center px-3 lg:px-6 flex-shrink-0 z-50"
      style={{ backgroundColor: "#0B2545" }}
    >
      <button
        onClick={onToggleMobileSidebar}
        className="lg:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/80 cursor-pointer transition-colors mr-2"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="4" x2="20" y1="12" y2="12" /><line x1="4" x2="20" y1="6" y2="6" /><line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      <div className="flex items-center gap-4 lg:gap-6 min-w-[180px] lg:min-w-[240px]">
        <div className="flex items-center gap-3">
          <img 
            src="/airvault-logo.png"
            alt="AirVault"
            className="h-6 w-auto brightness-[100]"
          />
          <span className="text-white/60 text-xs font-medium hidden sm:inline">
            {portalName}
          </span>
        </div>
      </div>

      <div className="flex-1 flex justify-center max-w-[640px] mx-auto px-2 lg:px-4">
        <div
          className="relative w-full max-w-[520px]"
          onFocus={() => setSearchFocused(true)}
          onBlur={() => setSearchFocused(false)}
        >
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="Search AWB, HAWB, RFID, vehicle, invoice..."
            className="w-full h-9 rounded-lg text-sm text-white placeholder:text-white/50 pl-10 pr-4 transition-all duration-200 outline-none border"
            style={{
              backgroundColor: "#1B4F8B",
              borderColor: searchFocused ? "#2E75B6" : "transparent",
            }}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 lg:gap-3 ml-auto" data-dropdown>
        {/* P0-2 — site / HQ scope, present on every route */}
        <SiteSwitcher />

        <div className="relative" data-dropdown>
          <button
            onClick={onToggleNotifications}
            className="relative w-9 h-9 flex items-center justify-center text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
          >
            <Bell size={18} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#DC2626]" />
          </button>
          {notificationsOpen && (
            <div className="absolute top-full right-0 mt-2 w-[320px] lg:w-[360px] bg-white rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden z-50" data-dropdown>
              <div className="px-4 py-3 border-b border-[#E2E8F0] flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#0F172A]">
                  Notifications
                </span>
                <span className="text-[11px] text-[#64748B] font-medium">
                  3 new
                </span>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="px-4 py-3 hover:bg-[#F8FAFC] border-b border-[#E2E8F0] last:border-0 cursor-pointer"
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-2 h-2 rounded-full bg-[#2E75B6] mt-1.5 flex-shrink-0" />
                      <div>
                        <p className="text-[13px] font-medium text-[#0F172A]">
                          AWB 117-23456789
                        </p>
                        <p className="text-[12px] text-[#64748B] mt-0.5">
                          RFID mismatch detected at Gate 3
                        </p>
                        <p className="text-[11px] text-[#94A3B8] mt-1">
                          2 min ago
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-2.5 border-t border-[#E2E8F0] text-center cursor-pointer hover:bg-[#F8FAFC] transition-colors">
                <span className="text-[12px] font-semibold text-[#1B4F8B]">
                  View all notifications
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="relative" data-dropdown>
          <button
            onClick={onOpenUserMenu}
            className="flex items-center gap-2.5 pl-2 pr-1 py-1.5 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          >
            <div className="w-8 h-8 rounded-full bg-[#1B4F8B] flex items-center justify-center text-white text-[13px] font-bold">
              {initials}
            </div>
            <div className="text-left hidden md:block">
              <p className="text-[13px] font-medium text-white leading-tight">
                {user?.fullName || "Ahmed Shaikh"}
              </p>
              <p className="text-[11px] text-white/60 leading-tight">
                {user?.role || "Warehouse Manager"}
              </p>
            </div>
            <ChevronDown
              size={14}
              className="text-white/60 hidden md:block"
            />
          </button>
          {userMenuOpen && (
            <div className="absolute top-full right-0 mt-2 w-[200px] bg-white rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden z-50" data-dropdown>
              <div className="px-4 py-3 border-b border-[#E2E8F0]">
                <p className="text-[13px] font-bold text-[#0F172A]">
                  {user?.fullName || "Ahmed Shaikh"}
                </p>
                <p className="text-[12px] text-[#64748B]">
                  {user?.email || "ahmed@shaheen-airport.com"}
                </p>
              </div>
              <div className="py-1">
                <button className="w-full text-left px-4 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                  Profile
                </button>
                <button className="w-full text-left px-4 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                  Settings
                </button>
                <button className="w-full text-left px-4 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors">
                  Help Center
                </button>
                <div className="border-t border-[#E2E8F0] mt-1 pt-1">
                  <button
                    onClick={handleSignOut}
                    className="w-full text-left px-4 py-2 text-[13px] text-[#DC2626] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
                  >
                    Sign out
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}