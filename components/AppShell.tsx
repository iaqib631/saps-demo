"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { usePathname } from "next/navigation";
import Header from "./Header";
import Sidebar, { portalForPath } from "./Sidebar";
import RightDrawer from "./RightDrawer";
import ToastContainer from "./Toast";
import { ToastProvider } from "./ToastContext";

interface AppShellProps {
  children: React.ReactNode;
}

/**
 * Paths that must never be framed by the shell. LayoutClient already skips
 * AppShell entirely for these, so this list is the second line of the same
 * rule — it exists so the shell is still correct if it is ever mounted around
 * one of them directly. The six /uld-message-builder/* auth screens folded into
 * /login and /auth/*; these four are what is left of that set.
 */
const AUTH_PATHS = [
  "/login",
  "/auth/no-access",
  "/auth/session-expired",
  "/auth/permission-denied",
];

export default function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();

  const isAuthPage = AUTH_PATHS.includes(pathname);

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarMobileOpen, setSidebarMobileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerContent, setDrawerContent] = useState("");
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  /**
   * The header names the portal you are standing in, and it now asks the sidebar
   * rather than keeping its own answer. The old hand-written route→portal map
   * had drifted well past the point of being useful: it covered the persona
   * routes but not a single /import/*, /customs/*, /storage/*, /export/* or
   * /billing/* route, so the busiest half of the product rendered "Home" in the
   * header. Deriving it from the rail means the two can no longer disagree, and
   * adding a route to the nav is now the only step needed to name it.
   *
   * The fallback is "Platform" rather than "Home" because an unclaimed path is,
   * by definition, not inside any portal — it is the shell.
   */
  const portalName = useMemo(
    // Only Home is portal-less now, so the fallback is the product rather than
    // a portal name — "Platform" was one of the fourteen and no longer exists.
    () => portalForPath(pathname)?.label ?? "AirVault",
    [pathname],
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-dropdown]")) {
        setUserMenuOpen(false);
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleToggleDrawer = useCallback((content: string) => {
    setDrawerContent(content);
    setDrawerOpen(true);
    setNotificationsOpen(false);
    setUserMenuOpen(false);
  }, []);

  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false);
  }, []);

  const handleOpenUserMenu = useCallback(() => {
    setUserMenuOpen((prev) => !prev);
    setNotificationsOpen(false);
  }, []);

  const handleToggleNotifications = useCallback(() => {
    setNotificationsOpen((prev) => !prev);
    setUserMenuOpen(false);
  }, []);

  if (isAuthPage) {
    return (
      <ToastProvider>
        <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
          {children}
          <ToastContainer />
        </div>
      </ToastProvider>
    );
  }

  return (
    <ToastProvider>
      <div className="h-screen flex flex-col overflow-hidden" style={{ backgroundColor: "#F8FAFC" }}>
        <Header
          portalName={portalName}
          onToggleDrawer={handleToggleDrawer}
          onOpenUserMenu={handleOpenUserMenu}
          userMenuOpen={userMenuOpen}
          onToggleNotifications={handleToggleNotifications}
          notificationsOpen={notificationsOpen}
          onToggleMobileSidebar={() => setSidebarMobileOpen((prev) => !prev)}
        />

        <div className="flex flex-1 overflow-hidden relative">
          {sidebarMobileOpen && (
            <div
              className="fixed inset-0 bg-black/50 z-[45] lg:hidden"
              onClick={() => setSidebarMobileOpen(false)}
            />
          )}

          <div className={`${sidebarMobileOpen ? "fixed inset-y-0 left-0 z-[50] lg:static lg:z-auto" : "hidden lg:block"}`}>
            <Sidebar
              collapsed={sidebarCollapsed}
              onToggle={() => setSidebarCollapsed((prev) => !prev)}
              onMobileClose={() => setSidebarMobileOpen(false)}
            />
          </div>

          <main
            className="flex-1 overflow-y-auto transition-all duration-300 px-4 py-4 md:px-6 md:py-6 lg:px-8 lg:py-8"
          >
            <div className="max-w-[1440px] mx-auto">
              {children}
            </div>
          </main>
        </div>

        <RightDrawer
          isOpen={drawerOpen}
          onClose={handleCloseDrawer}
          content={drawerContent}
        />

        <ToastContainer />
      </div>
    </ToastProvider>
  );
}