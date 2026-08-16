"use client";

/**
 * Export billing — CMTS `ExportGodownrent` (53 columns), the export twin of
 * the import godown-rent voucher.
 *
 * WHICH STEP THIS SERVES
 * ----------------------
 * FC-11 has exactly one billing node: **§25 "Export invoice / closure /
 * archive"** (M20), and the flow's own amendment parks half of it — the export
 * revenue share, `INTERNATIONALCARGO`, is BLK-02 pending SAPS. This screen is
 * the other half: the **charging** half of §25, the shipper-side rent and
 * service charges the counter collects before the paper is released.
 *
 * It reads back across the flow rather than sitting only at the end, because
 * the clock it bills is not §25's. `AccpetanceDate` is FC-11 §12 at the
 * counter, `FROMDATE`/`TODATE`/`DAYS` cover §17 export warehousing, and the
 * release block (`GrentAgent`, `Grentcnicn`, `GrentPrintDate`, `GrentTime`) is
 * the moment the printed voucher is handed over. So the route sits in the
 * export lane, after warehousing and beside uplift, which is where the
 * operation actually reaches billing — not in `/billing/*`, which is the
 * import consignee's money.
 *
 * WHY IT IS NOT A COPY OF `/billing/godown-rent`
 * ----------------------------------------------
 * The import voucher has four parts: header, charge breakdown over
 * `GODOWNRENTDETAIL` lines, a waiver chain, and a reconciliation of the
 * roll-up against those lines. The export table supports two of the four, and
 * the column list is the evidence:
 *
 *   • **no detail table.** There is no `ExportGodownrentDetail` in CMTS. The
 *     five charge columns sit on the voucher row, so the breakdown here is the
 *     decomposition of one roll-up — rendered as the addition it is, because
 *     a total with no visible derivation is the number nobody can sign off.
 *   • **no waiver chain.** No `WAIVEOFF*` columns at all. Relief is the single
 *     bit `FREE`, so building an approval UI would be inventing a mechanism
 *     the legacy record cannot hold. What that costs is stated instead, in the
 *     limits panel at the foot of the screen.
 *   • **a second cargo description.** `Hwbno` … `HwbShipper` mirror eight
 *     master-level columns at house-bill level, so the cargo tab is a
 *     master-versus-house comparison rather than a flat field dump — and it
 *     names the structural limit that comes with flattening houses onto the
 *     voucher row: one row, one house.
 *   • **a stronger reconciliation.** On the import voucher a gap between
 *     `TOTALAMOUNT` and `NETPAYABLE` is the waiver. Here nothing on the table
 *     can lawfully produce one, so a gap is always a finding.
 *
 * The domain model, the fixtures and every check live in
 * `lib/domain/exportbilling.ts`.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowUpRight,
  Calculator,
  CalendarClock,
  Check,
  Layers,
  Link2,
  Printer,
  Receipt,
  Scale,
  Wallet,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import { AuditStrip } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import { formatDate, formatDateTime, formatKg, formatPkr, listExports } from "@/lib/domain";
import {
  EXPORT_RENT_LIMITS,
  exportRentsForAwb,
  formatExactPkr,
  houseMirror,
  listExportRents,
  piecesOf,
  printedAt,
  reconcileExportRent,
  type ExportGodownRent,
} from "@/lib/domain/exportbilling";

/**
 * One voucher field carrying the CMTS column it maps to, so migration parity
 * is checkable on sight. Local rather than shared for the same reason
 * `/billing/godown-rent` keeps its own: most values on this screen are derived
 * text ("PKR 11,150", "true", "3 d") rather than raw record values.
 *
 * A null renders as the word `null` in the muted tone rather than as blank. On
 * a parity screen "this column exists and is empty" and "this column was never
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

/**
 * The voucher that last billed this AWB before the one given, or null.
 *
 * Written once and used by both the KPI count and the open voucher, so the
 * headline "do not reconcile" figure and the panel a reader opens can never be
 * derived from different assumptions about what continues what. The pairing is
 * read off a shared `AWBNO` and the period boundary because that is the only
 * relation the export table supports — there is no `GRREFERENCE` here.
 */
function previousVoucher(v: ExportGodownRent): ExportGodownRent | null {
  return (
    exportRentsForAwb(v.AWBNO)
      .filter(
        (x) => x.Voucherno !== v.Voucherno && Date.parse(x.TODATE) <= Date.parse(v.FROMDATE),
      )
      .sort((a, b) => Date.parse(b.TODATE) - Date.parse(a.TODATE))[0] ?? null
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
          {sub && <p className="text-[11px] text-[#94A3B8] mt-0.5 max-w-[62ch]">{sub}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

export default function ExportBillingPage() {
  const { scope, isHq } = useSite();
  const vouchers = useMemo(() => listExportRents(scope), [scope]);

  /*
   * The acceptance side is looked up unscoped on purpose. The voucher is
   * already filtered to the active site, and the consignment it belongs to is
   * at that same site — reading the scoped list as well would make the
   * cross-check silently disappear if the two ever disagreed, which is exactly
   * the condition worth seeing.
   */
  const consignments = useMemo(() => listExports("HQ"), []);

  const [selected, setSelected] = useState<string | null>(vouchers[0]?.Voucherno ?? null);
  const v = vouchers.find((x) => x.Voucherno === selected) ?? vouchers[0] ?? null;
  const [tab, setTab] = useState<"cargo" | "settlement" | "release">("cargo");

  /** Every voucher cut against this AWB — inferred from AWBNO, see below. */
  const siblings = useMemo(() => (v ? exportRentsForAwb(v.AWBNO) : []), [v]);
  const previous = useMemo(() => (v ? previousVoucher(v) : null), [v]);

  const recon = useMemo(() => (v ? reconcileExportRent(v, { previous }) : null), [v, previous]);
  const mirror = useMemo(() => (v ? houseMirror(v) : null), [v]);

  const consignment = v ? consignments.find((c) => c.awbNo === v.AWBNO) ?? null : null;
  const housesAtAcceptance = consignment ? consignment.hwb.length : 0;
  const scaleNetKg = consignment?.weighment?.netKg ?? null;

  const unpaid = vouchers.filter((x) => !x.PAID);
  const unreconciled = vouchers.filter(
    (x) => reconcileExportRent(x, { previous: previousVoucher(x) }).breaks.length > 0,
  );

  const stamp = v ? printedAt(v) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Export" }, { label: "Billing" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              FC-11 §25 · M20
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              EXPORTGODOWNRENT 53
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              FORM MISSING — 9% OVERLAP
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Export Rent &amp; Charges Voucher
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            What the shipper pays for the days between the acceptance counter and the aircraft — the
            charging half of FC-11 §25.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/*
        The step this screen serves, stated rather than implied. FC-11 draws
        billing once, at §25, and parks half of that node; a reader who knows
        the flow will otherwise look for this screen at §17 where the rent
        actually accrues.
      */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {[
            ["§12", "Accepted at the counter", "the clock starts"],
            ["§17", "Export warehousing", "the days being billed"],
            ["§25", "Invoice / closure", "the voucher is cut and collected"],
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
        <p className="text-[11px] text-[#64748B] leading-relaxed max-w-[100ch]">
          FC-11 carries one billing node and it is <span className="font-mono">§25</span>. Its other
          half — the airline revenue share on{" "}
          <span className="font-mono">INTERNATIONALCARGO</span> — is BLK-02, parked pending SAPS, so
          nothing here touches it. The rent itself accrues across §12 → §17 and is settled before
          the paper leaves the counter, which is why this screen reads three steps of the flow
          rather than one.
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {[
          { label: "Vouchers", value: String(vouchers.length), tone: "#0F172A" },
          { label: "Unpaid", value: String(unpaid.length), tone: "#DC2626" },
          {
            label: "Outstanding",
            value: formatPkr(unpaid.reduce((n, x) => n + x.NETPAYABLE, 0)),
            tone: "#D97706",
          },
          {
            label: "Billed",
            value: formatPkr(vouchers.reduce((n, x) => n + x.NETPAYABLE, 0)),
            tone: "#0B2545",
          },
          {
            label: "Do not reconcile",
            value: String(unreconciled.length),
            tone: unreconciled.length > 0 ? "#DC2626" : "#16A34A",
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

      {vouchers.length === 0 ? (
        <EmptyState
          title="No export vouchers at this site"
          description="A voucher is cut once the consignment leaves export warehousing (FC-11 §17) and the counter prices the days it was held."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <CardHead icon={<Receipt size={15} />} title="Vouchers" />
            <div className="max-h-[560px] overflow-y-auto">
              {vouchers.map((x) => (
                <button
                  key={x.Voucherno}
                  onClick={() => setSelected(x.Voucherno)}
                  className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  style={{ backgroundColor: v?.Voucherno === x.Voucherno ? "#EBF0F7" : undefined }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                      {x.Voucherno}
                    </span>
                    <span
                      className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                      style={
                        x.PAID
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {x.PAID ? "PAID" : "UNPAID"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {x.AWBNO} · {formatPkr(x.NETPAYABLE)}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    {formatDate(x.GRDATE)} · {x.DAYS}d · {x.Destination}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {v && recon && mirror && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* ---------------- Header ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-[15px] font-bold text-[#0F172A]">
                        {v.Voucherno}
                      </span>
                      <span className="text-[9px] font-mono text-[#CBD5E1]" title="CMTS column: Voucherno">
                        Voucherno
                      </span>
                      {v.FREE && (
                        <span
                          className="h-[22px] px-2.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center"
                          title="CMTS column: FREE — a bit, with no percentage, reason or approver behind it"
                        >
                          FREE
                        </span>
                      )}
                      {!v.PAID && (
                        <span className="h-[22px] px-2.5 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center">
                          OUTSTANDING
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      <span className="font-mono">{v.AWBNO}</span> · {v.Shippername} → {v.Destination}{" "}
                      · {v.Airline}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-baseline gap-1.5 justify-end">
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        Net payable
                      </p>
                      <span className="text-[9px] font-mono text-[#CBD5E1]" title="CMTS column: NETPAYABLE">
                        NETPAYABLE
                      </span>
                    </div>
                    <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                      {formatPkr(v.NETPAYABLE)}
                    </p>
                    {/*
                      The stored figure measured against the arithmetic that is
                      supposed to produce it. The badge sits beside the number a
                      reader takes away, not behind a tab — and it names the
                      count, because on this table every break is a break in the
                      row's own internal consistency.
                    */}
                    {recon.breaks.length > 0 && (
                      <div className="mt-1 flex flex-col items-end gap-0.5">
                        <span
                          className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1"
                          style={
                            recon.netAgrees
                              ? { backgroundColor: "#FEF3C7", color: "#D97706" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                          }
                        >
                          <AlertTriangle size={10} strokeWidth={2.5} />
                          {recon.breaks.length} check{recon.breaks.length === 1 ? "" : "s"} fail
                        </span>
                        <span className="text-[11px] text-[#64748B] text-right max-w-[320px] leading-snug">
                          {recon.netAgrees
                            ? "NETPAYABLE itself checks out — the breaks are listed under the charge build-up."
                            : `TOTALAMOUNT is ${formatExactPkr(v.TOTALAMOUNT)}, and no column on this table can account for the difference.`}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                  {(
                    [
                      ["Voucher date", "GRDATE", formatDate(v.GRDATE), false],
                      ["Challan", "CHALLANNO", v.CHALLANNO, true],
                      ["Master AWB", "AWBNO", v.AWBNO, true],
                      ["Carrier", "Airline", v.Airline, false],
                      ["Nature of goods", "NatureOfgood", v.NatureOfgood, false],
                      ["Destination", "Destination", v.Destination, true],
                      ["Shed location", "Location", v.Location, true],
                      ["Handling agent", "AgencyName", v.AgencyName, false],
                    ] as const
                  ).map(([label, cmts, value, mono]) => (
                    <Field key={cmts} label={label} cmts={cmts} value={value} mono={mono} />
                  ))}
                </div>
              </div>

              {/* ---------------- Sibling vouchers ---------------- */}
              {siblings.length > 1 && (
                <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] overflow-hidden">
                  <CardHead
                    icon={<Link2 size={15} />}
                    title={`${siblings.length} vouchers against this AWB — and nothing that links them`}
                    sub="The import voucher carries GRREFERENCE to say that one voucher continues another. ExportGodownrent has no such column, so this grouping is an inference off a shared AWBNO, not a relation the data holds."
                  />
                  <div className="divide-y divide-[#FDE68A]">
                    {siblings.map((s) => (
                      <button
                        key={s.Voucherno}
                        onClick={() => setSelected(s.Voucherno)}
                        className="w-full text-left px-5 py-3 flex items-center justify-between gap-3 flex-wrap hover:bg-[#FEF3C7] transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-2 flex-wrap">
                          <span
                            className="font-mono text-[12px] font-semibold"
                            style={{ color: s.Voucherno === v.Voucherno ? "#0F172A" : "#92400E" }}
                          >
                            {s.Voucherno}
                          </span>
                          {s.Voucherno === v.Voucherno && (
                            <span className="h-[16px] px-1.5 rounded bg-[#0B2545] text-white text-[9px] font-bold inline-flex items-center">
                              OPEN
                            </span>
                          )}
                          <span className="text-[11px] text-[#92400E]">
                            {formatDate(s.FROMDATE)} → {formatDate(s.TODATE)} · {s.DAYS}d
                          </span>
                        </span>
                        <span className="font-mono text-[12px] font-semibold text-[#92400E]">
                          {formatPkr(s.NETPAYABLE)}
                        </span>
                      </button>
                    ))}
                  </div>
                  <div className="px-5 py-3 border-t border-[#FDE68A]">
                    <p className="text-[11px] text-[#92400E] leading-relaxed">
                      {consignment?.uplift?.outcome === "offloaded"
                        ? `This consignment was offloaded at §23 — ${
                            consignment.uplift.offloadReason ?? "no reason recorded"
                          } — and went back to warehousing, so it accrued a second time. `
                        : "A consignment that returns to warehousing accrues a second time. "}
                      Whether the two periods meet, gap or overlap is checkable only by reading the
                      rows side by side, which is what the clock card below does.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------- Charge build-up ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Calculator size={15} />}
                  title="Charge build-up"
                  sub="Five charge columns and the roll-up they are supposed to reach. CMTS has no ExportGodownrentDetail table, so this addition is the entire derivation the record can offer."
                />
                <div className="p-5 flex flex-col gap-1.5">
                  {recon.chain.map((step) => (
                    <div
                      key={step.cmts}
                      className="flex items-baseline gap-3 py-1.5"
                      style={
                        step.isResult
                          ? { borderTop: "1px solid #E2E8F0", marginTop: 4, paddingTop: 10 }
                          : undefined
                      }
                    >
                      <span className="w-4 text-[13px] font-mono text-[#94A3B8] flex-shrink-0">
                        {step.op}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-1.5 flex-wrap">
                          <span
                            className="text-[13px]"
                            style={{
                              color: step.isResult ? "#0F172A" : "#475569",
                              fontWeight: step.isResult ? 600 : 500,
                            }}
                          >
                            {step.label}
                          </span>
                          <span
                            className="text-[9px] font-mono text-[#CBD5E1]"
                            title={`CMTS column: ${step.cmts}`}
                          >
                            {step.cmts}
                          </span>
                        </span>
                        {step.impliedRate && (
                          <span className="block text-[10px] text-[#94A3B8] mt-0.5">
                            {step.impliedRate} — derived, not stored
                          </span>
                        )}
                      </span>
                      <span
                        className="font-mono whitespace-nowrap"
                        style={{
                          fontSize: step.isResult ? 15 : 13,
                          fontWeight: step.isResult ? 700 : 500,
                          color: step.isResult ? "#0B2545" : step.amount === 0 ? "#CBD5E1" : "#0F172A",
                        }}
                      >
                        {formatPkr(step.amount)}
                      </span>
                    </div>
                  ))}

                  {!recon.totalAgrees && (
                    <div className="mt-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#991B1B]">
                        The five columns add up to {formatExactPkr(recon.partsTotal)}, not{" "}
                        {formatExactPkr(v.TOTALAMOUNT)}.
                      </p>
                    </div>
                  )}

                  {!recon.netAgrees && (
                    <div className="mt-2 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#991B1B]">
                        NETPAYABLE is {formatExactPkr(Math.abs(recon.netGap))}{" "}
                        {recon.netGap > 0 ? "below" : "above"} TOTALAMOUNT.
                      </p>
                      <p className="text-[11px] text-[#991B1B] mt-1 leading-relaxed">
                        On the import voucher that difference is{" "}
                        <span className="font-mono">WAIVEOFFAMOUNT</span>, approved through the
                        FC-07 §10–12 chain and attributable to a named approver. This table has no
                        waiver, discount, tax or rounding column — so the adjustment was made off
                        the record and there is nothing here to audit it against.
                      </p>
                    </div>
                  )}
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <p className="text-[11px] text-[#64748B] leading-relaxed">
                    The rates above are <strong>derived from the amounts</strong>, not read off the
                    record. The import side stores the basis of every figure —{" "}
                    <span className="font-mono">HANDLINGUNIT</span>,{" "}
                    <span className="font-mono">STORGEUNIT</span>,{" "}
                    <span className="font-mono">LOCATIONUNIT</span> on{" "}
                    <span className="font-mono">GODOWNRENTDETAIL</span> — and the export table
                    carries no unit column at all, so what any of these five charges was calculated
                    on is not recoverable from the voucher.
                  </p>
                </div>
              </div>

              {/* ---------------- Storage clock ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<CalendarClock size={15} />}
                  title="The days being billed"
                  sub="Cargo in, accepted, then the period charged. The clock starts at the counter, not at the gate."
                  right={
                    <span
                      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                      style={
                        recon.clock.agrees
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {recon.clock.agrees ? (
                        <>
                          <Check size={10} strokeWidth={3} /> DAYS matches the period
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={10} strokeWidth={2.5} /> DAYS is{" "}
                          {Math.abs(recon.clock.stored - recon.clock.inclusive)} day
                          {Math.abs(recon.clock.stored - recon.clock.inclusive) === 1 ? "" : "s"}{" "}
                          {recon.clock.stored < recon.clock.inclusive ? "short" : "over"}
                        </>
                      )}
                    </span>
                  }
                />
                <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                  <Field
                    label="Cargo at the terminal"
                    cmts="ARRIVALDATE"
                    value={formatDateTime(v.ARRIVALDATE)}
                  />
                  <Field
                    label="Accepted at the counter"
                    cmts="AccpetanceDate"
                    value={formatDateTime(v.AccpetanceDate)}
                  />
                  <Field
                    label="Free period flag"
                    cmts="FREE"
                    value={v.FREE ? "true" : "false"}
                    mono
                  />
                  <Field label="Period opens" cmts="FROMDATE" value={formatDate(v.FROMDATE)} />
                  <Field label="Period closes" cmts="TODATE" value={formatDate(v.TODATE)} />
                  <Field label="Days billed" cmts="DAYS" value={`${v.DAYS} d`} mono />
                </div>

                {/*
                  The count, three ways. CMTS's Charges procedure counts calendar
                  days inclusive of both ends; the demo's own daysBetween counts
                  elapsed 24-hour periods and is one short on every whole day
                  (schema audit §3.1). Printing both beside the stored figure is
                  what turns "the number looks odd" into "the number is the
                  elapsed count, and that is the defect".
                */}
                <div className="px-5 pb-5">
                  <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                    {(
                      [
                        [
                          "Stored on the voucher",
                          "DAYS",
                          `${recon.clock.stored} d`,
                          null,
                        ],
                        [
                          "Calendar days, both ends counted",
                          "DATEDIFF(day, FROMDATE, TODATE) + 1",
                          `${recon.clock.inclusive} d`,
                          "What the CMTS Charges procedure bills on.",
                        ],
                        [
                          "Elapsed 24-hour periods",
                          "daysBetween()",
                          `${recon.clock.elapsed} d`,
                          "What the demo's own helper returns — one short of CMTS on every whole day.",
                        ],
                      ] as const
                    ).map(([label, src, value, why]) => (
                      <div
                        key={label}
                        className="flex items-start justify-between gap-4 px-4 py-2.5 border-b border-[#F1F5F9] last:border-0"
                      >
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium text-[#0F172A]">
                            {label}
                          </span>
                          <span className="block text-[10px] font-mono text-[#CBD5E1] mt-0.5">
                            {src}
                          </span>
                          {why && (
                            <span className="block text-[11px] text-[#94A3B8] mt-0.5">{why}</span>
                          )}
                        </span>
                        <span className="font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                          {value}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p
                    className="text-[11px] mt-3 leading-relaxed"
                    style={{ color: recon.clock.opensCorrectly ? "#64748B" : "#991B1B" }}
                  >
                    {recon.clock.basis === "acceptance" ? (
                      <>
                        This is the first voucher on the AWB, so the period should open on{" "}
                        <span className="font-mono">AccpetanceDate</span> —{" "}
                        {formatDate(recon.clock.expectedOpening)}.{" "}
                        {recon.clock.opensCorrectly
                          ? "It does."
                          : "It does not, so days are either forgiven or billed before the terminal held the cargo."}
                      </>
                    ) : (
                      <>
                        This voucher continues <span className="font-mono">{previous?.Voucherno}</span>
                        , so the period should open the day after that one closed —{" "}
                        {formatDate(recon.clock.expectedOpening)}.{" "}
                        {recon.clock.opensCorrectly
                          ? "It does: no gap, no double-billed day."
                          : "It does not, so days are either billed to nobody or billed twice."}{" "}
                        Nothing on the row states the continuation; the pairing is read off a shared
                        AWBNO.
                      </>
                    )}
                  </p>
                </div>
              </div>

              {/* ---------------- Tabs ---------------- */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["cargo", `Cargo — master vs house${mirror.present ? "" : " (no house)"}`],
                    ["settlement", "Settlement"],
                    ["release", "Counter release"],
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

              {/* ---------------- Cargo: master vs house ---------------- */}
              {tab === "cargo" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <CardHead
                    icon={<Layers size={15} />}
                    title="One consignment, described twice"
                    sub="Hwbno through HwbShipper are not extra attributes — they are the same seven attributes one bill deeper, at house level. The voucher prices the master figures and carries the house ones."
                  />

                  {mirror.present && housesAtAcceptance > 1 && (
                    <div className="mx-5 mt-5 rounded-xl border border-[#FECACA] bg-[#FEF2F2] px-4 py-3">
                      <p className="text-[12px] font-semibold text-[#991B1B]">
                        Acceptance recorded {housesAtAcceptance} house rows. This voucher can hold
                        one.
                      </p>
                      <p className="text-[11px] text-[#991B1B] mt-1 leading-relaxed">
                        <span className="font-mono">CARGOACCEPTANCEHWB</span> holds as many houses as
                        the consolidation has; the eight <span className="font-mono">Hwb*</span>{" "}
                        columns are flattened onto the voucher row, so a consolidation is either
                        split across repeated vouchers — with the master weight counted again on
                        each — or truncated to its first house. There is no third option in this
                        schema, and the row gives no sign which happened.
                      </p>
                    </div>
                  )}

                  <div className="overflow-x-auto p-5">
                    <table className="w-full min-w-[720px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          {["", "Master level", "House level"].map((h, i) => (
                            <th
                              key={h || i}
                              className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {mirror.rows.map((row) => (
                          <tr
                            key={row.label}
                            className="border-b border-[#F1F5F9] last:border-0 align-top"
                          >
                            <td className="px-3 py-3 w-[26%]">
                              <p className="text-[12px] font-semibold text-[#0F172A]">{row.label}</p>
                              {row.note && (
                                <p className="text-[10px] text-[#94A3B8] mt-0.5 leading-snug">
                                  {row.note}
                                </p>
                              )}
                            </td>
                            <td className="px-3 py-3">
                              <span className="block text-[9px] font-mono text-[#CBD5E1]">
                                {row.masterCmts}
                              </span>
                              <span className="block text-[12px] font-medium text-[#0F172A] mt-0.5">
                                {row.master}
                              </span>
                            </td>
                            <td className="px-3 py-3">
                              <span className="block text-[9px] font-mono text-[#CBD5E1]">
                                {row.houseCmts}
                              </span>
                              <span
                                className="block text-[12px] font-medium mt-0.5"
                                style={{ color: row.house ? "#0F172A" : "#CBD5E1" }}
                              >
                                {row.house ?? "null"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/*
                    Two loose types on the same row, shown against each other
                    rather than described: the master piece count is varchar(50)
                    and the house count on the same row is an int, so one of them
                    can be added and the other cannot.
                  */}
                  <div className="px-5 pb-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div
                      className="rounded-xl border px-4 py-3"
                      style={{
                        borderColor: piecesOf(v) === null ? "#FDE68A" : "#E2E8F0",
                        backgroundColor: piecesOf(v) === null ? "#FFFBEB" : "#F8FAFC",
                      }}
                    >
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        Pieces, as stored
                      </p>
                      <p className="text-[13px] font-mono font-semibold text-[#0F172A] mt-1">
                        {v.Pcs}
                      </p>
                      <p
                        className="text-[11px] mt-1 leading-relaxed"
                        style={{ color: piecesOf(v) === null ? "#92400E" : "#64748B" }}
                      >
                        {piecesOf(v) === null ? (
                          <>
                            <span className="font-mono">Pcs</span> is varchar(50) and this value will
                            not parse as a count, so nothing can add it, compare it to{" "}
                            <span className="font-mono">Hwbpcs</span> — an int on the same row — or
                            total it across a report.
                          </>
                        ) : (
                          <>
                            Parses to {piecesOf(v)}. It is still varchar(50): the column permits any
                            text, and one voucher in this set uses it.
                          </>
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                      <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                        Weight, scale vs voucher
                      </p>
                      <p className="text-[13px] font-mono font-semibold text-[#0F172A] mt-1">
                        {scaleNetKg !== null ? formatKg(scaleNetKg) : "no weighment record"} →{" "}
                        {v.GrossWeight} kg
                      </p>
                      <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                        <span className="font-mono">GrossWeight</span> and{" "}
                        <span className="font-mono">ChargeableWeight</span> are int. IATA rounds
                        chargeable weight up to the next half kilo, and that step cannot survive an
                        integer column — so the figure this voucher prices is not the figure the
                        scale produced at §03.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* ---------------- Settlement ---------------- */}
              {tab === "settlement" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <CardHead
                    icon={<Wallet size={15} />}
                    title="Settlement"
                    sub="Cash and pay order are the only two instruments this table knows. The import voucher carries cheque, card, bank and gateway columns beside them; none of those exist here."
                    right={
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center uppercase whitespace-nowrap"
                        style={
                          recon.settlement.state === "settled"
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : recon.settlement.state === "unpaid"
                              ? { backgroundColor: "#F1F5F9", color: "#64748B" }
                              : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                        }
                      >
                        {recon.settlement.state}
                      </span>
                    }
                  />

                  <div className="p-5 flex flex-col gap-1.5">
                    {(
                      [
                        ["", "Cash tendered", "CASHAMOUNT", v.CASHAMOUNT],
                        ["+", "Pay order", "PAYORDERAMOUNT", v.PAYORDERAMOUNT],
                        ["=", "Tendered", "—", recon.settlement.tendered],
                      ] as const
                    ).map(([op, label, cmts, amount], i) => (
                      <div
                        key={label}
                        className="flex items-baseline gap-3 py-1.5"
                        style={
                          i === 2
                            ? { borderTop: "1px solid #E2E8F0", marginTop: 4, paddingTop: 10 }
                            : undefined
                        }
                      >
                        <span className="w-4 text-[13px] font-mono text-[#94A3B8] flex-shrink-0">
                          {op}
                        </span>
                        <span className="flex-1 flex items-baseline gap-1.5 flex-wrap">
                          <span
                            className="text-[13px]"
                            style={{ color: i === 2 ? "#0F172A" : "#475569", fontWeight: i === 2 ? 600 : 500 }}
                          >
                            {label}
                          </span>
                          {cmts !== "—" && (
                            <span
                              className="text-[9px] font-mono text-[#CBD5E1]"
                              title={`CMTS column: ${cmts}`}
                            >
                              {cmts}
                            </span>
                          )}
                        </span>
                        <span
                          className="font-mono text-[13px] whitespace-nowrap"
                          style={{
                            fontWeight: i === 2 ? 700 : 500,
                            color: amount === 0 ? "#CBD5E1" : "#0F172A",
                          }}
                        >
                          {formatPkr(amount)}
                        </span>
                      </div>
                    ))}

                    <div
                      className="mt-2 rounded-xl px-4 py-3 border"
                      style={
                        recon.settlement.state === "settled"
                          ? { borderColor: "#BBF7D0", backgroundColor: "#F0FDF4" }
                          : recon.settlement.state === "unpaid"
                            ? { borderColor: "#E2E8F0", backgroundColor: "#F8FAFC" }
                            : { borderColor: "#FECACA", backgroundColor: "#FEF2F2" }
                      }
                    >
                      <p
                        className="text-[12px] font-semibold"
                        style={{
                          color:
                            recon.settlement.state === "settled"
                              ? "#16A34A"
                              : recon.settlement.state === "unpaid"
                                ? "#64748B"
                                : "#991B1B",
                        }}
                      >
                        {recon.settlement.state === "settled" &&
                          `Settled in full against ${formatExactPkr(v.NETPAYABLE)}.`}
                        {recon.settlement.state === "unpaid" &&
                          `Nothing tendered. ${formatExactPkr(v.NETPAYABLE)} outstanding.`}
                        {recon.settlement.state === "short" &&
                          `${formatExactPkr(recon.settlement.balance)} short — and PAID is ${
                            v.PAID ? "set" : "not set"
                          }.`}
                        {recon.settlement.state === "over" &&
                          `${formatExactPkr(Math.abs(recon.settlement.balance))} more was tendered than the voucher bills.`}
                      </p>
                      {recon.settlement.state === "over" && (
                        <p className="text-[11px] text-[#991B1B] mt-1 leading-relaxed">
                          The import voucher carries <span className="font-mono">OverPaidAmount</span>{" "}
                          for exactly this. There is no such column here, so the difference left the
                          counter with no record on the document that produced it.
                        </p>
                      )}
                      {recon.settlement.state === "short" && v.PAID && (
                        <p className="text-[11px] text-[#991B1B] mt-1 leading-relaxed">
                          A receivables report reading <span className="font-mono">PAID</span> would
                          drop this balance entirely — the bit and the money columns disagree, and
                          the bit is the one most reports trust.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="px-5 pb-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                    {(
                      [
                        ["Paid", "PAID", v.PAID ? "true" : "false", true],
                        ["Pay order used", "PayOrder", v.PayOrder ? "true" : "false", true],
                        ["Pay order no", "PAYORDERNO", v.PAYORDERNO, true],
                        [
                          "Pay order date",
                          "PAYORDERDATE",
                          v.PAYORDERDATE ? formatDate(v.PAYORDERDATE) : null,
                          false,
                        ],
                        ["Received by", "RECIEVEDBY", v.RECIEVEDBY, false],
                        ["Paid on", "PAYDATE", v.PAYDATE ? formatDateTime(v.PAYDATE) : null, false],
                      ] as const
                    ).map(([label, cmts, value, mono]) => (
                      <Field key={cmts} label={label} cmts={cmts} value={value} mono={mono} />
                    ))}
                  </div>

                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B] leading-relaxed">
                      <span className="font-mono">RECIEVEDBY</span> is spelt as CMTS spells it. Every
                      misspelt column on this screen — <span className="font-mono">AccpetanceDate</span>
                      , <span className="font-mono">NatureOfgood</span>,{" "}
                      <span className="font-mono">Grentcnicn</span>,{" "}
                      <span className="font-mono">HwbChargableWt</span> — is carried exactly as the
                      source has it. A migration looks for the column that exists, not the one it
                      would have chosen.
                    </p>
                  </div>
                </div>
              )}

              {/* ---------------- Counter release ---------------- */}
              {tab === "release" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <CardHead
                    icon={<Printer size={15} />}
                    title="Counter release — who took the paper"
                    sub="Four columns with no import counterpart at all. The import voucher records who paid; only the export voucher records who collected the printed document, and on whose CNIC."
                  />
                  {v.GrentAgent === null ? (
                    <div className="p-5">
                      <p className="text-[12px] text-[#64748B] leading-relaxed">
                        Not yet printed. All four release columns are null, which on this voucher is
                        consistent —{" "}
                        {v.PAID
                          ? "the money is in but the paper has not been collected."
                          : "the voucher is still outstanding, and the paper does not leave the counter before it is settled."}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4">
                        <Field label="Collected by" cmts="GrentAgent" value={v.GrentAgent} />
                        <Field label="CNIC" cmts="Grentcnicn" value={v.Grentcnicn} mono />
                        <Field
                          label="Print date"
                          cmts="GrentPrintDate"
                          value={v.GrentPrintDate ? formatDateTime(v.GrentPrintDate) : null}
                        />
                        <Field label="Print time" cmts="GrentTime" value={v.GrentTime} mono />
                      </div>
                      {stamp && stamp.agrees === false && (
                        <div className="mx-5 mb-5 rounded-xl border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
                          <p className="text-[12px] font-semibold text-[#92400E]">
                            The two columns disagree about the same instant.
                          </p>
                          <p className="text-[11px] text-[#92400E] mt-1 leading-relaxed">
                            <span className="font-mono">GrentPrintDate</span> is a datetime and
                            already carries a time; <span className="font-mono">GrentTime</span> is a
                            separate time column carrying {v.GrentTime}. Nothing in the schema says
                            which one is the release, so the handover cannot be timed to better than
                            a working day. Both are kept — folding them into one timestamp is the
                            lossy transform the acceptance model refuses for{" "}
                            <span className="font-mono">TIMEOFACCEPTENCE</span>, for the same reason.
                          </p>
                        </div>
                      )}
                      {stamp && stamp.agrees === true && (
                        <div className="mx-5 mb-5 rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] px-4 py-3">
                          <p className="text-[12px] text-[#15803D]">
                            The datetime and the time column agree on this voucher. They are two
                            columns holding one instant, so agreement is worth checking rather than
                            assuming.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}

              {/* ---------------- Document dates ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<CalendarClock size={15} />}
                  title="Document dates"
                  sub="Truck in through paper out, in the order the events happen. Rendered as a sequence because the ordering is the check — a pay order dated before the voucher it settles is a defect, and it is invisible in a grid. FROMDATE and TODATE are absent on purpose: they bound the period rather than mark an event, and they open at midnight of the acceptance day, so folding them in would report every voucher as running backwards. They are checked in the clock card above."
                  right={
                    <span
                      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
                      style={
                        recon.timelineOrdered
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {recon.timelineOrdered ? (
                        <>
                          <Check size={10} strokeWidth={3} /> Runs forward
                        </>
                      ) : (
                        <>
                          <AlertTriangle size={10} strokeWidth={2.5} /> Out of sequence
                        </>
                      )}
                    </span>
                  }
                />
                <div className="p-5 flex flex-col gap-3">
                  {recon.timeline.map((e) => (
                    <div
                      key={e.cmts}
                      className="flex items-start justify-between gap-4 flex-wrap"
                      style={
                        e.outOfOrder
                          ? {
                              backgroundColor: "#FEF2F2",
                              borderRadius: 8,
                              padding: "6px 8px",
                              margin: "-6px -8px",
                            }
                          : undefined
                      }
                    >
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-[12px] font-semibold text-[#0F172A]">{e.label}</span>
                          <span
                            className="text-[9px] font-mono text-[#CBD5E1]"
                            title={`CMTS column: ${e.cmts}`}
                          >
                            {e.cmts}
                          </span>
                          {e.outOfOrder && (
                            <span className="h-[16px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[9px] font-bold inline-flex items-center">
                              BEFORE THE STEP ABOVE
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#94A3B8] mt-0.5">{e.why}</p>
                      </div>
                      <span
                        className="font-mono text-[12px] font-medium whitespace-nowrap"
                        style={{ color: e.iso ? "#0F172A" : "#CBD5E1" }}
                      >
                        {e.iso ? formatDate(e.iso) : "null"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* ---------------- Failed checks ---------------- */}
              {recon.breaks.length > 0 && (
                <div className="rounded-[16px] border border-[#FECACA] bg-white overflow-hidden">
                  <CardHead
                    icon={<AlertTriangle size={15} />}
                    title={`${recon.breaks.length} identity${
                      recon.breaks.length === 1 ? "" : "s"
                    } this voucher claims and does not satisfy`}
                    sub="Every one of these is checkable from the row alone. A voucher that cannot be reconciled against its own columns cannot be reconciled against the legacy record either."
                  />
                  <div className="divide-y divide-[#FEE2E2]">
                    {recon.breaks.map((b) => (
                      <div key={b.title} className="px-5 py-3.5">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <p className="text-[12px] font-semibold text-[#991B1B]">{b.title}</p>
                          {b.delta !== 0 && (
                            <span className="font-mono text-[12px] font-semibold text-[#DC2626] whitespace-nowrap">
                              {b.delta > 0 ? "+" : "−"}
                              {formatExactPkr(Math.abs(b.delta)).replace("PKR ", "")}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">{b.detail}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ---------------- Structural limits ---------------- */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <CardHead
                  icon={<Scale size={15} />}
                  title="What ExportGodownrent cannot record"
                  sub="Nine limits measured against the import voucher. Three hold on every row by construction — a column that does not exist cannot be filled in. The other six are marked where they are costing something on the voucher open here."
                />
                <div className="divide-y divide-[#F1F5F9]">
                  {EXPORT_RENT_LIMITS.map((limit) => {
                    /*
                     * Two tiers, not one badge. A missing column or a wrong
                     * type applies to every row of the table and is not
                     * something this voucher did — marking those amber beside
                     * a limit that is actually costing money here would make
                     * the highlight mean nothing.
                     */
                    const bites =
                      !limit.always && limit.bites(v, siblings.length, housesAtAcceptance);
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
                              BITES ON THIS VOUCHER
                            </span>
                          ) : limit.always ? (
                            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[9px] font-bold inline-flex items-center whitespace-nowrap">
                              EVERY VOUCHER
                            </span>
                          ) : null}
                        </div>
                        <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed">
                          {limit.consequence}
                        </p>
                        <p className="text-[10px] text-[#94A3B8] mt-1 leading-relaxed">
                          Import side: <span className="font-mono">{limit.importSide}</span>
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/export/warehousing"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Where the days accrued — §17 warehousing <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/export/acceptance"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Where the clock started — §12 acceptance <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/billing/godown-rent"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  The import twin — GODOWNRENT <ArrowUpRight size={12} />
                </Link>
              </div>

              <AuditStrip
                record={v}
                extra={[
                  { label: "site", value: v.site },
                  {
                    label: "CMTS audit names",
                    value: "CreatedOn / UpdatedOn on this table",
                  },
                ]}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
