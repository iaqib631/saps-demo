"use client";

/**
 * P5-3 / P5-4 · Godown Rent voucher — CMTS `GODOWNRENT` (75 cols) +
 * `GODOWNRENTDETAIL` (26) + `GODOWNRENTDUPLICATE` (10).
 *
 * Gap G9: the whole godown-rent calculation chain — six CMTS tables, 165
 * columns — had no screen. The CMTS preview screen this replaces listed
 * vouchers but could not open one.
 *
 * Three things this makes visible that the header alone cannot:
 *   • the **detail lines** the `sum*` columns are the sum of. A consignment
 *     split across two zones is charged at two location rates.
 *   • the **payment block** — CHALLANNO, PAYORDERNO, CHEQUENO, BANKNAME,
 *     ACCTITLE and friends had 0 occurrences in the pre-P0 demo.
 *   • **duplicates** — a reprint is a sequenced, chargeable event with a
 *     recorded reason, not a silent re-print.
 *
 * TWO LENSES
 * ----------
 * This screen was voucher-scoped only, and that turned out to be a modelling
 * limit rather than a navigation one. CMTS bills rent forward in instalments
 * and cuts a new GODOWNRENT voucher each time, so a single AWB routinely spans
 * several GRVs — the legacy history screen showed five period rows carrying
 * four different voucher numbers. A voucher-scoped screen can only ever stamp
 * one voucher on every row, so that consignment is not expressible here at all.
 *
 * The fix is a second lens over one shared model (`components/billing/
 * godown-rent/rentLedger.ts`), not a search box: the AWB lens owns the periods
 * and each period carries its own voucher, and filtering those rows back down
 * to a single voucher is what produces the voucher lens. One constructor, so
 * the two cannot disagree.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, CalendarClock, Copy, FileText, Receipt, Wallet } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import AwbRentLedgerView from "@/components/billing/godown-rent/AwbRentLedgerView";
import { deriveLedger, rateLabel } from "@/components/billing/godown-rent/rentLedger";
import { AuditStrip, DocNumber } from "@/components/primitives";
import { useSite } from "@/components/site/SiteContext";
import {
  awbByNo,
  cargoClass,
  duplicatesFor,
  formatDate,
  formatKg,
  formatPkr,
  grDetailsFor,
  listGodownRents,
  storageLocation,
} from "@/lib/domain";

const BILL_TONE: Record<string, { bg: string; fg: string }> = {
  NORMAL: { bg: "#F1F5F9", fg: "#64748B" },
  SUPPLIMENT: { bg: "#FEF3C7", fg: "#D97706" },
  DUPLICATE: { bg: "#F5F3FF", fg: "#7C3AED" },
  FREEHAND: { bg: "#DBEAFE", fg: "#1B4F8B" },
};

/**
 * Legacy CMTS `godown-rent-history` broke a voucher down by TIME-BASED RATE
 * TIER / PERIOD — the free-period grace, the standard band, the premium
 * long-stay band, each with its own rate, surcharge and waiver. The canonical
 * screen only breaks down by zone/class/location, so this slice was invisible.
 *
 * The rows used to be a static const here, and it hardcoded "Day 1–3 free".
 * That literal was wrong for most of the product: free days are a CARGOCLASS
 * property and range from 0 (CDT, CDR, REX, LST) to 7 (DIP). The rows are now
 * built by `rentLedger.buildLedger`, which reads the grace band off the cargo
 * class and walks the chargeable tiers forward from cargo intake — so the
 * FC-07 BC-3 ordering (clock starts at intake → free band → chargeable =
 * dwell − free) is structural rather than asserted, and a class with no free
 * allowance renders no free row instead of a wrong one.
 */

export default function GodownRentPage() {
  const { scope, isHq } = useSite();
  const rents = useMemo(() => listGodownRents(scope), [scope]);

  /**
   * Which question the screen is answering. `voucher` is the original screen —
   * "what is on this GRV". `awb` is the ported CMTS lens — "what has this AWB
   * been charged across every GRV cut against it".
   */
  const [lens, setLens] = useState<"voucher" | "awb">("voucher");

  const [selected, setSelected] = useState<string | null>(rents[0]?.VOUCHERNO ?? null);
  const g = rents.find((x) => x.VOUCHERNO === selected) ?? rents[0] ?? null;
  const lines = g ? grDetailsFor(g.VOUCHERNO) : [];
  const dups = g ? duplicatesFor(g.VOUCHERNO) : [];
  const awb = g ? awbByNo(g.AWBNO) : null;

  const [tab, setTab] = useState<"lines" | "payment" | "duplicates">("lines");

  const unpaid = rents.filter((r) => !r.PAID);

  /**
   * The voucher lens is the AWB ledger narrowed to one voucher. The free band
   * (voucher `null`) is kept: it heads the AWB's storage clock, and dropping it
   * would show the chargeable bands with nothing before them — exactly the
   * ordering FC-07 BC-3 exists to prevent.
   */
  const ledger = useMemo(
    () => (g ? deriveLedger(g.AWBNO, rents.filter((r) => r.AWBNO === g.AWBNO)) : null),
    [g, rents],
  );
  const voucherPeriods = useMemo(
    () =>
      ledger && g
        ? ledger.periods.filter((p) => p.voucher === null || p.voucher === g.VOUCHERNO)
        : [],
    [ledger, g],
  );
  const periodTotals = useMemo(
    () =>
      voucherPeriods.reduce(
        (acc, p) => ({
          days: acc.days + p.days,
          computed: acc.computed + p.computed,
          waived: acc.waived + p.waived,
          net: acc.net + p.net,
        }),
        { days: 0, computed: 0, waived: 0, net: 0 },
      ),
    [voucherPeriods],
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Billing" }, { label: "Godown Rent" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M11
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              GODOWNRENT 75 · DETAIL 26 · DUPLICATE 10
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              GAP G9
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Godown Rent Voucher
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            The voucher, its line breakdown, and how it was paid — or the same rent read AWB-first,
            across every voucher cut against it.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/*
        The lens switch. Two different questions, not two skins: the voucher
        lens cannot express one AWB spanning several GRVs, because every row it
        renders belongs to the voucher it was opened from.
      */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 flex flex-wrap items-center gap-3">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          Scope
        </span>
        {(
          [
            ["voucher", "By voucher", "What is on one GRV"],
            ["awb", "By AWB", "Every rent period, across every GRV"],
          ] as const
        ).map(([v, label, hint]) => (
          <button
            key={v}
            onClick={() => setLens(v)}
            title={hint}
            className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
            style={{
              backgroundColor: lens === v ? "#0B2545" : "#FFFFFF",
              color: lens === v ? "#FFFFFF" : "#475569",
              borderColor: lens === v ? "#0B2545" : "#E2E8F0",
            }}
          >
            {label}
          </button>
        ))}
        <span className="text-[11px] text-[#64748B]">
          {lens === "voucher"
            ? "Voucher-scoped — every row below belongs to the selected GRV."
            : "AWB-scoped — rows carry their own GRV, so an AWB billed forward in instalments stays one consignment."}
        </span>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Vouchers", value: String(rents.length), tone: "#0F172A" },
          { label: "Unpaid", value: String(unpaid.length), tone: "#DC2626" },
          {
            label: "Outstanding",
            value: formatPkr(unpaid.reduce((n, r) => n + r.NETPAYABLE, 0)),
            tone: "#D97706",
          },
          {
            label: "Waived",
            value: String(rents.filter((r) => r.WAIVEOFF).length),
            tone: "#7C3AED",
          },
          // Rate-tier KPIs describe the selected voucher, so they only belong
          // on the voucher lens — the AWB lens totals its own periods in place.
          ...(lens === "voucher"
            ? [
                {
                  label: "Periods on this voucher",
                  value: String(voucherPeriods.length),
                  tone: "#0F172A",
                },
                {
                  label: "Net rent",
                  value: formatPkr(periodTotals.net),
                  tone: "#0B2545",
                },
              ]
            : []),
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

      {rents.length === 0 ? (
        <EmptyState
          title="No vouchers at this site"
          description="A GR voucher issues once FC-07 charges are computed and the five release conditions are evaluated."
        />
      ) : lens === "awb" ? (
        <AwbRentLedgerView rents={rents} />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Receipt size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">Vouchers</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {rents.map((r) => (
                <button
                  key={r.VOUCHERNO}
                  onClick={() => setSelected(r.VOUCHERNO)}
                  className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
                  style={{ backgroundColor: g?.VOUCHERNO === r.VOUCHERNO ? "#EBF0F7" : undefined }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                      {r.VOUCHERNO}
                    </span>
                    <span
                      className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center"
                      style={
                        r.PAID
                          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
                      }
                    >
                      {r.PAID ? "PAID" : "UNPAID"}
                    </span>
                  </div>
                  <p className="text-[11px] text-[#64748B] mt-0.5">
                    {r.AWBNO} · {formatPkr(r.NETPAYABLE)}
                  </p>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    {formatDate(r.GRDATE)} · {r.DAYS}d
                  </p>
                </button>
              ))}
            </div>
          </div>

          {g && (
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Header */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <DocNumber doc={g.docNumber} />
                      <span
                        className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center"
                        style={{
                        backgroundColor: BILL_TONE[g.BILLTYPE].bg,
                        color: BILL_TONE[g.BILLTYPE].fg,
                      }}
                      >
                        {g.BILLTYPE}
                      </span>
                      {g.WAIVEOFF && (
                        <span className="h-[22px] px-2.5 rounded-full bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center">
                          WAIVED {g.WAIVEOFFPERCENT}%
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-1.5">
                      {awb && <AwbLink awbNo={awb.AWBNO} awbId={awb.AWBId} />}
                      {" · "}IGM {g.IGMNO} · {formatDate(g.FROMDATE)} → {formatDate(g.TODATE)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                      Net payable
                    </p>
                    <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                      {formatPkr(g.NETPAYABLE)}
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-4 pt-4 border-t border-[#F1F5F9]">
                  {(
                    [
                      ["CHALLANNO", g.CHALLANNO],
                      ["TOTALWEIGHT", formatKg(g.TOTALWEIGHT)],
                      ["CHARGEABLEWEIGHT", formatKg(g.CHARGEABLEWEIGHT)],
                      ["DAYS", String(g.DAYS)],
                      ["SUPPLIMENTDAYS", String(g.SUPPLIMENTDAYS)],
                      ["TOTALPIECES", String(g.TOTALPIECES)],
                      ["NTN", g.NTN],
                      ["STN", g.STN],
                    ] as const
                  ).map(([k, v]) => (
                    <div key={k} className="flex flex-col gap-1">
                      <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                      <span
                        className="text-[13px] font-medium break-words"
                        style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                      >
                        {v ?? "null"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex items-center gap-2 flex-wrap">
                {(
                  [
                    ["lines", `Detail lines (${lines.length})`],
                    ["payment", "Payment block"],
                    ["duplicates", `Duplicates (${dups.length})`],
                  ] as const
                ).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setTab(v)}
                    className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
                    style={{
                      backgroundColor: tab === v ? "#0B2545" : "#FFFFFF",
                      color: tab === v ? "#FFFFFF" : "#475569",
                      borderColor: tab === v ? "#0B2545" : "#E2E8F0",
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {tab === "lines" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      GODOWNRENTDETAIL — what the sum* columns are the sum of
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      One line per class / subclass / location the consignment occupied.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                          {["Zone", "Class / Subclass", "Days", "Weight", "Handling", "Storage", "Location", "Ex-tax", "Tax", "Total"].map((h) => (
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
                        {lines.map((d) => (
                          <tr key={d.Id} className="border-b border-[#F1F5F9] last:border-0">
                            <td className="px-3 py-2.5 text-[12px] text-[#0F172A] font-medium whitespace-nowrap">
                              {storageLocation(d.LOCATIONID)?.ABBREVATION ?? d.LOCATIONID}
                            </td>
                            <td className="px-3 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                              {cargoClass(d.CLASSID).ABBREVATION}
                              <span className="text-[#94A3B8]">
                                {" "}
                                / #{d.SUBCLASSID}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">{d.DAYS}</td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatKg(d.WEIGHT)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatPkr(d.HandlingCharges)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatPkr(d.StorgeUnitCharges)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatPkr(d.LocationCharges)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatPkr(d.TotalAmountWithoutTax)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                              {formatPkr(d.Tax)}
                            </td>
                            <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                              {formatPkr(d.TotalAmountWithTax)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0] grid grid-cols-2 md:grid-cols-4 gap-x-5 gap-y-2">
                    {(
                      [
                        ["sumHandlingCharges", g.sumHandlingCharges],
                        ["sumStorgeUnitCharges", g.sumStorgeUnitCharges],
                        ["sumLocationChargesAmount", g.sumLocationChargesAmount],
                        ["sumTax", g.sumTax],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-[9px] font-mono text-[#CBD5E1]">{k}</p>
                        <p className="font-mono text-[12px] font-semibold text-[#0F172A]">
                          {formatPkr(v)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tab === "payment" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Wallet size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">Payment block</h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        These CMTS columns had 0 occurrences in the demo before Phase 5
                      </p>
                    </div>
                  </div>
                  <div className="p-5 grid grid-cols-2 md:grid-cols-3 gap-x-5 gap-y-4">
                    {(
                      [
                        ["PAID", g.PAID ? "true" : "false"],
                        ["Paymode", g.Paymode],
                        ["PAYDATE", g.PAYDATE ? formatDate(g.PAYDATE) : null],
                        ["CASHAMOUNT", g.CASH ? formatPkr(g.CASHAMOUNT) : null],
                        ["PAYORDERNO", g.PAYORDERNO],
                        ["PAYORDERAMOUNT", g.PayOrder ? formatPkr(g.PAYORDERAMOUNT) : null],
                        ["CHEQUENO", g.CHEQUENO ? String(g.CHEQUENO) : null],
                        ["CHEQUEDATE", g.CHEQUEDATE ? formatDate(g.CHEQUEDATE) : null],
                        ["BANKNAME", g.BANKNAME],
                        ["BANKBRANCHNAME", g.BANKBRANCHNAME],
                        ["ACCTITLE", g.ACCTITLE],
                        ["ACCNO", g.ACCNO],
                        ["CREDITCARD", g.CREDITCARD],
                        ["RECIEVEDBY", g.RECIEVEDBY],
                        ["OverPaidAmount", g.OverPaidAmount ? formatPkr(g.OverPaidAmount) : null],
                      ] as const
                    ).map(([k, v]) => (
                      <div key={k} className="flex flex-col gap-1">
                        <span className="text-[9px] font-mono text-[#CBD5E1]">{k}</span>
                        <span
                          className="text-[13px] font-medium break-words"
                          style={{ color: v ? "#0F172A" : "#CBD5E1" }}
                        >
                          {v ?? "null"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B]">
                      FC-07 adds cash-less payment via gateway with auto-reconciliation. The legacy
                      instruments above still need manual reconciliation — both paths coexist during
                      the rollout.
                    </p>
                  </div>
                </div>
              )}

              {tab === "duplicates" && (
                <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                    <Copy size={15} className="text-[#64748B]" />
                    <div>
                      <h3 className="text-[14px] font-semibold text-[#0F172A]">
                        Duplicate reprints — GODOWNRENTDUPLICATE
                      </h3>
                      <p className="text-[11px] text-[#94A3B8]">
                        DUPLICATECOUNT on the header: {g.DUPLICATECOUNT}
                      </p>
                    </div>
                  </div>
                  {dups.length === 0 ? (
                    <p className="p-5 text-[12px] text-[#94A3B8]">
                      No reprints issued against this voucher.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F1F5F9]">
                      {dups.map((d) => (
                        <div key={d.SEQUENCENO} className="px-5 py-3.5">
                          <div className="flex items-center justify-between gap-3 flex-wrap">
                            <span className="text-[12px] font-semibold text-[#0F172A]">
                              Sequence #{d.SEQUENCENO} · {formatDate(d.DUPLICATEDATE)}
                            </span>
                            <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                              {formatPkr(d.DuplicateTotalAmount)}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#475569] mt-1">{d.COMMENTS}</p>
                          <p className="text-[11px] text-[#94A3B8] mt-0.5">
                            {formatPkr(d.DuplicateAmount)} + {d.DuplicateTaxPercen}% tax ·{" "}
                            {d.USERID}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                    <p className="text-[11px] text-[#64748B]">
                      A reprint is a sequenced, chargeable event with a recorded reason — not a
                      silent re-print. That is what makes the count on the header defensible.
                    </p>
                  </div>
                </div>
              )}

              {/* Rent periods — legacy CMTS time-based rate-tier breakdown */}
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
                <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                  <CalendarClock size={15} className="text-[#64748B]" />
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#0F172A]">
                      Rent periods — time-based rate tiers
                    </h3>
                    <p className="text-[11px] text-[#94A3B8] mt-0.5">
                      How the legacy CMTS godown-rent-history screen split the voucher: by
                      rate-tier / period, with per-tier surcharge and waiver.
                    </p>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px]">
                    <thead>
                      <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                        {[
                          "Period",
                          "From",
                          "To",
                          "Days",
                          "Rate",
                          "Surcharge",
                          "Computed",
                          "Waived",
                          "Net",
                          "Voucher",
                          "User",
                        ].map((h) => (
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
                      {voucherPeriods.map((p) => (
                        <tr
                          key={`${p.label}-${p.voucher ?? "free"}`}
                          className="border-b border-[#F1F5F9] last:border-0 align-top"
                          style={{ backgroundColor: p.band === "free" ? "#F0FDF4" : undefined }}
                        >
                          <td className="px-3 py-2.5 whitespace-nowrap">
                            <p className="text-[12px] font-medium text-[#0F172A]">{p.label}</p>
                            <p className="text-[10px] text-[#94A3B8] mt-0.5">{p.remark}</p>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {formatDate(p.from)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {formatDate(p.to)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">{p.days}</td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {rateLabel(p)}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] whitespace-nowrap">
                            <span
                              className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center"
                              style={
                                p.surchargeLabel === "0%" || p.surchargeLabel === "—"
                                  ? { backgroundColor: "#F1F5F9", color: "#64748B" }
                                  : { backgroundColor: "#FEF3C7", color: "#D97706" }
                              }
                            >
                              {p.surchargeLabel}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                            {formatPkr(p.computed)}
                          </td>
                          <td
                            className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap"
                            style={{ color: p.waived ? "#7C3AED" : "#CBD5E1" }}
                          >
                            {p.waived ? `− ${formatPkr(p.waived)}` : formatPkr(0)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                            {formatPkr(p.net)}
                          </td>
                          <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap">
                            {p.voucher ? (
                              <span className="text-[#1B4F8B]">{p.voucher}</span>
                            ) : (
                              <span className="text-[#CBD5E1]">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-[12px] text-[#475569] whitespace-nowrap">
                            {p.user}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t border-[#E2E8F0] bg-[#F8FAFC]">
                        <td className="px-3 py-2.5 text-[11px] font-semibold text-[#0F172A] uppercase tracking-wider whitespace-nowrap">
                          Totals
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A]">
                          {periodTotals.days}
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
                          {formatPkr(periodTotals.computed)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#7C3AED] whitespace-nowrap">
                          − {formatPkr(periodTotals.waived)}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[13px] font-bold text-[#0B2545] whitespace-nowrap">
                          {formatPkr(periodTotals.net)}
                        </td>
                        <td className="px-3 py-2.5" />
                        <td className="px-3 py-2.5" />
                      </tr>
                    </tfoot>
                  </table>
                </div>
                <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                  <p className="text-[11px] text-[#64748B]">
                    Same voucher, a different axis: the zone/class/location split above answers
                    &ldquo;where was it charged&rdquo;, this rate-tier split answers &ldquo;when, and
                    at what rate&rdquo; — the view the legacy godown-rent-history screen exposed.
                    The grace band is{" "}
                    <span className="font-mono">
                      {ledger?.freeDays ?? 0}d
                    </span>{" "}
                    because{" "}
                    <span className="font-mono">
                      CARGOCLASS.{awb ? cargoClass(awb.CARGOCLASSID).ABBREVATION : "—"}
                    </span>{" "}
                    says so — it is not a fixed &ldquo;first three days&rdquo;.
                    {ledger && ledger.vouchers.length > 1 && (
                      <>
                        {" "}
                        This AWB carries {ledger.vouchers.length} vouchers; switch the scope to{" "}
                        <strong>By AWB</strong> to see all of them at once.
                      </>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href="/billing/calculator"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  <FileText size={12} /> How this was calculated <ArrowUpRight size={12} />
                </Link>
                <Link
                  href="/billing/delivery-order"
                  className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                >
                  Delivery order & release gate <ArrowUpRight size={12} />
                </Link>
              </div>

              <AuditStrip record={g} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
