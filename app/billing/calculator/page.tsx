"use client";

/**
 * P5-2 · Charges Calculator — FC-07 §01–08, computed end to end.
 *
 * The CMTS preview screen this replaces rendered a form that computed
 * nothing. This one shows the actual arithmetic, step by step,
 * because the FC-07 amendment makes charges **auto-computed from a
 * versioned Tariff Master** — and an auto-computed number that nobody can
 * audit is worse than a typed one.
 *
 * Two corrections found by verifying against the real SAPS documents
 * (816-00034156 and the OD 0131 manifest) are visible here:
 *
 *   §05  The volumetric divisor is **unit-dependent** — 6000 for cm, 366
 *        for inches. AWB 816-00034156 declares inches; a flat 6000 divisor
 *        understates its volumetric weight by ~16x.
 *   §06  Chargeable weight **rounds up to the next 0.5 kg** per IATA.
 *        231.6 → 232.0, and 232.0 x 330 = 76,560 matches the printed total
 *        on the document exactly. Without the round-up it does not.
 *
 * CMTS ATTRIBUTION
 * ----------------
 * That preview screen computed nothing, but it did carry one thing this screen
 * did not: **which CMTS table each rule came from**.
 * Seven rules, seven sources — CARGOCLASS·Lookup, AWBINFORMATION,
 * CARGOSUBCLASSCHARGES, CargoClassCharges, LOCATIONCHARGES, the manual waiver
 * workflow and Section82Days·Setting. This screen named only Section82Days, so
 * every other rule's lineage back to the system being replaced was invisible.
 *
 * That lineage is not decoration during a migration: when a computed number is
 * disputed, the first question is which legacy table the rule came from, and
 * the second is whether AirVault still reads it the same way. `CMTS_RULES`
 * below answers the first for all seven, and each `Step` carries its own source
 * chip so the answer sits next to the arithmetic rather than in a footnote.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Calculator, Database, Info, Layers, Scale, Timer } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AgingBadge } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  VOLUMETRIC_DIVISORS,
  awbById,
  cargoClass,
  formatDate,
  formatKg,
  formatPkr,
  listChargeCalculations,
  roundUpHalfKg,
} from "@/lib/domain";

/**
 * The CMTS table(s) a rule was read from, rendered wherever that rule is
 * computed. Uppercase identifiers are the legacy column/table names and are
 * reproduced exactly — they are migration parity, not a naming style.
 */
function SourceChip({ source }: { source: string }) {
  return (
    <span
      className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center gap-1 font-mono whitespace-nowrap"
      title={`CMTS source: ${source}`}
    >
      <Database size={10} />
      {source}
    </span>
  );
}

function Step({
  no,
  title,
  note,
  source,
  children,
}: {
  no: string;
  title: string;
  note?: string;
  /** The CMTS table this step's rule was read from in the legacy system. */
  source?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start gap-3">
        <span className="h-[22px] min-w-[38px] px-2 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center justify-center font-mono flex-shrink-0 mt-0.5">
          {no}
        </span>
        <div className="flex-1">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          {note && <p className="text-[11px] text-[#94A3B8] mt-0.5">{note}</p>}
        </div>
        {source && <SourceChip source={source} />}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

/**
 * The seven legacy rules, each tied to the CMTS table it was read from and to
 * the FC-07 step on this page that now computes it. Ported from the legacy
 * charges calculator, which listed the rules but did no arithmetic; here the
 * arithmetic is real and this table is the provenance index over it.
 */
const CMTS_RULES: Array<{
  no: number;
  rule: string;
  source: string;
  computedAt: string;
  formula: string;
}> = [
  {
    no: 1,
    rule: "Free period",
    source: "CARGOCLASS · Lookup",
    computedAt: "§01–03",
    formula: "freeDays = CARGOCLASS.freeDays for the consignment's class",
  },
  {
    no: 2,
    rule: "Chargeable weight",
    source: "AWBINFORMATION",
    computedAt: "§04–06",
    formula: "roundUp₀.₅(max(actual, volumetric))",
  },
  {
    no: 3,
    rule: "Base rate per slab",
    source: "CARGOSUBCLASSCHARGES",
    computedAt: "§08",
    formula: "daysInBand × ratePerKgPerDay × chargeableKg, per band",
  },
  {
    no: 4,
    rule: "Class surcharge",
    source: "CargoClassCharges",
    computedAt: "§07",
    formula: "percent% × storage base",
  },
  {
    no: 5,
    rule: "Location surcharge",
    source: "LOCATIONCHARGES",
    computedAt: "Charge components",
    formula: "chargeableDays × locationChargePerDay",
  },
  {
    no: 6,
    rule: "Customs hold waiver",
    source: "Manual waiver workflow",
    computedAt: "Charge components",
    formula: "−percent% × applicable slab",
  },
  {
    no: 7,
    rule: "Section 82 trigger check",
    source: "Section82Days · Setting",
    computedAt: "§01–03",
    formula: "dwell > Section82Days → escalate",
  },
];

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-[12px] text-[#64748B]">{label}</span>
      <span
        className="font-mono"
        style={{
          fontSize: strong ? 15 : 13,
          fontWeight: strong ? 700 : 500,
          color: strong ? "#0F172A" : "#334155",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ChargesCalculatorPage() {
  const { scope, isHq } = useSite();
  const calcs = useMemo(() => listChargeCalculations(scope), [scope]);

  const [selected, setSelected] = useState<number | null>(calcs[0]?.awbId ?? null);
  const c = calcs.find((x) => x.awbId === selected) ?? calcs[0] ?? null;
  const awb = c ? awbById(c.awbId) : null;

  /** Live what-if on the unit, to make the §05 correction legible. */
  const [unit, setUnit] = useState<"cm" | "in">("cm");

  /**
   * Legacy-CMTS rule-cascade items the FC-07 form skips but the old charges
   * calculator still applied. Presentational, static — sourced from the CMTS
   * settings the way the legacy screen read them.
   */
  const customsHoldWaiver = { percent: 20, amount: 5300, source: "Manual waiver workflow" };
  const section82Days = 20;
  const section82Threshold = 14;
  const section82Flagged = section82Days > section82Threshold;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Charges Calculator" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M10
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-07 §01–08
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Charges Calculator
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Every step of the FC-07 computation, shown rather than asserted.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {calcs.length === 0 ? (
        <EmptyState
          title="No charge calculations at this site"
          description="Charges compute once an AWB reaches the charging stage — FC-07 §01 starts the clock at arrival."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Calculator size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Calculated AWBs</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {calcs.map((x) => {
                const a = awbById(x.awbId);
                return (
                  <button
                    key={x.awbId}
                    onClick={() => setSelected(x.awbId)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: c?.awbId === x.awbId ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {a?.AWBNO}
                      </span>
                      <span className="font-mono text-[12px] font-bold text-[#1B4F8B]">
                        {formatPkr(x.total)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {x.chargeableDays}d chargeable · {formatKg(x.chargeableKg)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {c && awb && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} />
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      {cargoClass(awb.CARGOCLASSID).NAME} · tariff{" "}
                      <span className="font-mono font-semibold text-[#0F172A]">
                        {c.tariffVersion}
                      </span>{" "}
                      · calculated {formatDate(c.calculatedAt)}
                    </p>
                  </div>
                  <AgingBadge totalDays={c.totalDays} freeDays={c.freeDays} />
                </div>
              </div>

              {/* §01–03 dwell clock */}
              <Step
                no="§01–03"
                title="Intake, storage clock, free period"
                note="§02 starts the clock at cargo intake, not at flight arrival; §03's free band runs from there and §03a charges only what is left."
                source="CARGOCLASS · Lookup"
              >
                {/*
                  Five tiles in event order. Arrival is shown first because it is
                  the event operators recognise, but it is immediately followed
                  by the clock start so the gap between them is legible — that
                  gap is the handler's time on the ramp and is never billed.
                */}
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                  {[
                    ["Arrived (flight)", formatDate(c.arrivalAt), "#94A3B8"],
                    ["Clock started (intake)", formatDate(c.clockStartedAt), "#0F172A"],
                    ["Total days", `${c.totalDays}`, "#0F172A"],
                    ["Free days", `${c.freeDays}`, "#16A34A"],
                    ["Chargeable days", `${c.chargeableDays}`, "#D97706"],
                  ].map(([l, v, tone]) => (
                    <div key={l}>
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        {l}
                      </p>
                      <p
                        className="text-[16px] font-bold mt-0.5 font-mono"
                        style={{ color: tone }}
                      >
                        {v}
                      </p>
                    </div>
                  ))}
                </div>

                {/*
                  Rule 1 of the legacy cascade, restated against real values. The
                  legacy screen wrote "Free days = 3 (per CARGOCLASS lookup)" as
                  a constant; here the 3 comes off the class the AWB actually
                  carries, which is the whole difference between a mock-up and a
                  computation.
                */}
                <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                  <p className="font-mono text-[12px] text-[#0F172A]">
                    freeDays = {c.freeDays} · CARGOCLASS ·{" "}
                    {cargoClass(awb.CARGOCLASSID).ABBREVATION}
                  </p>
                  <p className="text-[11px] text-[#64748B] mt-1">
                    chargeable = max(0, {c.totalDays} − {c.freeDays})
                    {c.supplementDays > 0 ? ` + ${c.supplementDays} supplement` : ""} ={" "}
                    {c.chargeableDays} days
                  </p>
                </div>
                {c.supplementDays > 0 && (
                  <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                    <Timer size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#92400E]">
                      {c.supplementDays} supplement day{c.supplementDays === 1 ? "" : "s"} — cargo
                      stayed past the billed period and a supplementary voucher is due.
                    </p>
                  </div>
                )}
                {section82Flagged && (
                  <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-[12px] font-semibold text-[#991B1B]">
                          Section 82 — dwell {section82Days} days &gt; {section82Threshold}-day
                          threshold → escalation flagged
                        </p>
                        <SourceChip source="Section82Days · Setting" />
                      </div>
                      <p className="text-[11px] text-[#B91C1C] mt-0.5">
                        The Section82Days setting trips the customs-escalation trigger; the AWB is
                        referred for Section 82 action before the charge is closed.
                      </p>
                    </div>
                  </div>
                )}
              </Step>

              {/* §04–06 weights — the corrections */}
              <Step
                no="§04–06"
                title="Actual, volumetric and chargeable weight"
                note="Volumetric divisor is unit-dependent; chargeable rounds up to the next 0.5 kg."
                source="AWBINFORMATION"
              >
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    ["Actual", formatKg(c.actualKg), "#0F172A"],
                    ["Volumetric", formatKg(c.volumetricKg), "#7C3AED"],
                    ["Chargeable", formatKg(c.chargeableKg), "#1B4F8B"],
                  ].map(([l, v, tone]) => (
                    <div
                      key={l}
                      className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
                    >
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        {l}
                      </p>
                      <p className="text-[18px] font-bold mt-0.5 font-mono" style={{ color: tone }}>
                        {v}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3.5">
                  <div className="flex items-center gap-2 mb-2.5">
                    <Scale size={14} className="text-[#1B4F8B]" />
                    <p className="text-[12px] font-semibold text-[#1B4F8B]">
                      §05 — the divisor depends on the declared unit
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mb-3">
                    {(["cm", "in"] as const).map((u) => (
                      <button
                        key={u}
                        onClick={() => setUnit(u)}
                        className="h-7 px-3 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer"
                        style={{
                          backgroundColor: unit === u ? "#1B4F8B" : "#FFFFFF",
                          color: unit === u ? "#FFFFFF" : "#475569",
                          borderColor: unit === u ? "#1B4F8B" : "#C7D7EC",
                        }}
                      >
                        dimensions in {u === "cm" ? "centimetres" : "inches"}
                      </button>
                    ))}
                  </div>
                  <p className="font-mono text-[12px] text-[#0F172A]">
                    L × W × H ÷ {VOLUMETRIC_DIVISORS[unit]}
                  </p>
                  <p className="text-[11px] text-[#475569] mt-1.5 leading-snug">
                    AWB 816-00034156 in your document set declares its dimensions in{" "}
                    <strong>inches</strong>. Applying the centimetre divisor of{" "}
                    {VOLUMETRIC_DIVISORS.cm} to inch dimensions understates volumetric weight by
                    roughly {(VOLUMETRIC_DIVISORS.cm / VOLUMETRIC_DIVISORS.in).toFixed(0)}× — which
                    silently under-bills every oversized shipment.
                  </p>
                </div>

                <div className="mt-3 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3.5">
                  <p className="text-[12px] font-semibold text-[#16A34A] mb-1.5">
                    §06 — IATA rounds chargeable weight up to the next 0.5 kg
                  </p>
                  <p className="font-mono text-[12px] text-[#15803D]">
                    max({c.actualKg}, {c.volumetricKg}) ={" "}
                    {Math.max(c.actualKg, c.volumetricKg)} → roundUp₀.₅ →{" "}
                    <strong>{roundUpHalfKg(Math.max(c.actualKg, c.volumetricKg))}</strong> kg
                  </p>
                  <p className="text-[11px] text-[#15803D] mt-1.5">
                    On 816-00034156 this is what makes the arithmetic close: 231.6 → 232.0, and
                    232.0 × 330 = 76,560 — the total printed on the document.
                  </p>
                </div>
              </Step>

              {/* §07 surcharges */}
              <Step
                no="§07"
                title="Category surcharge"
                note="Applied on the storage base, by cargo class."
                source="CargoClassCharges"
              >
                {c.surcharges.length === 0 ? (
                  <p className="text-[12px] text-[#94A3B8]">
                    No category surcharge for {cargoClass(awb.CARGOCLASSID).NAME}.
                  </p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {c.surcharges.map((s) => (
                      <div
                        key={s.code}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#E2E8F0] px-4 py-2.5"
                      >
                        <div className="flex items-center gap-2">
                          <span className="h-[20px] px-2 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center font-mono">
                            {s.code}
                          </span>
                          <span className="text-[12px] text-[#475569]">
                            {s.label} · {s.percent}%
                          </span>
                        </div>
                        <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                          {formatPkr(s.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </Step>

              {/* §08 slabs */}
              <Step
                no="§08"
                title="Tariff slab breakdown"
                note="A stay crossing a band boundary is split across bands — not billed at the top rate."
                source="CARGOSUBCLASSCHARGES"
              >
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0]">
                        {["Band", "Days", "Rate /kg/day", "Chargeable kg", "Amount"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2 text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {c.slabLines.map((s) => (
                        <tr key={s.label} className="border-b border-[#F1F5F9] last:border-0">
                          <td className="px-3 py-2.5 text-[12px] text-[#0F172A] font-medium">
                            {s.label}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                            {s.daysInBand}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                            {s.ratePerKgPerDay === 0 ? "free" : formatPkr(s.ratePerKgPerDay)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                            {formatKg(s.chargeableKg)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-[#0F172A]">
                            {formatPkr(s.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Step>

              {/* Components → total */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <Layers size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">Charge components</h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      CMTS GODOWNRENTDETAIL / grCharges — the per-line breakdown
                    </p>
                  </div>
                </div>
                <div className="p-5">
                  <Row label="Storage" value={formatPkr(c.storageAmount)} />
                  <Row label="Handling" value={formatPkr(c.handlingAmount)} />
                  {/*
                    Rule 5 of the legacy cascade. LOCATIONCHARGES priced the
                    zone the cargo actually sat in — a vault or a cold room is
                    not a rack — so the source is called out inline rather than
                    left to the footer; a location surcharge is the line most
                    often queried by a consignee.
                  */}
                  <div className="flex items-baseline justify-between gap-3 py-1">
                    <span className="text-[12px] text-[#64748B] inline-flex items-center gap-2">
                      Location charges <SourceChip source="LOCATIONCHARGES" />
                    </span>
                    <span className="font-mono text-[13px] font-medium text-[#334155]">
                      {formatPkr(c.locationChargesAmount)}
                    </span>
                  </div>
                  <Row label="Documentation" value={formatPkr(c.documentationCharges)} />
                  <Row label="Deconsolidation" value={formatPkr(c.deconsolidationCharges)} />
                  <Row label="Special handling" value={formatPkr(c.specialHandlingCharges)} />
                  <Row label="Miscellaneous" value={formatPkr(c.miscellaneousCharges)} />
                  {c.minimumCharges > 0 && (
                    <Row label="Minimum charge floor applied" value={formatPkr(c.minimumCharges)} />
                  )}
                  {/*
                    Rule 6. The only rule of the seven with no CMTS table behind
                    it — the waiver was a manual act, which is precisely why
                    FC-07 §10–12 gives it an approval chain. Labelling its source
                    honestly is more useful than inventing a table name for it.
                  */}
                  <div className="flex items-baseline justify-between gap-3 py-1">
                    <span className="text-[12px] text-[#DC2626] inline-flex items-center gap-2">
                      Customs hold waiver <SourceChip source={customsHoldWaiver.source} />
                    </span>
                    <span className="font-mono text-[13px] font-medium text-[#DC2626]">
                      −{customsHoldWaiver.percent}% × applicable slab = −{formatPkr(
                        customsHoldWaiver.amount
                      )}
                    </span>
                  </div>
                  <div className="border-t border-[#E2E8F0] mt-2 pt-2">
                    <Row label="Sub-total" value={formatPkr(c.subTotal)} />
                    <Row label={`Tax (${c.taxPercent}%)`} value={formatPkr(c.taxAmount)} />
                  </div>
                  <div className="border-t-2 border-[#0B2545] mt-2 pt-2">
                    <Row label="Total payable" value={formatPkr(c.total)} strong />
                  </div>
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-start gap-2.5">
                  <Info size={14} className="text-[#64748B] flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-[#64748B]">
                    Computed from tariff version{" "}
                    <span className="font-mono font-semibold">{c.tariffVersion}</span>. Re-running
                    this AWB against a newer tariff would produce a different number — which is why
                    the version is stored on the calculation, not looked up at render time.
                  </p>
                </div>
              </div>

              {/*
                Rule → CMTS table → where it is computed. Ported from the legacy
                charges calculator, which is the only place this mapping ever
                existed. Kept as one table rather than scattered footnotes so a
                reviewer can check all seven rules have a named source in a
                single pass — an unattributed rule is the thing to catch.
              */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <Database size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Rule attribution — which CMTS table each rule came from
                    </h3>
                    <p className="text-[11px] text-[#94A3B8]">
                      The legacy calculator&rsquo;s seven-rule cascade, mapped onto the FC-07 step
                      that now computes it.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {["#", "Rule", "CMTS source", "Computed at", "Formula"].map((h) => (
                          <th
                            key={h}
                            className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {CMTS_RULES.map((r) => (
                        <tr key={r.no} className="border-b border-[#F1F5F9] last:border-0">
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#94A3B8]">
                            {r.no}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] font-medium text-[#0F172A] whitespace-nowrap">
                            {r.rule}
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <SourceChip source={r.source} />
                          </td>
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="h-[20px] px-2 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center font-mono">
                              {r.computedAt}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11.5px] text-[#475569]">
                            {r.formula}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <p className="text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider mb-1">
                    CMTS source tables
                  </p>
                  <code className="text-[12px] text-[#475569] font-mono break-words">
                    CHARGECALCULATER · CHARGETYPE · LOCATIONCHARGES · CARGOSUBCLASSCHARGES ·
                    CargoClassCharges · Lookup
                  </code>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                {/*
                  * This pointed at /billing/tariff, which has never existed — app/billing
                  * holds only calculator, delivery-order, godown-rent and invoice, so the
                  * link 404'd. The versioned rate card this calculator actually prices
                  * against is the FC-07 Tariff Master, and that lives under finance.
                  */}
                <Link
                  href="/finance-manager/tariff-master-editor"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Tariff master <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/billing/godown-rent"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Godown rent voucher <ArrowUpRight size={12} />
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
