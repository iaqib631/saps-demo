"use client";

/**
 * Counts, not money. Same rule as the tariff master's strip: the one place on
 * the screen with a big bold number is the one place that must not carry a
 * rate, because a headline figure is what gets quoted out of context.
 */

import { FileSignature, CheckCircle2, Clock, Archive, Layers } from "lucide-react";

export interface OverrideKpis {
  overrides: number;
  active: number;
  awaitingApproval: number;
  retired: number;
  contracts: number;
}

const CARDS = [
  { key: "overrides" as const, label: "Negotiated overrides", icon: Layers, color: "#1B4F8B" },
  { key: "active" as const, label: "Active — applied", icon: CheckCircle2, color: "#16A34A" },
  { key: "awaitingApproval" as const, label: "Draft / pending — not applied", icon: Clock, color: "#D97706" },
  { key: "retired" as const, label: "Retired — history only", icon: Archive, color: "#94A3B8" },
  { key: "contracts" as const, label: "Contracts referenced", icon: FileSignature, color: "#0B2545" },
] as const;

export default function KPIStrip({ data }: { data: OverrideKpis }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider block mb-3 leading-tight">
              {card.label}
            </span>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: card.color + "15" }}
              >
                <Icon size={16} style={{ color: card.color }} />
              </div>
              <span className="text-[22px] font-bold" style={{ color: card.color }}>
                {data[card.key]}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
