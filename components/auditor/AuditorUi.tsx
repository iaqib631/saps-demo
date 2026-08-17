"use client";

/**
 * Audit & Oversight — the one primitive this portal adds, and why every other
 * piece on these five screens is imported rather than copied.
 *
 * WHAT WAS HERE BEFORE. /auditor opened on six tiles that were string literals
 * with invented arrows beside them — "2,847 / +8.2%", "31 / -12% vs prev",
 * "156 / +5.4%", "89 / ±0%", "412 / +11.8%", "24 / -3 vs prev" — all six
 * subtitled "Last 30 days". Nothing fed any of them, and the arrows were the
 * worse half: a delta needs two points in time and every fixture in this repo is
 * one snapshot at DEMO_NOW, so there is no previous period for a "vs prev" to
 * be measured against. That is the same defect components/admin/dashboard/ had
 * removed one screen away, on the more-travelled path from the landing grid.
 *
 * WHY THIS IMPORTS components/hq/HqUi RATHER THAN SIBLING-ING IT.
 * components/admin/dashboard/SiteKpiUi.tsx deliberately does the opposite, and
 * its reason is stated there: `HqCard` inside the Warehouse portal would assert
 * the wrong tier on a screen that configures ONE node. The auditor is the other
 * case. Audit & Oversight is the HQ tier's READ side — it reads across KHI, LHE
 * and PEW exactly as /hq does (FC-12 §16 cargo trace, §17 financial trace,
 * §17a evidence pack, §06 RBAC snapshot, §18 reports) — so the HQ prefix
 * asserts the tier correctly here and a third copy of the same card, meter and
 * severity pill would be one more place for the three to drift.
 *
 * WHAT IS ADDED is exactly one thing: a stat tile that carries `source` ON THE
 * TILE. `HqStat` deliberately has no such prop because an HQ card's stats share
 * one query and the card names it once. On this portal each headline figure
 * comes from a different lib/domain function, so the provenance belongs on the
 * tile — the same reason SiteKpiUi reached the same shape from the other
 * direction. Like both of them, it has NO TREND PROP and must not grow one.
 */

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { severityTone, type Severity } from "@/components/hq/HqUi";

export function AuditorStat({
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
  severity?: Severity;
  /** Short word beside the value when the figure carries a state. */
  status?: string;
  href?: string;
}) {
  const t = severityTone(severity);

  return (
    <div className="flex flex-col rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-[12px] font-semibold leading-snug text-[#64748B]">{label}</h3>
        {status && (
          <span
            className="inline-flex h-[20px] flex-shrink-0 items-center gap-1 rounded-full px-1.5 text-[10px] font-bold"
            style={{ backgroundColor: t.bg, color: t.fg }}
          >
            <t.Icon size={10} />
            {status}
          </span>
        )}
      </div>

      <p
        className="mt-3 text-[26px] font-bold leading-none"
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
