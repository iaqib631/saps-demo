"use client";

/**
 * What the rate card actually contains, counted from the card itself.
 *
 * Every figure here is a COUNT, never a rate — the strip is deliberately the
 * one place on this screen that shows no money, because a headline number in
 * a large bold typeface is exactly the thing that gets screenshotted and
 * quoted. Amounts live in the tables below, under the illustrative note.
 */

import { Layers, Boxes, MapPin, Percent, CalendarClock, Archive } from "lucide-react";

export interface RateCardKpis {
  rateRows: number;
  subclassesPriced: number;
  zonesPriced: number;
  taxRows: number;
  section82Days: number;
  retiredChargeTypes: number;
}

const CARDS = [
  { key: "rateRows" as const, label: "CARGOSUBCLASSCHARGES rows", icon: Layers, color: "#1B4F8B" },
  { key: "subclassesPriced" as const, label: "Subclasses priced", icon: Boxes, color: "#0B2545" },
  { key: "zonesPriced" as const, label: "Zones with a rate", icon: MapPin, color: "#16A34A" },
  { key: "taxRows" as const, label: "TaxType rows", icon: Percent, color: "#7C3AED" },
  { key: "section82Days" as const, label: "Section 82 days", icon: CalendarClock, color: "#D97706" },
  { key: "retiredChargeTypes" as const, label: "Retired charge types", icon: Archive, color: "#94A3B8" },
] as const;

export default function KPIStrip({ data }: { data: RateCardKpis }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      {CARDS.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.key}
            className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm"
          >
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
