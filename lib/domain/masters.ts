/**
 * AirVault domain — master data.
 *
 * Sources:
 *   Sites / org        CMTS `City`, `CCompany`, `COffice`
 *   Airlines/airports  CMTS `AIRLINE` (19), `AIRPORT` (16), `Flight_Airport` (6)
 *   Cargo taxonomy     CMTS `CARGOCLASS` (16), `CARGOSUBCLASS` (17)
 *   Storage            CMTS `LOCATION` (17), `CARGOSUBCLASSLOCATION` (4)
 *   Charges            CMTS `CARGOSUBCLASSCHARGES` (15), `LOCATIONCHARGES` (10),
 *                      `CargoClassCharges` (7), `TaxType` (12), `CHARGETYPE` (7)
 *   Parties            CMTS `SHIPPER` (11), `CONSIGNEE` (13), `AGENCY` (11)
 *
 * The cargo taxonomy below is FC-03's three groups verbatim.
 *
 * WHERE THE MONEY LIVES — AND WHY IT IS NOT HERE
 * ----------------------------------------------
 * This file holds IDENTITY: what a cargo class is, which zone exists at which
 * site, who the parties are. Every RATE it publishes — `TARIFF_SLABS`,
 * `TAX_TYPES`, `LOCATION_CHARGES`, `CATEGORY_SURCHARGES`, `SECTION_82_DAYS`,
 * the per-class charge columns and the per-subclass `MINCHARGES` floor — is
 * DERIVED from `./tariff`, which is the illustrative rate card standing in for
 * the six CMTS rate tables SAPS restored empty.
 *
 * The exported names and shapes are unchanged, so `./finance` and every screen
 * read exactly what they always read. What changed is that there is now one
 * place a number can be edited. Do not paste a rate back into this file: two
 * homes for a rate is how a screen and an invoice come to disagree, and the
 * whole point of the decision in `CMTS_SCOPE_DECISIONS.md` is that swapping in
 * SAPS's real extract should be a data change in one file with no code change
 * anywhere.
 */

import type { Amount, DomainRecord, Site, SiteCode } from "./common";
import {
  ILLUSTRATIVE_CATEGORY_SURCHARGES,
  ILLUSTRATIVE_TAX_TYPES,
  LOCATION_CHARGE_BANDS,
  SECTION_82_DAYS_ROW,
  STANDARD_DAY_BANDS,
  classCharges,
  minimumChargeFor,
} from "./tariff";

/* ================================================================== *
 * Sites — FC-12 platform layer
 * ================================================================== */

export const SITES: Site[] = [
  {
    code: "KHI",
    name: "Karachi — Jinnah International",
    city: "Karachi",
    airportCode: "KHI",
    CityId: 1,
    Comp_Code: 1,
    Off_Code: 1,
    offlineCapable: true,
    lastSyncAt: "2026-08-03T14:28:00+05:00",
    pendingOutbox: 0,
  },
  {
    code: "LHE",
    name: "Lahore — Allama Iqbal International",
    city: "Lahore",
    airportCode: "LHE",
    CityId: 2,
    Comp_Code: 1,
    Off_Code: 2,
    offlineCapable: true,
    lastSyncAt: "2026-08-03T14:26:00+05:00",
    pendingOutbox: 3,
  },
  {
    code: "PEW",
    name: "Peshawar — Bacha Khan International",
    city: "Peshawar",
    airportCode: "PEW",
    CityId: 3,
    Comp_Code: 1,
    Off_Code: 3,
    offlineCapable: true,
    // Deliberately stale — gives the HQ console something real to surface.
    lastSyncAt: "2026-08-03T11:04:00+05:00",
    pendingOutbox: 17,
  },
];

export const HQ = {
  name: "Islamabad HQ",
  city: "Islamabad",
  /** FC-12: HQ creates sites + site-admins; each site-admin manages its own users. */
  role: "cross-site oversight, RBAC control, backups, CDC/outbox sync",
} as const;

export function site(code: SiteCode): Site {
  const s = SITES.find((x) => x.code === code);
  if (!s) throw new Error(`Unknown site: ${code}`);
  return s;
}

/* ================================================================== *
 * Cargo taxonomy — FC-03
 * ================================================================== */

/** FC-03's three top-level groups. */
export type CargoGroup = "general" | "special" | "controlled";

export const CARGO_GROUP_LABEL: Record<CargoGroup, string> = {
  general: "A. General / Normal",
  special: "B. Special Handling",
  controlled: "C. Controlled / Exception",
};

/** CMTS `CARGOCLASS` */
export interface CargoClass {
  /** CMTS `CARGOCLASS.ID` */
  ID: number;
  /** CMTS `NAME` */
  NAME: string;
  /** CMTS `DESCRIPTION` */
  DESCRIPTION: string;
  /** CMTS `ABBREVATION` */
  ABBREVATION: string;
  /** CMTS `DOCUMENTATIONCHARGES` */
  DOCUMENTATIONCHARGES: Amount;
  /** CMTS `DECONSOLIDATIONCHARGES` */
  DECONSOLIDATIONCHARGES: Amount;
  /** CMTS `SPECIALHANDLINGCHARGES` */
  SPECIALHANDLINGCHARGES: Amount;
  /** FC-03 group. CMTS models this via `CargoClassGroupwise`. */
  group: CargoGroup;
  /** Free days before demurrage accrues (FC-07 §02). */
  freeDays: number;
  /** Does this class require a special-clearance step? (FC-07 DO gate condition 5) */
  requiresSpecialClearance: boolean;
}

/**
 * The class taxonomy — IDENTITY ONLY.
 *
 * The four money / allowance columns (`DOCUMENTATIONCHARGES`,
 * `DECONSOLIDATIONCHARGES`, `SPECIALHANDLINGCHARGES` and `freeDays`) are
 * deliberately absent here. They are joined on below from `CargoClassCharges`
 * in `./tariff` — the illustrative rate card standing in for the empty CMTS
 * rate tables. Splitting the row this way is what makes the eventual SAPS
 * extract a data swap: the taxonomy stays, the numbers are replaced in one
 * file, and no screen changes.
 */
const CARGO_CLASS_IDENTITY: Array<
  Omit<
    CargoClass,
    "DOCUMENTATIONCHARGES" | "DECONSOLIDATIONCHARGES" | "SPECIALHANDLINGCHARGES" | "freeDays"
  >
> = [
  // --- FC-03 A. General / Normal ------------------------------------
  { ID: 1, NAME: "General Cargo", DESCRIPTION: "Standard dry cargo", ABBREVATION: "GCR", group: "general", requiresSpecialClearance: false },
  { ID: 2, NAME: "Bulky Cargo", DESCRIPTION: "Air freight unit / oversized", ABBREVATION: "AFU", group: "general", requiresSpecialClearance: false },
  { ID: 3, NAME: "Immediate Clearance Goods", DESCRIPTION: "Priority release", ABBREVATION: "ICG", group: "general", requiresSpecialClearance: false },
  { ID: 4, NAME: "Unaccompanied Baggage", DESCRIPTION: "Passenger baggage shipped separately", ABBREVATION: "UAB", group: "general", requiresSpecialClearance: false },

  // --- FC-03 B. Special Handling ------------------------------------
  { ID: 5, NAME: "Dangerous Goods", DESCRIPTION: "IATA DGR-regulated", ABBREVATION: "DGR", group: "special", requiresSpecialClearance: true },
  { ID: 6, NAME: "Perishables", DESCRIPTION: "Temperature-sensitive", ABBREVATION: "PER", group: "special", requiresSpecialClearance: true },
  { ID: 7, NAME: "Valuable Cargo", DESCRIPTION: "High-value / bullion", ABBREVATION: "VAL", group: "special", requiresSpecialClearance: true },
  { ID: 8, NAME: "Live Animals", DESCRIPTION: "IATA LAR-regulated", ABBREVATION: "AVI", group: "special", requiresSpecialClearance: true },
  { ID: 9, NAME: "Human Remains", DESCRIPTION: "Repatriation", ABBREVATION: "HUM", group: "special", requiresSpecialClearance: true },
  { ID: 10, NAME: "Aircraft on Ground Spares", DESCRIPTION: "AOG priority spares", ABBREVATION: "AOG", group: "special", requiresSpecialClearance: false },
  { ID: 11, NAME: "Diplomatic Cargo", DESCRIPTION: "Diplomatic bag / mission cargo", ABBREVATION: "DIP", group: "special", requiresSpecialClearance: true },
  { ID: 12, NAME: "Vulnerable Cargo", DESCRIPTION: "High-risk / theft-prone", ABBREVATION: "VUN", group: "special", requiresSpecialClearance: true },
  { ID: 13, NAME: "Pharmaceuticals", DESCRIPTION: "GDP-compliant pharma", ABBREVATION: "PHR", group: "special", requiresSpecialClearance: true },

  // --- FC-03 C. Controlled / Exception ------------------------------
  { ID: 14, NAME: "Airline Bonded Cargo", DESCRIPTION: "Under airline bond", ABBREVATION: "BND", group: "controlled", requiresSpecialClearance: true },
  { ID: 15, NAME: "Transfer Cargo", DESCRIPTION: "Transhipment / transit", ABBREVATION: "TRF", group: "controlled", requiresSpecialClearance: true },
  { ID: 16, NAME: "Customs Hold", DESCRIPTION: "Detained by customs", ABBREVATION: "CDT", group: "controlled", requiresSpecialClearance: true },
  { ID: 17, NAME: "Discrepancy Cargo", DESCRIPTION: "CDR / OSD hold", ABBREVATION: "CDR", group: "controlled", requiresSpecialClearance: true },
  { ID: 18, NAME: "Mishandled Cargo", DESCRIPTION: "Misrouted / offloaded in error", ABBREVATION: "MSH", group: "controlled", requiresSpecialClearance: true },
  { ID: 19, NAME: "Re-export Cargo", DESCRIPTION: "Awaiting re-export", ABBREVATION: "REX", group: "controlled", requiresSpecialClearance: true },
  { ID: 20, NAME: "Long-stay Cargo", DESCRIPTION: "Section 82 / auction / disposal", ABBREVATION: "LST", group: "controlled", requiresSpecialClearance: true },
];

/**
 * Identity joined to the rate card. `classCharges()` throws on a class the
 * card does not price, which is the right failure: a cargo class with no fees
 * would otherwise bill zero and look deliberate.
 */
export const CARGO_CLASSES: CargoClass[] = CARGO_CLASS_IDENTITY.map((c) => {
  const rates = classCharges(c.ID);
  return {
    ...c,
    DOCUMENTATIONCHARGES: rates.DOCUMENTATIONCHARGES,
    DECONSOLIDATIONCHARGES: rates.DECONSOLIDATIONCHARGES,
    SPECIALHANDLINGCHARGES: rates.SPECIALHANDLINGCHARGES,
    freeDays: rates.FREEDAYS,
  };
});

/** CMTS `CARGOSUBCLASS` */
export interface CargoSubClass {
  /** CMTS `SUBCLASSID` */
  SUBCLASSID: number;
  /** CMTS `CLASSID` */
  CLASSID: number;
  NAME: string;
  DESCRIPTION: string;
  ABBREVATION: string;
  /**
   * CMTS `MINCHARGES` float — the minimum chargeable amount for the subclass.
   * It is a floor, not a line item: FC-07 bills the computed storage total or
   * this, whichever is greater, which is why a zero here (HUM, DIP, and the
   * customs-held subclasses) means "no floor", not "free".
   */
  MINCHARGES: Amount;
  /** CMTS `Authority` */
  Authority: string | null;
  /** CMTS `Remarks` */
  Remarks: string | null;
  /** Temperature band, where the subclass is a cold-chain regime (FC-03 B). */
  tempBandC?: [number, number];
}

/**
 * Subclass identity — everything except the money.
 *
 * `MINCHARGES` is joined on from `./tariff` for the same reason the class fees
 * are: it is a rate, and rates have exactly one home. See the note at the top
 * of this file.
 */
const CARGO_SUBCLASS_IDENTITY: Array<Omit<CargoSubClass, "MINCHARGES">> = [
  // GCR
  { SUBCLASSID: 101, CLASSID: 1, NAME: "General — Palletised", DESCRIPTION: "Palletised dry cargo", ABBREVATION: "GCR-P", Authority: null, Remarks: null },
  { SUBCLASSID: 102, CLASSID: 1, NAME: "General — Loose", DESCRIPTION: "Loose dry cargo", ABBREVATION: "GCR-L", Authority: null, Remarks: null },
  // AFU
  { SUBCLASSID: 103, CLASSID: 2, NAME: "Bulky — Heavy Lift", DESCRIPTION: "Requires forklift / crane", ABBREVATION: "AFU-H", Authority: "Warehouse Manager", Remarks: "Forklift charges apply" },
  { SUBCLASSID: 104, CLASSID: 2, NAME: "Bulky — Oversize", DESCRIPTION: "Exceeds standard rack envelope", ABBREVATION: "AFU-O", Authority: "Warehouse Manager", Remarks: null },
  // ICG
  { SUBCLASSID: 105, CLASSID: 3, NAME: "Immediate Clearance", DESCRIPTION: "Priority release goods", ABBREVATION: "ICG", Authority: null, Remarks: null },
  // UAB
  { SUBCLASSID: 106, CLASSID: 4, NAME: "Unaccompanied Baggage", DESCRIPTION: "Passenger baggage", ABBREVATION: "UAB", Authority: null, Remarks: null },
  // DGR
  { SUBCLASSID: 107, CLASSID: 5, NAME: "DGR — Class 3 Flammable", DESCRIPTION: "Flammable liquids", ABBREVATION: "DGR-3", Authority: "DGR Certified Officer", Remarks: "Segregated store only" },
  { SUBCLASSID: 108, CLASSID: 5, NAME: "DGR — Class 8 Corrosive", DESCRIPTION: "Corrosive substances", ABBREVATION: "DGR-8", Authority: "DGR Certified Officer", Remarks: "Segregated store only" },
  { SUBCLASSID: 109, CLASSID: 5, NAME: "DGR — Class 9 Misc", DESCRIPTION: "Lithium batteries etc.", ABBREVATION: "DGR-9", Authority: "DGR Certified Officer", Remarks: null },
  // PER — FC-03 B lists four cold-chain regimes under Cold Chain Storage
  { SUBCLASSID: 110, CLASSID: 6, NAME: "COL — Cool Room", DESCRIPTION: "Cool room +2 to +8 C", ABBREVATION: "COL", Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 8] },
  { SUBCLASSID: 111, CLASSID: 6, NAME: "CRT — Controlled Room Temp", DESCRIPTION: "Controlled room temperature +15 to +25 C", ABBREVATION: "CRT", Authority: "Cold Chain Officer", Remarks: null, tempBandC: [15, 25] },
  { SUBCLASSID: 112, CLASSID: 6, NAME: "ERT — Extended Room Temp", DESCRIPTION: "Extended room temperature +2 to +25 C", ABBREVATION: "ERT", Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 25] },
  { SUBCLASSID: 113, CLASSID: 6, NAME: "FRO — Frozen Room", DESCRIPTION: "Frozen -20 to -15 C", ABBREVATION: "FRO", Authority: "Cold Chain Officer", Remarks: null, tempBandC: [-20, -15] },
  // VAL / AVI / HUM / AOG / DIP / VUN / PHR
  { SUBCLASSID: 114, CLASSID: 7, NAME: "Valuable — Vault", DESCRIPTION: "Strong room storage", ABBREVATION: "VAL-V", Authority: "Security Manager", Remarks: "Dual custody required" },
  { SUBCLASSID: 115, CLASSID: 8, NAME: "Live Animals", DESCRIPTION: "Climate-controlled animal area", ABBREVATION: "AVI", Authority: "Veterinary Officer", Remarks: null, tempBandC: [15, 25] },
  { SUBCLASSID: 116, CLASSID: 9, NAME: "Human Remains", DESCRIPTION: "Special handling area", ABBREVATION: "HUM", Authority: "Duty Manager", Remarks: "No charge — welfare" },
  { SUBCLASSID: 117, CLASSID: 10, NAME: "AOG Spares", DESCRIPTION: "Priority AOG zone", ABBREVATION: "AOG", Authority: null, Remarks: null },
  { SUBCLASSID: 118, CLASSID: 11, NAME: "Diplomatic", DESCRIPTION: "Controlled access area", ABBREVATION: "DIP", Authority: "Duty Manager", Remarks: "Sealed — not to be opened" },
  { SUBCLASSID: 119, CLASSID: 12, NAME: "Vulnerable", DESCRIPTION: "Secure / high-risk area", ABBREVATION: "VUN", Authority: "Security Manager", Remarks: null },
  { SUBCLASSID: 120, CLASSID: 13, NAME: "Pharma — GDP", DESCRIPTION: "GDP-compliant pharma storage", ABBREVATION: "PHR", Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 8] },
  // Controlled / exception
  { SUBCLASSID: 121, CLASSID: 14, NAME: "Airline Bonded", DESCRIPTION: "Bonded storage", ABBREVATION: "BND", Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 122, CLASSID: 15, NAME: "Transhipment", DESCRIPTION: "Bonded transhipment zone", ABBREVATION: "TRF", Authority: "Customs Officer", Remarks: "Does not enter local consumption" },
  { SUBCLASSID: 123, CLASSID: 16, NAME: "Customs Detained", DESCRIPTION: "Customs detained area", ABBREVATION: "CDT", Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 124, CLASSID: 17, NAME: "CDR / OSD Hold", DESCRIPTION: "Discrepancy hold", ABBREVATION: "CDR", Authority: "Duty Manager", Remarks: null },
  { SUBCLASSID: 125, CLASSID: 18, NAME: "Exception / Quarantine", DESCRIPTION: "Mishandled cargo hold", ABBREVATION: "MSH", Authority: "Duty Manager", Remarks: null },
  { SUBCLASSID: 126, CLASSID: 19, NAME: "Re-export Holding", DESCRIPTION: "Awaiting re-export", ABBREVATION: "REX", Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 127, CLASSID: 20, NAME: "Auction / Disposal", DESCRIPTION: "Section 82 pipeline", ABBREVATION: "LST", Authority: "Customs Officer", Remarks: null },
];

export const CARGO_SUBCLASSES: CargoSubClass[] = CARGO_SUBCLASS_IDENTITY.map((s) => ({
  ...s,
  MINCHARGES: minimumChargeFor(s.SUBCLASSID),
}));

/* ================================================================== *
 * Storage locations — FC-03 zone targets
 * ================================================================== */

/** CMTS `LOCATION` */
export interface StorageLocation {
  /** CMTS `LOCATION.ID` */
  ID: number;
  /** CMTS `CLASSID` */
  CLASSID: number;
  NAME: string;
  ABBREVATION: string;
  DESCRIPTION: string;
  Authority: string | null;
  /**
   * CMTS `LOCATION.Remarks` nvarchar(500) — the zone's standing handling note.
   *
   * Spelled mixed-case because that is how the source spells it. This field
   * previously read `REMARKS`, changed on the stated grounds that "LOCATION
   * spells it REMARKS in the source schema". That claim was wrong, and checking
   * it is one query: across the 105 CMTS tables the column appears sixteen
   * times, nine uppercase (AWBINFORMATION, HOLDINGSTATUS, INTERNATIONALCARGO …)
   * and seven mixed-case — and LOCATION is in the second group, `nvarchar(500)`,
   * the very type the old comment cited. Right column, wrong casing.
   *
   * The casing genuinely does carry meaning here, which is exactly why it has to
   * be measured against the OWNING table rather than against whether the
   * uppercase form exists somewhere in the schema. It does exist — nine times —
   * just never on this table.
   */
  Remarks: string | null;
  /** Capacity in chargeable kg — the allocation engine checks against this. */
  capacityKg: number;
  /** Currently occupied, kg. */
  occupiedKg: number;
  site: SiteCode;
  /** Is this an exception / hold zone (FC-03 group C)? */
  isHoldZone: boolean;
  tempBandC?: [number, number];
}

/** Zone names taken from FC-03's right-hand column. */
const ZONE_DEFS: Array<Omit<StorageLocation, "ID" | "site" | "occupiedKg">> = [
  { CLASSID: 1, NAME: "Normal Warehouse Racks", ABBREVATION: "GCR-RACK", DESCRIPTION: "Standard racking, 3 levels", Authority: null, Remarks: null, capacityKg: 120000, isHoldZone: false },
  { CLASSID: 2, NAME: "Heavy Cargo Floor", ABBREVATION: "AFU-FLOOR", DESCRIPTION: "Ground-level heavy lift area", Authority: "Warehouse Manager", Remarks: null, capacityKg: 80000, isHoldZone: false },
  { CLASSID: 3, NAME: "Priority Release Zone", ABBREVATION: "ICG-PRZ", DESCRIPTION: "Fast-turnaround staging", Authority: null, Remarks: null, capacityKg: 25000, isHoldZone: false },
  { CLASSID: 4, NAME: "UAB Area", ABBREVATION: "UAB-AREA", DESCRIPTION: "Unaccompanied baggage", Authority: null, Remarks: null, capacityKg: 15000, isHoldZone: false },
  { CLASSID: 5, NAME: "Segregated Store", ABBREVATION: "DGR-SEG", DESCRIPTION: "DGR segregated store", Authority: "DGR Certified Officer", Remarks: "IATA segregation table applies", capacityKg: 18000, isHoldZone: false },
  { CLASSID: 6, NAME: "Cold Chain Storage", ABBREVATION: "PER-COLD", DESCRIPTION: "Multi-regime cold chain", Authority: "Cold Chain Officer", Remarks: null, capacityKg: 30000, isHoldZone: false, tempBandC: [-20, 25] },
  { CLASSID: 7, NAME: "Vault / Strong Room", ABBREVATION: "VAL-VAULT", DESCRIPTION: "Dual-custody strong room", Authority: "Security Manager", Remarks: null, capacityKg: 4000, isHoldZone: false },
  { CLASSID: 8, NAME: "Climate-controlled Animal Area", ABBREVATION: "AVI-AREA", DESCRIPTION: "Live animal holding", Authority: "Veterinary Officer", Remarks: null, capacityKg: 6000, isHoldZone: false, tempBandC: [15, 25] },
  { CLASSID: 9, NAME: "Special Handling Area", ABBREVATION: "HUM-SHA", DESCRIPTION: "Human remains", Authority: "Duty Manager", Remarks: null, capacityKg: 3000, isHoldZone: false },
  { CLASSID: 10, NAME: "Priority AOG Zone", ABBREVATION: "AOG-PZ", DESCRIPTION: "Aircraft-on-ground spares", Authority: null, Remarks: null, capacityKg: 8000, isHoldZone: false },
  { CLASSID: 11, NAME: "Controlled Access Area", ABBREVATION: "DIP-CAA", DESCRIPTION: "Diplomatic cargo", Authority: "Duty Manager", Remarks: null, capacityKg: 3000, isHoldZone: false },
  { CLASSID: 12, NAME: "Secure / High-risk Area", ABBREVATION: "VUN-SEC", DESCRIPTION: "Theft-prone cargo", Authority: "Security Manager", Remarks: null, capacityKg: 9000, isHoldZone: false },
  { CLASSID: 13, NAME: "Pharma Store", ABBREVATION: "PHR-STORE", DESCRIPTION: "GDP-compliant pharma", Authority: "Cold Chain Officer", Remarks: null, capacityKg: 12000, isHoldZone: false, tempBandC: [2, 8] },
  { CLASSID: 14, NAME: "Bonded Storage", ABBREVATION: "BND-STORE", DESCRIPTION: "Airline bonded cargo", Authority: "Customs Officer", Remarks: null, capacityKg: 22000, isHoldZone: true },
  { CLASSID: 15, NAME: "Transhipment Bonded Zone", ABBREVATION: "TRF-ZONE", DESCRIPTION: "FC-09 bonded transhipment", Authority: "Customs Officer", Remarks: "Under customs bond", capacityKg: 26000, isHoldZone: true },
  { CLASSID: 16, NAME: "Customs Detained Area", ABBREVATION: "CDT-AREA", DESCRIPTION: "Detained by customs (Detend)", Authority: "Customs Officer", Remarks: null, capacityKg: 14000, isHoldZone: true },
  { CLASSID: 17, NAME: "CDR / OSD Hold", ABBREVATION: "CDR-HOLD", DESCRIPTION: "Discrepancy quarantine", Authority: "Duty Manager", Remarks: null, capacityKg: 10000, isHoldZone: true },
  { CLASSID: 18, NAME: "Exception / Quarantine", ABBREVATION: "MSH-QTN", DESCRIPTION: "Mishandled cargo", Authority: "Duty Manager", Remarks: null, capacityKg: 8000, isHoldZone: true },
  { CLASSID: 19, NAME: "Re-export Holding Area", ABBREVATION: "REX-HOLD", DESCRIPTION: "Awaiting re-export", Authority: "Customs Officer", Remarks: null, capacityKg: 12000, isHoldZone: true },
  { CLASSID: 20, NAME: "Auction / Disposal", ABBREVATION: "LST-AUC", DESCRIPTION: "Section 82 pipeline", Authority: "Customs Officer", Remarks: null, capacityKg: 16000, isHoldZone: true },
];

/** Occupancy percentages, fixed per (site, zone) so the demo is reproducible. */
const OCCUPANCY: Record<SiteCode, number[]> = {
  KHI: [0.78, 0.64, 0.41, 0.22, 0.55, 0.83, 0.35, 0.12, 0.08, 0.46, 0.15, 0.51, 0.72, 0.38, 0.61, 0.44, 0.29, 0.18, 0.33, 0.57],
  LHE: [0.52, 0.47, 0.28, 0.16, 0.31, 0.59, 0.19, 0.05, 0.04, 0.27, 0.09, 0.34, 0.48, 0.21, 0.36, 0.25, 0.14, 0.09, 0.17, 0.30],
  PEW: [0.34, 0.29, 0.18, 0.11, 0.20, 0.37, 0.11, 0.03, 0.02, 0.15, 0.05, 0.21, 0.26, 0.13, 0.22, 0.16, 0.08, 0.05, 0.10, 0.19],
};

export const STORAGE_LOCATIONS: StorageLocation[] = SITES.flatMap((s, si) =>
  ZONE_DEFS.map((z, zi) => ({
    ...z,
    ID: (si + 1) * 100 + zi + 1,
    site: s.code,
    occupiedKg: Math.round(z.capacityKg * OCCUPANCY[s.code][zi]),
  })),
);

/**
 * CMTS `CARGOSUBCLASSLOCATION` — the subclass → allowed-location rules.
 * FC-03's amendment names this table explicitly: the allocation engine
 * suggests a rack "by class + subclass + capacity (CARGOSUBCLASSLOCATION rules)".
 */
export interface SubClassLocationRule {
  Id: number;
  /** CMTS `CLASSID` */
  CLASSID: number;
  /** CMTS `SUBCLASSID` */
  SUBCLASSID: number;
  /** CMTS `LOCATIONID` */
  LOCATIONID: number;
  /** Preferred vs permitted-overflow. AirVault addition — FC-03 "Suggest alternate zone / overflow". */
  preference: "preferred" | "overflow";
}

/** Each subclass is permitted in its own class's zone, with a documented overflow. */
export const SUBCLASS_LOCATION_RULES: SubClassLocationRule[] = (() => {
  const rules: SubClassLocationRule[] = [];
  let id = 1;
  /**
   * FC-03 doesn't draw overflow targets, so these are proposals for sign-off.
   *
   * ONE ENTRY IS NOT A PROPOSAL — it is the guarantee that makes FC-03 true:
   * pharma (13) overflows ONLY to cold chain (6), and cold chain overflows
   * back to pharma. Class 5 (Dangerous Goods, DGR-SEG) is never a pharma
   * target and must never become one. `allocationCandidates` reads nothing
   * but this map and the preferred zone, so adding `13: 5` here — or any
   * chain that reaches 5 from 13 — is all it would take to route a pharma
   * consignment into the segregated store, which is unrefrigerated and under
   * a DGR officer rather than the Cold Chain Officer. The classifier enforces
   * the same rule at the other end (proposeClassification in storage.ts).
   */
  const OVERFLOW: Record<number, number> = { 1: 2, 2: 1, 3: 1, 4: 1, 13: 6, 6: 13, 12: 7 };
  for (const s of SITES) {
    for (const sub of CARGO_SUBCLASSES) {
      const preferred = STORAGE_LOCATIONS.find((l) => l.site === s.code && l.CLASSID === sub.CLASSID);
      if (preferred) {
        rules.push({ Id: id++, CLASSID: sub.CLASSID, SUBCLASSID: sub.SUBCLASSID, LOCATIONID: preferred.ID, preference: "preferred" });
      }
      const ovClass = OVERFLOW[sub.CLASSID];
      if (ovClass) {
        const ov = STORAGE_LOCATIONS.find((l) => l.site === s.code && l.CLASSID === ovClass);
        if (ov) {
          rules.push({ Id: id++, CLASSID: sub.CLASSID, SUBCLASSID: sub.SUBCLASSID, LOCATIONID: ov.ID, preference: "overflow" });
        }
      }
    }
  }
  return rules;
})();

/* ================================================================== *
 * Airlines & airports
 * ================================================================== */

/** CMTS `AIRLINE` */
export interface Airline extends DomainRecord {
  ID: number;
  /** CMTS `AIRLINEID` — IATA code. */
  AIRLINEID: string;
  /**
   * CMTS `ABBREVATION` varchar(15) — the carrier short name printed on manifests
   * and vouchers. Wider than `AIRLINEID` because legacy allows a house
   * abbreviation that is not the IATA code; the demo data happens to match, so a
   * screen must still read this column rather than reusing `AIRLINEID`.
   */
  ABBREVATION: string;
  /**
   * CMTS `LOGO` varchar(200) — a server-relative path into the legacy CMTS image
   * share, NOT a URL and NOT the image itself. AirVault has no asset store, so
   * this is an opaque migration string: render it as text, never as an `<img>`
   * src, or the screen will show a broken image for every carrier. NULL is
   * normal — legacy never required a logo on file.
   */
  LOGO: string | null;
  DESCRIPTION: string;
  /** CMTS `COUNTRY` */
  COUNTRY: string;
  /** CMTS `DOBYSAPS` — does SAPS issue the DO on this airline's behalf? */
  DOBYSAPS: boolean;
  /** CMTS `DOAMOUNT` — the DO charge, used by the DO issuance screen. */
  DOAMOUNT: Amount;
  /** CMTS `SCHEDULED` */
  SCHEDULED: boolean;
  /** CMTS `APPROVEDBYIATA` */
  APPROVEDBYIATA: boolean;
}

const AUDIT = {
  CreatedBy: "system.migration",
  UpdatedBy: null,
  CreatedDate: "2026-01-04T09:00:00+05:00",
  UpdatedDate: null,
  IsActive: true,
  IsDeleted: false,
} as const;

const KHI_KEYS = { CityId: 1, Comp_Code: 1, Off_Code: 1 } as const;

export const AIRLINES: Airline[] = [
  { ...AUDIT, ...KHI_KEYS, ID: 1, AIRLINEID: "EK", ABBREVATION: "EK", LOGO: "~/Images/AirlineLogos/EK.gif", DESCRIPTION: "Emirates", COUNTRY: "United Arab Emirates", DOBYSAPS: true, DOAMOUNT: 3500, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 2, AIRLINEID: "QR", ABBREVATION: "QR", LOGO: "~/Images/AirlineLogos/QR.gif", DESCRIPTION: "Qatar Airways", COUNTRY: "Qatar", DOBYSAPS: true, DOAMOUNT: 3500, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 3, AIRLINEID: "EY", ABBREVATION: "EY", LOGO: "~/Images/AirlineLogos/EY.gif", DESCRIPTION: "Etihad Airways", COUNTRY: "United Arab Emirates", DOBYSAPS: true, DOAMOUNT: 3500, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 4, AIRLINEID: "TK", ABBREVATION: "TK", LOGO: "~/Images/AirlineLogos/TK.gif", DESCRIPTION: "Turkish Airlines", COUNTRY: "Türkiye", DOBYSAPS: false, DOAMOUNT: 4000, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 5, AIRLINEID: "PK", ABBREVATION: "PK", LOGO: "~/Images/AirlineLogos/PK.gif", DESCRIPTION: "Pakistan International Airlines", COUNTRY: "Pakistan", DOBYSAPS: true, DOAMOUNT: 2500, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 6, AIRLINEID: "SV", ABBREVATION: "SV", LOGO: "~/Images/AirlineLogos/SV.gif", DESCRIPTION: "Saudia", COUNTRY: "Saudi Arabia", DOBYSAPS: true, DOAMOUNT: 3200, SCHEDULED: true, APPROVEDBYIATA: true },
  { ...AUDIT, ...KHI_KEYS, ID: 7, AIRLINEID: "CV", ABBREVATION: "CV", LOGO: "~/Images/AirlineLogos/CV.gif", DESCRIPTION: "Cargolux", COUNTRY: "Luxembourg", DOBYSAPS: false, DOAMOUNT: 4500, SCHEDULED: false, APPROVEDBYIATA: true },
  // No logo on file — the empty state is real in CMTS, so the demo carries one.
  { ...AUDIT, ...KHI_KEYS, ID: 8, AIRLINEID: "PA", ABBREVATION: "PA", LOGO: null, DESCRIPTION: "Airblue", COUNTRY: "Pakistan", DOBYSAPS: true, DOAMOUNT: 2200, SCHEDULED: true, APPROVEDBYIATA: false },
];

/** CMTS `AIRPORT` + `Flight_Airport` */
export interface Airport {
  ID: number;
  ABBREVATION: string;
  DESCRIPTION: string;
  COUNTRY: string;
  CITY: string;
  /** CMTS `Flight_Airport.Manifest_Country_Code` */
  Manifest_Country_Code: string;
}

export const AIRPORTS: Airport[] = [
  { ID: 1, ABBREVATION: "KHI", DESCRIPTION: "Jinnah International", COUNTRY: "Pakistan", CITY: "Karachi", Manifest_Country_Code: "PK" },
  { ID: 2, ABBREVATION: "LHE", DESCRIPTION: "Allama Iqbal International", COUNTRY: "Pakistan", CITY: "Lahore", Manifest_Country_Code: "PK" },
  { ID: 3, ABBREVATION: "PEW", DESCRIPTION: "Bacha Khan International", COUNTRY: "Pakistan", CITY: "Peshawar", Manifest_Country_Code: "PK" },
  { ID: 4, ABBREVATION: "ISB", DESCRIPTION: "Islamabad International", COUNTRY: "Pakistan", CITY: "Islamabad", Manifest_Country_Code: "PK" },
  { ID: 5, ABBREVATION: "DXB", DESCRIPTION: "Dubai International", COUNTRY: "United Arab Emirates", CITY: "Dubai", Manifest_Country_Code: "AE" },
  { ID: 6, ABBREVATION: "AUH", DESCRIPTION: "Abu Dhabi International", COUNTRY: "United Arab Emirates", CITY: "Abu Dhabi", Manifest_Country_Code: "AE" },
  { ID: 7, ABBREVATION: "DOH", DESCRIPTION: "Hamad International", COUNTRY: "Qatar", CITY: "Doha", Manifest_Country_Code: "QA" },
  { ID: 8, ABBREVATION: "IST", DESCRIPTION: "Istanbul Airport", COUNTRY: "Türkiye", CITY: "Istanbul", Manifest_Country_Code: "TR" },
  { ID: 9, ABBREVATION: "JED", DESCRIPTION: "King Abdulaziz International", COUNTRY: "Saudi Arabia", CITY: "Jeddah", Manifest_Country_Code: "SA" },
  { ID: 10, ABBREVATION: "LHR", DESCRIPTION: "London Heathrow", COUNTRY: "United Kingdom", CITY: "London", Manifest_Country_Code: "GB" },
  { ID: 11, ABBREVATION: "FRA", DESCRIPTION: "Frankfurt am Main", COUNTRY: "Germany", CITY: "Frankfurt", Manifest_Country_Code: "DE" },
  { ID: 12, ABBREVATION: "PVG", DESCRIPTION: "Shanghai Pudong", COUNTRY: "China", CITY: "Shanghai", Manifest_Country_Code: "CN" },
];

/* ================================================================== *
 * Parties — CMTS `SHIPPER`, `CONSIGNEE`, `AGENCY`
 * ================================================================== */

export type PartyRole = "shipper" | "consignee" | "agent";

export interface Party {
  ID: number;
  role: PartyRole;
  /** CMTS `NAME` */
  NAME: string;
  /** CMTS `ADDRESS` */
  ADDRESS: string;
  CITY: string;
  COUNTRY: string;
  PHONENO: string;
  EMAIL: string;
  /** CMTS `CONSIGNEE.NTN` — national tax number. Appears on DO and GR. */
  NTN: string | null;
  /** CMTS `CONSIGNEE.STN` — sales tax number. */
  STN: string | null;
  /** AirVault addition (FC-05) — per-recipient notification channels. */
  channels: Array<"email" | "sms" | "whatsapp">;
}

export const PARTIES: Party[] = [
  { ID: 1, role: "consignee", NAME: "Indus Pharma (Pvt) Ltd", ADDRESS: "Plot 34, Korangi Industrial Area", CITY: "Karachi", COUNTRY: "Pakistan", PHONENO: "+92 21 3505 1200", EMAIL: "imports@induspharma.com.pk", NTN: "1234567-8", STN: "17-00-9911-023-55", channels: ["email", "whatsapp"] },
  { ID: 2, role: "consignee", NAME: "Rehman Textiles Ltd", ADDRESS: "12-KM Multan Road", CITY: "Lahore", COUNTRY: "Pakistan", PHONENO: "+92 42 3591 4400", EMAIL: "logistics@rehmantex.pk", NTN: "2345678-1", STN: "17-00-8822-114-31", channels: ["email", "sms"] },
  { ID: 3, role: "consignee", NAME: "Frontier Motors Pvt Ltd", ADDRESS: "GT Road, Industrial Estate", CITY: "Peshawar", COUNTRY: "Pakistan", PHONENO: "+92 91 2261 780", EMAIL: "parts@frontiermotors.pk", NTN: "3456789-4", STN: "17-00-7733-201-19", channels: ["email"] },
  { ID: 4, role: "consignee", NAME: "Al-Karam Electronics", ADDRESS: "Shahrah-e-Faisal", CITY: "Karachi", COUNTRY: "Pakistan", PHONENO: "+92 21 3277 9010", EMAIL: "clearing@alkaram-elec.pk", NTN: "4567890-2", STN: "17-00-6644-330-72", channels: ["email", "sms", "whatsapp"] },
  { ID: 5, role: "consignee", NAME: "Ministry of Health — Procurement", ADDRESS: "Secretariat Block C", CITY: "Islamabad", COUNTRY: "Pakistan", PHONENO: "+92 51 9201 445", EMAIL: "proc.health@gov.pk", NTN: null, STN: null, channels: ["email"] },
  { ID: 6, role: "consignee", NAME: "Sindh Cold Storage Co.", ADDRESS: "Port Qasim Authority Area", CITY: "Karachi", COUNTRY: "Pakistan", PHONENO: "+92 21 3472 6600", EMAIL: "ops@sindhcold.pk", NTN: "5678901-6", STN: "17-00-5511-447-08", channels: ["email", "whatsapp"] },

  { ID: 20, role: "shipper", NAME: "Gulf Pharma Distribution FZE", ADDRESS: "Jebel Ali Free Zone", CITY: "Dubai", COUNTRY: "United Arab Emirates", PHONENO: "+971 4 881 4400", EMAIL: "export@gulfpharma.ae", NTN: null, STN: null, channels: ["email"] },
  { ID: 21, role: "shipper", NAME: "Shanghai Yuan Trading Co.", ADDRESS: "Pudong New District", CITY: "Shanghai", COUNTRY: "China", PHONENO: "+86 21 5877 2100", EMAIL: "intl@syuan.cn", NTN: null, STN: null, channels: ["email"] },
  { ID: 22, role: "shipper", NAME: "Bayer Logistics GmbH", ADDRESS: "Kaiser-Wilhelm-Allee", CITY: "Frankfurt", COUNTRY: "Germany", PHONENO: "+49 69 305 2200", EMAIL: "aircargo@bayerlog.de", NTN: null, STN: null, channels: ["email"] },
  { ID: 23, role: "shipper", NAME: "Doha Aviation Spares WLL", ADDRESS: "Industrial Area St 38", CITY: "Doha", COUNTRY: "Qatar", PHONENO: "+974 4460 7711", EMAIL: "aog@dohaspares.qa", NTN: null, STN: null, channels: ["email", "sms"] },
  { ID: 24, role: "shipper", NAME: "Heathrow Valuables Handling Ltd", ADDRESS: "Cargo Terminal 4", CITY: "London", COUNTRY: "United Kingdom", PHONENO: "+44 20 8759 4000", EMAIL: "secure@hvh.co.uk", NTN: null, STN: null, channels: ["email"] },

  { ID: 40, role: "agent", NAME: "Sky Bridge Clearing Agency", ADDRESS: "Cargo Complex, JIAP", CITY: "Karachi", COUNTRY: "Pakistan", PHONENO: "+92 21 9924 1180", EMAIL: "ops@skybridge.pk", NTN: "6789012-3", STN: "17-00-4422-556-90", channels: ["email", "sms", "whatsapp"] },
  { ID: 41, role: "agent", NAME: "Falcon Freight Forwarders", ADDRESS: "Airport Road", CITY: "Lahore", COUNTRY: "Pakistan", PHONENO: "+92 42 3663 2200", EMAIL: "clearing@falconfreight.pk", NTN: "7890123-5", STN: "17-00-3311-667-44", channels: ["email", "whatsapp"] },
  { ID: 42, role: "agent", NAME: "Khyber Cargo Services", ADDRESS: "Airport Complex", CITY: "Peshawar", COUNTRY: "Pakistan", PHONENO: "+92 91 5851 330", EMAIL: "info@khybercargo.pk", NTN: "8901234-7", STN: "17-00-2200-778-16", channels: ["email"] },
];

/* ================================================================== *
 * Tariff — CMTS `CARGOSUBCLASSCHARGES`, `LOCATIONCHARGES`, `TaxType`, `CHARGETYPE`
 * ================================================================== */

/** FC-07 §08 — "Slabs: Day 1-3 Free | Day 4-7 | Day 8-14 | Day 15+ Charges" */
export interface TariffSlab {
  /** CMTS `DAYFROM` */
  DAYFROM: number;
  /** CMTS `DAYTO` — null means open-ended (the Day 15+ band). */
  DAYTO: number | null;
  label: string;
  /** PKR per chargeable kg per day. */
  ratePerKgPerDay: Amount;
}

/**
 * The band set `slabBreakdown()` prices EVERY consignment on.
 *
 * ILLUSTRATIVE — read from the rate card in `./tariff`, which derives it from
 * `CARGOSUBCLASSCHARGES` for general palletised cargo in the light weight band.
 * The four bands (0 / 35 / 50 / 75) are unchanged from the pre-decision
 * fixture: re-homing the rates deliberately did not re-price the demo.
 *
 * Two things a reader should know before quoting this table:
 *
 *   • CMTS selects the band set by subclass, location AND weight band
 *     (CMTS_SCHEMA_AUDIT §3.2/§3.3). `finance.ts` reads this one constant, so
 *     the selection is not implemented. The card carries the full matrix and
 *     `resolveChargeInputs()` reports when the engine will price a consignment
 *     on a band set the card did not select for it.
 *   • The leading zero band and `cargoClass.freeDays` BOTH express the free
 *     period, and `calculateCharges()` applies them in series — it subtracts
 *     the free days, then walks these bands from day 1 — so the grace period
 *     is currently granted twice. That is an engine defect, not a card defect;
 *     it under-bills, which is the visible direction, and the tariff screen
 *     names it rather than quietly compensating for it here.
 */
export const TARIFF_SLABS: TariffSlab[] = STANDARD_DAY_BANDS.map((b) => ({
  DAYFROM: b.DAYFROM,
  DAYTO: b.DAYTO,
  label: b.label,
  ratePerKgPerDay: b.ratePerKgPerDay,
}));

/** FC-07 §07 — "Surcharge chips: DGR, PER, VAL, AVI, AOG, HUM, Cold, Vault, Special" */
export interface CategorySurcharge {
  code: string;
  label: string;
  /** Applies to these cargo class IDs. */
  classIds: number[];
  /** Percentage uplift on the storage component. */
  percent: number;
}

/** ILLUSTRATIVE — the percentages live on the rate card in `./tariff`. */
export const CATEGORY_SURCHARGES: CategorySurcharge[] = ILLUSTRATIVE_CATEGORY_SURCHARGES.map(
  (s) => ({ code: s.code, label: s.label, classIds: s.classIds, percent: s.percent }),
);

/** CMTS `TaxType` */
export interface TaxType {
  id: number;
  Description: string;
  ChargesType: string;
  /** Percentage. */
  Amount: number;
  /** CMTS `IsDo` — does this tax apply to the DO charge? */
  IsDo: boolean;
  CityId: number | null;
}

/**
 * ILLUSTRATIVE — from the rate card in `./tariff`.
 *
 * `ChargesType` carries the `GD%` prefix the CMTS rent-tax query matches on
 * (`IsDo = 0 AND ChargesType LIKE 'GD%'`, CMTS_SCHEMA_AUDIT §3.5). The card is
 * written so that predicate selects EXACTLY ONE row; the previous fixture
 * spelled every row `"PERCENT"`, so the production query would have selected
 * none and the derivation screen would have reported an outage as a data
 * finding.
 */
export const TAX_TYPES: TaxType[] = ILLUSTRATIVE_TAX_TYPES.map((t) => ({
  id: t.id,
  Description: t.Description,
  ChargesType: t.ChargesType,
  Amount: t.Amount,
  IsDo: t.IsDo,
  CityId: t.CityId,
}));

/**
 * CMTS `CHARGETYPE` — the catalogue of charge headings the legacy calculator
 * cascades through. It carries no rate of its own: the amounts live in
 * `CARGOSUBCLASSCHARGES` / `LOCATIONCHARGES` / `CargoClassCharges`, and this
 * table only names the heading each of those resolves into on the voucher.
 *
 * Only the four columns SAPS asked for are modelled. The rest of the legacy
 * row is keys and office scoping, which this prototype deliberately omits, so
 * `ChTypeAbb` is the natural key here.
 */
export interface ChargeType {
  /** CMTS `ChTypeName` varchar(50) — heading as printed on the voucher. */
  ChTypeName: string;
  /** CMTS `ChTypeAbb` varchar(50) — short code used in the charge cascade. */
  ChTypeAbb: string;
  /** CMTS `ChTypeDesc` varchar(50) — one-line explanation for the operator. */
  ChTypeDesc: string;
  /**
   * CMTS `Nonuseabel` varchar(50) — legacy spelling, kept verbatim.
   *
   * THE SPELLING IS DELIBERATE. "Non-useable" with a dropped vowel, the same
   * misspelling class as `RECIEVEDBY`, `GrosssWeight` and `TARRIFRATE`
   * elsewhere in this schema. Migration parity is checked by column name, so
   * "correcting" it here would make a mapped column look unmapped. Leave it.
   *
   * DECIDED — Q7, `CMTS_SCOPE_DECISIONS.md`, ticket 86eyn3nmq: a charge type
   * carrying a value here is RETIRED. SAPS will not confirm, so the decision
   * was taken on which way the two failure directions point, and they are not
   * symmetric:
   *
   *   guessed retired, actually live   → the heading is missing from new
   *                                      calculations. Visible immediately,
   *                                      one flag flip to fix.
   *   guessed live, actually retired   → migrated rates silently re-activate
   *                                      billing SAPS stopped doing. Wrong
   *                                      invoices, found by a customer.
   *
   * So the implementation fails toward "retired": see `isRetiredChargeType()`,
   * which treats ANY non-empty value — including one nobody has decoded — as
   * retirement. The column stays a `string | null` rather than a boolean
   * because a varchar(50) can hold a date, an initial or a reason, and
   * whatever SAPS actually stored is still worth rendering verbatim next to
   * the marker.
   *
   * What "retired" means in code, and it is two rules not one:
   *   • EXCLUDED from new calculations — `activeChargeTypes()`
   *   • STILL RENDERED on historical records, carrying a retired marker —
   *     `chargeType()` deliberately still resolves retired rows.
   * A voucher raised while the heading was live must keep showing what it was
   * billed under. Hiding it would not un-bill the money, only make it
   * unexplainable.
   */
  Nonuseabel: string | null;
}

/**
 * Headings match the FC-07 charge block in finance.ts (`HANDLING`, `DEMURRAGE`,
 * `DOCUMENTATION`, `DECONSOLIDATION`, `SPECIALHANDLING`, `MISCELLANEOUS`) plus
 * the three cascade inputs that also print as their own line.
 *
 * Two headings carry a `Nonuseabel` value and are therefore RETIRED per Q7:
 * `MVF` (superseded by the documentation heading) and `AFUW` (folded into
 * special handling). Both are excluded from new calculations and both still
 * render on the historical vouchers that were billed under them — see
 * `RETIRED_CHARGE_TYPE_USAGES` in `./tariff`, which seeds one such voucher per
 * retired heading so the rule is demonstrable rather than theoretical.
 */
export const CHARGE_TYPES: ChargeType[] = [
  { ChTypeName: "Handling Charges", ChTypeAbb: "HND", ChTypeDesc: "Terminal handling per chargeable kg", Nonuseabel: null },
  { ChTypeName: "Demurrage / Storage", ChTypeAbb: "DEM", ChTypeDesc: "Storage rent beyond the free-day slabs", Nonuseabel: null },
  { ChTypeName: "Documentation Charges", ChTypeAbb: "DOC", ChTypeDesc: "Per-AWB documentation fee", Nonuseabel: null },
  { ChTypeName: "Deconsolidation Charges", ChTypeAbb: "DECON", ChTypeDesc: "House breakdown of a consol AWB", Nonuseabel: null },
  { ChTypeName: "Special Handling", ChTypeAbb: "SPH", ChTypeDesc: "Class-driven special handling uplift", Nonuseabel: null },
  { ChTypeName: "Delivery Order Charge", ChTypeAbb: "DO", ChTypeDesc: "DO issuance charge per AIRLINE.DOAMOUNT", Nonuseabel: null },
  { ChTypeName: "Location Charges", ChTypeAbb: "LOC", ChTypeDesc: "Flat daily zone fee for hold zones", Nonuseabel: null },
  { ChTypeName: "Minimum Charges", ChTypeAbb: "MIN", ChTypeDesc: "Subclass floor from CARGOSUBCLASS.MINCHARGES", Nonuseabel: null },
  { ChTypeName: "Storage Unit Charges", ChTypeAbb: "STU", ChTypeDesc: "Per-unit charge from STORGEUNIT", Nonuseabel: null },
  { ChTypeName: "Miscellaneous", ChTypeAbb: "MISC", ChTypeDesc: "Ad-hoc charge entered by the operator", Nonuseabel: null },
  { ChTypeName: "Manual Voucher Fee", ChTypeAbb: "MVF", ChTypeDesc: "Superseded by the documentation heading", Nonuseabel: "Y" },
  { ChTypeName: "AFU Weight Surcharge", ChTypeAbb: "AFUW", ChTypeDesc: "Legacy bulky-cargo weight surcharge", Nonuseabel: "Y" },
];

/** CMTS `LOCATIONCHARGES` */
export interface LocationCharge {
  locchrgesID: number;
  LOCATIONID: number;
  WEIGHTFROM: number;
  WEIGHTTO: number | null;
  DAYFROM: number;
  DAYTO: number | null;
  /** CMTS `UNIT` — 1 = per kg, 2 = per piece, 3 = flat. */
  UNIT: number;
  FLATERATE: boolean;
  AMOUNT: Amount;
}

/**
 * ILLUSTRATIVE — the rate card's zone bands, fanned out across the three
 * sites' location IDs.
 *
 * The card keys its bands on `LOCATION.ABBREVATION` because the demo
 * instantiates every zone once per site; this is where that becomes the
 * site-scoped `LOCATIONID` the source table actually carries.
 *
 * EVERY zone gets a row, including the ones priced at zero. That is a change
 * from the previous fixture, which carried rows for hold zones only: an
 * explicit zero says "this zone has no separate fee, the day-band rate covers
 * it", which is a decision, whereas a missing row is indistinguishable from an
 * unfinished rate table. Screens that count unpriced zones will now find none.
 */
export const LOCATION_CHARGES: LocationCharge[] = (() => {
  const rows: LocationCharge[] = [];
  let id = 1;
  for (const l of STORAGE_LOCATIONS) {
    for (const b of LOCATION_CHARGE_BANDS.filter((x) => x.zoneAbbr === l.ABBREVATION)) {
      rows.push({
        locchrgesID: id++,
        LOCATIONID: l.ID,
        WEIGHTFROM: b.WEIGHTFROM,
        WEIGHTTO: b.WEIGHTTO,
        DAYFROM: b.DAYFROM,
        DAYTO: b.DAYTO,
        UNIT: b.UNIT,
        FLATERATE: b.FLATERATE,
        AMOUNT: b.AMOUNT,
      });
    }
  }
  return rows;
})();

/**
 * FC-10 branch C — CMTS `Section82Days` is a single row (`Id`, `Days`).
 *
 * ILLUSTRATIVE. The threshold is set by customs statute, not by the terminal,
 * and nobody on the build team has verified it — of everything on the rate
 * card this is the value most likely to be mistaken for law. See `./tariff`.
 */
export const SECTION_82_DAYS = SECTION_82_DAYS_ROW.Days;

/* ================================================================== *
 * Lookups
 * ================================================================== */

export function cargoClass(id: number): CargoClass {
  const c = CARGO_CLASSES.find((x) => x.ID === id);
  if (!c) throw new Error(`Unknown cargo class: ${id}`);
  return c;
}

export function cargoClassByAbbr(abbr: string): CargoClass | undefined {
  return CARGO_CLASSES.find((x) => x.ABBREVATION === abbr);
}

export function cargoSubClass(id: number): CargoSubClass {
  const c = CARGO_SUBCLASSES.find((x) => x.SUBCLASSID === id);
  if (!c) throw new Error(`Unknown cargo subclass: ${id}`);
  return c;
}

export function subClassesOf(classId: number): CargoSubClass[] {
  return CARGO_SUBCLASSES.filter((x) => x.CLASSID === classId);
}

export function storageLocation(id: number): StorageLocation | undefined {
  return STORAGE_LOCATIONS.find((x) => x.ID === id);
}

export function locationsForSite(s: SiteCode): StorageLocation[] {
  return STORAGE_LOCATIONS.filter((x) => x.site === s);
}

export function airline(code: string): Airline | undefined {
  return AIRLINES.find((x) => x.AIRLINEID === code);
}

export function airport(code: string): Airport | undefined {
  return AIRPORTS.find((x) => x.ABBREVATION === code);
}

export function party(id: number): Party | undefined {
  return PARTIES.find((x) => x.ID === id);
}

/**
 * Keyed on `ChTypeAbb` because the demo does not model CHARGETYPE's surrogate
 * key.
 *
 * DELIBERATELY RESOLVES RETIRED ROWS TOO. This is the lookup a historical
 * record uses to find out what heading it was billed under, and a voucher
 * raised in 2024 must still be able to name its own line. Filtering here would
 * turn every retired heading on an old document into an unattributed number —
 * exactly the failure the Q7 decision exists to prevent. Callers building a
 * NEW calculation ask `activeChargeTypes()` instead; callers rendering an old
 * one ask this and then `isRetiredChargeType()` for the marker.
 */
export function chargeType(abb: string): ChargeType | undefined {
  return CHARGE_TYPES.find((x) => x.ChTypeAbb === abb);
}

/* ------------------------------------------------------------------ *
 * Q7 · Nonuseabel means RETIRED — CMTS_SCOPE_DECISIONS.md, ticket 86eyn3nmq
 * ------------------------------------------------------------------ */

/**
 * Is this heading retired?
 *
 * FAILS SAFE TOWARD RETIREMENT. Any non-empty `Nonuseabel` counts, whatever it
 * says — "Y", a date, an initial, a reason nobody has decoded. The decision
 * turns on asymmetry: excluding a heading that was really live is visible on
 * the next calculation and reversible in one edit, whereas including one that
 * was really retired re-activates billing SAPS stopped doing and is found by a
 * customer. When the meaning of a value is uncertain, the recoverable
 * direction wins.
 *
 * Whitespace is trimmed first, so a column holding `" "` reads as live rather
 * than as a retirement nobody intended.
 */
export function isRetiredChargeType(t: ChargeType): boolean {
  return t.Nonuseabel !== null && t.Nonuseabel.trim() !== "";
}

/**
 * The catalogue a NEW calculation may draw on. Retired headings are excluded
 * here and nowhere else — one exclusion point, so a screen cannot accidentally
 * offer a withdrawn charge by reading `CHARGE_TYPES` directly and forgetting
 * the rule.
 */
export function activeChargeTypes(): ChargeType[] {
  return CHARGE_TYPES.filter((t) => !isRetiredChargeType(t));
}

/** The withdrawn headings — still catalogued, still renderable on old records. */
export function retiredChargeTypes(): ChargeType[] {
  return CHARGE_TYPES.filter(isRetiredChargeType);
}

/**
 * The marker a historical record renders beside a retired heading, carrying
 * the raw stored value so a human can still question the decoding. Null when
 * the heading is live, so callers can render nothing without a second test.
 */
export function chargeTypeRetirementMarker(t: ChargeType): string | null {
  return isRetiredChargeType(t) ? `RETIRED · Nonuseabel = ${t.Nonuseabel}` : null;
}

/**
 * FC-03 amendment — "System suggests rack / bin by class + subclass +
 * capacity (CARGOSUBCLASSLOCATION rules)". Returns candidate locations for
 * a subclass at a site, preferred first, each with its availability.
 */
export function allocationCandidates(subClassId: number, siteCode: SiteCode, needKg: number) {
  const sub = cargoSubClass(subClassId);
  return SUBCLASS_LOCATION_RULES.filter((r) => r.SUBCLASSID === subClassId)
    .map((r) => ({ rule: r, loc: storageLocation(r.LOCATIONID) }))
    .filter((x): x is { rule: SubClassLocationRule; loc: StorageLocation } => !!x.loc && x.loc.site === siteCode)
    .map(({ rule, loc }) => {
      const availableKg = loc.capacityKg - loc.occupiedKg;
      return {
        location: loc,
        preference: rule.preference,
        availableKg,
        utilisationPct: Math.round((loc.occupiedKg / loc.capacityKg) * 100),
        fits: availableKg >= needKg,
        /** Why this location was suggested — the engine must be able to explain itself. */
        reason:
          rule.preference === "preferred"
            ? `${sub.ABBREVATION} → ${loc.NAME} (CARGOSUBCLASSLOCATION rule)`
            : `Overflow zone for ${sub.ABBREVATION}`,
      };
    })
    .sort((a, b) => (a.preference === b.preference ? b.availableKg - a.availableKg : a.preference === "preferred" ? -1 : 1));
}
