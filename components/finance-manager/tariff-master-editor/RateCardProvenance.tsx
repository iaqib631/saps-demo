"use client";

/**
 * Where this rate card came from — the panel that replaces the old "tariff
 * version" card.
 *
 * The version card it replaces listed a created-by, an approved-by and a
 * change note, which is the right shape for a tariff somebody negotiated and
 * exactly the wrong shape for one nobody did. Presenting invented rates with
 * an approval chain would manufacture the impression of authority: an approver
 * name next to a rate reads as "a person at SAPS signed this off". Nobody did.
 *
 * So this panel answers the questions that are actually answerable — which
 * decision produced these numbers, which tables they stand in for, and what
 * has to happen for them to become real.
 */

import { RATE_CARD } from "@/lib/domain/tariff";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-0.5">
        {label}
      </span>
      <span className="text-[13px] font-medium text-[#0F172A] break-words">{children}</span>
    </div>
  );
}

export default function RateCardProvenance() {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="text-[15px] font-bold text-[#0F172A]">Rate card provenance</h2>
        <p className="text-[12px] text-[#64748B] mt-0.5">
          Where these numbers come from, and what would replace them.
        </p>
      </div>

      <div className="p-5 space-y-4">
        <Row label="Card">
          <span className="font-mono">{RATE_CARD.id}</span>
        </Row>

        <div className="grid grid-cols-2 gap-4">
          <Row label="Effective from">{RATE_CARD.effectiveFrom}</Row>
          <Row label="Effective to">
            <span className="text-[#94A3B8]">{RATE_CARD.effectiveTo ?? "open"}</span>
          </Row>
        </div>

        <Row label="Origin">
          <span
            className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-bold font-mono"
            style={{ backgroundColor: "#FEE2E2", color: "#B91C1C" }}
          >
            SYNTHESISED — NOT SAPS
          </span>
        </Row>

        <Row label="Stamped on calculations as">
          <span className="font-mono">{RATE_CARD.engineTariffVersion}</span>
        </Row>

        <div>
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1.5">
            Stands in for
          </span>
          <div className="flex flex-wrap gap-1.5">
            {RATE_CARD.emptyTables.map((t) => (
              <span
                key={t}
                className="h-[20px] px-1.5 rounded bg-[#F1F5F9] text-[#475569] text-[10px] font-bold inline-flex items-center font-mono"
                title="Restored empty — no rows in the CMTS backup"
              >
                {t}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-[#64748B] mt-1.5 leading-relaxed">
            All six restored empty. SAPS confirmed no extract will be supplied.
          </p>
        </div>

        <Row label="Decision">
          <span className="font-mono text-[12px]">{RATE_CARD.ticket}</span> · {RATE_CARD.decidedOn}
          <span className="block text-[12px] text-[#64748B] font-normal mt-0.5">
            {RATE_CARD.decisionRef}
          </span>
        </Row>

        <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3">
          <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-1">
            When the extract arrives
          </span>
          <p className="text-[12px] text-[#475569] leading-relaxed">{RATE_CARD.swapNote}</p>
        </div>
      </div>
    </div>
  );
}
