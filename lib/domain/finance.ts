/**
 * AirVault domain — charges, godown rent, invoicing, waiver and DO.
 *
 * CMTS sources:
 *   `GODOWNRENT` (75)        the widest table in the schema
 *   `GODOWNRENTDETAIL` (26)  per-line working
 *   `GODOWNRENTDUPLICATE` (10)
 *   `grCharges` (48)         calculation scratch
 *   `AWBDELEIVERYORDER` (39) delivery order
 *   `CHARGECALCULATER` (3)   calculator screen header
 *   `CARGOSUBCLASSCHARGES` (15), `LOCATIONCHARGES` (10), `TaxType` (12)
 */

import type { Amount, DocNumberRef, DomainRecord, SiteCode } from "./common";
import { daysBetween, round2 } from "./common";
import { CATEGORY_SURCHARGES, TARIFF_SLABS, cargoClass, cargoSubClass } from "./masters";

/* ================================================================== *
 * Charge calculation — FC-07 §01–08, rendered step by step
 * ================================================================== */

export interface SlabLine {
  label: string;
  DAYFROM: number;
  DAYTO: number | null;
  daysInBand: number;
  ratePerKgPerDay: Amount;
  chargeableKg: number;
  amount: Amount;
}

export interface ChargeCalculation {
  awbId: number;
  /**
   * CMTS `CHARGECALCULATER.VOUCHERNO` — varchar(50), nullable in the source.
   *
   * The godown-rent voucher this calculation was written onto. It is the SAME
   * number as `GodownRent.VOUCHERNO` and the same series, not a second
   * identifier for the calculation: CMTS models the calculator as a header
   * pointing back at the voucher it priced, so a value here means "this
   * arithmetic is the working behind that document".
   *
   * Null is a real state, not missing data. The calculator runs in two modes
   * and only one of them has a voucher — a live quote priced against today's
   * tariff has not been committed to anything, so it legitimately reads null,
   * while a calculation recalled from a raised voucher carries that voucher's
   * number. Defaulting this to "" or synthesising a number would make an
   * uncommitted quote indistinguishable from a billed voucher on screen,
   * which is precisely what the source column being nullable guards against.
   */
  VOUCHERNO: string | null;
  /** Which tariff version produced this — provenance is a P5-1 requirement. */
  tariffVersion: string;
  calculatedAt: string;

  /*
   * FC-07 §01–03a, in the order the events actually happen. The fields are
   * laid out in that order deliberately: reading them top to bottom is the
   * charging story, and anything that reorders them reintroduces the old
   * bug where the free period appeared to be decided before the clock had
   * started.
   *
   *   §01  cargo arrives on the flight            → arrivalAt
   *   §02  cargo is taken into the shed and the
   *        storage clock starts                   → clockStartedAt
   *   §03  free / grace period runs from the
   *        clock start; nothing is charged in it  → freeDays
   *   §03a chargeable period = dwell − free       → chargeableDays
   *
   * `totalDays` is the dwell measured from §02 to the calculation instant,
   * NOT from §01 — the gap between the aircraft landing and the cargo being
   * accepted is the handler's, and is never billed to the consignee.
   */
  /** FC-07 §01 — flight arrival. Provenance and display only; nothing is priced from it. */
  arrivalAt: string;
  /** FC-07 §02 — the instant the storage clock started, i.e. the AWB's `intakeAt`. */
  clockStartedAt: string;
  /** Dwell in whole days, measured from `clockStartedAt`. */
  totalDays: number;
  /** FC-07 §03 — free / grace days from the clock start, during which nothing accrues. */
  freeDays: number;
  /** FC-07 §03a — `max(0, totalDays - freeDays) + supplementDays`. The only period priced. */
  chargeableDays: number;
  supplementDays: number;

  // FC-07 §04–06
  actualKg: number;
  volumetricKg: number;
  chargeableKg: number;

  // FC-07 §07 — category surcharge
  surcharges: Array<{ code: string; label: string; percent: number; amount: Amount }>;

  // FC-07 §08 — tariff slab
  slabLines: SlabLine[];

  // Components (CMTS `GODOWNRENTDETAIL` / `grCharges`)
  storageAmount: Amount;
  handlingAmount: Amount;
  locationChargesAmount: Amount;
  documentationCharges: Amount;
  deconsolidationCharges: Amount;
  specialHandlingCharges: Amount;
  miscellaneousCharges: Amount;
  minimumCharges: Amount;

  subTotal: Amount;
  taxPercent: number;
  taxAmount: Amount;
  total: Amount;
}

/**
 * FC-07 §08 — apply the tariff slabs across the chargeable days.
 * A stay crossing a band boundary is split across bands.
 */
export function slabBreakdown(chargeableDays: number, chargeableKg: number): SlabLine[] {
  const lines: SlabLine[] = [];
  for (const slab of TARIFF_SLABS) {
    const bandStart = slab.DAYFROM;
    const bandEnd = slab.DAYTO ?? Number.POSITIVE_INFINITY;
    // Days 1..chargeableDays are billable days after the free period.
    const from = Math.max(bandStart, 1);
    const to = Math.min(bandEnd, chargeableDays);
    const daysInBand = Math.max(0, to - from + 1);
    if (daysInBand === 0) continue;
    lines.push({
      label: slab.label,
      DAYFROM: slab.DAYFROM,
      DAYTO: slab.DAYTO,
      daysInBand,
      ratePerKgPerDay: slab.ratePerKgPerDay,
      chargeableKg,
      amount: round2(daysInBand * slab.ratePerKgPerDay * chargeableKg),
    });
  }
  return lines;
}

/** FC-07 §07 — surcharges that apply to a cargo class. */
export function surchargesFor(cargoClassId: number, base: Amount) {
  return CATEGORY_SURCHARGES.filter((s) => s.classIds.includes(cargoClassId)).map((s) => ({
    code: s.code,
    label: s.label,
    percent: s.percent,
    amount: round2((base * s.percent) / 100),
  }));
}

/**
 * The FC-07 §01–08 chain, computed end to end. Every intermediate is kept
 * so the calculator screen can show each step rather than just a total.
 *
 * The dwell arithmetic lives HERE and nowhere else. It used to arrive as a
 * pre-computed `totalDays`, which meant the flow's "clock starts" step had
 * no code behind it and every caller was free to start the clock wherever it
 * liked — fixtures started it at flight arrival, which billed the ramp. The
 * function now takes the two endpoints (`intakeAt` … `asOf`) and derives the
 * period itself, so there is exactly one place the clock can start.
 */
export function calculateCharges(input: {
  awbId: number;
  /** FC-07 §01 — flight arrival. Carried through for display; never priced. */
  arrivalAt: string;
  /** FC-07 §02 — recorded cargo intake (the AWB's `intakeAt`). The clock starts here. */
  intakeAt: string;
  /** The instant dwell is measured to — delivery date, or "now" for a live quote. */
  asOf: string;
  cargoClassId: number;
  cargoSubClassId: number;
  actualKg: number;
  volumetricKg: number;
  supplementDays?: number;
  handlingRatePerKg?: number;
  locationChargePerDay?: number;
  miscellaneous?: number;
  tariffVersion?: string;
  calculatedAt?: string;
  taxPercent?: number;
  /**
   * CMTS `CHARGECALCULATER.VOUCHERNO`. Optional on the way IN and required on
   * the way out, which is deliberate: a live quote has no voucher to name yet,
   * so callers pricing one simply omit it and the result records null rather
   * than the caller having to remember to pass a null through. Callers
   * recalling the working behind an already-raised voucher pass its number.
   */
  voucherNo?: string | null;
}): ChargeCalculation {
  const cls = cargoClass(input.cargoClassId);
  const sub = cargoSubClass(input.cargoSubClassId);

  // FC-07 §02 — the storage clock starts at cargo intake. Flight arrival is
  // deliberately not used: see the AWB.arrivedAt / AWB.intakeAt distinction.
  const clockStartedAt = input.intakeAt;

  // Dwell — step two feeding step three. Whole days from clock start to `asOf`;
  // daysBetween floors and clamps at zero, so an `asOf` before intake reads 0
  // rather than producing a negative (and therefore a credit) period.
  const totalDays = daysBetween(clockStartedAt, input.asOf);

  // FC-07 §03 — the free / grace period, counted from the clock start.
  const freeDays = cls.freeDays;
  const supplementDays = input.supplementDays ?? 0;

  // FC-07 §03a — chargeable period = dwell − free period. Only now does
  // anything become billable, and only these days reach the slabs below.
  const chargeableDays = Math.max(0, totalDays - freeDays) + supplementDays;
  const chargeableKg = round2(Math.max(input.actualKg, input.volumetricKg));

  // Cargo still inside its free period must produce exactly zero storage.
  // slabBreakdown already yields no lines at chargeableDays === 0, but that is
  // a consequence of its band arithmetic rather than a stated rule; asserting
  // it here means a future change to the band loop cannot start billing the
  // grace period by accident.
  const slabLines = chargeableDays > 0 ? slabBreakdown(chargeableDays, chargeableKg) : [];
  const storageAmount =
    chargeableDays > 0 ? round2(slabLines.reduce((n, l) => n + l.amount, 0)) : 0;

  const handlingAmount = round2(chargeableKg * (input.handlingRatePerKg ?? 12));
  const locationChargesAmount = round2(chargeableDays * (input.locationChargePerDay ?? 0));

  const surcharges = surchargesFor(input.cargoClassId, storageAmount);
  const surchargeTotal = round2(surcharges.reduce((n, s) => n + s.amount, 0));

  const raw = round2(
    storageAmount +
      handlingAmount +
      locationChargesAmount +
      surchargeTotal +
      cls.DOCUMENTATIONCHARGES +
      cls.DECONSOLIDATIONCHARGES +
      cls.SPECIALHANDLINGCHARGES +
      (input.miscellaneous ?? 0),
  );

  // CMTS `CARGOSUBCLASS.MINCHARGES` — the floor.
  const subTotal = round2(Math.max(raw, sub.MINCHARGES));
  const taxPercent = input.taxPercent ?? 15;
  const taxAmount = round2((subTotal * taxPercent) / 100);

  return {
    awbId: input.awbId,
    VOUCHERNO: input.voucherNo ?? null,
    tariffVersion: input.tariffVersion ?? "TARIFF-2026.2",
    calculatedAt: input.calculatedAt ?? input.asOf,
    arrivalAt: input.arrivalAt,
    clockStartedAt,
    totalDays,
    freeDays,
    chargeableDays,
    supplementDays,
    actualKg: round2(input.actualKg),
    volumetricKg: round2(input.volumetricKg),
    chargeableKg,
    surcharges,
    slabLines,
    storageAmount,
    handlingAmount,
    locationChargesAmount,
    documentationCharges: cls.DOCUMENTATIONCHARGES,
    deconsolidationCharges: cls.DECONSOLIDATIONCHARGES,
    specialHandlingCharges: cls.SPECIALHANDLINGCHARGES,
    miscellaneousCharges: input.miscellaneous ?? 0,
    minimumCharges: sub.MINCHARGES,
    subTotal,
    taxPercent,
    taxAmount,
    total: round2(subTotal + taxAmount),
  };
}

/* ================================================================== *
 * Godown rent voucher — CMTS `GODOWNRENT` (75), all columns
 * ================================================================== */

export type BillType = "NORMAL" | "SUPPLIMENT" | "DUPLICATE" | "FREEHAND";
export type PayMode = "CASH" | "PAYORDER" | "CHEQUE" | "CARD" | "BANK_TRANSFER" | "GATEWAY";

export interface GodownRent extends DomainRecord {
  GodownId: number;
  /** CMTS `VOUCHERNO` — continues the CMTS series. */
  VOUCHERNO: string;
  docNumber: DocNumberRef;
  GRDATE: string;
  CHALLANNO: string | null;
  IGMNO: string;
  AWBNO: string;
  SUBAWBNO: string | null;
  INDEXNO: string | null;
  SUBINDEXNO: string | null;
  TOTALWEIGHT: number;
  CHARGEABLEWEIGHT: number;
  DONO: string | null;
  ARRIVALDATE: string;
  DAYS: number;
  FREE: boolean;
  BILLTYPE: BillType;
  FROMDATE: string;
  TODATE: string;
  DELIVERYDATE: string | null;
  SUPPLIMENTDAYS: number;
  GRREFERENCE: string | null;
  TOTALPIECES: number;

  // Charge block
  HANDLING: Amount;
  DEMURRAGE: Amount;
  DOCUMENTATION: Amount;
  DECONSOLIDATION: Amount;
  MISCELLANEOUS: Amount;
  SPECIALHANDLING: Amount;
  TOTALAMOUNT: Amount;
  NETPAYABLE: Amount;

  // The seven CMTS `sum*` aggregates
  sumTotalAmountWithoutTax: Amount;
  sumLocationChargesAmount: Amount;
  sumHandlingCharges: Amount;
  sumStorgeUnitCharges: Amount;
  sumAFUAmount: Amount;
  sumMinimumCharges: Amount;
  sumTax: Amount;

  // Waiver block — FC-07 §10–12
  WAIVEOFF: boolean;
  WAIVEOFFPERCENT: number;
  WAIVEOFFAMOUNT: Amount;
  WAIVEOFFREASON: string | null;
  /** CMTS `WaivOfStorageOrAmount` — waive storage only, or the total. */
  WaivOfStorageOrAmount: "STORAGE" | "AMOUNT" | null;

  // Payment block — FC-07 §13
  PAID: boolean;
  CASH: boolean;
  CASHAMOUNT: Amount;
  PAYORDERNO: string | null;
  PAYORDERDATE: string | null;
  PAYORDERAMOUNT: Amount;
  PayOrder: boolean;
  Paymode: PayMode | null;
  CREDITCARD: string | null;
  MASTERCARD: string | null;
  ACCTITLE: string | null;
  ACCNO: string | null;
  BANKNAME: string | null;
  BANKBRANCHNAME: string | null;
  CHEQUENO: number | null;
  CHEQUEDATE: string | null;
  RECIEVEDBY: string | null;
  PAYDATE: string | null;
  OverPaidAmount: Amount;

  DUPLICATECOUNT: number;
  NTN: string | null;
  STN: string | null;
  GdUniqueIdentification: string;
  DetendUniqueIdentification: string | null;
  clearingAgent: string | null;
  GDNum: string | null;
  site: SiteCode;
}

/** CMTS `GODOWNRENTDETAIL` (26) — one row per class/subclass/location/day band. */
export interface GodownRentDetail {
  Id: number;
  GRNO: string;
  CLASSID: number;
  SUBCLASSID: number;
  LOCATIONID: number;
  INDEXNO: number | null;
  DAYS: number;
  WEIGHT: number;
  HandlingUnit: string;
  HandlingCharges: Amount;
  StorgeUnit: string;
  StorgeUnitCharges: Amount;
  LocationUnit: string;
  LocationCharges: Amount;
  MinimumCharges: Amount;
  SpecialCharges: Amount;
  Deconsolidation: Amount;
  DocCharges: Amount;
  AFUAmount: Amount;
  Freedays: number;
  TaxPercentage: string;
  Tax: Amount;
  TaxAmount: Amount;
  TotalAmountWithoutTax: Amount;
  TotalAmountWithTax: Amount;
  GodownId: number;
}

/** CMTS `GODOWNRENTDUPLICATE` (10) */
export interface GodownRentDuplicate {
  VOUCHERNO: string;
  SEQUENCENO: number;
  COMMENTS: string;
  DUPLICATEDATE: string;
  USERID: string;
  CityId: number;
  DuplicateAmount: Amount;
  DuplicateTax: Amount;
  DuplicateTotalAmount: Amount;
  DuplicateTaxPercen: number;
}

/* ================================================================== *
 * Waiver — FC-07 §10–12
 * ================================================================== */

export type WaiverReason =
  | "airline-delay"
  | "customs-hold"
  | "force-majeure"
  | "concession"
  | "govt-cargo"
  | "billing-correction";

export const WAIVER_REASON_LABEL: Record<WaiverReason, string> = {
  "airline-delay": "Airline delay",
  "customs-hold": "Customs hold",
  "force-majeure": "Force majeure",
  concession: "Concession",
  "govt-cargo": "Government cargo",
  "billing-correction": "Billing correction",
};

export type ApprovalDecision = "pending" | "approved" | "rejected";

export interface ApprovalLevel {
  level: number;
  role: string;
  approver: string | null;
  decision: ApprovalDecision;
  comment: string | null;
  decidedAt: string | null;
}

export interface WaiverRequest {
  id: number;
  voucherNo: string;
  awbId: number;
  requestedBy: string;
  requestedAt: string;
  reason: WaiverReason;
  note: string;
  /** Percent or amount — CMTS carries both. */
  mode: "percent" | "amount";
  percent: number;
  amount: Amount;
  /** CMTS `WaivOfStorageOrAmount` */
  scope: "STORAGE" | "AMOUNT";
  originalTotal: Amount;
  revisedTotal: Amount;
  levels: ApprovalLevel[];
  status: ApprovalDecision;
  /** Set once approved — FC-07 §12. */
  creditNoteNo: string | null;
  site: SiteCode;
}

export function waiverStatus(levels: ApprovalLevel[]): ApprovalDecision {
  if (levels.some((l) => l.decision === "rejected")) return "rejected";
  if (levels.every((l) => l.decision === "approved")) return "approved";
  return "pending";
}

/* ================================================================== *
 * Delivery Order — CMTS `AWBDELEIVERYORDER` (39), all columns
 *
 * FC-01 §22 is TWO events on one record, not one:
 *
 *   22a  DO requested — by the CHA, after the NOA (§18) reaches them.
 *        A request carries no release authority whatsoever. It records
 *        intent and starts the clock on the terminal's side.
 *   22b  DO issued — by the terminal, only once charges are settled AND
 *        `evaluateReleaseGate` clears. Issuance snapshots that evaluation
 *        onto the record so an auditor can see which conditions were true
 *        at the moment authority was granted, rather than re-deriving them
 *        later against facts that have since moved.
 *
 * Modelling them as one field is what let the pre-P0 demo show a "RELEASABLE
 * / n BLOCK" badge against a DO that had already been issued — a verdict on
 * an event that was over. Keep the two timestamps distinct.
 * ================================================================== */

export interface DeliveryOrder extends DomainRecord {
  DoId: number;
  IGMNO: string;
  AWBNO: string;
  HWBNO: string | null;
  DONO: string;
  docNumber: DocNumberRef;
  /**
   * Where the record stands between 22a and 22b, and after.
   *
   *   requested  22a done, 22b not — no release authority
   *   issued     22b done — authority granted, gate snapshot present
   *   collected  the CHA has taken it (FC-02 §33)
   *   cancelled  withdrawn before or after issue
   */
  status: "requested" | "issued" | "collected" | "cancelled";

  /* --- FC-01 §22a — requested by the CHA, after the NOA --- */
  /** ISO — when the CHA raised the request. Always set; a DO record starts here. */
  requestedAt: string;
  /** The CHA / agent who requested it. */
  requestedBy: string;
  /** ISO of the NOA (§18) this request follows, when one was issued. */
  requestedAgainstNoaAt: string | null;

  /* --- FC-01 §22b — issued by the terminal, after payment + release gate --- */
  /** ISO — null until 22b. `DODATE` mirrors this for CMTS parity. */
  issuedAt: string | null;
  /** Terminal user who issued it. Null until 22b. */
  issuedBy: string | null;
  /** ISO of the release-gate evaluation that permitted issuance. Null until 22b. */
  gateEvaluatedAt: string | null;
  /**
   * The five conditions exactly as they read at issuance — the audit artefact.
   * Screens showing an ISSUED DO must render this, not a live re-evaluation:
   * a condition that has since gone stale does not retract authority already
   * granted, and showing today's verdict against yesterday's issue is how the
   * DO screen came to display a block on a DO that was already out the door.
   */
  gateSnapshot: ReleaseCondition[] | null;

  /**
   * CMTS `DODATE` — the legacy single date column, kept for migration parity.
   * It is the 22b ISSUE date and nothing else, and mirrors `issuedAt`. Do not
   * overload it with the 22a request date; that is `requestedAt`.
   *
   * Null while the record is still at 22a. CMTS had no requested state, so a
   * legacy row simply did not exist until issue — null is the faithful
   * representation of "no legacy row yet", and matches `AWB.DODATE`, which is
   * already `string | null` for the same reason.
   */
  DODATE: string | null;
  DOTYPE: string;
  DOCARGOCLASSID: number;
  AMOUNT: Amount;
  Tax: number;
  REMARKS: string | null;
  SHIFT: string;
  CHALLANNO: string | null;

  // Receiver identity
  RECIEVEDBY: string;
  NIC: string | null;
  PASSPORT: string | null;

  // Authorised agent block — entirely absent from the pre-P0 demo
  AuthAgentName: string | null;
  AuthAgentCNIC: string | null;
  AuthAgentPhone: string | null;
  AuthAgentEmail: string | null;
  AuthLetterNo: string | null;
  AuthAgentPic: string | null;

  NTN: string | null;
  STN: string | null;

  FREE: boolean;
  FREECAUSE: string | null;

  IsDuplicate: boolean;
  DuplicateReason: string | null;
  Reason: string | null;
  FIRdate: string | null;
  IsLock: boolean;
  DetendIdentification: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * DO release gate — FC-07 "Godown Rent Verification"
 *
 * The flow fans out to five conditions that all converge on
 * "G.Rent Voucher issued". Treated as AND pending BLK-10.
 *
 * This gate is the authority behind FC-01 §22b: nothing issues a Delivery
 * Order without it clearing. Ask `canIssueDo()` below rather than reading
 * `canRelease` directly, so issuance has one enforcement point.
 * ================================================================== */

/**
 * `"ooc-verified-vs-sd"` was `"ooc-available"`. Availability was never the
 * condition the flow meant: an Out-of-Charge can be captured, sit on the
 * record and still disagree with the Single Declaration it is supposed to
 * discharge. The code now names what is actually tested — the field-by-field
 * verification. The rename is deliberately visible, because
 * GateOutCheck.newlyFailedConditions renders these codes to operators as chips
 * and the old wording would have kept promising a check nobody performed.
 */
export type ReleaseConditionCode =
  | "ooc-verified-vs-sd"
  | "authority-verified"
  | "charges-paid"
  | "not-on-hold"
  | "special-clearance";

export interface ReleaseCondition {
  code: ReleaseConditionCode;
  label: string;
  /** True = satisfied. */
  pass: boolean;
  /** Why it failed, or the evidence that it passed. */
  detail: string;
  /** Where to go to fix it. */
  href: string | null;
  /** Conditional conditions show as N/A rather than blocking — see BLK-10. */
  applicable: boolean;
}

export interface ReleaseGate {
  awbId: number;
  conditions: ReleaseCondition[];
  /** All applicable conditions pass. */
  canRelease: boolean;
  blockedBy: ReleaseCondition[];
}

export function evaluateReleaseGate(
  awbId: number,
  facts: {
    /** An OOC record exists against the AWB — capture only, no authority on its own. */
    oocIssued: boolean;
    oocRef?: string | null;
    /**
     * The captured OOC has been reconciled field-by-field against the Single
     * Declaration and every field agrees — `oocVerified()` in ./customs.
     *
     * REQUIRED, not optional, and deliberately so. As an optional flag every
     * caller could omit it and silently fall back to the old behaviour where
     * issuance alone released the cargo; as a required one, the compiler makes
     * each call site state whether verification happened.
     */
    oocVerifiedVsSd: boolean;
    /** Fields that disagreed with the SD — `oocMismatches().length`. 0 when none. */
    oocMismatchCount: number;
    oocVerifiedAt: string | null;
    oocVerifiedBy: string | null;
    authorityLetterNo?: string | null;
    chargesPaid: boolean;
    outstanding?: Amount;
    onHold: boolean;
    holdReason?: string | null;
    cargoClassId: number;
    specialClearanceDone: boolean;
  },
): ReleaseGate {
  const cls = cargoClass(facts.cargoClassId);

  // The old detail string asserted the OOC was "verified against the
  // declaration" while the condition tested nothing but its existence — the
  // screen therefore told operators a check had happened that had not. Three
  // honest states replace it: nothing captured, captured but unreconciled, and
  // reconciled (with the evidence of who did it and when).
  const oocRef = facts.oocRef ?? "(no reference)";
  const oocDetail = !facts.oocIssued
    ? "No Out-of-Charge captured against this AWB"
    : !facts.oocVerifiedVsSd
      ? facts.oocMismatchCount > 0
        ? `Out-of-Charge ${oocRef} captured but NOT verified — ${facts.oocMismatchCount} field${
            facts.oocMismatchCount === 1 ? "" : "s"
          } disagree with the Single Declaration`
        : `Out-of-Charge ${oocRef} captured but not yet reconciled field-by-field against the Single Declaration`
      : `Out-of-Charge ${oocRef} verified field-by-field against the Single Declaration by ${
          facts.oocVerifiedBy ?? "an unrecorded user"
        }${facts.oocVerifiedAt ? ` on ${facts.oocVerifiedAt}` : ""}`;

  const conditions: ReleaseCondition[] = [
    {
      code: "ooc-verified-vs-sd",
      label: "OOC verified against SD",
      // Both halves, and the capture half alone is worth nothing. This is the
      // edge the signed-off decision removes: OOC issued no longer implies
      // eligible for release. It fails closed — an OOC that exists but has not
      // been reconciled blocks exactly as hard as no OOC at all.
      pass: facts.oocIssued && facts.oocVerifiedVsSd,
      detail: oocDetail,
      // The verification itself is performed on the customs channels screen.
      // The keying path that produces an OOC when the PSW gateway is down now
      // lives at /customs/ooc-capture; this gate links at the reconciliation,
      // not the capture, because what blocks release is the unreconciled OOC.
      href: "/customs/channels",
      applicable: true,
    },
    {
      code: "authority-verified",
      label: "AWB authority verified",
      pass: !!facts.authorityLetterNo,
      detail: facts.authorityLetterNo
        ? `Authority letter ${facts.authorityLetterNo} on file`
        : "No authority letter or endorsement on file",
      href: "/gate-entry/authority-letter-digitisation",
      applicable: true,
    },
    {
      code: "charges-paid",
      label: "DO charges paid",
      pass: facts.chargesPaid,
      detail: facts.chargesPaid
        ? "All charges settled"
        : `Outstanding balance ${facts.outstanding ?? 0}`,
      href: "/finance-manager/payment-reconciliation",
      applicable: true,
    },
    {
      code: "not-on-hold",
      label: "Cargo not on hold",
      pass: !facts.onHold,
      detail: facts.onHold ? (facts.holdReason ?? "Hold is live") : "No live hold",
      // The hold register merged into the canonical exceptions screen, which is
      // the one place that both renders the seven HOLDINGSTATUS release columns
      // and carries the action that populates them.
      href: "/exceptions/holds",
      applicable: true,
    },
    {
      code: "special-clearance",
      label: "Special clearance completed",
      // BLK-10: treated as conditional on cargo class rather than universal,
      // because the FC-07 amendment lists only four conditions.
      pass: cls.requiresSpecialClearance ? facts.specialClearanceDone : true,
      detail: cls.requiresSpecialClearance
        ? facts.specialClearanceDone
          ? "ANF / ASF / agency clearance recorded"
          : `${cls.ABBREVATION} requires special clearance — not recorded`
        : `Not required for ${cls.ABBREVATION}`,
      // The tabular customs work queue relocated into the customs portal. It is
      // the right target for this condition because special clearance is worked
      // from the queue, not from the master-detail channels viewer.
      href: "/customs/queue",
      applicable: cls.requiresSpecialClearance,
    },
  ];

  const blockedBy = conditions.filter((c) => c.applicable && !c.pass);
  return { awbId, conditions, canRelease: blockedBy.length === 0, blockedBy };
}

/**
 * FC-01 §22b — the single enforcement point for DO ISSUANCE.
 *
 * Every screen that offers an "Issue DO" action must ask this rather than
 * re-deriving the rule; the pre-P0 demo let each screen decide for itself and
 * the record ended up existing regardless of what the gate said.
 *
 * PAYMENT IS FOLDED INTO THE GATE, NOT A SEPARATE PRECONDITION. "DO charges
 * paid" is already condition 3 of the five, so a caller that additionally
 * required payment on the side would be testing the same fact twice and would
 * eventually disagree with itself. `facts.chargesPaid` is therefore NOT a
 * second hurdle — it is the caller's live payment fact, checked only for
 * disagreement with the gate. If the gate was evaluated when the invoice read
 * paid and the caller now knows it is not, issuance fails closed on a
 * synthesised failure of condition 3 rather than trusting the older snapshot.
 * A caller with nothing fresher passes the gate's own answer straight back.
 */
export function canIssueDo(
  gate: ReleaseGate,
  facts: { chargesPaid: boolean },
): { ok: boolean; blockedBy: ReleaseCondition[]; reason: string | null } {
  const charges = gate.conditions.find((c) => c.code === "charges-paid");

  const stalePayment: ReleaseCondition | null =
    charges && charges.applicable && charges.pass && !facts.chargesPaid
      ? {
          ...charges,
          pass: false,
          detail:
            "Charges were settled when the gate was evaluated but are outstanding now — re-evaluate before issuing",
        }
      : null;

  const blockedBy = stalePayment ? [...gate.blockedBy, stalePayment] : gate.blockedBy;
  const ok = blockedBy.length === 0;

  return {
    ok,
    blockedBy,
    reason: ok
      ? null
      : `DO cannot be issued — ${blockedBy.length} of ${
          gate.conditions.filter((c) => c.applicable).length
        } release conditions unmet: ${blockedBy.map((c) => c.label).join(", ")}`,
  };
}

/* ================================================================== *
 * Invoice & payment
 * ================================================================== */

export interface Invoice {
  id: number;
  invoiceNo: string;
  docNumber: DocNumberRef;
  awbId: number;
  IGMNO: string;
  AWBNO: string;
  issuedAt: string;
  dueAt: string;
  subTotal: Amount;
  taxAmount: Amount;
  total: Amount;
  paid: Amount;
  outstanding: Amount;
  status: "draft" | "issued" | "part-paid" | "paid" | "overdue" | "credited";
  payerPartyId: number;
  site: SiteCode;
}

export interface PaymentRecord {
  id: number;
  invoiceNo: string;
  paidAt: string;
  amount: Amount;
  mode: PayMode;
  /** Gateway transactions auto-reconcile (FC-07 amendment). */
  gatewayRef: string | null;
  reconciled: boolean;
  /** Populated for legacy instruments. */
  challanNo: string | null;
  payOrderNo: string | null;
  chequeNo: number | null;
  bankName: string | null;
  receivedBy: string;
  site: SiteCode;
}
