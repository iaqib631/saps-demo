"use client";

/**
 * /admin — the Warehouse portal's per-site administration home (FC-12 §01,
 * "per-site node — KHI / LHE / PEW, each owning its cargo, storage and finance
 * data").
 *
 * WHAT CHANGED HERE. This file used to open with six `AdminKPICard`s built from
 * string literals — 184 active users, 9 locked, 17 roles, 87% integration
 * health, 23 failed events, 1,247 audit events, five of them with an invented
 * trend arrow. Nothing fed any of them, they read identically whichever site
 * the header switcher was on, and after the (admin) route-group move they sat
 * on the path a client reaches from the landing page.
 *
 * They are now two things. `SiteAdminKpis` is the five figures that a real
 * lib/domain function can produce for the ACTIVE SITE, each printing the
 * function it came from. `NotShownOnDashboard` is the four that cannot be
 * produced for a single site, each with the concrete blocker named. Nothing
 * was fabricated and nothing was silently dropped.
 *
 * `components/admin/AdminKPICard.tsx` is left untouched but is now referenced
 * by nothing — this was its only caller. It is not deleted here because it is
 * outside this component's ownership, and it should not simply be re-adopted:
 * its `trend` / `trendValue` props are what drew the five invented arrows, and
 * this screen has no second point in time to compute one from. Removing it, or
 * stripping those two props, is a one-line follow-up for whoever owns it.
 *
 * The four panels below the row still hold component-local arrays. They are
 * lists rather than headline figures, which is a materially smaller claim —
 * but they are the next thing to point at lib/domain, and until they are,
 * nothing on this screen should be read as a per-site count except the row.
 */

import { useState, useEffect } from "react";
import SiteAdminKpis from "./SiteAdminKpis";
import NotShownOnDashboard from "./NotShownOnDashboard";
import RecentUserActivity from "./RecentUserActivity";
import IntegrationStatus from "./IntegrationStatus";
import MasterDataChanges from "./MasterDataChanges";
import SecurityAlerts from "./SecurityAlerts";
import ErrorState from "@/components/ErrorState";

export default function AdminDashboardContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1200);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    setShowError(false);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="space-y-8">
      {showError ? (
        <ErrorState
          title="Dashboard data unavailable"
          message="The administration feed for this site could not be refreshed."
          onRetry={handleRetry}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="mb-4 h-4 w-24 animate-pulse rounded bg-[#F1F5F9]" />
              <div className="h-7 w-16 animate-pulse rounded bg-[#F1F5F9]" />
              <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#F1F5F9]" />
            </div>
          ))}
        </div>
      ) : (
        <SiteAdminKpis />
      )}

      {!showError && !isLoading && <NotShownOnDashboard />}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <RecentUserActivity isLoading={isLoading} />
        <IntegrationStatus isLoading={isLoading} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <MasterDataChanges isLoading={isLoading} />
        <SecurityAlerts isLoading={isLoading} />
      </div>
    </div>
  );
}
