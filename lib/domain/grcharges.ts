/**
 * AirVault domain — CMTS `grCharges` (47 business columns), the CHARGE WORKING SET.
 *
 * WHAT THIS TABLE IS
 * ------------------
 * It is not a document. `GODOWNRENT` is the voucher, `GODOWNRENTDETAIL` is the
 * per-zone breakdown printed under it, and `CHARGECALCULATER` is the header the
 * calculation hangs off. `grCharges` sits underneath all three: it is the
 * scratch the charge engine writes as it walks, one row per rate band it
 * touched, with the whole consignment header copied onto every row.
 *
 * Read the column list and the shape is unmistakable:
 *
 *   DAYFROM · DAYTO · ChargesDaysNoOfDays · Unit · ChargesAmount
 *       → a RATE SLAB, as read from the rate table and as walked
 *   TotalDays · NormalDays · ExtraFreeDays · TotalFreeDays · SupplimentDays
 *       → a DAY-COUNT DECOMPOSITION
 *
 * Both exist because the charge is banded, not flat. A voucher can print
 * "PKR 523,200 storage" without either; only this table can answer *why*.
 *
 * WHAT IS DELIBERATELY NOT MODELLED
 * ---------------------------------
 * Four of the 47 columns are surrogate keys and are out of scope for this
 * prototype, which has no backend for them to key: `HWBid`, `ClassID`,
 * `SubClassId`, `LocationId`. Nothing is lost — the table conveniently carries
 * the human-readable twin of each (`HWB`, `Cargoclass`, `LOCATIONNAME`), and
 * the working set resolves class and subclass through the AWB instead, which is
 * how the rest of this repo joins.
 *
 * There is also NO site column here and none has been invented. `grCharges`
 * carries no `CityId`; it hangs off the AWB, so scoping runs through the parent
 * exactly as `listDamage()` does for `DamageDetail`.
 *
 * And there are no audit columns. `grCharges` has none of the six, and it
 * should not: the working set is scratch, rewritten every time the engine runs.
 * That is worth stating rather than papering over with `AuditColumns` — a table
 * that records how money was computed and cannot say who ran it or when is a
 * migration finding in its own right.
 *
 * THE MISSPELLINGS ARE DELIBERATE
 * -------------------------------
 * `GrosssWeight` (three s), `SupplimentDays`, `IsSuppliment` and
 * `cahrgesUniqueIdentification` are reproduced exactly as CMTS spells them.
 * Migration parity is checked by column name, so "correcting" any of them here
 * would make a mapped column look unmapped. Each is marked `[sic]` below.
 *
 * IMPORT NOTE
 * -----------
 * This module is deliberately NOT re-exported from `lib/domain/index.ts`.
 * Three other tickets are landing new domain files in the same window and the
 * barrel is a shared-conflict file, so the one screen that reads this imports
 * `@/lib/domain/grcharges` directly. Fold it into the barrel once the four
 * land together.
 */

import {
  DEMO_NOW,
  MS_PER_DAY,
  daysBetween,
  formatPkr,
  round2,
  type Amount,
  type SiteCode,
  type SiteScope,
} from "./common";
import {
  LOCATION_CHARGES,
  STORAGE_LOCATIONS,
  TARIFF_SLABS,
  TAX_TYPES,
  cargoClass,
  cargoSubClass,
  storageLocation,
} from "./masters";
import {
  calculateCharges,
  slabBreakdown,
  surchargesFor,
  type BillType,
  type ChargeCalculation,
} from "./finance";
import {
  AWB_LOCATIONS,
  AWBS,
  GODOWN_RENTS,
  HOUSE_AWBS,
  awbByNo,
  chargesFor,
} from "./fixtures";
import type { AWB, HouseAWB } from "./cargo";

/* ================================================================== *
 * The row — CMTS `grCharges`, 43 of 47 columns
 * ================================================================== */

/**
 * `DAYTO` is `int` in CMTS and the demo's `TariffSlab.DAYTO` is `number | null`
 * for the open-ended top band. An int column cannot hold that null, so the
 * open band needs a sentinel and this is it.
 *
 * Flagged rather than quietly chosen: a null → sentinel mapping is exactly the
 * kind of decision that breaks a band lookup silently, because `WHERE @day
 * BETWEEN DAYFROM AND DAYTO` behaves completely differently against 9999 and
 * against NULL. SAPS has to confirm what the legacy rows actually carry.
 */
export const OPEN_BAND_DAYTO = 9999;

export interface GrChargeRow {
  /* --- which engine run this row belongs to --------------------- */
  /**
   * CMTS `cahrgesUniqueIdentification` varchar(250) — [sic], the legacy
   * spelling with the transposed "ah". The batch key: every row the engine
   * wrote in one pass carries the same value, and it is the ONLY thing that
   * groups them. There is no run timestamp and no user on this table.
   */
  cahrgesUniqueIdentification: string;

  /* --- consignment identity ------------------------------------- */
  /** CMTS `IGMNO` varchar(15). */
  IGMNO: string;
  /** CMTS `AWBNO` varchar(20) — the join back to `IMPORTAWB`, undeclared. */
  AWBNO: string;
  /**
   * CMTS `CARGODATE` — cargo arrival. The legacy procedure measures dwell from
   * THIS column: `DATEDIFF(day, i.CARGODATE, @enddate) + 1`. The demo measures
   * from cargo intake instead, which is why both dates are carried on the row.
   */
  CARGODATE: string;
  /** CMTS `Cargoclass` varchar(50) — the class NAME, alongside the `ClassID` key. */
  Cargoclass: string;
  /** CMTS `PcsOnAWB` int — pieces on the master AWB. */
  PcsOnAWB: number;
  /** CMTS `GrosssWeight` float — [sic], three s. Gross weight of the master AWB. */
  GrosssWeight: number;

  /* --- bill type ------------------------------------------------- */
  /**
   * CMTS `Billtype` varchar(50). The legacy procedure branches on the STRING
   * (`case when @IsSuppliment = 'Suppliment' then 0 else …`) while the column
   * beside it is a bit — see `IsSuppliment`.
   */
  Billtype: BillType;
  /** CMTS `IsSuppliment` bit — [sic]. The same fact as `Billtype`, typed twice. */
  IsSuppliment: boolean;

  /* --- the two date pairs ---------------------------------------- */
  /**
   * CMTS `grFromDate` — the GODOWNRENT voucher period this run was written
   * onto. Null when the run has not been committed to a voucher: the engine
   * can be run as a quote, and a quote has no GR period yet. Same reasoning as
   * `CHARGECALCULATER.VOUCHERNO`, which is nullable for exactly this case.
   */
  grFromDate: string | null;
  /** CMTS `grToDate` — see `grFromDate`. */
  grToDate: string | null;
  /**
   * CMTS `fromdate` — the window the engine actually priced from. Distinct
   * from `grFromDate`, and on every run in this demo they differ: the voucher
   * period opens at cargo arrival, the engine prices from cargo intake.
   *
   * This reading of the two pairs is OURS. CMTS documents neither, and two
   * overlapping date ranges on one row with no stated difference is precisely
   * the sort of thing a migration gets wrong once and never notices.
   */
  fromdate: string;
  /** CMTS `endDate` — the pricing cut-off, the procedure's `@enddate`. */
  endDate: string;
  /**
   * CMTS `totalTime` int — elapsed time across the priced window.
   *
   * The unit is not documented and the column name does not carry one. Modelled
   * as HOURS here because that is the only unit in which the number is useful
   * next to `TotalDays`; if CMTS stores minutes every value is 60× out. Open
   * question for SAPS.
   */
  totalTime: number;

  /* --- day-count decomposition ----------------------------------- */
  /** CMTS `TotalDays` int — dwell in whole days, as the engine counted it. */
  TotalDays: number;
  /**
   * CMTS `Totalday` int — the near-twin of `TotalDays`, differing only in case
   * and plural. Nothing in the schema says how the two differ and the restored
   * database is empty, so nothing can be read off the data either.
   *
   * Both are written from the demo's single dwell number, which is the honest
   * mapping: one source field cannot be split across two columns without
   * knowing which one the voucher prints from. That question is for SAPS.
   */
  Totalday: number;
  /**
   * CMTS `TotalFreeDays` int — the free allowance actually applied, all
   * sources combined. In this demo that is two separate grants added together:
   * `CARGOCLASS.freeDays`, and the zero-amount rate band the slab walk still
   * runs over. See `dayDecomposition`.
   */
  TotalFreeDays: number;
  /**
   * CMTS `ExtraFreeDays` int — the procedure's `@ExtraFreeDays`, a
   * per-invocation discretionary grant added on top of the derived free period.
   *
   * Zero on every row here, because the demo's charge path has no equivalent.
   * The schema audit equates it with the demo's `supplementDays`; that is
   * wrong, and this table is the proof — `SupplimentDays` is a separate column
   * two lines below, and the two move the bill in OPPOSITE directions.
   */
  ExtraFreeDays: number;
  /** CMTS `NormalDays` int — days that reached a non-zero rate band. */
  NormalDays: number;
  /** CMTS `SupplimentDays` int — [sic]. Extra billed days on a supplementary run. */
  SupplimentDays: number;

  /* --- the rate slab this row is ---------------------------------- */
  /** CMTS `DAYFROM` int — band lower bound, as defined by the rate table. */
  DAYFROM: number;
  /** CMTS `DAYTO` int — band upper bound; `OPEN_BAND_DAYTO` for the top band. */
  DAYTO: number;
  /**
   * CMTS `ChargesDaysNoOfDays` int — how many of THIS consignment's days fell
   * inside the band. Not `DAYTO − DAYFROM + 1`: the band is the rate table's,
   * the count is the consignment's, and a stay ending mid-band fills it partly.
   */
  ChargesDaysNoOfDays: number;
  /** CMTS `Unit` varchar(50) — the basis the band is charged on. */
  Unit: string;
  /** CMTS `ChargesAmount` float — the money this band produced. */
  ChargesAmount: Amount;

  /* --- location ---------------------------------------------------- */
  /** CMTS `LOCATIONNAME` varchar(500) — the zone name, alongside `LocationId`. */
  LOCATIONNAME: string;
  /**
   * CMTS `LOCATIONCHARGES` float — the zone fee this run applied.
   *
   * Zero on every row in this demo, and legitimately: `LOCATION_CHARGES` only
   * carries rate rows for hold zones, and the charge path takes no location
   * input at all (`locationChargePerDay` defaults to 0 and nothing passes it).
   */
  LOCATIONCHARGES: Amount;

  /* --- handling ---------------------------------------------------- */
  /** CMTS `Handlingchargesperkg` float — the rate, per chargeable kg. */
  Handlingchargesperkg: number;
  /** CMTS `HandlingchargesUnit` varchar(50) — the basis that rate is quoted on. */
  HandlingchargesUnit: string;
  /** CMTS `HandlingAmount` float — run-level roll-up, repeated on every row. */
  HandlingAmount: Amount;

  /* --- house line (consolidations) --------------------------------- */
  /** CMTS `IsHwb` bit — is this row a house line under a consol master? */
  IsHwb: boolean;
  /** CMTS `HWB` varchar(50) — the house waybill, null on a direct AWB. */
  HWB: string | null;
  /** CMTS `HWBSubIndexno` varchar(50) — the house's sub-index under the master. */
  HWBSubIndexno: string | null;
  /** CMTS `HWBPcs` int — pieces on the house line. */
  HWBPcs: number | null;
  /** CMTS `HWBChargeableWeight` float — the house's own chargeable weight. */
  HWBChargeableWeight: number | null;
  /** CMTS `HWBContents` varchar(500) — goods description on the house line. */
  HWBContents: string | null;

  /* --- run-level roll-ups, repeated on every row -------------------- */
  /** CMTS `StorageAmount` float — Σ `ChargesAmount` across the run's rows. */
  StorageAmount: Amount;
  /** CMTS `DECONSOLIDATIONCHARGES` float — waived by CMTS on a supplementary bill. */
  DECONSOLIDATIONCHARGES: Amount;
  /** CMTS `DOCUMENTATION` float. */
  DOCUMENTATION: Amount;
  /** CMTS `SpecialCharges` float — class-driven special handling. */
  SpecialCharges: Amount;
  /** CMTS `MiscellaneousCharges` float — ad-hoc, keyed by the operator. */
  MiscellaneousCharges: Amount;
  /**
   * CMTS `Taxpercentage` float. The legacy procedure selects it with
   * `WHERE t.IsDo = 0 AND t.ChargesType LIKE 'GD%'`; see `taxSelection`.
   */
  Taxpercentage: number;
  /** CMTS `totalAmount` float — the run's grand total, tax included. */
  totalAmount: Amount;
}

/** Every CMTS column modelled on the row, in declaration order. */
export const GR_CHARGE_COLUMNS: Array<keyof GrChargeRow> = [
  "cahrgesUniqueIdentification",
  "IGMNO",
  "AWBNO",
  "CARGODATE",
  "Cargoclass",
  "PcsOnAWB",
  "GrosssWeight",
  "Billtype",
  "IsSuppliment",
  "grFromDate",
  "grToDate",
  "fromdate",
  "endDate",
  "totalTime",
  "TotalDays",
  "Totalday",
  "TotalFreeDays",
  "ExtraFreeDays",
  "NormalDays",
  "SupplimentDays",
  "DAYFROM",
  "DAYTO",
  "ChargesDaysNoOfDays",
  "Unit",
  "ChargesAmount",
  "LOCATIONNAME",
  "LOCATIONCHARGES",
  "Handlingchargesperkg",
  "HandlingchargesUnit",
  "HandlingAmount",
  "IsHwb",
  "HWB",
  "HWBSubIndexno",
  "HWBPcs",
  "HWBChargeableWeight",
  "HWBContents",
  "StorageAmount",
  "DECONSOLIDATIONCHARGES",
  "DOCUMENTATION",
  "SpecialCharges",
  "MiscellaneousCharges",
  "Taxpercentage",
  "totalAmount",
];

/** The four surrogate keys deliberately left off the row — see the file header. */
export const GR_CHARGE_KEY_COLUMNS = ["HWBid", "ClassID", "SubClassId", "LocationId"] as const;

/* ================================================================== *
 * The working set — one engine run, its rows, and the AWB it hangs off
 * ================================================================== */

export interface GrChargesWorkingSet {
  /** CMTS `cahrgesUniqueIdentification`. */
  key: string;
  /** Every row the engine wrote in this pass, in walk order. */
  rows: GrChargeRow[];
  /** `rows[0]` — the header values, which repeat identically on every row. */
  head: GrChargeRow;

  /* --- resolved through the AWB, not stored on grCharges ---------- */
  awbId: number;
  AWBNO: string;
  site: SiteCode;
  /** CMTS `ClassID` resolved through the AWB rather than modelled. */
  cargoClassId: number;
  /** CMTS `SubClassId` resolved through the AWB rather than modelled. */
  cargoSubClassId: number;
  /** The chargeable weight the master was priced on. */
  chargeableKg: number;
  /**
   * The GR voucher this run was written onto — the same relation
   * `CHARGECALCULATER.VOUCHERNO` carries. Null means the engine ran but nothing
   * was billed from it, which is a real state and not missing data.
   */
  VOUCHERNO: string | null;
  /** Why this run exists, in one line, for the run picker. */
  purpose: string;
}

/* ================================================================== *
 * Day arithmetic
 * ================================================================== */

/**
 * Calendar-day difference, inclusive of both ends — the legacy procedure's
 * `DATEDIFF(day, CARGODATE, @enddate) + 1`.
 *
 * Anchored to a fixed +05:00 rather than the host timezone. Pakistan observes
 * no DST so the offset is exact, and a fixed offset is what keeps this number
 * identical on the server and in the browser — a local-timezone `Date` would
 * let the two renders disagree about how many days a consignment has been in
 * the shed, which is a hydration mismatch on a billing figure.
 */
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

function pktDayIndex(iso: string): number {
  return Math.floor((Date.parse(iso) + PKT_OFFSET_MS) / MS_PER_DAY);
}

export function calendarDaysInclusive(fromIso: string, toIso: string): number {
  return Math.max(0, pktDayIndex(toIso) - pktDayIndex(fromIso)) + 1;
}

/** Storage produced by walking the tariff bands out to `throughDay`. */
function storageThrough(throughDay: number, kg: number): Amount {
  if (throughDay <= 0) return 0;
  return round2(slabBreakdown(throughDay, kg).reduce((n, l) => n + l.amount, 0));
}

/* ================================================================== *
 * Derived readings — each one answers a question an operator asks
 * ================================================================== */

export interface DayDecomposition {
  /** CMTS `TotalDays`. */
  totalDays: number;
  /** CMTS `Totalday` — the twin. */
  totalday: number;
  /** True when the twins disagree; they never can while one source feeds both. */
  twinsDisagree: boolean;
  /** `CARGOCLASS.freeDays`, capped at the dwell actually elapsed. */
  graceUsed: number;
  /** Grace still unspent — non-zero means the cargo is inside its free period. */
  graceRemaining: number;
  /** Days the slab walk covered at a zero rate — the SECOND free grant. */
  slabFreeDays: number;
  /** CMTS `TotalFreeDays` as stored: grace + zero-rate band + `ExtraFreeDays`. */
  totalFreeDays: number;
  /** CMTS `ExtraFreeDays`. */
  extraFreeDays: number;
  /** CMTS `NormalDays` — days that reached a priced band. */
  normalDays: number;
  /** CMTS `SupplimentDays`. */
  supplimentDays: number;
  /** Should be 0. Non-zero means the parts do not add back to the whole. */
  residual: number;
  /** The class free allowance on its own, before the slab band adds more. */
  classFreeDays: number;
  /** What the CMTS rule alone would give: DAYTO of the zero-amount band + extra. */
  cmtsRuleFreeDays: number;
}

export function dayDecomposition(set: GrChargesWorkingSet): DayDecomposition {
  const h = set.head;
  const cls = cargoClass(set.cargoClassId);
  const classFreeDays = cls.freeDays;

  // Bands walked at zero money are the second free grant. Derived from the row
  // columns exactly the way the legacy procedure derives it — `case when
  // s.AMOUNT = 0 then s.DAYTO end` — rather than from a rate the table does
  // not carry.
  const zeroBands = distinctBands(set.rows).filter((b) => b.chargesAmount === 0 && b.days > 0);
  const slabFreeDays = zeroBands.reduce((n, b) => n + b.days, 0);
  const zeroBandDayTo = zeroBands.length > 0 ? Math.max(...zeroBands.map((b) => b.DAYTO)) : 0;

  const graceUsed = Math.min(classFreeDays, h.TotalDays);

  return {
    totalDays: h.TotalDays,
    totalday: h.Totalday,
    twinsDisagree: h.TotalDays !== h.Totalday,
    graceUsed,
    graceRemaining: Math.max(0, classFreeDays - h.TotalDays),
    slabFreeDays,
    totalFreeDays: h.TotalFreeDays,
    extraFreeDays: h.ExtraFreeDays,
    normalDays: h.NormalDays,
    supplimentDays: h.SupplimentDays,
    residual:
      h.TotalDays + h.SupplimentDays - (graceUsed + slabFreeDays + h.NormalDays),
    classFreeDays,
    cmtsRuleFreeDays: zeroBandDayTo + h.ExtraFreeDays,
  };
}

/**
 * One rate band, collapsed across the house lines that share it.
 *
 * There is no rate here and there is none on `grCharges` either. The table
 * carries the money and the day count; the rate is what divides out of them
 * against a chargeable weight the table also does not carry. That is worth
 * knowing — "what rate was I charged" is the first thing a consignee asks, and
 * this row cannot answer it on its own.
 */
export interface WalkedBand {
  DAYFROM: number;
  DAYTO: number;
  days: number;
  Unit: string;
  chargesAmount: Amount;
}

export function distinctBands(rows: GrChargeRow[]): WalkedBand[] {
  const out: WalkedBand[] = [];
  for (const r of rows) {
    let band = out.find((b) => b.DAYFROM === r.DAYFROM && b.DAYTO === r.DAYTO);
    if (!band) {
      band = {
        DAYFROM: r.DAYFROM,
        DAYTO: r.DAYTO,
        days: r.ChargesDaysNoOfDays,
        Unit: r.Unit,
        chargesAmount: 0,
      };
      out.push(band);
    }
    band.chargesAmount = round2(band.chargesAmount + r.ChargesAmount);
  }
  return out;
}

/* ------------------------------------------------------------------ *
 * The money ladder — roll-up against its parts
 * ------------------------------------------------------------------ */

export interface LadderRung {
  label: string;
  /** The CMTS column, or null where the rung has no column on this table. */
  cmts: string | null;
  amount: Amount;
  note?: string;
}

export interface MoneyLadder {
  /** The seven charge columns `grCharges` actually carries. */
  parts: LadderRung[];
  /** Σ parts — everything the row can account for on its own. */
  partsTotal: Amount;
  /** FC-07 §07 category surcharge. NO COLUMN on grCharges. */
  surcharge: Amount;
  surchargeLabel: string;
  /** Sub-total before the floor is tested. */
  raw: Amount;
  /** `CARGOSUBCLASS.MINCHARGES` — the floor. NO COLUMN on grCharges. */
  minimumCharges: Amount;
  /** How much the floor lifted the bill. Zero when it is dormant. */
  floorUplift: Amount;
  subTotal: Amount;
  Taxpercentage: number;
  taxAmount: Amount;
  /** Must equal the stored `totalAmount`. */
  derivedTotal: Amount;
  /** The stored roll-up. */
  totalAmount: Amount;
  /** derivedTotal − totalAmount. Zero when the ladder closes. */
  break: Amount;
  /** Share of `totalAmount` reconstructible from grCharges columns alone. */
  reconstructible: Amount;
  reconstructiblePct: number;
}

export function moneyLadder(set: GrChargesWorkingSet): MoneyLadder {
  const h = set.head;
  const sub = cargoSubClass(set.cargoSubClassId);

  const parts: LadderRung[] = [
    { label: "Storage (the band walk)", cmts: "StorageAmount", amount: h.StorageAmount },
    {
      label: "Handling",
      cmts: "HandlingAmount",
      amount: h.HandlingAmount,
      note: `${h.Handlingchargesperkg}/kg · ${h.HandlingchargesUnit}`,
    },
    {
      label: "Location charges",
      cmts: "LOCATIONCHARGES",
      amount: h.LOCATIONCHARGES,
      note: "the charge path takes no location input",
    },
    { label: "Documentation", cmts: "DOCUMENTATION", amount: h.DOCUMENTATION },
    {
      label: "Deconsolidation",
      cmts: "DECONSOLIDATIONCHARGES",
      amount: h.DECONSOLIDATIONCHARGES,
      note: h.IsSuppliment ? "CMTS waives this on a supplementary bill" : undefined,
    },
    { label: "Special handling", cmts: "SpecialCharges", amount: h.SpecialCharges },
    { label: "Miscellaneous", cmts: "MiscellaneousCharges", amount: h.MiscellaneousCharges },
  ];

  const partsTotal = round2(parts.reduce((n, p) => n + p.amount, 0));

  const surcharges = surchargesFor(set.cargoClassId, h.StorageAmount);
  const surcharge = round2(surcharges.reduce((n, s) => n + s.amount, 0));
  const surchargeLabel =
    surcharges.length === 0
      ? "none for this class"
      : surcharges.map((s) => `${s.code} ${s.percent}%`).join(" + ");

  const raw = round2(partsTotal + surcharge);
  const minimumCharges = sub.MINCHARGES;
  const subTotal = round2(Math.max(raw, minimumCharges));
  const floorUplift = round2(subTotal - raw);
  const taxAmount = round2((subTotal * h.Taxpercentage) / 100);
  const derivedTotal = round2(subTotal + taxAmount);

  const reconstructible = round2(partsTotal * (1 + h.Taxpercentage / 100));

  return {
    parts,
    partsTotal,
    surcharge,
    surchargeLabel,
    raw,
    minimumCharges,
    floorUplift,
    subTotal,
    Taxpercentage: h.Taxpercentage,
    taxAmount,
    derivedTotal,
    totalAmount: h.totalAmount,
    break: round2(derivedTotal - h.totalAmount),
    reconstructible,
    reconstructiblePct:
      h.totalAmount === 0 ? 100 : Math.round((reconstructible / h.totalAmount) * 100),
  };
}

/* ------------------------------------------------------------------ *
 * The bridge — what the CMTS procedure would have walked instead
 *
 * Two rules differ, they compound, and they push the same way. Bridging in
 * two named steps rather than printing one gap means a reader can accept one
 * and reject the other; a single number invites accepting or rejecting both.
 *
 * SURFACED, NOT RECONCILED. Nothing here changes a demo calculation, and the
 * CMTS side is what the procedure WOULD produce, not a verified figure — the
 * restored database is schema-only, so `TARIFF_SLABS` stands in for
 * `CARGOSUBCLASSCHARGES`, whose rows nobody has. Audit §5 Q1 asks SAPS to
 * confirm the inclusive count before any of this is acted on.
 * ------------------------------------------------------------------ */

export interface CmtsBridge {
  chargeableKg: number;
  /** As billed: dwell from cargo intake, floor of elapsed 24h periods. */
  demoDwellDays: number;
  /** Same counting rule, but measured from `CARGODATE` like the procedure. */
  dwellFromCargoDate: number;
  /** The procedure's own count: calendar days from `CARGODATE`, both ends. */
  cmtsDwellDays: number;
  /** Hours between `CARGODATE` and `fromdate` — the ramp gap, never billed here. */
  rampGapHours: number;

  /** Storage as billed. */
  demoStorage: Amount;
  /** Same dwell, but bands walked over the whole stay rather than after the grace. */
  storageWithoutDoubleGrace: Amount;
  /** The procedure's figure: its own dwell, its own free derivation. */
  cmtsStorage: Amount;

  /** cmtsStorage − demoStorage. */
  gap: Amount;
  freeRuleGap: Amount;
  dayCountGap: Amount;
  /** Demo storage as a share of the CMTS figure. */
  billedPct: number;
}

export function cmtsBridge(set: GrChargesWorkingSet): CmtsBridge {
  const h = set.head;
  const kg = set.chargeableKg;

  const demoDwellDays = h.TotalDays;
  const dwellFromCargoDate = daysBetween(h.CARGODATE, h.endDate);
  const cmtsDwellDays = calendarDaysInclusive(h.CARGODATE, h.endDate);

  // The demo subtracts CARGOCLASS.freeDays before walking, then walks a band
  // table whose first band is free — so the grace is granted twice. Walking
  // the same dwell without that first subtraction isolates the difference.
  const demoStorage = h.StorageAmount;
  const storageWithoutDoubleGrace = storageThrough(demoDwellDays + h.SupplimentDays, kg);
  const cmtsStorage = storageThrough(cmtsDwellDays + h.SupplimentDays, kg);

  const gap = round2(cmtsStorage - demoStorage);

  return {
    chargeableKg: kg,
    demoDwellDays,
    dwellFromCargoDate,
    cmtsDwellDays,
    rampGapHours: Math.round((Date.parse(h.fromdate) - Date.parse(h.CARGODATE)) / 3_600_000),
    demoStorage,
    storageWithoutDoubleGrace,
    cmtsStorage,
    gap,
    freeRuleGap: round2(storageWithoutDoubleGrace - demoStorage),
    dayCountGap: round2(cmtsStorage - storageWithoutDoubleGrace),
    billedPct: cmtsStorage === 0 ? 100 : Math.round((demoStorage / cmtsStorage) * 100),
  };
}

/* ------------------------------------------------------------------ *
 * House lines
 * ------------------------------------------------------------------ */

export interface HouseLine {
  HWB: string;
  HWBSubIndexno: string | null;
  HWBPcs: number;
  HWBChargeableWeight: number;
  HWBContents: string;
  /** Σ `ChargesAmount` on this house's rows. */
  storageShare: Amount;
}

export interface HouseRollUp {
  lines: HouseLine[];
  piecesOnLines: number;
  /** CMTS `PcsOnAWB`. */
  piecesOnAwb: number;
  piecesAgree: boolean;
  weightOnLines: number;
  /** The weight the master was priced on. */
  masterChargeableKg: number;
  weightDelta: number;
}

export function houseRollUp(set: GrChargesWorkingSet): HouseRollUp {
  const lines: HouseLine[] = [];
  for (const r of set.rows) {
    if (!r.IsHwb || !r.HWB) continue;
    let line = lines.find((l) => l.HWB === r.HWB);
    if (!line) {
      line = {
        HWB: r.HWB,
        HWBSubIndexno: r.HWBSubIndexno,
        HWBPcs: r.HWBPcs ?? 0,
        HWBChargeableWeight: r.HWBChargeableWeight ?? 0,
        HWBContents: r.HWBContents ?? "",
        storageShare: 0,
      };
      lines.push(line);
    }
    line.storageShare = round2(line.storageShare + r.ChargesAmount);
  }

  const piecesOnLines = lines.reduce((n, l) => n + l.HWBPcs, 0);
  const weightOnLines = round2(lines.reduce((n, l) => n + l.HWBChargeableWeight, 0));

  return {
    lines,
    piecesOnLines,
    piecesOnAwb: set.head.PcsOnAWB,
    piecesAgree: lines.length === 0 || piecesOnLines === set.head.PcsOnAWB,
    weightOnLines,
    masterChargeableKg: set.chargeableKg,
    weightDelta: round2(weightOnLines - set.chargeableKg),
  };
}

/* ------------------------------------------------------------------ *
 * Denormalisation — which of the 43 columns actually vary
 * ------------------------------------------------------------------ */

export interface ColumnVariance {
  varying: Array<keyof GrChargeRow>;
  constant: Array<keyof GrChargeRow>;
  rowCount: number;
}

export function columnVariance(set: GrChargesWorkingSet): ColumnVariance {
  const varying: Array<keyof GrChargeRow> = [];
  const constant: Array<keyof GrChargeRow> = [];
  for (const col of GR_CHARGE_COLUMNS) {
    const first = set.rows[0][col];
    (set.rows.every((r) => r[col] === first) ? constant : varying).push(col);
  }
  return { varying, constant, rowCount: set.rows.length };
}

/* ------------------------------------------------------------------ *
 * Tax selection — audit §3.5
 * ------------------------------------------------------------------ */

export interface TaxSelection {
  /** The rate actually applied, from the row. */
  applied: number;
  /** Rows in `TaxType` the legacy predicate would select. */
  matches: number;
  /** Rows with `IsDo = 0` — the godown-rent side, before `ChargesType` narrows it. */
  godownRentCandidates: number;
  predicate: string;
}

export function taxSelection(set: GrChargesWorkingSet): TaxSelection {
  const godownRentCandidates = TAX_TYPES.filter((t) => !t.IsDo);
  return {
    applied: set.head.Taxpercentage,
    matches: godownRentCandidates.filter((t) => t.ChargesType.startsWith("GD")).length,
    godownRentCandidates: godownRentCandidates.length,
    predicate: "IsDo = 0 AND ChargesType LIKE 'GD%'",
  };
}

/* ------------------------------------------------------------------ *
 * Location — audit §3.3 / §3.4
 * ------------------------------------------------------------------ */

export interface LocationReading {
  /** CMTS `LOCATIONNAME`, as stored on the row. */
  LOCATIONNAME: string;
  /** Where the cargo physically is, when that differs from the logical zone. */
  physicalName: string | null;
  diverged: boolean;
  divergenceReason: string | null;
  /** Zones in the demo that carry no `LOCATIONCHARGES` rate row at all. */
  zonesWithoutRate: number;
  zonesTotal: number;
}

export function locationReading(set: GrChargesWorkingSet): LocationReading {
  const loc = AWB_LOCATIONS.find((l) => l.AWBNO === set.AWBNO) ?? null;
  const diverged = !!loc && loc.LOGICALLOCATIONID !== loc.PHYSICALLOCATIONID;
  const priced = new Set(LOCATION_CHARGES.map((c) => c.LOCATIONID));

  return {
    LOCATIONNAME: set.head.LOCATIONNAME,
    physicalName: diverged ? (storageLocation(loc!.PHYSICALLOCATIONID)?.NAME ?? null) : null,
    diverged,
    divergenceReason: loc?.divergenceReason ?? null,
    zonesWithoutRate: STORAGE_LOCATIONS.filter((l) => !priced.has(l.ID)).length,
    zonesTotal: STORAGE_LOCATIONS.length,
  };
}

/* ------------------------------------------------------------------ *
 * The disagreement register
 *
 * Six rules from CMTS_SCHEMA_AUDIT §3, each measured against THIS run rather
 * than narrated in the abstract. A disagreement a reader can see priced on the
 * consignment in front of them is a decision they can take; one described in
 * general terms is a paragraph they skip.
 * ------------------------------------------------------------------ */

export interface RuleDisagreement {
  ref: string;
  rule: string;
  columns: string[];
  cmts: string;
  demo: string;
  /** What it does to this run, in numbers. */
  effect: string;
  severity: "money" | "risk" | "unexercised";
}

export function ruleDisagreements(set: GrChargesWorkingSet): RuleDisagreement[] {
  const h = set.head;
  const b = cmtsBridge(set);
  const d = dayDecomposition(set);
  const tax = taxSelection(set);
  const loc = locationReading(set);
  const pkr = formatPkr;

  return [
    {
      ref: "§3.1",
      rule: "Dwell is counted in calendar days, inclusive of both ends",
      columns: ["CARGODATE", "endDate", "TotalDays", "totalTime"],
      cmts: "DATEDIFF(day, CARGODATE, @enddate) + 1",
      demo: "floor of elapsed 24-hour periods, measured from cargo intake",
      effect:
        b.cmtsDwellDays === b.demoDwellDays
          ? `Both read ${b.demoDwellDays} days on this run.`
          : `${b.demoDwellDays} days billed against ${b.cmtsDwellDays} in CMTS — ${b.cmtsDwellDays - b.demoDwellDays} day(s), worth ${pkr(b.dayCountGap)} of storage.`,
      severity: b.dayCountGap > 0 ? "money" : "risk",
    },
    {
      ref: "§3.2",
      rule: "Free days come from the zero-amount rate row, not from the cargo class",
      columns: ["TotalFreeDays", "ExtraFreeDays", "DAYFROM", "DAYTO", "ChargesAmount"],
      cmts: "case when s.AMOUNT = 0 then (s.DAYTO + @ExtraFreeDays) end — per subclass × location × weight band",
      demo: "CARGOCLASS.freeDays, one number per class, subtracted BEFORE the band walk",
      effect:
        d.slabFreeDays > 0
          ? `Granted twice here: ${d.classFreeDays}d from the class and ${d.slabFreeDays}d more from the zero-amount band = ${d.classFreeDays + d.slabFreeDays}d free, against ${d.cmtsRuleFreeDays}d under the CMTS rule. Worth ${pkr(b.freeRuleGap)}.`
          : `The stay has not reached a priced band, so the double grant does not bite on this run.`,
      severity: b.freeRuleGap > 0 ? "money" : "risk",
    },
    {
      ref: "§3.3",
      rule: "Rates band by weight as well as by day",
      columns: ["DAYFROM", "DAYTO", "GrosssWeight", "HWBChargeableWeight"],
      cmts: "l.WEIGHT between s.WEIGHTFROM and s.WEIGHTTO, on both rate tables",
      demo: "bands by day only, then multiplies the band by chargeable weight",
      effect: `This run priced ${b.chargeableKg.toLocaleString("en-PK")} kg through day bands alone. WEIGHTFROM / WEIGHTTO are typed in the demo and never priced, so no weight band was selected.`,
      severity: "risk",
    },
    {
      ref: "§3.4",
      rule: "Billing follows the LOGICAL location, not the physical one",
      columns: ["LOCATIONNAME", "LOCATIONCHARGES"],
      cmts: "joins CARGOSUBCLASSLOCATION on LOGICALLOCATIONID and prices that zone",
      demo: "charge path takes no location input at all; LOCATIONCHARGES is 0 on every row",
      effect: loc.diverged
        ? `This consignment is logically in ${loc.LOCATIONNAME} and physically in ${loc.physicalName}. Neither is priced — ${loc.zonesWithoutRate} of ${loc.zonesTotal} zones carry no rate row.`
        : `Logical and physical zones agree here (${loc.LOCATIONNAME}), but neither is priced — ${loc.zonesWithoutRate} of ${loc.zonesTotal} zones carry no rate row.`,
      severity: "risk",
    },
    {
      ref: "§3.5",
      rule: "There are two tax rates and the godown-rent one is selected by name",
      columns: ["Taxpercentage"],
      cmts: `select Amount from TaxType where ${tax.predicate}`,
      demo: `a single rate of ${tax.applied}%, passed on the calculation rather than looked up`,
      effect: `The legacy predicate matches ${tax.matches} row(s) against this demo's tax master — ${tax.godownRentCandidates} rows carry IsDo = 0 and nothing distinguishes which is the godown-rent one.`,
      severity: "risk",
    },
    {
      ref: "§3.6",
      rule: "Deconsolidation is waived on a supplementary bill",
      columns: ["Billtype", "IsSuppliment", "DECONSOLIDATIONCHARGES"],
      cmts: "case when @IsSuppliment = 'Suppliment' then 0 else CARGOCLASS.DECONSOLIDATIONCHARGES end",
      demo: "no bill type reaches the charge path, so deconsolidation is charged every time",
      effect: h.IsSuppliment
        ? `This IS a supplementary run and it re-charges ${pkr(h.DECONSOLIDATIONCHARGES)} of deconsolidation. CMTS would bill 0.`
        : h.DECONSOLIDATIONCHARGES > 0
          ? `A normal run, so ${pkr(h.DECONSOLIDATIONCHARGES)} is correctly charged. It would be charged again on a supplementary bill.`
          : `This class carries no deconsolidation charge, so the rule is dormant here.`,
      severity: h.IsSuppliment && h.DECONSOLIDATIONCHARGES > 0 ? "money" : "unexercised",
    },
  ];
}

/**
 * Column-level findings — the ones that live in the schema rather than in the
 * arithmetic. These do not vary by run, so they are stated once.
 */
export interface ColumnAmbiguity {
  columns: string[];
  finding: string;
  question: string;
}

export const COLUMN_AMBIGUITIES: ColumnAmbiguity[] = [
  {
    columns: ["TotalDays", "Totalday"],
    finding:
      "Two int columns for the dwell, differing only in case and plural, with nothing in the schema separating them. The demo has one dwell number and writes it to both.",
    question: "Which of the two does the printed voucher read?",
  },
  {
    columns: ["grFromDate", "grToDate", "fromdate", "endDate"],
    finding:
      "Two overlapping date ranges on the same row. Read here as the voucher period and the priced window, which is a reading and not a documented fact.",
    question: "Is grFromDate/grToDate the GR period, and fromdate/endDate the run window?",
  },
  {
    columns: ["ExtraFreeDays", "SupplimentDays"],
    finding:
      "The schema audit treats @ExtraFreeDays as the demo's supplementDays. Both columns are on this table, and they move the bill in opposite directions — extra free days reduce it, supplement days increase it.",
    question: "Who grants @ExtraFreeDays, and is it audited anywhere? (audit §5 Q2)",
  },
  {
    columns: ["Billtype", "IsSuppliment"],
    finding:
      "The same fact typed twice — a varchar and a bit — and the procedure branches on the STRING literal 'Suppliment'. Under a case-sensitive collation the string decides the bill and the bit is ignored.",
    question: "Which is authoritative when the two disagree on a legacy row?",
  },
  {
    columns: ["totalTime"],
    finding:
      "An int with no unit in its name and no unit anywhere in the schema. Modelled as hours; if CMTS stores minutes every value is 60× out.",
    question: "Hours, minutes or seconds?",
  },
  {
    columns: ["DAYTO"],
    finding:
      "int, so the open-ended top band cannot hold the null the demo's TariffSlab uses. Written as a 9999 sentinel here. BETWEEN behaves completely differently against 9999 and against NULL.",
    question: "What do legacy rows carry for the open band?",
  },
  {
    columns: [
      "GrosssWeight",
      "SupplimentDays",
      "IsSuppliment",
      "cahrgesUniqueIdentification",
    ],
    finding:
      "Four misspellings, reproduced exactly. Parity is checked by column name, so correcting any of them would make a mapped column read as unmapped.",
    question: "Confirm none of these were fixed in a later CMTS release.",
  },
  {
    columns: ["HWBid", "ClassID", "SubClassId", "LocationId"],
    finding:
      "Four surrogate keys, deliberately not modelled — this prototype has no backend for them to key, and the table carries HWB, Cargoclass and LOCATIONNAME as their readable twins.",
    question: "None — recorded so the 47-column count reconciles.",
  },
  {
    columns: ["CreatedBy", "CreatedOn", "UpdatedBy", "UpdatedOn"],
    finding:
      "grCharges carries no audit columns at all. The table that records how money was computed cannot say who ran the engine or when.",
    question: "Is the working set retained between runs, or overwritten in place?",
  },
];

/* ================================================================== *
 * Fixtures — deterministic, derived from the existing charge calculations
 * ================================================================== */

/** `calculateCharges` defaults handling to 12/kg and nothing overrides it. */
const HANDLING_RATE_PER_KG = 12;
const HANDLING_UNIT = "PER KG";
const STORAGE_UNIT = "PER KG / DAY";

/** Days added on a supplementary run — one value, so the demo stays walkable. */
const SUPPLEMENT_DAYS = 4;

/**
 * The volumetric envelope `CHARGE_CALCULATIONS` prices every AWB through
 * (120 × 80 × 90 cm ÷ 6000). Repeated here only for the consolidation quote,
 * which has no calculation of its own yet — so the quote is priced on exactly
 * the same basis as every committed run beside it.
 */
const FIXTURE_VOLUMETRIC_KG = round2((120 * 80 * 90) / 6000);

/**
 * Allocate a run-level amount across house lines by chargeable weight, exactly.
 *
 * Same rule as `splitExact` in the fixture module and for the same reason: an
 * independently rounded share can drop half a paisa per line, and a grid that
 * does not add back to the roll-up printed above it is worse than no roll-up —
 * it looks authoritative and is wrong. The residue goes to the last line, which
 * is how the allocation is done on paper.
 */
function allocate(total: number, shares: number[]): number[] {
  if (shares.length === 1) return [round2(total)];
  const sum = shares.reduce((n, s) => n + s, 0);
  const out = shares.map((s) => (sum === 0 ? round2(total / shares.length) : round2((total * s) / sum)));
  const drift = round2(total - out.reduce((n, x) => n + x, 0));
  out[out.length - 1] = round2(out[out.length - 1] + drift);
  return out;
}

interface SetSpec {
  key: string;
  awb: AWB;
  calc: ChargeCalculation;
  VOUCHERNO: string | null;
  Billtype: BillType;
  IsSuppliment: boolean;
  SupplimentDays: number;
  grFromDate: string | null;
  grToDate: string | null;
  houses: HouseAWB[];
  purpose: string;
}

function buildSet(spec: SetSpec): GrChargesWorkingSet {
  const { awb, calc } = spec;
  const cls = cargoClass(awb.CARGOCLASSID);
  const loc = awb.locationId !== null ? storageLocation(awb.locationId) : undefined;

  const slabFreeDays = calc.slabLines
    .filter((l) => l.ratePerKgPerDay === 0)
    .reduce((n, l) => n + l.daysInBand, 0);
  const normalDays = calc.slabLines
    .filter((l) => l.ratePerKgPerDay > 0)
    .reduce((n, l) => n + l.daysInBand, 0);

  // The header block, identical on every row the run writes. This repetition
  // IS the table's shape — see `columnVariance`, which measures it.
  const header = {
    cahrgesUniqueIdentification: spec.key,
    IGMNO: awb.IGMNO,
    AWBNO: awb.AWBNO,
    CARGODATE: awb.CARGODATE,
    Cargoclass: cls.NAME,
    PcsOnAWB: awb.TOTALPCS,
    GrosssWeight: awb.TOTALWEIGHT,
    Billtype: spec.Billtype,
    IsSuppliment: spec.IsSuppliment,
    grFromDate: spec.grFromDate,
    grToDate: spec.grToDate,
    fromdate: calc.clockStartedAt,
    endDate: calc.calculatedAt,
    totalTime: Math.round(
      (Date.parse(calc.calculatedAt) - Date.parse(calc.clockStartedAt)) / 3_600_000,
    ),
    TotalDays: calc.totalDays,
    // Written from the same source as TotalDays — see the field comment.
    Totalday: calc.totalDays,
    TotalFreeDays: cls.freeDays + slabFreeDays,
    ExtraFreeDays: 0,
    NormalDays: normalDays,
    SupplimentDays: spec.SupplimentDays,
    LOCATIONNAME: loc?.NAME ?? "UNALLOCATED",
    LOCATIONCHARGES: calc.locationChargesAmount,
    Handlingchargesperkg: HANDLING_RATE_PER_KG,
    HandlingchargesUnit: HANDLING_UNIT,
    HandlingAmount: calc.handlingAmount,
    IsHwb: spec.houses.length > 0,
    StorageAmount: calc.storageAmount,
    DECONSOLIDATIONCHARGES: calc.deconsolidationCharges,
    DOCUMENTATION: calc.documentationCharges,
    SpecialCharges: calc.specialHandlingCharges,
    MiscellaneousCharges: calc.miscellaneousCharges,
    Taxpercentage: calc.taxPercent,
    totalAmount: calc.total,
  };

  // One pseudo-line for a direct AWB, one per house for a consolidation. CMTS
  // prices a consol house by house, so the walk repeats under each.
  const lines: Array<HouseAWB | null> = spec.houses.length > 0 ? spec.houses : [null];
  const shares =
    spec.houses.length > 0 ? spec.houses.map((h) => h.CHARGEDWEIGH) : [1];

  const rows: GrChargeRow[] = [];

  // A stay still inside its free period walks no band at all — `slabBreakdown`
  // returns nothing. The run still exists and still has to be recorded, so it
  // writes one row against the first band with zero days in it. That is the
  // truthful shape: the band was looked at and nothing fell into it.
  const walked =
    calc.slabLines.length > 0
      ? calc.slabLines
      : [
          {
            label: TARIFF_SLABS[0].label,
            DAYFROM: TARIFF_SLABS[0].DAYFROM,
            DAYTO: TARIFF_SLABS[0].DAYTO,
            daysInBand: 0,
            ratePerKgPerDay: TARIFF_SLABS[0].ratePerKgPerDay,
            chargeableKg: calc.chargeableKg,
            amount: 0,
          },
        ];

  for (const band of walked) {
    const parts = allocate(band.amount, shares);
    lines.forEach((house, li) => {
      rows.push({
        ...header,
        DAYFROM: band.DAYFROM,
        DAYTO: band.DAYTO ?? OPEN_BAND_DAYTO,
        ChargesDaysNoOfDays: band.daysInBand,
        Unit: STORAGE_UNIT,
        ChargesAmount: parts[li],
        HWB: house?.HWB ?? null,
        HWBSubIndexno: house?.SUBINDEX ?? null,
        HWBPcs: house?.PCS ?? null,
        HWBChargeableWeight: house?.CHARGEDWEIGH ?? null,
        HWBContents: house?.CONTENTS ?? null,
      });
    });
  }

  return {
    key: spec.key,
    rows,
    head: rows[0],
    awbId: awb.AWBId,
    AWBNO: awb.AWBNO,
    site: awb.site,
    cargoClassId: awb.CARGOCLASSID,
    cargoSubClassId: awb.cargoSubClassId,
    chargeableKg: calc.chargeableKg,
    VOUCHERNO: spec.VOUCHERNO,
    purpose: spec.purpose,
  };
}

/**
 * Every working set the demo carries, in three flavours.
 *
 *   1. COMMITTED — one per GODOWNRENT voucher. The run whose arithmetic the
 *      voucher printed, carrying that voucher's number and GR period.
 *   2. SUPPLEMENTARY — a re-run with a supplement grant. Deliberately
 *      uncommitted, because NO GODOWNRENT row in this demo carries
 *      BILLTYPE = SUPPLIMENT: the supplementary path exists in the schema and
 *      has never been exercised, which is exactly why audit §3.6 has been
 *      invisible. Seeded once per site so the finding is reachable in any scope.
 *   3. QUOTE — the consolidation. It has not reached `charged`, so no voucher
 *      and no ChargeCalculation exist for it, and the engine is run here as a
 *      live quote. It is the only run in the set with house lines, and without
 *      it six of the 43 columns would be null everywhere.
 */
export const GR_CHARGE_SETS: GrChargesWorkingSet[] = (() => {
  const sets: GrChargesWorkingSet[] = [];

  for (const g of GODOWN_RENTS) {
    const awb = awbByNo(g.AWBNO);
    const calc = awb ? chargesFor(awb.AWBId) : undefined;
    if (!awb || !calc) continue;
    sets.push(
      buildSet({
        key: `${awb.AWBNO}-CHG-01`,
        awb,
        calc,
        VOUCHERNO: g.VOUCHERNO,
        Billtype: "NORMAL",
        IsSuppliment: false,
        SupplimentDays: 0,
        grFromDate: g.FROMDATE,
        grToDate: g.TODATE,
        houses: [],
        purpose: `Priced onto voucher ${g.VOUCHERNO}`,
      }),
    );
  }

  // --- 2. the supplementary re-runs ---------------------------------
  const seenSites = new Set<SiteCode>();
  for (const g of GODOWN_RENTS) {
    if (seenSites.has(g.site)) continue;
    const awb = awbByNo(g.AWBNO);
    const base = awb ? chargesFor(awb.AWBId) : undefined;
    if (!awb || !base) continue;
    // Only worth seeding where deconsolidation is actually charged, since that
    // is the rule the supplementary path turns off.
    if (cargoClass(awb.CARGOCLASSID).DECONSOLIDATIONCHARGES <= 0) continue;
    seenSites.add(g.site);

    const supp = calculateCharges({
      awbId: awb.AWBId,
      arrivalAt: base.arrivalAt,
      intakeAt: base.clockStartedAt,
      asOf: base.calculatedAt,
      cargoClassId: awb.CARGOCLASSID,
      cargoSubClassId: awb.cargoSubClassId,
      actualKg: base.actualKg,
      volumetricKg: base.volumetricKg,
      supplementDays: SUPPLEMENT_DAYS,
      calculatedAt: base.calculatedAt,
      voucherNo: null,
    });

    sets.push(
      buildSet({
        key: `${awb.AWBNO}-CHG-02`,
        awb,
        calc: supp,
        VOUCHERNO: null,
        Billtype: "SUPPLIMENT",
        IsSuppliment: true,
        SupplimentDays: SUPPLEMENT_DAYS,
        grFromDate: null,
        grToDate: null,
        houses: [],
        purpose: `Supplementary re-run, +${SUPPLEMENT_DAYS} days — no voucher raised`,
      }),
    );
  }

  // --- 3. the consolidation quote -----------------------------------
  const consol = AWBS.find((a) => a.IsHwb);
  const houses = consol ? HOUSE_AWBS.filter((h) => h.AWBNO === consol.AWBNO) : [];
  if (consol && houses.length > 0) {
    const quote = calculateCharges({
      awbId: consol.AWBId,
      arrivalAt: consol.arrivedAt,
      intakeAt: consol.intakeAt,
      asOf: DEMO_NOW,
      cargoClassId: consol.CARGOCLASSID,
      cargoSubClassId: consol.cargoSubClassId,
      actualKg: consol.TOTALWEIGHT,
      volumetricKg: FIXTURE_VOLUMETRIC_KG,
      calculatedAt: DEMO_NOW,
      voucherNo: null,
    });
    sets.push(
      buildSet({
        key: `${consol.AWBNO}-CHG-01`,
        awb: consol,
        calc: quote,
        VOUCHERNO: null,
        Billtype: "NORMAL",
        IsSuppliment: false,
        SupplimentDays: 0,
        grFromDate: null,
        grToDate: null,
        houses,
        purpose: `Live quote — ${houses.length} house lines, not yet billed`,
      }),
    );
  }

  return sets;
})();

/** Every row across every run — the table as CMTS would hold it. */
export const GR_CHARGES: GrChargeRow[] = GR_CHARGE_SETS.flatMap((s) => s.rows);

/** Scoped through the parent AWB — `grCharges` carries no site column. */
export function listGrChargeSets(scope: SiteScope = "HQ"): GrChargesWorkingSet[] {
  return scope === "HQ" ? GR_CHARGE_SETS : GR_CHARGE_SETS.filter((s) => s.site === scope);
}

export function grChargeSet(key: string): GrChargesWorkingSet | undefined {
  return GR_CHARGE_SETS.find((s) => s.key === key);
}
