"use client";

/**
 * T5 · Storage pressure by node, and T7 · the open-case register.
 *
 * STORAGE is the one master in this demo that genuinely differs per node —
 * `STORAGE_LOCATIONS` is 20 zones × 3 sites with a fixed occupancy matrix, so
 * "KHI is fuller than PEW" is a real fact and not an artefact of scoping. That
 * is what makes cross-site capacity an HQ decision: FC-12 §03 routes cargo
 * between nodes, and a routing decision needs both ends' headroom.
 *
 * The hold-zone figure is carried separately because it is the one that
 * constrains a handoff. Hold zones are where detained, discrepant, quarantined
 * and Section 82 cargo sits; general headroom does not help if the cargo
 * arriving is under bond.
 *
 * The "same zone worst at every node" line is COMPUTED, not asserted. If the
 * occupancy matrix changes it stops claiming it, rather than becoming a stale
 * sentence nobody re-checks.
 *
 * T7 is a table rather than a chart on purpose: the whole estate holds single
 * digits of open cases per register, and a donut over eight rows is decoration
 * that makes eight look like a distribution.
 */

import { Boxes, ClipboardList } from "lucide-react";
import { HqCard, Meter, SeverityPill } from "@/components/hq/HqUi";
import {
  SITES,
  listDetends,
  listHolds,
  listLongStay,
  listMishandled,
  listReExport,
  listTranshipments,
  locationsForSite,
  type SiteCode,
} from "@/lib/domain";

function pressureFor(site: SiteCode) {
  const zones = locationsForSite(site);
  const cap = zones.reduce((n, z) => n + z.capacityKg, 0);
  const occ = zones.reduce((n, z) => n + z.occupiedKg, 0);
  const hold = zones.filter((z) => z.isHoldZone);
  const holdCap = hold.reduce((n, z) => n + z.capacityKg, 0);
  const holdOcc = hold.reduce((n, z) => n + z.occupiedKg, 0);
  const worst = zones
    .map((z) => ({ zone: z, pct: (z.occupiedKg / z.capacityKg) * 100 }))
    .sort((a, b) => b.pct - a.pct)[0];
  return {
    site,
    zones: zones.length,
    utilisation: (occ / cap) * 100,
    holdUtilisation: (holdOcc / holdCap) * 100,
    worst,
  };
}

export function StoragePressure() {
  const rows = SITES.map((s) => pressureFor(s.code));
  const worstNames = new Set(rows.map((r) => r.worst.zone.ABBREVATION));
  const sharedWorst = worstNames.size === 1 ? rows[0].worst.zone : null;

  return (
    <HqCard
      title="Storage pressure by node"
      icon={Boxes}
      source="locationsForSite(site) over STORAGE_LOCATIONS · lib/domain/masters.ts"
      intro="The one master data set that is genuinely per-node — 20 zones each, with their own occupancy. Hold-zone headroom is split out because it is what constrains cargo arriving under bond."
      action={{ label: "Storage master", href: "/storage/master" }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {rows.map((r) => (
          <div key={r.site} className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-[#0F172A]">{r.site}</span>
              <SeverityPill
                severity={r.utilisation >= 80 ? "serious" : r.utilisation >= 60 ? "warning" : "good"}
                label={r.utilisation >= 80 ? "Tight" : r.utilisation >= 60 ? "Filling" : "Headroom"}
              />
            </div>

            <p className="mt-2 text-[11px] font-semibold text-[#64748B]">
              All zones · {r.utilisation.toFixed(1)}%
            </p>
            <div className="mt-1">
              <Meter pct={r.utilisation} />
            </div>

            <p className="mt-2.5 text-[11px] font-semibold text-[#64748B]">
              Hold zones only · {r.holdUtilisation.toFixed(1)}%
            </p>
            <div className="mt-1">
              <Meter pct={r.holdUtilisation} tone="#7C3AED" />
            </div>

            <p className="mt-2.5 text-[11px] leading-snug text-[#64748B]">
              Tightest zone{" "}
              <span className="font-mono font-semibold text-[#0F172A]">
                {r.worst.zone.ABBREVATION}
              </span>{" "}
              at {r.worst.pct.toFixed(0)}% — {r.worst.zone.NAME}
            </p>
          </div>
        ))}
      </div>

      {sharedWorst && (
        <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
          <span className="font-semibold text-[#64748B]">Estate pattern: </span>
          {sharedWorst.ABBREVATION} is the tightest zone at all {rows.length} nodes. A constraint
          that repeats everywhere is a capacity decision, not a local one — and it is only visible
          from a tier that reads every node&apos;s storage master at once.
        </p>
      )}
    </HqCard>
  );
}

/* ------------------------------------------------------------------ */

const REGISTERS: { label: string; flow: string; href: string; count: (s: SiteCode) => number }[] = [
  { label: "Holds", flow: "FC-06 / FC-07", href: "/exceptions/holds", count: (s) => listHolds(s, true).length },
  { label: "Detained", flow: "FC-06", href: "/customs/detained", count: (s) => listDetends(s, true).length },
  { label: "Long-stay", flow: "FC-10-C", href: "/exceptions/long-stay", count: (s) => listLongStay(s, true).length },
  { label: "Mishandled", flow: "FC-10-A", href: "/exceptions/mishandled", count: (s) => listMishandled(s, true).length },
  { label: "Re-export", flow: "FC-10-B", href: "/exceptions/re-export", count: (s) => listReExport(s, true).length },
  { label: "Transhipment", flow: "FC-09", href: "/transhipment/register", count: (s) => listTranshipments(s, true).length },
];

export function OpenCaseRegisters() {
  const rows = REGISTERS.map((r) => {
    const perSite = SITES.map((s) => ({ site: s.code, n: r.count(s.code) }));
    return { ...r, perSite, total: perSite.reduce((n, x) => n + x.n, 0) };
  });

  return (
    <HqCard
      title="Open cases by register"
      icon={ClipboardList}
      source="listHolds · listDetends · listLongStay · listMishandled · listReExport · listTranshipments, each at openOnly · lib/domain/index.ts"
      intro="Every open case on the estate, by the register that owns it. Small numbers stay a table — a chart over single digits implies a distribution that is not there."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Register
              </th>
              {SITES.map((s) => (
                <th
                  key={s.code}
                  className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                >
                  {s.code}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#1B4F8B]">
                Estate
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label} className="border-b border-[#F1F5F9] last:border-b-0">
                <td className="px-2 py-2.5">
                  <p className="text-[13px] font-semibold text-[#0F172A]">{r.label}</p>
                  <p className="font-mono text-[10px] text-[#94A3B8]">{r.flow}</p>
                </td>
                {r.perSite.map((p) => (
                  <td
                    key={p.site}
                    className="px-2 py-2.5 text-right text-[13px] tabular-nums"
                    style={{ color: p.n === 0 ? "#CBD5E1" : "#475569" }}
                  >
                    {p.n}
                  </td>
                ))}
                <td className="px-2 py-2.5 text-right text-[14px] font-bold tabular-nums text-[#0F172A]">
                  {r.total}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </HqCard>
  );
}
