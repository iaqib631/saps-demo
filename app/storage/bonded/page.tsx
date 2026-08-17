"use client";

/**
 * P2-5 · Bonded area handover register.
 *
 * FC-03 group C routes "Airline Bonded Cargo → Bonded Storage".
 * `IMPORTAWBBOUNDEDAREA` (21 cols) is the CMTS record — **0 occurrences of
 * "Bonded" in the demo before this screen**.
 *
 * Also the prerequisite for Phase 8: FC-09 stores transhipment cargo in a
 * "Bonded Transhipment Zone" that has to exist first.
 */

import { useMemo, useState } from "react";
import { Lock, ShieldCheck, Timer } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import AwbLink from "@/components/awb/AwbLink";
import EmptyState from "@/components/EmptyState";
import { AgingBadge, AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  BONDED_HANDOVERS,
  DEMO_NOW,
  cargoClass,
  daysBetween,
  formatDate,
  formatKg,
  listAwbs,
  storageLocation,
} from "@/lib/domain";

export default function BondedAreaPage() {
  const { scope, isHq } = useSite();
  const scoped = useMemo(() => listAwbs({ scope }), [scope]);
  const scopedIds = useMemo(() => new Set(scoped.map((a) => a.AWBId)), [scoped]);

  const handovers = useMemo(
    () => BONDED_HANDOVERS.filter((h) => scopedIds.has(h.AWBId)),
    [scopedIds],
  );
  const [selected, setSelected] = useState<number | null>(handovers[0]?.BoundedAreaId ?? null);
  const sel = handovers.find((h) => h.BoundedAreaId === selected);
  const selAwb = sel ? scoped.find((a) => a.AWBId === sel.AWBId) : null;

  const totalKg = handovers.reduce((n, h) => {
    const a = scoped.find((x) => x.AWBId === h.AWBId);
    return n + (a?.TOTALWEIGHT ?? 0);
  }, 0);

  const transhipment = handovers.filter((h) => {
    const a = scoped.find((x) => x.AWBId === h.AWBId);
    return a?.branch === "transhipment";
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Storage" }, { label: "Bonded Area" }]} />
        <div>
          <div className="flex items-center gap-2">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M05 → M15
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-03 group C
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Bonded Area Handover
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Custody of bonded cargo, with the airline representative who authorised each handover.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "In bonded stock", value: handovers.length, tone: "#0F172A" },
          { label: "Total weight", value: formatKg(totalKg), tone: "#1B4F8B" },
          { label: "Transhipment cargo", value: transhipment.length, tone: "#7C3AED" },
          {
            label: "Longest dwell",
            value: handovers.length
              ? `${Math.max(...handovers.map((h) => daysBetween(h.HandOverDate, DEMO_NOW)))}d`
              : "—",
            tone: "#D97706",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[24px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {handovers.length === 0 ? (
        <EmptyState
          title="No bonded stock at this site"
          description="Bonded cargo arrives via FC-03 group C, or as transhipment awaiting onward carriage."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Register */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Lock size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Bonded stock</h3>
            </div>
            <div className="max-h-[540px] overflow-y-auto">
              {handovers.map((h) => {
                const a = scoped.find((x) => x.AWBId === h.AWBId);
                const days = daysBetween(h.HandOverDate, DEMO_NOW);
                return (
                  <button
                    key={h.BoundedAreaId}
                    onClick={() => setSelected(h.BoundedAreaId)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{
                      backgroundColor: selected === h.BoundedAreaId ? "#EBF0F7" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {h.AWBNO}
                      </span>
                      {a && (
                        <AgingBadge
                          totalDays={days}
                          freeDays={cargoClass(a.CARGOCLASSID).freeDays}
                          compact
                        />
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-0.5 truncate">
                      {h.GoodDescription}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {storageLocation(h.locationId)?.ABBREVATION} · handed over{" "}
                      {formatDate(h.HandOverDate)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Detail — IMPORTAWBBOUNDEDAREA all 21 columns */}
          {sel && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">Handover record</h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      CMTS IMPORTAWBBOUNDEDAREA — 21 columns
                    </p>
                  </div>
                  <span
                    className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                    style={{
                      backgroundColor: sel.direction === "in" ? "#DBEAFE" : "#DCFCE7",
                      color: sel.direction === "in" ? "#1B4F8B" : "#16A34A",
                    }}
                  >
                    <ShieldCheck size={10} />
                    handover {sel.direction}
                  </span>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                  {(
                    [
                      ["BoundedAreaId", String(sel.BoundedAreaId)],
                      ["IGMNO", sel.IGMNO],
                      ["AWBNO", sel.AWBNO],
                      ["NameOfAirLineRepsntive", sel.NameOfAirLineRepsntive],
                      ["AirlineId", sel.AirlineId],
                      ["GoodDescription", sel.GoodDescription],
                      ["HandOverDate", formatDate(sel.HandOverDate)],
                      ["HandOverTime", sel.HandOverTime],
                      ["Destination", sel.Destination],
                      ["DeliverBy", sel.DeliverBy],
                      ["USERID", sel.USERID],
                      ["UniqueIdentification", sel.UniqueIdentification],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                      <span className="text-[13px] font-medium text-[#0F172A] break-words">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {selAwb && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                  <h3 className="text-[14px] font-semibold text-[#0F172A] mb-3">Consignment</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                    {[
                      ["AWB", <AwbLink key="a" awbNo={selAwb.AWBNO} awbId={selAwb.AWBId} />],
                      ["Class", cargoClass(selAwb.CARGOCLASSID).ABBREVATION],
                      ["Pieces", String(selAwb.TOTALPCS)],
                      ["Weight", formatKg(selAwb.TOTALWEIGHT)],
                      ["Zone", storageLocation(sel.locationId)?.NAME ?? "—"],
                      ["Consignee", selAwb.CONSIGNEE1],
                      ["Branch", selAwb.branch ?? "main flow"],
                      ["Dwell", `${daysBetween(sel.HandOverDate, DEMO_NOW)} days`],
                    ].map(([l, v], i) => (
                      <div key={i} className="flex flex-col gap-1">
                        <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          {l as string}
                        </span>
                        <span className="text-[13px] font-medium text-[#0F172A] truncate">{v}</span>
                      </div>
                    ))}
                  </div>

                  {selAwb.branch === "transhipment" && (
                    <div className="mt-4 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 flex items-start gap-3">
                      <Timer size={15} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-[13px] font-semibold text-[#7C3AED]">
                          Transhipment cargo — bond continues to the onward carrier
                        </p>
                        <p className="text-[12px] text-[#6D28D9] mt-0.5">
                          FC-09 keeps this under customs bond; it does not enter local consumption.
                          The transhipment module (P8-1) is not built yet — this zone is its
                          prerequisite.
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <AuditStrip record={sel} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
