"use client";

/**
 * T2 · Estate roll-up, and T6 · exposure by site.
 *
 * `portalKpis(scope)` is the function every dashboard in this product was
 * supposed to read and only the warehouse screens actually do. Called four
 * times — once per node and once at "HQ" — it produces a table whose columns
 * ADD UP TO THE TOTAL, because `inScope()` resolves "HQ" to no filter and the
 * three site codes partition the same rows.
 *
 * That arithmetic is the demonstration, so the table checks it live rather
 * than asserting it: the last column re-adds KHI + LHE + PEW and marks the row
 * balanced or not. If a fixture ever gains a row with a site outside the three,
 * this stops saying "balanced" on its own, without anyone maintaining a claim
 * in prose. Switch the header to KHI, LHE, PEW and back to HQ in front of a
 * client and the same numbers appear one column at a time.
 *
 * ONE THING DELIBERATELY ABSENT: a collection rate. LHE carries PKR 50,075.60
 * outstanding against nothing ever collected, off a single invoice — a "0%
 * collected" tile would be noise dressed as a finding, and n=1 is not a rate.
 * Outstanding and collected are shown as amounts, with the invoice count beside
 * them so the reader can see how thin the denominator is.
 */

import { BarChart3, Wallet } from "lucide-react";
import { HqCard, Meter, SeverityPill } from "@/components/hq/HqUi";
import {
  SITES,
  formatPkr,
  listInvoices,
  listPayments,
  portalKpis,
  type SiteCode,
} from "@/lib/domain";

interface RollupRow {
  label: string;
  detail: string;
  values: Record<SiteCode | "HQ", number>;
  format?: (n: number) => string;
  emphasis?: boolean;
}

export function EstateRollup() {
  const kpis = {
    HQ: portalKpis("HQ"),
    ...Object.fromEntries(SITES.map((s) => [s.code, portalKpis(s.code)])),
  } as Record<SiteCode | "HQ", ReturnType<typeof portalKpis>>;

  const rows: RollupRow[] = [
    {
      label: "AWBs on file",
      detail: "Every consignment in the register, whatever its stage.",
      values: mapKpi(kpis, (k) => k.awbsTotal),
    },
    {
      label: "In the warehouse",
      detail: "Stored and not yet dispatched.",
      values: mapKpi(kpis, (k) => k.awbsInWarehouse),
    },
    {
      label: "Awaiting customs",
      detail: "Sitting at the FC-06 clearance stage.",
      values: mapKpi(kpis, (k) => k.awbsAwaitingCustoms),
    },
    {
      label: "Pieces bound to a location",
      detail: "Scanned into storage — the physical count behind the AWB count.",
      values: mapKpi(kpis, (k) => k.piecesStored),
    },
    {
      label: "Open exceptions",
      detail: "The unified FC-10 queue across all six exception kinds.",
      values: mapKpi(kpis, (k) => k.exceptionsOpen),
    },
    {
      label: "Past their threshold",
      detail: "Each kind measured against its own escalation threshold.",
      values: mapKpi(kpis, (k) => k.exceptionsOverThreshold),
      emphasis: true,
    },
    {
      label: "Outstanding",
      detail: "Unpaid balance across issued invoices.",
      values: mapKpi(kpis, (k) => k.outstandingAmount),
      format: formatPkr,
      emphasis: true,
    },
  ];

  return (
    <HqCard
      title="Estate roll-up — and the arithmetic that closes"
      icon={BarChart3}
      source="portalKpis('HQ' | 'KHI' | 'LHE' | 'PEW') · lib/domain/index.ts"
      intro="The same function every warehouse screen reads, called once per node and once across the estate. The three site columns partition the HQ column exactly, which is checked on each row rather than claimed."
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[680px] border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              <th className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Measure
              </th>
              {SITES.map((s) => (
                <th
                  key={s.code}
                  className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                >
                  {s.code}
                </th>
              ))}
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#1B4F8B]">
                HQ — all sites
              </th>
              <th className="px-2 py-2 text-right text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const sum = SITES.reduce((n, s) => n + r.values[s.code], 0);
              const total = r.values.HQ;
              const balanced = Math.abs(sum - total) < 0.005;
              const fmt = r.format ?? ((n: number) => n.toLocaleString("en-PK"));
              return (
                <tr key={r.label} className="border-b border-[#F1F5F9] last:border-b-0">
                  <td className="px-2 py-2.5">
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: r.emphasis ? "#0F172A" : "#334155" }}
                    >
                      {r.label}
                    </p>
                    <p className="text-[11px] text-[#94A3B8]">{r.detail}</p>
                  </td>
                  {SITES.map((s) => (
                    <td
                      key={s.code}
                      className="px-2 py-2.5 text-right text-[13px] tabular-nums text-[#475569]"
                    >
                      {fmt(r.values[s.code])}
                    </td>
                  ))}
                  <td className="px-2 py-2.5 text-right text-[14px] font-bold tabular-nums text-[#0F172A]">
                    {fmt(total)}
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <SeverityPill
                      severity={balanced ? "good" : "serious"}
                      label={balanced ? "Closes" : `Off by ${fmt(Math.abs(sum - total))}`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </HqCard>
  );
}

function mapKpi(
  kpis: Record<SiteCode | "HQ", ReturnType<typeof portalKpis>>,
  pick: (k: ReturnType<typeof portalKpis>) => number,
): Record<SiteCode | "HQ", number> {
  return {
    HQ: pick(kpis.HQ),
    ...(Object.fromEntries(SITES.map((s) => [s.code, pick(kpis[s.code])])) as Record<
      SiteCode,
      number
    >),
  };
}

/* ------------------------------------------------------------------ */

export function ExposureBySite() {
  const rows = SITES.map((s) => {
    const invoices = listInvoices(s.code);
    const outstanding = invoices.reduce((n, i) => n + i.outstanding, 0);
    const collected = invoices.reduce((n, i) => n + i.paid, 0);
    return {
      site: s.code,
      invoices: invoices.length,
      outstanding,
      collected,
      unreconciled: listPayments(s.code, true).length,
    };
  });
  const maxOutstanding = Math.max(1, ...rows.map((r) => r.outstanding));
  const totalUnreconciled = rows.reduce((n, r) => n + r.unreconciled, 0);

  return (
    <HqCard
      title="Exposure by node"
      icon={Wallet}
      source="listInvoices(site) · listPayments(site, true) · lib/domain/index.ts"
      intro="Unpaid balance per node, and payments received that are not yet matched to an invoice. Amounts, not rates — one node has a single invoice on file, and a percentage off n=1 would read as a finding when it is a sample size."
      action={{ label: "Financial trace", href: "/auditor/financial-trace" }}
    >
      <div className="flex flex-col gap-3">
        {rows.map((r) => (
          <div key={r.site} className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="text-[13px] font-bold text-[#0F172A]">{r.site}</span>
              <span className="text-[14px] font-bold tabular-nums text-[#0F172A]">
                {formatPkr(r.outstanding)}{" "}
                <span className="text-[11px] font-medium text-[#64748B]">outstanding</span>
              </span>
            </div>
            <div className="mt-2">
              <Meter pct={(r.outstanding / maxOutstanding) * 100} />
            </div>
            <p className="mt-2 text-[11px] text-[#64748B]">
              {r.invoices} {r.invoices === 1 ? "invoice" : "invoices"} on file ·{" "}
              {formatPkr(r.collected)} collected ·{" "}
              {r.unreconciled > 0 ? (
                <span className="font-semibold text-[#D97706]">
                  {r.unreconciled} unreconciled {r.unreconciled === 1 ? "payment" : "payments"}
                </span>
              ) : (
                "all payments reconciled"
              )}
            </p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
        {totalUnreconciled > 0
          ? `${totalUnreconciled} payments estate-wide have arrived without an invoice match. Reconciliation is a per-node act; noticing that it is concentrated at one node is not.`
          : "Every payment on the estate is matched to an invoice."}
      </p>
    </HqCard>
  );
}
