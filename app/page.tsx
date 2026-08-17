"use client";

import Link from "next/link";
import {
  Warehouse,
  Truck,
  Forklift,
  CalendarRange,
  Activity,
  ShieldCheck,
  Wallet,
  FileSearch,
  Building2,
  Briefcase,
  User,
  MessageSquare,
  Package,
  Ship,
  Settings,
  Landmark,
} from "lucide-react";
import HomeHero from "@/components/HomeHero";
import PortalTile from "@/components/PortalTile";
import QuickStatsStrip from "@/components/QuickStatsStrip";
import ActivityFeed from "@/components/ActivityFeed";
import { PORTALS, portalForPath, type Audience, type PortalMeta } from "@/components/Sidebar";
import { DEMO_NOW, formatDateTime } from "@/lib/domain";

interface TileSpec {
  name: string;
  roleText: string;
  icon: React.ReactNode;
  href: string;
}

interface TileGroup {
  label: string;
  tiles: TileSpec[];
}

const ICON_PROPS = { size: 44, strokeWidth: 1.75, color: "#0B2545" };

/* =============================================================================
 * WHICH PORTAL DOES THIS TILE ENTER?
 * -----------------------------------------------------------------------------
 * The product is three portals, and this page is the ONLY place a client sees
 * all three side by side — LayoutClient lists "/" in NO_APP_SHELL_PATHS, so Home
 * renders without the rail that would otherwise name the portal you are in. The
 * grid is therefore the only signal available, and until now it gave none: the
 * tiles are grouped by what a person DOES (Operations, Compliance & Finance,
 * External Stakeholders, Cargo Modules, System) and those groups deliberately
 * cut across the portals. `/customs` and `/finance-manager` sit in the same
 * group as `/auditor`, which is a different portal; `/admin` and `/hq` sit in
 * the same group and are different TIERS. Neither is visible from the grouping.
 *
 * So every tile carries the portal it enters, and the portal is DERIVED — the
 * href goes to `portalForPath()`, the same route → portal index components/
 * AppShell.tsx titles the header from. A second hand-written map of route to
 * portal name is exactly what that index replaced after it drifted, and adding
 * one here would re-open the drift on the first screen a client sees.
 *
 * The accent is keyed on `audience` rather than on the portal label, because
 * `Audience` is a typed union: if a fourth audience is ever added, this Record
 * fails to compile instead of silently rendering an uncoloured chip.
 * ===========================================================================*/
const PORTAL_ACCENT: Record<Audience, { fg: string; bg: string; border: string }> = {
  "internal-ops": { fg: "#1B4F8B", bg: "#EFF6FF", border: "#BFDBFE" },
  customer: { fg: "#0F766E", bg: "#F0FDFA", border: "#99F6E4" },
  admin: { fg: "#6D28D9", bg: "#F5F3FF", border: "#DDD6FE" },
};

/**
 * What each portal is FOR, in one line, for a client who has never seen the
 * rail. The labels come from `PORTALS` so they cannot disagree with the sidebar;
 * only the prose is held here, keyed on the same typed `Audience`.
 */
const PORTAL_SCOPE: Record<Audience, string> = {
  "internal-ops":
    "One terminal node, end to end — its cargo, its storage, its money, and that node's own configuration.",
  customer:
    "The parties SAPS serves rather than employs — consignee, customs broker, freight forwarder.",
  admin:
    "Islamabad, standing over all three nodes — who may administer which site, and the audit that reads across them.",
};

function PortalChip({ meta }: { meta: PortalMeta }) {
  const accent = PORTAL_ACCENT[meta.audience];
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-[3px] text-[10px] font-bold uppercase tracking-[1.2px]"
      style={{ color: accent.fg, backgroundColor: accent.bg, borderColor: accent.border }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: accent.fg }} />
      {meta.label}
    </span>
  );
}

const groups: TileGroup[] = [
  {
    label: "Operations",
    tiles: [
      { name: "Warehouse Manager", roleText: "Putaway · picking · storage map", icon: <Warehouse {...ICON_PROPS} />, href: "/warehouse-manager" },
      { name: "Gate Entry", roleText: "Vehicle in/out · driver ID · authority letter", icon: <Truck {...ICON_PROPS} />, href: "/gate-entry" },
      { name: "Lifter Operator", roleText: "Task list · RFID handheld · movement log", icon: <Forklift {...ICON_PROPS} />, href: "/lifter-operator" },
      { name: "Planner", roleText: "Capacity · slots · roster · forecast", icon: <CalendarRange {...ICON_PROPS} />, href: "/planner" },
      { name: "Operations Supervisor", roleText: "Live ops · performance · escalations", icon: <Activity {...ICON_PROPS} />, href: "/operations-supervisor" },
    ],
  },
  {
    label: "Compliance & Finance",
    tiles: [
      // The /excise-compliance hub was retired: its KPI strip and SLA Watch were rebuilt on the
      // new /customs index, and its four working screens moved into the portals that own them
      // (queue/channel-detail/ooc-capture under /customs, holds and Section 82 under /exceptions).
      // /customs is the tile's target because it is the only one of those that is a landing page.
      { name: "Customs & Compliance", roleText: "Customs queue · OOC · holds · Section 82", icon: <ShieldCheck {...ICON_PROPS} />, href: "/customs" },
      { name: "Finance Manager", roleText: "Invoicing · waivers · payments · tariffs", icon: <Wallet {...ICON_PROPS} />, href: "/finance-manager" },
      { name: "Auditor", roleText: "Cargo trace · financial trace · RBAC", icon: <FileSearch {...ICON_PROPS} />, href: "/auditor" },
    ],
  },
  {
    label: "External Stakeholders",
    tiles: [
      { name: "Forwarding Agent", roleText: "AWB entry · dispatch docs · payments", icon: <Building2 {...ICON_PROPS} />, href: "/forwarding-agent" },
      { name: "CHA", roleText: "GD filing · channel workflow · DO", icon: <Briefcase {...ICON_PROPS} />, href: "/cha" },
      { name: "Consignee", roleText: "Shipments · NOA · pay & download DO", icon: <User {...ICON_PROPS} />, href: "/consignee/dashboard" },
    ],
  },
  {
    label: "Cargo Modules",
    tiles: [
      { name: "ULD Management", roleText: "UCM · SCM · LUC · message log", icon: <MessageSquare {...ICON_PROPS} />, href: "/uld-message-builder" },
      // The CMTS-absorption preview screens were absorbed into the process modules that now own
      // each one: manifest and AWB split into /import, rent history and charges into /billing.
      // The absorption NARRATIVE — which CMTS tables landed where, and the Annexure-G scope
      // delta — has no screen: it used to live at /modules, which was deleted along with the
      // flow walkthroughs. It survives as prose in CMTS_MIGRATION_GAP_REPORT.md and as data in
      // lib/architecture.ts. So this tile names the operational spine, which is the only thing
      // it can honestly point at. A tile still called "CMTS Absorption" would point at nothing.
      { name: "Import Cargo", roleText: "Manifest · AWB split · acceptance · indexing", icon: <Package {...ICON_PROPS} />, href: "/import/summary" },
      { name: "Export Cargo", roleText: "Acceptance · customs · manifest · handover", icon: <Ship {...ICON_PROPS} />, href: "/export/booking" },
    ],
  },
  {
    label: "System",
    tiles: [
      // ONE TILE SPLIT INTO TWO, because it was one tile over two tiers. It read
      // "Admin / Super Admin" and hrefed /admin, which was true while the nine
      // /admin/* screens lived in the Superadmin portal. They do not any more:
      // FC-12 §01 is the "per-site node — KHI / LHE / PEW, each owning its cargo,
      // storage and finance data" and it hrefs /admin/settings, so /admin is ONE
      // SITE's configuration and now belongs to the Warehouse portal. A client
      // reading the word "Super Admin" and landing on a single node's user list
      // was being told the opposite of the thing the split exists to say.
      //
      //   Site Administration  →  /admin   FC-12 §01 settings · §04 roles ·
      //                                    §05 users · §07 master data ·
      //                                    §13 integrations · §14 audit trail
      //   Headquarters         →  /hq      FC-12 §02 the Islamabad HQ tier,
      //                                    where scope "HQ" means all sites
      //
      // The roleText on each leads with SCOPE — "one site's" against "all three
      // sites" — because that is the whole distinction and it is invisible from
      // the names alone. Everything named on the HQ tile is a screen that exists
      // under app/(hq)/hq/**: the site register (/hq/sites), the delegations that
      // appoint site administrators (/hq/site-admins) and the inter-station
      // ownership handoff HQ approves because neither end may grant itself the
      // move (/hq/handoffs, FC-12 §03). The fifth, /hq/rights (FC-12 §04's
      // ceiling), is left off for length rather than omitted as unreal.
      { name: "Site Administration", roleText: "One site's users · roles · master data · integrations", icon: <Settings {...ICON_PROPS} />, href: "/admin" },
      // Landmark rather than the rail's Building2: that glyph is already the
      // Forwarding Agent tile in this grid, and two identical icons in one grid
      // is the same failure as two identical labels.
      { name: "Headquarters", roleText: "Islamabad tier · all three sites · site admins · handoffs", icon: <Landmark {...ICON_PROPS} />, href: "/hq" },
    ],
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: "#F8FAFC" }}>
      {/* Top header bar */}
      <header
        className="h-16 px-6 flex items-center justify-between"
        style={{ backgroundColor: "#0B2545" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-white text-[20px] font-bold tracking-tight">AirVault</span>
          <span className="text-white/60 text-[13px]">·</span>
          <span className="text-white/80 text-[13px] font-medium">One-Window Vision · SAPS Karachi</span>
        </div>
      </header>

      {/* Hero band */}
      <HomeHero />

      {/* Main content */}
      <main className="max-w-[1280px] mx-auto px-4 lg:px-8 py-8 space-y-10">
        {/* The three portals, stated once, before the grid that enters them. */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">Three portals</h2>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[12px] font-medium text-[#94A3B8]">every tile below says which one it enters</span>
          </div>
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm grid grid-cols-1 md:grid-cols-3 gap-6">
            {Object.values(PORTALS).map((meta) => (
              <div key={meta.label} className="flex flex-col items-start gap-2">
                <PortalChip meta={meta} />
                <p className="text-[13px] text-[#475569] leading-[20px]">{PORTAL_SCOPE[meta.audience]}</p>
              </div>
            ))}
          </div>
        </section>

        {groups.map((group) => (
          <section key={group.label}>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">{group.label}</h2>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              {/* Was "N portals". These groups cut ACROSS the three portals — this
                  one holds two of them — so counting tiles in that word made the
                  page contradict the chips on the tiles it was counting. */}
              <span className="text-[12px] font-medium text-[#94A3B8]">{group.tiles.length} destination{group.tiles.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 justify-items-center">
              {group.tiles.map((tile) => {
                /* Derived, never authored: see the PORTAL_ACCENT comment above.
                   `null` is unreachable for every href in this file — each one is
                   a rail block href or a registered leaf — but the tag is dropped
                   rather than guessed if a future tile points somewhere unowned. */
                const portal = portalForPath(tile.href);
                return (
                  <div key={tile.name} className="w-full flex flex-col items-center gap-2">
                    {portal ? <PortalChip meta={portal} /> : <span className="h-[21px]" />}
                    <PortalTile
                      name={tile.name}
                      roleText={tile.roleText}
                      icon={tile.icon}
                      href={tile.href}
                    />
                  </div>
                );
              })}
            </div>
          </section>
        ))}

        {/* =====================================================================
          * "LIVE SNAPSHOT · AUTO-REFRESHING" — BOTH WORDS WERE UNTRUE.
          * ---------------------------------------------------------------------
          * QuickStatsStrip has no timer, no fetch and no state; it refreshed
          * nothing, and it never had. That heading was the worse half of the
          * defect: twelve static numbers are a gap a client discovers when they
          * ask to drill in, but a component that announces it is auto-refreshing
          * is disproved by anyone who watches it for a minute, on the first
          * screen they ever see.
          *
          * So the eyebrow names the fixed instant instead, and it is DERIVED —
          * formatDateTime(DEMO_NOW), not a typed date, so it cannot drift from
          * the constant every fixture in the repo hangs off. Naming 03 Aug 2026,
          * 14:32 out loud is more credible than implying live data, not less: it
          * says the demo is a reconstructed moment, which is what it is.
          * =================================================================== */}
        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">Estate snapshot</h2>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[12px] font-medium text-[#94A3B8]">
              as at {formatDateTime(DEMO_NOW)} · a fixed demo instant, not live
            </span>
          </div>
          <QuickStatsStrip />
        </section>

        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">Recent activity</h2>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
          </div>
          <ActivityFeed />
        </section>
      </main>

      <footer className="border-t border-[#E2E8F0] py-6 mt-8">
        <div className="max-w-[1280px] mx-auto px-4 lg:px-8 flex items-center justify-between">
          <span className="text-[12px] text-[#64748B]">
            AirVault · Faisal Engineering Services · Built for Shaheen Airport Services
          </span>
          <span className="text-[11px] text-[#94A3B8]">Prototype build</span>
        </div>
      </footer>
    </div>
  );
}
