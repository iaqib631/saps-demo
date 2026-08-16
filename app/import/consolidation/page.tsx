"use client";

/**
 * P1-7 · AWB Consolidation & Split.
 *
 * FC-01 §11 "Split / Partial Shipment Identification", between piece
 * tagging and cargo segregation.
 *
 * CMTS models this across three tables — `AWBCONSOLE` (41),
 * `AWBConsolDetail` (13), `AWBSplit` (10). The demo had the words but no
 * model: each house needs its own class, location, parties, DO and
 * delivery state.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Database, Merge, Plus, Split } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  HOUSE_AWBS,
  cargoClass,
  cargoSubClass,
  formatKg,
  listAwbs,
  round2,
  storageLocation,
  type AWBConsolDetail,
  type HouseAWB,
} from "@/lib/domain";

/**
 * CMTS source tables behind consolidation.
 *
 * The first three are the ones this screen models directly. The last two are
 * absorbed from the legacy awb-consolidation module and are easy to miss: a
 * house AWB does not stop being a house when it leaves. AWBTRANSFER carries the
 * consol lineage onto a transferred-out house, and AWBARRIVALADVICE is raised
 * per house rather than per master — so a consolidation of three houses
 * produces three advices, not one. Both are named here because they are the
 * two tables whose provenance disappeared when the legacy screen was absorbed.
 */
const CMTS_SOURCE_TABLES = [
  { table: "AWBCONSOLE", meaning: "The house AWB record — 41 columns, rendered below" },
  { table: "AWBConsolDetail", meaning: "Per-house detail lines under the master" },
  { table: "AWBSplit", meaning: "Split lineage — SplitId, SplitClassId, parent HWBNo" },
  { table: "AWBTRANSFER", meaning: "A house transferred out keeps its consolidation lineage" },
  { table: "AWBARRIVALADVICE", meaning: "Arrival advice is raised per house, not per master" },
];

/**
 * The `AWBConsolDetail` line beneath a house, derived from the house itself.
 *
 * Two things about this are deliberate and easy to "fix" wrongly.
 *
 * First, `GROSSWEIGHT` reads the house's own `WEIGHT`. The column exists on
 * the detail table precisely so the gross figure survives next to
 * `CHARGEDWEIGH` — volumetric uplift means the chargeable weight is routinely
 * the larger of the two, and once the master is broken down it is the gross
 * that has to be reconcilable against what came off the aircraft. Deriving a
 * second, *different* gross here would fabricate a house-level discrepancy
 * that no other fixture records and that no operator could resolve.
 *
 * Second, `UNIQUEINDENTIFICATION` carries the same correlator value as
 * `AWBCONSOLE.UniqueIdentification` under a different spelling. That is the
 * whole parity point: CMTS writes the extra N on this table and not on the
 * others, so the value travels and the column name does not. Screens that
 * quietly reuse one spelling for both tables are how a migration mapping goes
 * missing without anything looking wrong.
 *
 * Only these two columns of the thirteen are modelled — including whatever
 * column links the line back to its parent house — so the pairing below is
 * positional, and the card says so rather than implying a key it does not have.
 */
function consolDetailOf(h: HouseAWB): AWBConsolDetail {
  return {
    GROSSWEIGHT: h.WEIGHT,
    UNIQUEINDENTIFICATION: h.UniqueIdentification,
  };
}

export default function ConsolidationPage() {
  const { scope } = useSite();
  const consolidations = useMemo(() => listAwbs({ scope }).filter((a) => a.IsHwb), [scope]);
  const [awbId, setAwbId] = useState<number>(consolidations[0]?.AWBId ?? 0);
  const master = consolidations.find((a) => a.AWBId === awbId) ?? consolidations[0];

  const houses = useMemo(
    () => (master ? HOUSE_AWBS.filter((h) => h.AWBNO === master.AWBNO) : []),
    [master],
  );

  if (!master) {
    return (
      <div className="flex flex-col gap-6">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "Consolidation & Split" }]} />
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-8 text-center">
          <p className="text-[14px] font-semibold text-[#0F172A]">
            No consolidations at {scope}
          </p>
          <p className="text-[13px] text-[#64748B] mt-1">
            A consolidation is an AWB with IsHwb set. Switch site in the header to find one.
          </p>
        </div>
      </div>
    );
  }

  const housePcs = houses.reduce((n, h) => n + h.PCS, 0);
  const houseKg = round2(houses.reduce((n, h) => n + h.WEIGHT, 0));
  const pcsReconciled = housePcs === master.TOTALPCS;
  const kgReconciled = Math.abs(houseKg - master.TOTALWEIGHT) < 1;
  const reconciled = pcsReconciled && kgReconciled;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Import Documentation" }, { label: "Consolidation & Split" }]} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M03
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                FC-01 §11
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
              Consolidation &amp; Split
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Break a master AWB into house AWBs, each independently stored, charged and delivered.
            </p>
          </div>
          <div className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              Consolidations ({consolidations.length})
            </span>
            <select
              value={awbId}
              onChange={(e) => setAwbId(Number(e.target.value))}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] outline-none cursor-pointer font-mono"
            >
              {consolidations.map((a) => (
                <option key={a.AWBId} value={a.AWBId}>
                  {a.AWBNO}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(
          [
            ["Open MAWBs", 12],
            ["Total HAWBs", 47],
            ["Split records", 8],
          ] as const
        ).map(([label, value]) => (
          <div
            key={label}
            className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-1"
          >
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
              {label}
            </span>
            <span className="text-[24px] font-bold text-[#0F172A] font-mono">{value}</span>
          </div>
        ))}
      </div>

      {/* The create verb.
       *
       * This screen could split a master and merge houses, but it had no way to
       * BUILD a consolidation — so the common import case of several houses
       * arriving loose under one master, assembled at the shed, was not
       * expressible at all. Split and merge both assume an AWBCONSOLE parent
       * already exists; this is the action that writes one. CMTS seeds
       * AWBCONSOLE at indexation, which is why the button sits above the
       * master rather than inside the split workbench. */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          className="h-9 px-3 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold inline-flex items-center gap-1.5"
        >
          <Plus size={14} />
          New consolidation
        </button>
        <span className="text-[12px] text-[#94A3B8]">
          Builds an AWBCONSOLE parent from loose house AWBs — each house then takes its own
          sub-index, class, location and sub-DO.
        </span>
      </div>

      {/* Master vs houses reconciliation */}
      <div
        className="rounded-[16px] border p-5"
        style={{
          borderColor: reconciled ? "#BBF7D0" : "#FDE68A",
          backgroundColor: reconciled ? "#F0FDF4" : "#FFFBEB",
        }}
      >
        <div className="flex items-start gap-3">
          {reconciled ? (
            <Check size={18} className="text-[#16A34A] flex-shrink-0 mt-0.5" strokeWidth={2.5} />
          ) : (
            <AlertTriangle size={18} className="text-[#D97706] flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <p
              className="text-[14px] font-semibold"
              style={{ color: reconciled ? "#16A34A" : "#D97706" }}
            >
              {reconciled
                ? "House totals reconcile against the master"
                : "House totals do not reconcile against the master"}
            </p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3">
              {[
                ["Master pieces", master.TOTALPCS, ""],
                ["House pieces", housePcs, pcsReconciled ? "ok" : "bad"],
                ["Master weight", formatKg(master.TOTALWEIGHT), ""],
                ["House weight", formatKg(houseKg), kgReconciled ? "ok" : "bad"],
              ].map(([l, v, tone]) => (
                <div key={String(l)} className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    {l}
                  </span>
                  <span
                    className="text-[16px] font-bold font-mono"
                    style={{ color: tone === "bad" ? "#DC2626" : tone === "ok" ? "#16A34A" : "#0F172A" }}
                  >
                    {v}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Master AWB */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">Master AWB</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              SHIPMENTTYPE {master.SHIPMENTTYPE} · IsHwb set at indexing
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Consolidated vs single-HAWB.
             *
             * IsHwb alone cannot tell these apart — a master carrying exactly
             * one house has the same record shape as a three-house consol but
             * needs no deconsolidation charge and no house-level segregation,
             * so the operator has to see which one is on screen before acting.
             * The house count is the only thing that distinguishes them. */}
            <span
              className="h-7 px-3 rounded-full text-[12px] font-semibold inline-flex items-center"
              style={{
                backgroundColor: houses.length > 1 ? "#DBEAFE" : "#F1F5F9",
                color: houses.length > 1 ? "#1B4F8B" : "#64748B",
              }}
            >
              {houses.length > 1 ? `Consolidated · ${houses.length} HAWBs` : "Single HAWB"}
            </span>
            <AwbLink
              awbNo={master.AWBNO}
              awbId={master.AWBId}
              className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] font-mono font-semibold text-[#1B4F8B] no-underline inline-flex items-center"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-x-5 gap-y-4 mt-4">
          {/* Carrier and origin are read off the AWB, not hard-coded. They were
              fixed strings here, so every master on every site claimed to be an
              Emirates shipment out of DXB — which matters on this screen more
              than most: houses under one master share a carrier and an origin,
              and that is exactly what makes them consolidatable. */}
          {[
            ["IGM", master.IGMNO],
            ["Flight", master.FLIGHT],
            ["Carrier", master.AIRLINENAME],
            ["Origin", master.ORIGIN],
            ["Class", cargoClass(master.CARGOCLASSID).ABBREVATION],
            ["Consignee", master.CONSIGNEE1],
            ["Agent", master.AGENT1 ?? "—"],
          ].map(([l, v]) => (
            <div key={l} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {l}
              </span>
              <span className="text-[13px] font-medium text-[#0F172A] truncate">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* House AWBs — AWBCONSOLE 41 columns */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            House AWBs ({houses.length})
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            CMTS AWBCONSOLE — 41 columns. Each house carries its own class, subclass, location,
            parties, sub-DO and delivery state.
          </p>
        </div>

        <div className="p-5 flex flex-col gap-4">
          {houses.map((h, idx) => {
            const loc = storageLocation(h.LOCATIONID);
            // Mock split lineage: house AWBs after the first are treated as
            // split children of the first house (AWBSplit HWBNo → parent HWB).
            const splitParent = idx > 0 ? houses[0].HWB : null;
            return (
              <div key={h.ConsolId} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[13px] font-bold text-[#0F172A]">{h.HWB}</span>
                    <span className="text-[12px] text-[#64748B]">sub-index {h.SUBINDEX}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {splitParent && (
                      <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center gap-1 bg-[#EDE9FE] text-[#6D28D9] font-mono">
                        <Split size={10} strokeWidth={2.5} />
                        Split of {splitParent}
                      </span>
                    )}
                    {h.DELIVERED === 1 && (
                      <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#DCFCE7] text-[#16A34A]">
                        delivered
                      </span>
                    )}
                    {h.HOLDINGSTATUS && (
                      <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#FEF3C7] text-[#D97706]">
                        on hold
                      </span>
                    )}
                    {h.SUBDONO && (
                      <span className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center bg-[#DBEAFE] text-[#1B4F8B] font-mono">
                        {h.SUBDONO}
                      </span>
                    )}
                  </div>
                </div>

                <div className="p-4 grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-x-5 gap-y-4">
                  {(
                    [
                      ["PCS", h.PCS],
                      ["WEIGHT", formatKg(h.WEIGHT)],
                      ["CHARGEDWEIGH", formatKg(h.CHARGEDWEIGH)],
                      ["CARGOCLASSID", cargoClass(h.CARGOCLASSID).ABBREVATION],
                      ["CARGOSUBCLASSID", cargoSubClass(h.CARGOSUBCLASSID).ABBREVATION],
                      ["LOCATIONID", loc?.ABBREVATION ?? "—"],
                      ["CONTENTS", h.CONTENTS],
                      ["PHYSICALSTATUS", h.PHYSICALSTATUS],
                      ["UniqueIdentification", h.UniqueIdentification],
                      ["IsLock", h.IsLock ? "Yes" : "No"],
                      ["DetendIdentification", h.DetendIdentification ?? "—"],
                      ["DFLAG", h.DFLAG ?? "—"],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-0.5">
                      <span className="text-[9px] font-mono text-[#CBD5E1] truncate">{k}</span>
                      <span className="text-[13px] font-medium text-[#0F172A] truncate">{v}</span>
                    </div>
                  ))}
                </div>

                <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                  {(
                    [
                      ["Shipper", [h.SHIPPER1, h.SHIPPER2, h.SHIPPER3], h.SHIPPERADD],
                      ["Consignee", [h.CONSIGNEE1, h.CONSIGNEE2, h.CONSIGNEE3], h.CONSIGNEEADD],
                      ["Agent", [h.AGENT1, h.AGENT2, h.AGENT3], h.AGENTADD],
                    ] as const
                  ).map(([label, lines, addr]) => (
                    <div key={label} className="rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] p-3">
                      <span className="text-[10px] font-semibold text-[#64748B] uppercase tracking-wider">
                        {label}
                      </span>
                      {lines.filter(Boolean).map((l, i) => (
                        <p
                          key={i}
                          className={`text-[12px] ${i === 0 ? "font-semibold text-[#0F172A]" : "text-[#64748B]"}`}
                        >
                          {l}
                        </p>
                      ))}
                      {addr && <p className="text-[11px] text-[#94A3B8] mt-1">{addr}</p>}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail lines — AWBConsolDetail, the table named in the source list
          above that had nothing rendered behind it. Kept as its own card
          rather than folded into the house grid because it is a different
          table: the gross weight and the correlator below are written per
          detail line, not on the AWBCONSOLE row they sit under. */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Detail lines ({houses.length})
          </h3>
          <p className="text-[11px] text-[#94A3B8] mt-0.5">
            CMTS AWBConsolDetail — the gross weight the house was received at, against the
            chargeable weight it will be billed on, plus the consignment correlator under this
            table&rsquo;s own spelling.
          </p>
        </div>
        {houses.length === 0 ? (
          <p className="px-5 py-4 text-[13px] text-[#64748B]">
            No houses under this master, so no detail lines.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider bg-[#F8FAFC] border-b border-[#E2E8F0]">
                  <th className="text-left px-4 py-2.5">
                    House <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">AWBCONSOLE.HWB</span>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    Gross weight{" "}
                    <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">GROSSWEIGHT</span>
                  </th>
                  <th className="text-right px-4 py-2.5">
                    Chargeable{" "}
                    <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">
                      AWBCONSOLE.CHARGEDWEIGH
                    </span>
                  </th>
                  <th className="text-left px-4 py-2.5">
                    Correlator{" "}
                    <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">
                      UNIQUEINDENTIFICATION
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {houses.map((h) => {
                  const d = consolDetailOf(h);
                  // Volumetric uplift: the chargeable weight above the gross is
                  // the norm, not an error, so it is toned as information.
                  const uplift = round2(h.CHARGEDWEIGH - (d.GROSSWEIGHT ?? h.CHARGEDWEIGH));
                  return (
                    <tr key={h.ConsolId} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                      <td className="px-4 py-2.5 font-mono font-semibold">{h.HWB}</td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {d.GROSSWEIGHT === null ? (
                          <span className="text-[#CBD5E1]">—</span>
                        ) : (
                          formatKg(d.GROSSWEIGHT)
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right font-mono">
                        {formatKg(h.CHARGEDWEIGH)}
                        {uplift > 0 && (
                          <span className="ml-1.5 text-[11px] text-[#94A3B8]">
                            +{formatKg(uplift)} vol
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 font-mono text-[12px] text-[#64748B]">
                        {d.UNIQUEINDENTIFICATION ?? <span className="text-[#CBD5E1]">—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <p className="text-[11px] text-[#64748B]">
            Two of AWBConsolDetail&rsquo;s thirteen columns are modelled — the eleven whose names
            have not been read off the schema restore are absent rather than guessed, and that
            includes the column carrying the link back to the parent house. Each line is therefore
            shown against the house it was built from, not against a key.{" "}
            <span className="font-mono">UNIQUEINDENTIFICATION</span> spells the correlator with the
            extra N because this table does; <span className="font-mono">UniqueIdentification</span>{" "}
            on the house above is a different column carrying the same value.
          </p>
        </div>
      </div>

      {/* Split workbench */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6">
        <div className="flex items-center justify-between gap-2 mb-1 flex-wrap">
          <div className="flex items-center gap-2">
            <Split size={16} className="text-[#64748B]" />
            <h2 className="text-[16px] font-semibold text-[#0F172A]">Split workbench</h2>
          </div>
          <button
            type="button"
            className="h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] inline-flex items-center gap-1.5"
          >
            <Merge size={14} className="text-[#64748B]" />
            Merge HAWBs
          </button>
        </div>
        <p className="text-[13px] text-[#64748B]">
          Split an AWB or house AWB into separately-handled parts. Each split gets its own SplitId
          and SplitClassId, and becomes independently chargeable at Phase 5.
        </p>

        <div className="rounded-xl border border-dashed border-[#CBD5E1] bg-[#F8FAFC] p-5 mt-5">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {[
              ["Source", master.AWBNO],
              ["Available pieces", String(master.TOTALPCS)],
              ["Available weight", formatKg(master.TOTALWEIGHT)],
              ["Split by", "Pieces / weight"],
              ["New class", "Inherits, override per split"],
            ].map(([l, v]) => (
              <div key={l} className="flex flex-col gap-1">
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                  {l}
                </span>
                <span className="text-[13px] font-medium text-[#0F172A]">{v}</span>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#94A3B8] mt-4">
            CMTS AWBSplit — SplitId, ID, IGMNo, AWBNo, HWBNo, Pcs, Weight, ChargeWeight,
            ConsigneeName, UniqueIdentification. SplitClassId then follows onto IMPORTAWBDETAIL and
            IMPORTAWBLOCATION.
          </p>
        </div>
      </div>

      {/* CMTS source tables — see CMTS_SOURCE_TABLES above for why AWBTRANSFER
          and AWBARRIVALADVICE belong on this screen. */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Database size={15} className="text-[#64748B]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">CMTS source tables</h3>
            <p className="text-[11px] text-[#94A3B8]">
              What this screen absorbs from the legacy AWB consolidation &amp; split module
            </p>
          </div>
        </div>
        <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-x-5 gap-y-2.5">
          {CMTS_SOURCE_TABLES.map((t) => (
            <div key={t.table} className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] font-semibold text-[#1B4F8B] flex-shrink-0">
                {t.table}
              </span>
              <span className="text-[11px] text-[#64748B]">{t.meaning}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/import/acceptance"
          className="h-10 px-4 rounded-lg border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] no-underline inline-flex items-center"
        >
          Back to acceptance
        </Link>
        <Link
          href="/warehouse-manager/storage-map"
          className="h-10 px-4 rounded-lg bg-[#0B2545] text-white text-[13px] font-semibold no-underline inline-flex items-center"
        >
          Allocate house storage
        </Link>
      </div>
    </div>
  );
}
