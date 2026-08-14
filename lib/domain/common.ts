/**
 * AirVault domain — shared primitives.
 *
 * Field names deliberately mirror the CMTS (MS-SQL) column names so that
 * parity is checkable at a glance and the migration mapping is direct.
 * Where AirVault adds a concept CMTS has no column for, it is marked
 * `AirVault addition` in a comment.
 */

/* ------------------------------------------------------------------ *
 * Site / tenancy keys
 *
 * CMTS is already multi-site: `CityId` appears on ~30 tables and
 * `Comp_Code` / `Off_Code` on ~20. AirVault adds the HQ tier on top.
 * ------------------------------------------------------------------ */

export type SiteCode = "KHI" | "LHE" | "PEW";

/** The site selector also accepts "HQ", which means "all sites". */
export type SiteScope = SiteCode | "HQ";

export interface SiteKeys {
  /** CMTS `CityId` */
  CityId: number;
  /** CMTS `Comp_Code` */
  Comp_Code: number;
  /** CMTS `Off_Code` */
  Off_Code: number;
}

export interface Site extends SiteKeys {
  code: SiteCode;
  name: string;
  city: string;
  airportCode: string;
  /** AirVault addition — FC-12 platform layer: per-site nodes are offline-capable. */
  offlineCapable: boolean;
  /** AirVault addition — CDC / outbox sync state for the HQ tier. */
  lastSyncAt: string;
  pendingOutbox: number;
}

/* ------------------------------------------------------------------ *
 * Audit columns
 *
 * These six appear on ~60 CMTS tables. Every AirVault entity carries
 * them so the AuditStrip component can render on any record drawer.
 * ------------------------------------------------------------------ */

export interface AuditColumns {
  CreatedBy: string;
  UpdatedBy: string | null;
  /** ISO-8601 */
  CreatedDate: string;
  /** ISO-8601 */
  UpdatedDate: string | null;
  IsActive: boolean;
  IsDeleted: boolean;
}

/** Every persisted domain record. */
export interface DomainRecord extends AuditColumns, SiteKeys {}

/* ------------------------------------------------------------------ *
 * Document numbering (CMTS `AutoIncrementValues` + `TABLESEQUENCE`)
 *
 * Four separate flow amendments require AirVault numbering to continue
 * the CMTS sequence — FC-04 (CDR refs), FC-07 (invoices / vouchers),
 * FC-08 (gate passes), FC-10 (notices). Note the CMTS scoping:
 * `AutoIncrementValues` is per cargo class AND per year, so series are
 * not global.
 * ------------------------------------------------------------------ */

export type DocSeriesCode =
  | "AWB_INDEX"
  | "ARRIVAL_ADVICE"
  | "CDR"
  | "GR_VOUCHER"
  | "GR_DUPLICATE"
  | "INVOICE"
  | "CREDIT_NOTE"
  | "DELIVERY_ORDER"
  | "GATE_PASS"
  | "SECTION_82_NOTICE"
  | "TRANSHIPMENT_PERMIT"
  | "ULD_BUILD_REPORT"
  | "DISCREPANCY_NOTE"
  | "EXPORT_INVOICE"
  /** FC-06 — Single Declaration replaces the legacy GD; no CMTS ancestor. */
  | "SINGLE_DECLARATION"
  | "OOC";

export interface DocNumberRef {
  series: DocSeriesCode;
  /** The rendered number, e.g. "GR-2026-04421". */
  value: string;
  /** CMTS `AutoIncrementValues.IncrementedNo` */
  sequence: number;
  /** CMTS `AutoIncrementValues.Year` — series reset annually. */
  year: number;
  /** CMTS `AutoIncrementValues.CargoClassId` — series are scoped per class. */
  cargoClassId: number | null;
  /**
   * Provenance: the last value CMTS issued before cutover.
   *
   * `null` for series with no legacy ancestor — the Single Declaration is
   * the case in point, since FC-06 replaces the GD rather than continuing
   * it. A null here is meaningful, not missing data.
   */
  continuesFromCmts: number | null;
}

/* ------------------------------------------------------------------ *
 * Money & weight
 * ------------------------------------------------------------------ */

/** All amounts are PKR in this demo. */
export type Amount = number;

export interface WeightSet {
  /** CMTS `TOTALWEIGHT` / `WEIGTH` — measured actual weight, kg. */
  actualKg: number;
  /** FC-07 §05 — L × W × H / 6000. */
  volumetricKg: number;
  /** FC-07 §06 — max(actual, volumetric). CMTS `TOTALCHRGWEIGHT`. */
  chargeableKg: number;
}

/**
 * Dimension unit. Real AWBs use both — see the reference documents:
 *   816-00059205  "DIM(CMS): 44x40x40 (4)"        → centimetres
 *   816-00034156  "Volume Weight: 101.21 Kgs (Inches) 14X14X21/9" → inches
 */
export type DimensionUnit = "cm" | "in";

export interface Dimensions {
  /** CMTS `ACCEPTENCEDETAIL.LENGTH` */
  lengthCm: number;
  /** CMTS `ACCEPTENCEDETAIL.WIDTH` */
  widthCm: number;
  /** CMTS `ACCEPTENCEDETAIL.HEIGHT` */
  heightCm: number;
  /** CMTS `ACCEPTENCEDETAIL.UNIT` — the value is in this unit, not always cm. */
  unit: DimensionUnit | string;
}

/**
 * FC-07 §05 writes the divisor as a constant 6000. That is only correct for
 * centimetres. IATA uses **6000 for cm and 366 for inches**, and the
 * reference AWB 816-00034156 computes in inches:
 *
 *   14 × 14 × 21 × 9 = 37,044 cu.in ÷ 366 = 101.21 kg   ← matches the AWB
 *   the same figures ÷ 6000 would give 6.17 kg          ← 16× understated
 *
 * So the divisor is unit-dependent. Flagged to SAPS as a correction to
 * FC-07 §05 rather than a demo-only detail — it is a billing defect.
 */
export const VOLUMETRIC_DIVISORS: Record<DimensionUnit, number> = { cm: 6000, in: 366 };

/** Kept for callers that genuinely mean centimetres. */
export const VOLUMETRIC_DIVISOR = VOLUMETRIC_DIVISORS.cm;

export function volumetricDivisor(unit: Dimensions["unit"]): number {
  return unit === "in" ? VOLUMETRIC_DIVISORS.in : VOLUMETRIC_DIVISORS.cm;
}

export function volumetricKg(d: Dimensions): number {
  return round2((d.lengthCm * d.widthCm * d.heightCm) / volumetricDivisor(d.unit));
}

/**
 * IATA rounds chargeable weight **up to the next 0.5 kg**.
 * Reference AWB 816-00034156: gross 231.6 kg is billed as 232.0 kg.
 *
 * FC-07 §06 says only `max(actual, volumetric)`. Without the round-up the
 * demo under-bills every fractional weight — small per AWB, systematic at
 * volume. Flagged to SAPS as a correction to FC-07 §06.
 */
export function roundUpHalfKg(kg: number): number {
  return Math.ceil(kg * 2) / 2;
}

/** FC-07 §06 — chargeable = max(actual, volumetric), rounded up to 0.5 kg. */
export function chargeableKg(actualKg: number, volKg: number): number {
  return roundUpHalfKg(round2(Math.max(actualKg, volKg)));
}

export function buildWeightSet(actualKg: number, d: Dimensions): WeightSet {
  const vol = volumetricKg(d);
  return { actualKg: round2(actualKg), volumetricKg: vol, chargeableKg: chargeableKg(actualKg, vol) };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/* ------------------------------------------------------------------ *
 * OCR confidence (FC-01 05b/05c, FC-02 amendment)
 *
 * "Per-item confidence score + operator acceptance before commit."
 *
 * SCOPE — OCR runs at exactly TWO points in AirVault. Confirmed by SAPS,
 * and it narrows the FC-02/FC-06/FC-11 amendments as originally drawn:
 *
 *   1. Inbound from the airline — MAWB / HAWB off the flight pouch are
 *      scanned and extracted.                    → /import/ocr-intake
 *   2. Outbound at collection — the receiver's documents are scanned
 *      when they arrive to take delivery.        → /gate-entry/authority-letter-digitisation
 *
 * Nowhere else. Every other capture point is a keyed **form** — see
 * `FormValue` below. Do not add a third `OcrValue` site without a flow
 * change to match: OOC capture (FC-06) and export document capture
 * (FC-11) were both drawn as OCR and have since been converted.
 * ------------------------------------------------------------------ */

/** Below this, the operator must review the item individually (FC-01 05d). */
export const OCR_CONFIDENCE_THRESHOLD = 0.9;

export type OcrReviewState = "auto-accepted" | "needs-review" | "operator-corrected";

export interface OcrValue<T> {
  /** What OCR read. */
  extracted: T;
  /** What the operator committed — differs only when corrected. */
  value: T;
  /** 0–1. */
  confidence: number;
  state: OcrReviewState;
  correctedBy?: string;
}

export function ocrState(confidence: number, corrected: boolean): OcrReviewState {
  if (corrected) return "operator-corrected";
  return confidence >= OCR_CONFIDENCE_THRESHOLD ? "auto-accepted" : "needs-review";
}

export function ocr<T>(extracted: T, confidence: number, corrected?: T): OcrValue<T> {
  const isCorrected = corrected !== undefined && corrected !== extracted;
  return {
    extracted,
    value: isCorrected ? (corrected as T) : extracted,
    confidence,
    state: ocrState(confidence, isCorrected),
    ...(isCorrected ? { correctedBy: "n.hassan" } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * Keyed form entry — the default capture mode
 *
 * The counterpart to `OcrValue`. Everywhere outside the two scan points
 * above, a value is typed by a named operator against a named source
 * document. There is no confidence score because nothing was inferred —
 * but provenance still matters for audit, so it is carried explicitly
 * rather than dropped.
 * ------------------------------------------------------------------ */

export interface FormValue<T> {
  value: T;
  /** Who keyed it. */
  enteredBy: string;
  /** The paper/PDF the operator read it off, e.g. "OOC print — PSW". */
  source: string;
  /** ISO timestamp of the keystroke that committed it. */
  enteredAt: string;
  /** Set where a supervisor countersigned — FC-06 OOC and FC-11 handover. */
  verifiedBy?: string;
}

export function formEntry<T>(
  value: T,
  source: string,
  enteredBy = "n.hassan",
  enteredAt = "2026-05-25T09:40:00+05:00",
  verifiedBy?: string,
): FormValue<T> {
  return {
    value,
    enteredBy,
    source,
    enteredAt,
    ...(verifiedBy ? { verifiedBy } : {}),
  };
}

/* ------------------------------------------------------------------ *
 * Declared vs physical variance (FC-01 05e / §14 → FC-04)
 *
 * Declared (OCR) vs physical (received) variance raises a CDR (FC-04)
 * DIRECTLY from the §14 weighing / condition check. It does not rewind to
 * §07–08 reconciliation.
 *
 * That rewind used to be written here, and it was wrong in two ways: it
 * routed a physical finding back through a document-level decision that
 * cannot resolve it, and it implied an AWB's lifecycle stage moves
 * backwards, which nothing in this codebase does. §07–08 remains the
 * decision for manifest-vs-document discrepancies found at that stage —
 * it is simply no longer the destination of anything discovered at
 * weighing. The §14 finding has exactly one downstream edge: FC-04.
 *
 * This block sits above the tolerance constant that every weighing screen
 * imports, so treat it as the canonical statement of the rule.
 *
 * CMTS already models the declared/received pairs on IMPORTAWBDETAIL:
 *   PCS/RECEIVEDPCS, WEIGTH/RECEIVEDWT, CHARGEWEIGTH/CHARGEDRECEIVEDWT
 * ------------------------------------------------------------------ */

/** Above this relative difference, FC-04's amendment auto-raises a CDR. */
export const VARIANCE_TOLERANCE = 0.02;

export interface Variance {
  declared: number;
  physical: number;
  delta: number;
  /** Relative to declared; 0 when declared is 0 and physical is 0. */
  ratio: number;
  overTolerance: boolean;
}

export function variance(declared: number, physical: number): Variance {
  const delta = round2(physical - declared);
  const ratio = declared === 0 ? (physical === 0 ? 0 : 1) : Math.abs(delta) / declared;
  return {
    declared: round2(declared),
    physical: round2(physical),
    delta,
    ratio: Math.round(ratio * 10000) / 10000,
    overTolerance: ratio > VARIANCE_TOLERANCE,
  };
}

/* ------------------------------------------------------------------ *
 * Dwell / aging (FC-07 §01–03a storage clock, FC-10 aging engine)
 * ------------------------------------------------------------------ */

export const MS_PER_DAY = 86_400_000;

export function daysBetween(fromIso: string, toIso: string): number {
  return Math.max(0, Math.floor((Date.parse(toIso) - Date.parse(fromIso)) / MS_PER_DAY));
}

export interface DwellState {
  /**
   * FC-07 §02 — where the storage clock begins. This is cargo INTAKE
   * (`AWB.intakeAt`), not flight arrival (`AWB.arrivedAt`).
   *
   * The field is named for the clock rather than the event so that this
   * engine and `calculateCharges` cannot drift apart: whatever timestamp
   * is passed in here is the same one the charge calculator prices from.
   * The old `arrivedAt` name is what let the two disagree.
   */
  clockStartedAt: string;
  asOf: string;
  totalDays: number;
  freeDays: number;
  /** Days beyond the free period — what demurrage accrues on. */
  chargeableDays: number;
  /** FC-10 branch C — statutory threshold, from Section82Days. */
  section82Days: number;
  /** FC-10-C1 — cargo not cleared after the allowed period. */
  longStay: boolean;
  /** Days remaining before the Section 82 threshold; negative once past. */
  daysToSection82: number;
}

/**
 * The FC-07 §01–03a chain, in order. Each step depends on the one above it,
 * which is why they are computed here rather than assembled by each caller:
 *
 *   1. cargo intake is recorded                    → `AWB.intakeAt`
 *   2. the storage clock starts at that timestamp  → `clockStartedAt`
 *   3. the free / grace period runs from the clock start; nothing is
 *      charged inside it                           → `freeDays`
 *   4. chargeable period = dwell − free period     → `chargeableDays`,
 *      i.e. `Math.max(0, totalDays - freeDays)`
 *
 * Step 4 clamps at zero rather than going negative: cargo still inside its
 * free period has no chargeable days, not a credit. Section 82 is measured
 * on total dwell, not on the chargeable remainder — the statutory clock
 * does not pause for the grace period.
 *
 * Pass `AWB.intakeAt` as `clockStartedAt`. Passing flight arrival bills the
 * shed for time the cargo was still on the ramp.
 */
export function dwell(
  clockStartedAt: string,
  asOf: string,
  freeDays: number,
  section82Days: number,
): DwellState {
  const totalDays = daysBetween(clockStartedAt, asOf);
  return {
    clockStartedAt,
    asOf,
    totalDays,
    freeDays,
    chargeableDays: Math.max(0, totalDays - freeDays),
    section82Days,
    longStay: totalDays >= section82Days,
    daysToSection82: section82Days - totalDays,
  };
}

/* ------------------------------------------------------------------ *
 * Deterministic pseudo-randomness
 *
 * Fixtures must be stable across server and client renders — Math.random()
 * would produce hydration mismatches (see lib/rackData.ts, which has this
 * problem today). Seeded mulberry32 instead.
 * ------------------------------------------------------------------ */

export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: () => number, xs: readonly T[]): T {
  return xs[Math.floor(rng() * xs.length)];
}

export function intBetween(rng: () => number, lo: number, hi: number): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

/* ------------------------------------------------------------------ *
 * Formatting
 * ------------------------------------------------------------------ */

export function formatPkr(n: Amount): string {
  return `PKR ${Math.round(n).toLocaleString("en-PK")}`;
}

export function formatKg(n: number): string {
  return `${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`;
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The demo's "now". Fixed rather than `Date.now()` so dwell clocks, aging
 * badges and Section 82 countdowns are stable and reproducible in a
 * walkthrough — and so server and client agree.
 */
export const DEMO_NOW = "2026-08-03T14:32:00+05:00";
