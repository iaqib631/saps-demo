"use client";

/**
 * Charge Working Set · tab 3 — CMTS `ImportFreeHandedCalc` (22 columns).
 *
 * The free-hand path: a charge an operator keys directly rather than one the
 * engine derives, for cases the rate card does not cover.
 * `CMTS_SCOPE_DECISIONS.md` Q4 confirms it is LIVE and not abandoned — this
 * table is `FreeHandGR`'s calculation partner, and an abandoned voucher table
 * does not keep a live working-set companion.
 *
 * WHY THE LAYOUT IS DIFFERENT AGAIN
 * ---------------------------------
 * On the other two tabs the derivation is arithmetic: bands, days, roll-ups. On
 * this one it is not. The answer to "why is it this amount?" is **because
 * somebody typed it** — so the only honest derivation is the keyed figure
 * beside the derived one, with the difference named rather than averaged away.
 * The screen is therefore built as an override ladder, not as a calculation.
 *
 * Three structural facts drive the rest of the layout, and each is the absence
 * of something the other two tables have:
 *
 *   • ONE ROW. No `sum`-prefixed columns and no `HWB`, so nothing splits and
 *     nothing rolls up. There is no roll-up card here because there is no
 *     roll-up.
 *   • NO WINDOW. `NumberofDays` with no `StartDate` and no `EndDate`, so the
 *     row says how many days were billed and cannot say which. Nothing here
 *     reconciles against a storage clock, and the day panel says exactly that
 *     rather than drawing a clock the table cannot support.
 *   • NO VOUCHER COLUMN. `TempImportCalculation` has `VoucherNumber`; this has
 *     nothing. The link to the `FreeHandGR` voucher it produced is the
 *     correlator and nothing else.
 *
 * SURFACE, DO NOT RECONCILE. The keyed figures and the engine's are both shown
 * and neither is corrected. No existing calculation is touched.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  HelpCircle,
  KeyRound,
  Percent,
  Receipt,
  UserRoundX,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import { formatKg, formatPkr, round2 } from "@/lib/domain";
import {
  CALC_KEY_COLUMNS,
  FREE_HAND_AMBIGUITIES,
  freeHandLadder,
  freeHandUnheldCharges,
  listFreeHandEntries,
  taxPercentageReading,
  type FreeHandEntry,
} from "@/lib/domain/importcalc";
import { Card, CheckChip, CmtsCol, Field, Sic, Th } from "./ui";
import PathMatrix from "./PathMatrix";

const TABLE = "ImportFreeHandedCalc";

const HAZARD_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  clean: { bg: "#DCFCE7", fg: "#16A34A", label: "PARSES" },
  "trailing-sign": { bg: "#FEF3C7", fg: "#B45309", label: "CAST FAILS" },
  fraction: { bg: "#FEE2E2", fg: "#DC2626", label: "100× OUT" },
  unparseable: { bg: "#FEE2E2", fg: "#DC2626", label: "UNPARSEABLE" },
};

export default function FreeHandTab() {
  const { scope, isHq } = useSite();
  const entries = useMemo(() => listFreeHandEntries(scope), [scope]);

  const [selectedKey, setSelectedKey] = useState<string | null>(entries[0]?.key ?? null);
  const entry: FreeHandEntry | null =
    entries.find((e) => e.key === selectedKey) ?? entries[0] ?? null;

  /**
   * Across every entry in scope. The question this tab exists to answer at the
   * site level is not "what does this one cost" — it is "how much money on this
   * path was decided by a person rather than by the tariff", which is only
   * meaningful in aggregate.
   */
  const totals = useMemo(() => {
    let keyed = 0;
    let derived = 0;
    let unclassified = 0;
    let overrides = 0;
    for (const e of entries) {
      const l = freeHandLadder(e);
      keyed += l.keyedSubTotal;
      derived += l.derivedSubTotal;
      unclassified += e.row.OtherChargesAmount;
      if (l.direction !== "level") overrides += 1;
    }
    return {
      keyed: round2(keyed),
      derived: round2(derived),
      delta: round2(keyed - derived),
      unclassified: round2(unclassified),
      overrides,
    };
  }, [entries]);

  const view = useMemo(
    () =>
      entry
        ? {
            ladder: freeHandLadder(entry),
            unheld: freeHandUnheldCharges(entry),
            tax: taxPercentageReading(
              entry.row.TaxPercentage,
              entry.row.TotalAmountWithoutTax,
              entry.row.Tax,
            ),
          }
        : null,
    [entry],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- KPI strip ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Free-hand entries",
            value: String(entries.length),
            tone: "#0F172A",
            hint: "one row each — this table has no roll-up columns",
          },
          {
            label: "Entries that override",
            value: String(totals.overrides),
            tone: totals.overrides > 0 ? "#7C3AED" : "#64748B",
            hint: "keyed sub-total differs from the derived one",
          },
          {
            label: "Keyed by an operator",
            value: formatPkr(totals.keyed),
            tone: "#1B4F8B",
            hint: "Σ the charge columns as entered",
          },
          {
            label: "…what the engine would say",
            value: formatPkr(totals.derived),
            tone: totals.delta < 0 ? "#DC2626" : "#64748B",
            hint:
              totals.delta === 0
                ? "the two readings agree"
                : `${formatPkr(Math.abs(totals.delta))} ${totals.delta > 0 ? "more" : "less"} keyed than derived`,
          },
          {
            label: "Unclassified",
            value: formatPkr(totals.unclassified),
            tone: totals.unclassified > 0 ? "#B45309" : "#64748B",
            hint: "OtherChargesAmount — with no description column beside it",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[18px] font-bold mt-1 font-mono" style={{ color: k.tone }}>
              {k.value}
            </p>
            <p className="text-[10px] text-[#94A3B8] mt-1 leading-snug">{k.hint}</p>
          </div>
        ))}
      </div>

      {entries.length === 0 || !entry || !view ? (
        <EmptyState
          title="No free-hand calculations at this site"
          description="Nothing at this site has been billed through the manual path. Q4 confirms the path is live rather than abandoned — ImportFreeHandedCalc is FreeHandGR's calculation partner, and an abandoned voucher table does not keep a live working-set companion."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ---------------- Entry picker ---------------- */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <KeyRound size={15} className="text-[#64748B]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Free-hand entries</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  {isHq ? "All sites" : `${scope} only`} · scoped on CityId
                </p>
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {entries.map((e) => {
                const l = freeHandLadder(e);
                return (
                  <button
                    key={e.key}
                    onClick={() => setSelectedKey(e.key)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: entry.key === e.key ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-[#0F172A] truncate">
                        {e.key}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center flex-shrink-0"
                        style={
                          l.direction === "over"
                            ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                            : l.direction === "under"
                              ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                              : { backgroundColor: "#F1F5F9", color: "#64748B" }
                        }
                      >
                        {l.direction === "level" ? "MATCHES" : l.direction.toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                      {formatPkr(e.row.TotalAmountWithTax)} · keyed by {e.keyedBy}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug line-clamp-3">
                      {e.reason}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <p className="text-[11px] text-[#64748B] leading-snug">
                &ldquo;Keyed by&rdquo; above is <strong>not on the row</strong>. This table has no
                audit columns, so on the one path where a human decided the number, the record
                cannot name the human.
              </p>
            </div>
          </div>

          {/* ---------------- Detail ---------------- */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* 1 · Identity */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      Entry
                    </span>
                    <CmtsCol name="UniqueIdentification" table={TABLE} />
                  </div>
                  <p className="font-mono text-[18px] font-bold text-[#0F172A] mt-0.5 break-all">
                    {entry.key}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                    <AwbLink awbNo={entry.AWBNO} awbId={entry.awbId} />
                    <CmtsCol name={null} table={TABLE} />
                    <span className="text-[#CBD5E1]">·</span>
                    <span>{entry.locationName}</span>
                    {/* Also no column — CargoLocationId is a surrogate key and
                        out of scope, so the zone name is resolved through the AWB. */}
                    <CmtsCol name={null} table={TABLE} />
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      Entry total
                    </span>
                    <CmtsCol name="TotalAmountWithTax" table={TABLE} />
                  </div>
                  <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                    {formatPkr(entry.row.TotalAmountWithTax)}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-1 max-w-[280px] leading-snug">
                    {entry.resolvedVoucherNo ? (
                      <>
                        billed on{" "}
                        <span className="font-mono font-semibold text-[#64748B]">
                          {entry.resolvedVoucherNo}
                        </span>{" "}
                        — resolved through the AWB, <em>not</em> stored on this row
                      </>
                    ) : (
                      <>no voucher raised against this consignment</>
                    )}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3">
                <p className="text-[11px] font-semibold text-[#1B4F8B] uppercase tracking-wider">
                  Why it was keyed rather than derived
                </p>
                <p className="text-[12px] text-[#334155] mt-1.5 leading-snug">{entry.reason}</p>
                <p className="text-[11px] text-[#64748B] mt-2 leading-snug">
                  This explanation is <strong>not on the row either</strong>. It is carried by this
                  demo so the entry can be read at all — see the questions at the foot of the tab.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                <Field
                  label="Weight"
                  cmts="TotalWeight"
                  value={formatKg(entry.row.TotalWeight)}
                  mono
                  table={TABLE}
                  hint="the table's only weight column"
                />
                <Field
                  label="Chargeable weight"
                  cmts={null}
                  value={formatKg(entry.chargeableKg)}
                  mono
                  table={TABLE}
                />
                <Field
                  label="Site"
                  cmts="CityId"
                  value={`${entry.row.CityId} · ${entry.site}`}
                  mono
                  table={TABLE}
                />
                <Field
                  label="Voucher"
                  cmts={null}
                  value={entry.resolvedVoucherNo}
                  mono
                  table={TABLE}
                  hint="TempImportCalculation has VoucherNumber; this table has nothing"
                />
              </div>
            </div>

            {/* 2 · The override ladder */}
            <Card
              icon={<Receipt size={15} />}
              title="Keyed against derived"
              subtitle="The whole derivation on this path. There are no bands and no roll-ups to walk — the amount is the amount because an operator entered it, so the only useful comparison is against what the engine would have produced for the same consignment."
              right={
                <span
                  className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  style={
                    view.ladder.direction === "level"
                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      : view.ladder.direction === "over"
                        ? { backgroundColor: "#FEF3C7", color: "#B45309" }
                        : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  }
                >
                  {view.ladder.direction === "level" ? (
                    <>
                      <Check size={10} strokeWidth={3} /> Keyed = derived
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={10} strokeWidth={2.5} />{" "}
                      {formatPkr(Math.abs(view.ladder.delta))}{" "}
                      {view.ladder.direction === "over" ? "above" : "below"} the engine
                    </>
                  )}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Shown, not reconciled. The engine column is what{" "}
                  <span className="font-mono">calculateCharges</span> produces for this consignment
                  — the same function the godown-rent voucher prices from — and nothing on this
                  screen changes it. A free-hand entry is <em>allowed</em> to differ; that is the
                  point of the path. What the row cannot do is say <em>why</em> it differs, and no
                  column here holds a reason.
                </p>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[620px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>Heading</Th>
                      <Th right>Keyed</Th>
                      <Th right>Engine would say</Th>
                      <Th right>Difference</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.ladder.lines.map((l) => (
                      <tr key={l.label} className="border-b border-[#F1F5F9] last:border-0 align-top">
                        <td className="px-3 py-2.5">
                          <span className="text-[12px] text-[#334155]">{l.label}</span>{" "}
                          {l.column === null ? (
                            <span className="h-[16px] px-1 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono">
                              NO COLUMN
                            </span>
                          ) : (
                            <CmtsCol name={l.column} table={TABLE} />
                          )}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold whitespace-nowrap"
                          style={{ color: l.column === null ? "#CBD5E1" : l.keyed === 0 ? "#CBD5E1" : "#0F172A" }}
                        >
                          {l.column === null ? "—" : formatPkr(l.keyed)}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap"
                          style={{ color: l.derived === 0 ? "#CBD5E1" : "#475569" }}
                        >
                          {formatPkr(l.derived)}
                        </td>
                        <td
                          className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap"
                          style={{
                            color:
                              Math.abs(l.delta) < 0.005
                                ? "#CBD5E1"
                                : l.delta > 0
                                  ? "#B45309"
                                  : "#DC2626",
                          }}
                        >
                          {Math.abs(l.delta) < 0.005
                            ? "0"
                            : `${l.delta > 0 ? "+" : "−"} ${formatPkr(Math.abs(l.delta))}`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0B2545] bg-[#F8FAFC]">
                      <td className="px-3 py-2.5 text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider">
                        Sub-total before tax
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold text-[#0B2545] whitespace-nowrap">
                        {formatPkr(view.ladder.keyedSubTotal)}
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#475569] whitespace-nowrap">
                        {formatPkr(view.ladder.derivedSubTotal)}
                      </td>
                      <td
                        className="px-3 py-2.5 text-right font-mono text-[12px] font-bold whitespace-nowrap"
                        style={{ color: view.ladder.delta === 0 ? "#CBD5E1" : "#DC2626" }}
                      >
                        {view.ladder.delta === 0
                          ? "0"
                          : `${view.ladder.delta > 0 ? "+" : "−"} ${formatPkr(Math.abs(view.ladder.delta))}`}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div
                  className="rounded-xl border px-4 py-3"
                  style={
                    view.ladder.belowFloor
                      ? { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }
                      : { borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }
                  }
                >
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      Subclass floor <CmtsCol name="MinimumCharges" table={TABLE} />
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#0F172A]">
                      {formatPkr(view.ladder.MinimumCharges)}
                    </span>
                  </div>
                  <p
                    className="text-[11px] mt-1.5 leading-snug"
                    style={{ color: view.ladder.belowFloor ? "#B91C1C" : "#64748B" }}
                  >
                    {view.ladder.MinimumCharges === 0
                      ? "This subclass carries no floor, so the manual entry has nothing to clear."
                      : view.ladder.belowFloor
                        ? "The keyed sub-total falls below the floor. The column is on the row; whether the free-hand screen enforces it or only displays it is not something the schema can say — and those are opposite behaviours with identical columns."
                        : "The keyed sub-total already clears the floor, so the rule is dormant on this entry. It says nothing about whether the screen would have enforced it."}
                  </p>
                </div>

                <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#92400E] uppercase tracking-wider">
                      Unclassified <CmtsCol name="OtherChargesAmount" table={TABLE} />
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#92400E]">
                      {formatPkr(entry.row.OtherChargesAmount)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#92400E] mt-1.5 leading-snug">
                    The escape hatch, and the reason this path exists: somewhere to put a charge the
                    rate card does not cover. <strong>There is no description column beside it.</strong>{" "}
                    The one field whose whole purpose is to hold an unclassified amount cannot say
                    what the amount was for — so the voucher is least auditable exactly where it is
                    most discretionary.
                  </p>
                </div>
              </div>
            </Card>

            {/* 3 · Days without a window */}
            <Card
              icon={<CalendarClock size={15} />}
              title="A day count with no window"
              subtitle="NumberofDays is on this table. StartDate and EndDate are not. So the row records how many days were billed and cannot record which days they were."
            >
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <Field
                  label="Days billed"
                  cmts="NumberofDays"
                  value={String(entry.row.NumberofDays)}
                  mono
                  table={TABLE}
                  hint="[sic] — lower-case o"
                />
                <Field
                  label="Window opens"
                  cmts={null}
                  value={null}
                  mono
                  table={TABLE}
                  hint="TempImportCalculation has StartDate"
                />
                <Field
                  label="Window closes"
                  cmts={null}
                  value={null}
                  mono
                  table={TABLE}
                  hint="TempImportCalculation has EndDate"
                />
                <Field
                  label="Free allowance"
                  cmts={null}
                  value={null}
                  mono
                  table={TABLE}
                  hint="no Freedays column on this path at all"
                />
              </div>

              <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-[#991B1B]">
                    Nothing here reconciles against the storage clock
                  </p>
                  <p className="text-[11px] text-[#B91C1C] mt-1 leading-snug">
                    The demo&rsquo;s own dwell for this consignment is{" "}
                    <span className="font-mono">{entry.calc.totalDays}</span> days from cargo
                    intake, and the row says{" "}
                    <span className="font-mono">{entry.row.NumberofDays}</span>.
                    {entry.calc.totalDays === entry.row.NumberofDays
                      ? " They agree here — but the row could not have shown a disagreement, because it carries no dates to disagree with."
                      : " They differ, and the row cannot say why, because it carries no dates to check against."}{" "}
                    On the standard path a disputed charge is answered by re-walking the window; on
                    this one there is no window to re-walk. That is not a gap in the data — it is
                    what the schema decided was worth recording when a person sets the number.
                  </p>
                </div>
              </div>
            </Card>

            {/* 4 · Tax stored as text */}
            <Card
              icon={<Percent size={15} />}
              title="A percentage stored as text"
              subtitle="The same hazard as on the temporary-import table, on a path where nothing else can be checked either. TaxPercentage is varchar; Tax and both totals beside it are floats."
              right={
                <span
                  className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center font-mono whitespace-nowrap"
                  style={{
                    backgroundColor: HAZARD_TONE[view.tax.hazard].bg,
                    color: HAZARD_TONE[view.tax.hazard].fg,
                  }}
                >
                  {HAZARD_TONE[view.tax.hazard].label}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  The spelling is <strong>constructed</strong>; the rate is not. The{" "}
                  <span className="font-mono">Tax</span> float was computed at{" "}
                  {view.tax.impliedPercent}%, which is what the illustrative rate card resolves and
                  what the voucher prints. Only the way that percent is written into an unconstrained
                  varchar varies.
                </p>
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    What the column holds
                  </p>
                  <p className="font-mono text-[20px] font-bold text-[#0F172A] mt-1">
                    &quot;{view.tax.literal}&quot;
                  </p>
                  <div className="mt-1.5">
                    <CmtsCol name="TaxPercentage" table={TABLE} />
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5">
                    {[
                      {
                        label: "CAST(TaxPercentage AS float)",
                        value: view.tax.castSucceeds
                          ? String(view.tax.numberValue)
                          : "conversion error",
                        ok: view.tax.castSucceeds,
                      },
                      {
                        label: "parseFloat(TaxPercentage)",
                        value: Number.isFinite(view.tax.parseFloatValue)
                          ? String(view.tax.parseFloatValue)
                          : "NaN",
                        ok: Number.isFinite(view.tax.parseFloatValue),
                      },
                      {
                        label: "Tax ÷ TotalAmountWithoutTax",
                        value: `${view.tax.impliedPercent}%`,
                        ok: true,
                      },
                    ].map((line) => (
                      <div key={line.label} className="flex items-baseline justify-between gap-3">
                        <span className="font-mono text-[10.5px] text-[#64748B]">{line.label}</span>
                        <span
                          className="font-mono text-[12px] font-semibold whitespace-nowrap"
                          style={{ color: line.ok ? "#0F172A" : "#DC2626" }}
                        >
                          {line.value}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div
                  className="rounded-xl border px-4 py-3.5"
                  style={
                    view.tax.hazard === "clean"
                      ? { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }
                      : { borderColor: "#FCA5A5", backgroundColor: "#FEF2F2" }
                  }
                >
                  <p
                    className="text-[11px] font-semibold uppercase tracking-wider"
                    style={{ color: view.tax.hazard === "clean" ? "#15803D" : "#991B1B" }}
                  >
                    {view.tax.reconciles
                      ? "The literal reproduces the stored Tax"
                      : "The literal does not reproduce the stored Tax"}
                  </p>
                  <p
                    className="text-[11.5px] mt-1.5 leading-snug"
                    style={{ color: view.tax.hazard === "clean" ? "#166534" : "#B91C1C" }}
                  >
                    {view.tax.finding}
                  </p>
                  <div className="mt-3 pt-3 border-t border-[#E2E8F0] flex items-baseline justify-between gap-3">
                    <span className="text-[11px] text-[#64748B]">
                      Tax on this entry <CmtsCol name="Tax" table={TABLE} />
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#0F172A]">
                      {formatPkr(entry.row.Tax)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 5 · Money with no column */}
            <Card
              icon={<UserRoundX size={15} />}
              title="What this table cannot hold"
              subtitle="A different subset from the temporary-import table, which is the point: the two paths bill differently and lose different things to the schema."
              right={
                <CheckChip
                  ok={view.unheld.unheldTotal === 0}
                  okLabel="Everything has a column"
                  badLabel={`${formatPkr(view.unheld.unheldTotal)} unheld`}
                />
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  This path <em>gains</em> three headings the temporary-import table lacks —{" "}
                  <span className="font-mono">DocumentationCharges</span>,{" "}
                  <span className="font-mono">DeconsolidationCharges</span> and{" "}
                  <span className="font-mono">OtherChargesAmount</span> — and <em>loses</em> the
                  free-day, supplement, window and roll-up columns that one has. Neither is a subset
                  of the other, which is why they are not rendered with one layout.
                </p>
              }
            >
              <div className="flex flex-col">
                {view.unheld.rungs.map((rung) => (
                  <div
                    key={rung.label}
                    className="flex items-baseline justify-between gap-3 py-2 border-b border-[#F1F5F9] last:border-0"
                    style={{
                      backgroundColor: rung.column === null && rung.amount > 0 ? "#FFFBEB" : undefined,
                    }}
                  >
                    <div className="min-w-0">
                      <span className="text-[12px] text-[#334155]">{rung.label}</span>{" "}
                      {rung.column === null ? (
                        <span className="h-[16px] px-1 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono">
                          NO COLUMN
                        </span>
                      ) : (
                        <CmtsCol name={rung.column} table={TABLE} />
                      )}
                      <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-snug">{rung.note}</p>
                    </div>
                    <span
                      className="font-mono text-[13px] font-medium whitespace-nowrap"
                      style={{
                        color:
                          rung.amount === 0
                            ? "#CBD5E1"
                            : rung.column === null
                              ? "#B45309"
                              : "#334155",
                      }}
                    >
                      {formatPkr(rung.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 6 · The three paths */}
            <PathMatrix highlight="freehand" />

            {/* 7 · Spellings & keys */}
            <Card
              icon={<KeyRound size={15} />}
              title="18 modelled, 4 left off"
              subtitle="This table's own spellings, reproduced exactly. Four surrogate keys are deliberately not modelled — the same four TempImportCalculation carries."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  {CALC_KEY_COLUMNS.map((c) => (
                    <span key={c} className="font-mono">
                      {c}{" "}
                    </span>
                  ))}
                  — surrogate keys with nothing to key in a prototype with no backend. 18 + 4 = 22.
                  Both calculation tables carry the identical four, which is worth knowing on its
                  own: the two paths resolve cargo the same way and differ only in what they charge.
                </p>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["StorgeUnit", "Storage, no second a"],
                    ["StorgeUnitCharges", "same, on the money column"],
                    ["NumberofDays", "lower-case o"],
                  ] as const
                ).map(([col, why]) => (
                  <span
                    key={col}
                    className="h-[24px] px-2 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold inline-flex items-center gap-1.5 font-mono"
                    title={`Reproduced exactly as ImportFreeHandedCalc spells it — ${why}`}
                  >
                    {col}
                    <Sic note={`${why} — deliberate, parity is checked by column name`} />
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#64748B] mt-3 leading-snug">
                Note what is <em>not</em> here.{" "}
                <span className="font-mono">ImportFreeHandedCalc</span> has no{" "}
                <span className="font-mono">SUPPLIMENTDAYS</span>, no{" "}
                <span className="font-mono">IsSuppliment</span>, no{" "}
                <span className="font-mono">Freedays</span> and no{" "}
                <span className="font-mono">ISFree</span> — four columns its sibling carries. Adding
                any of them here to make the two tables match would be inventing a column, and
                inventing a column is how one CMTS field silently becomes two.
              </p>
            </Card>

            {/* 8 · Open questions */}
            <Card
              icon={<HelpCircle size={15} />}
              title="Questions the schema cannot answer"
              subtitle="On this path they are sharper than on the other two, because everything the row does not carry was decided by a person."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  <Check size={11} className="inline text-[#16A34A]" /> Q4 settles the premise —
                  this path is live, not abandoned. What it does not settle is whether a free-hand
                  charge can be audited after the fact, and every question above is a piece of that
                  one.
                </p>
              }
            >
              <div className="flex flex-col gap-3">
                {FREE_HAND_AMBIGUITIES.map((a) => (
                  <div
                    key={a.columns.join("|")}
                    className="rounded-xl border border-[#E2E8F0] px-4 py-3"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {a.columns.map((c) => (
                        <span
                          key={c}
                          className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-bold inline-flex items-center font-mono"
                        >
                          {c}
                        </span>
                      ))}
                    </div>
                    <p className="text-[12px] text-[#334155] mt-2 leading-snug">{a.finding}</p>
                    <p className="text-[11px] text-[#1B4F8B] mt-1.5 leading-snug">
                      <strong>Ask SAPS:</strong> {a.question}
                    </p>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
