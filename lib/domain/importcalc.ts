/**
 * AirVault domain — the OTHER TWO charge working sets.
 *
 *   CMTS `TempImportCalculation`  (38 business columns) — temporary import
 *   CMTS `ImportFreeHandedCalc`   (22 business columns) — free-hand / keyed
 *
 * WHY THESE ARE HERE AND NOT CLOSED
 * ---------------------------------
 * `CMTS_SCOPE_DECISIONS.md` Q8 settles it. Both tables are backend-era working
 * state — and so is `grCharges`, which already has a derivation view at
 * `/billing/charge-working-set`. All three record HOW a charge was computed,
 * for three different billing paths:
 *
 *   `grCharges`              standard import godown rent   → grcharges.ts
 *   `TempImportCalculation`  temporary import              → this file
 *   `ImportFreeHandedCalc`   free-hand / manually keyed    → this file
 *
 * So they are additional TABS on the one derivation screen. Never presented as
 * documents an operator files — only as the audit trail behind a number that is
 * already on a voucher.
 *
 * THE SPELLINGS ARE DELIBERATE — AND THEY ARE THIS TABLE'S SPELLINGS
 * -----------------------------------------------------------------
 * `StorgeUnit` (not Storage), `SUPPLIMENTDAYS`, `IsSuppliment` (one p, i not e),
 * `Freedays` (one word), `NumberofDays` (lower-case o), `ISFree`, and the eight
 * `sum`-prefixed roll-ups are reproduced exactly as CMTS spells them ON THESE
 * TWO TABLES. Naming parity is measured per table: `GODOWNRENT` spells the
 * supplement column `SUPPLIMENTDAYS` and `grCharges` spells it `SupplimentDays`,
 * and both are right on their own row. Nothing here is upper-cased to match a
 * neighbour, and no upper-case twin is added beside an existing field — that
 * compiles and then silently splits one column across two.
 *
 * `TaxPercentage` is `varchar` on both tables while `Tax` beside it is a float.
 * It is typed `string` here for that reason and not "cleaned up" — see
 * `taxPercentageReading`, which is the whole point.
 *
 * WHAT IS DELIBERATELY NOT MODELLED
 * ---------------------------------
 * Four columns on each table are surrogate keys and out of scope for a
 * prototype with no backend to key them: `CargoClassID`, `CargoSubClassID`,
 * `CargoLocationId`, `CargoSubClassLocationId`. Same treatment `grcharges.ts`
 * gives `HWBid` / `ClassID` / `SubClassId` / `LocationId`, and for the same
 * reason — class, subclass and zone resolve through the AWB, which is how the
 * rest of this repo joins. 34 + 4 = 38 and 18 + 4 = 22.
 *
 * `CityId` IS modelled, and that is not an exception to the rule so much as a
 * different kind of column. It is not a surrogate row key; it is the tenancy
 * discriminator the entire repo scopes on (`SiteKeys.CityId` in `./common`,
 * also carried on `TaxType` and `GODOWNRENTDUPLICATE`). It also happens to be
 * the single most interesting column on either table, because `grCharges` has
 * no site column at all and scopes through its parent AWB — these two scope
 * themselves. See `KEYING`.
 *
 * KEYING — NEITHER TABLE HAS AN AWB COLUMN
 * ----------------------------------------
 * `grCharges` carries `AWBNO` and `IGMNO`, so a row can always be walked back
 * to the consignment it priced. Neither of these two does. `TempImportCalculation`
 * carries `HWB` — the HOUSE bill — and nothing for the master; `ImportFreeHandedCalc`
 * carries no cargo identifier whatsoever. Both key on `UniqueIdentification`,
 * the varchar correlator this schema spreads across a dozen tables.
 *
 * Three things follow, and all three are migration findings rather than
 * presentation details:
 *
 *   1. The join back to the consignment is a varchar with no declared foreign
 *      key. If the correlator is blank, duplicated or re-used across sites, the
 *      derivation is orphaned — and an orphaned derivation is a charge nobody
 *      can explain, on a voucher that has already been paid.
 *   2. `CityId` is therefore load-bearing rather than decorative. It is the only
 *      thing narrowing a correlator collision to one site.
 *   3. A temporary import of a CONSOLIDATION can name its houses and cannot name
 *      its master. The one identifier the voucher prints is the one the working
 *      set does not hold.
 *
 * IMPORT NOTE
 * -----------
 * Deliberately NOT re-exported from `lib/domain/index.ts`, for the same reason
 * `grcharges.ts` is not: the barrel is a shared-conflict file while several
 * tickets are landing domain modules in the same window. The one screen that
 * reads this imports `@/lib/domain/importcalc` directly.
 */

import {
  daysBetween,
  round2,
  type Amount,
  type SiteCode,
  type SiteScope,
} from "./common";
import {
  cargoClass,
  cargoSubClass,
  site,
  storageLocation,
} from "./masters";
import { calculateCharges, surchargesFor, type ChargeCalculation } from "./finance";
import { AWBS, GODOWN_RENTS, HOUSE_AWBS, awbByNo, chargesFor } from "./fixtures";
import { calendarDaysInclusive } from "./grcharges";
import type { AWB, HouseAWB } from "./cargo";

/* ================================================================== *
 * The two rows
 * ================================================================== */

/**
 * CMTS `TempImportCalculation` — 34 of 38 business columns.
 *
 * The row granularity is NOT the rate band. There is no `DAYFROM` and no
 * `DAYTO` anywhere on this table, so unlike `grCharges` it cannot record the
 * slab walk at all: it records the OUTCOME of the walk, once per storage line.
 * A temporary-import charge can therefore be explained down to "this much
 * storage, over this many days, on this weight" and no further. That is one
 * whole level of derivation less than the standard path offers, on the path
 * where the cargo is most likely to be disputed.
 */
export interface TempImportCalculationRow {
  /* --- identity ---------------------------------------------------- */
  /**
   * CMTS `UniqueIdentification` varchar — the batch key, and the ONLY thing
   * tying a run's rows together or tying the run to a consignment. There is no
   * AWB column on this table.
   */
  UniqueIdentification: string;
  /**
   * CMTS `VoucherNumber` varchar — the `GODOWNRENT` voucher this run was
   * priced onto. Null while the run is a quote, exactly as
   * `CHARGECALCULATER.VOUCHERNO` is nullable for the same case.
   */
  VoucherNumber: string | null;
  /**
   * CMTS `HWB` varchar — the house waybill this row prices.
   *
   * The only cargo identifier on the table, and it is the wrong one: it names a
   * house and cannot name the master. Null on a direct consignment, which means
   * a direct temporary import carries no cargo identifier at all.
   */
  HWB: string | null;

  /* --- the priced window ------------------------------------------- */
  /** CMTS `StartDate` — the window the engine priced from. */
  StartDate: string;
  /** CMTS `EndDate` — the pricing cut-off. */
  EndDate: string;

  /* --- basis -------------------------------------------------------- */
  /**
   * CMTS `TotalWeight` float — and it is the table's ONLY weight column.
   *
   * Written with the actual weight, matching the column name. The chargeable
   * weight the money was actually computed on has no column here, so the row
   * cannot be re-priced from itself — the same finding `grCharges` carries, one
   * column worse, because `grCharges` at least has `HWBChargeableWeight` on its
   * house lines.
   */
  TotalWeight: number;

  /* --- the day model ------------------------------------------------ */
  /** CMTS `NumberofDays` int — [sic], lower-case o. Dwell as the engine counted it. */
  NumberofDays: number;
  /**
   * CMTS `Freedays` int — [sic], one word.
   *
   * A STORED free-day count, per row. This directly contradicts
   * `CMTS_SCHEMA_AUDIT` §3.2, which reads the legacy free period off the
   * zero-amount rate row (`case when s.AMOUNT = 0 then s.DAYTO end`) — the rule
   * `grCharges` is measured against on the standard tab. Two tables in one
   * schema, two different answers to "where do free days come from".
   */
  Freedays: number;
  /** CMTS `SUPPLIMENTDAYS` int — [sic]. Extra billed days on a supplementary run. */
  SUPPLIMENTDAYS: number;
  /** CMTS `IsSuppliment` bit — [sic], one p and an i. */
  IsSuppliment: boolean;
  /**
   * CMTS `ISFree` bit — [sic], upper-case IS.
   *
   * Nothing in the schema says WHAT is free. Storage only, or the whole
   * voucher? The column sits beside a non-zero `MinimumCharges` on the same
   * row, and a floor on a free consignment cannot both apply and not apply.
   */
  ISFree: boolean;

  /* --- the charge columns ------------------------------------------- */
  /** CMTS `HandlingUnit` varchar — the basis handling is quoted on. */
  HandlingUnit: string;
  /** CMTS `HandlingCharges` float. */
  HandlingCharges: Amount;
  /** CMTS `StorgeUnit` varchar — [sic], no second a. The storage basis. */
  StorgeUnit: string;
  /** CMTS `StorgeUnitCharges` float — [sic]. The storage money. */
  StorgeUnitCharges: Amount;
  /** CMTS `LocationUnit` varchar — the basis the zone fee is quoted on. */
  LocationUnit: string;
  /**
   * CMTS `LocationUnitCharges` float — the SECOND location money column, and
   * `GODOWNRENTDETAIL` has no equivalent.
   *
   * Whether this is the per-unit rate and `LocationChargesAmount` the extended
   * total, or whether they are two different fees, is not stated anywhere. Zero
   * on every row here for the same reason `grCharges.LOCATIONCHARGES` is: the
   * demo's charge path takes no location input.
   */
  LocationUnitCharges: Amount;
  /** CMTS `LocationChargesAmount` float. */
  LocationChargesAmount: Amount;
  /**
   * CMTS `MinimumCharges` float — `CARGOSUBCLASS.MINCHARGES`, the floor.
   *
   * It repeats identically on every row of a run, because a floor belongs to
   * the subclass and not to the line. Which is what makes `sumMinimumCharges`
   * below a category error — see `rollUpCheck`.
   */
  MinimumCharges: Amount;
  /**
   * CMTS `AFUAmount` float — the bulky-cargo (Air Freight Unit) amount.
   *
   * Written the way `GODOWNRENT.sumAFUAmount` is written in `fixtures.ts`: the
   * class's special-handling charge lands HERE when the class is AFU and in
   * `SpecialCharges` otherwise. Same money, two columns, chosen by class — so
   * any consumer totalling one without the other under-reports.
   *
   * Worth reading beside `CHARGETYPE`: the `AFUW` heading carries a value in
   * `Nonuseabel` and is therefore RETIRED under Q7, while the amount column it
   * fed is alive on three tables — here, `GODOWNRENTDETAIL` and `GODOWNRENT`.
   */
  AFUAmount: Amount;
  /** CMTS `SpecialCharges` float — class-driven special handling. */
  SpecialCharges: Amount;

  /* --- tax ---------------------------------------------------------- */
  /**
   * CMTS `TaxPercentage` varchar — a percentage stored as text, next to two
   * floats that were computed from it. See `taxPercentageReading`.
   */
  TaxPercentage: string;
  /** CMTS `Tax` float — the tax money on this row. */
  Tax: Amount;
  /** CMTS `TotalAmountWithoutTax` float. */
  TotalAmountWithoutTax: Amount;
  /** CMTS `TotalAmountWithTax` float. */
  TotalAmountWithTax: Amount;

  /* --- the roll-ups, repeated identically on every row of the run ---- */
  /** CMTS `sumTotalAmountWithoutTax` float. */
  sumTotalAmountWithoutTax: Amount;
  /** CMTS `sumTotalAmountWithTax` float. */
  sumTotalAmountWithTax: Amount;
  /** CMTS `sumLocationChargesAmount` float. */
  sumLocationChargesAmount: Amount;
  /** CMTS `sumHandlingCharges` float. */
  sumHandlingCharges: Amount;
  /** CMTS `sumStorgeUnitCharges` float — [sic]. */
  sumStorgeUnitCharges: Amount;
  /** CMTS `sumAFUAmount` float. */
  sumAFUAmount: Amount;
  /** CMTS `sumMinimumCharges` float — a summed floor. */
  sumMinimumCharges: Amount;
  /** CMTS `sumTax` float. */
  sumTax: Amount;

  /* --- tenancy ------------------------------------------------------- */
  /** CMTS `CityId` int — the site. `grCharges` has no equivalent. */
  CityId: number;
}

/**
 * CMTS `ImportFreeHandedCalc` — 18 of 22 business columns.
 *
 * One row. There are no `sum`-prefixed columns on this table and no `HWB`, so
 * nothing splits and nothing rolls up: a free-hand entry is a single record by
 * construction. That is the structural difference from `TempImportCalculation`
 * and the reason the two are not rendered with one layout.
 */
export interface ImportFreeHandedCalcRow {
  /** CMTS `UniqueIdentification` varchar — the only key on the table. */
  UniqueIdentification: string;

  /**
   * CMTS `NumberofDays` int — [sic].
   *
   * On this path it is an INPUT, not a derivation. There is no `StartDate` and
   * no `EndDate` on this table, so the row records how many days were billed
   * and cannot say which days they were. A free-hand charge therefore cannot be
   * checked against a storage clock at all — which is what "free hand" means,
   * and also what makes it the path a dispute is hardest to answer on.
   */
  NumberofDays: number;
  /** CMTS `TotalWeight` float — again the only weight column. */
  TotalWeight: number;

  /** CMTS `HandlingUnit` varchar. */
  HandlingUnit: string;
  /** CMTS `HandlingCharges` float. */
  HandlingCharges: Amount;
  /** CMTS `StorgeUnit` varchar — [sic]. */
  StorgeUnit: string;
  /** CMTS `StorgeUnitCharges` float — [sic]. */
  StorgeUnitCharges: Amount;
  /**
   * CMTS `LocationUnit` varchar — and this table has NO `LocationUnitCharges`.
   *
   * A basis with no per-unit amount beside it. `TempImportCalculation` carries
   * both; this one names the unit and drops the rate.
   */
  LocationUnit: string;
  /** CMTS `LocationChargesAmount` float. */
  LocationChargesAmount: Amount;
  /** CMTS `MinimumCharges` float — the subclass floor still applies. */
  MinimumCharges: Amount;

  /* --- the three headings TempImportCalculation does not have -------- */
  /** CMTS `DocumentationCharges` float. */
  DocumentationCharges: Amount;
  /** CMTS `DeconsolidationCharges` float. */
  DeconsolidationCharges: Amount;
  /**
   * CMTS `OtherChargesAmount` float — the escape hatch, and the reason this
   * path exists: somewhere to put a charge the rate card does not cover.
   *
   * There is NO description column beside it. The one column whose entire
   * purpose is to hold an unclassified amount cannot say what the amount was
   * for. `grCharges.MiscellaneousCharges` has the same defect; here it is the
   * defining one, because on this path the unclassified charge is the point.
   */
  OtherChargesAmount: Amount;

  /** CMTS `TaxPercentage` varchar — the same hazard as on the other table. */
  TaxPercentage: string;
  /** CMTS `Tax` float. */
  Tax: Amount;
  /** CMTS `TotalAmountWithoutTax` float. */
  TotalAmountWithoutTax: Amount;
  /** CMTS `TotalAmountWithTax` float. */
  TotalAmountWithTax: Amount;

  /** CMTS `CityId` int. */
  CityId: number;
}

/** Every `TempImportCalculation` column modelled, in declaration order. */
export const TEMP_IMPORT_COLUMNS: Array<keyof TempImportCalculationRow> = [
  "UniqueIdentification",
  "VoucherNumber",
  "HWB",
  "StartDate",
  "EndDate",
  "TotalWeight",
  "NumberofDays",
  "Freedays",
  "SUPPLIMENTDAYS",
  "IsSuppliment",
  "ISFree",
  "HandlingUnit",
  "HandlingCharges",
  "StorgeUnit",
  "StorgeUnitCharges",
  "LocationUnit",
  "LocationUnitCharges",
  "LocationChargesAmount",
  "MinimumCharges",
  "AFUAmount",
  "SpecialCharges",
  "TaxPercentage",
  "Tax",
  "TotalAmountWithoutTax",
  "TotalAmountWithTax",
  "sumTotalAmountWithoutTax",
  "sumTotalAmountWithTax",
  "sumLocationChargesAmount",
  "sumHandlingCharges",
  "sumStorgeUnitCharges",
  "sumAFUAmount",
  "sumMinimumCharges",
  "sumTax",
  "CityId",
];

/** Every `ImportFreeHandedCalc` column modelled, in declaration order. */
export const FREE_HAND_COLUMNS: Array<keyof ImportFreeHandedCalcRow> = [
  "UniqueIdentification",
  "NumberofDays",
  "TotalWeight",
  "HandlingUnit",
  "HandlingCharges",
  "StorgeUnit",
  "StorgeUnitCharges",
  "LocationUnit",
  "LocationChargesAmount",
  "MinimumCharges",
  "DocumentationCharges",
  "DeconsolidationCharges",
  "OtherChargesAmount",
  "TaxPercentage",
  "Tax",
  "TotalAmountWithoutTax",
  "TotalAmountWithTax",
  "CityId",
];

/**
 * The four surrogate keys left off each row — see the file header. Identical on
 * both tables, which is itself worth knowing: the two paths resolve cargo the
 * same way and differ only in what they charge.
 */
export const CALC_KEY_COLUMNS = [
  "CargoClassID",
  "CargoSubClassID",
  "CargoLocationId",
  "CargoSubClassLocationId",
] as const;

/* ================================================================== *
 * The runs
 * ================================================================== */

/** One `TempImportCalculation` batch — its rows, and the AWB it hangs off. */
export interface TempImportRun {
  /** CMTS `UniqueIdentification`. */
  key: string;
  rows: TempImportCalculationRow[];
  /** `rows[0]` — the header values, which repeat on every row. */
  head: TempImportCalculationRow;

  /* --- resolved through the AWB, because the table cannot name it ---- */
  awbId: number;
  /** NOT a column on `TempImportCalculation`. Resolved via the correlator. */
  AWBNO: string;
  site: SiteCode;
  cargoClassId: number;
  cargoSubClassId: number;
  /** The weight the money was actually computed on. No column holds it. */
  chargeableKg: number;
  /** The zone name, for display. `CargoLocationId` is out of scope. */
  locationName: string;
  /** Why this consignment is on the temporary-import path. Ours, not CMTS's. */
  regime: string;
  /** Why this run exists, in one line, for the run picker. */
  purpose: string;
  /**
   * How many of the run's rows the stored roll-up actually covers.
   *
   * Equal to `rows.length` on every run but one. The exception is constructed —
   * see `TEMP_IMPORT_SEED` — because a roll-up that always agrees demonstrates
   * nothing about a schema that does not enforce agreement.
   */
  rollUpCoversRows: number;
  /** The full demo calculation, for the "what this table cannot hold" panel. */
  calc: ChargeCalculation;
}

/** One `ImportFreeHandedCalc` record, and what the engine would have said. */
export interface FreeHandEntry {
  /** CMTS `UniqueIdentification`. */
  key: string;
  row: ImportFreeHandedCalcRow;

  awbId: number;
  /** NOT a column on `ImportFreeHandedCalc`. Resolved via the correlator. */
  AWBNO: string;
  site: SiteCode;
  cargoClassId: number;
  cargoSubClassId: number;
  chargeableKg: number;
  locationName: string;
  /** Why the operator keyed this rather than letting the engine derive it. */
  reason: string;
  /** Who keyed it. NO COLUMN on this table — see `FREE_HAND_AMBIGUITIES`. */
  keyedBy: string;
  /**
   * The voucher this entry was billed onto, where one exists.
   *
   * NOT A COLUMN. `ImportFreeHandedCalc` has no `VoucherNumber`, so this is
   * resolved through the AWB and is exactly the link the table cannot make.
   */
  resolvedVoucherNo: string | null;
  /** What `calculateCharges` produces for the same consignment. */
  calc: ChargeCalculation;
}

/* ================================================================== *
 * Reading 1 — the roll-up against the rows it summarises
 *
 * The ticket's first question, and the reason this table is interesting:
 * per-row values and `sum`-prefixed roll-ups sit on the SAME row, so nothing in
 * the schema makes them agree. Surfaced, never reconciled.
 * ================================================================== */

export interface RollUpLine {
  /** The per-row column. */
  rowColumn: keyof TempImportCalculationRow;
  /** Its roll-up twin, or null where the column has none. */
  sumColumn: keyof TempImportCalculationRow | null;
  /** Σ across every row of the run. */
  summed: Amount;
  /** What the stored roll-up says. Null where there is no roll-up column. */
  stored: Amount | null;
  /** stored − summed. Null where there is no roll-up column. */
  drift: Amount | null;
  /** Set where the two columns cannot be compared meaningfully at all. */
  note?: string;
}

export interface RollUpCheck {
  lines: RollUpLine[];
  rowCount: number;
  /** Rows the stored roll-up was written over. */
  coveredRows: number;
  /** True when the roll-up is one or more rows behind the run. */
  stale: boolean;
  /** Money columns whose value can only be totalled by re-reading every row. */
  withoutRollUp: Array<keyof TempImportCalculationRow>;
  /** Lines where stored and summed disagree. */
  breaks: RollUpLine[];
  /** The largest absolute drift on the run. */
  worstDrift: Amount;
}

/**
 * Every money column on the row, paired with its roll-up twin where it has one.
 *
 * Two of the ten have none — `LocationUnitCharges` and `SpecialCharges` — and
 * that asymmetry is structural, not a fixture choice. A consumer that trusts
 * the eight `sum` columns to be the run total silently drops both.
 */
const ROLL_UP_PAIRS: Array<{
  rowColumn: keyof TempImportCalculationRow;
  sumColumn: keyof TempImportCalculationRow | null;
  note?: string;
}> = [
  { rowColumn: "StorgeUnitCharges", sumColumn: "sumStorgeUnitCharges" },
  { rowColumn: "HandlingCharges", sumColumn: "sumHandlingCharges" },
  { rowColumn: "LocationChargesAmount", sumColumn: "sumLocationChargesAmount" },
  {
    rowColumn: "LocationUnitCharges",
    sumColumn: null,
    note: "no sum twin — the second location column rolls up nowhere",
  },
  { rowColumn: "AFUAmount", sumColumn: "sumAFUAmount" },
  {
    rowColumn: "SpecialCharges",
    sumColumn: null,
    note: "no sum twin — and it carries the special-handling money for every class except AFU",
  },
  {
    rowColumn: "MinimumCharges",
    sumColumn: "sumMinimumCharges",
    note: "a floor is not additive: the same subclass minimum repeats on every row, so Σ multiplies it by the row count",
  },
  { rowColumn: "Tax", sumColumn: "sumTax" },
  { rowColumn: "TotalAmountWithoutTax", sumColumn: "sumTotalAmountWithoutTax" },
  { rowColumn: "TotalAmountWithTax", sumColumn: "sumTotalAmountWithTax" },
];

export function rollUpCheck(run: TempImportRun): RollUpCheck {
  const lines: RollUpLine[] = ROLL_UP_PAIRS.map((p) => {
    const summed = round2(
      run.rows.reduce((n, r) => n + (r[p.rowColumn] as number), 0),
    );
    const stored = p.sumColumn === null ? null : (run.head[p.sumColumn] as number);
    return {
      rowColumn: p.rowColumn,
      sumColumn: p.sumColumn,
      summed,
      stored,
      drift: stored === null ? null : round2(stored - summed),
      ...(p.note ? { note: p.note } : {}),
    };
  });

  const breaks = lines.filter((l) => l.drift !== null && Math.abs(l.drift) > 0.005);

  return {
    lines,
    rowCount: run.rows.length,
    coveredRows: run.rollUpCoversRows,
    stale: run.rollUpCoversRows < run.rows.length,
    withoutRollUp: lines.filter((l) => l.sumColumn === null).map((l) => l.rowColumn),
    breaks,
    worstDrift: breaks.reduce((n, l) => Math.max(n, Math.abs(l.drift ?? 0)), 0),
  };
}

/* ================================================================== *
 * Reading 2 — a percentage stored as text
 *
 * `TaxPercentage` is varchar on both tables while `Tax` and the two totals
 * beside it are floats. Nothing constrains what goes in the string, so over a
 * decade of operation the column accumulates spellings, and every one of them
 * has to survive migration into a numeric column.
 * ================================================================== */

export type TaxLiteralHazard = "clean" | "trailing-sign" | "fraction" | "unparseable";

export interface TaxPercentageReading {
  /** Exactly what the column holds. */
  literal: string;
  /** T-SQL `CAST(TaxPercentage AS float)` — fails on anything non-numeric. */
  castSucceeds: boolean;
  /** JS `Number(literal)` — NaN on "15%". */
  numberValue: number;
  /** JS `parseFloat(literal)` — 15 on "15%". The two disagree, which is the trap. */
  parseFloatValue: number;
  /** The percent the row's own floats imply: Tax ÷ TotalAmountWithoutTax × 100. */
  impliedPercent: number;
  /** Does the literal, read as a percent, reproduce the stored `Tax`? */
  reconciles: boolean;
  hazard: TaxLiteralHazard;
  finding: string;
}

export function taxPercentageReading(
  literal: string,
  totalWithoutTax: Amount,
  tax: Amount,
): TaxPercentageReading {
  const trimmed = literal.trim();
  const numberValue = trimmed === "" ? Number.NaN : Number(trimmed);
  const parsed = Number.parseFloat(trimmed);
  const castSucceeds = Number.isFinite(numberValue);

  const impliedPercent =
    totalWithoutTax === 0 ? 0 : round2((tax / totalWithoutTax) * 100);

  // Read the literal the way a migration would — parseFloat, because that is
  // the forgiving reading and forgiving is what gets written.
  const asPercent = Number.isFinite(parsed) ? parsed : Number.NaN;
  const reconciles =
    Number.isFinite(asPercent) &&
    Math.abs(round2((totalWithoutTax * asPercent) / 100) - tax) < 0.01;

  let hazard: TaxLiteralHazard;
  let finding: string;
  if (!Number.isFinite(parsed)) {
    hazard = "unparseable";
    finding =
      "Neither CAST nor parseFloat gets a number out of this. On migration the row either fails the conversion or lands as NULL, and a NULL tax percent on a paid voucher is unrecoverable — the money is already collected.";
  } else if (!castSucceeds) {
    hazard = "trailing-sign";
    finding =
      "parseFloat reads 15, CAST(… AS float) throws. The two readings of one column disagree, so whether this row migrates cleanly depends entirely on which tool reads it.";
  } else if (asPercent > 0 && asPercent < 1) {
    hazard = "fraction";
    finding =
      "Stored as a fraction, not a percent. Read literally it is a 0.15% tax; the Tax float beside it was computed at 15%. The column and the money disagree by two orders of magnitude and nothing on the row says which is right.";
  } else {
    hazard = "clean";
    finding =
      "Parses cleanly and reproduces the stored Tax. That is this row — it says nothing about the other rows in a varchar column that has never been constrained.";
  }

  return {
    literal,
    castSucceeds,
    numberValue,
    parseFloatValue: parsed,
    impliedPercent,
    reconciles,
    hazard,
    finding,
  };
}

/* ================================================================== *
 * Reading 3 — the day model
 *
 * `TempImportCalculation` carries BOTH a window (`StartDate`/`EndDate`) and a
 * count (`NumberofDays`), so the two can disagree; and it carries `Freedays` as
 * a stored number, which contradicts how `grCharges` derives the same thing.
 * ================================================================== */

export interface TempDayReading {
  /** CMTS `NumberofDays`, as stored. */
  NumberofDays: number;
  /** `EndDate − StartDate` counted the way this demo counts: floor of 24h periods. */
  demoCount: number;
  /** The same window counted the way the legacy procedure counts: calendar, both ends. */
  cmtsCount: number;
  /** True when the stored count matches neither reading of its own window. */
  countUnexplained: boolean;
  /** CMTS `Freedays`, as stored on the row. */
  Freedays: number;
  /** What `CARGOCLASS.freeDays` says for this class — the demo's source. */
  classFreeDays: number;
  /** CMTS `SUPPLIMENTDAYS`. */
  SUPPLIMENTDAYS: number;
  /** CMTS `IsSuppliment`. */
  IsSuppliment: boolean;
  /** Days that reached a priced band: max(0, NumberofDays − Freedays) + supplement. */
  pricedDays: number;
  /** Free allowance not yet spent. */
  freeRemaining: number;
  /** Days the CMTS reading would price, on the same window. */
  cmtsPricedDays: number;
}

export function tempDayReading(run: TempImportRun): TempDayReading {
  const h = run.head;
  const cls = cargoClass(run.cargoClassId);
  const demoCount = daysBetween(h.StartDate, h.EndDate);
  const cmtsCount = calendarDaysInclusive(h.StartDate, h.EndDate);

  return {
    NumberofDays: h.NumberofDays,
    demoCount,
    cmtsCount,
    countUnexplained: h.NumberofDays !== demoCount && h.NumberofDays !== cmtsCount,
    Freedays: h.Freedays,
    classFreeDays: cls.freeDays,
    SUPPLIMENTDAYS: h.SUPPLIMENTDAYS,
    IsSuppliment: h.IsSuppliment,
    pricedDays: Math.max(0, h.NumberofDays - h.Freedays) + h.SUPPLIMENTDAYS,
    freeRemaining: Math.max(0, h.Freedays - h.NumberofDays),
    cmtsPricedDays: Math.max(0, cmtsCount - h.Freedays) + h.SUPPLIMENTDAYS,
  };
}

/* ================================================================== *
 * Reading 4 — what each table cannot hold
 *
 * The two paths bill differently, and the sharpest way to say so is to price
 * the same consignment through the demo engine and show which components have
 * nowhere to land on each row. This is a SCHEMA finding: money the engine
 * computes and the working set cannot record.
 * ================================================================== */

export interface UnheldRung {
  label: string;
  amount: Amount;
  /** The column that would hold it, or null where the table has none. */
  column: string | null;
  note: string;
}

export interface UnheldCharges {
  rungs: UnheldRung[];
  /** Σ of the rungs with no column. */
  unheldTotal: Amount;
  /** The run total as the table records it, before tax. */
  recordedTotal: Amount;
  /** What the demo engine computed for the same consignment, before tax. */
  engineSubTotal: Amount;
  /** Share of the engine sub-total this table can account for. */
  heldPct: number;
}

/** Components the demo engine produces, tested against a table's column list. */
function unheldAgainst(
  calc: ChargeCalculation,
  columns: {
    documentation: string | null;
    deconsolidation: string | null;
    special: string | null;
    other: string | null;
  },
  recordedTotal: Amount,
): UnheldCharges {
  const surcharge = round2(
    surchargesFor(calcClassId(calc), calc.storageAmount).reduce((n, s) => n + s.amount, 0),
  );

  // The engine's sub-total before the subclass floor is tested, reassembled
  // from the components rather than read off the calculation — `subTotal` is
  // already `max(raw, MINCHARGES)`, so the uplift is only visible by
  // reconstructing `raw` and subtracting.
  const raw = round2(
    calc.storageAmount +
      calc.handlingAmount +
      calc.locationChargesAmount +
      surcharge +
      calc.documentationCharges +
      calc.deconsolidationCharges +
      calc.specialHandlingCharges +
      calc.miscellaneousCharges,
  );
  const floorUplift = round2(Math.max(0, calc.subTotal - raw));

  const rungs: UnheldRung[] = [
    {
      label: "Documentation",
      amount: calc.documentationCharges,
      column: columns.documentation,
      note: columns.documentation
        ? "recorded — this path has a column for it"
        : "the engine charges it; this table has nowhere to put it",
    },
    {
      label: "Deconsolidation",
      amount: calc.deconsolidationCharges,
      column: columns.deconsolidation,
      note: columns.deconsolidation
        ? "recorded — this path has a column for it"
        : "the engine charges it; this table has nowhere to put it",
    },
    {
      label: "Special handling",
      amount: calc.specialHandlingCharges,
      column: columns.special,
      note: columns.special
        ? "recorded — split between AFUAmount and SpecialCharges by class"
        : "no column on this table at all",
    },
    {
      label: "Category surcharge (FC-07 §07)",
      amount: surcharge,
      column: null,
      note: "no column on any of the three working sets — grCharges cannot hold it either",
    },
    {
      label: "Subclass floor uplift (CARGOSUBCLASS.MINCHARGES)",
      amount: floorUplift,
      column: null,
      note: "MinimumCharges is on the row, but the UPLIFT it produced is not — the row stores the floor, never whether it bit",
    },
    {
      label: "Miscellaneous / unclassified",
      amount: 0,
      column: columns.other,
      note: columns.other
        ? "this path has an escape hatch, and it carries no description"
        : "no escape hatch — an unclassified charge cannot be recorded on this path",
    },
  ];

  const unheldTotal = round2(
    rungs.filter((r) => r.column === null).reduce((n, r) => n + r.amount, 0),
  );

  const engineSubTotal = calc.subTotal;

  return {
    rungs,
    unheldTotal,
    recordedTotal,
    engineSubTotal,
    // One decimal, not zero. A run that holds 99.6% of the engine's sub-total
    // rounds to "100%" at whole numbers, and a screen reporting 100% held
    // beside a non-zero unheld figure contradicts itself on the same card.
    heldPct:
      engineSubTotal === 0 ? 100 : Math.round((recordedTotal / engineSubTotal) * 1000) / 10,
  };
}

/**
 * `ChargeCalculation` does not carry the class id it was priced under, so it is
 * resolved back through the AWB. Kept as one helper rather than threaded
 * through every caller, because getting it wrong would mis-price the surcharge
 * line and the mistake would be invisible.
 */
function calcClassId(calc: ChargeCalculation): number {
  return AWBS.find((a) => a.AWBId === calc.awbId)?.CARGOCLASSID ?? 1;
}

export function tempUnheldCharges(run: TempImportRun): UnheldCharges {
  // Measured against Σ rows rather than the stored roll-up. What this table can
  // HOLD is a schema question; whether the roll-up kept up with the rows is a
  // different one, and `rollUpCheck` answers it separately. Mixing the two
  // would let a stale roll-up read as a missing column.
  return unheldAgainst(
    run.calc,
    {
      documentation: null,
      deconsolidation: null,
      special: "AFUAmount / SpecialCharges",
      other: null,
    },
    round2(run.rows.reduce((n, r) => n + r.TotalAmountWithoutTax, 0)),
  );
}

export function freeHandUnheldCharges(entry: FreeHandEntry): UnheldCharges {
  return unheldAgainst(
    entry.calc,
    {
      documentation: "DocumentationCharges",
      deconsolidation: "DeconsolidationCharges",
      special: null,
      other: "OtherChargesAmount",
    },
    entry.row.TotalAmountWithoutTax,
  );
}

/* ================================================================== *
 * Reading 5 — the free-hand override, against what the engine would say
 *
 * This is the whole answer to "why is it this amount?" on the manual path:
 * because somebody typed it. So the only useful derivation is the keyed figure
 * beside the derived one, with the difference named rather than averaged away.
 * ================================================================== */

export interface OverrideLine {
  label: string;
  /** The CMTS column carrying the keyed figure, or null where there is none. */
  column: string | null;
  /** What the operator keyed. */
  keyed: Amount;
  /** What `calculateCharges` produces for the same consignment. */
  derived: Amount;
  /** keyed − derived. */
  delta: Amount;
}

export interface FreeHandLadder {
  lines: OverrideLine[];
  keyedSubTotal: Amount;
  derivedSubTotal: Amount;
  /** keyed − derived across the whole entry, before tax. */
  delta: Amount;
  /** The direction the override moves the bill. */
  direction: "under" | "over" | "level";
  /** The floor, which the manual path does not escape. */
  MinimumCharges: Amount;
  /** True where the keyed sub-total falls below the subclass floor. */
  belowFloor: boolean;
  TaxPercentage: string;
  Tax: Amount;
  TotalAmountWithTax: Amount;
}

export function freeHandLadder(entry: FreeHandEntry): FreeHandLadder {
  const r = entry.row;
  const c = entry.calc;

  const lines: OverrideLine[] = [
    {
      label: "Storage",
      column: "StorgeUnitCharges",
      keyed: r.StorgeUnitCharges,
      derived: c.storageAmount,
      delta: round2(r.StorgeUnitCharges - c.storageAmount),
    },
    {
      label: "Handling",
      column: "HandlingCharges",
      keyed: r.HandlingCharges,
      derived: c.handlingAmount,
      delta: round2(r.HandlingCharges - c.handlingAmount),
    },
    {
      label: "Location charges",
      column: "LocationChargesAmount",
      keyed: r.LocationChargesAmount,
      derived: c.locationChargesAmount,
      delta: round2(r.LocationChargesAmount - c.locationChargesAmount),
    },
    {
      label: "Documentation",
      column: "DocumentationCharges",
      keyed: r.DocumentationCharges,
      derived: c.documentationCharges,
      delta: round2(r.DocumentationCharges - c.documentationCharges),
    },
    {
      label: "Deconsolidation",
      column: "DeconsolidationCharges",
      keyed: r.DeconsolidationCharges,
      derived: c.deconsolidationCharges,
      delta: round2(r.DeconsolidationCharges - c.deconsolidationCharges),
    },
    {
      label: "Other charges",
      column: "OtherChargesAmount",
      keyed: r.OtherChargesAmount,
      // The engine has no equivalent — this is the column that exists BECAUSE
      // the engine has no equivalent.
      derived: 0,
      delta: round2(r.OtherChargesAmount),
    },
    {
      label: "Special handling",
      column: null,
      keyed: 0,
      derived: c.specialHandlingCharges,
      delta: round2(-c.specialHandlingCharges),
    },
  ];

  const keyedSubTotal = round2(
    r.StorgeUnitCharges +
      r.HandlingCharges +
      r.LocationChargesAmount +
      r.DocumentationCharges +
      r.DeconsolidationCharges +
      r.OtherChargesAmount,
  );
  const derivedSubTotal = c.subTotal;
  const delta = round2(keyedSubTotal - derivedSubTotal);

  return {
    lines,
    keyedSubTotal,
    derivedSubTotal,
    delta,
    direction: delta > 0.005 ? "over" : delta < -0.005 ? "under" : "level",
    MinimumCharges: r.MinimumCharges,
    belowFloor: r.MinimumCharges > 0 && keyedSubTotal < r.MinimumCharges,
    TaxPercentage: r.TaxPercentage,
    Tax: r.Tax,
    TotalAmountWithTax: r.TotalAmountWithTax,
  };
}

/* ================================================================== *
 * Reading 6 — the three paths, column by column
 *
 * The ticket's instruction is to make the difference legible rather than
 * forcing one layout onto both. This is the table that does it in one place:
 * what each path can record, and therefore what each path can explain.
 * ================================================================== */

export type PathSupport = "yes" | "no" | "partial";

export interface PathCapability {
  capability: string;
  columns: string;
  grCharges: PathSupport;
  tempImport: PathSupport;
  freeHand: PathSupport;
  consequence: string;
}

export const PATH_CAPABILITIES: PathCapability[] = [
  {
    capability: "Names the consignment it priced",
    columns: "AWBNO · IGMNO vs HWB vs nothing",
    grCharges: "yes",
    tempImport: "partial",
    freeHand: "no",
    consequence:
      "Only the standard path can be walked back to an AWB from the row. Temporary import names a house and not the master; free-hand names nothing at all, so the derivation reaches its consignment through a varchar correlator or not at all.",
  },
  {
    capability: "Records the rate band walk",
    columns: "DAYFROM · DAYTO · ChargesDaysNoOfDays",
    grCharges: "yes",
    tempImport: "no",
    freeHand: "no",
    consequence:
      "Neither new table has a day-band column. A disputed temporary-import charge can be explained down to a total and a day count and no further — one whole level less derivation than the standard path.",
  },
  {
    capability: "Records the window that was priced",
    columns: "StartDate · EndDate",
    grCharges: "yes",
    tempImport: "yes",
    freeHand: "no",
    consequence:
      "A free-hand row states how many days were billed and cannot state which days. Nothing can be reconciled against the storage clock.",
  },
  {
    capability: "Records a free-day allowance",
    columns: "Freedays",
    grCharges: "partial",
    tempImport: "yes",
    freeHand: "no",
    consequence:
      "Temporary import STORES the allowance; the standard path derives it from the zero-amount rate row (audit §3.2). Two tables in one schema disagree about where free days come from. Free-hand has no allowance column at all.",
  },
  {
    capability: "Records a supplementary re-run",
    columns: "IsSuppliment · SUPPLIMENTDAYS",
    grCharges: "yes",
    tempImport: "yes",
    freeHand: "no",
    consequence:
      "A free-hand charge cannot be marked supplementary, so a second free-hand entry against the same cargo is indistinguishable from a duplicate.",
  },
  {
    capability: "Names the voucher it was billed onto",
    columns: "VoucherNumber",
    grCharges: "no",
    tempImport: "yes",
    freeHand: "no",
    consequence:
      "Only temporary import carries the link. `FreeHandGR` is the free-hand voucher and `ImportFreeHandedCalc` is its calculation partner (Q4) — and nothing on either row joins them except the correlator.",
  },
  {
    capability: "Carries run-level roll-ups on the row",
    columns: "the eight sum* columns",
    grCharges: "partial",
    tempImport: "yes",
    freeHand: "no",
    consequence:
      "Temporary import stores both the parts and the total on the same row, so they can disagree. Free-hand writes one row and has nothing to roll up. grCharges repeats a run-level figure on every row without calling it a sum.",
  },
  {
    capability: "Holds an unclassified charge",
    columns: "OtherChargesAmount · MiscellaneousCharges",
    grCharges: "yes",
    tempImport: "no",
    freeHand: "yes",
    consequence:
      "Temporary import has no escape hatch: a charge the rate card does not cover cannot be recorded on that path at all. Free-hand's escape hatch has no description column beside it.",
  },
  {
    capability: "Holds documentation and deconsolidation",
    columns: "DocumentationCharges · DeconsolidationCharges",
    grCharges: "yes",
    tempImport: "no",
    freeHand: "yes",
    consequence:
      "The temporary-import table cannot record either. So a temporary import is either never charged them, or they are charged on the voucher and lost from the working set.",
  },
  {
    capability: "Scopes itself to a site",
    columns: "CityId",
    grCharges: "no",
    tempImport: "yes",
    freeHand: "yes",
    consequence:
      "The two new tables scope directly; grCharges scopes through its parent AWB. With no AWB column on either new table, CityId is the only thing narrowing a correlator collision to one site.",
  },
  {
    capability: "Says who ran the calculation, and when",
    columns: "the six audit columns",
    grCharges: "no",
    tempImport: "no",
    freeHand: "no",
    consequence:
      "None of the three carries an audit column. On the free-hand path that is the serious one: the whole record of a manually keyed charge cannot name the person who keyed it.",
  },
];

/* ================================================================== *
 * Column-level ambiguities — stated once, not per run
 * ================================================================== */

export interface CalcAmbiguity {
  columns: string[];
  finding: string;
  question: string;
}

export const TEMP_IMPORT_AMBIGUITIES: CalcAmbiguity[] = [
  {
    columns: ["sumTotalAmountWithoutTax", "TotalAmountWithoutTax"],
    finding:
      "Per-row values and their roll-ups share a row, so nothing in the schema makes them agree. A consumer reading the sum columns and a consumer reading the rows can reach different totals from the same batch, and neither is detectably wrong.",
    question:
      "Is the roll-up rewritten on every engine pass, or written once when the batch is created?",
  },
  {
    columns: ["LocationUnitCharges", "SpecialCharges"],
    finding:
      "Two money columns with no sum twin, on a table where eight others have one. Anything totalling the run from the sum columns drops both — and SpecialCharges carries the special-handling money for every class except AFU.",
    question: "Were these added after the roll-ups, and is any report still reading only the sums?",
  },
  {
    columns: ["sumMinimumCharges"],
    finding:
      "A summed floor. MINCHARGES belongs to the subclass and repeats identically on every row, so Σ multiplies one minimum by the row count. A four-house consolidation appears to carry four floors.",
    question: "Does anything downstream read sumMinimumCharges as the run's minimum?",
  },
  {
    columns: ["TaxPercentage", "Tax", "TotalAmountWithTax"],
    finding:
      "A percentage stored as varchar beside two floats derived from it. Nothing constrains the string, so '15', '15%' and '0.15' can all appear in the same column, and only the Tax float witnesses which was meant.",
    question:
      "Has this column ever been constrained, and does any legacy row hold a non-numeric literal?",
  },
  {
    columns: ["NumberofDays", "StartDate", "EndDate"],
    finding:
      "The row carries both the window and the count, so the two can disagree. Calendar-inclusive and floor-of-24-hours give different answers on the same dates, and the column name does not say which rule wrote it.",
    question: "Which counting rule produced NumberofDays on legacy rows? (audit §5 Q1)",
  },
  {
    columns: ["Freedays"],
    finding:
      "A stored free-day allowance, which contradicts audit §3.2 — the legacy procedure derives the free period from the zero-amount rate row for the standard path. Two tables in one schema, two sources for the same number.",
    question:
      "On the temporary-import path, is Freedays keyed, copied from CARGOCLASS, or derived from the rate row?",
  },
  {
    columns: ["ISFree", "MinimumCharges"],
    finding:
      "A free flag sitting beside a non-zero floor. Nothing says whether ISFree waives storage only or the whole voucher, and a floor cannot both apply and not apply.",
    question: "What exactly does ISFree waive, and does it override MINCHARGES?",
  },
  {
    columns: ["AFUAmount", "sumAFUAmount", "SpecialCharges"],
    finding:
      "The same special-handling money lands in AFUAmount or in SpecialCharges depending on the cargo class. Meanwhile the AFUW charge heading carries a value in CHARGETYPE.Nonuseabel and is retired under Q7, while the amount column it fed is alive on three tables.",
    question: "Is AFUAmount still written on new calculations, or is it a retired column kept alive?",
  },
  {
    columns: ["HWB", "UniqueIdentification"],
    finding:
      "The only cargo identifier on the table is the house waybill. A direct consignment leaves it null, so the row has no cargo identifier at all and reaches its AWB only through the correlator.",
    question:
      "Is UniqueIdentification unique across sites, or unique within a CityId? (it decides whether the correlator can be a migration key)",
  },
  {
    columns: ["LocationUnit", "LocationUnitCharges", "LocationChargesAmount"],
    finding:
      "Two location money columns and a unit. GODOWNRENTDETAIL has only one money column for the same fee, so one of these two has no counterpart on the voucher and nothing says which.",
    question:
      "Is LocationUnitCharges the per-unit rate and LocationChargesAmount the extended amount, or are they different fees?",
  },
];

export const FREE_HAND_AMBIGUITIES: CalcAmbiguity[] = [
  {
    columns: ["OtherChargesAmount"],
    finding:
      "The escape hatch has no description column. The one field whose purpose is to hold a charge the rate card does not cover cannot say what the charge was for — so a free-hand voucher is unauditable exactly where it is most discretionary.",
    question:
      "Is the reason held anywhere — on FreeHandGR, in Remarks, or nowhere? (it decides whether this path can be audited at all)",
  },
  {
    columns: ["NumberofDays"],
    finding:
      "A day count with no window. There is no StartDate and no EndDate on this table, so the row states how many days were billed and cannot state which days they were. Nothing reconciles against the storage clock.",
    question:
      "Does the operator key NumberofDays, or is it copied from the AWB at the time the entry is made?",
  },
  {
    columns: ["UniqueIdentification"],
    finding:
      "The whole key. There is no AWB column, no HWB column and no VoucherNumber, so this correlator is the single thread joining a free-hand calculation to its cargo AND to the FreeHandGR voucher it produced.",
    question: "Is the same correlator written on FreeHandGR, and is it indexed?",
  },
  {
    columns: ["LocationUnit"],
    finding:
      "A basis with no amount beside it. TempImportCalculation carries LocationUnitCharges; this table names the unit and drops the per-unit figure, so the location fee cannot be re-derived from the row.",
    question: "Is LocationUnit written at all on this path, or inherited from a copied template?",
  },
  {
    columns: ["MinimumCharges"],
    finding:
      "The subclass floor is on a manual-entry table. So the manual path is not fully manual — or the column is present and never enforced, which are opposite behaviours with the same schema.",
    question: "Does the free-hand screen apply MINCHARGES, or only display it?",
  },
  {
    columns: ["ISFree", "IsSuppliment", "VoucherNumber"],
    finding:
      "Three columns TempImportCalculation has and this table does not. A free-hand charge cannot be marked free, cannot be marked supplementary, and cannot name the voucher it produced — so a second entry against the same cargo is indistinguishable from a duplicate.",
    question:
      "How does the free-hand screen prevent a duplicate entry against a consignment already billed?",
  },
  {
    columns: ["CreatedBy", "CreatedOn"],
    finding:
      "No audit columns, on the one path where a human decided the number. The record of a manually keyed charge cannot name the person who keyed it or the moment they did.",
    question: "Is the operator captured on FreeHandGR instead, and is it the same person?",
  },
];

/* ================================================================== *
 * Fixtures — deterministic, derived from the existing charge engine
 *
 * Nothing here re-implements a calculation. Every figure comes from
 * `calculateCharges`, the same function the standard tab and the voucher use,
 * mapped onto whichever columns each table actually has. The parts of the
 * mapping that are OURS rather than CMTS's are marked as such.
 * ================================================================== */

/** `calculateCharges` defaults handling to 12/kg and nothing overrides it. */
const HANDLING_UNIT = "PER KG";
const STORAGE_UNIT = "PER KG / DAY";
const LOCATION_UNIT = "PER DAY";

/**
 * The volumetric envelope `CHARGE_CALCULATIONS` prices every AWB through
 * (120 × 80 × 90 cm ÷ 6000). Repeated here so a consignment priced on this
 * screen is priced on exactly the same basis as one priced on the voucher.
 */
const FIXTURE_VOLUMETRIC_KG = round2((120 * 80 * 90) / 6000);

/**
 * Allocate a run-level amount across rows by weight share, exactly.
 *
 * Same rule and the same reason as `splitExact` in `fixtures.ts`: independently
 * rounded shares drop paisa, and a grid that does not add back to the roll-up
 * printed above it is worse than no roll-up. Residue to the last row.
 */
function allocate(total: number, shares: number[]): number[] {
  if (shares.length <= 1) return [round2(total)];
  const sum = shares.reduce((n, s) => n + s, 0);
  const out = shares.map((s) =>
    sum === 0 ? round2(total / shares.length) : round2((total * s) / sum),
  );
  const drift = round2(total - out.reduce((n, x) => n + x, 0));
  out[out.length - 1] = round2(out[out.length - 1] + drift);
  return out;
}

/**
 * The literal written into `TaxPercentage`.
 *
 * THE RATE IS NOT INVENTED — it is `calc.taxPercent`, the same 15% the rate
 * card resolves and the voucher prints. Only the SPELLING varies, and it varies
 * because a varchar column that has never been constrained accumulates
 * spellings over a decade of operation. Four forms, assigned by run index so
 * the set is stable: the clean one, the one with the sign, the padded decimal,
 * and the fraction. Each is a real thing found in real varchar percent columns,
 * and each fails differently on the way into a numeric column.
 */
const TAX_LITERAL_FORMS = [
  (p: number) => String(p),
  (p: number) => `${p}%`,
  (p: number) => p.toFixed(2),
  (p: number) => String(p / 100),
];

function taxLiteral(p: number, index: number): string {
  return TAX_LITERAL_FORMS[index % TAX_LITERAL_FORMS.length](p);
}

/* ------------------------------------------------------------------ *
 * TempImportCalculation — the seed
 *
 * WHICH CONSIGNMENTS ARE ON THIS PATH IS OUR ASSIGNMENT, NOT CMTS's.
 *
 * There is no `IsTemporary` flag anywhere in the 102 tables and no
 * temporary-import register. The ONLY thing that marks a consignment as
 * temporary is which of the three calculation tables the engine wrote to — the
 * path is implied by the destination and recorded nowhere else. So the demo
 * assigns the path by the flow branch whose regime matches: cargo admitted
 * without entering local consumption (FC-09 transhipment, FC-10-B re-export),
 * plus the cases that are conventionally admitted temporarily. Every run states
 * its regime on the row picker so the assignment is visible rather than assumed.
 * ------------------------------------------------------------------ */

interface TempSpec {
  AWBNO: string;
  regime: string;
  purpose: string;
  IsSuppliment: boolean;
  SUPPLIMENTDAYS: number;
  ISFree: boolean;
  /** Price the houses separately — the only way this table writes >1 row. */
  perHouse?: boolean;
  /**
   * Rows the stored roll-up covers, where that is fewer than the run has.
   *
   * Set on exactly one run, and CONSTRUCTED — the schema does not enforce
   * agreement between the sum columns and the rows they summarise, and a
   * fixture where they always agree demonstrates nothing about that. The stale
   * reading is the plausible one: the roll-up is written when the batch is
   * created and a row appended afterwards does not rewrite it.
   */
  rollUpCoversRows?: number;
}

const TEMP_IMPORT_SEED: TempSpec[] = [
  {
    AWBNO: "214-66778899",
    regime: "FC-09 transhipment — bonded, never enters local consumption",
    // ISFree on a subclass that carries a live floor. The pairing is the point:
    // TRF's MINCHARGES is not zero, so the row asserts both "this is free" and
    // "the minimum is 2,500" and nothing in the schema resolves that.
    purpose: "ISFree is set — and MinimumCharges on the same row is not zero",
    IsSuppliment: false,
    SUPPLIMENTDAYS: 0,
    ISFree: true,
  },
  {
    AWBNO: "125-77665544",
    regime: "FC-10-B re-export — customs rejected, awaiting re-tender",
    purpose: "Long dwell, re-run with a supplement grant after the SD was lodged",
    IsSuppliment: true,
    SUPPLIMENTDAYS: 4,
    ISFree: false,
  },
  {
    AWBNO: "176-92018374",
    regime: "Consolidation held for onward transfer — priced house by house",
    purpose: "Four house lines, and the roll-up covers three of them",
    IsSuppliment: false,
    SUPPLIMENTDAYS: 0,
    ISFree: false,
    perHouse: true,
    rollUpCoversRows: 3,
  },
  {
    // The highest-rated consignment in the fixture set, and deliberately so: VAL
    // carries a special-handling charge and two category surcharges, none of
    // which this table has a column for. It is the run where "what the table
    // cannot hold" stops being a rounding note.
    AWBNO: "125-66710244",
    regime: "Bullion vaulted for onward carriage — not entered for home consumption",
    purpose: "Special handling lands in the one money column with no roll-up twin",
    IsSuppliment: false,
    SUPPLIMENTDAYS: 0,
    ISFree: false,
  },
  {
    AWBNO: "306-40077665",
    regime: "Bulky spares admitted for re-export after fitment",
    purpose: "Still inside the free allowance — nothing has reached a priced band",
    IsSuppliment: false,
    SUPPLIMENTDAYS: 0,
    ISFree: false,
  },
  {
    // The only run here that reached a voucher, which is why it is in the set:
    // `VoucherNumber` is the one link `ImportFreeHandedCalc` does not have, and a
    // column that is null on every fixture cannot demonstrate that it works.
    AWBNO: "157-81002234",
    regime: "AOG spares under warranty exchange — the removed unit is re-exported",
    purpose: "Priced onto a live godown-rent voucher — the only run here that was billed",
    IsSuppliment: false,
    SUPPLIMENTDAYS: 0,
    ISFree: false,
  },
];

function priceFor(awb: AWB, supplementDays: number): ChargeCalculation {
  // A consignment that has already been charged has a committed calculation;
  // reuse it rather than re-pricing, so this screen and the voucher cannot
  // drift. Anything earlier in the lifecycle is priced as a live quote, exactly
  // as `grcharges.ts` prices its consolidation quote.
  const existing = supplementDays === 0 ? chargesFor(awb.AWBId) : undefined;
  if (existing) return existing;

  const base = chargesFor(awb.AWBId);
  return calculateCharges({
    awbId: awb.AWBId,
    arrivalAt: awb.arrivedAt,
    intakeAt: awb.intakeAt,
    asOf: base?.calculatedAt ?? DEMO_ASOF,
    cargoClassId: awb.CARGOCLASSID,
    cargoSubClassId: awb.cargoSubClassId,
    actualKg: awb.TOTALWEIGHT,
    volumetricKg: FIXTURE_VOLUMETRIC_KG,
    supplementDays,
    calculatedAt: base?.calculatedAt ?? DEMO_ASOF,
    voucherNo: null,
  });
}

/**
 * The instant every uncommitted run is priced to.
 *
 * Taken from a committed calculation rather than written as a literal, so this
 * screen's "now" is the same "now" the voucher was raised against and cannot
 * drift from it. `CHARGE_CALCULATIONS` is built from `DEMO_NOW`; reading it
 * back here keeps one source.
 */
const DEMO_ASOF: string = (() => {
  const anyCharged = GODOWN_RENTS.map((g) => awbByNo(g.AWBNO)).find(Boolean);
  const calc = anyCharged ? chargesFor(anyCharged.AWBId) : undefined;
  return calc?.calculatedAt ?? "2026-08-03T14:32:00+05:00";
})();

function buildTempRun(spec: TempSpec, index: number): TempImportRun | null {
  const awb = awbByNo(spec.AWBNO);
  if (!awb) return null;

  const calc = priceFor(awb, spec.SUPPLIMENTDAYS);
  const cls = cargoClass(awb.CARGOCLASSID);
  const sub = cargoSubClass(awb.cargoSubClassId);
  const loc = awb.locationId !== null ? storageLocation(awb.locationId) : undefined;
  const houses: HouseAWB[] = spec.perHouse
    ? HOUSE_AWBS.filter((h) => h.AWBNO === awb.AWBNO)
    : [];

  // GODOWNRENT.sumAFUAmount is written this way in `fixtures.ts`: the class's
  // special-handling charge lands in the AFU column for bulky cargo and in
  // SpecialCharges for everything else. Reproduced exactly so the same
  // consignment reads the same on the voucher and here.
  const isAfu = cls.ABBREVATION === "AFU";
  const afuTotal = isAfu ? calc.specialHandlingCharges : 0;
  const specialTotal = isAfu ? 0 : calc.specialHandlingCharges;

  const lines: Array<HouseAWB | null> = houses.length > 0 ? houses : [null];
  const shares = houses.length > 0 ? houses.map((h) => h.CHARGEDWEIGH) : [1];

  const storageParts = allocate(calc.storageAmount, shares);
  const handlingParts = allocate(calc.handlingAmount, shares);
  const locationParts = allocate(calc.locationChargesAmount, shares);
  const afuParts = allocate(afuTotal, shares);
  const specialParts = allocate(specialTotal, shares);

  const literal = taxLiteral(calc.taxPercent, index);
  const key = `${awb.AWBNO}-TIC-01`;

  // The voucher this run was priced onto, where the consignment has reached a
  // voucher at all. Resolved from GODOWNRENT rather than synthesised — a
  // VoucherNumber naming a voucher that does not exist would be a fabricated
  // finding, and this table has enough real ones.
  const VoucherNumber = GODOWN_RENTS.find((g) => g.AWBNO === awb.AWBNO)?.VOUCHERNO ?? null;

  const rows: TempImportCalculationRow[] = lines.map((house, li) => {
    const storage = storageParts[li];
    const handling = handlingParts[li];
    const location = locationParts[li];
    const afu = afuParts[li];
    const special = specialParts[li];

    const withoutTax = round2(storage + handling + location + afu + special);
    // The tax float is computed from the RATE, not from the literal — which is
    // what makes the fraction spelling a finding rather than a typo: the money
    // is right and the column that is supposed to explain it is not.
    const tax = round2((withoutTax * calc.taxPercent) / 100);

    return {
      UniqueIdentification: key,
      VoucherNumber,
      HWB: house?.HWB ?? null,
      StartDate: calc.clockStartedAt,
      EndDate: calc.calculatedAt,
      TotalWeight: house ? house.WEIGHT : awb.TOTALWEIGHT,
      NumberofDays: calc.totalDays,
      Freedays: calc.freeDays,
      SUPPLIMENTDAYS: spec.SUPPLIMENTDAYS,
      IsSuppliment: spec.IsSuppliment,
      ISFree: spec.ISFree,
      HandlingUnit: HANDLING_UNIT,
      HandlingCharges: handling,
      StorgeUnit: STORAGE_UNIT,
      StorgeUnitCharges: storage,
      LocationUnit: LOCATION_UNIT,
      // Zero for the same reason grCharges.LOCATIONCHARGES is zero: the demo's
      // charge path takes no location input at all.
      LocationUnitCharges: 0,
      LocationChargesAmount: location,
      // The floor belongs to the subclass, so it repeats identically on every
      // row rather than being split. That repetition is what makes
      // sumMinimumCharges wrong, and splitting it here would hide the finding.
      MinimumCharges: sub.MINCHARGES,
      AFUAmount: afu,
      SpecialCharges: special,
      TaxPercentage: literal,
      Tax: tax,
      TotalAmountWithoutTax: withoutTax,
      TotalAmountWithTax: round2(withoutTax + tax),

      // Placeholders — the roll-ups are written below, once the rows exist.
      sumTotalAmountWithoutTax: 0,
      sumTotalAmountWithTax: 0,
      sumLocationChargesAmount: 0,
      sumHandlingCharges: 0,
      sumStorgeUnitCharges: 0,
      sumAFUAmount: 0,
      sumMinimumCharges: 0,
      sumTax: 0,

      CityId: site(awb.site).CityId,
    };
  });

  // The roll-up, written over the rows it covers. On every run but one that is
  // all of them; see `TempSpec.rollUpCoversRows`.
  const covers = Math.min(spec.rollUpCoversRows ?? rows.length, rows.length);
  const covered = rows.slice(0, covers);
  const total = (pick: (r: TempImportCalculationRow) => number) =>
    round2(covered.reduce((n, r) => n + pick(r), 0));

  const rollUp = {
    sumTotalAmountWithoutTax: total((r) => r.TotalAmountWithoutTax),
    sumTotalAmountWithTax: total((r) => r.TotalAmountWithTax),
    sumLocationChargesAmount: total((r) => r.LocationChargesAmount),
    sumHandlingCharges: total((r) => r.HandlingCharges),
    sumStorgeUnitCharges: total((r) => r.StorgeUnitCharges),
    sumAFUAmount: total((r) => r.AFUAmount),
    sumMinimumCharges: total((r) => r.MinimumCharges),
    sumTax: total((r) => r.Tax),
  };

  const withRollUp = rows.map((r) => ({ ...r, ...rollUp }));

  return {
    key,
    rows: withRollUp,
    head: withRollUp[0],
    awbId: awb.AWBId,
    AWBNO: awb.AWBNO,
    site: awb.site,
    cargoClassId: awb.CARGOCLASSID,
    cargoSubClassId: awb.cargoSubClassId,
    chargeableKg: calc.chargeableKg,
    locationName: loc?.NAME ?? "UNALLOCATED",
    regime: spec.regime,
    purpose: spec.purpose,
    rollUpCoversRows: covers,
    calc,
  };
}

export const TEMP_IMPORT_RUNS: TempImportRun[] = TEMP_IMPORT_SEED.map(buildTempRun)
  .filter((r): r is TempImportRun => r !== null);

/** Every row across every run — the table as CMTS would hold it. */
export const TEMP_IMPORT_ROWS: TempImportCalculationRow[] = TEMP_IMPORT_RUNS.flatMap(
  (r) => r.rows,
);

/* ------------------------------------------------------------------ *
 * ImportFreeHandedCalc — the seed
 *
 * Q4 confirms `FreeHandGR` is LIVE and reads "free hand" as a manually keyed
 * voucher: a charge an operator enters directly rather than one the engine
 * derives, for cases the rate card does not cover. So every entry here names a
 * case the rate card genuinely cannot price, and carries what the operator
 * keyed beside what the engine would have said.
 *
 * The KEYED figures are the invented part of this fixture and they are
 * deliberately round — 5,000 and 12,000 rather than 4,873.61 — so nobody
 * mistakes them for extracted data. The DERIVED figures beside them are the
 * demo engine's, unmodified.
 * ------------------------------------------------------------------ */

interface FreeHandSpec {
  AWBNO: string;
  reason: string;
  keyedBy: string;
  /** Keyed storage. Null means "take the engine's figure unchanged". */
  keyedStorage: number | null;
  keyedHandling: number | null;
  keyedOther: number;
  /** Days the operator keyed, where they differ from the dwell. */
  keyedDays: number | null;
}

const FREE_HAND_SEED: FreeHandSpec[] = [
  {
    AWBNO: "607-88991122",
    reason:
      "Misrouted inbound recovered from another station. The rate card has no heading for a recovery charge, so it is keyed against OtherChargesAmount — with nothing on the row to say that is what it is.",
    keyedBy: "s.raza",
    keyedStorage: 0,
    keyedHandling: null,
    keyedOther: 12000,
    keyedDays: 0,
  },
  {
    AWBNO: "020-11223344",
    reason:
      "Discrepancy hold. Storage is charged from the date the CDR closed rather than from intake, which the engine cannot express — so the whole storage figure is keyed.",
    keyedBy: "n.hassan",
    keyedStorage: 5000,
    keyedHandling: null,
    keyedOther: 0,
    keyedDays: 2,
  },
  {
    AWBNO: "176-33221100",
    reason:
      "Customs-detained portion released ahead of the balance. The engine prices the whole AWB; the counter bills the released share and keys the rest.",
    keyedBy: "n.hassan",
    keyedStorage: 18000,
    keyedHandling: 6000,
    keyedOther: 2500,
    keyedDays: null,
  },
  {
    AWBNO: "214-30049917",
    reason:
      "Human remains — welfare, no charge. The operator keys zeros because there is no ISFree column on this table to set.",
    keyedBy: "duty.manager",
    keyedStorage: 0,
    keyedHandling: 0,
    keyedOther: 0,
    keyedDays: null,
  },
  {
    AWBNO: "214-90055512",
    reason:
      "Unaccompanied baggage settled at the counter against a printed slip. Keyed rather than derived because the passenger is present and the amount is agreed there.",
    keyedBy: "counter.pew",
    keyedStorage: 3000,
    keyedHandling: 1500,
    keyedOther: 500,
    keyedDays: null,
  },
  {
    // A special-handling class on the free-hand path, which is where this
    // table's missing columns start to cost money: DGR carries a 6,500
    // special-handling charge and a 40% category surcharge, and
    // `ImportFreeHandedCalc` has a column for neither.
    AWBNO: "020-55839014",
    reason:
      "Segregated DGR store, billed at a rate agreed with the shipper for the duration of the hold. The rate card prices segregation by class; this consignment was priced by agreement.",
    keyedBy: "dgr.officer",
    keyedStorage: 15000,
    keyedHandling: null,
    keyedOther: 4000,
    keyedDays: null,
  },
];

function buildFreeHand(spec: FreeHandSpec, index: number): FreeHandEntry | null {
  const awb = awbByNo(spec.AWBNO);
  if (!awb) return null;

  const calc = priceFor(awb, 0);
  const cls = cargoClass(awb.CARGOCLASSID);
  const sub = cargoSubClass(awb.cargoSubClassId);
  const loc = awb.locationId !== null ? storageLocation(awb.locationId) : undefined;

  const storage = spec.keyedStorage ?? calc.storageAmount;
  const handling = spec.keyedHandling ?? calc.handlingAmount;
  const withoutTax = round2(
    storage +
      handling +
      calc.locationChargesAmount +
      cls.DOCUMENTATIONCHARGES +
      cls.DECONSOLIDATIONCHARGES +
      spec.keyedOther,
  );
  const tax = round2((withoutTax * calc.taxPercent) / 100);

  const key = `${awb.AWBNO}-FHC-01`;

  const row: ImportFreeHandedCalcRow = {
    UniqueIdentification: key,
    NumberofDays: spec.keyedDays ?? calc.totalDays,
    TotalWeight: awb.TOTALWEIGHT,
    HandlingUnit: HANDLING_UNIT,
    HandlingCharges: handling,
    StorgeUnit: STORAGE_UNIT,
    StorgeUnitCharges: storage,
    LocationUnit: LOCATION_UNIT,
    LocationChargesAmount: calc.locationChargesAmount,
    MinimumCharges: sub.MINCHARGES,
    DocumentationCharges: cls.DOCUMENTATIONCHARGES,
    DeconsolidationCharges: cls.DECONSOLIDATIONCHARGES,
    OtherChargesAmount: spec.keyedOther,
    // Offset the literal form from the temporary-import runs so both tabs
    // exercise different spellings of the same column.
    TaxPercentage: taxLiteral(calc.taxPercent, index + 1),
    Tax: tax,
    TotalAmountWithoutTax: withoutTax,
    TotalAmountWithTax: round2(withoutTax + tax),
    CityId: site(awb.site).CityId,
  };

  return {
    key,
    row,
    awbId: awb.AWBId,
    AWBNO: awb.AWBNO,
    site: awb.site,
    cargoClassId: awb.CARGOCLASSID,
    cargoSubClassId: awb.cargoSubClassId,
    chargeableKg: calc.chargeableKg,
    locationName: loc?.NAME ?? "UNALLOCATED",
    reason: spec.reason,
    keyedBy: spec.keyedBy,
    resolvedVoucherNo: GODOWN_RENTS.find((g) => g.AWBNO === awb.AWBNO)?.VOUCHERNO ?? null,
    calc,
  };
}

export const FREE_HAND_ENTRIES: FreeHandEntry[] = FREE_HAND_SEED.map(buildFreeHand)
  .filter((e): e is FreeHandEntry => e !== null);

export const FREE_HAND_ROWS: ImportFreeHandedCalcRow[] = FREE_HAND_ENTRIES.map((e) => e.row);

/* ================================================================== *
 * Scoping
 *
 * Both tables carry `CityId`, so unlike `grCharges` these scope on their own
 * column rather than through the parent AWB. The site is resolved from the AWB
 * anyway for display, and the two always agree here — a run where they did not
 * would be a data finding, which is precisely why the column is worth having.
 * ================================================================== */

export function listTempImportRuns(scope: SiteScope = "HQ"): TempImportRun[] {
  return scope === "HQ" ? TEMP_IMPORT_RUNS : TEMP_IMPORT_RUNS.filter((r) => r.site === scope);
}

export function tempImportRun(key: string): TempImportRun | undefined {
  return TEMP_IMPORT_RUNS.find((r) => r.key === key);
}

export function listFreeHandEntries(scope: SiteScope = "HQ"): FreeHandEntry[] {
  return scope === "HQ" ? FREE_HAND_ENTRIES : FREE_HAND_ENTRIES.filter((e) => e.site === scope);
}

export function freeHandEntry(key: string): FreeHandEntry | undefined {
  return FREE_HAND_ENTRIES.find((e) => e.key === key);
}
