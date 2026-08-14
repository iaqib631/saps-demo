"use client";

/**
 * Cross-stage export KPI strip — ported from the retired `/export-cargo` hub
 * (PORTAL_AND_DEDUP_PLAN.md §2.1).
 *
 * Every canonical export screen already carries four tiles, but each one
 * measures its own stage: acceptance counts broken seals, customs counts
 * correction loops, build-up counts PFM discrepancies. None of them answers
 * the question a duty manager actually asks at the top of a shift — "how is
 * export doing today, across all of it". The retired hub was the only screen
 * that did, and those four tiles are the thing worth keeping from it.
 *
 * It lives in a component rather than inline in a page because **there is no
 * `/export` index route**. It is mounted at the head of `/export/acceptance`,
 * the first counter screen in the lane, and can be lifted onto an index page
 * unchanged if one is ever added.
 *
 * Two of the four are computed differently from the hub, deliberately:
 *
 *   • **Awaiting acceptance** counts consignments still at E01 — sold by the
 *     airline, not yet presented at the counter. The seed parks no row there,
 *     so this reads zero. A derived zero is worth more than the hub's
 *     hand-written 14: it says the measure is wired, and the fixture is what
 *     is thin.
 *
 *   • **Outbound flights** replaces the hub's "next 12h" window. Twelve hours
 *     was written against hand-authored rows; against the fixture clock every
 *     scheduled departure sits roughly fourteen hours out, so a 12-hour window
 *     would read zero at every site and hide the measure entirely. The tile
 *     counts distinct flights whose departure has not yet passed, which is the
 *     same question without a window that only one dataset satisfies.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight } from "lucide-react";
import { DEMO_NOW, clearanceState, type ExportConsignment } from "@/lib/domain";

/** Same calendar day as the demo's fixed "now" — see `DEMO_NOW` in common.ts. */
function onDemoDay(iso: string | null): boolean {
  if (!iso) return false;
  return new Date(iso).toDateString() === new Date(DEMO_NOW).toDateString();
}

export interface CrossStageTile {
  label: string;
  value: string;
  sub: string;
  tone: string;
  /** null where the measure spans several screens and no one screen owns it. */
  href: string | null;
}

export function exportCrossStageKpis(rows: ExportConsignment[]): CrossStageTile[] {
  const awaitingAcceptance = rows.filter((x) => x.stage === "E01-booked");
  const clearedToday = rows.filter((x) => onDemoDay(x.declaration.clearedAt));

  const nowMs = Date.parse(DEMO_NOW);
  const flightsAhead = new Set<string>();
  for (const x of rows) {
    if (x.flightNo && x.scheduledDeparture && Date.parse(x.scheduledDeparture) > nowMs) {
      flightsAhead.add(x.flightNo);
    }
  }

  /*
   * "In exception" on the export side is not one register, and pretending it
   * is would be the wrong simplification. A consignment is stuck if customs
   * settled it terminally, if a custody handover found the seal broken, or if
   * the build did not match the load plan — three different screens own those
   * three facts, which is why this tile deliberately links to none of them.
   */
  const heldOrDiscrepant = rows.filter(
    (x) =>
      clearanceState(x.clearance).terminal ||
      x.custodyChain.some((e) => e.sealIntact === false) ||
      x.discrepancyNoteNo !== null,
  );

  return [
    {
      label: "Awaiting acceptance",
      value: String(awaitingAcceptance.length),
      sub: "booked, not yet at the counter",
      tone: "#0F172A",
      href: "/export/acceptance",
    },
    {
      label: "Customs cleared today",
      value: String(clearedToday.length),
      sub: "export declarations cleared by PSW",
      tone: "#16A34A",
      href: "/export/customs",
    },
    {
      label: "Outbound flights",
      value: String(flightsAhead.size),
      sub: "scheduled, not yet departed",
      tone: "#1B4F8B",
      href: "/export/buildup",
    },
    {
      label: "Held / discrepant",
      value: String(heldOrDiscrepant.length),
      sub: "customs, seal or build-up",
      tone: heldOrDiscrepant.length ? "#DC2626" : "#16A34A",
      href: null,
    },
  ];
}

export default function ExportCrossStageStrip({
  rows,
  scopeLabel,
}: {
  rows: ExportConsignment[];
  /** e.g. "All sites" or "KHI only" — the site scope the rows were read at. */
  scopeLabel?: string;
}) {
  const tiles = exportCrossStageKpis(rows);
  // The strip is mounted inside the lane it measures, so one tile always
  // points at the screen the reader is already on. Drop that link rather than
  // offering a no-op — and drop it by comparison, so the component stays
  // correct wherever it is mounted next.
  const here = usePathname();

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
        <div>
          <h2 className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wider">
            Export today — across every stage
          </h2>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            The one cross-stage read in the export lane. Each stage screen below measures only
            itself.
            {scopeLabel ? ` ${scopeLabel}.` : ""}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => {
          const body = (
            <>
              <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {t.label}
              </p>
              <p className="text-[22px] font-bold mt-1" style={{ color: t.tone }}>
                {t.value}
              </p>
              <p className="text-[11px] text-[#94A3B8] mt-0.5 leading-snug">{t.sub}</p>
            </>
          );

          return t.href && t.href !== here ? (
            <Link
              key={t.label}
              href={t.href}
              className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 no-underline hover:border-[#1B4F8B] transition-colors relative block"
            >
              <ArrowUpRight size={13} className="absolute top-4 right-4 text-[#CBD5E1]" />
              {body}
            </Link>
          ) : (
            <div key={t.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
              {body}
            </div>
          );
        })}
      </div>
    </div>
  );
}
