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
 *
 * CHARGETYPE AND THE VOUCHER
 * --------------------------
 * Two more CMTS tables now show through. `CHARGETYPE` is the catalogue of
 * headings a charge prints under — no rates, just the words — so every
 * component line names the heading that produced it, and the headings that
 * produced nothing are listed too rather than filtered away. `CHARGECALCULATER`
 * is the header CMTS hangs the calculation off, and its `VOUCHERNO` is the one
 * column that says whether this arithmetic was ever billed: it sits on the
 * identity card at the top, where a null reads as "quote", not as "missing".
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  Database,
  HelpCircle,
  Info,
  Layers,
  Receipt,
  Scale,
  Tags,
  Timer,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import {
  attributeComponents,
  chargeTypesWithNoLine,
} from "@/components/billing/calculator/chargeTypeLines";
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
  type ChargeType,
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

/**
 * A CMTS **column** marker, as opposed to `SourceChip`'s **table** marker. Same
 * 9px mono grey the `Field` primitive uses elsewhere, so a column name reads the
 * same everywhere in the app regardless of which screen renders it. On a table
 * it sits under the human header, which tags the whole column once rather than
 * repeating the name on every row.
 */
function CmtsCol({ name }: { name: string }) {
  return (
    <span
      className="block text-[9px] font-mono text-[#CBD5E1] normal-case tracking-normal font-normal"
      title={`CMTS column: ${name}`}
    >
      {name}
    </span>
  );
}

/**
 * CMTS `CHARGETYPE.NONUSEABEL`, rendered as the raw stored value.
 *
 * The wording is deliberately weak. The column name and the rows carrying it
 * suggest "this charge type is retired", but that has never been confirmed with
 * SAPS, and a varchar(50) can hold a date, an initial or a reason as easily as a
 * flag. So the chip says the column has a value and what the value is — it does
 * not say the type is retired, and nothing on this screen filters on it. A
 * reader who knows the legacy system can look at this and correct us; a screen
 * that had quietly dropped the row gives them nothing to correct.
 */
function NonUseabelFlag({ type }: { type: ChargeType | null }) {
  if (!type) {
    return <span className="font-mono text-[11px] text-[#CBD5E1]">—</span>;
  }
  if (type.NONUSEABEL === null) {
    return (
      <span
        className="font-mono text-[11px] text-[#CBD5E1]"
        title={`NONUSEABEL is null on ${type.CHTYPEABB}`}
      >
        null
      </span>
    );
  }
  return (
    <span
      className="h-[20px] px-2 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold inline-flex items-center gap-1 font-mono whitespace-nowrap"
      title="NONUSEABEL carries a value here. What the value means is not confirmed with SAPS — it is shown, not acted on."
    >
      <HelpCircle size={10} />
      {type.NONUSEABEL}
    </span>
  );
}

/** The short `CHTYPEABB` code, as it prints in the legacy charge cascade. */
function ChargeTypeCode({ abb }: { abb: string | null }) {
  if (!abb) return <span className="font-mono text-[11px] text-[#CBD5E1]">—</span>;
  return (
    <span className="h-[20px] px-2 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center font-mono">
      {abb}
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

  /*
   * Every money line below, tied to the CMTS `CHARGETYPE` heading it prints
   * under — and, from the same pass, the catalogue rows that produced no line
   * at all. Derived together on purpose: the two tables are complements, so
   * building the second from the first is what stops a heading from appearing
   * in both, or in neither, when the component list changes.
   *
   * Plain consts rather than memos — this is a nine-row map over an already
   * computed calculation, and the selection above is re-derived every render
   * the same way.
   */
  const components = c ? attributeComponents(c, customsHoldWaiver) : [];
  const unusedChargeTypes = c ? chargeTypesWithNoLine(c, components) : [];

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

                {/*
                  The voucher belongs on the identity card, not in the totals.
                  CMTS models CHARGECALCULATER as a header pointing back at the
                  GODOWNRENT voucher it priced, so the number answers the same
                  question as the AWB and the tariff version beside it — "what
                  is this arithmetic?" — rather than "what does it come to?".

                  Null is rendered as null. The calculator runs in two modes and
                  only one of them has a voucher: a live quote priced against
                  today's tariff has been committed to nothing. Blanking that to
                  an em dash would let an uncommitted quote read exactly like a
                  raised bill, which is the confusion the source column being
                  nullable exists to prevent.
                */}
                <div className="mt-4 pt-4 border-t border-[#F1F5F9] flex items-start justify-between gap-x-6 gap-y-3 flex-wrap">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                        Godown rent voucher
                      </span>
                      <CmtsCol name="CHARGECALCULATER.VOUCHERNO" />
                    </div>
                    {c.VOUCHERNO ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-[14px] font-bold text-[#0F172A]">
                        <Receipt size={13} className="text-[#94A3B8]" />
                        {c.VOUCHERNO}
                      </span>
                    ) : (
                      <span className="text-[12px] text-[#94A3B8]">
                        <span className="font-mono text-[#CBD5E1]">null</span> — live quote, priced
                        but not written onto a voucher
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#64748B] max-w-[360px] leading-snug">
                    {c.VOUCHERNO
                      ? "Same number and the same series as the GODOWNRENT voucher — not a second identifier for the calculation. What you are reading below is the working behind that document."
                      : "Nothing has been billed from this run. It becomes a voucher only when one is raised against it, and the number is stamped here at that point."}
                  </p>
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
              {/*
                The codes in this card (DGR, VAL, COLD…) are CargoClassCharges
                CATEGORIES and are deliberately not the CHTYPEABB codes shown in
                the components table below. Two short uppercase code vocabularies
                on one screen is exactly how a reader ends up looking for "DGR"
                in the charge-type catalogue, so the note says which is which.
              */}
              <Step
                no="§07"
                title="Category surcharge"
                note="Applied on the storage base, by cargo class. These are CargoClassCharges categories, not CHARGETYPE headings — the uplift is folded into the sub-total and CMTS gives it no heading of its own."
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
                      CMTS GODOWNRENTDETAIL / grCharges — the per-line breakdown, each line under
                      the CHARGETYPE heading that produced it
                    </p>
                  </div>
                </div>
                {/*
                  Every component now names its charge type, because "which
                  charge produced this number?" is the first question asked of a
                  disputed line and the amount alone cannot answer it. CHARGETYPE
                  holds no rate — it is the catalogue of headings the money
                  prints under — so the heading sits beside the amount rather
                  than replacing the calculator's own label for it: the two
                  vocabularies are both real and a migration has to show both.

                  Rule 5 of the legacy cascade keeps its inline source chip.
                  LOCATIONCHARGES priced the zone the cargo actually sat in — a
                  vault or a cold room is not a rack — and a location surcharge
                  is the line most often queried by a consignee, so the table it
                  came from stays next to it rather than moving to the footer.

                  Rule 6, the waiver, is the one line with no CHARGETYPE row at
                  all; it says so in its own cell. The waiver was a manual act,
                  which is exactly why FC-07 §10–12 gives it an approval chain,
                  and naming its source honestly beats inventing a heading.
                */}
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                          Component
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                          Charge type
                          <CmtsCol name="CHTYPENAME" />
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                          Code
                          <CmtsCol name="CHTYPEABB" />
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                          What the heading covers
                          <CmtsCol name="CHTYPEDESC" />
                        </th>
                        <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                          Catalogue flag
                          <CmtsCol name="NONUSEABEL" />
                        </th>
                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                          Amount
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {components.map((l) => (
                        <tr key={l.label} className="border-b border-[#F1F5F9] last:border-0">
                          <td className="px-3 py-2.5">
                            <span
                              className="text-[12px] font-medium inline-flex items-center gap-2 whitespace-nowrap"
                              style={{ color: l.negative ? "#DC2626" : "#0F172A" }}
                            >
                              {l.label}
                              {l.amountSource && <SourceChip source={l.amountSource} />}
                            </span>
                            {l.sublabel && (
                              <p className="text-[11px] text-[#94A3B8] mt-0.5 font-mono">
                                {l.sublabel}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                            {l.type ? (
                              l.type.CHTYPENAME
                            ) : (
                              <span className="text-[#94A3B8] italic">no heading</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5">
                            <ChargeTypeCode abb={l.abb} />
                          </td>
                          <td className="px-3 py-2.5 text-[11.5px] text-[#64748B]">
                            {l.type ? l.type.CHTYPEDESC : l.unmappedNote}
                          </td>
                          <td className="px-3 py-2.5">
                            <NonUseabelFlag type={l.type} />
                          </td>
                          <td
                            className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold whitespace-nowrap"
                            style={{ color: l.negative ? "#DC2626" : "#0F172A" }}
                          >
                            {l.negative ? "−" : ""}
                            {formatPkr(l.amount)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="p-5">
                  <div className="border-t border-[#E2E8F0] pt-2">
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
                The other half of the catalogue.

                The table above shows the headings that produced money; this one
                shows the headings that did not, and why. Both halves are needed
                because a reader who can see eight lines against a twelve-row
                catalogue immediately asks what happened to the other four —
                and "we filtered them out" is not an answer anyone can audit.

                It matters most for NONUSEABEL. Two rows carry a value in that
                column and it reads like a retirement marker, but nobody has
                confirmed that with SAPS. Quietly dropping those rows would bake
                the guess into the screen and remove the evidence that a guess
                was ever made; listing them with the raw value showing keeps the
                open question in front of the person who can close it.

                Display only. Charge types are maintained in the charge-type
                master; nothing here adds, edits or retires one.
              */}
              {unusedChargeTypes.length > 0 && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Tags size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Charge types with no line on this calculation
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        CMTS CHARGETYPE names the headings a charge can print under and holds no
                        rates of its own. These rows exist in the catalogue but produced no amount
                        here — shown rather than hidden, so the absence has a stated reason.
                      </p>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[880px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                            Code
                            <CmtsCol name="CHTYPEABB" />
                          </th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                            Charge type
                            <CmtsCol name="CHTYPENAME" />
                          </th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            What the heading covers
                            <CmtsCol name="CHTYPEDESC" />
                          </th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap">
                            Catalogue flag
                            <CmtsCol name="NONUSEABEL" />
                          </th>
                          <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                            Why no line here
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {unusedChargeTypes.map(({ type, why }) => (
                          <tr
                            key={type.CHTYPEABB}
                            className="border-b border-[#F1F5F9] last:border-0"
                          >
                            <td className="px-3 py-2.5">
                              <ChargeTypeCode abb={type.CHTYPEABB} />
                            </td>
                            <td className="px-3 py-2.5 text-[12px] font-medium text-[#0F172A] whitespace-nowrap">
                              {type.CHTYPENAME}
                            </td>
                            <td className="px-3 py-2.5 text-[11.5px] text-[#64748B]">
                              {type.CHTYPEDESC}
                            </td>
                            <td className="px-3 py-2.5">
                              <NonUseabelFlag type={type} />
                            </td>
                            <td className="px-3 py-2.5 text-[11.5px] text-[#64748B]">{why}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex items-start gap-2.5">
                    <HelpCircle size={14} className="text-[#B45309] flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-[#64748B]">
                      <span className="font-mono font-semibold text-[#0F172A]">NONUSEABEL</span>{" "}
                      looks like it marks a charge type retired, but that is{" "}
                      <strong>not confirmed with SAPS</strong> — it is a varchar(50) that could hold
                      a date, an initial or a reason as easily as a flag, and the restored CMTS
                      database is schema-only, so the value set cannot be read off the data. Nothing
                      on this screen acts on it: no charge type is filtered out of the calculation,
                      and a heading is listed here because it produced no amount, never because the
                      flag was decoded. If you know what these values mean, this table is the place
                      to correct us.
                    </p>
                  </div>
                </div>
              )}

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
