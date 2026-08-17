"use client";

/**
 * Charge Working Set — the three CMTS charge derivations, on one screen.
 *
 *   tab 1  `grCharges` (47)               standard import godown rent  · here
 *   tab 2  `TempImportCalculation` (38)   temporary import             · TempImportTab
 *   tab 3  `ImportFreeHandedCalc` (22)    free-hand / manually keyed   · FreeHandTab
 *
 * WHY THREE TABS AND NOT THREE SCREENS
 * ------------------------------------
 * `CMTS_SCOPE_DECISIONS.md` Q8. All three tables are backend-era working state,
 * and the ticket originally proposed closing the two newer ones on exactly that
 * ground. The reasoning was half right and led to the wrong action, because
 * `grCharges` is working state too and a derivation view was built for it —
 * "why is this the amount?" is the most useful question a billing demo answers.
 * Consistency decides the rest: the three tables record the same thing for three
 * different billing paths, so they belong on one screen with a tab per path.
 *
 * The division is BY PATH, and deliberately not by concern. A "days" tab and a
 * "money" tab across all three would read tidier and would be a lie: the three
 * tables do not share a day model (one derives free days from the rate row, one
 * stores them, one has no allowance column at all) and they do not share a money
 * model (one has an unclassified bucket, one has none, one splits special
 * handling across two columns by cargo class). Each tab is therefore laid out
 * for what its own table actually carries. See `PathMatrix`, which is the one
 * place the three are compared column by column.
 *
 * None of the three is presented as a document an operator files. They are the
 * audit trail behind a number already on a voucher, and nothing on any tab
 * writes.
 *
 * WHAT THIS TAB IS FOR — `grCharges`, gap B2
 * ------------------------------------------
 * The table had no interface and no screen, in CMTS or here. The gap report
 * scores the best existing overlap at 13% against `/billing/calculator`, which
 * is right: the calculator computes a charge, the godown-rent voucher prints
 * one, and NEITHER records the walk in between.
 *
 * One question: **why is it this amount?** Everything below is ordered as the
 * answer is given, and nothing is here that does not move that answer forward:
 *
 *   1. which run am I looking at        — the batch key, and whether it was billed
 *   2. what period was priced           — two date pairs, and they differ
 *   3. how the days were divided        — free vs priced vs supplement
 *   4. which bands the engine walked    — the slab table, adding to the storage figure
 *   5. how the bands became a total     — the money ladder, closing on totalAmount
 *   6. would CMTS have agreed           — the bridge, in two named steps
 *   7. what the row cannot tell you     — location, houses, denormalisation, risks
 *
 * SURFACE, DO NOT RECONCILE
 * -------------------------
 * Six rules in CMTS_SCHEMA_AUDIT §3 disagree with this demo's arithmetic. Not
 * one of them is corrected here and no existing calculation is touched — the
 * screen prices both readings side by side and says which is which. On the
 * consignments in this fixture set the demo bills roughly half of what the
 * legacy procedure would, and a migration that discovers that after cutover
 * discovers it as a revenue hole.
 *
 * The domain models live in `lib/domain/grcharges.ts` and `lib/domain/importcalc.ts`,
 * both imported directly rather than through the barrel — several tickets are
 * landing domain files in the same window and `lib/domain/index.ts` is a
 * shared-conflict file.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Boxes,
  Calculator,
  CalendarClock,
  Check,
  Database,
  FileText,
  GitCompare,
  HelpCircle,
  Layers,
  MapPin,
  Receipt,
  Scale,
  Timer,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import { formatDate, formatDateTime, formatKg, formatPkr, round2 } from "@/lib/domain";
import {
  COLUMN_AMBIGUITIES,
  GR_CHARGE_KEY_COLUMNS,
  OPEN_BAND_DAYTO,
  cmtsBridge,
  columnVariance,
  dayDecomposition,
  houseRollUp,
  listGrChargeSets,
  locationReading,
  moneyLadder,
  ruleDisagreements,
  type GrChargesWorkingSet,
} from "@/lib/domain/grcharges";
import { TEMP_IMPORT_RUNS, FREE_HAND_ENTRIES } from "@/lib/domain/importcalc";
import { BILL_TONE, Card, CmtsCol, Field, SEVERITY_TONE, Th } from "./ui";
import TempImportTab from "./TempImportTab";
import FreeHandTab from "./FreeHandTab";

/**
 * The three paths, and the table each one records into.
 *
 * `grCharges` leads because it is the standard path and the one every other
 * screen in `/billing` already points at; the two added by Q8 follow in column
 * order. The tab label carries the CMTS table name rather than a friendly one —
 * on a parity screen the table IS the subject, and a reader scanning for
 * `TempImportCalculation` should be able to find it by that name.
 */
const PATHS = [
  {
    value: "grcharges" as const,
    label: "Standard import",
    table: "grCharges",
    columns: 47,
    modelled: 43,
    blurb:
      "Not a document — the scratch the charge engine writes as it walks. One row per rate band it touched, the whole consignment header copied onto every row. The voucher can print the amount; only this can answer why it is that amount.",
  },
  {
    value: "temp" as const,
    label: "Temporary import",
    table: "TempImportCalculation",
    columns: 38,
    modelled: 34,
    blurb:
      "The same question on cargo that was never meant to stay. No rate-band columns, so the derivation stops one level higher than the standard path — and per-row values sit beside their own roll-ups, which nothing makes agree.",
  },
  {
    value: "freehand" as const,
    label: "Free-hand",
    table: "ImportFreeHandedCalc",
    columns: 22,
    modelled: 18,
    blurb:
      "The manual path (Q4 — live, not abandoned). Here the answer to “why is it this amount?” is that somebody typed it, so the derivation is the keyed figure against the derived one. One row, no window, and no column naming who keyed it.",
  },
];

type PathValue = (typeof PATHS)[number]["value"];

/** The day bar's three (four with a supplement) segments, in dwell order. */
function daySegments(d: ReturnType<typeof dayDecomposition>) {
  return [
    {
      key: "grace",
      label: "Class grace",
      cmts: "CARGOCLASS.freeDays",
      days: d.graceUsed,
      colour: "#BBF7D0",
      text: "#15803D",
    },
    {
      key: "slab",
      label: "Zero-rate band",
      cmts: "ChargesAmount = 0",
      days: d.slabFreeDays,
      colour: "#86EFAC",
      text: "#166534",
    },
    {
      key: "priced",
      label: "Priced days",
      cmts: "NormalDays",
      days: d.normalDays,
      colour: "#FDE68A",
      text: "#92400E",
    },
    {
      key: "supp",
      label: "Supplement",
      cmts: "SupplimentDays",
      days: d.supplimentDays,
      colour: "#DDD6FE",
      text: "#6D28D9",
    },
  ].filter((s) => s.days > 0);
}

/* ================================================================== *
 * Page
 * ================================================================== */

export default function ChargeWorkingSetPage() {
  const { scope, isHq } = useSite();
  const [path, setPath] = useState<PathValue>("grcharges");
  const activePath = PATHS.find((p) => p.value === path) ?? PATHS[0];
  const sets = useMemo(() => listGrChargeSets(scope), [scope]);

  const [selectedKey, setSelectedKey] = useState<string | null>(sets[0]?.key ?? null);
  const set: GrChargesWorkingSet | null =
    sets.find((s) => s.key === selectedKey) ?? sets[0] ?? null;

  /**
   * The site-wide headline. Computed across every run in scope rather than off
   * the selected one, because "how much does this demo under-bill" is not a
   * per-consignment question — it is the reason the ticket exists.
   */
  const totals = useMemo(() => {
    let rows = 0;
    let demoStorage = 0;
    let cmtsStorage = 0;
    let uncommitted = 0;
    for (const s of sets) {
      const b = cmtsBridge(s);
      rows += s.rows.length;
      demoStorage += b.demoStorage;
      cmtsStorage += b.cmtsStorage;
      if (!s.VOUCHERNO) uncommitted += 1;
    }
    return {
      rows,
      uncommitted,
      demoStorage: round2(demoStorage),
      cmtsStorage: round2(cmtsStorage),
      gap: round2(cmtsStorage - demoStorage),
    };
  }, [sets]);

  const view = useMemo(
    () =>
      set
        ? {
            days: dayDecomposition(set),
            ladder: moneyLadder(set),
            bridge: cmtsBridge(set),
            houses: houseRollUp(set),
            variance: columnVariance(set),
            location: locationReading(set),
            disagreements: ruleDisagreements(set),
          }
        : null,
    [set],
  );

  /**
   * The walk, grouped the way the engine wrote it. A consolidation is priced
   * house by house, so its rows repeat the band under each house — grouping
   * them is what stops the table reading as twelve unrelated bands.
   */
  const groups = useMemo(() => {
    if (!set || !view) return [];
    if (!set.head.IsHwb) {
      return [{ key: "master", label: null as string | null, sub: null as string | null, rows: set.rows, total: set.head.StorageAmount }];
    }
    return view.houses.lines.map((l) => ({
      key: l.HWB,
      label: `${l.HWB}${l.HWBSubIndexno ? ` · sub-index ${l.HWBSubIndexno}` : ""}`,
      sub: `${l.HWBPcs} pcs · ${formatKg(l.HWBChargeableWeight)} · ${l.HWBContents}`,
      rows: set.rows.filter((r) => r.HWB === l.HWB),
      total: l.storageShare,
    }));
  }, [set, view]);

  const walkTotal = set ? round2(set.rows.reduce((n, r) => n + r.ChargesAmount, 0)) : 0;
  const walkAgrees = set ? Math.abs(walkTotal - set.head.StorageAmount) < 0.01 : true;

  return (
    <div className="flex flex-col gap-6">
      {/* ---------------- Header ---------------- */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Charge Working Set" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              FC-07 §01–08
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              {activePath.table} {activePath.columns} · {activePath.modelled} MODELLED
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              {path === "grcharges" ? "GAP B2 — NO FORM" : "Q8 — DERIVATION, NOT A DOCUMENT"}
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Charge Working Set
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-[860px]">
            {activePath.blurb}
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* ---------------- Path tabs ----------------
       *
       * One tab per BILLING PATH, because that is the only division the three
       * tables actually share — see the file header. The row counts are live so
       * the tab bar doubles as the answer to "does this site use that path at
       * all", which on the free-hand tab is a question worth asking.
       */}
      <div className="flex items-end gap-2 flex-wrap border-b border-[#E2E8F0]">
        {PATHS.map((p) => {
          const active = path === p.value;
          const count =
            p.value === "grcharges"
              ? sets.length
              : p.value === "temp"
                ? TEMP_IMPORT_RUNS.filter((r) => isHq || r.site === scope).length
                : FREE_HAND_ENTRIES.filter((e) => isHq || e.site === scope).length;
          return (
            <button
              key={p.value}
              onClick={() => setPath(p.value)}
              className="px-4 py-2.5 border-b-2 -mb-px text-left transition-colors cursor-pointer"
              style={{
                borderColor: active ? "#0B2545" : "transparent",
                backgroundColor: active ? "#F8FAFC" : "transparent",
              }}
            >
              <span
                className="text-[13px] font-semibold block"
                style={{ color: active ? "#0B2545" : "#64748B" }}
              >
                {p.label}
                <span
                  className="ml-1.5 h-[16px] px-1.5 rounded text-[9px] font-bold inline-flex items-center font-mono align-middle"
                  style={
                    count === 0
                      ? { backgroundColor: "#F1F5F9", color: "#94A3B8" }
                      : { backgroundColor: "#EBF0F7", color: "#1B4F8B" }
                  }
                >
                  {count}
                </span>
              </span>
              <span
                className="text-[10px] font-mono block mt-0.5"
                style={{ color: active ? "#64748B" : "#CBD5E1" }}
              >
                {p.table}
              </span>
            </button>
          );
        })}
      </div>

      {path === "temp" && <TempImportTab />}
      {path === "freehand" && <FreeHandTab />}

      {path === "grcharges" && (
        <>
      {/* ---------------- KPI strip ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          {
            label: "Engine runs",
            value: String(sets.length),
            tone: "#0F172A",
            hint: "grouped by cahrgesUniqueIdentification",
          },
          {
            label: "Slab rows",
            value: String(totals.rows),
            tone: "#0F172A",
            hint: "one per band × house line",
          },
          {
            label: "Runs with no voucher",
            value: String(totals.uncommitted),
            tone: totals.uncommitted > 0 ? "#7C3AED" : "#64748B",
            hint: "quotes and supplementary re-runs — priced, never billed",
          },
          {
            label: "Storage across these runs",
            value: formatPkr(totals.demoStorage),
            tone: "#1B4F8B",
            hint: "Σ StorageAmount — runs, not consignments",
          },
          {
            label: "…walked the CMTS way",
            value: formatPkr(totals.cmtsStorage),
            tone: totals.gap > 0 ? "#DC2626" : "#16A34A",
            hint:
              totals.gap > 0
                ? `${formatPkr(totals.gap)} more, on the same runs`
                : "the two readings agree",
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

      {sets.length === 0 || !set || !view ? (
        <EmptyState
          title="No charge runs at this site"
          description="The engine writes a working set when an AWB is priced. Nothing at this site has reached the charging stage."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* ---------------- Run picker ---------------- */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Calculator size={15} className="text-[#64748B]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#0F172A]">Engine runs</h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  A run is a batch key, not a document
                </p>
              </div>
            </div>
            <div className="max-h-[620px] overflow-y-auto">
              {sets.map((s) => {
                const tone = BILL_TONE[s.head.Billtype] ?? BILL_TONE.NORMAL;
                return (
                  <button
                    key={s.key}
                    onClick={() => setSelectedKey(s.key)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    style={{ backgroundColor: set.key === s.key ? "#EBF0F7" : undefined }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[11.5px] font-semibold text-[#0F172A] truncate">
                        {s.key}
                      </span>
                      <span
                        className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center flex-shrink-0"
                        style={{ backgroundColor: tone.bg, color: tone.fg }}
                      >
                        {s.head.Billtype}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5 font-mono">
                      {formatPkr(s.head.totalAmount)} · {s.rows.length} row
                      {s.rows.length === 1 ? "" : "s"}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {s.VOUCHERNO ? (
                        <span className="font-mono">{s.VOUCHERNO}</span>
                      ) : (
                        <span className="italic">no voucher — {s.purpose}</span>
                      )}
                    </p>
                  </button>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <p className="text-[11px] text-[#64748B]">
                One AWB can carry several runs. The engine is scratch — it rewrites, and{" "}
                <span className="font-mono text-[10px]">cahrgesUniqueIdentification</span> is the
                only thing holding a pass together.
              </p>
            </div>
          </div>

          {/* ---------------- Detail ---------------- */}
          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* 1 · Run identity */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                      Run
                    </span>
                    <CmtsCol name="cahrgesUniqueIdentification" />
                    <span
                      className="h-[16px] px-1.5 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono"
                      title="CMTS spells it with the 'ah' transposed. Reproduced exactly — parity is checked by column name."
                    >
                      [sic]
                    </span>
                  </div>
                  <p className="font-mono text-[18px] font-bold text-[#0F172A] mt-0.5 break-all">
                    {set.key}
                  </p>
                  <p className="text-[12px] text-[#64748B] mt-1.5 flex items-baseline gap-1.5 flex-wrap">
                    <AwbLink awbNo={set.AWBNO} awbId={set.awbId} />
                    <CmtsCol name="AWBNO" />
                    <span className="text-[#CBD5E1]">·</span>
                    <span>IGM</span>
                    <span className="font-mono text-[#0F172A]">{set.head.IGMNO}</span>
                    <CmtsCol name="IGMNO" />
                    <span className="text-[#CBD5E1]">·</span>
                    <span>{set.head.Cargoclass}</span>
                  </p>
                </div>
                <div className="text-right">
                  <div className="flex items-baseline gap-1.5 justify-end">
                    <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      Run total
                    </span>
                    <CmtsCol name="totalAmount" />
                  </div>
                  <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                    {formatPkr(set.head.totalAmount)}
                  </p>
                  {set.VOUCHERNO ? (
                    <p className="text-[11px] text-[#64748B] mt-1 inline-flex items-center gap-1 justify-end">
                      <Receipt size={11} className="text-[#94A3B8]" />
                      billed on <span className="font-mono font-semibold">{set.VOUCHERNO}</span>
                    </p>
                  ) : (
                    <p className="text-[11px] text-[#94A3B8] mt-1 max-w-[280px] leading-snug">
                      <span className="font-mono text-[#CBD5E1]">null</span> voucher — {set.purpose}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                <Field label="Cargo class" cmts="Cargoclass" value={set.head.Cargoclass} />
                <Field
                  label="Cargo date"
                  cmts="CARGODATE"
                  value={formatDate(set.head.CARGODATE)}
                  mono
                  hint="the procedure's dwell origin"
                />
                <Field label="Pieces" cmts="PcsOnAWB" value={String(set.head.PcsOnAWB)} mono />
                <Field
                  label="Gross weight"
                  cmts="GrosssWeight"
                  value={formatKg(set.head.GrosssWeight)}
                  mono
                  hint="[sic] — three s in the legacy column"
                />
                <Field label="Bill type" cmts="Billtype" value={set.head.Billtype} mono />
                <Field
                  label="Is supplement"
                  cmts="IsSuppliment"
                  value={set.head.IsSuppliment ? "true" : "false"}
                  mono
                  hint="[sic] — the same fact as Billtype, typed twice"
                />
                <Field
                  label="Chargeable weight"
                  cmts={null}
                  value={formatKg(set.chargeableKg)}
                  mono
                  hint="the basis every band was priced on"
                />
                <Field
                  label="House lines"
                  cmts="IsHwb"
                  value={set.head.IsHwb ? `true · ${view.houses.lines.length}` : "false"}
                  mono
                />
              </div>
            </div>

            {/* 2 · Periods */}
            <Card
              icon={<CalendarClock size={15} />}
              title="Two date pairs, one consignment"
              subtitle="grCharges carries a voucher period and a priced window, and nothing in the schema says which is which. Read here as the GR period and the engine's own window — a reading, not a documented fact."
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
                  <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                    Voucher period
                  </p>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span
                      className="font-mono text-[13px] font-semibold"
                      style={{ color: set.head.grFromDate ? "#0F172A" : "#CBD5E1" }}
                    >
                      {set.head.grFromDate ? formatDate(set.head.grFromDate) : "null"}
                    </span>
                    <span className="text-[#94A3B8]">→</span>
                    <span
                      className="font-mono text-[13px] font-semibold"
                      style={{ color: set.head.grToDate ? "#0F172A" : "#CBD5E1" }}
                    >
                      {set.head.grToDate ? formatDate(set.head.grToDate) : "null"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <CmtsCol name="grFromDate" />
                    <CmtsCol name="grToDate" />
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-2 leading-snug">
                    {set.head.grFromDate
                      ? "Opens at cargo arrival — the period the voucher says it covers."
                      : "This run was never written onto a voucher, so it has no GR period. Null is the state, not missing data."}
                  </p>
                </div>

                <div className="rounded-xl border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3.5">
                  <p className="text-[11px] font-semibold text-[#1B4F8B] uppercase tracking-wider">
                    Window actually priced
                  </p>
                  <div className="flex items-baseline gap-2 mt-1 flex-wrap">
                    <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                      {formatDate(set.head.fromdate)}
                    </span>
                    <span className="text-[#94A3B8]">→</span>
                    <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                      {formatDate(set.head.endDate)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <CmtsCol name="fromdate" />
                    <CmtsCol name="endDate" />
                  </div>
                  <p className="text-[11px] text-[#475569] mt-2 leading-snug">
                    Opens at cargo intake — {formatDateTime(set.head.fromdate)}.
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                <Field
                  label="Elapsed time"
                  cmts="totalTime"
                  value={`${set.head.totalTime} h`}
                  mono
                  hint="unit undocumented — modelled as hours"
                />
                <Field
                  label="Ramp gap"
                  cmts="CARGODATE → fromdate"
                  value={`${view.bridge.rampGapHours} h`}
                  mono
                  hint="landed but not yet in the shed"
                />
                <Field
                  label="Dwell as billed"
                  cmts="TotalDays"
                  value={`${view.bridge.demoDwellDays} d`}
                  mono
                />
                <Field
                  label="Dwell per the procedure"
                  cmts="DATEDIFF+1 from CARGODATE"
                  value={`${view.bridge.cmtsDwellDays} d`}
                  mono
                  tone={view.bridge.cmtsDwellDays > view.bridge.demoDwellDays ? "#DC2626" : "#0F172A"}
                />
              </div>

              {view.bridge.rampGapHours > 0 && (
                <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                  <Timer size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                  <p className="text-[12px] text-[#92400E] leading-snug">
                    The two pairs do not start together. The voucher period opens at{" "}
                    <span className="font-mono">CARGODATE</span>; the engine priced from cargo
                    intake, <strong>{view.bridge.rampGapHours} hours later</strong>. This demo
                    treats that gap as the handler&rsquo;s and never bills it — the CMTS procedure
                    counts from <span className="font-mono">CARGODATE</span> and does.
                  </p>
                </div>
              )}
            </Card>

            {/* 3 · Day decomposition */}
            <Card
              icon={<Layers size={15} />}
              title="How the days were divided"
              subtitle="The reason five day columns exist. The charge is banded, so the dwell has to be split before anything can be priced."
              right={
                view.days.residual === 0 ? (
                  <span className="h-[18px] px-1.5 rounded bg-[#DCFCE7] text-[#16A34A] text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                    <Check size={10} strokeWidth={3} /> Parts add back
                  </span>
                ) : (
                  <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                    <AlertTriangle size={10} strokeWidth={2.5} /> {view.days.residual} d unaccounted
                  </span>
                )
              }
            >
              {(() => {
                const segs = daySegments(view.days);
                const span = segs.reduce((n, s) => n + s.days, 0);
                return span === 0 ? (
                  <p className="text-[12px] text-[#94A3B8]">
                    Nothing has elapsed yet — the engine ran on the day of intake.
                  </p>
                ) : (
                  <>
                    <div className="flex h-9 rounded-lg overflow-hidden border border-[#E2E8F0]">
                      {segs.map((s) => (
                        <div
                          key={s.key}
                          className="flex items-center justify-center min-w-0"
                          style={{ width: `${(s.days / span) * 100}%`, backgroundColor: s.colour }}
                          title={`${s.label} — ${s.days} day(s)`}
                        >
                          <span
                            className="text-[11px] font-bold font-mono truncate px-1"
                            style={{ color: s.text }}
                          >
                            {s.days}d
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 mt-3">
                      {segs.map((s) => (
                        <div key={s.key} className="flex items-center gap-1.5">
                          <span
                            className="w-3 h-3 rounded-sm border border-[#E2E8F0] flex-shrink-0"
                            style={{ backgroundColor: s.colour }}
                          />
                          <span className="text-[11px] text-[#475569]">{s.label}</span>
                          <CmtsCol name={s.cmts} />
                        </div>
                      ))}
                    </div>
                  </>
                );
              })()}

              <div className="mt-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <p className="font-mono text-[12px] text-[#0F172A] break-words">
                  TotalDays {view.days.totalDays} + SupplimentDays {view.days.supplimentDays} ={" "}
                  {view.days.graceUsed} grace + {view.days.slabFreeDays} zero-rate +{" "}
                  {view.days.normalDays} priced
                </p>
                {view.days.graceRemaining > 0 && (
                  <p className="text-[11px] text-[#15803D] mt-1.5">
                    The class grace is not yet spent — {view.days.graceRemaining} free day
                    {view.days.graceRemaining === 1 ? "" : "s"} remain, so nothing has reached a
                    priced band.
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                <Field label="Total days" cmts="TotalDays" value={String(view.days.totalDays)} mono />
                <Field
                  label="Total days (twin)"
                  cmts="Totalday"
                  value={String(view.days.totalday)}
                  mono
                  tone={view.days.twinsDisagree ? "#DC2626" : undefined}
                  hint="a second column for the same number"
                />
                <Field
                  label="Free days applied"
                  cmts="TotalFreeDays"
                  value={String(view.days.totalFreeDays)}
                  mono
                  hint={`${view.days.classFreeDays} class + ${view.days.slabFreeDays} zero-rate band`}
                />
                <Field
                  label="Extra free days"
                  cmts="ExtraFreeDays"
                  value={String(view.days.extraFreeDays)}
                  mono
                  hint="no equivalent on the demo's charge path"
                />
                <Field label="Priced days" cmts="NormalDays" value={String(view.days.normalDays)} mono />
                <Field
                  label="Supplement days"
                  cmts="SupplimentDays"
                  value={String(view.days.supplimentDays)}
                  mono
                  hint="[sic] — and it moves the bill UP"
                />
              </div>

              {view.days.slabFreeDays > 0 && (
                <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3 flex items-start gap-2.5">
                  <AlertTriangle size={14} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#991B1B]">
                      The free period is granted twice
                    </p>
                    <p className="text-[11px] text-[#B91C1C] mt-1 leading-snug">
                      The demo subtracts <span className="font-mono">CARGOCLASS.freeDays</span> (
                      {view.days.classFreeDays}d) and then walks a band table whose first band is
                      free ({view.days.slabFreeDays}d) — {view.days.classFreeDays + view.days.slabFreeDays}{" "}
                      free days in total. CMTS derives the free period from the zero-amount rate row
                      and nowhere else, which gives {view.days.cmtsRuleFreeDays}d. The working set is
                      the only place both grants are visible at once; on the voucher they are one
                      number.
                    </p>
                  </div>
                </div>
              )}
            </Card>

            {/* 4 · The band walk */}
            <Card
              icon={<Calculator size={15} />}
              title="The bands the engine walked"
              subtitle="One row per rate band — and per house line, where the consignment is a consolidation. This is the table's whole reason to exist."
              right={
                <span
                  className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  style={
                    walkAgrees
                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  }
                >
                  {walkAgrees ? (
                    <>
                      <Check size={10} strokeWidth={3} /> Σ rows = StorageAmount
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={10} strokeWidth={2.5} /> Σ rows ≠ StorageAmount
                    </>
                  )}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Neither the rate nor the priced weight is a column.{" "}
                  <span className="font-mono">ChargesAmount</span> and{" "}
                  <span className="font-mono">ChargesDaysNoOfDays</span> are, and the rate is what
                  divides out of them — which is why a disputed line cannot be checked against a
                  rate card without this screen. <span className="font-mono">DAYFROM</span>/
                  <span className="font-mono">DAYTO</span> are the rate table&rsquo;s band;{" "}
                  <span className="font-mono">ChargesDaysNoOfDays</span> is how much of this
                  consignment fell into it.
                  {set.head.IsHwb
                    ? " On a consolidation the band amount is allocated across the houses by weight share, so priced kg is the master's weight carrying that share — the houses' own declared weights are under House lines."
                    : ""}
                </p>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>
                        Band
                        <CmtsCol name="DAYFROM · DAYTO" block />
                      </Th>
                      <Th>
                        Days in band
                        <CmtsCol name="ChargesDaysNoOfDays" block />
                      </Th>
                      <Th>
                        Basis
                        <CmtsCol name="Unit" block />
                      </Th>
                      <Th right>
                        Rate
                        <CmtsCol name={null} block />
                      </Th>
                      <Th right>
                        Priced kg
                        <CmtsCol name={null} block />
                      </Th>
                      <Th right>
                        Amount
                        <CmtsCol name="ChargesAmount" block />
                      </Th>
                      <Th right>Running</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      let running = 0;
                      return groups.flatMap((g) => {
                        const head =
                          g.label === null
                            ? []
                            : [
                                <tr key={`${g.key}-head`} className="bg-[#EBF0F7]">
                                  <td colSpan={5} className="px-3 py-2">
                                    <span className="font-mono text-[12px] font-semibold text-[#0B2545]">
                                      {g.label}
                                    </span>
                                    <p className="text-[10px] text-[#475569] mt-0.5">{g.sub}</p>
                                  </td>
                                  <td
                                    colSpan={2}
                                    className="px-3 py-2 text-right font-mono text-[12px] font-semibold text-[#0B2545] whitespace-nowrap"
                                  >
                                    {formatPkr(g.total)}
                                  </td>
                                </tr>,
                              ];
                        const body = g.rows.map((r, ri) => {
                          running = round2(running + r.ChargesAmount);
                          /*
                           * The basis this ROW was priced on. For a direct AWB
                           * that is simply the master's chargeable weight. For a
                           * consolidation the band amount is allocated across the
                           * houses by their share, so the row's basis is the
                           * master weight carrying the same share — NOT the
                           * house's own declared `HWBChargeableWeight`.
                           *
                           * The two differ, and the difference is real: the
                           * houses' declared weights do not sum to the master's.
                           * Using the declared weight here would make the rate
                           * divide out at 34.31 instead of 35 and read as a
                           * pricing error, when it is a weight-reconciliation
                           * one — which is reported where it belongs, under
                           * House lines.
                           */
                          const kg =
                            r.HWBChargeableWeight !== null && view.houses.weightOnLines > 0
                              ? round2(
                                  set.chargeableKg *
                                    (r.HWBChargeableWeight / view.houses.weightOnLines),
                                )
                              : set.chargeableKg;
                          const rate =
                            r.ChargesDaysNoOfDays > 0 && kg > 0
                              ? round2(r.ChargesAmount / r.ChargesDaysNoOfDays / kg)
                              : 0;
                          const free = r.ChargesAmount === 0;
                          return (
                            <tr
                              key={`${g.key}-${ri}`}
                              className="border-b border-[#F1F5F9] last:border-0"
                              style={{ backgroundColor: free ? "#F0FDF4" : undefined }}
                            >
                              <td className="px-3 py-2.5 whitespace-nowrap">
                                <span className="font-mono text-[12px] font-medium text-[#0F172A]">
                                  {r.DAYFROM}–
                                  {r.DAYTO === OPEN_BAND_DAYTO ? OPEN_BAND_DAYTO : r.DAYTO}
                                </span>
                                {r.DAYTO === OPEN_BAND_DAYTO && (
                                  <span
                                    className="ml-1.5 h-[16px] px-1 rounded bg-[#F1F5F9] text-[#64748B] text-[9px] font-bold inline-flex items-center font-mono"
                                    title="int column, so the open band carries a sentinel rather than null"
                                  >
                                    open
                                  </span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                                {r.ChargesDaysNoOfDays}
                              </td>
                              <td className="px-3 py-2.5 text-[11.5px] text-[#64748B] whitespace-nowrap">
                                {r.Unit}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] whitespace-nowrap">
                                {free ? (
                                  <span className="text-[#16A34A] font-semibold">free</span>
                                ) : (
                                  <span className="text-[#475569]">{formatPkr(rate)}/kg/day</span>
                                )}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#475569] whitespace-nowrap">
                                {formatKg(kg)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                                {formatPkr(r.ChargesAmount)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#94A3B8] whitespace-nowrap">
                                {formatPkr(running)}
                              </td>
                            </tr>
                          );
                        });
                        return [...head, ...body];
                      });
                    })()}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-[#0B2545] bg-[#F8FAFC]">
                      <td
                        colSpan={5}
                        className="px-3 py-2.5 text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider"
                      >
                        Σ rows → StorageAmount
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono text-[13px] font-bold text-[#0B2545] whitespace-nowrap">
                        {formatPkr(walkTotal)}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>

            {/* 5 · The money ladder */}
            <Card
              icon={<Receipt size={15} />}
              title="From the bands to the total"
              subtitle="Every rung, and the two that grCharges has no column for. The ladder only closes once they are added back — which is the migration finding, not a rounding note."
              right={
                <span
                  className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  style={
                    view.ladder.break === 0
                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  }
                >
                  {view.ladder.break === 0 ? (
                    <>
                      <Check size={10} strokeWidth={3} /> Closes on totalAmount
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={10} strokeWidth={2.5} /> Off by{" "}
                      {formatPkr(view.ladder.break)}
                    </>
                  )}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Reconstructible from <span className="font-mono">grCharges</span> columns alone:{" "}
                  <span className="font-mono font-semibold text-[#0F172A]">
                    {formatPkr(view.ladder.reconstructible)}
                  </span>{" "}
                  of {formatPkr(view.ladder.totalAmount)} —{" "}
                  <strong>{view.ladder.reconstructiblePct}%</strong>. Migrate this table on its own
                  and the rest cannot be recomputed: the category surcharge and the subclass floor
                  have no column here, and neither does the rate that produced the bands.
                </p>
              }
            >
              <div className="flex flex-col">
                {view.ladder.parts.map((p) => (
                  <div
                    key={p.label}
                    className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F1F5F9]"
                  >
                    <div className="min-w-0">
                      <span className="text-[12px] text-[#334155]">{p.label}</span>{" "}
                      <CmtsCol name={p.cmts} />
                      {p.note && (
                        <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-snug">{p.note}</p>
                      )}
                    </div>
                    <span
                      className="font-mono text-[13px] font-medium whitespace-nowrap"
                      style={{ color: p.amount === 0 ? "#CBD5E1" : "#334155" }}
                    >
                      {formatPkr(p.amount)}
                    </span>
                  </div>
                ))}

                <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[#E2E8F0]">
                  <span className="text-[12px] font-semibold text-[#0F172A]">
                    Σ the seven charge columns
                  </span>
                  <span className="font-mono text-[13px] font-bold text-[#0F172A]">
                    {formatPkr(view.ladder.partsTotal)}
                  </span>
                </div>

                {/* The two rungs with no column */}
                <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F1F5F9] bg-[#FFFBEB] -mx-2 px-2 rounded">
                  <div className="min-w-0">
                    <span className="text-[12px] text-[#92400E]">
                      Category surcharge — {view.ladder.surchargeLabel}
                    </span>{" "}
                    <span className="h-[16px] px-1 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono">
                      NO COLUMN
                    </span>
                    <p className="text-[10px] text-[#B45309] mt-0.5">
                      FC-07 §07, levied on the storage base. grCharges has nowhere to put it.
                    </p>
                  </div>
                  <span
                    className="font-mono text-[13px] font-medium whitespace-nowrap"
                    style={{ color: view.ladder.surcharge === 0 ? "#CBD5E1" : "#92400E" }}
                  >
                    {formatPkr(view.ladder.surcharge)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F1F5F9] bg-[#FFFBEB] -mx-2 px-2 rounded">
                  <div className="min-w-0">
                    <span className="text-[12px] text-[#92400E]">
                      Subclass floor — max(sub-total, {formatPkr(view.ladder.minimumCharges)})
                    </span>{" "}
                    <span className="h-[16px] px-1 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center font-mono">
                      NO COLUMN
                    </span>
                    <p className="text-[10px] text-[#B45309] mt-0.5">
                      {view.ladder.floorUplift > 0
                        ? "The floor bit here — the computed charge fell below the subclass minimum."
                        : "Dormant here: the computed charge already clears the minimum."}
                    </p>
                  </div>
                  <span
                    className="font-mono text-[13px] font-medium whitespace-nowrap"
                    style={{ color: view.ladder.floorUplift === 0 ? "#CBD5E1" : "#92400E" }}
                  >
                    {formatPkr(view.ladder.floorUplift)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3 py-2 border-b border-[#E2E8F0]">
                  <span className="text-[12px] font-semibold text-[#0F172A]">Sub-total</span>
                  <span className="font-mono text-[13px] font-bold text-[#0F172A]">
                    {formatPkr(view.ladder.subTotal)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[#F1F5F9]">
                  <div>
                    <span className="text-[12px] text-[#334155]">
                      Tax at {view.ladder.Taxpercentage}%
                    </span>{" "}
                    <CmtsCol name="Taxpercentage" />
                  </div>
                  <span className="font-mono text-[13px] font-medium text-[#334155]">
                    {formatPkr(view.ladder.taxAmount)}
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-3 pt-2.5 mt-1 border-t-2 border-[#0B2545]">
                  <div>
                    <span className="text-[13px] font-bold text-[#0F172A]">Run total</span>{" "}
                    <CmtsCol name="totalAmount" />
                  </div>
                  <span className="font-mono text-[16px] font-bold text-[#0B2545]">
                    {formatPkr(view.ladder.totalAmount)}
                  </span>
                </div>
              </div>
            </Card>

            {/* 6 · The CMTS bridge */}
            <Card
              icon={<GitCompare size={15} />}
              title="Would the legacy procedure have agreed?"
              subtitle="Two rules differ and they compound. Bridged in named steps so each can be accepted or rejected on its own — a single gap number invites accepting or rejecting both."
              right={
                <span
                  className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                  style={
                    view.bridge.gap === 0
                      ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                  }
                >
                  {view.bridge.gap === 0 ? (
                    <>
                      <Check size={10} strokeWidth={3} /> The two agree
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={10} strokeWidth={2.5} /> {view.bridge.billedPct}% of CMTS
                    </>
                  )}
                </span>
              }
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  The CMTS side is what the procedure <em>would</em> produce, not a verified figure:
                  the restored database is schema-only, so the demo&rsquo;s{" "}
                  <span className="font-mono">TARIFF_SLABS</span> stands in for{" "}
                  <span className="font-mono">CARGOSUBCLASSCHARGES</span>, whose rows nobody has.
                  Audit §5 Q1 asks SAPS to confirm the inclusive day count before any of this is
                  acted on. Nothing here changes a calculation.
                </p>
              }
            >
              <div className="flex flex-col gap-2.5">
                {[
                  {
                    label: "Storage as billed",
                    detail: `${view.bridge.demoDwellDays}d dwell from intake, less ${view.days.classFreeDays}d class grace, bands walked over the remainder`,
                    amount: view.bridge.demoStorage,
                    delta: null as number | null,
                    tone: "#0F172A",
                  },
                  {
                    label: "…if the free period were granted once",
                    detail: `Same ${view.bridge.demoDwellDays}d dwell, bands walked over the whole stay — the zero-rate band IS the grace (audit §3.2)`,
                    amount: view.bridge.storageWithoutDoubleGrace,
                    delta: view.bridge.freeRuleGap,
                    tone: "#B45309",
                  },
                  {
                    label: "…and counted the way the procedure counts",
                    detail: `${view.bridge.cmtsDwellDays}d — calendar days from CARGODATE, inclusive of both ends (audit §3.1)`,
                    amount: view.bridge.cmtsStorage,
                    delta: view.bridge.dayCountGap,
                    tone: "#DC2626",
                  },
                ].map((step) => (
                  <div
                    key={step.label}
                    className="flex items-start justify-between gap-4 rounded-xl border border-[#E2E8F0] px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold" style={{ color: step.tone }}>
                        {step.label}
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-0.5 leading-snug">
                        {step.detail}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="font-mono text-[14px] font-bold" style={{ color: step.tone }}>
                        {formatPkr(step.amount)}
                      </p>
                      {step.delta !== null && step.delta !== 0 && (
                        <p className="font-mono text-[11px] text-[#DC2626] mt-0.5">
                          + {formatPkr(step.delta)}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {view.bridge.gap > 0 && (
                <div className="mt-4 rounded-xl border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3.5">
                  <div className="flex items-baseline justify-between gap-3 flex-wrap">
                    <p className="text-[12px] font-semibold text-[#991B1B]">
                      Storage this run does not bill
                    </p>
                    <p className="font-mono text-[18px] font-bold text-[#DC2626]">
                      {formatPkr(view.bridge.gap)}
                    </p>
                  </div>
                  <p className="text-[11px] text-[#B91C1C] mt-1 leading-snug">
                    Both rules push the same way, so they do not offset. On this consignment the
                    demo bills {view.bridge.billedPct}% of the legacy figure. Handling, documentation
                    and deconsolidation do not move with the day count, so the whole gap sits in
                    storage.
                  </p>
                </div>
              )}
            </Card>

            {/* 7 · Basis — location & house lines */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
              <Card
                icon={<MapPin size={15} />}
                title="Location & handling basis"
                subtitle="What the run priced against, and what it did not."
              >
                <div className="grid grid-cols-2 gap-x-5 gap-y-4">
                  <Field
                    label="Zone"
                    cmts="LOCATIONNAME"
                    value={view.location.LOCATIONNAME}
                    hint="varchar(500), beside the LocationId key"
                  />
                  <Field
                    label="Zone charge"
                    cmts="LOCATIONCHARGES"
                    value={formatPkr(set.head.LOCATIONCHARGES)}
                    mono
                    hint="the charge path takes no location input"
                  />
                  <Field
                    label="Handling rate"
                    cmts="Handlingchargesperkg"
                    value={formatPkr(set.head.Handlingchargesperkg)}
                    mono
                  />
                  <Field
                    label="Handling basis"
                    cmts="HandlingchargesUnit"
                    value={set.head.HandlingchargesUnit}
                    mono
                  />
                </div>

                {view.location.diverged && (
                  <div className="mt-4 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                    <AlertTriangle size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                    <p className="text-[12px] text-[#92400E] leading-snug">
                      Logically in <strong>{view.location.LOCATIONNAME}</strong>, physically in{" "}
                      <strong>{view.location.physicalName}</strong>
                      {view.location.divergenceReason ? ` — ${view.location.divergenceReason}` : ""}.
                      CMTS prices the logical zone; this run prices neither.
                    </p>
                  </div>
                )}

                <p className="text-[11px] text-[#64748B] mt-4 leading-snug">
                  <span className="font-mono">{view.location.zonesWithoutRate}</span> of{" "}
                  <span className="font-mono">{view.location.zonesTotal}</span> zones carry no rate
                  row at all — <span className="font-mono">LOCATION_CHARGES</span> only bands hold
                  zones. CMTS bands every location by weight <em>and</em> day (audit §3.3), and{" "}
                  <span className="font-mono">WEIGHTFROM</span> /{" "}
                  <span className="font-mono">WEIGHTTO</span> are typed in this repo and never
                  priced.
                </p>
              </Card>

              <Card
                icon={<Boxes size={15} />}
                title="House lines"
                subtitle="A consolidation is priced house by house. Six columns carry that split."
                right={
                  set.head.IsHwb ? (
                    <span
                      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                      style={
                        view.houses.piecesAgree
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {view.houses.piecesAgree ? (
                        <>
                          <Check size={10} strokeWidth={3} /> Pieces reconcile
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={10} strokeWidth={2.5} /> Pieces do not reconcile
                        </>
                      )}
                    </span>
                  ) : undefined
                }
              >
                {!set.head.IsHwb ? (
                  <>
                    <p className="text-[12px] text-[#64748B] leading-snug">
                      <span className="font-mono">IsHwb</span> is{" "}
                      <span className="font-mono text-[#0F172A]">false</span> on this run — a direct
                      AWB, so all six house columns are null.
                    </p>
                    <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
                      {(
                        [
                          ["House AWB", "HWB"],
                          ["Sub-index", "HWBSubIndexno"],
                          ["Pieces", "HWBPcs"],
                          ["Chargeable weight", "HWBChargeableWeight"],
                          ["Contents", "HWBContents"],
                        ] as const
                      ).map(([label, cmts]) => (
                        <Field key={cmts} label={label} cmts={cmts} value={null} mono />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[460px]">
                        <thead>
                          <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                            <Th>
                              House &amp; contents
                              <CmtsCol name="HWB · HWBContents" block />
                            </Th>
                            <Th>
                              Sub-index
                              <CmtsCol name="HWBSubIndexno" block />
                            </Th>
                            <Th right>
                              Pcs
                              <CmtsCol name="HWBPcs" block />
                            </Th>
                            <Th right>
                              Chg. weight
                              <CmtsCol name="HWBChargeableWeight" block />
                            </Th>
                            <Th right>Storage share</Th>
                          </tr>
                        </thead>
                        <tbody>
                          {view.houses.lines.map((l) => (
                            <tr key={l.HWB} className="border-b border-[#F1F5F9] last:border-0">
                              <td className="px-3 py-2.5">
                                <span className="font-mono text-[12px] font-medium text-[#0F172A]">
                                  {l.HWB}
                                </span>
                                <p className="text-[10px] text-[#94A3B8] mt-0.5">{l.HWBContents}</p>
                              </td>
                              <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                                {l.HWBSubIndexno ?? "null"}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#475569]">
                                {l.HWBPcs}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[#475569] whitespace-nowrap">
                                {formatKg(l.HWBChargeableWeight)}
                              </td>
                              <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
                                {formatPkr(l.storageShare)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                            <td className="px-3 py-2.5 text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider">
                              Σ lines
                            </td>
                            <td className="px-3 py-2.5" />
                            <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#0F172A]">
                              {view.houses.piecesOnLines}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#0F172A] whitespace-nowrap">
                              {formatKg(view.houses.weightOnLines)}
                            </td>
                            <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold text-[#0B2545] whitespace-nowrap">
                              {formatPkr(set.head.StorageAmount)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>

                    <div className="mt-4 flex flex-col gap-2">
                      <p className="text-[11px] text-[#64748B] leading-snug">
                        Pieces: <span className="font-mono">{view.houses.piecesOnLines}</span> across
                        the houses against <span className="font-mono">PcsOnAWB</span>{" "}
                        <span className="font-mono">{view.houses.piecesOnAwb}</span>.
                      </p>
                      {Math.abs(view.houses.weightDelta) > 0.01 && (
                        <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3 flex items-start gap-2.5">
                          <Scale size={14} className="text-[#D97706] flex-shrink-0 mt-0.5" />
                          <p className="text-[12px] text-[#92400E] leading-snug">
                            The houses&rsquo; chargeable weights sum to{" "}
                            <strong>{formatKg(Math.abs(view.houses.weightDelta))}</strong>{" "}
                            {view.houses.weightDelta > 0 ? "more" : "less"} than the master was
                            priced on ({formatKg(view.houses.masterChargeableKg)}). CMTS prices the
                            master, so that difference is billed to nobody.
                          </p>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </Card>
            </div>

            {/* 8 · Denormalisation */}
            <Card
              icon={<Database size={15} />}
              title="What actually varies down the run"
              subtitle="The header is copied onto every row. Knowing which columns really move is the difference between migrating a table and migrating 43 columns of repetition."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Four further columns are deliberately not modelled —{" "}
                  {GR_CHARGE_KEY_COLUMNS.map((c) => (
                    <span key={c} className="font-mono">
                      {c}{" "}
                    </span>
                  ))}
                  — surrogate keys with nothing to key in a prototype with no backend. The table
                  carries <span className="font-mono">HWB</span>,{" "}
                  <span className="font-mono">Cargoclass</span> and{" "}
                  <span className="font-mono">LOCATIONNAME</span> as their readable twins, so
                  nothing is lost. 43 + 4 = 47.
                </p>
              }
            >
              <div className="flex flex-wrap gap-6">
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Rows in this run
                  </p>
                  <p className="text-[22px] font-bold text-[#0F172A] font-mono mt-0.5">
                    {view.variance.rowCount}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Columns that vary
                  </p>
                  <p className="text-[22px] font-bold text-[#D97706] font-mono mt-0.5">
                    {view.variance.varying.length}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Columns repeated identically
                  </p>
                  <p className="text-[22px] font-bold text-[#64748B] font-mono mt-0.5">
                    {view.variance.constant.length}
                  </p>
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  {view.variance.varying.length === 0
                    ? "Nothing varies — this run wrote a single row"
                    : "These carry the per-row detail"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {view.variance.varying.map((c) => (
                    <span
                      key={String(c)}
                      className="h-[22px] px-2 rounded bg-[#FEF3C7] text-[#B45309] text-[10px] font-bold inline-flex items-center font-mono"
                    >
                      {String(c)}
                    </span>
                  ))}
                </div>
              </div>

              <div className="mt-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  These repeat on every row
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {view.variance.constant.map((c) => (
                    <span
                      key={String(c)}
                      className="h-[22px] px-2 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-semibold inline-flex items-center font-mono"
                    >
                      {String(c)}
                    </span>
                  ))}
                </div>
              </div>
            </Card>

            {/* 9 · Rule disagreements */}
            <Card
              icon={<AlertTriangle size={15} />}
              title="Where CMTS and this demo disagree"
              subtitle="The six findings in CMTS_SCHEMA_AUDIT §3, measured against this run rather than described in the abstract. Shown, not reconciled — no existing calculation is changed by this screen."
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[880px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      <Th>Audit</Th>
                      <Th>Rule</Th>
                      <Th>CMTS does</Th>
                      <Th>This demo does</Th>
                      <Th>On this run</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.disagreements.map((d) => {
                      const tone = SEVERITY_TONE[d.severity];
                      return (
                        <tr key={d.ref} className="border-b border-[#F1F5F9] last:border-0 align-top">
                          <td className="px-3 py-3 whitespace-nowrap">
                            <span className="h-[20px] px-2 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold inline-flex items-center font-mono">
                              {d.ref}
                            </span>
                          </td>
                          <td className="px-3 py-3 min-w-[180px]">
                            <p className="text-[12px] font-medium text-[#0F172A] leading-snug">
                              {d.rule}
                            </p>
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {d.columns.map((c) => (
                                <CmtsCol key={c} name={c} />
                              ))}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-[11px] text-[#64748B] font-mono leading-snug min-w-[200px]">
                            {d.cmts}
                          </td>
                          <td className="px-3 py-3 text-[11.5px] text-[#64748B] leading-snug min-w-[180px]">
                            {d.demo}
                          </td>
                          <td className="px-3 py-3 min-w-[220px]">
                            <span
                              className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center font-mono mb-1"
                              style={{ backgroundColor: tone.bg, color: tone.fg }}
                            >
                              {tone.label}
                            </span>
                            <p className="text-[11.5px] text-[#334155] leading-snug">{d.effect}</p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            {/* 10 · Column-level ambiguities */}
            <Card
              icon={<HelpCircle size={15} />}
              title="Questions the schema cannot answer"
              subtitle="Findings that live in the column list rather than in the arithmetic. Each one is a decision SAPS has to make before this table is migrated; none of them can be settled from a schema-only restore."
              footer={
                <p className="text-[11px] text-[#64748B] leading-snug">
                  Every one of these is visible on the working set and invisible on the voucher.
                  That is the argument for building this screen at all: the voucher shows a number
                  that reconciles, and this shows the seven assumptions holding it up.
                </p>
              }
            >
              <div className="flex flex-col gap-3">
                {COLUMN_AMBIGUITIES.map((a) => (
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

            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href="/billing/calculator"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                <Calculator size={12} /> The calculation this records <ArrowUpRight size={12} />
              </Link>
              <Link
                href="/billing/godown-rent"
                className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                <FileText size={12} /> The voucher it was printed onto <ArrowUpRight size={12} />
              </Link>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
