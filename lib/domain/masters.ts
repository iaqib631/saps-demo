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
 */

import type { Amount, DomainRecord, Site, SiteCode } from "./common";

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

export const CARGO_CLASSES: CargoClass[] = [
  // --- FC-03 A. General / Normal ------------------------------------
  { ID: 1, NAME: "General Cargo", DESCRIPTION: "Standard dry cargo", ABBREVATION: "GCR", DOCUMENTATIONCHARGES: 750, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 0, group: "general", freeDays: 3, requiresSpecialClearance: false },
  { ID: 2, NAME: "Bulky Cargo", DESCRIPTION: "Air freight unit / oversized", ABBREVATION: "AFU", DOCUMENTATIONCHARGES: 750, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 2500, group: "general", freeDays: 3, requiresSpecialClearance: false },
  { ID: 3, NAME: "Immediate Clearance Goods", DESCRIPTION: "Priority release", ABBREVATION: "ICG", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 0, group: "general", freeDays: 2, requiresSpecialClearance: false },
  { ID: 4, NAME: "Unaccompanied Baggage", DESCRIPTION: "Passenger baggage shipped separately", ABBREVATION: "UAB", DOCUMENTATIONCHARGES: 500, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "general", freeDays: 5, requiresSpecialClearance: false },

  // --- FC-03 B. Special Handling ------------------------------------
  { ID: 5, NAME: "Dangerous Goods", DESCRIPTION: "IATA DGR-regulated", ABBREVATION: "DGR", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 2400, SPECIALHANDLINGCHARGES: 6500, group: "special", freeDays: 2, requiresSpecialClearance: true },
  { ID: 6, NAME: "Perishables", DESCRIPTION: "Temperature-sensitive", ABBREVATION: "PER", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 4500, group: "special", freeDays: 1, requiresSpecialClearance: true },
  { ID: 7, NAME: "Valuable Cargo", DESCRIPTION: "High-value / bullion", ABBREVATION: "VAL", DOCUMENTATIONCHARGES: 2000, DECONSOLIDATIONCHARGES: 2400, SPECIALHANDLINGCHARGES: 8500, group: "special", freeDays: 1, requiresSpecialClearance: true },
  { ID: 8, NAME: "Live Animals", DESCRIPTION: "IATA LAR-regulated", ABBREVATION: "AVI", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 7500, group: "special", freeDays: 1, requiresSpecialClearance: true },
  { ID: 9, NAME: "Human Remains", DESCRIPTION: "Repatriation", ABBREVATION: "HUM", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "special", freeDays: 3, requiresSpecialClearance: true },
  { ID: 10, NAME: "Aircraft on Ground Spares", DESCRIPTION: "AOG priority spares", ABBREVATION: "AOG", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 1200, SPECIALHANDLINGCHARGES: 3500, group: "special", freeDays: 1, requiresSpecialClearance: false },
  { ID: 11, NAME: "Diplomatic Cargo", DESCRIPTION: "Diplomatic bag / mission cargo", ABBREVATION: "DIP", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "special", freeDays: 7, requiresSpecialClearance: true },
  { ID: 12, NAME: "Vulnerable Cargo", DESCRIPTION: "High-risk / theft-prone", ABBREVATION: "VUN", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 5500, group: "special", freeDays: 2, requiresSpecialClearance: true },
  { ID: 13, NAME: "Pharmaceuticals", DESCRIPTION: "GDP-compliant pharma", ABBREVATION: "PHR", DOCUMENTATIONCHARGES: 1500, DECONSOLIDATIONCHARGES: 1800, SPECIALHANDLINGCHARGES: 5500, group: "special", freeDays: 1, requiresSpecialClearance: true },

  // --- FC-03 C. Controlled / Exception ------------------------------
  { ID: 14, NAME: "Airline Bonded Cargo", DESCRIPTION: "Under airline bond", ABBREVATION: "BND", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 3, requiresSpecialClearance: true },
  { ID: 15, NAME: "Transfer Cargo", DESCRIPTION: "Transhipment / transit", ABBREVATION: "TRF", DOCUMENTATIONCHARGES: 900, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 5, requiresSpecialClearance: true },
  { ID: 16, NAME: "Customs Hold", DESCRIPTION: "Detained by customs", ABBREVATION: "CDT", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 0, requiresSpecialClearance: true },
  { ID: 17, NAME: "Discrepancy Cargo", DESCRIPTION: "CDR / OSD hold", ABBREVATION: "CDR", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 0, requiresSpecialClearance: true },
  { ID: 18, NAME: "Mishandled Cargo", DESCRIPTION: "Misrouted / offloaded in error", ABBREVATION: "MSH", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 0, requiresSpecialClearance: true },
  { ID: 19, NAME: "Re-export Cargo", DESCRIPTION: "Awaiting re-export", ABBREVATION: "REX", DOCUMENTATIONCHARGES: 1200, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 0, requiresSpecialClearance: true },
  { ID: 20, NAME: "Long-stay Cargo", DESCRIPTION: "Section 82 / auction / disposal", ABBREVATION: "LST", DOCUMENTATIONCHARGES: 0, DECONSOLIDATIONCHARGES: 0, SPECIALHANDLINGCHARGES: 0, group: "controlled", freeDays: 0, requiresSpecialClearance: true },
];

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

export const CARGO_SUBCLASSES: CargoSubClass[] = [
  // GCR
  { SUBCLASSID: 101, CLASSID: 1, NAME: "General — Palletised", DESCRIPTION: "Palletised dry cargo", ABBREVATION: "GCR-P", MINCHARGES: 1500, Authority: null, Remarks: null },
  { SUBCLASSID: 102, CLASSID: 1, NAME: "General — Loose", DESCRIPTION: "Loose dry cargo", ABBREVATION: "GCR-L", MINCHARGES: 1200, Authority: null, Remarks: null },
  // AFU
  { SUBCLASSID: 103, CLASSID: 2, NAME: "Bulky — Heavy Lift", DESCRIPTION: "Requires forklift / crane", ABBREVATION: "AFU-H", MINCHARGES: 4500, Authority: "Warehouse Manager", Remarks: "Forklift charges apply" },
  { SUBCLASSID: 104, CLASSID: 2, NAME: "Bulky — Oversize", DESCRIPTION: "Exceeds standard rack envelope", ABBREVATION: "AFU-O", MINCHARGES: 3500, Authority: "Warehouse Manager", Remarks: null },
  // ICG
  { SUBCLASSID: 105, CLASSID: 3, NAME: "Immediate Clearance", DESCRIPTION: "Priority release goods", ABBREVATION: "ICG", MINCHARGES: 2000, Authority: null, Remarks: null },
  // UAB
  { SUBCLASSID: 106, CLASSID: 4, NAME: "Unaccompanied Baggage", DESCRIPTION: "Passenger baggage", ABBREVATION: "UAB", MINCHARGES: 800, Authority: null, Remarks: null },
  // DGR
  { SUBCLASSID: 107, CLASSID: 5, NAME: "DGR — Class 3 Flammable", DESCRIPTION: "Flammable liquids", ABBREVATION: "DGR-3", MINCHARGES: 8500, Authority: "DGR Certified Officer", Remarks: "Segregated store only" },
  { SUBCLASSID: 108, CLASSID: 5, NAME: "DGR — Class 8 Corrosive", DESCRIPTION: "Corrosive substances", ABBREVATION: "DGR-8", MINCHARGES: 8500, Authority: "DGR Certified Officer", Remarks: "Segregated store only" },
  { SUBCLASSID: 109, CLASSID: 5, NAME: "DGR — Class 9 Misc", DESCRIPTION: "Lithium batteries etc.", ABBREVATION: "DGR-9", MINCHARGES: 7500, Authority: "DGR Certified Officer", Remarks: null },
  // PER — FC-03 B lists four cold-chain regimes under Cold Chain Storage
  { SUBCLASSID: 110, CLASSID: 6, NAME: "COL — Cool Room", DESCRIPTION: "Cool room +2 to +8 C", ABBREVATION: "COL", MINCHARGES: 5500, Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 8] },
  { SUBCLASSID: 111, CLASSID: 6, NAME: "CRT — Controlled Room Temp", DESCRIPTION: "Controlled room temperature +15 to +25 C", ABBREVATION: "CRT", MINCHARGES: 4500, Authority: "Cold Chain Officer", Remarks: null, tempBandC: [15, 25] },
  { SUBCLASSID: 112, CLASSID: 6, NAME: "ERT — Extended Room Temp", DESCRIPTION: "Extended room temperature +2 to +25 C", ABBREVATION: "ERT", MINCHARGES: 4000, Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 25] },
  { SUBCLASSID: 113, CLASSID: 6, NAME: "FRO — Frozen Room", DESCRIPTION: "Frozen -20 to -15 C", ABBREVATION: "FRO", MINCHARGES: 7500, Authority: "Cold Chain Officer", Remarks: null, tempBandC: [-20, -15] },
  // VAL / AVI / HUM / AOG / DIP / VUN / PHR
  { SUBCLASSID: 114, CLASSID: 7, NAME: "Valuable — Vault", DESCRIPTION: "Strong room storage", ABBREVATION: "VAL-V", MINCHARGES: 12000, Authority: "Security Manager", Remarks: "Dual custody required" },
  { SUBCLASSID: 115, CLASSID: 8, NAME: "Live Animals", DESCRIPTION: "Climate-controlled animal area", ABBREVATION: "AVI", MINCHARGES: 9500, Authority: "Veterinary Officer", Remarks: null, tempBandC: [15, 25] },
  { SUBCLASSID: 116, CLASSID: 9, NAME: "Human Remains", DESCRIPTION: "Special handling area", ABBREVATION: "HUM", MINCHARGES: 0, Authority: "Duty Manager", Remarks: "No charge — welfare" },
  { SUBCLASSID: 117, CLASSID: 10, NAME: "AOG Spares", DESCRIPTION: "Priority AOG zone", ABBREVATION: "AOG", MINCHARGES: 4500, Authority: null, Remarks: null },
  { SUBCLASSID: 118, CLASSID: 11, NAME: "Diplomatic", DESCRIPTION: "Controlled access area", ABBREVATION: "DIP", MINCHARGES: 0, Authority: "Duty Manager", Remarks: "Sealed — not to be opened" },
  { SUBCLASSID: 119, CLASSID: 12, NAME: "Vulnerable", DESCRIPTION: "Secure / high-risk area", ABBREVATION: "VUN", MINCHARGES: 6500, Authority: "Security Manager", Remarks: null },
  { SUBCLASSID: 120, CLASSID: 13, NAME: "Pharma — GDP", DESCRIPTION: "GDP-compliant pharma storage", ABBREVATION: "PHR", MINCHARGES: 6500, Authority: "Cold Chain Officer", Remarks: null, tempBandC: [2, 8] },
  // Controlled / exception
  { SUBCLASSID: 121, CLASSID: 14, NAME: "Airline Bonded", DESCRIPTION: "Bonded storage", ABBREVATION: "BND", MINCHARGES: 2500, Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 122, CLASSID: 15, NAME: "Transhipment", DESCRIPTION: "Bonded transhipment zone", ABBREVATION: "TRF", MINCHARGES: 2500, Authority: "Customs Officer", Remarks: "Does not enter local consumption" },
  { SUBCLASSID: 123, CLASSID: 16, NAME: "Customs Detained", DESCRIPTION: "Customs detained area", ABBREVATION: "CDT", MINCHARGES: 0, Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 124, CLASSID: 17, NAME: "CDR / OSD Hold", DESCRIPTION: "Discrepancy hold", ABBREVATION: "CDR", MINCHARGES: 0, Authority: "Duty Manager", Remarks: null },
  { SUBCLASSID: 125, CLASSID: 18, NAME: "Exception / Quarantine", DESCRIPTION: "Mishandled cargo hold", ABBREVATION: "MSH", MINCHARGES: 0, Authority: "Duty Manager", Remarks: null },
  { SUBCLASSID: 126, CLASSID: 19, NAME: "Re-export Holding", DESCRIPTION: "Awaiting re-export", ABBREVATION: "REX", MINCHARGES: 2500, Authority: "Customs Officer", Remarks: null },
  { SUBCLASSID: 127, CLASSID: 20, NAME: "Auction / Disposal", DESCRIPTION: "Section 82 pipeline", ABBREVATION: "LST", MINCHARGES: 0, Authority: "Customs Officer", Remarks: null },
];

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
   * CMTS `REMARKS` nvarchar(500) — the zone's standing handling note.
   *
   * Spelled uppercase here on purpose. The demo previously modelled this column
   * as `Remarks`, matching `CARGOSUBCLASS.Remarks`, but LOCATION spells it
   * `REMARKS` in the source schema and the two are separate columns on separate
   * tables. Migration parity is checked by column name, so the casing carries
   * meaning: renaming it back would make LOCATION's note look like it had never
   * been mapped. Nothing outside this file read the old name.
   */
  REMARKS: string | null;
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
  { CLASSID: 1, NAME: "Normal Warehouse Racks", ABBREVATION: "GCR-RACK", DESCRIPTION: "Standard racking, 3 levels", Authority: null, REMARKS: null, capacityKg: 120000, isHoldZone: false },
  { CLASSID: 2, NAME: "Heavy Cargo Floor", ABBREVATION: "AFU-FLOOR", DESCRIPTION: "Ground-level heavy lift area", Authority: "Warehouse Manager", REMARKS: null, capacityKg: 80000, isHoldZone: false },
  { CLASSID: 3, NAME: "Priority Release Zone", ABBREVATION: "ICG-PRZ", DESCRIPTION: "Fast-turnaround staging", Authority: null, REMARKS: null, capacityKg: 25000, isHoldZone: false },
  { CLASSID: 4, NAME: "UAB Area", ABBREVATION: "UAB-AREA", DESCRIPTION: "Unaccompanied baggage", Authority: null, REMARKS: null, capacityKg: 15000, isHoldZone: false },
  { CLASSID: 5, NAME: "Segregated Store", ABBREVATION: "DGR-SEG", DESCRIPTION: "DGR segregated store", Authority: "DGR Certified Officer", REMARKS: "IATA segregation table applies", capacityKg: 18000, isHoldZone: false },
  { CLASSID: 6, NAME: "Cold Chain Storage", ABBREVATION: "PER-COLD", DESCRIPTION: "Multi-regime cold chain", Authority: "Cold Chain Officer", REMARKS: null, capacityKg: 30000, isHoldZone: false, tempBandC: [-20, 25] },
  { CLASSID: 7, NAME: "Vault / Strong Room", ABBREVATION: "VAL-VAULT", DESCRIPTION: "Dual-custody strong room", Authority: "Security Manager", REMARKS: null, capacityKg: 4000, isHoldZone: false },
  { CLASSID: 8, NAME: "Climate-controlled Animal Area", ABBREVATION: "AVI-AREA", DESCRIPTION: "Live animal holding", Authority: "Veterinary Officer", REMARKS: null, capacityKg: 6000, isHoldZone: false, tempBandC: [15, 25] },
  { CLASSID: 9, NAME: "Special Handling Area", ABBREVATION: "HUM-SHA", DESCRIPTION: "Human remains", Authority: "Duty Manager", REMARKS: null, capacityKg: 3000, isHoldZone: false },
  { CLASSID: 10, NAME: "Priority AOG Zone", ABBREVATION: "AOG-PZ", DESCRIPTION: "Aircraft-on-ground spares", Authority: null, REMARKS: null, capacityKg: 8000, isHoldZone: false },
  { CLASSID: 11, NAME: "Controlled Access Area", ABBREVATION: "DIP-CAA", DESCRIPTION: "Diplomatic cargo", Authority: "Duty Manager", REMARKS: null, capacityKg: 3000, isHoldZone: false },
  { CLASSID: 12, NAME: "Secure / High-risk Area", ABBREVATION: "VUN-SEC", DESCRIPTION: "Theft-prone cargo", Authority: "Security Manager", REMARKS: null, capacityKg: 9000, isHoldZone: false },
  { CLASSID: 13, NAME: "Pharma Store", ABBREVATION: "PHR-STORE", DESCRIPTION: "GDP-compliant pharma", Authority: "Cold Chain Officer", REMARKS: null, capacityKg: 12000, isHoldZone: false, tempBandC: [2, 8] },
  { CLASSID: 14, NAME: "Bonded Storage", ABBREVATION: "BND-STORE", DESCRIPTION: "Airline bonded cargo", Authority: "Customs Officer", REMARKS: null, capacityKg: 22000, isHoldZone: true },
  { CLASSID: 15, NAME: "Transhipment Bonded Zone", ABBREVATION: "TRF-ZONE", DESCRIPTION: "FC-09 bonded transhipment", Authority: "Customs Officer", REMARKS: "Under customs bond", capacityKg: 26000, isHoldZone: true },
  { CLASSID: 16, NAME: "Customs Detained Area", ABBREVATION: "CDT-AREA", DESCRIPTION: "Detained by customs (Detend)", Authority: "Customs Officer", REMARKS: null, capacityKg: 14000, isHoldZone: true },
  { CLASSID: 17, NAME: "CDR / OSD Hold", ABBREVATION: "CDR-HOLD", DESCRIPTION: "Discrepancy quarantine", Authority: "Duty Manager", REMARKS: null, capacityKg: 10000, isHoldZone: true },
  { CLASSID: 18, NAME: "Exception / Quarantine", ABBREVATION: "MSH-QTN", DESCRIPTION: "Mishandled cargo", Authority: "Duty Manager", REMARKS: null, capacityKg: 8000, isHoldZone: true },
  { CLASSID: 19, NAME: "Re-export Holding Area", ABBREVATION: "REX-HOLD", DESCRIPTION: "Awaiting re-export", Authority: "Customs Officer", REMARKS: null, capacityKg: 12000, isHoldZone: true },
  { CLASSID: 20, NAME: "Auction / Disposal", ABBREVATION: "LST-AUC", DESCRIPTION: "Section 82 pipeline", Authority: "Customs Officer", REMARKS: null, capacityKg: 16000, isHoldZone: true },
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

export const TARIFF_SLABS: TariffSlab[] = [
  { DAYFROM: 1, DAYTO: 3, label: "Day 1–3 (free)", ratePerKgPerDay: 0 },
  { DAYFROM: 4, DAYTO: 7, label: "Day 4–7", ratePerKgPerDay: 35 },
  { DAYFROM: 8, DAYTO: 14, label: "Day 8–14", ratePerKgPerDay: 50 },
  { DAYFROM: 15, DAYTO: null, label: "Day 15+", ratePerKgPerDay: 75 },
];

/** FC-07 §07 — "Surcharge chips: DGR, PER, VAL, AVI, AOG, HUM, Cold, Vault, Special" */
export interface CategorySurcharge {
  code: string;
  label: string;
  /** Applies to these cargo class IDs. */
  classIds: number[];
  /** Percentage uplift on the storage component. */
  percent: number;
}

export const CATEGORY_SURCHARGES: CategorySurcharge[] = [
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

export const TAX_TYPES: TaxType[] = [
  { id: 1, Description: "Sales Tax on Services", ChargesType: "PERCENT", Amount: 15, IsDo: false, CityId: null },
  { id: 2, Description: "Withholding Tax", ChargesType: "PERCENT", Amount: 4, IsDo: false, CityId: null },
  { id: 3, Description: "DO Processing Tax", ChargesType: "PERCENT", Amount: 15, IsDo: true, CityId: null },
];

/**
 * CMTS `CHARGETYPE` — the catalogue of charge headings the legacy calculator
 * cascades through. It carries no rate of its own: the amounts live in
 * `CARGOSUBCLASSCHARGES` / `LOCATIONCHARGES` / `CargoClassCharges`, and this
 * table only names the heading each of those resolves into on the voucher.
 *
 * Only the four columns SAPS asked for are modelled. The rest of the legacy
 * row is keys and office scoping, which this prototype deliberately omits, so
 * `CHTYPEABB` is the natural key here.
 */
export interface ChargeType {
  /** CMTS `CHTYPENAME` varchar(50) — heading as printed on the voucher. */
  CHTYPENAME: string;
  /** CMTS `CHTYPEABB` varchar(50) — short code used in the charge cascade. */
  CHTYPEABB: string;
  /** CMTS `CHTYPEDESC` varchar(50) — one-line explanation for the operator. */
  CHTYPEDESC: string;
  /**
   * CMTS `NONUSEABEL` varchar(50) — legacy spelling, kept verbatim.
   *
   * UNCONFIRMED SEMANTICS — open decision ticket with SAPS. The name and the
   * rows that carry it suggest "this charge type is retired", but nobody has
   * confirmed what the stored strings mean, and a varchar(50) can hold far more
   * than a flag (a date, an initial, a reason).
   *
   * So it stays a string. Do NOT narrow it to a boolean and do NOT filter the
   * catalogue on it until SAPS answers: reading it as `!NONUSEABEL === active`
   * would silently put every retired heading back on the calculator, which is
   * how a charge SAPS stopped billing lands on a customer voucher. Render it
   * verbatim and let a human read it.
   */
  NONUSEABEL: string | null;
}

/**
 * Headings match the FC-07 charge block in finance.ts (`HANDLING`, `DEMURRAGE`,
 * `DOCUMENTATION`, `DECONSOLIDATION`, `SPECIALHANDLING`, `MISCELLANEOUS`) plus
 * the three cascade inputs that also print as their own line.
 *
 * The two `NONUSEABEL` values below are placeholder strings, not a decoded
 * flag — see the field comment. They exist so the column has something to show
 * on screen; nothing branches on them.
 */
export const CHARGE_TYPES: ChargeType[] = [
  { CHTYPENAME: "Handling Charges", CHTYPEABB: "HND", CHTYPEDESC: "Terminal handling per chargeable kg", NONUSEABEL: null },
  { CHTYPENAME: "Demurrage / Storage", CHTYPEABB: "DEM", CHTYPEDESC: "Storage rent beyond the free-day slabs", NONUSEABEL: null },
  { CHTYPENAME: "Documentation Charges", CHTYPEABB: "DOC", CHTYPEDESC: "Per-AWB documentation fee", NONUSEABEL: null },
  { CHTYPENAME: "Deconsolidation Charges", CHTYPEABB: "DECON", CHTYPEDESC: "House breakdown of a consol AWB", NONUSEABEL: null },
  { CHTYPENAME: "Special Handling", CHTYPEABB: "SPH", CHTYPEDESC: "Class-driven special handling uplift", NONUSEABEL: null },
  { CHTYPENAME: "Delivery Order Charge", CHTYPEABB: "DO", CHTYPEDESC: "DO issuance charge per AIRLINE.DOAMOUNT", NONUSEABEL: null },
  { CHTYPENAME: "Location Charges", CHTYPEABB: "LOC", CHTYPEDESC: "Flat daily zone fee for hold zones", NONUSEABEL: null },
  { CHTYPENAME: "Minimum Charges", CHTYPEABB: "MIN", CHTYPEDESC: "Subclass floor from CARGOSUBCLASS.MINCHARGES", NONUSEABEL: null },
  { CHTYPENAME: "Storage Unit Charges", CHTYPEABB: "STU", CHTYPEDESC: "Per-unit charge from STORGEUNIT", NONUSEABEL: null },
  { CHTYPENAME: "Miscellaneous", CHTYPEABB: "MISC", CHTYPEDESC: "Ad-hoc charge entered by the operator", NONUSEABEL: null },
  { CHTYPENAME: "Manual Voucher Fee", CHTYPEABB: "MVF", CHTYPEDESC: "Superseded by the documentation heading", NONUSEABEL: "Y" },
  { CHTYPENAME: "AFU Weight Surcharge", CHTYPEABB: "AFUW", CHTYPEDESC: "Legacy bulky-cargo weight surcharge", NONUSEABEL: "Y" },
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

/** One band per hold zone — hold zones charge a flat daily location fee. */
export const LOCATION_CHARGES: LocationCharge[] = STORAGE_LOCATIONS.filter((l) => l.isHoldZone).map(
  (l, i) => ({
    locchrgesID: i + 1,
    LOCATIONID: l.ID,
    WEIGHTFROM: 0,
    WEIGHTTO: null,
    DAYFROM: 1,
    DAYTO: null,
    UNIT: 3,
    FLATERATE: true,
    AMOUNT: 1200,
  }),
);

/** FC-10 branch C — CMTS `Section82Days` is a single row (`Id`, `Days`). */
export const SECTION_82_DAYS = 30;

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
 * Keyed on `CHTYPEABB` because the demo does not model CHARGETYPE's surrogate
 * key. Returns retired-looking rows too — `NONUSEABEL` is not decoded yet, so
 * this deliberately does not filter on it.
 */
export function chargeType(abb: string): ChargeType | undefined {
  return CHARGE_TYPES.find((x) => x.CHTYPEABB === abb);
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
