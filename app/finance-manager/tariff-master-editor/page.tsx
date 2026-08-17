"use client";

/**
 * P5-1 · Tariff Master Editor — the rate card, and the fact that we invented it.
 *
 * WHAT CHANGED AND WHY
 * --------------------
 * This screen used to hold twelve tariff lines as literals in the page file:
 * `rate: 8`, `minimumCharge: 500`, `Rs. 10 → Rs. 12` in an audit drawer. Every
 * one of those was a rate living outside `lib/domain`, which broke the property
 * the decision in `CMTS_SCOPE_DECISIONS.md` rests on — that replacing the
 * fixtures with SAPS's real extract is a data swap with no code change. It also
 * meant the numbers on this screen were not the numbers the charge engine
 * billed, so the tariff master could disagree with the invoice and nothing
 * would notice.
 *
 * The screen now renders the actual rate card from `lib/domain/tariff`: the
 * same rows `calculateCharges()` prices from, the same six CMTS tables, under
 * the source column names so migration parity is checkable on sight.
 *
 * WHY THE BANNER IS THE FIRST THING ON THE PAGE
 * ---------------------------------------------
 * The rates are invented. That is the single most important fact about this
 * screen and it is stated before anything numeric appears, in a banner that
 * cannot be dismissed, because the realistic harm is somebody screenshotting a
 * rate table and quoting it to a customer as SAPS's tariff.
 *
 * WHAT IS DELIBERATELY ABSENT
 * ---------------------------
 * There is no "Export rate card" download and no approval chain. An exported
 * CSV leaves the banner behind — the one artefact that stops the numbers being
 * mistaken for an extract is the one that does not survive the export. And an
 * approver name beside an invented rate manufactures authority nobody granted.
 * Both were on the previous version of this screen; both are worse than the
 * gap they filled.
 */

import { useMemo } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import { useToast } from "@/components/ToastContext";
import IllustrativeRateCardBanner from "@/components/finance-manager/IllustrativeRateCardBanner";
import KPIStrip from "@/components/finance-manager/tariff-master-editor/KPIStrip";
import RateCardProvenance from "@/components/finance-manager/tariff-master-editor/RateCardProvenance";
import RateCardIntegrity from "@/components/finance-manager/tariff-master-editor/RateCardIntegrity";
import RateTables from "@/components/finance-manager/tariff-master-editor/RateTables";
import ChargeTypeCatalogue from "@/components/finance-manager/tariff-master-editor/ChargeTypeCatalogue";
import { CARGO_CLASSES, CARGO_SUBCLASSES, retiredChargeTypes } from "@/lib/domain";
import {
  CARGO_SUBCLASS_CHARGES,
  ILLUSTRATIVE_TAX_TYPES,
  LOCATION_CHARGE_BANDS,
  SECTION_82_DAYS_ROW,
  SUBCLASS_RATE_ASSIGNMENTS,
  checkRateCardCoverage,
} from "@/lib/domain/tariff";

export default function TariffMasterEditorPage() {
  const { addToast } = useToast();

  const kpis = useMemo(
    () => ({
      rateRows: CARGO_SUBCLASS_CHARGES.length,
      subclassesPriced: SUBCLASS_RATE_ASSIGNMENTS.length,
      zonesPriced: new Set(LOCATION_CHARGE_BANDS.map((b) => b.zoneAbbr)).size,
      taxRows: ILLUSTRATIVE_TAX_TYPES.length,
      section82Days: SECTION_82_DAYS_ROW.Days,
      retiredChargeTypes: retiredChargeTypes().length,
    }),
    [],
  );

  // Runs against the live master data on every render — see RateCardIntegrity.
  const findings = useMemo(() => checkRateCardCoverage(CARGO_SUBCLASSES, CARGO_CLASSES), []);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb
          items={[{ label: "Finance Manager", href: "#" }, { label: "Tariff Master Editor" }]}
        />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              P5-1
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              6 RATE TABLES · ALL EMPTY
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#B91C1C] text-[10px] font-bold inline-flex items-center font-mono">
              ILLUSTRATIVE
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Tariff Master Editor
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1 max-w-3xl leading-relaxed">
            The rate card the charge engine actually prices from — every band, fee, unit, tax rate
            and threshold, under the CMTS column names each would migrate into. Not SAPS&apos;s
            rates.
          </p>
        </div>
      </div>

      {/* First, before any number. Not dismissible. */}
      <IllustrativeRateCardBanner screen="the tariff master" />

      <KPIStrip data={kpis} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 flex flex-col gap-6">
          <RateCardProvenance />
          <RateCardIntegrity findings={findings} />

          {/*
            The action that used to be "Export Rate Card". Kept visible and
            explicitly refused rather than silently removed: an operator who
            looked for it should find out why it is gone.
          */}
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
            <h2 className="text-[15px] font-bold text-[#0F172A]">Export</h2>
            <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed">
              Exporting the card would strip the banner from the numbers — a spreadsheet of round
              PKR figures with no context is precisely the artefact that gets quoted as SAPS&apos;s
              tariff.
            </p>
            <button
              onClick={() =>
                addToast(
                  "Export withheld — an exported rate card leaves the illustrative label behind",
                  "error",
                )
              }
              className="mt-3 h-9 px-3 rounded-xl border border-[#E2E8F0] text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
            >
              Export rate card
            </button>
          </div>
        </div>

        <div className="xl:col-span-2 flex flex-col gap-6">
          <RateTables />
        </div>
      </div>

      <ChargeTypeCatalogue />
    </div>
  );
}
