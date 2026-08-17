"use client";

/**
 * /auditor/financial-trace — FC-12 §17.
 *
 * WHAT THIS SCREEN WAS. INV-2026-0042, which appears in no fixture, with a
 * ten-step timeline attributed to invented approvers, a fourteen-line invoice
 * panel whose numbers did not add up to its own grand total (18,400 + 3,200 +
 * 5,100 − 3,200 + 7,350 = 30,850, against a stated 48,250), and two approval
 * rows citing supporting documents that do not exist. All five search modes
 * returned it.
 *
 * WHAT IT IS NOW. Eight real invoices across two nodes. The timeline is the
 * charge calculation, the invoice, every approval decision on the waiver and
 * every payment against it, in the order the fixtures date them. The panel is
 * the `ChargeCalculation` line by line — each row naming the field it is — so
 * the sub-total, the tax and the total can be added up on screen, which is the
 * one thing an auditor will do first and the one thing the old panel failed.
 *
 * WHY THE TARIFF BAND TABLE IS HERE. `ChargeCalculation.slabLines` is the
 * derivation behind the storage figure: day bands, rate per kg per day, and the
 * amount each band produced. An invoice line an auditor cannot reconstruct is a
 * number they have to take on trust, which is exactly what this portal exists
 * to remove.
 */

import { useMemo, useState } from "react";
import { Calculator, FileText, Landmark, Search, ShieldQuestion, Stamp } from "lucide-react";
import DataTable from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { HqCard, NotAvailable, SeverityPill } from "@/components/hq/HqUi";
import AwbLink from "@/components/awb/AwbLink";
import { formatDateTime, formatKg, formatPkr, listPayments, listWaivers } from "@/lib/domain";
import { AuditorStat } from "../AuditorUi";
import TraceTimeline from "../TraceTimeline";
import {
  FINANCE_LOOKUPS,
  financialTrace,
  resolveFinanceRef,
  traceableInvoices,
  type FinanceLookupKind,
} from "../traceModel";

export default function FinancialTraceContent() {
  const invoices = useMemo(() => traceableInvoices(), []);
  /* Estate context the gap cards below quote. Counted, not written into the
     prose, so the cards cannot drift from the registers they describe. */
  const estateWaivers = useMemo(() => listWaivers("HQ"), []);
  const estatePayments = useMemo(() => listPayments("HQ"), []);

  const [kind, setKind] = useState<FinanceLookupKind>("invoice");
  const [value, setValue] = useState(invoices[0]?.invoiceNo ?? "");
  const [invoiceNo, setInvoiceNo] = useState<string | null>(invoices[0]?.invoiceNo ?? null);
  const [miss, setMiss] = useState<string | null>(null);

  const trace = useMemo(
    () => (invoiceNo === null ? null : financialTrace(invoiceNo)),
    [invoiceNo],
  );

  const runSearch = () => {
    const hit = resolveFinanceRef(kind, value);
    if (hit === null) {
      setMiss(value.trim());
      setInvoiceNo(null);
      return;
    }
    setMiss(null);
    setInvoiceNo(hit);
  };

  const activeLookup = FINANCE_LOOKUPS.find((l) => l.kind === kind);

  return (
    <div className="space-y-6">
      {/* ---- Search ---------------------------------------------------- */}
      <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex overflow-hidden rounded-lg border border-[#E2E8F0]">
            {FINANCE_LOOKUPS.map((opt) => (
              <button
                key={opt.kind}
                onClick={() => setKind(opt.kind)}
                className="h-9 cursor-pointer whitespace-nowrap px-3 text-[12px] font-medium transition-colors"
                style={{
                  backgroundColor: kind === opt.kind ? "#0B2545" : "white",
                  color: kind === opt.kind ? "white" : "#64748B",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <div className="relative min-w-[240px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") runSearch();
              }}
              placeholder={`Enter ${activeLookup?.label ?? "reference"}…`}
              className="h-9 w-full rounded-lg border border-[#E2E8F0] pl-9 pr-3 text-[13px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2E75B6]"
            />
          </div>
          <button
            onClick={runSearch}
            className="h-9 cursor-pointer whitespace-nowrap rounded-lg px-5 text-[13px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            Trace
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            On file
          </span>
          <select
            value={invoiceNo ?? ""}
            onChange={(e) => {
              setInvoiceNo(e.target.value);
              setValue(e.target.value);
              setMiss(null);
            }}
            className="h-8 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[12px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            {invoices.map((i) => (
              <option key={i.invoiceNo} value={i.invoiceNo}>
                {i.invoiceNo} — {i.site} · {formatPkr(i.total)} · {i.status}
              </option>
            ))}
          </select>
          <span className="text-[11px] text-[#64748B]">
            {invoices.length} invoices estate-wide — every one traceable.
          </span>
        </div>

        <p className="mt-2 font-mono text-[10px] text-[#94A3B8]">{activeLookup?.source}</p>
      </div>

      {miss !== null && (
        <EmptyState
          title={`No invoice matches “${miss}”`}
          description="The reference is not on file at KHI, LHE or PEW. Invoice numbers, AWB numbers, GR vouchers, credit notes and payment references all resolve against the finance registers — a miss is a miss."
        />
      )}

      {trace && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AuditorStat
              label="Invoice total"
              value={formatPkr(trace.invoice.total)}
              detail={`${trace.invoice.site} · issued ${formatDateTime(trace.invoice.issuedAt)} · due ${trace.invoice.dueAt.slice(0, 10)}`}
              source="listInvoices('HQ') · Invoice.total"
            />
            <AuditorStat
              label="Outstanding"
              value={formatPkr(trace.invoice.outstanding)}
              detail={`${formatPkr(trace.invoice.paid)} received across ${trace.payments.length} ${trace.payments.length === 1 ? "payment" : "payments"}`}
              source="Invoice.outstanding · Invoice.paid"
              severity={trace.invoice.outstanding > 0 ? "warning" : "good"}
              status={trace.invoice.status}
            />
            <AuditorStat
              label="Payments reconciled"
              value={`${trace.payments.filter((p) => p.reconciled).length} of ${trace.payments.length}`}
              detail={
                trace.payments.length === 0
                  ? "Nothing has been received against this invoice."
                  : trace.payments.map((p) => `${p.mode}${p.reconciled ? "" : " (open)"}`).join(" · ")
              }
              source="paymentsFor(invoiceNo) · PaymentRecord.reconciled"
              severity={
                trace.payments.length > 0 && trace.payments.every((p) => p.reconciled)
                  ? "good"
                  : "warning"
              }
              href="/finance-manager/payment-reconciliation"
            />
            <AuditorStat
              label="Waivers on this charge"
              value={`${trace.waivers.length}`}
              detail={
                trace.waivers.length === 0
                  ? "No waiver was requested against this voucher."
                  : trace.waivers
                      .map(
                        (w) =>
                          `${w.voucherNo} ${w.status}${w.creditNoteNo ? ` → ${w.creditNoteNo}` : ""}`,
                      )
                      .join(" · ")
              }
              source="listWaivers('HQ') · WaiverRequest.awbId"
              severity={trace.waivers.length > 0 ? "warning" : "neutral"}
              href="/finance-manager/waiver-workflow"
            />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <HqCard
                title={`Financial trail — ${trace.invoice.invoiceNo}`}
                icon={Landmark}
                source="financialTrace(invoiceNo) · components/auditor/traceModel.ts"
                intro={`${trace.events.length} dated records, oldest first — charge calculation, invoice, every approval decision and every payment.`}
                action={{
                  label: "Cargo trace for this AWB",
                  href: "/auditor/cargo-trace",
                }}
              >
                <TraceTimeline events={trace.events} />
              </HqCard>
            </div>

            <div className="flex flex-col gap-5">
              <HqCard
                title="Invoice detail"
                icon={FileText}
                source="chargesFor(awbId) · listInvoices('HQ') · lib/domain/finance.ts"
                intro="Each line names the field it is, so the sub-total, the tax and the total can be checked against the calculation rather than taken on trust."
              >
                <div className="flex flex-col">
                  {trace.lines.map((l) => (
                    <div
                      key={l.label}
                      className="flex items-start justify-between gap-3 border-b border-[#F1F5F9] py-2 last:border-0"
                    >
                      <div className="min-w-0">
                        <p
                          className="text-[11px] font-semibold uppercase tracking-wide"
                          style={{ color: l.emphasis ? "#0F172A" : "#94A3B8" }}
                        >
                          {l.label}
                        </p>
                        <p className="font-mono text-[10px] leading-snug text-[#CBD5E1]">
                          {l.field}
                        </p>
                      </div>
                      <span
                        className="whitespace-nowrap text-[12px] font-semibold tabular-nums"
                        style={{ color: l.emphasis ? "#0B2545" : "#0F172A" }}
                      >
                        {l.value}
                      </span>
                    </div>
                  ))}
                </div>
                {trace.awb && (
                  <p className="mt-3 text-[11px] text-[#64748B]">
                    Consignment <AwbLink awbNo={trace.awb.AWBNO} awbId={trace.awb.AWBId} /> —{" "}
                    {trace.awb.CONSIGNEE1}
                  </p>
                )}
              </HqCard>
            </div>
          </div>

          {/* ---- Tariff derivation ---------------------------------------- */}
          {trace.charges && (
            <HqCard
              title={`Storage derivation — ${trace.charges.tariffVersion}`}
              icon={Calculator}
              source="chargesFor(awbId).slabLines · lib/domain/finance.ts"
              intro={`${trace.charges.totalDays} days on the floor, ${trace.charges.freeDays} free, ${trace.charges.chargeableDays} charged against ${formatKg(trace.charges.chargeableKg)} chargeable weight. The bands below add up to the storage line in the panel.`}
            >
              <DataTable
                columns={[
                  { key: "band", header: "Band", width: "160px" },
                  { key: "days", header: "Days in band", width: "110px" },
                  { key: "rate", header: "Rate / kg / day", width: "130px" },
                  { key: "kg", header: "Chargeable weight", width: "140px" },
                  { key: "amount", header: "Amount", width: "130px" },
                ]}
                rows={[
                  ...trace.charges.slabLines.map((s) => ({
                    band: <span className="text-[12px] text-[#0F172A]">{s.label}</span>,
                    days: <span className="text-[12px] tabular-nums text-[#334155]">{s.daysInBand}</span>,
                    rate: (
                      <span className="text-[12px] tabular-nums text-[#334155]">
                        {s.ratePerKgPerDay === 0 ? "free" : formatPkr(s.ratePerKgPerDay)}
                      </span>
                    ),
                    kg: (
                      <span className="text-[12px] tabular-nums text-[#334155]">
                        {formatKg(s.chargeableKg)}
                      </span>
                    ),
                    amount: (
                      <span className="text-[12px] font-semibold tabular-nums text-[#0F172A]">
                        {formatPkr(s.amount)}
                      </span>
                    ),
                  })),
                  {
                    band: <span className="text-[12px] font-bold text-[#0F172A]">Storage total</span>,
                    days: <span />,
                    rate: <span />,
                    kg: <span />,
                    amount: (
                      <span className="text-[12px] font-bold tabular-nums text-[#0B2545]">
                        {formatPkr(trace.charges.storageAmount)}
                      </span>
                    ),
                  },
                ]}
                headerStyle="navy"
              />
            </HqCard>
          )}

          {/* ---- Approval evidence ---------------------------------------- */}
          <HqCard
            title="Approval evidence"
            icon={Stamp}
            source="listWaivers('HQ') · WaiverRequest.levels[] · lib/domain/finance.ts"
            intro="Every approval level on every waiver against this charge, with the approver, the decision and the comment as recorded. Levels that have not been decided are shown as pending rather than omitted."
          >
            {trace.waivers.length === 0 ? (
              <p className="text-[12px] leading-relaxed text-[#64748B]">
                No waiver was requested against this invoice.{" "}
                {estateWaivers.length === 0
                  ? "No waiver exists at any node."
                  : `The ${estateWaivers.length === 1 ? "only waiver" : `${estateWaivers.length} waivers`} on the estate ${estateWaivers.length === 1 ? "is" : "are"} ${estateWaivers.map((w) => `${w.voucherNo} at ${w.site}`).join(", ")} — and this is not one of them.`}{" "}
                That is a fact about the register rather than a gap: an approval table that always
                has rows in it is a table that is not reading anything.
              </p>
            ) : (
              <DataTable
                columns={[
                  { key: "voucher", header: "Voucher", width: "140px" },
                  { key: "requester", header: "Requested by", width: "140px" },
                  { key: "level", header: "Level", width: "70px" },
                  { key: "role", header: "Approving role", width: "150px" },
                  { key: "approver", header: "Approver", width: "130px" },
                  { key: "decision", header: "Decision", width: "110px" },
                  { key: "at", header: "Decided", width: "150px" },
                  { key: "comment", header: "Comment", width: "280px" },
                ]}
                rows={trace.waivers.flatMap((w) =>
                  w.levels.map((lvl) => ({
                    voucher: (
                      <span className="font-mono text-[12px] font-medium text-[#1B4F8B]">
                        {w.voucherNo}
                      </span>
                    ),
                    requester: (
                      <span className="text-[12px] text-[#0F172A]">{w.requestedBy}</span>
                    ),
                    level: <span className="text-[12px] tabular-nums text-[#334155]">{lvl.level}</span>,
                    role: <span className="text-[12px] text-[#334155]">{lvl.role}</span>,
                    approver: (
                      <span className="text-[12px] text-[#0F172A]">
                        {lvl.approver ?? <span className="italic text-[#94A3B8]">not assigned</span>}
                      </span>
                    ),
                    decision: (
                      <SeverityPill
                        severity={
                          lvl.decision === "approved"
                            ? "good"
                            : lvl.decision === "rejected"
                              ? "critical"
                              : "warning"
                        }
                        label={lvl.decision}
                      />
                    ),
                    at: (
                      <span className="font-mono text-[11px] text-[#64748B]">
                        {lvl.decidedAt ? formatDateTime(lvl.decidedAt) : "—"}
                      </span>
                    ),
                    comment: (
                      <span className="text-[12px] text-[#475569]">{lvl.comment ?? "—"}</span>
                    ),
                  })),
                )}
                headerStyle="navy"
              />
            )}
          </HqCard>

          {/* ---- Gaps ------------------------------------------------------ */}
          <HqCard
            title="What this trace cannot show, and why"
            icon={ShieldQuestion}
            source="no fixture — stated rather than estimated"
            intro="Three things the previous version of this screen displayed that nothing supports."
          >
            <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
              <NotAvailable
                title="Who issued the invoice"
                reason="`Invoice` carries no actor column — no CreatedBy, no issuedBy. The GR voucher beneath it does, which is why the timeline attributes the charge to the voucher's CreatedBy and leaves the invoice node unattributed instead of reusing that name one row further up."
                nearest="GodownRent.CreatedBy on the voucher the invoice is raised from."
              />
              <NotAvailable
                title="Supporting documents on an approval"
                reason="`ApprovalLevel` holds level, role, approver, decision, comment and decidedAt — and no attachment. The two approval rows this screen used to show cited demurrage_grace_req.pdf and gate_log_V1356.pdf against a field that does not exist on the record."
                nearest="The waiver's own `note` and each level's `comment`, which are the recorded justification, plus the document register on the AWB's audit tab."
              />
              <NotAvailable
                title="Bank-side reconciliation"
                reason={`\`PaymentRecord.reconciled\` is a boolean with no counterparty statement behind it, so "auto-matched: invoice vs payment vs bank" was claiming a three-way match against a two-way field. ${estatePayments.filter((p) => !p.reconciled).length} of the ${estatePayments.length} payments on the estate are unreconciled and the record cannot say why.`}
                nearest="The reconciled flag itself, and the gateway or instrument reference on each payment."
              />
            </div>
          </HqCard>
        </>
      )}
    </div>
  );
}
