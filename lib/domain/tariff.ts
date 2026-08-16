/**
 * ============================================================================
 *  ILLUSTRATIVE RATE CARD — INVENTED BY THE AIRVAULT BUILD TEAM.
 *  NOT SAPS DATA. NOT AN EXTRACT. NOT VALIDATED BY ANYONE AT SAPS.
 * ============================================================================
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * Six CMTS tables hold the numbers SAPS bills on:
 *
 *     CARGOSUBCLASSCHARGES · LOCATIONCHARGES · CargoClassCharges
 *     TaxType · Section82Days · Lookup
 *
 * The restored CMTS database is SCHEMA-ONLY. All six are empty, and SAPS has
 * confirmed it will not supply answers or a data extract (see
 * `CMTS_SCOPE_DECISIONS.md` § "The data request", ticket 86eyn3nmq). Without
 * them the charge engine in `./finance.ts` resolves against nothing and the
 * billing screens cannot be demonstrated at all — not "look approximate",
 * literally cannot render a number.
 *
 * So the rates below are SYNTHESISED. They are internally consistent, shaped
 * like an air-cargo tariff, and sufficient to exercise every branch of the
 * calculation that already exists — banded day slabs, free-day allowances,
 * location and handling units, the tax percentage and the Section 82
 * threshold. That is all they are. They are not an estimate of what SAPS
 * charges, and they are not a starting point for negotiation.
 *
 * THE HARM THIS FILE IS GUARDING AGAINST
 * --------------------------------------
 * An invented tariff mistaken for SAPS's actual rates would produce
 * confidently wrong numbers in a client conversation — a spreadsheet built off
 * a demo screenshot, a bill queried against a rate nobody at SAPS ever set.
 * Three deliberate defences, and none of them is decoration:
 *
 *   1. Every table below carries its own header comment saying it is
 *      illustrative and why it exists. Copy a table out of this file and the
 *      warning travels with it.
 *   2. Both tariff screens render a PERSISTENT banner — not a tooltip, not a
 *      footnote — built from `RATE_CARD` below, so the label cannot drift out
 *      of sync with the data or be dismissed by a user.
 *   3. Every value is deliberately ROUND: 500, 1200, 15%. Nothing here reads
 *      like 487.35, because precision is what makes a fixture look extracted.
 *      If you are tempted to make a number "more realistic", don't — the
 *      roundness IS the safety mechanism.
 *
 * ONE HOME FOR RATES
 * ------------------
 * Nothing outside `lib/domain` hard-codes a rate. Every screen resolves through
 * this file (directly, or through `./masters`, which derives its rate tables
 * from here). When SAPS eventually supplies the extract, replacing the tables
 * in this file is a DATA SWAP WITH NO CODE CHANGE — that property is the whole
 * point of keeping the numbers in one place, and it is worth checking before
 * merging anything that adds a number to a component.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * ---------------------------------------
 * It does not import `./finance` or `./masters`. It is a leaf: rate tables and
 * pure resolvers only. `./masters` imports THIS file to derive `TARIFF_SLABS`,
 * `TAX_TYPES`, `LOCATION_CHARGES`, `CATEGORY_SURCHARGES`, `SECTION_82_DAYS`
 * and the per-class / per-subclass charge columns, so the import direction is
 * one-way and there is exactly one home for a rate.
 *
 * IMPORT NOTE
 * -----------
 * Not re-exported from `lib/domain/index.ts` — the barrel is a shared-conflict
 * file while several tickets are landing at once, so screens import
 * `@/lib/domain/tariff` directly, the same way `./grcharges` is consumed.
 */

import { DEMO_NOW, MS_PER_DAY, formatPkr, round2, type Amount, type SiteCode } from "./common";

/* ================================================================== *
 * Provenance — the single source for every "this is not real" label
 * ================================================================== */

/**
 * Everything the screens need to say where these numbers came from. The banner
 * text lives HERE rather than in the JSX so that the warning and the data are
 * versioned together: a future edit that swaps the tables for a real extract
 * flips `isIllustrative` and the banner changes everywhere at once, rather
 * than leaving a stale "illustrative" label over real rates (or, far worse, a
 * stale "SAPS-supplied" label over invented ones).
 */
export const RATE_CARD = {
  /** Version identifier printed on every calculation this card prices. */
  id: "AV-ILLUSTRATIVE-2026.2",
  /**
   * The version string `finance.ts` stamps onto a `ChargeCalculation`
   * (`tariffVersion`). Kept identical to that default so a voucher priced by
   * the engine and this card cannot claim two different provenances.
   */
  engineTariffVersion: "TARIFF-2026.2",
  effectiveFrom: "2026-06-01",
  effectiveTo: null as string | null,
  /**
   * THE flag. Anything rendering a rate must branch on this, not on a hardcoded
   * string, so that the day this becomes `false` every warning disappears in
   * one edit and not one screen at a time.
   */
  isIllustrative: true,
  origin: "synthesised-by-airvault-build-team" as const,
  headline: "ILLUSTRATIVE RATES — NOT SAPS DATA",
  summary:
    "Every rate on this screen was invented by the AirVault build team to demonstrate the charge engine. SAPS supplied no rate extract.",
  detail:
    "The six CMTS rate tables were restored empty, and SAPS confirmed it will not supply answers or a data extract. These figures are deliberately round and obviously synthetic so they cannot be mistaken for an extract. Do not quote any number on this screen to a customer, do not use one to validate a bill, and do not treat the shape of the card as evidence of how SAPS prices.",
  /** The six empty tables this card stands in for. */
  emptyTables: [
    "CARGOSUBCLASSCHARGES",
    "LOCATIONCHARGES",
    "CargoClassCharges",
    "TaxType",
    "Section82Days",
    "Lookup",
  ] as const,
  decisionRef: "CMTS_SCOPE_DECISIONS.md § The data request — six rate tables, no data",
  ticket: "86eyn3nmq",
  decidedOn: "2026-08-16",
  swapNote:
    "When SAPS supplies the extract, replace the tables in lib/domain/tariff.ts and set isIllustrative to false. No screen changes — nothing outside lib/domain holds a rate.",
} as const;

/* ================================================================== *
 * Units — CMTS `UNIT` on the rate tables
 * ================================================================== */

/**
 * CMTS `UNIT` on `CARGOSUBCLASSCHARGES` / `LOCATIONCHARGES`:
 * 1 = per kg, 2 = per piece, 3 = flat. The same three codes appear as the
 * free-text `HandlingUnit` / `StorgeUnit` / `LocationUnit` strings on
 * `GODOWNRENTDETAIL`, which is why the label map is here and not in the JSX.
 */
export type ChargeUnitCode = 1 | 2 | 3;

export const CHARGE_UNIT_LABEL: Record<ChargeUnitCode, string> = {
  1: "PER KG",
  2: "PER PIECE",
  3: "FLAT",
};

/** CMTS `CHARGESTYPE` — the discriminator that separates demurrage from the rest. */
export type ChargesTypeCode = "Demrage" | "Handling" | "Location";

/* ================================================================== *
 * CargoClassCharges — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * The per-class charge block: the three flat fees FC-07 adds to every bill,
 * plus the free-day allowance. CMTS splits these across `CARGOCLASS` and
 * `CargoClassCharges`; both are empty, so both are invented here.
 *
 * These are the numbers `finance.ts` reads as `cls.DOCUMENTATIONCHARGES`,
 * `cls.DECONSOLIDATIONCHARGES`, `cls.SPECIALHANDLINGCHARGES` and
 * `cls.freeDays` — `./masters` builds `CARGO_CLASSES` by joining its class
 * identity rows to this table, so the class list carries taxonomy and this
 * carries money. Change a fee here and the engine bills it; there is no second
 * copy to keep in step.
 *
 * Round by construction: every fee is a multiple of 100 and every free-day
 * count is a small integer. A zero is a real "this class is not charged for
 * that" (welfare and customs-held classes), not a missing value.
 * ================================================================== */

export interface CargoClassCharge {
  /** CMTS `CLASSID` */
  CLASSID: number;
  /** CMTS `ABBREVATION` — carried for readability; the key is CLASSID. */
  ABBREVATION: string;
  /** CMTS `DOCUMENTATIONCHARGES` — flat, per AWB. */
  DOCUMENTATIONCHARGES: Amount;
  /** CMTS `DECONSOLIDATIONCHARGES` — flat, per consol breakdown. */
  DECONSOLIDATIONCHARGES: Amount;
  /** CMTS `SPECIALHANDLINGCHARGES` — flat, class-driven uplift. */
  SPECIALHANDLINGCHARGES: Amount;
  /**
   * Free days before storage accrues (FC-07 §03).
   *
   * In CMTS this is not stored as a column at all — it is DERIVED from the
   * rate row whose amount is zero (`case when s.AMOUNT = 0 then s.DAYTO end`,
   * see CMTS_SCHEMA_AUDIT §3.2). It is written here as well so the class list
   * has something to read, and `CARGO_SUBCLASS_CHARGES` below generates its
   * zero-amount band FROM this number — so the two cannot disagree, and
   * `freeDaysFromZeroBand()` proves it.
   */
  FREEDAYS: number;
}

export const CARGO_CLASS_CHARGES: CargoClassCharge[] = [
  // --- FC-03 A. General / Normal ------------------------------------
  { CLASSID: 1, ABBREVATION: "GCR", DOCUMENTATIONCHARGES: 750, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 3 },
  { CLASSID: 2, ABBREVATION: "AFU", DOCUMENTATIONCHARGES: 750, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 2500, FREEDAYS: 3 },
  { CLASSID: 3, ABBREVATION: "ICG", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 2 },
  { CLASSID: 4, ABBREVATION: "UAB", DOCUMENTATIONCHARGES: 500, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 5 },
  // --- FC-03 B. Special handling ------------------------------------
  { CLASSID: 5, ABBREVATION: "DGR", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 2400, SPECIALHANDLINGCHARGES: 6500, FREEDAYS: 2 },
  { CLASSID: 6, ABBREVATION: "PER", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 4500, FREEDAYS: 1 },
  { CLASSID: 7, ABBREVATION: "VAL", DOCUMENTATIONCHARGES: 2000, DECONSOLIDATIONCHARGES: 2400, SPECIALHANDLINGCHARGES: 8500, FREEDAYS: 1 },
  { CLASSID: 8, ABBREVATION: "AVI", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 7500, FREEDAYS: 1 },
  { CLASSID: 9, ABBREVATION: "HUM", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 3 },
  { CLASSID: 10, ABBREVATION: "AOG", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 3500, FREEDAYS: 1 },
  { CLASSID: 11, ABBREVATION: "DIP", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 7 },
  { CLASSID: 12, ABBREVATION: "VUN", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 5500, FREEDAYS: 2 },
  { CLASSID: 13, ABBREVATION: "PHR", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 5500, FREEDAYS: 1 },
  // --- FC-03 C. Controlled / exception ------------------------------
  { CLASSID: 14, ABBREVATION: "BND", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 3 },
  { CLASSID: 15, ABBREVATION: "TRF", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 5 },
  { CLASSID: 16, ABBREVATION: "CDT", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 0 },
  { CLASSID: 17, ABBREVATION: "CDR", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 0 },
  { CLASSID: 18, ABBREVATION: "MSH", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 0 },
  { CLASSID: 19, ABBREVATION: "REX", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 0 },
  { CLASSID: 20, ABBREVATION: "LST", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, FREEDAYS: 0 },
];

export function classCharges(classId: number): CargoClassCharge {
  const c = CARGO_CLASS_CHARGES.find((x) => x.CLASSID === classId);
  if (!c) throw new Error(`No illustrative CargoClassCharges row for CLASSID ${classId}`);
  return c;
}

/* ================================================================== *
 * CARGOSUBCLASS.MINCHARGES — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * The per-subclass floor: FC-07 bills `max(components, MINCHARGES)`, so this
 * is an ALTERNATIVE to the computed total, never an addition to it. A zero is
 * a real "no floor" (welfare and customs-held subclasses), not a gap.
 *
 * Lives here rather than on the subclass list for the same reason as the class
 * fees above: it is money, and money has one home. `./masters` joins it onto
 * `CARGO_SUBCLASSES` so `finance.ts` still reads `sub.MINCHARGES`.
 * ================================================================== */

export interface SubClassMinimumCharge {
  /** CMTS `SUBCLASSID` */
  SUBCLASSID: number;
  /** CMTS `CLASSID` */
  CLASSID: number;
  /** CMTS `ABBREVATION` — readability only. */
  ABBREVATION: string;
  /** CMTS `MINCHARGES` float — the floor. */
  MINCHARGES: Amount;
}

export const SUBCLASS_MINIMUM_CHARGES: SubClassMinimumCharge[] = [
  { SUBCLASSID: 101, CLASSID: 1, ABBREVATION: "GCR-P", MINCHARGES: 1500 },
  { SUBCLASSID: 102, CLASSID: 1, ABBREVATION: "GCR-L", MINCHARGES: 1200 },
  { SUBCLASSID: 103, CLASSID: 2, ABBREVATION: "AFU-H", MINCHARGES: 4500 },
  { SUBCLASSID: 104, CLASSID: 2, ABBREVATION: "AFU-O", MINCHARGES: 3500 },
  { SUBCLASSID: 105, CLASSID: 3, ABBREVATION: "ICG", MINCHARGES: 2000 },
  { SUBCLASSID: 106, CLASSID: 4, ABBREVATION: "UAB", MINCHARGES: 800 },
  { SUBCLASSID: 107, CLASSID: 5, ABBREVATION: "DGR-3", MINCHARGES: 8500 },
  { SUBCLASSID: 108, CLASSID: 5, ABBREVATION: "DGR-8", MINCHARGES: 8500 },
  { SUBCLASSID: 109, CLASSID: 5, ABBREVATION: "DGR-9", MINCHARGES: 7500 },
  { SUBCLASSID: 110, CLASSID: 6, ABBREVATION: "COL", MINCHARGES: 5500 },
  { SUBCLASSID: 111, CLASSID: 6, ABBREVATION: "CRT", MINCHARGES: 4500 },
  { SUBCLASSID: 112, CLASSID: 6, ABBREVATION: "ERT", MINCHARGES: 4000 },
  { SUBCLASSID: 113, CLASSID: 6, ABBREVATION: "FRO", MINCHARGES: 7500 },
  { SUBCLASSID: 114, CLASSID: 7, ABBREVATION: "VAL-V", MINCHARGES: 12000 },
  { SUBCLASSID: 115, CLASSID: 8, ABBREVATION: "AVI", MINCHARGES: 9500 },
  { SUBCLASSID: 116, CLASSID: 9, ABBREVATION: "HUM", MINCHARGES: 0 },
  { SUBCLASSID: 117, CLASSID: 10, ABBREVATION: "AOG", MINCHARGES: 4500 },
  { SUBCLASSID: 118, CLASSID: 11, ABBREVATION: "DIP", MINCHARGES: 0 },
  { SUBCLASSID: 119, CLASSID: 12, ABBREVATION: "VUN", MINCHARGES: 6500 },
  { SUBCLASSID: 120, CLASSID: 13, ABBREVATION: "PHR", MINCHARGES: 6500 },
  { SUBCLASSID: 121, CLASSID: 14, ABBREVATION: "BND", MINCHARGES: 2500 },
  { SUBCLASSID: 122, CLASSID: 15, ABBREVATION: "TRF", MINCHARGES: 2500 },
  { SUBCLASSID: 123, CLASSID: 16, ABBREVATION: "CDT", MINCHARGES: 0 },
  { SUBCLASSID: 124, CLASSID: 17, ABBREVATION: "CDR", MINCHARGES: 0 },
  { SUBCLASSID: 125, CLASSID: 18, ABBREVATION: "MSH", MINCHARGES: 0 },
  { SUBCLASSID: 126, CLASSID: 19, ABBREVATION: "REX", MINCHARGES: 2500 },
  { SUBCLASSID: 127, CLASSID: 20, ABBREVATION: "LST", MINCHARGES: 0 },
];

export function minimumChargeFor(subClassId: number): Amount {
  const s = SUBCLASS_MINIMUM_CHARGES.find((x) => x.SUBCLASSID === subClassId);
  if (!s) throw new Error(`No illustrative MINCHARGES row for SUBCLASSID ${subClassId}`);
  return s.MINCHARGES;
}

/* ================================================================== *
 * Weight bands — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * CMTS selects a rate by weight as well as by day:
 *   `AND l.WEIGHT >= s.WEIGHTFROM AND l.WEIGHT <= s.WEIGHTTO`
 * on BOTH `CARGOSUBCLASSCHARGES` and `LOCATIONCHARGES`
 * (CMTS_SCHEMA_AUDIT §3.3). Two bands are enough to make the branch real
 * without turning the rate table into a wall: light is the everyday case,
 * heavy carries a flat +25 uplift per kg-day. The uplift is a round number on
 * purpose — a weight scale with three decimal places would look extracted.
 * ================================================================== */

export interface WeightBand {
  code: "LIGHT" | "HEAVY";
  label: string;
  /** CMTS `WEIGHTFROM` */
  WEIGHTFROM: number;
  /** CMTS `WEIGHTTO` — null is the open-ended top band. */
  WEIGHTTO: number | null;
  /** PKR per kg per day added to the profile rate in this band. */
  uplift: Amount;
}

export const WEIGHT_BANDS: WeightBand[] = [
  { code: "LIGHT", label: "0 – 1,000 kg", WEIGHTFROM: 0, WEIGHTTO: 1000, uplift: 0 },
  { code: "HEAVY", label: "1,000 kg +", WEIGHTFROM: 1000, WEIGHTTO: null, uplift: 25 },
];

export function weightBandFor(kg: number): WeightBand {
  return (
    WEIGHT_BANDS.find((b) => kg >= b.WEIGHTFROM && (b.WEIGHTTO === null || kg <= b.WEIGHTTO)) ??
    WEIGHT_BANDS[WEIGHT_BANDS.length - 1]
  );
}

/* ================================================================== *
 * Storage rate profiles — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * Rather than 27 hand-keyed subclass rate rows (27 chances to key a number
 * that contradicts its neighbour), each subclass points at one of six
 * profiles. Internal consistency is then structural: two DGR subclasses cannot
 * drift apart, and a reviewer checks six sets of three numbers instead of 81.
 *
 * Every rate is PKR per chargeable kg per day, and every one is a multiple of
 * five. The three numbers are the escalating day bands after the free period —
 * storage gets more expensive the longer cargo sits, which is the only
 * behavioural claim this card makes about how a terminal prices.
 *
 * STANDARD is load-bearing: `./masters` derives `TARIFF_SLABS` from it, and
 * `TARIFF_SLABS` is what `finance.ts` actually prices every consignment on
 * today. Its 0 / 35 / 50 / 75 shape is unchanged from the pre-decision fixture
 * so that re-homing the rates into this file did not silently re-price the
 * whole demo.
 * ================================================================== */

export type RateProfileCode =
  | "STANDARD"
  | "PRIORITY"
  | "SPECIAL"
  | "COLD"
  | "CONTROLLED"
  | "WELFARE";

export interface RateProfile {
  code: RateProfileCode;
  label: string;
  description: string;
  /** PKR per kg per day for the three chargeable bands, in order. */
  dayRates: [Amount, Amount, Amount];
}

export const RATE_PROFILES: RateProfile[] = [
  { code: "STANDARD", label: "Standard", description: "General and unaccompanied cargo in the open shed", dayRates: [35, 50, 75] },
  { code: "PRIORITY", label: "Priority", description: "Fast-turnaround zones — priced to discourage dwell", dayRates: [40, 60, 90] },
  { code: "SPECIAL", label: "Special handling", description: "DGR, valuables, live animals, vulnerable and pharma", dayRates: [50, 75, 100] },
  { code: "COLD", label: "Cold chain", description: "Powered temperature-controlled regimes", dayRates: [60, 90, 120] },
  { code: "CONTROLLED", label: "Controlled / bonded", description: "Bonded, transhipment, detained and re-export holding", dayRates: [25, 40, 60] },
  { code: "WELFARE", label: "Welfare — zero rated", description: "Human remains and diplomatic cargo. Never charged storage.", dayRates: [0, 0, 0] },
];

export function rateProfile(code: RateProfileCode): RateProfile {
  const p = RATE_PROFILES.find((x) => x.code === code);
  if (!p) throw new Error(`Unknown rate profile ${code}`);
  return p;
}

/**
 * Subclass → profile, and the zone the subclass normally sits in.
 *
 * `SUBCLASSID` / `CLASSID` are the rate table's own key columns, not a copy of
 * the taxonomy: `CARGOSUBCLASSCHARGES` is keyed on exactly these. The
 * abbreviations are for readability. `checkRateCardCoverage()` verifies this
 * list against the real subclass master so a subclass added to `./masters`
 * without a rate is a visible finding rather than a runtime throw.
 */
export interface SubClassRateAssignment {
  SUBCLASSID: number;
  CLASSID: number;
  ABBREVATION: string;
  profile: RateProfileCode;
  /** `LOCATION.ABBREVATION` of the zone this subclass is normally allocated to. */
  zoneAbbr: string;
}

export const SUBCLASS_RATE_ASSIGNMENTS: SubClassRateAssignment[] = [
  { SUBCLASSID: 101, CLASSID: 1, ABBREVATION: "GCR-P", profile: "STANDARD", zoneAbbr: "GCR-RACK" },
  { SUBCLASSID: 102, CLASSID: 1, ABBREVATION: "GCR-L", profile: "STANDARD", zoneAbbr: "GCR-RACK" },
  { SUBCLASSID: 103, CLASSID: 2, ABBREVATION: "AFU-H", profile: "STANDARD", zoneAbbr: "AFU-FLOOR" },
  { SUBCLASSID: 104, CLASSID: 2, ABBREVATION: "AFU-O", profile: "STANDARD", zoneAbbr: "AFU-FLOOR" },
  { SUBCLASSID: 105, CLASSID: 3, ABBREVATION: "ICG", profile: "PRIORITY", zoneAbbr: "ICG-PRZ" },
  { SUBCLASSID: 106, CLASSID: 4, ABBREVATION: "UAB", profile: "STANDARD", zoneAbbr: "UAB-AREA" },
  { SUBCLASSID: 107, CLASSID: 5, ABBREVATION: "DGR-3", profile: "SPECIAL", zoneAbbr: "DGR-SEG" },
  { SUBCLASSID: 108, CLASSID: 5, ABBREVATION: "DGR-8", profile: "SPECIAL", zoneAbbr: "DGR-SEG" },
  { SUBCLASSID: 109, CLASSID: 5, ABBREVATION: "DGR-9", profile: "SPECIAL", zoneAbbr: "DGR-SEG" },
  { SUBCLASSID: 110, CLASSID: 6, ABBREVATION: "COL", profile: "COLD", zoneAbbr: "PER-COLD" },
  { SUBCLASSID: 111, CLASSID: 6, ABBREVATION: "CRT", profile: "COLD", zoneAbbr: "PER-COLD" },
  { SUBCLASSID: 112, CLASSID: 6, ABBREVATION: "ERT", profile: "COLD", zoneAbbr: "PER-COLD" },
  { SUBCLASSID: 113, CLASSID: 6, ABBREVATION: "FRO", profile: "COLD", zoneAbbr: "PER-COLD" },
  { SUBCLASSID: 114, CLASSID: 7, ABBREVATION: "VAL-V", profile: "SPECIAL", zoneAbbr: "VAL-VAULT" },
  { SUBCLASSID: 115, CLASSID: 8, ABBREVATION: "AVI", profile: "SPECIAL", zoneAbbr: "AVI-AREA" },
  { SUBCLASSID: 116, CLASSID: 9, ABBREVATION: "HUM", profile: "WELFARE", zoneAbbr: "HUM-SHA" },
  { SUBCLASSID: 117, CLASSID: 10, ABBREVATION: "AOG", profile: "PRIORITY", zoneAbbr: "AOG-PZ" },
  { SUBCLASSID: 118, CLASSID: 11, ABBREVATION: "DIP", profile: "WELFARE", zoneAbbr: "DIP-CAA" },
  { SUBCLASSID: 119, CLASSID: 12, ABBREVATION: "VUN", profile: "SPECIAL", zoneAbbr: "VUN-SEC" },
  { SUBCLASSID: 120, CLASSID: 13, ABBREVATION: "PHR", profile: "SPECIAL", zoneAbbr: "PHR-STORE" },
  { SUBCLASSID: 121, CLASSID: 14, ABBREVATION: "BND", profile: "CONTROLLED", zoneAbbr: "BND-STORE" },
  { SUBCLASSID: 122, CLASSID: 15, ABBREVATION: "TRF", profile: "CONTROLLED", zoneAbbr: "TRF-ZONE" },
  { SUBCLASSID: 123, CLASSID: 16, ABBREVATION: "CDT", profile: "CONTROLLED", zoneAbbr: "CDT-AREA" },
  { SUBCLASSID: 124, CLASSID: 17, ABBREVATION: "CDR", profile: "CONTROLLED", zoneAbbr: "CDR-HOLD" },
  { SUBCLASSID: 125, CLASSID: 18, ABBREVATION: "MSH", profile: "CONTROLLED", zoneAbbr: "MSH-QTN" },
  { SUBCLASSID: 126, CLASSID: 19, ABBREVATION: "REX", profile: "CONTROLLED", zoneAbbr: "REX-HOLD" },
  { SUBCLASSID: 127, CLASSID: 20, ABBREVATION: "LST", profile: "CONTROLLED", zoneAbbr: "LST-AUC" },
];

export function rateAssignment(subClassId: number): SubClassRateAssignment {
  const a = SUBCLASS_RATE_ASSIGNMENTS.find((x) => x.SUBCLASSID === subClassId);
  if (!a) throw new Error(`No illustrative rate assignment for SUBCLASSID ${subClassId}`);
  return a;
}

/* ================================================================== *
 * CARGOSUBCLASSCHARGES — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * The banded storage rate table, materialised from the profiles above. One row
 * per subclass × weight band × day band, which is exactly how CMTS keys it:
 * class AND subclass AND location AND weight band AND day band.
 *
 * WHICH COLUMNS ARE MODELLED
 * --------------------------
 * Thirteen of the source table's fifteen. The two omitted are the surrogate
 * key and the office scoping (`CityId` / `Off_Code`), which this prototype has
 * no backend for — the same omission `CHARGETYPE` makes in `./masters`. Every
 * modelled column keeps its CMTS spelling exactly.
 *
 * THE ZERO-AMOUNT ROW IS THE FREE PERIOD
 * --------------------------------------
 * CMTS does not store free days. It reads them off this table:
 *   `case when s.AMOUNT = 0 then (s.DAYTO + @ExtraFreeDays) end`
 * So the generator below emits a leading `AMOUNT: 0` band running to
 * `CargoClassCharges.FREEDAYS`, and the free-day count on the class list is
 * therefore the same number, by construction rather than by discipline.
 * `freeDaysFromZeroBand()` re-derives it the CMTS way, and the tariff screen
 * shows the two agreeing — if they ever stop agreeing, that is a defect in
 * this file, and it will be on screen.
 *
 * A class with zero free days emits NO zero-amount row, which is the faithful
 * representation: CMTS would have no row to read and would derive nothing.
 * ================================================================== */

export interface CargoSubClassCharge {
  /** Row identity — synthetic, ascending, stable. */
  CHARGESID: number;
  /** CMTS `CLASSID` */
  CLASSID: number;
  /** CMTS `SUBCLASSID` */
  SUBCLASSID: number;
  /** `LOCATION.ABBREVATION` standing in for CMTS `LOCATIONID`, which is site-scoped. */
  LOCATIONABBR: string;
  /** CMTS `WEIGHTFROM` */
  WEIGHTFROM: number;
  /** CMTS `WEIGHTTO` — null is the open-ended top band. */
  WEIGHTTO: number | null;
  /** CMTS `DAYFROM` */
  DAYFROM: number;
  /** CMTS `DAYTO` — null is the open-ended final band. */
  DAYTO: number | null;
  /** CMTS `AMOUNT` — PKR per unit per day. Zero marks the free period. */
  AMOUNT: Amount;
  /** CMTS `UNIT` — 1 per kg, 2 per piece, 3 flat. Storage is always per kg here. */
  UNIT: ChargeUnitCode;
  /** CMTS `FLATERATE` bit — true when AMOUNT is charged once, not per unit. */
  FLATERATE: boolean;
  /** CMTS `CHARGESTYPE` — `'Demrage'` is the discriminator the procedure matches on. */
  CHARGESTYPE: ChargesTypeCode;
  /** CMTS `SPECIALCHARGES` — additional flat uplift on the band. Zero throughout this card. */
  SPECIALCHARGES: Amount;
}

/**
 * Band boundaries after the free period: four days, then seven, then open.
 * Written once because both `CARGO_SUBCLASS_CHARGES` and `slabsFor()` need the
 * same shape and a second copy would be a second answer.
 */
const CHARGEABLE_BAND_LENGTHS: [number, number] = [4, 7];

function dayBandsAfterFree(freeDays: number): Array<{ DAYFROM: number; DAYTO: number | null }> {
  const first = freeDays + 1;
  const second = first + CHARGEABLE_BAND_LENGTHS[0];
  const third = second + CHARGEABLE_BAND_LENGTHS[1];
  return [
    { DAYFROM: first, DAYTO: second - 1 },
    { DAYFROM: second, DAYTO: third - 1 },
    { DAYFROM: third, DAYTO: null },
  ];
}

export const CARGO_SUBCLASS_CHARGES: CargoSubClassCharge[] = (() => {
  const rows: CargoSubClassCharge[] = [];
  let id = 1;
  for (const a of SUBCLASS_RATE_ASSIGNMENTS) {
    const free = classCharges(a.CLASSID).FREEDAYS;
    const profile = rateProfile(a.profile);
    for (const w of WEIGHT_BANDS) {
      // The free period, expressed the way CMTS expresses it — as a zero-rate
      // band. Omitted entirely when the class has no free days.
      if (free > 0) {
        rows.push({
          CHARGESID: id++,
          CLASSID: a.CLASSID,
          SUBCLASSID: a.SUBCLASSID,
          LOCATIONABBR: a.zoneAbbr,
          WEIGHTFROM: w.WEIGHTFROM,
          WEIGHTTO: w.WEIGHTTO,
          DAYFROM: 1,
          DAYTO: free,
          AMOUNT: 0,
          UNIT: 1,
          FLATERATE: false,
          CHARGESTYPE: "Demrage",
          SPECIALCHARGES: 0,
        });
      }
      dayBandsAfterFree(free).forEach((band, i) => {
        const base = profile.dayRates[i];
        rows.push({
          CHARGESID: id++,
          CLASSID: a.CLASSID,
          SUBCLASSID: a.SUBCLASSID,
          LOCATIONABBR: a.zoneAbbr,
          WEIGHTFROM: w.WEIGHTFROM,
          WEIGHTTO: w.WEIGHTTO,
          DAYFROM: band.DAYFROM,
          DAYTO: band.DAYTO,
          // A zero-rated profile stays zero in every weight band: welfare cargo
          // is not charged for being heavy.
          AMOUNT: base === 0 ? 0 : base + w.uplift,
          UNIT: 1,
          FLATERATE: false,
          CHARGESTYPE: "Demrage",
          SPECIALCHARGES: 0,
        });
      });
    }
  }
  return rows;
})();

/**
 * The CMTS derivation of the free period, run against the card itself:
 * the `DAYTO` of the zero-amount row. Returns 0 when there is no such row,
 * which is what CMTS's `case` expression would produce.
 *
 * This exists to be CALLED, not just documented — the tariff screen renders it
 * next to `CargoClassCharges.FREEDAYS` so the two derivations are visibly the
 * same number. A rate card that says "3 free days" in one table and prices
 * from day 2 in another is the single easiest way to bill wrongly.
 */
export function freeDaysFromZeroBand(subClassId: number, weightKg = 0): number {
  const band = weightBandFor(weightKg);
  const row = CARGO_SUBCLASS_CHARGES.find(
    (r) => r.SUBCLASSID === subClassId && r.WEIGHTFROM === band.WEIGHTFROM && r.AMOUNT === 0,
  );
  return row?.DAYTO ?? 0;
}

/** Every rate row for one subclass, in key order — what the master editor lists. */
export function chargesForSubClass(subClassId: number): CargoSubClassCharge[] {
  return CARGO_SUBCLASS_CHARGES.filter((r) => r.SUBCLASSID === subClassId);
}

/* ------------------------------------------------------------------ *
 * Day slabs, in the shape `finance.ts` prices on
 * ------------------------------------------------------------------ */

/**
 * The `TariffSlab` shape `./masters` exports and `slabBreakdown()` walks.
 * Declared here rather than imported so this file stays a leaf; `./masters`
 * re-declares the interface it has always exported and assigns from this.
 */
export interface RateCardSlab {
  DAYFROM: number;
  DAYTO: number | null;
  label: string;
  ratePerKgPerDay: Amount;
}

function slabLabel(from: number, to: number | null, free: boolean): string {
  const range = to === null ? `Day ${from}+` : from === to ? `Day ${from}` : `Day ${from}–${to}`;
  return free ? `${range} (free)` : range;
}

/**
 * The day-band set for one subclass at one weight, as `slabBreakdown()` wants
 * it. Every branch of the card can be priced through this.
 */
export function slabsFor(subClassId: number, weightKg = 0): RateCardSlab[] {
  const band = weightBandFor(weightKg);
  return CARGO_SUBCLASS_CHARGES.filter(
    (r) => r.SUBCLASSID === subClassId && r.WEIGHTFROM === band.WEIGHTFROM,
  ).map((r) => ({
    DAYFROM: r.DAYFROM,
    DAYTO: r.DAYTO,
    label: slabLabel(r.DAYFROM, r.DAYTO, r.AMOUNT === 0),
    ratePerKgPerDay: r.AMOUNT,
  }));
}

/**
 * The band set `./masters` publishes as `TARIFF_SLABS` — general palletised
 * cargo (SUBCLASSID 101) in the light weight band.
 *
 * `finance.ts` prices EVERY consignment on this one set: `slabBreakdown()`
 * takes days and kg and reads the module-level constant, so per-subclass and
 * per-weight selection (CMTS_SCHEMA_AUDIT §3.2/§3.3) is not implemented in the
 * engine. That is a known gap in the engine, NOT a gap in this card — the card
 * carries the full matrix, and `resolveChargeInputs()` reports both the band
 * set the card selects and the band set the engine will actually use, so the
 * difference is visible on screen instead of silently mis-billing.
 */
export const STANDARD_DAY_BANDS: RateCardSlab[] = slabsFor(101, 0);

/* ================================================================== *
 * Handling charges — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * CMTS carries handling as a rate plus the unit it is quoted on
 * (`grCharges.Handlingchargesperkg` / `HandlingchargesUnit`,
 * `GODOWNRENTDETAIL.HandlingUnit`). All three units are exercised here — per
 * kg, per piece and flat — because a card that only ever quotes per kg leaves
 * the unit conversion in `resolveChargeInputs()` untested by any fixture.
 *
 * The STANDARD row is 12 per kg, matching the fallback `finance.ts` applies
 * when no caller passes a handling rate (`input.handlingRatePerKg ?? 12`).
 * They are the same number deliberately: if the card said 20 and the engine
 * defaulted to 12, every screen that does not pass the rate would quietly bill
 * something the tariff screen does not show. When the real extract lands, that
 * fallback should be replaced with a call to `handlingRateFor()` — it is the
 * one rate literal left in the domain outside this file.
 * ================================================================== */

export interface HandlingCharge {
  /** CMTS `CLASSID`. Null is the default row every unlisted class falls back to. */
  CLASSID: number | null;
  ABBREVATION: string;
  /** CMTS `UNIT` — 1 per kg, 2 per piece, 3 flat. */
  UNIT: ChargeUnitCode;
  /** CMTS `AMOUNT` — PKR per unit as quoted by `UNIT`. */
  AMOUNT: Amount;
  /** CMTS `CHARGESTYPE` */
  CHARGESTYPE: ChargesTypeCode;
  note: string;
}

export const HANDLING_CHARGES: HandlingCharge[] = [
  { CLASSID: null, ABBREVATION: "*", UNIT: 1, AMOUNT: 12, CHARGESTYPE: "Handling", note: "Default — matches the finance.ts fallback of 12/kg" },
  { CLASSID: 2, ABBREVATION: "AFU", UNIT: 2, AMOUNT: 500, CHARGESTYPE: "Handling", note: "Bulky cargo is handled by the piece, not by weight" },
  { CLASSID: 5, ABBREVATION: "DGR", UNIT: 1, AMOUNT: 25, CHARGESTYPE: "Handling", note: "Segregated store, certified handler" },
  { CLASSID: 6, ABBREVATION: "PER", UNIT: 1, AMOUNT: 20, CHARGESTYPE: "Handling", note: "Cold chain break-in / break-out" },
  { CLASSID: 7, ABBREVATION: "VAL", UNIT: 1, AMOUNT: 40, CHARGESTYPE: "Handling", note: "Dual-custody movement" },
  { CLASSID: 8, ABBREVATION: "AVI", UNIT: 2, AMOUNT: 1500, CHARGESTYPE: "Handling", note: "Per crate, veterinary supervision" },
  { CLASSID: 9, ABBREVATION: "HUM", UNIT: 3, AMOUNT: 0, CHARGESTYPE: "Handling", note: "Welfare — not charged" },
  { CLASSID: 10, ABBREVATION: "AOG", UNIT: 3, AMOUNT: 2500, CHARGESTYPE: "Handling", note: "Flat call-out fee, any weight" },
  { CLASSID: 11, ABBREVATION: "DIP", UNIT: 3, AMOUNT: 0, CHARGESTYPE: "Handling", note: "Sealed — not opened, not charged" },
  { CLASSID: 13, ABBREVATION: "PHR", UNIT: 1, AMOUNT: 20, CHARGESTYPE: "Handling", note: "GDP-compliant handling" },
];

export function handlingChargeRow(classId: number): HandlingCharge {
  return (
    HANDLING_CHARGES.find((h) => h.CLASSID === classId) ??
    HANDLING_CHARGES.find((h) => h.CLASSID === null)!
  );
}

/* ================================================================== *
 * LOCATIONCHARGES — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * The per-zone daily fee, banded by weight and by day exactly as CMTS bands it.
 * Keyed on `LOCATION.ABBREVATION` rather than `LOCATIONID` because the demo
 * instantiates every zone once per site, so the abbreviation is the stable
 * key and `./masters` fans these bands out across the three sites' location
 * IDs when it builds `LOCATION_CHARGES`.
 *
 * Every zone carries a row, including a zero one. An explicit zero says "this
 * zone has no separate fee — the day-band rate covers it", which is a
 * different and more useful statement than a missing row, and it is what stops
 * `zonesWithoutRate` on the derivation screen from reporting an absence that is
 * really a decision.
 *
 * All three units appear: flat per day for the sheds and hold zones, per kg
 * per day for the powered / secure zones, per piece per day for AOG. CDT-AREA
 * carries two DAY bands so a detention fee that escalates — and therefore a
 * stay that CROSSES a band boundary — is representable and testable.
 * ================================================================== */

export interface LocationChargeBand {
  /** `LOCATION.ABBREVATION` — the zone this band prices. */
  zoneAbbr: string;
  /** CMTS `WEIGHTFROM` */
  WEIGHTFROM: number;
  /** CMTS `WEIGHTTO` — null is open-ended. */
  WEIGHTTO: number | null;
  /** CMTS `DAYFROM` */
  DAYFROM: number;
  /** CMTS `DAYTO` — null is open-ended. */
  DAYTO: number | null;
  /** CMTS `UNIT` — 1 per kg, 2 per piece, 3 flat. */
  UNIT: ChargeUnitCode;
  /** CMTS `FLATERATE` bit. */
  FLATERATE: boolean;
  /** CMTS `AMOUNT` — PKR per unit per day. */
  AMOUNT: Amount;
  note: string;
}

export const LOCATION_CHARGE_BANDS: LocationChargeBand[] = [
  // --- open shed: no separate zone fee ------------------------------
  { zoneAbbr: "GCR-RACK", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 0, note: "Standard racking — covered by the day-band rate" },
  { zoneAbbr: "ICG-PRZ", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 0, note: "Priority staging — covered by the day-band rate" },
  { zoneAbbr: "UAB-AREA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 0, note: "Baggage area — no zone fee" },
  { zoneAbbr: "HUM-SHA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 0, note: "Welfare — never charged" },
  { zoneAbbr: "DIP-CAA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 0, note: "Diplomatic — never charged" },

  // --- heavy floor: flat, banded by weight --------------------------
  { zoneAbbr: "AFU-FLOOR", WEIGHTFROM: 0, WEIGHTTO: 5000, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 800, note: "Floor space up to 5 t" },
  { zoneAbbr: "AFU-FLOOR", WEIGHTFROM: 5000, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1500, note: "Floor space over 5 t" },

  // --- powered / secure zones: per kg per day -----------------------
  { zoneAbbr: "DGR-SEG", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 1, FLATERATE: false, AMOUNT: 5, note: "Segregated store, per kg per day" },
  { zoneAbbr: "PER-COLD", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 1, FLATERATE: false, AMOUNT: 10, note: "Powered cold chain, per kg per day" },
  { zoneAbbr: "PHR-STORE", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 1, FLATERATE: false, AMOUNT: 10, note: "GDP pharma store, per kg per day" },
  { zoneAbbr: "VAL-VAULT", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 2500, note: "Strong room, flat per day" },
  { zoneAbbr: "VUN-SEC", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1000, note: "Secure area, flat per day" },
  { zoneAbbr: "AVI-AREA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 2, FLATERATE: false, AMOUNT: 300, note: "Per crate per day, climate controlled" },
  { zoneAbbr: "AOG-PZ", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 2, FLATERATE: false, AMOUNT: 200, note: "Per piece per day, priority bay" },

  // --- hold zones: flat 1200/day ------------------------------------
  { zoneAbbr: "BND-STORE", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Bonded storage" },
  { zoneAbbr: "TRF-ZONE", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Transhipment bonded zone" },
  { zoneAbbr: "CDR-HOLD", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Discrepancy quarantine" },
  { zoneAbbr: "MSH-QTN", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Mishandled cargo hold" },
  { zoneAbbr: "REX-HOLD", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Awaiting re-export" },
  { zoneAbbr: "LST-AUC", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Section 82 pipeline" },

  // --- detention: escalates on day 15 -------------------------------
  { zoneAbbr: "CDT-AREA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 1, DAYTO: 14, UNIT: 3, FLATERATE: true, AMOUNT: 1200, note: "Customs detained, first fortnight" },
  { zoneAbbr: "CDT-AREA", WEIGHTFROM: 0, WEIGHTTO: null, DAYFROM: 15, DAYTO: null, UNIT: 3, FLATERATE: true, AMOUNT: 2000, note: "Customs detained, day 15 onward" },
];

export function locationBandsFor(zoneAbbr: string): LocationChargeBand[] {
  return LOCATION_CHARGE_BANDS.filter((b) => b.zoneAbbr === zoneAbbr);
}

/* ================================================================== *
 * TaxType — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * CMTS selects the godown-rent tax with
 *   `select t.Amount from TaxType t where t.IsDo = 0 and t.ChargesType like 'GD%'`
 * (CMTS_SCHEMA_AUDIT §3.5), so `IsDo` splits rent tax from delivery-order tax
 * and `ChargesType` selects within each. The card is written so that predicate
 * matches EXACTLY ONE row — a rate table where the production query returns two
 * rows or none is not a rate table, it is an outage.
 *
 * 15% and 4% are round and obviously illustrative. The real Pakistani rates are
 * not the point and are not claimed.
 * ================================================================== */

export interface IllustrativeTaxType {
  id: number;
  Description: string;
  /** CMTS `ChargesType` — the `GD%` prefix is what the rent query matches on. */
  ChargesType: string;
  /** Percentage. */
  Amount: number;
  /** CMTS `IsDo` — true = delivery-order tax, false = godown-rent tax. */
  IsDo: boolean;
  CityId: number | null;
}

export const ILLUSTRATIVE_TAX_TYPES: IllustrativeTaxType[] = [
  { id: 1, Description: "Sales Tax on Services", ChargesType: "GDRENT", Amount: 15, IsDo: false, CityId: null },
  { id: 2, Description: "Withholding Tax", ChargesType: "WHT", Amount: 4, IsDo: false, CityId: null },
  { id: 3, Description: "DO Processing Tax", ChargesType: "DOCHARGE", Amount: 15, IsDo: true, CityId: null },
];

/**
 * The rate the CMTS procedure would select, for each of the two families.
 * `"GR"` runs the documented predicate (`IsDo = 0 AND ChargesType LIKE 'GD%'`);
 * `"DO"` takes the delivery-order row. Throws rather than defaulting when the
 * predicate matches nothing — a silent fallback to 15% is how a demo ends up
 * showing a tax rate that no row in the card supports.
 */
export function taxPercentFor(family: "GR" | "DO"): number {
  const row =
    family === "DO"
      ? ILLUSTRATIVE_TAX_TYPES.find((t) => t.IsDo)
      : ILLUSTRATIVE_TAX_TYPES.find((t) => !t.IsDo && t.ChargesType.startsWith("GD"));
  if (!row) throw new Error(`Illustrative rate card has no ${family} tax row`);
  return row.Amount;
}

/* ================================================================== *
 * Category surcharges — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * FC-07 §07's percentage uplift on the storage component, by cargo class.
 * `finance.ts` reads these through `./masters` as `CATEGORY_SURCHARGES`.
 * Every percentage is a multiple of five, and the zero on HUM is deliberate —
 * the chip still appears on a welfare consignment, priced at nothing, rather
 * than the surcharge silently not existing.
 * ================================================================== */

export interface IllustrativeCategorySurcharge {
  code: string;
  label: string;
  /** Applies to these cargo class IDs. */
  classIds: number[];
  /** Percentage uplift on the storage component. */
  percent: number;
}

export const ILLUSTRATIVE_CATEGORY_SURCHARGES: IllustrativeCategorySurcharge[] = [
  { code: "DGR", label: "Dangerous goods", classIds: [5], percent: 40 },
  { code: "PER", label: "Perishable", classIds: [6], percent: 25 },
  { code: "VAL", label: "Valuable", classIds: [7], percent: 60 },
  { code: "AVI", label: "Live animals", classIds: [8], percent: 45 },
  { code: "AOG", label: "Aircraft on ground", classIds: [10], percent: 20 },
  { code: "HUM", label: "Human remains", classIds: [9], percent: 0 },
  { code: "COLD", label: "Cold chain", classIds: [6, 13], percent: 30 },
  { code: "VAULT", label: "Vault storage", classIds: [7], percent: 35 },
  { code: "SPECIAL", label: "Special handling", classIds: [11, 12], percent: 25 },
];

/* ================================================================== *
 * Section82Days — ILLUSTRATIVE. NOT SAPS DATA.
 *
 * CMTS stores this as a single row (`Id`, `Days`) — the statutory threshold
 * after which uncleared cargo enters the Section 82 disposal pipeline (FC-10
 * branch C). It is modelled as a row rather than a bare constant because that
 * is what it is in the source, and because the screen has to be able to say
 * "this came from a table SAPS has not filled in".
 *
 * 30 days is a ROUND PLACEHOLDER, and this is the value on the card most
 * likely to be mistaken for law: the real threshold is set by customs statute,
 * not by the terminal, and nobody on the build team has verified it.
 * ================================================================== */

export interface Section82DaysRow {
  Id: number;
  Days: number;
}

export const SECTION_82_DAYS_ROW: Section82DaysRow = { Id: 1, Days: 30 };

/* ================================================================== *
 * Lookup — DEMO-SEEDED, NOT MIGRATED.
 *
 * Per Q6 the key/value editor is built key-agnostic: the keys CMTS actually
 * uses are unknowable from an empty database, so nothing here claims to be
 * the real key set. These are the keys THIS DEMO needs to price a charge, each
 * marked demo-seeded, and the eventual import must tolerate keys it has never
 * seen rather than rejecting them.
 *
 * The five source columns are NOT reproduced by name. `Lookup` is one of the
 * tables whose column list the audit does not recover, and inventing five
 * uppercase names would fabricate parity that nobody could check — a worse
 * outcome than admitting the shape is ours. These field names are AirVault's.
 * ================================================================== */

export interface RateCardLookup {
  key: string;
  value: string;
  group: string;
  note: string;
  /** Never true in this card. Kept so a migrated row can be told apart on sight. */
  migrated: boolean;
}

export const RATE_CARD_LOOKUPS: RateCardLookup[] = [
  { key: "TARIFF.VERSION", value: RATE_CARD.id, group: "TARIFF", note: "Version stamped on every calculation", migrated: false },
  { key: "TARIFF.CURRENCY", value: "PKR", group: "TARIFF", note: "All amounts on this card", migrated: false },
  { key: "TARIFF.EFFECTIVE_FROM", value: RATE_CARD.effectiveFrom, group: "TARIFF", note: "Card effective date", migrated: false },
  { key: "CHARGE.DEFAULT_HANDLING_UNIT", value: CHARGE_UNIT_LABEL[1], group: "CHARGE", note: "Unit the default handling row is quoted on", migrated: false },
  { key: "CHARGE.VOLUMETRIC_DIVISOR", value: "6000", group: "CHARGE", note: "IATA volumetric divisor, cm³ per kg", migrated: false },
  { key: "CHARGE.ROUNDING", value: "2", group: "CHARGE", note: "Decimal places money is rounded to", migrated: false },
  { key: "SECTION82.DAYS", value: String(SECTION_82_DAYS_ROW.Days), group: "SECTION82", note: "Mirrors the Section82Days row", migrated: false },
  { key: "TAX.GR_PREDICATE", value: "IsDo = 0 AND ChargesType LIKE 'GD%'", group: "TAX", note: "The CMTS rent-tax selector, written down so it can be checked", migrated: false },
];

/* ================================================================== *
 * Q7 · Nonuseabel on CHARGETYPE — retired, and failing safe that way
 *
 * DECIDED (CMTS_SCOPE_DECISIONS.md §Q7, ticket 86eyn3nmq): a charge type
 * flagged `Nonuseabel` means RETIRED. The two failure directions are not
 * symmetric, which is what settles it — guessing "retired" when it is really
 * live drops a heading from new calculations, which is visible immediately and
 * fixed by flipping one flag; guessing "live" when it is really retired
 * silently re-activates billing SAPS stopped doing, and a customer finds it.
 *
 * The rule the implementation enforces (see `./masters`):
 *   • EXCLUDED from new calculations — `activeChargeTypes()`
 *   • STILL RENDERED on historical records, carrying a retired marker —
 *     `chargeType()` still resolves retired rows, and the records below
 *     exist so the behaviour is demonstrable rather than theoretical.
 *
 * A voucher raised while a type was live must keep showing what it was billed
 * under. Hiding the heading would not un-bill the money; it would only make
 * the money unexplainable.
 *
 * These usage records are ILLUSTRATIVE like everything else here — invented
 * vouchers under invented headings. They exist to prove the render path.
 * ================================================================== */

const NOW_MS = Date.parse(DEMO_NOW);

/** Same convention as the other fixtures: fixed offsets from `DEMO_NOW`. */
function daysAgo(n: number, hour = 10, minute = 30): string {
  const d = new Date(NOW_MS - n * MS_PER_DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export interface RetiredChargeTypeUsage {
  /** CMTS `GODOWNRENT.VOUCHERNO` — the historical voucher. */
  VOUCHERNO: string;
  /** CMTS `GODOWNRENT.GRDATE` — when it was raised. */
  GRDATE: string;
  /** CMTS `GODOWNRENT.AWBNO` */
  AWBNO: string;
  /** CMTS `CHARGETYPE.ChTypeAbb` — the heading it was billed under. */
  ChTypeAbb: string;
  /** CMTS `CHARGETYPE.ChTypeName` as it printed at the time. */
  ChTypeName: string;
  /** The amount that printed under that heading. */
  AMOUNT: Amount;
  site: SiteCode;
  /** Why this row is here — rendered next to the retired marker. */
  why: string;
}

/**
 * Historical vouchers billed under headings that are now retired.
 *
 * At least one row per retired heading in `CHARGE_TYPES`, so the "excluded
 * from new work, still shown on old work" rule has something to be true of.
 * Both were raised well before the demo's `DEMO_NOW`, which is the point: they
 * are the past, and the past does not get rewritten because a heading was
 * withdrawn afterwards.
 */
export const RETIRED_CHARGE_TYPE_USAGES: RetiredChargeTypeUsage[] = [
  {
    VOUCHERNO: "GRV-KHI-2024-004182",
    GRDATE: daysAgo(620),
    AWBNO: "607-44182055",
    ChTypeAbb: "MVF",
    ChTypeName: "Manual Voucher Fee",
    AMOUNT: 500,
    site: "KHI",
    why: "Raised while the heading was live. The fee was charged and collected; withdrawing the heading afterwards does not un-charge it, so the voucher must still be able to say what the 500 was for.",
  },
  {
    VOUCHERNO: "GRV-LHE-2025-001139",
    GRDATE: daysAgo(400),
    AWBNO: "618-90233417",
    ChTypeAbb: "AFUW",
    ChTypeName: "AFU Weight Surcharge",
    AMOUNT: 1200,
    site: "LHE",
    why: "Bulky-cargo weight surcharge, folded into the special-handling heading when it was withdrawn. A consignee querying this voucher is asking about a line that no longer exists on new bills.",
  },
];

export function retiredUsagesFor(abb: string): RetiredChargeTypeUsage[] {
  return RETIRED_CHARGE_TYPE_USAGES.filter((u) => u.ChTypeAbb === abb);
}

/* ================================================================== *
 * Resolution — turning the card into the arguments `calculateCharges` takes
 * ================================================================== */

/** One resolved input, with the row it came from and the arithmetic that got there. */
export interface ResolvedRate<TRow> {
  /** The value in the units `finance.ts` wants. */
  value: number;
  /** The card row it was read from. Null when the card has nothing to say. */
  row: TRow | null;
  /** Human-readable derivation — rendered next to the number, never re-parsed. */
  explanation: string;
}

export interface ResolvedChargeInputs {
  /** Echo of the key this was resolved for. */
  key: {
    classId: number;
    subClassId: number;
    zoneAbbr: string;
    weightKg: number;
    pieces: number;
    chargeableDays: number;
  };
  freeDays: number;
  /** The same number, re-derived the CMTS way. Equal by construction; shown to prove it. */
  freeDaysFromZeroBand: number;
  handlingRatePerKg: ResolvedRate<HandlingCharge>;
  locationChargePerDay: ResolvedRate<LocationChargeBand>;
  taxPercent: ResolvedRate<IllustrativeTaxType>;
  minimumCharge: Amount;
  documentationCharges: Amount;
  deconsolidationCharges: Amount;
  specialHandlingCharges: Amount;
  section82Days: number;
  /** The band set the CARD selects for this key — subclass and weight aware. */
  slabsSelected: RateCardSlab[];
  /** The band set the ENGINE will actually price on — `TARIFF_SLABS`, always. */
  slabsPriced: RateCardSlab[];
  /**
   * True when those two differ, i.e. the engine is about to bill this
   * consignment on a band set the card did not select for it. This is
   * CMTS_SCHEMA_AUDIT §3.2/§3.3 — per-subclass and per-weight rate selection
   * is unimplemented in `finance.ts`. Surfaced rather than smoothed over,
   * because a rate card that quietly disagrees with the engine pricing off it
   * is worse than no rate card.
   */
  enginePricesDifferently: boolean;
  /** True when the stay crosses a LOCATIONCHARGES day band the engine cannot express. */
  locationBandCrossed: boolean;
}

function pickLocationBand(
  zoneAbbr: string,
  weightKg: number,
  fromDay: number,
): LocationChargeBand | null {
  const bands = locationBandsFor(zoneAbbr).filter(
    (b) =>
      weightKg >= b.WEIGHTFROM &&
      (b.WEIGHTTO === null || weightKg <= b.WEIGHTTO) &&
      fromDay >= b.DAYFROM &&
      (b.DAYTO === null || fromDay <= b.DAYTO),
  );
  return bands[0] ?? null;
}

/**
 * Everything `calculateCharges()` needs, read off the card.
 *
 * The conversions matter. `finance.ts` accepts a handling rate PER KG and a
 * location charge PER DAY, and the card quotes some rows per piece and some
 * flat — so this is where a per-piece rate becomes an effective per-kg one,
 * and the arithmetic that did it is returned alongside the number rather than
 * disappearing into it. A screen showing "PKR 18.5/kg" with no way to see that
 * it came from "500 per piece × 3 pieces ÷ 81 kg" is how an operator loses the
 * ability to challenge a bill.
 *
 * Zero weight is guarded: converting a per-piece or flat rate to per-kg is
 * undefined at zero kg, so it resolves to zero with the reason stated instead
 * of returning Infinity into a money field.
 */
export function resolveChargeInputs(input: {
  classId: number;
  subClassId: number;
  zoneAbbr?: string;
  weightKg: number;
  pieces?: number;
  /** Chargeable days — used only to pick the location day band and report crossing. */
  chargeableDays?: number;
}): ResolvedChargeInputs {
  const assignment = rateAssignment(input.subClassId);
  const zoneAbbr = input.zoneAbbr ?? assignment.zoneAbbr;
  const pieces = input.pieces ?? 1;
  const weightKg = input.weightKg;
  const chargeableDays = input.chargeableDays ?? 0;
  const cls = classCharges(input.classId);

  /* --- handling: quoted per kg, per piece or flat ------------------ */
  const hRow = handlingChargeRow(input.classId);
  let handlingPerKg = 0;
  let handlingWhy = "";
  if (hRow.UNIT === 1) {
    handlingPerKg = hRow.AMOUNT;
    handlingWhy = `${formatPkr(hRow.AMOUNT)} per kg, applied as quoted`;
  } else if (weightKg <= 0) {
    handlingPerKg = 0;
    handlingWhy = `${formatPkr(hRow.AMOUNT)} ${CHARGE_UNIT_LABEL[hRow.UNIT]} cannot be expressed per kg at zero weight — resolved to 0`;
  } else if (hRow.UNIT === 2) {
    handlingPerKg = round2((hRow.AMOUNT * pieces) / weightKg);
    handlingWhy = `${formatPkr(hRow.AMOUNT)} per piece × ${pieces} ÷ ${weightKg} kg = ${handlingPerKg}/kg`;
  } else {
    handlingPerKg = round2(hRow.AMOUNT / weightKg);
    handlingWhy = `${formatPkr(hRow.AMOUNT)} flat ÷ ${weightKg} kg = ${handlingPerKg}/kg`;
  }

  /* --- location: per kg, per piece or flat, per DAY ---------------- */
  const lBand = pickLocationBand(zoneAbbr, weightKg, 1);
  let locationPerDay = 0;
  let locationWhy = "";
  if (!lBand) {
    locationWhy = `No LOCATIONCHARGES band on the card for zone ${zoneAbbr} — resolved to 0`;
  } else if (lBand.UNIT === 3) {
    locationPerDay = lBand.AMOUNT;
    locationWhy =
      lBand.AMOUNT === 0
        ? `Zone ${zoneAbbr} carries an explicit zero — no separate zone fee`
        : `${formatPkr(lBand.AMOUNT)} flat per day`;
  } else if (lBand.UNIT === 1) {
    locationPerDay = round2(lBand.AMOUNT * weightKg);
    locationWhy = `${formatPkr(lBand.AMOUNT)} per kg per day × ${weightKg} kg = ${locationPerDay}/day`;
  } else {
    locationPerDay = round2(lBand.AMOUNT * pieces);
    locationWhy = `${formatPkr(lBand.AMOUNT)} per piece per day × ${pieces} = ${locationPerDay}/day`;
  }

  const lastDayBand = chargeableDays > 0 ? pickLocationBand(zoneAbbr, weightKg, chargeableDays) : lBand;
  const locationBandCrossed = !!lBand && !!lastDayBand && lastDayBand !== lBand;

  /* --- tax --------------------------------------------------------- */
  const taxRow =
    ILLUSTRATIVE_TAX_TYPES.find((t) => !t.IsDo && t.ChargesType.startsWith("GD")) ?? null;

  /* --- slabs: what the card says vs what the engine will do -------- */
  const slabsSelected = slabsFor(input.subClassId, weightKg);
  const slabsPriced = STANDARD_DAY_BANDS;
  const enginePricesDifferently =
    JSON.stringify(slabsSelected.map((s) => [s.DAYFROM, s.DAYTO, s.ratePerKgPerDay])) !==
    JSON.stringify(slabsPriced.map((s) => [s.DAYFROM, s.DAYTO, s.ratePerKgPerDay]));

  return {
    key: {
      classId: input.classId,
      subClassId: input.subClassId,
      zoneAbbr,
      weightKg,
      pieces,
      chargeableDays,
    },
    freeDays: cls.FREEDAYS,
    freeDaysFromZeroBand: freeDaysFromZeroBand(input.subClassId, weightKg),
    handlingRatePerKg: { value: handlingPerKg, row: hRow, explanation: handlingWhy },
    locationChargePerDay: { value: locationPerDay, row: lBand, explanation: locationWhy },
    taxPercent: {
      value: taxRow?.Amount ?? 0,
      row: taxRow,
      explanation: taxRow
        ? `${taxRow.Description} ${taxRow.Amount}% — TaxType row ${taxRow.id}, selected by IsDo = 0 AND ChargesType LIKE 'GD%'`
        : "No TaxType row satisfies the CMTS rent-tax predicate",
    },
    minimumCharge: minimumChargeFor(input.subClassId),
    documentationCharges: cls.DOCUMENTATIONCHARGES,
    deconsolidationCharges: cls.DECONSOLIDATIONCHARGES,
    specialHandlingCharges: cls.SPECIALHANDLINGCHARGES,
    section82Days: SECTION_82_DAYS_ROW.Days,
    slabsSelected,
    slabsPriced,
    enginePricesDifferently,
    locationBandCrossed,
  };
}

/* ================================================================== *
 * Negotiated overrides — ILLUSTRATIVE. NOT SAPS DATA. NOT SAPS CONTRACTS.
 *
 * The multi-tariff layer: a rate agreed with a forwarding agent or a
 * consignee tier that displaces the published card for matching consignments.
 * CMTS has no table for this — it is the One-Window Vision delta, outside the
 * awarded contract scope, which is why the engine screen carries a second
 * notice saying so on top of the illustrative one.
 *
 * TWO WARNINGS, NOT ONE, AND THEY ARE DIFFERENT WARNINGS. The rates are
 * invented (as everywhere in this file); the CONTRACTS are invented too. The
 * agent names below are real freight forwarders and the contracts attributed
 * to them do not exist — nothing here reflects any commercial arrangement
 * between SAPS and any named company, and none of these terms has been offered
 * to, discussed with or agreed by anyone.
 *
 * Rates are per chargeable kg per day, whole numbers, sitting either side of
 * the STANDARD profile so both directions of override are demonstrable.
 * ================================================================== */

export type OverrideStatus = "active" | "draft" | "pending" | "retired";

export interface TariffOverride {
  id: number;
  name: string;
  /** The agent or direct contract this rate hangs off. Invented. */
  contract: string;
  /** Consignee tier the override applies to. */
  tier: "Standard" | "Preferred" | "Strategic" | "Government" | "Special Approval";
  /** Route, as `ORIGIN-DESTINATION`. */
  route: string;
  /** Cargo class the override prices. */
  CLASSID: number;
  ABBREVATION: string;
  /** PKR per chargeable kg per day, replacing the card's first chargeable band. */
  ratePerKgPerDay: Amount;
  status: OverrideStatus;
  approvalRequired: boolean;
  approvedBy: string | null;
  requestedBy: string;
  effectiveFrom: string;
  effectiveTo: string;
  note: string;
}

export const ILLUSTRATIVE_TARIFF_OVERRIDES: TariffOverride[] = [
  { id: 1, name: "Forwarder A — premium cold chain", contract: "Forwarder A 2026", tier: "Preferred", route: "DXB-KHI", CLASSID: 6, ABBREVATION: "PER", ratePerKgPerDay: 45, status: "active", approvalRequired: true, approvedBy: "F. Ahmed", requestedBy: "S. Khan", effectiveFrom: "2026-06-01", effectiveTo: "2027-05-31", note: "Below the COLD profile — volume commitment" },
  { id: 2, name: "Forwarder B — DG tier A", contract: "Forwarder B Tier A", tier: "Strategic", route: "DOH-KHI", CLASSID: 5, ABBREVATION: "DGR", ratePerKgPerDay: 60, status: "active", approvalRequired: true, approvedBy: "F. Ahmed", requestedBy: "I. Ali", effectiveFrom: "2026-06-01", effectiveTo: "2026-12-31", note: "Above the SPECIAL profile — segregated capacity reserved" },
  { id: 3, name: "Walk-in general import", contract: "Walk-in", tier: "Standard", route: "IST-KHI", CLASSID: 1, ABBREVATION: "GCR", ratePerKgPerDay: 35, status: "active", approvalRequired: false, approvedBy: null, requestedBy: "A. Khan", effectiveFrom: "2026-06-01", effectiveTo: "2026-08-31", note: "Matches the published STANDARD band — no commercial effect" },
  { id: 4, name: "Government pharma exemption", contract: "Government direct", tier: "Government", route: "DXB-KHI", CLASSID: 13, ABBREVATION: "PHR", ratePerKgPerDay: 0, status: "active", approvalRequired: true, approvedBy: "F. Ahmed", requestedBy: "I. Ali", effectiveFrom: "2026-06-01", effectiveTo: "2027-05-31", note: "Zero-rated storage — exercises the free branch end to end" },
  { id: 5, name: "AOG priority project", contract: "Project NDA", tier: "Special Approval", route: "DOH-KHI", CLASSID: 10, ABBREVATION: "AOG", ratePerKgPerDay: 100, status: "pending", approvalRequired: true, approvedBy: null, requestedBy: "A. Khan", effectiveFrom: "2026-07-01", effectiveTo: "2026-09-30", note: "Awaiting rate board — not applied while pending" },
  { id: 6, name: "Forwarder A — bulky floor", contract: "Forwarder A 2026", tier: "Preferred", route: "JED-KHI", CLASSID: 2, ABBREVATION: "AFU", ratePerKgPerDay: 30, status: "draft", approvalRequired: false, approvedBy: null, requestedBy: "S. Khan", effectiveFrom: "2026-09-01", effectiveTo: "2026-12-31", note: "Draft — not applied" },
  { id: 7, name: "Forwarder B — 2025 general", contract: "Forwarder B 2025", tier: "Preferred", route: "DXB-KHI", CLASSID: 1, ABBREVATION: "GCR", ratePerKgPerDay: 30, status: "retired", approvalRequired: true, approvedBy: "F. Ahmed", requestedBy: "I. Ali", effectiveFrom: "2025-01-01", effectiveTo: "2026-05-31", note: "Superseded — still listed so an old invoice can be explained" },
];

/**
 * Which override, if any, prices this consignment — and why.
 *
 * ONLY `active` OVERRIDES APPLY. Draft, pending and retired ones are listed on
 * the screen and never priced: a rate awaiting approval that quietly starts
 * billing is the same class of defect as a retired charge type that quietly
 * starts billing (see Q7), and it fails in the same silent direction. The
 * reason string is returned rather than logged because the screen has to be
 * able to answer "why did this consignment get that rate?" without anyone
 * reading code.
 */
export function resolveOverride(input: {
  classId: number;
  contract?: string | null;
  tier?: string | null;
  route?: string | null;
}): { override: TariffOverride | null; reason: string; rejected: TariffOverride[] } {
  const candidates = ILLUSTRATIVE_TARIFF_OVERRIDES.filter((o) => o.CLASSID === input.classId);
  const matching = candidates.filter(
    (o) =>
      (!input.contract || o.contract === input.contract) &&
      (!input.tier || o.tier === input.tier) &&
      (!input.route || o.route === input.route),
  );
  const active = matching.filter((o) => o.status === "active");
  const rejected = matching.filter((o) => o.status !== "active");

  if (active.length === 0) {
    return {
      override: null,
      reason:
        rejected.length > 0
          ? `No active override — ${rejected.length} match the key but are ${[...new Set(rejected.map((o) => o.status))].join(" / ")}. The published card applies.`
          : "No override matches this key. The published card applies.",
      rejected,
    };
  }
  // Lowest rate wins where several apply: a consignment covered by two agreed
  // rates gets the one that was agreed in its favour, and the alternative is
  // shown rather than silently discarded.
  const winner = [...active].sort((a, b) => a.ratePerKgPerDay - b.ratePerKgPerDay)[0];
  return {
    override: winner,
    reason:
      active.length > 1
        ? `${active.length} active overrides match; the lowest agreed rate wins (${winner.name}).`
        : `${winner.name} — ${winner.contract}, ${winner.tier} tier, ${winner.route}.`,
    rejected: [...rejected, ...active.filter((o) => o !== winner)],
  };
}

/**
 * What an override charges for storage, against what the published card would
 * have charged.
 *
 * The arithmetic lives here rather than in the screen for the same reason
 * every other number does: a component that multiplies a rate by days is a
 * second charge engine, and two charge engines eventually disagree. The screen
 * renders `amount` and `explanation`; it does not compute either.
 *
 * An override replaces the whole chargeable period at one flat per-kg-per-day
 * rate — that is what "we agreed 45 a kg a day" means commercially. It does
 * NOT re-band the stay, which is why the delta against the banded card can go
 * either way and is reported rather than assumed.
 */
export function overrideStorage(
  o: TariffOverride,
  chargeableDays: number,
  chargeableKg: number,
): { amount: Amount; explanation: string } {
  const amount = round2(o.ratePerKgPerDay * chargeableDays * chargeableKg);
  return {
    amount,
    explanation: `${formatPkr(o.ratePerKgPerDay)}/kg/day × ${chargeableDays} chargeable day${
      chargeableDays === 1 ? "" : "s"
    } × ${chargeableKg} kg — flat across the whole period, not re-banded`,
  };
}

/* ================================================================== *
 * Self-checks — the card auditing itself
 * ================================================================== */

export interface RateCardFinding {
  severity: "ok" | "warn" | "error";
  code: string;
  message: string;
}

/**
 * Does the card price everything the master data contains, and nothing it does
 * not? Takes the subclass list as an argument rather than importing it, so this
 * file stays a leaf and `./masters` can keep importing this one.
 *
 * Rendered on the tariff screen. A subclass with no rate row is a real hole in
 * a rate card, and the screen that maintains the card is the right place to
 * find out — not a runtime throw in front of a client.
 */
export function checkRateCardCoverage(
  subclasses: ReadonlyArray<{ SUBCLASSID: number; CLASSID: number }>,
  classes: ReadonlyArray<{ ID: number }>,
): RateCardFinding[] {
  const findings: RateCardFinding[] = [];

  const rated = new Set(SUBCLASS_RATE_ASSIGNMENTS.map((a) => a.SUBCLASSID));
  const known = new Set(subclasses.map((s) => s.SUBCLASSID));

  for (const s of subclasses) {
    if (!rated.has(s.SUBCLASSID)) {
      findings.push({
        severity: "error",
        code: "SUBCLASS-UNPRICED",
        message: `SUBCLASSID ${s.SUBCLASSID} exists in the subclass master but has no rate row on the card.`,
      });
    }
  }
  for (const a of SUBCLASS_RATE_ASSIGNMENTS) {
    if (!known.has(a.SUBCLASSID)) {
      findings.push({
        severity: "warn",
        code: "RATE-ORPHANED",
        message: `The card prices SUBCLASSID ${a.SUBCLASSID} (${a.ABBREVATION}), which no longer exists in the subclass master.`,
      });
    }
  }

  const charged = new Set(CARGO_CLASS_CHARGES.map((c) => c.CLASSID));
  for (const c of classes) {
    if (!charged.has(c.ID)) {
      findings.push({
        severity: "error",
        code: "CLASS-UNPRICED",
        message: `CLASSID ${c.ID} has no CargoClassCharges row on the card.`,
      });
    }
  }

  // The free-day agreement that everything else assumes.
  for (const a of SUBCLASS_RATE_ASSIGNMENTS) {
    const declared = classCharges(a.CLASSID).FREEDAYS;
    const derived = freeDaysFromZeroBand(a.SUBCLASSID, 0);
    if (declared !== derived) {
      findings.push({
        severity: "error",
        code: "FREEDAYS-DISAGREE",
        message: `${a.ABBREVATION}: CargoClassCharges says ${declared} free days, the zero-amount rate band says ${derived}.`,
      });
    }
  }

  // Exactly one row must satisfy the CMTS rent-tax predicate.
  const grMatches = ILLUSTRATIVE_TAX_TYPES.filter(
    (t) => !t.IsDo && t.ChargesType.startsWith("GD"),
  ).length;
  if (grMatches !== 1) {
    findings.push({
      severity: "error",
      code: "TAX-PREDICATE",
      message: `IsDo = 0 AND ChargesType LIKE 'GD%' matches ${grMatches} rows. The CMTS procedure expects exactly one.`,
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: "ok",
      code: "COVERAGE",
      message: `Every one of the ${subclasses.length} subclasses and ${classes.length} classes is priced, free days agree with the zero-amount bands, and the rent-tax predicate selects exactly one row.`,
    });
  }
  return findings;
}
