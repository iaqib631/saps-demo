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
} from "lucide-react";
import HomeHero from "@/components/HomeHero";
import PortalTile from "@/components/PortalTile";
import QuickStatsStrip from "@/components/QuickStatsStrip";
import ActivityFeed from "@/components/ActivityFeed";

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
      // delta — moved to /modules, so this tile names the operational spine and /modules carries
      // the migration story. A tile still called "CMTS Absorption" would point at neither.
      { name: "Import Cargo", roleText: "Manifest · AWB split · acceptance · indexing", icon: <Package {...ICON_PROPS} />, href: "/import/summary" },
      { name: "Export Cargo", roleText: "Acceptance · customs · manifest · handover", icon: <Ship {...ICON_PROPS} />, href: "/export/booking" },
    ],
  },
  {
    label: "System",
    tiles: [
      { name: "Admin / Super Admin", roleText: "Users · roles · master data · integrations", icon: <Settings {...ICON_PROPS} />, href: "/admin" },
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
        {groups.map((group) => (
          <section key={group.label}>
            <div className="flex items-center gap-3 mb-5">
              <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">{group.label}</h2>
              <div className="flex-1 h-px bg-[#E2E8F0]" />
              <span className="text-[12px] font-medium text-[#94A3B8]">{group.tiles.length} portal{group.tiles.length === 1 ? "" : "s"}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5 justify-items-center">
              {group.tiles.map((tile) => (
                <PortalTile
                  key={tile.name}
                  name={tile.name}
                  roleText={tile.roleText}
                  icon={tile.icon}
                  href={tile.href}
                />
              ))}
            </div>
          </section>
        ))}

        <section>
          <div className="flex items-center gap-3 mb-5">
            <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">Live snapshot</h2>
            <div className="flex-1 h-px bg-[#E2E8F0]" />
            <span className="text-[12px] font-medium text-[#94A3B8]">auto-refreshing</span>
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
