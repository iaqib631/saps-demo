"use client";

/**
 * The AWB lens on godown rent — ported from `/cmts-absorption/godown-rent-history`.
 *
 * The voucher lens next door answers "what is on GRV-2026-0142". This one
 * answers "what has this AWB been charged, across every voucher ever cut
 * against it" — the question CMTS' history screen was built for and the
 * voucher-scoped screen cannot ask, because its answer has to fit inside one
 * voucher. The Voucher column here genuinely varies down the table; that is the
 * whole point of the view, not decoration.
 *
 * All arithmetic and all row construction live in `rentLedger.ts` so the two
 * lenses share one model. This file is presentation.
 */

import { useMemo, useState } from "react";
import { CalendarClock, Layers, Receipt, Search } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { AgingBadge } from "@/components/primitives";
import {
  cargoClass,
  formatDate,
  formatPkr,
  type GodownRent,
} from "@/lib/domain";
import {
  buildAwbLedgers,
  matchesLedger,
  rateLabel,
  type AwbRentLedger,
} from "./rentLedger";

const COLUMNS = [
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
];

function LedgerButton({
  ledger,
  active,
  onSelect,
}: {
  ledger: AwbRentLedger;
  active: boolean;
  onSelect: () => void;
}) {
  const multi = ledger.vouchers.length > 1;
  return (
    <button
      onClick={onSelect}
      className="w-full text-left px-5 py-3 border-b border-[#F1F5F9] last:border-0 hover:bg-[#F8FAFC] transition-colors cursor-pointer"
      style={{ backgroundColor: active ? "#EBF0F7" : undefined }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[12px] font-semibold text-[#0F172A]">{ledger.awbNo}</span>
        <span
          className="h-[18px] px-1.5 rounded text-[9px] font-bold inline-flex items-center whitespace-nowrap"
          style={
            multi
              ? { backgroundColor: "#F5F3FF", color: "#7C3AED" }
              : { backgroundColor: "#F1F5F9", color: "#64748B" }
          }
        >
          {ledger.vouchers.length} GRV{ledger.vouchers.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-[11px] text-[#64748B] mt-0.5">
        {cargoClass(ledger.cargoClassId).ABBREVATION} · {formatPkr(ledger.totals.net)}
      </p>
      <p className="text-[11px] text-[#94A3B8] mt-0.5">
        {ledger.totalDays}d dwell · {ledger.freeDays}d free · {ledger.periods.length} period
        {ledger.periods.length === 1 ? "" : "s"}
      </p>
    </button>
  );
}

export default function AwbRentLedgerView({ rents }: { rents: GodownRent[] }) {
  const ledgers = useMemo(() => buildAwbLedgers(rents), [rents]);

  // The legacy screen opened on an AWB rather than on a picker, so the search
  // box seeds the selection instead of gating it.
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(ledgers[0]?.awbNo ?? null);

  const visible = useMemo(
    () => ledgers.filter((l) => matchesLedger(l, query)),
    [ledgers, query],
  );

  const ledger = visible.find((l) => l.awbNo === selected) ?? visible[0] ?? null;
  const cls = ledger ? cargoClass(ledger.cargoClassId) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="relative">
          <Search size={14} className="text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search AWB or voucher…"
            className="pl-9 pr-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] font-mono outline-none focus:ring-2 focus:ring-[#1B4F8B]/30 focus:border-[#1B4F8B] w-72"
          />
        </div>
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
          {visible.length} AWB{visible.length === 1 ? "" : "s"} with rent
          {ledger && (
            <>
              {" · showing "}
              <span className="font-mono text-[#0B2545]">{ledger.awbNo}</span>
            </>
          )}
        </span>
      </div>

      {!ledger ? (
        <EmptyState
          title="No AWB matches that search"
          description="Search by AWB number or by any GRV number cut against it."
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden h-fit">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Layers size={15} className="text-[#64748B]" />
              <h3 className="text-[14px] font-semibold text-[#0F172A]">AWBs with rent</h3>
            </div>
            <div className="max-h-[560px] overflow-y-auto">
              {visible.map((l) => (
                <LedgerButton
                  key={l.awbNo}
                  ledger={l}
                  active={ledger.awbNo === l.awbNo}
                  onSelect={() => setSelected(l.awbNo)}
                />
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-5">
            {/* Header — the AWB, its clock and its free allowance */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {ledger.awbId !== null ? (
                      <AwbLink awbNo={ledger.awbNo} awbId={ledger.awbId} />
                    ) : (
                      <span className="font-mono text-[15px] font-bold text-[#0F172A]">
                        {ledger.awbNo}
                      </span>
                    )}
                    {ledger.origin === "legacy-cmts" && (
                      <span className="h-[20px] px-2 rounded bg-[#FEF3C7] text-[#D97706] text-[10px] font-bold inline-flex items-center font-mono">
                        CMTS REFERENCE CASE
                      </span>
                    )}
                    {ledger.vouchers.length > 1 && (
                      <span className="h-[20px] px-2 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center">
                        {ledger.vouchers.length} VOUCHERS
                      </span>
                    )}
                  </div>
                  <p className="text-[12px] text-[#64748B] mt-1.5">
                    {cls?.NAME} · clock started {formatDate(ledger.clockStartedAt)} ·{" "}
                    <span className="font-mono">{ledger.freeDays}</span> free day
                    {ledger.freeDays === 1 ? "" : "s"} from{" "}
                    <span className="font-mono">CARGOCLASS</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                    Net rent, all vouchers
                  </p>
                  <p className="text-[22px] font-bold text-[#0B2545] font-mono">
                    {formatPkr(ledger.totals.net)}
                  </p>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-[#F1F5F9]">
                <AgingBadge totalDays={ledger.totalDays} freeDays={ledger.freeDays} />
              </div>
            </div>

            {/* Voucher slices — the multi-GRV evidence */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                <Receipt size={15} className="text-[#64748B]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Vouchers against this AWB
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    CMTS cuts a fresh GODOWNRENT voucher each time rent is billed forward, so one
                    consignment can carry several.
                  </p>
                </div>
              </div>
              <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ledger.vouchers.map((v) => (
                  <div key={v.voucher} className="rounded-xl border border-[#E2E8F0] px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[12px] font-semibold text-[#1B4F8B]">
                        {v.voucher}
                      </span>
                      <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                        {formatPkr(v.net)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[#94A3B8] mt-1">
                      {v.periodCount} period{v.periodCount === 1 ? "" : "s"} · {v.days}d
                      {v.waived > 0 && (
                        <span className="text-[#7C3AED]"> · {formatPkr(v.waived)} waived</span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* The period ledger itself */}
            <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
              <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
                <CalendarClock size={15} className="text-[#64748B]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Rent periods across vouchers
                  </h3>
                  <p className="text-[11px] text-[#94A3B8] mt-0.5">
                    Ordered by the storage clock: intake, then the free band, then each chargeable
                    rate tier.
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px]">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                      {COLUMNS.map((h) => (
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
                    {ledger.periods.map((p) => (
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
                        <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569]">
                          {p.days}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                          {rateLabel(p)}
                        </td>
                        <td className="px-3 py-2.5 whitespace-nowrap">
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
                        {ledger.totals.days}
                      </td>
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5" />
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
                        {formatPkr(ledger.totals.computed)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#7C3AED] whitespace-nowrap">
                        − {formatPkr(ledger.totals.waived)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[13px] font-bold text-[#0B2545] whitespace-nowrap">
                        {formatPkr(ledger.totals.net)}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[11px] text-[#64748B] whitespace-nowrap">
                        {ledger.vouchers.length} GRV
                        {ledger.vouchers.length === 1 ? "" : "s"}
                      </td>
                      <td className="px-3 py-2.5" />
                    </tr>
                  </tfoot>
                </table>
              </div>
              <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
                <p className="text-[11px] text-[#64748B]">
                  {ledger.note ??
                    "Each row carries the voucher it was billed on. Filtering these rows to a single voucher reproduces the voucher-scoped view exactly — the AWB lens is the wider one, not a different dataset."}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
