"use client";

/**
 * The negotiated-rate matrix.
 *
 * Two things this table has to make unmissable, and they are different claims:
 *
 *   1. THE RATES ARE INVENTED — same as everywhere else on the card.
 *   2. THE CONTRACTS ARE INVENTED TOO. This is the only table in the demo that
 *      attributes a commercial term to a named counterparty, so it is the only
 *      one where a reader could take away "SAPS has agreed X with Y". The
 *      counterparties are therefore generic ("Forwarder A"), and the notice
 *      says outright that none of these arrangements exists.
 *
 * Status is load-bearing, not decoration: only `active` rows price anything.
 * Draft, pending and retired rows are listed precisely because they must be
 * visible AND inert — a pending rate that quietly starts billing is the same
 * failure as a retired charge type that quietly starts billing.
 */

import { ILLUSTRATIVE_TARIFF_OVERRIDES, type OverrideStatus } from "@/lib/domain/tariff";
import { formatPkr } from "@/lib/domain";

const STATUS: Record<OverrideStatus, { bg: string; fg: string; label: string; applied: string }> = {
  active: { bg: "#DCFCE7", fg: "#15803D", label: "ACTIVE", applied: "Priced" },
  draft: { bg: "#FEF3C7", fg: "#B45309", label: "DRAFT", applied: "Not priced" },
  pending: { bg: "#FEF3C7", fg: "#B45309", label: "PENDING", applied: "Not priced" },
  retired: { bg: "#F1F5F9", fg: "#94A3B8", label: "RETIRED", applied: "Not priced" },
};

const TH =
  "text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap";
const TD = "px-4 py-3 text-[13px] text-[#475569] whitespace-nowrap";

export default function OverrideMatrix({
  highlightId,
}: {
  /** The override the resolver picked, if any — highlighted so the two panels agree on screen. */
  highlightId?: number | null;
}) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Negotiated overrides</h2>
          <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
            NO CMTS TABLE
          </span>
        </div>
        <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed max-w-3xl">
          Rates agreed with an agent or a consignee tier that displace the published card for
          matching consignments. CMTS has no table for this — it is the One-Window Vision delta.
        </p>
      </div>

      <div className="flex items-start gap-2 px-5 py-2.5 border-b border-[#FEE2E2] bg-[#FEF2F2]">
        <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold inline-flex items-center font-mono flex-shrink-0">
          INVENTED
        </span>
        <span className="text-[11px] leading-[18px]" style={{ color: "#991B1B" }}>
          The contracts below do not exist. No commercial arrangement, rate or term here has been
          offered to, discussed with or agreed by any party — the counterparties are deliberately
          generic for exactly that reason.
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className={TH}>Override</th>
              <th className={TH}>Contract</th>
              <th className={TH}>Tier</th>
              <th className={TH}>Route</th>
              <th className={TH}>Class</th>
              <th className={TH}>Agreed rate /kg/day</th>
              <th className={TH}>Status</th>
              <th className={TH}>Effect</th>
              <th className={TH}>Approved by</th>
              <th className={TH}>Effective</th>
            </tr>
          </thead>
          <tbody>
            {ILLUSTRATIVE_TARIFF_OVERRIDES.map((o) => {
              const s = STATUS[o.status];
              const on = highlightId === o.id;
              return (
                <tr
                  key={o.id}
                  className="border-b border-[#E2E8F0] transition-colors"
                  style={on ? { backgroundColor: "#EBF0F7" } : undefined}
                >
                  <td className={TD}>
                    <span className="font-semibold text-[#0F172A]">{o.name}</span>
                    <span className="block text-[11px] text-[#64748B] whitespace-normal max-w-[260px]">
                      {o.note}
                    </span>
                  </td>
                  <td className={TD}>{o.contract}</td>
                  <td className={TD}>{o.tier}</td>
                  <td className={`${TD} font-mono text-[12px]`}>{o.route}</td>
                  <td className={`${TD} font-mono text-[12px] font-semibold text-[#0B2545]`}>
                    {o.ABBREVATION}
                  </td>
                  <td className={`${TD} font-mono font-semibold text-[#0F172A]`}>
                    {o.ratePerKgPerDay === 0 ? (
                      <span className="text-[#16A34A]">0 · zero-rated</span>
                    ) : (
                      formatPkr(o.ratePerKgPerDay)
                    )}
                  </td>
                  <td className={TD}>
                    <span
                      className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold font-mono"
                      style={{ backgroundColor: s.bg, color: s.fg }}
                    >
                      {s.label}
                    </span>
                  </td>
                  <td className={TD}>
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: o.status === "active" ? "#15803D" : "#94A3B8" }}
                    >
                      {s.applied}
                    </span>
                  </td>
                  <td className={TD}>
                    {o.approvedBy ?? (
                      <span className="text-[#CBD5E1] font-mono">
                        {o.approvalRequired ? "unapproved" : "n/a"}
                      </span>
                    )}
                  </td>
                  <td className={`${TD} font-mono text-[12px]`}>
                    {o.effectiveFrom} → {o.effectiveTo}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="px-5 py-3 text-[11px] text-[#64748B] leading-relaxed border-t border-[#E2E8F0]">
        Only <span className="font-mono">ACTIVE</span> rows are resolved against. Where two active
        overrides match one consignment the lowest agreed rate wins, and the one that lost is
        reported rather than discarded — &quot;why did this get that rate&quot; has to be answerable
        without reading code.
      </p>
    </div>
  );
}
