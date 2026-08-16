"use client";

/**
 * CMTS-grade Multi-Tariff Engine — negotiated rates, and what they produce.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This screen used to carry twelve tariff sets as literals in the page file,
 * each with a `rateOverride` number and a named international forwarder
 * attached to an invented contract. Two problems, and the second is the
 * serious one:
 *
 *   1. The rates lived outside `lib/domain`, so the eventual SAPS extract
 *      would not have been a data swap — it would have been a code change in
 *      a React component, and the screen could drift away from what the engine
 *      bills without anything noticing.
 *   2. Real company names were attached to invented commercial terms. A demo
 *      that shows "Schenker Contract 2026 · 15/kg/day" is asserting a
 *      commercial arrangement that does not exist, about a third party who
 *      never agreed to appear. The counterparties are now generic and the
 *      matrix says outright that none of the contracts is real.
 *
 * The screen now resolves everything through `lib/domain/tariff` and prices
 * through the same `calculateCharges()` as every voucher, so "what does this
 * rate card do to a bill" is answerable on screen rather than by inspection.
 *
 * TWO NOTICES, AND THEY SAY DIFFERENT THINGS. The red banner is about the
 * rates being invented — it is the same banner as the tariff master, from the
 * same source, because a card labelled loudly on one screen and quietly on
 * another is labelled quietly. The amber notice is about SCOPE: this engine is
 * outside the awarded contract and belongs to the One-Window Vision delta.
 * Neither substitutes for the other.
 */

import { useCallback, useMemo, useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import IllustrativeRateCardBanner from "@/components/finance-manager/IllustrativeRateCardBanner";
import KPIStrip from "@/components/finance-manager/multi-tariff-engine/KPIStrip";
import ResolutionPreview from "@/components/finance-manager/multi-tariff-engine/ResolutionPreview";
import OverrideMatrix from "@/components/finance-manager/multi-tariff-engine/OverrideMatrix";
import { ILLUSTRATIVE_TARIFF_OVERRIDES, type TariffOverride } from "@/lib/domain/tariff";

export default function MultiTariffEnginePage() {
  const [applied, setApplied] = useState<TariffOverride | null>(null);

  const kpis = useMemo(
    () => ({
      overrides: ILLUSTRATIVE_TARIFF_OVERRIDES.length,
      active: ILLUSTRATIVE_TARIFF_OVERRIDES.filter((o) => o.status === "active").length,
      awaitingApproval: ILLUSTRATIVE_TARIFF_OVERRIDES.filter(
        (o) => o.status === "draft" || o.status === "pending",
      ).length,
      retired: ILLUSTRATIVE_TARIFF_OVERRIDES.filter((o) => o.status === "retired").length,
      contracts: new Set(ILLUSTRATIVE_TARIFF_OVERRIDES.map((o) => o.contract)).size,
    }),
    [],
  );

  // Stable identity so the preview's effect does not re-fire every render.
  const handleOverrideChange = useCallback((o: TariffOverride | null) => setApplied(o), []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb
          items={[
            { label: "Finance Manager", href: "#" },
            { label: "CMTS-grade Multi-Tariff Engine" },
          ]}
        />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              VISION DELTA
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              NO CMTS TABLE
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold inline-flex items-center font-mono">
              ILLUSTRATIVE
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            CMTS-grade Multi-Tariff Engine
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-3xl leading-relaxed">
            Which rate wins for a given consignment, why it won, and what the charge engine actually
            produces when it does — resolved live against the illustrative rate card.
          </p>
        </div>
      </div>

      {/* The rates are invented. First, and not dismissible. */}
      <IllustrativeRateCardBanner screen="the multi-tariff engine" />

      {/* A different claim: this feature is outside awarded scope. */}
      <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] p-4 shadow-sm">
        <span className="text-[13px] font-semibold block mb-0.5" style={{ color: "#B45309" }}>
          Extended scope notice
        </span>
        <span className="text-[13px] leading-relaxed" style={{ color: "#B45309" }}>
          Multi-tariff resolution is outside awarded contract scope and belongs to the One-Window
          Vision delta. CMTS has no table for negotiated rates — the six rate tables it does have
          price by class, subclass, zone, weight and day, with no counterparty dimension at all.
        </span>
      </div>

      <KPIStrip data={kpis} />

      <ResolutionPreview onOverrideChange={handleOverrideChange} />

      <OverrideMatrix highlightId={applied?.id ?? null} />
    </div>
  );
}
