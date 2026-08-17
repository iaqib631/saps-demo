"use client";

/**
 * "How was this total reached" — the presentation half of `voucherReconciliation`.
 *
 * The screen used to print `NETPAYABLE` and a four-column strip of `sum*`
 * values, with a ten-column grid between them that shared no visible arithmetic
 * with either. This file replaces that with the three things a finance officer
 * actually reconciles against the legacy voucher, in the order they check them:
 *
 *   1. each GODOWNRENTDETAIL line, rebuilt as the addition it represents;
 *   2. every GODOWNRENT roll-up, measured against the detail column it claims
 *      to be the sum of;
 *   3. the headline chain, ex-tax → tax → total → waiver → net payable.
 *
 * WHY A LEDGER AND NOT MORE COLUMNS
 * ---------------------------------
 * The seven charge columns and three unit columns this ticket adds would have
 * taken the existing table to seventeen columns, which is unreadable and — more
 * to the point — still would not have shown the arithmetic, because a table
 * puts values side by side and says nothing about which ones add up. A voucher
 * line is a vertical sum on paper, so it is rendered as one here: terms, a rule,
 * a subtotal, tax, a total. The unit columns sit against the amounts they
 * qualify, which is the only place they mean anything — "PER KG / DAY" is a
 * fact about the storage charge, not a free-standing field.
 *
 * FAILED IDENTITIES ARE PROMOTED, NOT SWALLOWED
 * ---------------------------------------------
 * Anything that does not reconcile is listed at the TOP of this component, above
 * the numbers it concerns, and the offending rows are marked where they sit. A
 * reconciliation view that renders a broken identity in the same grey as a sound
 * one is worse than no reconciliation at all, because it launders the defect.
 */

import { AlertTriangle, Check, Equal, Scale, Sigma } from "lucide-react";
// Money is formatted with `formatExact`, never `formatPkr`: this component
// exists to compare figures against each other, and the display rounding that
// suits a headline would hide the very differences it is reporting.
import { formatKg } from "@/lib/domain";
import {
  formatExact,
  type LineLedger,
  type RollupRow,
  type VoucherReconciliation,
} from "./voucherReconciliation";

/** The CMTS column marker used across this screen — parity is checkable on sight. */
function Cmts({ col }: { col: string }) {
  return (
    <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${col}`}>
      {col}
    </span>
  );
}

/** Green tick / amber warning, used wherever an identity is asserted. */
function Verdict({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span
      className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center gap-1 whitespace-nowrap"
      style={
        ok
          ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
          : { backgroundColor: "#FEE2E2", color: "#DC2626" }
      }
    >
      {ok ? <Check size={10} strokeWidth={3} /> : <AlertTriangle size={10} strokeWidth={2.5} />}
      {label ?? (ok ? "Reconciles" : "Does not add up")}
    </span>
  );
}

/**
 * One GODOWNRENTDETAIL line as a vertical sum.
 *
 * `MINIMUMCHARGES` and `AFUAMOUNT` are rendered BELOW the rule rather than
 * inside it on purpose: neither is a term. The floor is a bound the subtotal was
 * tested against, and AFU is a slice of the special-handling charge already
 * counted above it — putting either in the column would double-bill the line,
 * so their placement is the explanation.
 */
function LineCard({ line, index }: { line: LineLedger; index: number }) {
  const d = line.detail;

  return (
    <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
      <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="text-[12px] font-semibold text-[#0F172A]">
            Line {index + 1} · {line.zone}
          </p>
          <p className="text-[11px] text-[#64748B] mt-0.5">
            {line.classLabel} · {d.DAYS} chargeable day{d.DAYS === 1 ? "" : "s"} ·{" "}
            {formatKg(d.WEIGHT)} · {d.Freedays}d free
          </p>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <Cmts col="GRNO" />
          <span className="font-mono text-[11px] font-semibold text-[#1B4F8B]">{d.GRNO}</span>
        </div>
      </div>

      <div className="px-4 py-3">
        {line.charges.map((c) => (
          <div key={c.cmts} className="flex items-baseline justify-between gap-3 py-1.5">
            <div className="flex items-baseline gap-2 flex-wrap min-w-0">
              <span className="text-[12px] text-[#475569]">{c.label}</span>
              <Cmts col={c.cmts} />
              {c.unit && (
                <>
                  <span
                    className="h-[16px] px-1.5 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[9px] font-bold font-mono inline-flex items-center whitespace-nowrap"
                    title={`The basis ${c.cmts} is charged on`}
                  >
                    {c.unit.value}
                  </span>
                  <Cmts col={c.unit.cmts} />
                </>
              )}
            </div>
            <span
              className="font-mono text-[12px] whitespace-nowrap"
              style={{ color: c.amount ? "#0F172A" : "#CBD5E1" }}
            >
              {formatExact(c.amount)}
            </span>
          </div>
        ))}

        <div className="flex items-baseline justify-between gap-3 py-1.5 mt-1 border-t border-[#E2E8F0]">
          <span className="text-[12px] font-semibold text-[#0F172A]">Sum of priced columns</span>
          <span className="font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
            {formatExact(line.pricedSum)}
          </span>
        </div>

        {/*
          The gap between the priced columns and the line's own ex-tax total.
          It is shown even though CMTS gives it no column, because a grid that
          silently falls short of the total printed under it is the exact defect
          this screen was built to expose. Named at voucher level below.
        */}
        {Math.abs(line.residual) >= 0.005 && (
          <div className="flex items-baseline justify-between gap-3 py-1.5">
            <span className="text-[12px] text-[#D97706]">
              Carried on no GODOWNRENTDETAIL column
            </span>
            <span className="font-mono text-[12px] text-[#D97706] whitespace-nowrap">
              {formatExact(line.residual)}
            </span>
          </div>
        )}

        <div className="flex items-baseline justify-between gap-3 py-1.5 border-t border-[#E2E8F0]">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-semibold text-[#0F172A]">Total ex-tax</span>
            <Cmts col="TOTALAMOUNTWITHOUTTAX" />
          </div>
          <span className="font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
            {formatExact(line.withoutTax)}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 py-1.5">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[12px] text-[#475569]">Tax</span>
            <Cmts col="TAXAMOUNT" />
            <span className="h-[16px] px-1.5 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[9px] font-bold font-mono inline-flex items-center">
              {line.taxPercent}%
            </span>
            <Cmts col="TAXPERCENTAGE" />
            {!line.taxAgrees && <Verdict ok={false} label="Not the stated %" />}
          </div>
          <span className="font-mono text-[12px] text-[#0F172A] whitespace-nowrap">
            {formatExact(line.taxAmount)}
          </span>
        </div>

        <div className="flex items-baseline justify-between gap-3 pt-2 mt-1 border-t-2 border-[#0B2545]">
          <div className="flex items-baseline gap-2">
            <span className="text-[12px] font-bold text-[#0B2545]">Line total</span>
            <Cmts col="TOTALAMOUNTWITHTAX" />
          </div>
          <div className="flex items-center gap-2">
            {!line.totalAgrees && <Verdict ok={false} />}
            <span className="font-mono text-[13px] font-bold text-[#0B2545] whitespace-nowrap">
              {formatExact(line.withTax)}
            </span>
          </div>
        </div>
      </div>

      {/* The two columns that are not terms, and the duplicate tax column. */}
      <div className="px-4 py-2.5 bg-[#F8FAFC] border-t border-[#E2E8F0] flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] text-[#64748B]">Minimum-charge floor</span>
            <Cmts col="MINIMUMCHARGES" />
            <span className="text-[10px] text-[#94A3B8]">
              {line.minimumBinds
                ? "floor bit — the subtotal was lifted to it"
                : "not reached, so not applied — a floor, never an addend"}
            </span>
          </div>
          <span
            className="font-mono text-[11px] whitespace-nowrap"
            style={{ color: line.minimumBinds ? "#D97706" : "#94A3B8" }}
          >
            {formatExact(line.minimumCharges)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] text-[#64748B]">of which advance freight</span>
            <Cmts col="AFUAMOUNT" />
            <span className="text-[10px] text-[#94A3B8]">
              a slice of SPECIALCHARGES above, not a charge beside it
            </span>
          </div>
          <span
            className="font-mono text-[11px] whitespace-nowrap"
            style={{ color: line.afuAmount ? "#0F172A" : "#94A3B8" }}
          >
            {formatExact(line.afuAmount)}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-[11px] text-[#64748B]">Tax, duplicate column</span>
            <Cmts col="TAX" />
            <span className="text-[10px] text-[#94A3B8]">
              {line.taxColumnsAgree
                ? "agrees with TAXAMOUNT — CMTS stores the figure twice"
                : "DISAGREES with TAXAMOUNT"}
            </span>
          </div>
          <span
            className="font-mono text-[11px] whitespace-nowrap"
            style={{ color: line.taxColumnsAgree ? "#94A3B8" : "#DC2626" }}
          >
            {formatExact(line.tax)}
          </span>
        </div>
      </div>
    </div>
  );
}

function RollupTableRow({ r }: { r: RollupRow }) {
  const headerOnly = r.lines === null;
  return (
    <tr
      className="border-b border-[#F1F5F9] last:border-0"
      style={{ backgroundColor: r.agrees ? undefined : "#FEF2F2" }}
    >
      <td className="px-3 py-2.5 text-[12px] text-[#0F172A] whitespace-nowrap">{r.label}</td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        <span className="text-[10px] font-mono text-[#94A3B8]">{r.headerCmts}</span>
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
        {formatExact(r.header)}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {headerOnly ? (
          <span className="text-[10px] text-[#94A3B8] italic">no detail column</span>
        ) : (
          <span className="text-[10px] font-mono text-[#94A3B8]">Σ {r.detailCmts}</span>
        )}
      </td>
      <td className="px-3 py-2.5 font-mono text-[12px] whitespace-nowrap">
        {headerOnly ? (
          <span className="text-[#CBD5E1]">—</span>
        ) : (
          <span className="text-[#475569]">{formatExact(r.lines as number)}</span>
        )}
      </td>
      <td className="px-3 py-2.5 whitespace-nowrap">
        {headerOnly ? (
          <span
            className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center"
            title="GODOWNRENTDETAIL has no counterpart column, so there is nothing to compare against."
          >
            Header only
          </span>
        ) : (
          <Verdict ok={r.agrees} label={r.agrees ? "Reconciles" : `Off by ${formatExact(r.delta)}`} />
        )}
      </td>
    </tr>
  );
}

/**
 * Takes the finished reconciliation rather than computing it, because the page
 * header also has to know whether the voucher balances — it prints NETPAYABLE
 * where every reader sees it, and this breakdown sits behind a tab. Two call
 * sites deriving the same verdict independently is how a screen ends up warning
 * in one place and not the other.
 */
export default function VoucherChargeBreakdown({ recon }: { recon: VoucherReconciliation }) {
  return (
    <div className="flex flex-col gap-5">
      {/*
        Promoted above every number it concerns. Anything that fails to
        reconcile has to be the first thing read on this tab, not a red cell
        someone has to go looking for.
      */}
      {recon.breaks.length > 0 && (
        <div className="rounded-[16px] border-2 border-[#FCA5A5] bg-[#FEF2F2] p-5">
          <div className="flex items-center gap-2">
            <AlertTriangle size={16} className="text-[#DC2626]" strokeWidth={2.5} />
            <h3 className="text-[14px] font-bold text-[#991B1B]">
              {recon.breaks.length} figure{recon.breaks.length === 1 ? "" : "s"} on this voucher
              {recon.breaks.length === 1 ? " does" : " do"} not add up
            </h3>
          </div>
          <div className="mt-3 flex flex-col gap-3">
            {recon.breaks.map((b) => (
              <div key={b.title} className="rounded-xl bg-white border border-[#FECACA] px-4 py-3">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <p className="text-[12px] font-semibold text-[#0F172A] font-mono">{b.title}</p>
                  <span className="font-mono text-[12px] font-bold text-[#DC2626] whitespace-nowrap">
                    Δ {formatExact(b.delta)}
                  </span>
                </div>
                <p className="text-[12px] text-[#475569] mt-1">{b.detail}</p>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#991B1B] mt-3">
            Shown rather than hidden. In a migration these are the rows a finance officer cannot
            sign, and a screen that quietly reprints the stored total would carry the defect
            forward into AirVault.
          </p>
        </div>
      )}

      {/* 1 · the lines, each rebuilt as the addition it represents */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Scale size={15} className="text-[#64748B]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Charge breakdown — GODOWNRENTDETAIL
            </h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              One line per class / subclass / location the consignment occupied, read as the sum
              CMTS performed. Each unit column sits against the amount it qualifies.
            </p>
          </div>
        </div>
        <div className="p-5 flex flex-col gap-4">
          {recon.lines.length === 0 ? (
            <p className="text-[12px] text-[#94A3B8]">
              No GODOWNRENTDETAIL lines against this voucher.
            </p>
          ) : (
            recon.lines.map((l, i) => <LineCard key={l.detail.Id} line={l} index={i} />)
          )}
        </div>
      </div>

      {/* 2 · the roll-ups, measured against the lines above */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
        <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
          <Sigma size={15} className="text-[#64748B]" />
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Voucher roll-ups — GODOWNRENT
            </h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              Every header aggregate against the detail column it claims to be the sum of. This is
              the check, not a restatement of the figures above.
            </p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px]">
            <thead>
              <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                {["Charge", "Header column", "Header", "Detail column", "Σ lines", "Check"].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-3 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                    >
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {recon.rollups.map((r) => (
                <RollupTableRow key={r.headerCmts} r={r} />
              ))}
            </tbody>
          </table>
        </div>

        {/*
          The named decomposition of the gap the grid cannot hold. Without this
          block the sub-total row above reads as an unexplained overshoot on any
          consignment carrying a surcharge.
        */}
        {Math.abs(recon.residualTotal) >= 0.005 && (
          <div className="px-5 py-4 border-t border-[#E2E8F0] bg-[#FFFBEB]">
            <p className="text-[12px] font-semibold text-[#92400E]">
              {formatExact(recon.residualTotal)} of the sub-total reaches no detail line
            </p>
            <div className="mt-2 flex flex-col gap-2">
              {recon.residualParts.map((p) => (
                <div key={p.label} className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2 flex-wrap">
                      <span className="text-[12px] text-[#0F172A]">{p.label}</span>
                      {p.cmts && <Cmts col={p.cmts} />}
                    </div>
                    <p className="text-[11px] text-[#92400E] mt-0.5">{p.why}</p>
                  </div>
                  <span className="font-mono text-[12px] font-semibold text-[#0F172A] whitespace-nowrap">
                    {formatExact(p.amount)}
                  </span>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-2 border-t border-[#FDE68A] flex items-center justify-between gap-3">
              <span className="text-[11px] font-semibold text-[#92400E]">
                Unattributed after every named part
              </span>
              <div className="flex items-center gap-2">
                <Verdict
                  ok={recon.residualExplained}
                  label={recon.residualExplained ? "Fully accounted" : "Unexplained"}
                />
                <span className="font-mono text-[12px] font-bold text-[#0F172A]">
                  {formatExact(recon.residualUnexplained)}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* 3 · the headline chain */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex items-center gap-2 mb-2">
            <Equal size={13} className="text-[#64748B]" />
            <h4 className="text-[12px] font-semibold text-[#0F172A]">
              From the lines to the amount the consignee owes
            </h4>
          </div>
          <div className="max-w-[520px]">
            {recon.chain.map((s) => (
              <div
                key={s.cmts}
                className="flex items-baseline justify-between gap-3 py-1.5"
                style={
                  s.isResult
                    ? { borderTop: "1px solid #CBD5E1", marginTop: 2 }
                    : undefined
                }
              >
                <div className="flex items-baseline gap-2 flex-wrap min-w-0">
                  <span className="font-mono text-[12px] text-[#94A3B8] w-3 inline-block">
                    {s.op}
                  </span>
                  <span
                    className="text-[12px]"
                    style={{
                      color: s.isResult ? "#0F172A" : "#475569",
                      fontWeight: s.isResult ? 600 : 400,
                    }}
                  >
                    {s.label}
                  </span>
                  <Cmts col={s.cmts} />
                </div>
                <span
                  className="font-mono whitespace-nowrap"
                  style={{
                    fontSize: s.isResult ? 13 : 12,
                    fontWeight: s.isResult ? 700 : 400,
                    color: s.isResult ? "#0B2545" : "#475569",
                  }}
                >
                  {formatExact(s.amount)}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-[#E2E8F0] flex items-center gap-2 flex-wrap">
            <Verdict
              ok={recon.netPayableAgrees}
              label={
                recon.netPayableAgrees
                  ? "NETPAYABLE matches the chain"
                  : `NETPAYABLE is off by ${formatExact(recon.netPayable - recon.netPayableDerived)}`
              }
            />
            {!recon.netPayableAgrees && (
              <span className="text-[11px] text-[#64748B]">
                the chain arrives at{" "}
                <span className="font-mono font-semibold text-[#0F172A]">
                  {formatExact(recon.netPayableDerived)}
                </span>
                , the header stores{" "}
                <span className="font-mono font-semibold text-[#DC2626]">
                  {formatExact(recon.netPayable)}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
