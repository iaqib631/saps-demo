"use client";

/**
 * The site-tier stat tile, and its "cannot be fed" counterpart.
 *
 * These are the warehouse-portal siblings of components/hq/HqUi.tsx and they
 * enforce the same two rules that portal was built under:
 *
 *   1. **Every figure names its source, and `source` is required.** Not
 *      optional, and it renders. The tiles this replaces were literals; the
 *      first thing a client does with a number is ask where it came from, and
 *      a screen that cannot answer that has no business showing the number.
 *
 *   2. **No trend prop, and it must not grow one.** `AdminKPICard` accepts
 *      `trend` / `trendValue` and the six tiles above this dashboard used them
 *      to draw "+12", "-3", "-2", "+5" and "+12%" — five arrows over a fixture
 *      set that is a single snapshot at DEMO_NOW. A delta needs two points in
 *      time. There is one. So the prop does not exist here rather than being
 *      left available and merely unused.
 *
 * WHY A SIBLING RATHER THAN AN IMPORT of `HqCard` / `HqStat` / `NotAvailable`.
 * Two reasons, and neither is taste. The prefix is load-bearing — `HqCard` in
 * the Warehouse portal would assert the wrong tier on a screen whose whole
 * point after the (admin) route-group move is that it configures ONE node
 * (FC-12 §01), and those files are not this component's to rename. And the
 * shapes genuinely differ: HQ hangs one `source` on a card because a card's
 * stats share a query, whereas each tile in this row comes from a different
 * lib/domain function, so `source` belongs on the tile. What is deliberately
 * NOT copied is anything with numbers in it — the HQ cards are cross-site
 * reads and re-pointing them at one site is exactly the invention this change
 * set exists to remove.
 */

import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  CircleAlert,
  Info,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ *
 * Severity — the reserved status palette, spelled as HqUi spells it so
 * the two portals cannot colour the same state differently. Always an
 * icon and a word beside the colour, never colour alone.
 * ------------------------------------------------------------------ */

export type SiteSeverity = "good" | "warning" | "critical" | "neutral";

const SEVERITY: Record<SiteSeverity, { fg: string; bg: string; Icon: LucideIcon }> = {
  good: { fg: "#16A34A", bg: "#DCFCE7", Icon: CheckCircle2 },
  warning: { fg: "#D97706", bg: "#FEF3C7", Icon: AlertTriangle },
  critical: { fg: "#DC2626", bg: "#FEF2F2", Icon: CircleAlert },
  neutral: { fg: "#64748B", bg: "#F1F5F9", Icon: Info },
};

export function SitePill({ severity, label }: { severity: SiteSeverity; label: string }) {
  const t = SEVERITY[severity];
  const { Icon } = t;
  return (
    <span
      className="inline-flex h-[20px] flex-shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold"
      style={{ backgroundColor: t.bg, color: t.fg }}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

/* ------------------------------------------------------------------ *
 * Stat tile
 * ------------------------------------------------------------------ */

export function SiteStat({
  label,
  value,
  /** The lib/domain function this came from, verbatim. Required. */
  source,
  detail,
  severity = "neutral",
  status,
  href,
}: {
  label: string;
  value: string;
  source: string;
  detail?: string;
  severity?: SiteSeverity;
  /** Short word beside the value when the figure carries a state. */
  status?: string;
  href?: string;
}) {
  const t = SEVERITY[severity];

  return (
    <div className="flex flex-col rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[12px] font-semibold leading-snug text-[#64748B]">{label}</h3>
        {status && <SitePill severity={severity} label={status} />}
      </div>

      <p
        className="mt-3 text-[28px] font-bold leading-none"
        style={{ color: severity === "neutral" ? "#0F172A" : t.fg }}
      >
        {value}
      </p>

      {detail && <p className="mt-2 text-[11px] leading-relaxed text-[#64748B]">{detail}</p>}

      <div className="mt-auto pt-3">
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            Open <ArrowUpRight size={11} />
          </Link>
        )}
        <p className="mt-1.5 font-mono text-[10px] leading-snug text-[#94A3B8]">{source}</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Card — used by the gaps panel. Same required `source`.
 * ------------------------------------------------------------------ */

export function SiteCard({
  title,
  icon: Icon,
  source,
  intro,
  action,
  children,
}: {
  title: string;
  icon: LucideIcon;
  source: string;
  intro?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[16px] border border-[#E2E8F0] bg-white">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#F1F5F9] px-5 py-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Icon size={15} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          </div>
          {intro && <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">{intro}</p>}
          <p className="mt-1.5 font-mono text-[10px] text-[#94A3B8]">{source}</p>
        </div>
        {action && (
          <Link
            href={action.href}
            className="inline-flex flex-shrink-0 items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            {action.label} <ArrowUpRight size={12} />
          </Link>
        )}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  );
}

/* ------------------------------------------------------------------ *
 * The "cannot be fed" marker.
 *
 * `reason` states the concrete blocker — a missing column, a missing
 * store, a missing time dimension — so it reads as a scoping fact rather
 * than an excuse, and so the fix is obvious if the client wants it.
 * `nearest` names the real thing that IS on the screen, which is what
 * keeps a gap from reading as "we forgot".
 * ------------------------------------------------------------------ */

export function NotFedTile({
  title,
  reason,
  nearest,
}: {
  title: string;
  reason: string;
  nearest?: React.ReactNode;
}) {
  return (
    <div className="rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
      <p className="text-[12px] font-semibold text-[#475569]">{title}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{reason}</p>
      {nearest && (
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
          <span className="font-semibold text-[#64748B]">Shown instead: </span>
          {nearest}
        </p>
      )}
    </div>
  );
}
