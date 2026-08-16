"use client";

/**
 * The card checking itself, on screen.
 *
 * `checkRateCardCoverage()` asks four questions that a rate card has to be able
 * to answer about itself: is every subclass priced, is every class priced, does
 * the free-day allowance on the class list agree with the zero-amount rate band
 * CMTS derives it from, and does the rent-tax predicate select exactly one row.
 *
 * It runs here rather than in a test because the failure it guards against is
 * an editing failure, and this is the editing screen. A rate row deleted while
 * a subclass still points at it does not throw — it silently prices something
 * as zero. The finding belongs in front of whoever is doing the editing, at the
 * moment they are doing it.
 */

import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import type { RateCardFinding } from "@/lib/domain/tariff";

const TONE = {
  ok: { bg: "#F0FDF4", border: "#BBF7D0", fg: "#15803D", Icon: CheckCircle2 },
  warn: { bg: "#FFFBEB", border: "#FDE68A", fg: "#B45309", Icon: AlertTriangle },
  error: { bg: "#FEF2F2", border: "#FECACA", fg: "#B91C1C", Icon: XCircle },
} as const;

export default function RateCardIntegrity({ findings }: { findings: RateCardFinding[] }) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0] flex items-center justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-bold text-[#0F172A]">Card integrity</h2>
          <p className="text-[12px] text-[#64748B] mt-0.5">
            Re-checked on every render, against the live master data.
          </p>
        </div>
        <span className="text-[12px] text-[#64748B] whitespace-nowrap">
          {findings.length} check{findings.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="p-4 flex flex-col gap-2">
        {findings.map((f, i) => {
          const t = TONE[f.severity];
          const Icon = t.Icon;
          return (
            <div
              key={`${f.code}-${i}`}
              className="rounded-xl border p-3 flex items-start gap-2.5"
              style={{ backgroundColor: t.bg, borderColor: t.border }}
            >
              <Icon size={16} style={{ color: t.fg }} className="flex-shrink-0 mt-0.5" />
              <div className="min-w-0">
                <span
                  className="text-[10px] font-bold font-mono block"
                  style={{ color: t.fg }}
                >
                  {f.code}
                </span>
                <span className="text-[12px] leading-relaxed block" style={{ color: t.fg }}>
                  {f.message}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
