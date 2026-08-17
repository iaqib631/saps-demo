"use client";

/**
 * Charge Working Set · tab 2 — CMTS `TempImportCalculation` (38 columns).
 *
 * The temporary-import path. Same question as the standard tab — **why is it
 * this amount?** — asked of a table that answers it less well, and the layout is
 * built around exactly where it stops answering:
 *
 *   1. which run, and what it can be joined to    — the correlator, and no AWB
 *   2. the rows the engine wrote                  — per storage / house line
 *   3. the roll-up against those rows             — the denormalisation
 *   4. the day model                              — a window AND a count
 *   5. the tax percent                            — stored as text
 *   6. what this table cannot hold                — money with no column
 *   7. what the schema cannot answer              — the open questions
 *
 * WHY THIS IS NOT THE STANDARD TAB'S LAYOUT
 * -----------------------------------------
 * `grCharges` leads with the band walk, because a band walk is what it records.
 * There is no `DAYFROM` and no `DAYTO` anywhere on `TempImportCalculation`, so
 * there is no walk to render — the rows are storage lines, not bands, and
 * leading with a slab table would be inventing a level of derivation the table
 * does not have. The roll-up check takes that slot instead, because the
 * roll-up-versus-rows relationship is what this table has and the other two do
 * not.
 *
 * SURFACE, DO NOT RECONCILE
 * -------------------------
 * Every disagreement here is rendered and none is corrected. No existing
 * calculation is touched: every figure comes from `calculateCharges`, the same
 * function the voucher prices from, mapped onto whichever columns this table
 * actually has.
 */

import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Boxes,
  CalendarClock,
  Check,
  Database,
  HelpCircle,
  Layers,
  Percent,
  Receipt,
  Scale,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import { formatDate, formatDateTime, formatKg, formatPkr, round2 } from "@/lib/domain";
import {
  CALC_KEY_COLUMNS,
  TEMP_IMPORT_AMBIGUITIES,
  listTempImportRuns,
  rollUpCheck,
  taxPercentageReading,
  tempDayReading,
  tempUnheldCharges,
  type TempImportRun,
} from "@/lib/domain/importcalc";
import { Card, CheckChip, CmtsCol, Field, Sic, Th } from "./ui";
import PathMatrix from "./PathMatrix";

const TABLE = "TempImportCalculation";

const HAZARD_TONE: Record<string, { bg: string; fg: string; label: string }> = {
  clean: { bg: "#DCFCE7", fg: "#16A34A", label: "PARSES" },
  "trailing-sign": { bg: "#FEF3C7", fg: "#B45309", label: "CAST FAILS" },
  fraction: { bg: "#FEE2E2", fg: "#DC2626", label: "100× OUT" },
  unparseable: { bg: "#FEE2E2", fg: "#DC2626", label: "UNPARSEABLE" },
};

export default function TempImportTab() {
  const { scope, isHq } = useSite();
  const runs = useMemo(() => listTempImportRuns(scope), [scope]);

  const [selectedKey, setSelectedKey] = useState<string | null>(runs[0]?.key ?? null);
  const run: TempImportRun | null = runs.find((r) => r.key === selectedKey) ?? runs[0] ?? null;

  /**
   * Computed across every run in scope rather than off the selected one. "How
   * much of this path's money does the table fail to hold" is not a
   * per-consignment question — it is the reason the tab exists.
   */
  const totals = useMemo(() => {
    let rows = 0;
    let recorded = 0;
    let unheld = 0;
    let staleRuns = 0;
    for (const r of runs) {
      rows += r.rows.length;
      const u = tempUnheldCharges(r);
      recorded += u.recordedTotal;
      unheld += u.unheldTotal;
      if (rollUpCheck(r).stale) staleRuns += 1;
    }
    return {
      rows,
      staleRuns,
      recorded: round2(recorded),
      unheld: round2(unheld),
    };
  }, [runs]);

  const view = useMemo(
    () =>
      run
        ? {
            rollUp: rollUpCheck(run),
            days: tempDayReading(run),
            unheld: tempUnheldCharges(run),
            tax: taxPercentageReading(
              run.head.TaxPercentage,
              run.head.TotalAmountWithoutTax,
              run.head.Tax,
            ),
          }
        : null,
    [run],
  );

  return (
    <div className="flex flex-col gap-5">
      {/* ---------------- KPI strip ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Temporary-import runs",
            value: String(runs.length),
            tone: "#0F172A",
            hint: "grouped by UniqueIdentification",
          },
          {
            label: "Calculation rows",
            value: String(totals.rows),
            tone: "#0F172A",
            hint: "one per storage line — never per rate band",
          },
          {
            label: "Runs with a stale roll-up",
            value: String(totals.staleRuns),
            tone: totals.staleRuns > 0 ? "#DC2626" : "#16A34A",
            hint: "the sum* columns disagree with the rows beside them",
          },
          {
            label: "Recorded on this table",
            value: formatPkr(totals.recorded),
            tone: "#1B4F8B",
            hint: "Σ TotalAmountWithoutTax across the rows",
          },
          {
            label: "…money it cannot hold",
            value: formatPkr(totals.unheld),
            tone: totals.unheld > 0 ? "#DC2626" : "#16A34A",
            hint: "computed by the engine, no column on this table",
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

      {runs.length === 0 || !run || !view ? (
        <EmptyState
          title="No temporary-import calculations at this site"
          description="Nothing at this site has been priced through the temporary-import path. There is no flag in CMTS marking a consignment as temporary — the path is implied only by which calculation table the engine wrote to."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ---------------- Run picker ---------------- */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Layers size={15} className="text-[#64748B]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Temporary imports</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  {isHq ? "All sites" : `${scope} only`} · scoped on CityId
                </p>
              </div>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {runs.map((r) => {
                const stale = rollUpCheck(r).stale;
                return (
                  <button
                    key={r.key}
                    onClick={() => setSelectedKey(r.key)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: run.key === r.key ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-[#0F172A] truncate">
                        {r.key}
                      </span>
                      {stale && (
                        <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center flex-shrink-0">
                          STALE Σ
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                      {formatPkr(r.head.sumTotalAmountWithTax)} · {r.rows.length} row
                      {r.rows.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug">{r.regime}</p>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <p className="text-[11px] text-[#64748B] leading-snug">
                Which consignments take this path is <strong>our assignment</strong>. CMTS has no
                temporary-import flag and no register — the path is recorded only by which table the
                engine wrote to. Each run states the regime it was assigned under.
              </p>
            </div>
          </div>

          {/* ---------------- Detail ---------------- */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* 1 · Identity, and what cannot be joined */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      Run
                    </span>
                    <CmtsCol name="UniqueIdentification" table={TABLE} />
                  </div>
                  <p className="font-mono text-[18px] font-bold text-[#0F172A] mt-0.5 break-all">
                    {run.key}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                    <AwbLink awbNo={run.AWBNO} awbId={run.awbId} />
                    <CmtsCol name={null} table={TABLE} />
                    <span className="text-[#CBD5E1]">·</span>
                    <span>{run.locationName}</span>
                    {/* The zone NAME has no column either — CargoLocationId is a
                        surrogate key and out of scope, so the name is resolved
                        through the AWB exactly as the class and subclass are. */}
                    <CmtsCol name={null} table={TABLE} />
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-1 leading-snug max-w-[420px]">
                    {run.purpose}
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      Run total
                    </span>
                    <CmtsCol name="sumTotalAmountWithTax" table={TABLE} />
                  </div>
                  <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                    {formatPkr(run.head.sumTotalAmountWithTax)}
                  </p>
                  {run.head.VoucherNumber ? (
                    <p className="text-[11px] text-[#64748B] mt-1 inline-flex items-center gap-1 justify-end">
                      <Receipt size={11} className="text-[#94A3B8]" />
                      billed on{" "}
                      <span className="font-mono font-semibold">{run.head.VoucherNumber}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#94A3B8] mt-1 max-w-[260px] leading-snug">
                      <span className="font-mono text-[#CBD5E1]">null</span> VoucherNumber — priced,
                      never billed
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-[12px] font-semibold text-[#92400E]">
                    This table has no AWB column
                  </p>
                  <p className="text-[11px] text-[#92400E] mt-1 leading-snug">
                    <span className="font-mono">grCharges</span> carries{" "}
                    <span className="font-mono">AWBNO</span> and{" "}
                    <span className="font-mono">IGMNO</span>; this one carries{" "}
                    <span className="font-mono">HWB</span> — the <em>house</em> bill — and nothing
                    for the master.{" "}
                    {run.head.HWB
                      ? "On this run the house lines at least name themselves."
                      : "On this run HWB is null, so the row carries no cargo identifier at all."}{" "}
                    The consignment above was resolved through{" "}
                    <span className="font-mono">UniqueIdentification</span>, a varchar with no
                    declared foreign key. If that correlator is blank, re-used or duplicated across
                    sites, the derivation is orphaned — and an orphaned derivation is a charge
                    nobody can explain on a voucher already paid.{" "}
                    <span className="font-mono">CityId</span> is the only thing narrowing a
                    collision to one site, which is what makes it load-bearing rather than
                    decorative.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                <Field
                  label="House bill"
                  cmts="HWB"
                  value={run.head.HWB}
                  mono
                  table={TABLE}
                  hint="the only cargo identifier on the table"
                />
                <Field
                  label="Voucher"
                  cmts="VoucherNumber"
                  value={run.head.VoucherNumber}
                  mono
                  table={TABLE}
                />
                <Field
                  label="Site"
                  cmts="CityId"
                  value={`${run.head.CityId} · ${run.site}`}
                  mono
                  table={TABLE}
                  hint="grCharges has no site column at all"
                />
                <Field
                  label="Chargeable weight"
                  cmts={null}
                  value={formatKg(run.chargeableKg)}
                  mono
                  table={TABLE}
                  hint="the basis the money was computed on"
                />
              </div>
            </div>

            {/* 2 · The rows */}
            <Card
              icon={<Database size={15} />}
              title="The rows the engine wrote"
              subtitle="One per storage line — per house where the consignment is a consolidation. Not one per rate band: there is no DAYFROM and no DAYTO on this table, so the band walk that the standard path records has no home here."
              right={
                <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono whitespace-nowrap">
                  {run.rows.length} ROW{run.rows.length === 1 ? "" : "S"}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  <span className="font-mono">TotalWeight</span> is the table&rsquo;s only weight
                  column and it holds the actual weight. The chargeable weight the money was
                  computed on ({formatKg(run.chargeableKg)}) has no column, so no row here can be
                  re-priced from itself.{" "}
                  <span className="font-mono">MinimumCharges</span> repeats identically on every row
                  because a floor belongs to the subclass, not to the line — which is what makes{" "}
                  <span className="font-mono">sumMinimumCharges</span> below a category error rather
                  than a rounding one.
                </p>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[940px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>
                        Line
                        <CmtsCol name="HWB" block table={TABLE} />
                      </Th>
                      <Th right>
                        Weight
                        <CmtsCol name="TotalWeight" block table={TABLE} />
                      </Th>
                      <Th right>
                        Storage
                        <CmtsCol name="StorgeUnitCharges" block table={TABLE} />
                      </Th>
                      <Th right>
                        Handling
                        <CmtsCol name="HandlingCharges" block table={TABLE} />
                      </Th>
                      <Th right>
                        Location
                        <CmtsCol name="LocationChargesAmount" block table={TABLE} />
                      </Th>
                      <Th right>
                        AFU
                        <CmtsCol name="AFUAmount" block table={TABLE} />
                      </Th>
                      <Th right>
                        Special
                        <CmtsCol name="SpecialCharges" block table={TABLE} />
                      </Th>
                      <Th right>
                        Floor
                        <CmtsCol name="MinimumCharges" block table={TABLE} />
                      </Th>
                      <Th right>
                        Before tax
                        <CmtsCol name="TotalAmountWithoutTax" block table={TABLE} />
                      </Th>
                      <Th right>
                        With tax
                        <CmtsCol name="TotalAmountWithTax" block table={TABLE} />
                      </Th>
                    </tr>
                  </thead>
                  <tbody>
                    {run.rows.map((r, ri) => {
                      const outsideRollUp = ri >= view.rollUp.coveredRows;
                      return (
                        <tr
                          key={`${r.HWB ?? "master"}-${ri}`}
                          className="border-b border-[#F1F5F9] last:border-0"
                          style={{ backgroundColor: outsideRollUp ? "#FEF2F2" : undefined }}
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <span className="font-mono text-[12px] font-medium text-[#0F172A]">
                              {r.HWB ?? "null"}
                            </span>
                            {outsideRollUp && (
                              <span
                                className="ml-1.5 h-[16px] px-1 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center font-mono"
                                title="Written after the roll-up — the sum* columns do not include this row"
                              >
                                outside Σ
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {formatKg(r.TotalWeight)}
                          </td>
                          {[
                            r.StorgeUnitCharges,
                            r.HandlingCharges,
                            r.LocationChargesAmount,
                            r.AFUAmount,
                            r.SpecialCharges,
                            r.MinimumCharges,
                          ].map((amount, ci) => (
                            <td
                              key={ci}
                              className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap"
                              style={{ color: amount === 0 ? "#CBD5E1" : "#475569" }}
                            >
                              {formatPkr(amount)}
                            </td>
                          ))}
                          <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                            {formatPkr(r.TotalAmountWithoutTax)}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#0B2545] whitespace-nowrap">
                            {formatPkr(r.TotalAmountWithTax)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <Field
                  label="Storage basis"
                  cmts="StorgeUnit"
                  value={run.head.StorgeUnit}
                  mono
                  table={TABLE}
                  hint="[sic] — no second a, on this table"
                />
                <Field
                  label="Handling basis"
                  cmts="HandlingUnit"
                  value={run.head.HandlingUnit}
                  mono
                  table={TABLE}
                />
                <Field
                  label="Location basis"
                  cmts="LocationUnit"
                  value={run.head.LocationUnit}
                  mono
                  table={TABLE}
                />
                <Field
                  label="Location per-unit"
                  cmts="LocationUnitCharges"
                  value={formatPkr(run.head.LocationUnitCharges)}
                  mono
                  table={TABLE}
                  hint="a second location money column GODOWNRENTDETAIL has no twin for"
                />
              </div>
            </Card>

            {/* 3 · Roll-up vs rows */}
            <Card
              icon={<Scale size={15} />}
              title="The roll-up against the rows it summarises"
              subtitle="Eight sum-prefixed columns sit on the same row as the values they total. Nothing in the schema makes them agree, so a consumer reading the sums and a consumer reading the rows can reach different totals from one batch — and neither is detectably wrong."
              right={
                <CheckChip
                  ok={view.rollUp.breaks.length === 0}
                  okLabel="Σ rows = sum columns"
                  badLabel={`${view.rollUp.breaks.length} column${view.rollUp.breaks.length === 1 ? "" : "s"} disagree`}
                />
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Two money columns have <strong>no roll-up twin at all</strong> —{" "}
                  {view.rollUp.withoutRollUp.map((c) => (
                    <span key={String(c)} className="font-mono">
                      {String(c)}{" "}
                    </span>
                  ))}
                  — on a table where eight others have one. Anything totalling a run from the{" "}
                  <span className="font-mono">sum*</span> columns drops both, and{" "}
                  <span className="font-mono">SpecialCharges</span> carries the special-handling
                  money for every class except AFU.
                </p>
              }
            >
              {view.rollUp.stale && (
                <div className="mb-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#991B1B]">
                      The roll-up covers {view.rollUp.coveredRows} of {view.rollUp.rowCount} rows
                    </p>
                    <p className="text-[11px] text-[#B91C1C] mt-1 leading-snug">
                      Constructed, and deliberately so: the schema does not enforce agreement
                      between the <span className="font-mono">sum*</span> columns and the rows
                      beside them, and a fixture where they always agree demonstrates nothing about
                      that. The plausible reading is a stale roll-up — written when the batch was
                      created, not rewritten when a row was appended. The row outside it is shaded
                      above. Nothing on the row says which reading is authoritative, and{" "}
                      <span className="font-mono">sum*</span> is the one a voucher would print.
                    </p>
                  </div>
                </div>
              )}

              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>Per-row column</Th>
                      <Th right>Σ across the rows</Th>
                      <Th>Roll-up column</Th>
                      <Th right>As stored</Th>
                      <Th right>Drift</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rollUp.lines.map((l) => {
                      const broken = l.drift !== null && Math.abs(l.drift) > 0.005;
                      return (
                        <tr
                          key={String(l.rowColumn)}
                          className="border-b border-[#F1F5F9] last:border-0 align-top"
                          style={{ backgroundColor: broken ? "#FEF2F2" : undefined }}
                        >
                          <td className="px-3 py-2.5">
                            <span className="font-mono text-[11.5px] text-[#0F172A]">
                              {String(l.rowColumn)}
                            </span>
                            {l.note && (
                              <p className="text-[10px] text-[#B45309] mt-0.5 leading-snug max-w-[260px]">
                                {l.note}
                              </p>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {formatPkr(l.summed)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[11.5px] whitespace-nowrap">
                            {l.sumColumn === null ? (
                              <span className="text-[#B45309] italic">no sum column</span>
                            ) : (
                              <span className="text-[#0F172A]">{String(l.sumColumn)}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap">
                            {l.stored === null ? (
                              <span className="text-[#CBD5E1]">—</span>
                            ) : (
                              <span className="text-[#0F172A] font-semibold">
                                {formatPkr(l.stored)}
                              </span>
                            )}
                          </td>
                          <td
                            className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap"
                            style={{ color: broken ? "#DC2626" : "#CBD5E1" }}
                          >
                            {l.drift === null ? "—" : broken ? formatPkr(l.drift) : "0"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 4 · The day model */}
            <Card
              icon={<CalendarClock size={15} />}
              title="A window and a count, on the same row"
              subtitle="This table stores both StartDate/EndDate and NumberofDays, so the two can disagree — and it stores Freedays outright, which is not where the standard path gets its free period from."
              right={
                <CheckChip
                  ok={!view.days.countUnexplained}
                  okLabel="Count matches its window"
                  badLabel="Count matches neither reading"
                />
              }
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3.5">
                  <p className="text-[11px] font-semibold text-[#1B4F8B] uppercase tracking-wider">
                    The window
                  </p>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                      {formatDate(run.head.StartDate)}
                    </span>
                    <span className="text-[#94A3B8]">→</span>
                    <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                      {formatDate(run.head.EndDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <CmtsCol name="StartDate" table={TABLE} />
                    <CmtsCol name="EndDate" table={TABLE} />
                  </div>
                  <p className="text-[11px] text-[#475569] mt-2 leading-snug">
                    Opens at cargo intake — {formatDateTime(run.head.StartDate)}.
                  </p>
                </div>

                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    The count, read three ways
                  </p>
                  <div className="mt-2 flex flex-col gap-1.5">
                    {[
                      {
                        label: "As stored",
                        col: "NumberofDays",
                        value: view.days.NumberofDays,
                        tone: "#0F172A",
                      },
                      {
                        label: "Window, floor of 24h periods",
                        col: null,
                        value: view.days.demoCount,
                        tone: "#475569",
                      },
                      {
                        label: "Window, calendar days both ends",
                        col: null,
                        value: view.days.cmtsCount,
                        tone:
                          view.days.cmtsCount > view.days.NumberofDays ? "#DC2626" : "#475569",
                      },
                    ].map((rowItem) => (
                      <div
                        key={rowItem.label}
                        className="flex items-baseline justify-between gap-3"
                      >
                        <span className="text-[11.5px] text-[#475569]">
                          {rowItem.label} <CmtsCol name={rowItem.col} table={TABLE} />
                        </span>
                        <span
                          className="font-mono text-[13px] font-semibold whitespace-nowrap"
                          style={{ color: rowItem.tone }}
                        >
                          {rowItem.value} d
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-2 leading-snug">
                    The column name carries no counting rule, and the two readings of its own window
                    differ by {Math.abs(view.days.cmtsCount - view.days.demoCount)} day
                    {Math.abs(view.days.cmtsCount - view.days.demoCount) === 1 ? "" : "s"} (audit
                    §3.1).
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <Field
                  label="Free days"
                  cmts="Freedays"
                  value={String(view.days.Freedays)}
                  mono
                  table={TABLE}
                  hint="[sic] — one word, on this table"
                />
                <Field
                  label="Supplement days"
                  cmts="SUPPLIMENTDAYS"
                  value={String(view.days.SUPPLIMENTDAYS)}
                  mono
                  table={TABLE}
                  hint="[sic] — and upper-case, unlike grCharges"
                />
                <Field
                  label="Is supplement"
                  cmts="IsSuppliment"
                  value={view.days.IsSuppliment ? "true" : "false"}
                  mono
                  table={TABLE}
                  hint="[sic] — one p, i not e"
                />
                <Field
                  label="Is free"
                  cmts="ISFree"
                  value={run.head.ISFree ? "true" : "false"}
                  mono
                  table={TABLE}
                  tone={run.head.ISFree ? "#7C3AED" : undefined}
                  hint="[sic] — upper-case IS"
                />
              </div>

              <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <p className="font-mono text-[12px] text-[#0F172A] break-words">
                  NumberofDays {view.days.NumberofDays} − Freedays {view.days.Freedays} +
                  SUPPLIMENTDAYS {view.days.SUPPLIMENTDAYS} = {view.days.pricedDays} priced
                </p>
                <p className="text-[11px] text-[#64748B] mt-1.5 leading-snug">
                  Counted the way the legacy procedure counts its window, the same run prices{" "}
                  <span className="font-mono">{view.days.cmtsPricedDays}</span> days.
                  {view.days.freeRemaining > 0 && (
                    <>
                      {" "}
                      The allowance is not yet spent — {view.days.freeRemaining} free day
                      {view.days.freeRemaining === 1 ? "" : "s"} remain, so nothing on this run has
                      reached a priced band.
                    </>
                  )}
                </p>
              </div>

              <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                <p className="text-[12px] text-[#92400E] leading-snug">
                  <strong>Two tables, two sources for the free period.</strong> Here it is a stored
                  column: <span className="font-mono">Freedays = {view.days.Freedays}</span>, which
                  is what <span className="font-mono">CARGOCLASS.freeDays</span> says for this class
                  ({view.days.classFreeDays}). On the standard path the legacy procedure derives it
                  from the zero-amount rate row instead —{" "}
                  <span className="font-mono">
                    case when s.AMOUNT = 0 then s.DAYTO end
                  </span>{" "}
                  — which is the rule <span className="font-mono">grCharges</span> is measured
                  against in audit §3.2. Both are in the same schema. Neither says it is the
                  authority.
                </p>
              </div>

              {run.head.ISFree && run.head.MinimumCharges > 0 && (
                <div className="mt-3 rounded-xl border border-[#DDD6FE] bg-[#F5F3FF] px-4 py-3 flex items-start gap-2.5">
                  <HelpCircle size={14} className="text-[#7C3AED] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#5B21B6] leading-snug">
                    <span className="font-mono">ISFree</span> is set on this run and{" "}
                    <span className="font-mono">MinimumCharges</span> on the same row is{" "}
                    {formatPkr(run.head.MinimumCharges)}. A floor cannot both apply and not apply,
                    and nothing in the schema says whether <span className="font-mono">ISFree</span>{" "}
                    waives storage only or the whole voucher.
                  </p>
                </div>
              )}
            </Card>

            {/* 5 · Tax stored as text */}
            <Card
              icon={<Percent size={15} />}
              title="A percentage stored as text"
              subtitle="TaxPercentage is varchar on this table while Tax and both totals beside it are floats. Nothing constrains the string, so the column accumulates spellings — and every one of them has to survive migration into a numeric column."
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
                  The spellings across the runs on this tab are <strong>constructed</strong> — the
                  rate itself is not. Every <span className="font-mono">Tax</span> float here was
                  computed from the {view.tax.impliedPercent}% the illustrative rate card resolves,
                  the same rate the voucher prints. Only the way the percent is spelled into the
                  varchar varies, because that is the part a decade of unconstrained writes decides.
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
                        value: view.tax.castSucceeds ? String(view.tax.numberValue) : "conversion error",
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
                      Tax on this row <CmtsCol name="Tax" table={TABLE} />
                    </span>
                    <span className="font-mono text-[13px] font-bold text-[#0F172A]">
                      {formatPkr(run.head.Tax)}
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            {/* 6 · Money with no column */}
            <Card
              icon={<Receipt size={15} />}
              title="What this table cannot hold"
              subtitle="The engine computes more components than this row has columns for. Every one below with no column is money that reaches the voucher and never reaches the working set — so it can be billed and cannot be explained."
              right={
                <CheckChip
                  ok={view.unheld.unheldTotal === 0}
                  okLabel="Everything has a column"
                  badLabel={`${formatPkr(view.unheld.unheldTotal)} unheld`}
                />
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  This table can account for{" "}
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {formatPkr(view.unheld.recordedTotal)}
                  </span>{" "}
                  of the {formatPkr(view.unheld.engineSubTotal)} the engine computed before tax —{" "}
                  <strong>{view.unheld.heldPct}%</strong>. The free-hand table holds a different
                  subset: it has <span className="font-mono">DocumentationCharges</span>,{" "}
                  <span className="font-mono">DeconsolidationCharges</span> and an unclassified
                  bucket, and lacks the free-day and supplement columns this one has. The two paths
                  lose different money to the schema.
                </p>
              }
            >
              <div className="flex flex-col">
                {view.unheld.rungs.map((rung) => (
                  <div
                    key={rung.label}
                    className="flex items-baseline justify-between gap-3 py-2 border-b border-[#F1F5F9] last:border-0"
                    style={{ backgroundColor: rung.column === null && rung.amount > 0 ? "#FFFBEB" : undefined }}
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
                          rung.amount === 0 ? "#CBD5E1" : rung.column === null ? "#B45309" : "#334155",
                      }}
                    >
                      {formatPkr(rung.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            {/* 7 · The three paths */}
            <PathMatrix highlight="temp" />

            {/* 8 · Denormalisation & keys */}
            <Card
              icon={<Boxes size={15} />}
              title="34 modelled, 4 left off"
              subtitle="The header repeats on every row, exactly as it does on grCharges. Four further columns are surrogate keys and are deliberately not modelled."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  {CALC_KEY_COLUMNS.map((c) => (
                    <span key={c} className="font-mono">
                      {c}{" "}
                    </span>
                  ))}
                  — surrogate keys with nothing to key in a prototype with no backend. Class,
                  subclass and zone resolve through the AWB, which is how the rest of this repo
                  joins. 34 + 4 = 38. <span className="font-mono">CityId</span> is modelled and is
                  not an exception: it is the tenancy discriminator the whole repo scopes on, and on
                  a table with no AWB column it is the only thing narrowing a correlator collision
                  to one site.
                </p>
              }
            >
              <div className="flex flex-wrap gap-1.5">
                {(
                  [
                    ["StorgeUnit", "Storage, no second a"],
                    ["StorgeUnitCharges", "same, on the money column"],
                    ["SUPPLIMENTDAYS", "one p, i not e — and upper-case here"],
                    ["IsSuppliment", "one p, i not e"],
                    ["Freedays", "one word"],
                    ["NumberofDays", "lower-case o"],
                    ["ISFree", "upper-case IS"],
                    ["sumAFUAmount", "sum-prefixed roll-up, mixed case"],
                  ] as const
                ).map(([col, why]) => (
                  <span
                    key={col}
                    className="h-[24px] px-2 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold inline-flex items-center gap-1.5 font-mono"
                    title={`Reproduced exactly as TempImportCalculation spells it — ${why}`}
                  >
                    {col}
                    <Sic note={`${why} — deliberate, parity is checked by column name`} />
                  </span>
                ))}
              </div>
              <p className="text-[11px] text-[#64748B] mt-3 leading-snug">
                Every one of these is reproduced exactly as{" "}
                <span className="font-mono">TempImportCalculation</span> spells it. Parity is
                measured per table: <span className="font-mono">GODOWNRENT</span> spells the
                supplement column <span className="font-mono">SUPPLIMENTDAYS</span> and{" "}
                <span className="font-mono">grCharges</span> spells it{" "}
                <span className="font-mono">SupplimentDays</span>, and each is right on its own row.
                Correcting any of them here would make a mapped column read as unmapped.
              </p>
            </Card>

            {/* 9 · Open questions */}
            <Card
              icon={<HelpCircle size={15} />}
              title="Questions the schema cannot answer"
              subtitle="Findings that live in the column list rather than in the arithmetic. None can be settled from a schema-only restore, and each is a decision SAPS has to take before this table migrates."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  <Check size={11} className="inline text-[#16A34A]" /> Q8 decided this table is
                  visible as derivation and never as a document an operator files. It is the audit
                  trail behind a number already on a voucher — which is why every question here is
                  addressed to the migration, not to the counter.
                </p>
              }
            >
              <div className="flex flex-col gap-3">
                {TEMP_IMPORT_AMBIGUITIES.map((a) => (
                  <div key={a.columns.join("|")} className="rounded-xl border border-[#E2E8F0] px-4 py-3">
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
