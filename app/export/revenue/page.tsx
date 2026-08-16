"use client";

/**
 * Export revenue share — CMTS `INTERNATIONALCARGO` (44 columns).
 *
 * WHICH STEP THIS SERVES
 * ----------------------
 * FC-11 has exactly one billing node: **§25 "Export invoice / closure /
 * archive"** (M20). The flow's own text parks half of it — "closure and archive
 * are built; the export revenue share (INTERNATIONALCARGO) is parked pending
 * SAPS" — and CMTS_SCOPE_DECISIONS **Q3** unparks it: the revenue-share model is
 * retained in full, agency commission and SAPS share included.
 *
 * So §25 has two halves and both are now built. `/export/billing` is the
 * **charging** half (`ExportGodownrent` — what the shipper is invoiced for the
 * days the cargo was held). This is the **revenue** half: what the terminal
 * actually earns on the carriage once the agent has been paid. Q3's argument for
 * keeping it is the reason this screen exists at all — it is the only record
 * anywhere in CMTS that the two figures are different numbers.
 *
 * It reads two earlier steps as well, because the money is not decided at §25:
 * §01 is where the airline sold the capacity these rates price, and §03 is where
 * the scale produced the kilo `CHRGWEIGHT` bills on. A screen is placed at the
 * step it IS, not at the steps it reads.
 *
 * (The build plan's G5 row cites "FC-11 §15" for this table. That predates the
 * A16 renumbering, which made the flow contiguous 01–25; §15 is now "Cargo
 * classification". `lib/architecture.ts` names INTERNATIONALCARGO at §25, and
 * that is the citation this screen follows.)
 *
 * WHY IT IS A SPLIT AND NOT A 43-FIELD FORM
 * -----------------------------------------
 * Ten of the columns are money and six are rates or freights. Flat, they are a
 * wall of numbers with no relation between them. The table's whole point is the
 * relation, so the screen is built as three things:
 *
 *   1. **the rate stack** — four rate columns and three freight columns that do
 *      not pair up. Two rates have a freight to check against, two are priced
 *      nowhere, and one freight has no rate at all. The asymmetry is the
 *      finding.
 *   2. **the split** — billed at the top, retained at the bottom, with each gap
 *      *measured* and then attributed by searching the row's own money columns
 *      for a combination that equals it. The arithmetic is discovered, not
 *      asserted.
 *   3. **the reading** — every relationship the screen relies on, tiered
 *      ARITHMETIC / INFERRED / UNRESOLVED and rendered as such, plus the five
 *      questions this table cannot answer at all.
 *
 * ON NOT INVENTING ARITHMETIC
 * ---------------------------
 * The database is schema-only and no stored procedure touches this table, so
 * none of the money relationships are documented. Two are true by what the words
 * mean (a rate times a weight is a freight) and are checked. The rest are
 * readings, and the screen marks them as readings everywhere they appear —
 * including a standing note beside the split saying that the demo rows were
 * synthesised to that reading, so the checks passing is internal consistency and
 * not evidence about CMTS. An invented formula that looks authoritative is worse
 * than an acknowledged gap, because the client cannot tell the difference.
 *
 * The domain model, the fixtures and every check live in
 * `lib/domain/exportrevenue.ts`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Banknote,
  Calculator,
  Check,
  Flag,
  HelpCircle,
  Layers,
  Percent,
  Receipt,
  Ruler,
  Scale,
  Split,
  Users,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import { formatDate, formatDateTime, formatPkr } from "@/lib/domain";
import {
  CONFIDENCE_LABEL,
  REVENUE_LIMITS,
  REVENUE_READING,
  RATE_SOURCE_LABEL,
  flagCensus,
  formatRate,
  listExportRevenue,
  reconcileRevenue,
  revenueForAwb,
  type Confidence,
  type InternationalCargo,
} from "@/lib/domain/exportrevenue";

/* ------------------------------------------------------------------ *
 * Local presentation pieces
 *
 * Kept local rather than shared for the same reason `/export/billing` keeps
 * its own: most values on this screen are derived text ("PKR 450,000",
 * "350.00 / kg", "156.5") rather than raw record values, so a generic field
 * component would be formatting nothing.
 * ------------------------------------------------------------------ */

/**
 * One field carrying the CMTS column it maps to, so migration parity is
 * checkable on sight.
 *
 * A null renders as the word `null` in the muted tone rather than as blank. On a
 * parity screen "this column exists and is empty" and "this column was never
 * mapped" are different findings, and an empty cell cannot tell them apart.
 */
function Field({
  label,
  cmts,
  value,
  mono,
}: {
  label: string;
  cmts: string;
  value: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
          {label}
        </span>
        <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
          {cmts}
        </span>
      </div>
      <span
        className={`text-[13px] font-medium break-words ${mono ? "font-mono" : ""}`}
        style={{ color: value ? "#0F172A" : "#CBD5E1" }}
      >
        {value ?? "null"}
      </span>
    </div>
  );
}

const CONFIDENCE_TONE: Record<Confidence, { bg: string; fg: string }> = {
  identity: { bg: "#DCFCE7", fg: "#15803D" },
  inferred: { bg: "#FEF3C7", fg: "#B45309" },
  unresolved: { bg: "#EDE9FE", fg: "#6D28D9" },
};

/**
 * The tier badge. It appears against every derived figure on the screen and it
 * is the single most important control on the page: a reader has to be able to
 * tell arithmetic from somebody's reading without stopping to read prose.
 */
function Tier({ c }: { c: Confidence }) {
  const tone = CONFIDENCE_TONE[c];
  return (
    <span
      className="h-[16px] px-1.5 rounded text-[9px] font-bold inline-flex items-center whitespace-nowrap"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
      title={
        c === "identity"
          ? "True by what the column names mean, and checkable against the stored figure."
          : c === "inferred"
            ? "A plausible reading of the column names. Unproven — CMTS documents nothing about this table."
            : "Cannot be settled from names, types or procedures. Left open rather than guessed at."
      }
    >
      {CONFIDENCE_LABEL[c]}
    </span>
  );
}

function CardHead({
  icon,
  title,
  sub,
  right,
}: {
  icon: React.ReactNode;
  title: string;
  sub?: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex-shrink-0 text-[#64748B]">{icon}</span>
        <div>
          <h3 className="text-[14px] font-semibold text-[#0F172A]">{title}</h3>
          {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[74ch]">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export default function ExportRevenuePage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExportRevenue(scope), [scope]);

  const [selected, setSelected] = useState<string | null>(
    rows[0] ? `${rows[0].AWBNO}/${rows[0].SEQUENCE}` : null,
  );
  const r: InternationalCargo | null =
    rows.find((x) => `${x.AWBNO}/${x.SEQUENCE}` === selected) ?? rows[0] ?? null;
  const [tab, setTab] = useState<"consignment" | "collection" | "control">("consignment");

  /*
   * Siblings are looked up unscoped on purpose. The selected row is already
   * filtered to the active site and its siblings are at the same site, so
   * reading the scoped list as well would make the duplicate-revenue check
   * silently disappear if the two ever disagreed — which is exactly the
   * condition worth seeing.
   */
  const siblings = useMemo(() => (r ? revenueForAwb(r.AWBNO) : []), [r]);
  const recon = useMemo(() => (r ? reconcileRevenue(r, siblings) : null), [r, siblings]);
  const census = useMemo(() => flagCensus(rows), [rows]);

  const billed = rows.reduce((n, x) => n + x.TOTAL, 0);
  const retained = rows.reduce((n, x) => n + x.SAPSSHARE, 0);
  const failing = rows.filter(
    (x) => reconcileRevenue(x, revenueForAwb(x.AWBNO)).breaks.length > 0,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Revenue share" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §25 · M20
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              INTERNATIONALCARGO 44
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              FORM MISSING — 18% OVERLAP
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#ECFDF5] text-[#047857] text-[10px] font-bold inline-flex items-center font-mono">
              BLK-02 UNPARKED — Q3
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Export Revenue Share
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            What the terminal earns on an export booking, as distinct from what it invoices — the
            revenue half of FC-11 §25.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/*
        The step this screen serves, stated rather than implied — and the
        relationship to its sibling, because §25 is one node holding two
        different questions about the same booking.
      */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ["§01", "Booking from the airline", "the capacity these rates price"],
            ["§03", "Weight captured at the scale", "the kilo CHRGWEIGHT bills on"],
            ["§25", "Invoice / closure / archive", "the revenue is recognised and split"],
          ].map(([ref, label, why]) => (
            <span
              key={ref}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC]"
            >
              <span className="text-[10px] font-mono font-bold text-[#0B2545]">{ref}</span>
              <span className="text-[11px] font-semibold text-[#0F172A]">{label}</span>
              <span className="text-[11px] text-[#94A3B8]">— {why}</span>
            </span>
          ))}
        </div>
        <p className="text-[11px] text-[#64748B] leading-relaxed max-w-[104ch]">
          FC-11 carries one billing node and it is <span className="font-mono">§25</span>, which
          holds two different questions about the same booking.{" "}
          <Link href="/export/billing" className="text-[#1B4F8B] font-semibold no-underline hover:underline">
            Export billing
          </Link>{" "}
          answers the first — what the shipper is charged for the days the cargo was held
          (<span className="font-mono">ExportGodownrent</span>). This screen answers the second — what
          SAPS keeps of the carriage once the agent has been paid. The flow text parked this half as
          BLK-02; <span className="font-mono">CMTS_SCOPE_DECISIONS Q3</span> retains the model in
          full, because it is the only record anywhere in CMTS that the invoiced figure and the
          earned figure are different numbers.
        </p>
      </div>

      {/*
        The provenance warning. Placed above the money rather than under it, and
        carried in the domain module so it cannot drift from the fixtures it
        describes. CMTS_SCOPE_DECISIONS makes this obligation explicit for
        synthesised financial data: the invention has to be impossible to miss.
      */}
      <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] px-5 py-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-[#D97706] mt-0.5 flex-shrink-0" strokeWidth={2.5} />
        <div>
          <p className="text-[12px] font-bold text-[#92400E]">
            These figures are synthesised, and so is the arithmetic that connects them.
          </p>
          <p className="text-[11px] text-[#92400E] mt-1 leading-relaxed max-w-[104ch]">
            {REVENUE_READING.circularityWarning} Every derived figure below carries a tier badge —{" "}
            <Tier c="identity" /> where the relationship is true by what the column names mean,{" "}
            <Tier c="inferred" /> where it is a reading of them, and <Tier c="unresolved" /> where the
            schema cannot settle it at all. Five questions on this table are in the last category and
            are listed rather than answered.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Revenue rows", value: String(rows.length), tone: "#0F172A" },
          { label: "Billed · TOTAL", value: formatPkr(billed), tone: "#0B2545" },
          { label: "Retained · SAPSSHARE", value: formatPkr(retained), tone: "#15803D" },
          {
            label: "Retention (derived)",
            value: billed > 0 ? pct(retained / billed) : "—",
            tone: "#0F172A",
          },
          {
            label: "Rows with findings",
            value: String(failing.length),
            tone: failing.length > 0 ? "#DC2626" : "#16A34A",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[18px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="No revenue rows at this site"
          description="A revenue row is cut at FC-11 §25, once the consignment has been uplifted and the carriage can be recognised."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <CardHead icon={<Receipt size={15} />} title="Bookings" />
            <div className="max-h-[620px] overflow-y-auto">
              {rows.map((x) => {
                const key = `${x.AWBNO}/${x.SEQUENCE}`;
                const voided = x.DFLAG.toUpperCase() === "Y";
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                    /*
                     * Highlighted off the resolved row, not off `selected`.
                     * Switching site scope leaves `selected` pointing at a row
                     * that is no longer in the list, and the detail pane falls
                     * back to the first — comparing against `selected` would
                     * then show a detail pane with nothing highlighted.
                     */
                    style={{
                      backgroundColor:
                        r && r.AWBNO === x.AWBNO && r.SEQUENCE === x.SEQUENCE
                          ? "#EBF0F7"
                          : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {x.AWBNO}
                        <span className="text-[#94A3B8]"> · {x.SEQUENCE}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        {voided && (
                          <span
                            className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center bg-[#F1F5F9] text-[#64748B]"
                            title="DFLAG = Y"
                          >
                            DFLAG
                          </span>
                        )}
                        <span
                          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                          style={
                            x.APPROVED === "Y"
                              ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          }
                        >
                          {x.APPROVED.trim() === "" ? "BLANK" : x.APPROVED === "Y" ? "APPR" : "NOT APPR"}
                        </span>
                      </span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      {x.FLIGHTNO} · {x.ORIGIN}→{x.DESTINATION} · {formatPkr(x.TOTAL)}
                    </p>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      {formatDate(x.CARGODATE)} · keeps {formatPkr(x.SAPSSHARE)}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {r && recon && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* ---------------- Header ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[15px] font-bold text-[#0F172A]">
                        {r.AWBNO}
                      </span>
                      <span className="text-[9px] font-mono text-[#CBD5E1]" title="CMTS column: AWBNO">
                        AWBNO
                      </span>
                      <span className="font-mono text-[13px] font-bold text-[#64748B]">
                        seq {r.SEQUENCE}
                      </span>
                      <span
                        className="text-[9px] font-mono text-[#CBD5E1]"
                        title="CMTS column: SEQUENCE"
                      >
                        SEQUENCE
                      </span>
                      {r.DFLAG.toUpperCase() === "Y" && (
                        <span
                          className="h-[22px] px-2.5 rounded-full bg-[#F1F5F9] text-[#475569] text-[10px] font-bold inline-flex items-center"
                          title="CMTS column: DFLAG"
                        >
                          DFLAG = Y
                        </span>
                      )}
                      {r.APPROVED !== "Y" && (
                        <span className="h-[22px] px-2.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center">
                          {r.APPROVED.trim() === "" ? "APPROVED IS BLANK" : "NOT APPROVED"}
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      <span className="font-mono">{r.FLIGHTNO}</span> · {r.ORIGIN} → {r.DESTINATION} ·{" "}
                      {r.GOODS} · {r.AGENCYNAME}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        Terminal keeps
                      </p>
                      <span className="text-[9px] font-mono text-[#CBD5E1]" title="CMTS column: SAPSSHARE">
                        SAPSSHARE
                      </span>
                    </div>
                    <p className="text-[22px] font-bold text-[#15803D] font-mono">
                      {formatPkr(r.SAPSSHARE)}
                    </p>
                    <p className="text-[11px] text-[#64748B] mt-0.5">
                      of {formatPkr(r.TOTAL)} billed —{" "}
                      <span className="font-semibold">{pct(recon.split.retentionOfBilled)}</span>{" "}
                      retention, derived
                    </p>
                    {recon.breaks.length > 0 && (
                      <span
                        className="mt-1.5 h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 bg-[#FEE2E2] text-[#DC2626]"
                      >
                        <AlertTriangle size={10} strokeWidth={2.5} />
                        {recon.breaks.length} finding{recon.breaks.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                  {(
                    [
                      ["Cargo date", "CARGODATE", formatDate(r.CARGODATE), false],
                      ["Flight", "FLIGHTNO", r.FLIGHTNO, true],
                      ["Shipment type", "SHIPMENTTYPE", r.SHIPMENTTYPE, false],
                      ["Gross weight", "GROSSWEIGHT", `${r.GROSSWEIGHT} kg`, true],
                      ["Chargeable weight", "CHRGWEIGHT", `${r.CHRGWEIGHT} kg`, true],
                      ["Pieces", "PIECES", String(r.PIECES), true],
                      ["Declared value", "DECLVALUE", r.DECLVALUE > 0 ? formatPkr(r.DECLVALUE) : "0", true],
                      ["Agency", "AGENCYNAME", r.AGENCYNAME, false],
                    ] as const
                  ).map(([label, cmts, value, mono]) => (
                    <Field key={cmts} label={label} cmts={cmts} value={value} mono={mono} />
                  ))}
                </div>
              </div>

              {/* ---------------- Sibling rows ---------------- */}
              {siblings.length > 1 && (
                <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
                  <CardHead
                    icon={<Layers size={15} />}
                    title={`${siblings.length} revenue rows against this AWB — and nothing that ranks them`}
                    sub="Same AWBNO, same CARGODATE, different SEQUENCE. There is no supersedes-reference, no void flag and no revision reason, so which row is the live one is a question the table cannot answer. The import side carries GRREFERENCE for exactly this."
                  />
                  <div className="divide-y divide-[#FDE68A]">
                    {siblings.map((s) => {
                      const key = `${s.AWBNO}/${s.SEQUENCE}`;
                      return (
                        <button
                          key={key}
                          onClick={() => setSelected(key)}
                          className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                        >
                          <span className="flex items-center gap-2 flex-wrap">
                            <span
                              className="font-mono text-[12px] font-semibold"
                              style={{ color: s.SEQUENCE === r.SEQUENCE ? "#0F172A" : "#92400E" }}
                            >
                              SEQUENCE {s.SEQUENCE}
                            </span>
                            {s.SEQUENCE === r.SEQUENCE && (
                              <span className="h-[16px] px-1.5 rounded bg-[#0B2545] text-white text-[9px] font-bold inline-flex items-center">
                                OPEN
                              </span>
                            )}
                            <span className="text-[11px] text-[#92400E]">
                              {formatRate(s.RATE)} · APPROVED &ldquo;{s.APPROVED}&rdquo;
                            </span>
                          </span>
                          <span className="font-mono text-[12px] font-semibold text-[#92400E]">
                            {formatPkr(s.TOTAL)} → keeps {formatPkr(s.SAPSSHARE)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="px-5 py-3 border-t border-[#FDE68A]">
                    <p className="text-[11px] text-[#92400E] leading-relaxed">
                      Anything summing <span className="font-mono">TOTAL</span> over this AWB counts{" "}
                      <strong>{formatPkr(siblings.reduce((n, s) => n + s.TOTAL, 0))}</strong> where the
                      carriage was sold once. Both rows also carry the same{" "}
                      <span className="font-mono">CHEQUENO</span>, so the payment cannot be matched to
                      one of them either.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------- The rate stack ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Ruler size={15} />}
                  title="The rate stack — four rates, three freights, and they do not pair up"
                  sub="An air-cargo rate is per kilo, so a rate times the chargeable weight is a freight. Two of these pairs are complete and can be checked. Two rates have no freight column and are priced nowhere. One freight has no rate and cannot be checked at all."
                  right={
                    <span
                      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                      style={
                        recon.rateSource === "none"
                          ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          : { backgroundColor: "#DCFCE7", color: "#16A34A" }
                      }
                    >
                      {recon.rateSource === "none" ? (
                        <>
                          <AlertTriangle size={10} strokeWidth={2.5} /> Applied rate matches nothing
                        </>
                      ) : (
                        <>
                          <Check size={10} strokeWidth={3} /> Applied rate ={" "}
                          {RATE_SOURCE_LABEL[recon.rateSource]}
                        </>
                      )}
                    </span>
                  }
                />
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {["", "Rate / kg", `× ${r.CHRGWEIGHT} kg`, "Stored freight", ""].map((h, i) => (
                          <th
                            key={h || i}
                            className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {recon.rates.map((rung) => (
                        <tr
                          key={rung.label}
                          className="border-b border-[#F1F5F9] last:border-0 align-top"
                          style={{ backgroundColor: rung.applied ? "#F8FAFC" : undefined }}
                        >
                          <td className="px-4 py-3 w-[30%]">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className="text-[12px]"
                                style={{
                                  color: "#0F172A",
                                  fontWeight: rung.applied ? 700 : 600,
                                }}
                              >
                                {rung.label}
                              </span>
                              {rung.applied && (
                                <span className="h-[16px] px-1.5 rounded bg-[#0B2545] text-white text-[9px] font-bold inline-flex items-center">
                                  APPLIED
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-snug max-w-[38ch]">
                              {rung.note}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block text-[9px] font-mono text-[#CBD5E1]">
                              {rung.rateCmts ?? "no rate column"}
                            </span>
                            <span
                              className="block text-[12px] font-mono font-medium mt-0.5"
                              style={{ color: rung.rate === null ? "#CBD5E1" : "#0F172A" }}
                            >
                              {rung.rate === null ? "—" : rung.rate.toFixed(2)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block text-[9px] font-mono text-[#CBD5E1]">
                              derived
                            </span>
                            <span
                              className="block text-[12px] font-mono font-medium mt-0.5"
                              style={{ color: rung.freightImplied === null ? "#CBD5E1" : "#475569" }}
                            >
                              {rung.freightImplied === null
                                ? "—"
                                : formatPkr(rung.freightImplied)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="block text-[9px] font-mono text-[#CBD5E1]">
                              {rung.freightCmts ?? "no freight column"}
                            </span>
                            <span
                              className="block text-[12px] font-mono font-semibold mt-0.5"
                              style={{ color: rung.freightStored === null ? "#CBD5E1" : "#0F172A" }}
                            >
                              {rung.freightStored === null ? "—" : formatPkr(rung.freightStored)}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {rung.agrees === null ? (
                              <span className="text-[10px] text-[#94A3B8]">
                                {rung.rate === null ? "nothing to check it with" : "priced nowhere"}
                              </span>
                            ) : rung.agrees ? (
                              <span className="h-[18px] px-1.5 rounded bg-[#DCFCE7] text-[#16A34A] text-[9px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                                <Check size={10} strokeWidth={3} /> MULTIPLIES OUT
                              </span>
                            ) : (
                              <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center gap-1 whitespace-nowrap">
                                <AlertTriangle size={10} strokeWidth={2.5} /> DOES NOT
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col gap-1.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[11px] font-semibold text-[#0F172A]">
                      Discount off the published tariff
                    </span>
                    <Tier c="identity" />
                    <span className="font-mono text-[12px] font-semibold" style={{ color: recon.discountOffIata >= 0 ? "#0F172A" : "#DC2626" }}>
                      {formatPkr(Math.abs(recon.discountOffIata))}{" "}
                      {recon.discountOffIata >= 0 ? "below list" : "ABOVE list"}
                    </span>
                    <span className="text-[10px] font-mono text-[#CBD5E1]">
                      IATAFREIGHT − FREIGHT
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    Nothing on this row records <em>which</em> rate was applied or who chose it — the{" "}
                    <span className="font-mono">APPLIED</span> marker above is observed by comparing{" "}
                    <span className="font-mono">RATE</span> against the other three, not read off a
                    column. There is also no currency on any of the six, and no{" "}
                    <span className="font-mono">TARRIFFREIGHT</span> or{" "}
                    <span className="font-mono">SPECIALFREIGHT</span> column, so what the card rate or
                    the negotiated rate <em>would</em> have billed is computed here and stored nowhere.
                  </p>
                </div>
              </div>

              {/* ---------------- The split ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Split size={15} />}
                  title="The split — billed at the top, retained at the bottom"
                  sub="Each gap below is MEASURED between two stored figures, then attributed by searching the row's own money columns for a combination that equals it. Where a combination is found the arithmetic is discovered; where none is, the gap is reported as unattributed rather than explained away."
                />

                <div className="p-5 flex flex-col gap-0">
                  {recon.ladder.map((step, i) => (
                    <div key={step.cmts}>
                      {/* the measured gap, rendered between the two rungs it separates */}
                      {i > 0 && step.gap !== null && (
                        <div className="pl-4 ml-2 border-l-2 border-dashed border-[#E2E8F0] py-2.5">
                          {step.inverted ? (
                            <div className="rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2">
                              <p className="text-[11px] font-semibold text-[#991B1B]">
                                This figure is {formatPkr(Math.abs(step.gap))} ABOVE the one before it
                                — the ladder climbs.
                              </p>
                              <p className="text-[10px] text-[#991B1B] mt-0.5 leading-relaxed">
                                The order of these four columns is inferred from their names, not read
                                off the schema. A row that runs the other way is either a fault or
                                evidence that the reading is wrong, and the row cannot say which.
                              </p>
                            </div>
                          ) : (
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="text-[11px] font-mono text-[#94A3B8]">−</span>
                              <span className="font-mono text-[12px] font-semibold text-[#475569]">
                                {formatPkr(step.gap)}
                              </span>
                              {step.attribution && step.attribution.exact ? (
                                <>
                                  <span className="text-[11px] text-[#64748B]">
                                    accounted for exactly by
                                  </span>
                                  {step.attribution.columns.map((c) => (
                                    <span
                                      key={c}
                                      className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#0F172A] text-[10px] font-mono font-bold inline-flex items-center"
                                    >
                                      {c}
                                    </span>
                                  ))}
                                  {step.attribution.alternatives > 0 && (
                                    <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#B45309] text-[9px] font-bold inline-flex items-center">
                                      {step.attribution.alternatives} OTHER COMBINATION
                                      {step.attribution.alternatives === 1 ? "" : "S"} ALSO FIT
                                    </span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-[11px] text-[#991B1B] font-semibold">
                                    not accounted for
                                  </span>
                                  {step.attribution && step.attribution.columns.length > 0 && (
                                    <span className="text-[11px] text-[#64748B]">
                                      — closest is{" "}
                                      <span className="font-mono">
                                        {step.attribution.columns.join(" + ")}
                                      </span>
                                      , leaving{" "}
                                      <span className="font-mono font-semibold text-[#DC2626]">
                                        {formatPkr(step.attribution.residual)}
                                      </span>{" "}
                                      that no column on this table can hold
                                    </span>
                                  )}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      <div className="flex items-baseline justify-between gap-4 flex-wrap py-1">
                        <span className="min-w-0">
                          <span className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[13px] font-semibold text-[#0F172A]">
                              {step.label}
                            </span>
                            <span
                              className="text-[9px] font-mono text-[#CBD5E1]"
                              title={`CMTS column: ${step.cmts}`}
                            >
                              {step.cmts}
                            </span>
                            <Tier c={step.confidence} />
                          </span>
                          <span className="block text-[11px] text-[#94A3B8] mt-0.5 max-w-[72ch] leading-snug">
                            {step.why}
                          </span>
                        </span>
                        <span className="font-mono text-[15px] font-bold text-[#0B2545] whitespace-nowrap">
                          {formatPkr(step.amount)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* the division itself */}
                <div className="px-5 pb-5">
                  <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                    <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] font-semibold text-[#0F172A]">
                        The pot, divided
                      </span>
                      <span className="text-[10px] font-mono text-[#CBD5E1]">
                        NNFREIGHT = PAYABLE + SAPSSHARE
                      </span>
                      <Tier c="inferred" />
                      <span
                        className="ml-auto h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                        style={
                          recon.split.divides
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {recon.split.divides ? (
                          <>
                            <Check size={10} strokeWidth={3} /> Divides exactly
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={10} strokeWidth={2.5} />{" "}
                            {formatPkr(Math.abs(recon.split.residual))} unaccounted
                          </>
                        )}
                      </span>
                    </div>

                    <div className="p-4">
                      {/*
                        Widths are guarded on a positive pot rather than divided
                        blind: NNFREIGHT is a float column and a zero there would
                        put NaN into a style attribute, which renders as a
                        collapsed bar with no indication that anything is wrong.
                      */}
                      {recon.split.pot > 0 ? (
                        <div className="flex h-9 rounded-lg overflow-hidden border border-[#E2E8F0]">
                          <div
                            className="flex items-center justify-center bg-[#EBF0F7] min-w-0"
                            style={{
                              width: `${(recon.split.payable / recon.split.pot) * 100}%`,
                            }}
                            title={`PAYABLE ${formatPkr(recon.split.payable)}`}
                          >
                            <span className="text-[10px] font-bold text-[#0B2545] truncate px-2">
                              PAYABLE {pct(recon.split.payable / recon.split.pot)}
                            </span>
                          </div>
                          <div
                            className="flex items-center justify-center bg-[#DCFCE7] min-w-0"
                            style={{
                              width: `${(recon.split.sapsShare / recon.split.pot) * 100}%`,
                            }}
                            title={`SAPSSHARE ${formatPkr(recon.split.sapsShare)}`}
                          >
                            <span className="text-[10px] font-bold text-[#15803D] truncate px-2">
                              SAPS {pct(recon.split.retentionOfPot)}
                            </span>
                          </div>
                          {!recon.split.divides && (
                            <div
                              className="flex items-center justify-center bg-[#FEE2E2] min-w-0"
                              style={{
                                width: `${(Math.abs(recon.split.residual) / recon.split.pot) * 100}%`,
                              }}
                              title={`Unaccounted ${formatPkr(Math.abs(recon.split.residual))}`}
                            />
                          )}
                        </div>
                      ) : (
                        <p className="text-[12px] text-[#64748B]">
                          <span className="font-mono">NNFREIGHT</span> is zero on this row, so there
                          is no pot to divide — and nothing on the table distinguishes that from a
                          net-net figure nobody keyed.
                        </p>
                      )}

                      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-3">
                        <Field
                          label="Net-net pot"
                          cmts="NNFREIGHT"
                          value={formatPkr(recon.split.pot)}
                          mono
                        />
                        <Field
                          label="Payable onward"
                          cmts="PAYABLE"
                          value={formatPkr(recon.split.payable)}
                          mono
                        />
                        <Field
                          label="Terminal keeps"
                          cmts="SAPSSHARE"
                          value={formatPkr(recon.split.sapsShare)}
                          mono
                        />
                        <div className="flex flex-col gap-1">
                          <div className="flex items-baseline gap-1.5 flex-wrap">
                            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">
                              Retention
                            </span>
                            <span className="text-[9px] font-mono text-[#CBD5E1]">derived</span>
                          </div>
                          <span className="text-[13px] font-medium font-mono text-[#0F172A]">
                            {pct(recon.split.retentionOfPot)} of the pot
                          </span>
                        </div>
                      </div>

                      {!recon.split.divides && (
                        <div className="mt-3 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                          <p className="text-[12px] font-semibold text-[#991B1B]">
                            {formatPkr(Math.abs(recon.split.residual))} of the pot went somewhere the
                            table cannot record.
                          </p>
                          <p className="text-[11px] text-[#991B1B] mt-1 leading-relaxed">
                            There is no tax column, no rounding column, no adjustment column and no
                            second share on <span className="font-mono">INTERNATIONALCARGO</span>. On
                            the import voucher a gap of this shape is{" "}
                            <span className="font-mono">WAIVEOFFAMOUNT</span> and has a named approver
                            behind it. Here it is a difference with nowhere to sit.
                          </p>
                        </div>
                      )}

                      <div className="mt-3 flex items-start gap-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                        <Percent size={14} className="text-[#64748B] mt-0.5 flex-shrink-0" />
                        <p className="text-[11px] text-[#64748B] leading-relaxed">
                          <span className="font-mono">AGENCYCOMMISSION</span> is{" "}
                          {formatPkr(r.AGENCYCOMMISSION)} — which is{" "}
                          <strong>
                            {recon.commission.ofFreight === null
                              ? "—"
                              : pct(recon.commission.ofFreight)}
                          </strong>{" "}
                          of <span className="font-mono">FREIGHT</span> and{" "}
                          <strong>
                            {recon.commission.ofIataFreight === null
                              ? "—"
                              : pct(recon.commission.ofIataFreight)}
                          </strong>{" "}
                          of <span className="font-mono">IATAFREIGHT</span>. Both are shown because
                          nothing on the row says which base was intended: there is no percentage
                          column, only an amount. The same is true of{" "}
                          <span className="font-mono">SAPSSHARE</span>, which is stored as a figure
                          with no rate and no named base — so the retention above can be computed and
                          never checked.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ---------------- Tabs ---------------- */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["consignment", "Consignment & parties"],
                    ["collection", "Collection"],
                    ["control", "Control & flags"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setTab(value)}
                    className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: tab === value ? "#0B2545" : "#FFFFFF",
                      color: tab === value ? "#FFFFFF" : "#475569",
                      borderColor: tab === value ? "#0B2545" : "#E2E8F0",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* ---------------- Consignment & parties ---------------- */}
              {tab === "consignment" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <CardHead
                    icon={<Users size={15} />}
                    title="Who the money moves between"
                    sub="Eight columns of shipper and consignee, plus the agency the commission is paid to. All of them free text — CMTS has SHIPPER (11 cols), CONSIGNEE (13) and AGENCY (11) as master tables, and this row references none of them."
                  />
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {(
                      [
                        [
                          "Shipper",
                          [
                            ["Name", "SHIPPERNAME", r.SHIPPERNAME],
                            ["Address", "SHIPPERADDRESS", r.SHIPPERADDRESS],
                            ["Phone", "SHIPPERPHONE", r.SHIPPERPHONE],
                            ["Email", "SHIPPEREMAIL", r.SHIPPEREMAIL],
                          ],
                        ],
                        [
                          "Consignee",
                          [
                            ["Name", "CONSIGNEENAME", r.CONSIGNEENAME],
                            ["Address", "CONSIGNEEADDRESS", r.CONSIGNEEADDRESS],
                            ["Phone", "CONSIGNEEPHONE", r.CONSIGNEEPHONE],
                            ["Email", "CONSIGNEEEMAIL", r.CONSIGNEEEMAIL],
                          ],
                        ],
                      ] as const
                    ).map(([title, fields]) => (
                      <div key={title} className="rounded-xl border border-[#E2E8F0] p-4">
                        <p className="text-[12px] font-semibold text-[#0F172A] mb-3">{title}</p>
                        <div className="flex flex-col gap-3">
                          {fields.map(([label, cmts, value]) => (
                            <Field key={cmts} label={label} cmts={cmts} value={value} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                    <Field label="Origin" cmts="ORIGIN" value={r.ORIGIN} mono />
                    <Field label="Destination" cmts="DESTINATION" value={r.DESTINATION} mono />
                    <Field label="Goods" cmts="GOODS" value={r.GOODS} />
                    <Field label="Agency" cmts="AGENCYNAME" value={r.AGENCYNAME} />
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      The commission on this row is paid to a <em>string</em>. Totalling commission by
                      agency, or matching this agency to the one on the acceptance record, means
                      matching names — and <span className="font-mono">AGENCYNAME</span> is
                      varchar(30), which is shorter than several of the names in this set. See the
                      width check on the control tab.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------- Collection ---------------- */}
              {tab === "collection" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <CardHead
                    icon={<Banknote size={15} />}
                    title="Collection"
                    sub="Four columns for the money coming in: a free-text mode, one instrument-number column whatever the instrument, and a receipt reference and date. There is no amount-received column at all — what was actually collected against TOTAL is not on this table."
                  />
                  <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                    <Field label="Payment mode" cmts="PAYMODE" value={r.PAYMODE} mono />
                    <Field label="Instrument no" cmts="CHEQUENO" value={r.CHEQUENO} mono />
                    <Field label="Receipt no" cmts="RECIEPTNO" value={r.RECIEPTNO} mono />
                    <Field
                      label="Receipt date"
                      cmts="RECIEPTDATE"
                      value={r.RECIEPTDATE ? formatDateTime(r.RECIEPTDATE) : null}
                    />
                  </div>
                  <div className="px-5 pb-5">
                    <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                      {census
                        .filter((c) => c.cmts === "PAYMODE")
                        .map((c) => (
                          <div key={c.cmts}>
                            <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0]">
                              <span className="text-[11px] font-semibold text-[#0F172A]">
                                Every value{" "}
                                <span className="font-mono">{c.cmts}</span> holds across{" "}
                                {isHq ? "all sites" : scope}
                              </span>
                            </div>
                            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                              {c.values.map((v) => (
                                <span
                                  key={v.value}
                                  className="h-[22px] px-2 rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-mono inline-flex items-center gap-1.5"
                                >
                                  <span className="text-[#0F172A]">{v.display}</span>
                                  <span className="text-[#94A3B8]">×{v.count}</span>
                                </span>
                              ))}
                            </div>
                            <p className="px-4 pb-3 text-[11px] text-[#64748B] leading-relaxed">
                              {c.note}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      <span className="font-mono">RECIEPTNO</span> and{" "}
                      <span className="font-mono">RECIEPTDATE</span> are spelt as CMTS spells them.
                      Every misspelt column on this screen —{" "}
                      <span className="font-mono">TARRIFRATE</span>,{" "}
                      <span className="font-mono">CHRGWEIGHT</span>,{" "}
                      <span className="font-mono">DECLVALUE</span> — is carried exactly as the source
                      has it. A migration looks for the column that exists, not the one it would have
                      chosen.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------- Control & flags ---------------- */}
              {tab === "control" && (
                <div className="flex flex-col gap-5">
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <CardHead
                      icon={<Flag size={15} />}
                      title="Two single characters govern this row"
                      sub="Whether it is live, and whether its money is sanctioned. Between them they carry no name, no date and no reason — and neither is constrained to a value set."
                    />
                    <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                      <Field
                        label="Approved"
                        cmts="APPROVED"
                        value={r.APPROVED.trim() === "" ? null : r.APPROVED}
                        mono
                      />
                      <Field label="Delete flag" cmts="DFLAG" value={r.DFLAG} mono />
                      <Field
                        label="Audit delete"
                        cmts="IsDeleted"
                        value={r.IsDeleted ? "true" : "false"}
                        mono
                      />
                      <Field label="Remarks" cmts="REMARKS" value={r.REMARKS} />
                    </div>

                    <div className="px-5 pb-5 flex flex-col gap-3">
                      {census
                        .filter((c) => c.cmts !== "PAYMODE")
                        .map((c) => (
                          <div key={c.cmts} className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                            <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-baseline gap-2 flex-wrap">
                              <span className="text-[11px] font-semibold text-[#0F172A]">
                                {c.label}
                              </span>
                              <span className="text-[10px] font-mono text-[#CBD5E1]">{c.cmts}</span>
                              <span className="text-[11px] text-[#94A3B8]">
                                — {c.values.length} distinct value
                                {c.values.length === 1 ? "" : "s"} over {rows.length} rows
                              </span>
                            </div>
                            <div className="px-4 py-3 flex items-center gap-2 flex-wrap">
                              {c.values.map((v) => (
                                <span
                                  key={v.value}
                                  className="h-[22px] px-2 rounded-lg border border-[#E2E8F0] bg-white text-[11px] font-mono inline-flex items-center gap-1.5"
                                >
                                  <span className="text-[#0F172A]">{v.display}</span>
                                  <span className="text-[#94A3B8]">×{v.count}</span>
                                </span>
                              ))}
                            </div>
                            <p className="px-4 pb-3 text-[11px] text-[#64748B] leading-relaxed">
                              {c.note}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>

                  {/* field-width pressure */}
                  <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                    <CardHead
                      icon={<Ruler size={15} />}
                      title="Field widths against the values in them"
                      sub="A value sitting exactly on the declared width is the interesting case: it is either complete or it was cut, and the row cannot say which."
                    />
                    <div className="divide-y divide-[#F1F5F9]">
                      {recon.widths.map((w) => (
                        <div
                          key={w.cmts}
                          className="px-5 py-3.5"
                          style={{ backgroundColor: w.atLimit ? "#FFFBEB" : undefined }}
                        >
                          <div className="flex items-start justify-between gap-3 flex-wrap">
                            <span className="flex items-baseline gap-1.5 flex-wrap min-w-0">
                              <span className="text-[12px] font-semibold text-[#0F172A]">
                                {w.label}
                              </span>
                              <span className="text-[9px] font-mono text-[#CBD5E1]">
                                {w.cmts} varchar({w.declared})
                              </span>
                            </span>
                            <span
                              className="font-mono text-[11px] font-semibold whitespace-nowrap"
                              style={{ color: w.atLimit ? "#B45309" : "#64748B" }}
                            >
                              {w.length} / {w.declared}
                              {w.atLimit ? " — AT THE LIMIT" : ""}
                            </span>
                          </div>
                          <p
                            className="text-[12px] font-mono mt-1 break-words"
                            style={{ color: w.value ? "#0F172A" : "#CBD5E1" }}
                          >
                            {w.value ?? "null"}
                          </p>
                          <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                            {w.atLimit && (
                              <span className="font-semibold text-[#92400E]">
                                Sitting exactly on the declared width — nothing on the row says
                                whether the operator stopped here or the column did.{" "}
                              </span>
                            )}
                            {w.consequence}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- The reading ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Calculator size={15} />}
                  title="Every relationship this screen relies on, and how far it can be trusted"
                  sub="No stored procedure in CMTS touches INTERNATIONALCARGO, so none of this is documented — two relationships are true by what the words mean and the rest are readings of them. Each is tested against the open row, including the readings that compete with the one the demo was built to."
                />
                <div className="divide-y divide-[#F1F5F9]">
                  {recon.checks.map((c) => (
                    <div key={c.code} className="px-5 py-3">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <span className="flex items-baseline gap-2 flex-wrap min-w-0">
                          <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                            {c.claim}
                          </span>
                          <Tier c={c.confidence} />
                        </span>
                        <span
                          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                          style={
                            c.holds
                              ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          }
                        >
                          {c.holds ? (
                            <>
                              <Check size={10} strokeWidth={3} /> HOLDS
                            </>
                          ) : (
                            <>
                              <AlertTriangle size={10} strokeWidth={2.5} /> OFF BY{" "}
                              {formatPkr(Math.abs(c.delta))}
                            </>
                          )}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed max-w-[92ch]">
                        {c.note}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="px-5 py-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <p className="text-[12px] font-semibold text-[#0F172A] flex items-center gap-1.5">
                    <HelpCircle size={13} className="text-[#7C3AED]" />
                    What this table cannot tell us, and nobody should pretend it can
                  </p>
                  <div className="mt-2 flex flex-col gap-2.5">
                    {REVENUE_READING.unresolved.map((u) => (
                      <div key={u.claim}>
                        <p className="text-[12px] font-medium text-[#0F172A]">{u.claim}</p>
                        <p className="text-[11px] text-[#64748B] mt-0.5 leading-relaxed max-w-[100ch]">
                          {u.basis}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-[11px] text-[#94A3B8] mt-3 leading-relaxed max-w-[100ch]">
                    Each of these is a question for SAPS, not a gap to be filled in by guessing. The
                    columns are all modelled and rendered regardless — per Q3, retaining columns whose
                    exact arithmetic is uncertain costs nothing, and discarding them loses the only
                    record that the distinction exists.
                  </p>
                </div>
              </div>

              {/* ---------------- Findings ---------------- */}
              {recon.breaks.length > 0 && (
                <div className="rounded-[16px] border border-[#FECACA] bg-white overflow-hidden">
                  <CardHead
                    icon={<AlertTriangle size={15} />}
                    title={`${recon.breaks.length} finding${
                      recon.breaks.length === 1 ? "" : "s"
                    } on this row`}
                    sub="Every one of these is decidable from the row without settling any of the open questions above. They are faults, not ambiguities."
                  />
                  <div className="divide-y divide-[#FEE2E2]">
                    {recon.breaks.map((b) => (
                      <div key={b.title} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <span className="flex items-baseline gap-2 flex-wrap min-w-0">
                            <span className="text-[12px] font-semibold text-[#991B1B]">
                              {b.title}
                            </span>
                            <span
                              className="h-[16px] px-1.5 rounded text-[9px] font-bold inline-flex items-center uppercase"
                              style={
                                b.severity === "money"
                                  ? { backgroundColor: "#FEE2E2", color: "#DC2626" }
                                  : b.severity === "control"
                                    ? { backgroundColor: "#EDE9FE", color: "#6D28D9" }
                                    : { backgroundColor: "#F1F5F9", color: "#64748B" }
                              }
                            >
                              {b.severity}
                            </span>
                          </span>
                          {b.delta !== 0 && (
                            <span className="font-mono text-[12px] font-semibold text-[#DC2626] whitespace-nowrap">
                              {formatPkr(Math.abs(b.delta))}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed max-w-[96ch]">
                          {b.detail}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------- Structural limits ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Scale size={15} />}
                  title="What INTERNATIONALCARGO cannot record"
                  sub="Ten limits. Six hold on every row by construction — a column that does not exist cannot be filled in. The other four are marked where they are costing something on the row open here."
                />
                <div className="divide-y divide-[#F1F5F9]">
                  {REVENUE_LIMITS.map((limit) => {
                    /*
                     * Two tiers, not one badge. A missing column applies to every
                     * row of the table and is not something this booking did —
                     * marking those amber beside a limit that is actually costing
                     * money here would make the highlight mean nothing.
                     */
                    const bites = !limit.always && limit.bites(r, siblings.length);
                    return (
                      <div
                        key={limit.code}
                        className="px-5 py-3.5"
                        style={{ backgroundColor: bites ? "#FFFBEB" : undefined }}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p
                            className="text-[12px] font-semibold"
                            style={{ color: bites ? "#92400E" : "#0F172A" }}
                          >
                            {limit.title}
                          </p>
                          {bites ? (
                            <span className="h-[18px] px-1.5 rounded bg-[#FEF3C7] text-[#D97706] text-[9px] font-bold inline-flex items-center whitespace-nowrap">
                              BITES ON THIS ROW
                            </span>
                          ) : limit.always ? (
                            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[9px] font-bold inline-flex items-center whitespace-nowrap">
                              EVERY ROW
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed max-w-[96ch]">
                          {limit.consequence}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-1 leading-relaxed">
                          Elsewhere: <span className="font-mono">{limit.elsewhere}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/export/billing"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  The charging half of §25 — ExportGodownrent <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/export/booking"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Where the capacity was sold — §01 booking <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/export/acceptance"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Where the kilo came from — §03 weighment <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/export/uplift"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Closure &amp; archive — §23–25 <ArrowUpRight size={12} />
                </Link>
              </div>

              <AuditStrip
                record={r}
                extra={[
                  { label: "site", value: r.site },
                  { label: "DFLAG", value: `"${r.DFLAG}" — a second delete flag beside IsDeleted` },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
