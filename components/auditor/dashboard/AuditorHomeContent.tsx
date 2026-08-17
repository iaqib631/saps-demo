"use client";

/**
 * /auditor — the HQ tier's read side.
 *
 * WHAT THIS SCREEN WAS. Six KPI tiles that were string literals with six
 * invented deltas beside them, all subtitled "Last 30 days"; four summary cards
 * holding sixteen more literals; a period selector wired to nothing; and a
 * ten-row "Recent Audit Events" table naming ten people, ten entity references
 * and ten evidence filenames that exist in no fixture. It is reachable in two
 * clicks from the landing grid — Headquarters, then Auditor — which made it the
 * most exposed remaining instance of the exact defect
 * components/admin/dashboard/ had just had removed.
 *
 * WHAT IT IS NOW. The same shape, connected. The six questions the old tiles
 * asked were the right six and all six are answerable: AWBs, waivers, holds,
 * OOC issuances, invoices and administration rights all have registers behind
 * them. The four summary cards keep their four headings and count what those
 * headings are actually about. The audit table is replaced by the honest half
 * of what it claimed — every dated write with a named actor — and what is NOT
 * recoverable is stated on the screen rather than deleted quietly.
 *
 * Every derivation lives in components/auditor/auditorMetrics.ts; this file is
 * layout. That separation is the same one components/admin/dashboard/ uses, and
 * it is what makes "is any figure on this page invented?" a question you can
 * answer by reading one module.
 */

import { useMemo } from "react";
import {
  Boxes,
  FileCheck2,
  Landmark,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react";
import { HqCard } from "@/components/hq/HqUi";
import { DEMO_NOW, SITES, formatDateTime } from "@/lib/domain";
import { AuditorStat } from "../AuditorUi";
import { crossSiteFacts, estateFigures, estatePanels } from "../auditorMetrics";
import NotShownOnAuditorHome from "./NotShownOnAuditorHome";
import RecordTrail from "./RecordTrail";

const PANEL_ICON: Record<string, LucideIcon> = {
  cargo: Boxes,
  financial: Landmark,
  compliance: FileCheck2,
  access: ShieldCheck,
};

export default function AuditorHomeContent() {
  const figures = useMemo(() => estateFigures(), []);
  const panels = useMemo(() => estatePanels(), []);
  const facts = useMemo(() => crossSiteFacts(), []);

  return (
    <div className="space-y-6">
      {/* The strip that replaces the Today / 7 Days / 30 Days / Custom
          selector. It filtered nothing, and there is no period to filter by —
          so what stands in its place is the two facts that ARE true about the
          scope of everything below: all three nodes, one instant. */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Scope
          </span>
          <span className="text-[13px] font-bold text-[#0F172A]">Estate-wide</span>
          <span className="text-[12px] text-[#64748B]">
            {SITES.map((s) => s.code).join(" · ")}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            As at
          </span>
          <span className="font-mono text-[12px] text-[#0F172A]">
            {formatDateTime(DEMO_NOW)}
          </span>
        </div>
        <p className="ml-auto max-w-[46ch] text-[11px] leading-relaxed text-[#64748B]">
          One snapshot, not a period. Nothing on this page carries a trend — see the last card for
          why the arrows were removed rather than recalculated.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {figures.map((f) => (
          <AuditorStat
            key={f.key}
            label={f.label}
            value={f.value}
            detail={f.detail}
            source={f.source}
            severity={f.severity}
            status={f.status}
            href={f.href}
          />
        ))}
      </div>

      {/* Three facts that exist only at this tier — a node's own portal sees
          half of each, or none of it. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {facts.map((f) => (
          <AuditorStat
            key={f.label}
            label={f.label}
            value={f.value}
            detail={f.detail}
            source={f.source}
            severity={f.severity}
            href={f.href}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {panels.map((p) => (
          <HqCard
            key={p.key}
            title={p.title}
            icon={PANEL_ICON[p.key] ?? Boxes}
            source={p.source}
            intro={p.intro}
            action={p.action}
          >
            <dl className="flex flex-col gap-3">
              {p.items.map((item) => (
                <div key={item.label} className="border-b border-[#F1F5F9] pb-3 last:border-0 last:pb-0">
                  <div className="flex items-baseline justify-between gap-3">
                    <dt className="text-[12px] font-medium text-[#475569]">{item.label}</dt>
                    <dd className="whitespace-nowrap text-[14px] font-bold tabular-nums text-[#0F172A]">
                      {item.value}
                    </dd>
                  </div>
                  {item.note && (
                    <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">{item.note}</p>
                  )}
                </div>
              ))}
            </dl>
          </HqCard>
        ))}
      </div>

      <RecordTrail />

      <NotShownOnAuditorHome />
    </div>
  );
}
