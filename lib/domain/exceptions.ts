/**
 * AirVault domain — CDR, holds, and the three FC-10 exception branches.
 *
 * CMTS sources:
 *   `DamageDetail` (8)
 *   `HOLDINGSTATUS` (29)   — note the seven release-side columns
 *   `AWBSECTION82` (22)
 *   `AWBTRANSFER` (25)     — carries mishandled/re-export in CMTS
 *   `Section82Days` (2)
 */

import type { Amount, DocNumberRef, DomainRecord, SiteCode, Variance } from "./common";

/* ================================================================== *
 * CDR — FC-04
 * ================================================================== */

/** FC-04 §02 — the nine discrepancy types, verbatim from the flow. */
export type DiscrepancyType =
  | "shortage"
  | "overage"
  | "damage"
  | "leakage-wet"
  | "tampering"
  | "pilferage"
  | "missing-documents"
  | "wrong-weight"
  | "misrouted";

export const DISCREPANCY_LABEL: Record<DiscrepancyType, string> = {
  shortage: "Shortage",
  overage: "Overage",
  damage: "Damage",
  "leakage-wet": "Leakage / Wet Cargo",
  tampering: "Tampering",
  pilferage: "Pilferage",
  "missing-documents": "Missing Documents",
  "wrong-weight": "Wrong Weight",
  misrouted: "Misrouted Cargo",
};

/** These three fall straight out of FC-01/02 variance per the FC-04 amendment. */
export const VARIANCE_DERIVED_TYPES: DiscrepancyType[] = ["shortage", "overage", "wrong-weight"];

/**
 * FC-08 opens three more routes into FC-04, so a CDR no longer implies an
 * intake finding. These are the types those routes raise. `shortage` is
 * deliberately shared with the variance set above, and that overlap is the
 * whole reason `CDR.origin` exists: the type says what was wrong, the origin
 * says which decision found it, and a workbench filtered on type alone cannot
 * tell a short pick from a short receipt.
 */
export const DISPATCH_DERIVED_TYPES: DiscrepancyType[] = ["shortage", "damage"];

/** Which decision raised the CDR — one intake route, three dispatch routes. */
export type CdrOrigin =
  | "intake-variance"
  | "picking-count"
  | "picking-unavailable"
  | "handover-damage";

/** The FC-08 routes — every origin except the FC-01/02 intake one. */
export type DispatchCdrOrigin = Exclude<CdrOrigin, "intake-variance">;

export const CDR_ORIGIN_LABEL: Record<CdrOrigin, string> = {
  "intake-variance": "Intake variance (FC-01 §14)",
  "picking-count": "Piece count mismatch at picking (FC-08 §09)",
  "picking-unavailable": "Cargo unavailable at picking (FC-08 §10)",
  "handover-damage": "Damage found at handover (FC-08 §13–14)",
};

export function isDispatchOrigin(o: CdrOrigin): o is DispatchCdrOrigin {
  return o !== "intake-variance";
}

/**
 * Each dispatch route raises exactly one discrepancy type, fixed here rather
 * than chosen per call site. A piece that is not at its location is still a
 * shortage against the gate pass — the cargo is missing, and whether it went
 * missing off the aircraft or off the rack is what the origin records.
 *
 * The intake route is absent on purpose: its type depends on which measure
 * breached tolerance (shortage / overage / wrong-weight), so it cannot be
 * derived from the origin alone.
 */
export const DISPATCH_ORIGIN_TYPE: Record<DispatchCdrOrigin, DiscrepancyType> = {
  "picking-count": "shortage",
  "picking-unavailable": "shortage",
  "handover-damage": "damage",
};

/**
 * What a dispatch-raised CDR points back at, so the workbench can open the
 * gate pass, the piece or the POD that produced it. Null on intake-raised
 * CDRs, whose subject is the AWB itself.
 */
export interface CdrSourceRef {
  gatePassNo?: number;
  pieceId?: string;
  podId?: number;
}

/** FC-04 §03 — the six evidence items. */
export type EvidenceKind =
  | "photo"
  | "weight"
  | "piece-count"
  | "package-condition"
  | "seal-condition"
  | "remarks";

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  photo: "Photos",
  weight: "Weight",
  "piece-count": "Piece count",
  "package-condition": "Package condition",
  "seal-condition": "Seal condition",
  remarks: "Remarks",
};

/**
 * FC-04 amendment — "Evidence pack captured digitally: scan / photos,
 * RFID/AWB-linked, timestamped, attached to the CDR (doc mgmt M02) —
 * vs remarks-only in CMTS."
 */
export interface EvidenceItem {
  id: number;
  kind: EvidenceKind;
  /** Free text, a measurement, or a document reference depending on kind. */
  value: string;
  documentId: string | null;
  /** RFID/AWB linkage is what makes the pack defensible. */
  linkedAwbNo: string;
  linkedRfid: string | null;
  capturedAt: string;
  capturedBy: string;
}

/** FC-04 §11 — the five final actions. */
export type CdrFinalAction =
  | "F1-release-after-correction"
  | "F2-adjust-pieces-weight"
  | "F3-forward-mishandled"
  | "F4-re-export"
  | "F5-claim-liability";

export const CDR_FINAL_ACTION_LABEL: Record<CdrFinalAction, string> = {
  "F1-release-after-correction": "F1. Release after correction",
  "F2-adjust-pieces-weight": "F2. Adjust pieces / weight",
  "F3-forward-mishandled": "F3. Forward as mishandled (FC-10-A)",
  "F4-re-export": "F4. Re-export (FC-10-B)",
  "F5-claim-liability": "F5. Claim / liability process",
};

export type CdrStatus =
  | "draft"
  | "evidence"
  | "notified"
  | "on-hold"
  | "awaiting-instruction"
  | "action-selected"
  | "closed";

export interface CDR extends DomainRecord {
  id: number;
  /** FC-04 §05 — reference number continuing the CMTS sequence. */
  cdrRef: string;
  docNumber: DocNumberRef;
  awbId: number;
  IGMNO: string;
  AWBNO: string;
  HWBNO: string | null;

  type: DiscrepancyType;
  /** True when the FC-04 amendment's variance rule raised this automatically. */
  autoRaised: boolean;
  /**
   * Which decision raised it. Once a CDR is open its origin is otherwise
   * unrecoverable — `type` cannot separate the routes because intake and
   * picking both raise `shortage`, and `raisedBy` is free text.
   */
  origin: CdrOrigin;
  /** The gate pass / piece / POD behind a dispatch-raised CDR; null at intake. */
  sourceRef: CdrSourceRef | null;
  variance: Variance | null;

  raisedAt: string;
  raisedBy: string;
  status: CdrStatus;

  evidence: EvidenceItem[];

  /** FC-04 §06–07 — these happen once, on creation. */
  airlineNotifiedAt: string | null;
  customsNotifiedAt: string | null;

  /**
   * FC-04 §08 — one entry per pass through the instruction loop.
   *
   * §10's No edge is labelled "Keep on Hold / Escalate" and points **back
   * at §08 Send DIS Status Message** — so the DIS goes out again on every
   * round, to a higher authority each time. This was previously an
   * `escalationCount: number` beside a single `disMessageSentAt`, which
   * could not say when each chase went out, to whom, or under what DIS
   * reference. A stored count next to a list is also how the two come to
   * disagree, so the count is now derived — see `cdrEscalations`.
   */
  dispatches: CdrDispatch[];

  /** FC-04 §09 — quarantine hold zone. */
  holdLocationId: number | null;

  finalAction: CdrFinalAction | null;
  closedAt: string | null;
  site: SiteCode;
}

/** One §08 dispatch — the first send, then one per escalation round. */
export interface CdrDispatch {
  round: number;
  /** IATA DIS message reference for this send. */
  disMessageRef: string;
  sentAt: string;
  /** Who this round went to — escalation means a higher authority. */
  sentTo: string;
  /** Why it was re-sent; null on the first send. */
  escalationReason: string | null;
  /** FC-04 §10 — the instruction, when this round finally produced one. */
  instructionReceivedAt: string | null;
  instructionText: string | null;
}

/**
 * FC-04 §10 — how many times the No edge was taken. The first dispatch is
 * the original §08 send, not an escalation, so it does not count.
 */
export function cdrEscalations(c: CDR): number {
  return Math.max(0, c.dispatches.length - 1);
}

/** The original §08 send. */
export function cdrFirstDisAt(c: CDR): string | null {
  return c.dispatches[0]?.sentAt ?? null;
}

/** The round that produced an instruction, if any has. */
export function cdrInstruction(c: CDR): CdrDispatch | null {
  return c.dispatches.find((d) => d.instructionReceivedAt !== null) ?? null;
}

/* ------------------------------------------------------------------ *
 * FC-04 §12 — the closure gate
 *
 * The flow reaches "12. Close CDR" only through §11, and §11 only through
 * a Yes at §10. Closing without an instruction, or without a final action,
 * means the discrepancy was abandoned rather than resolved — which is the
 * state a claim later gets argued over.
 * ------------------------------------------------------------------ */

export interface CdrCloseCondition {
  code: "evidence" | "notified" | "dis-sent" | "instruction" | "final-action";
  label: string;
  pass: boolean;
  detail: string;
}

export function evaluateCdrClosure(c: CDR) {
  const instruction = cdrInstruction(c);
  // §03's six evidence kinds. Photos and remarks alone are the CMTS
  // remarks-only pattern the amendment exists to replace, so a pack that
  // has not measured anything does not count as captured.
  const kinds = new Set(c.evidence.map((e) => e.kind));
  const measured = ["weight", "piece-count"].some((k) => kinds.has(k as EvidenceKind));

  const conditions: CdrCloseCondition[] = [
    {
      code: "evidence",
      label: "Evidence pack captured",
      pass: kinds.size >= 3 && measured,
      detail:
        kinds.size === 0
          ? "No evidence captured"
          : !measured
            ? `${kinds.size} of 6 kinds — but nothing measured (weight or piece count)`
            : `${kinds.size} of 6 kinds, ${c.evidence.length} items`,
    },
    {
      code: "notified",
      label: "Airline representative notified (§06)",
      pass: c.airlineNotifiedAt !== null,
      detail: c.airlineNotifiedAt ? "Notified" : "Not notified",
    },
    {
      code: "dis-sent",
      label: "DIS status message sent (§08)",
      pass: c.dispatches.length > 0,
      detail:
        c.dispatches.length === 0
          ? "Never sent"
          : `${c.dispatches.length} dispatch(es), ${cdrEscalations(c)} escalation(s)`,
    },
    {
      code: "instruction",
      label: "Instruction received (§10)",
      pass: instruction !== null,
      detail: instruction
        ? `Round ${instruction.round} — ${instruction.instructionText ?? ""}`
        : "Still on hold, awaiting the airline",
    },
    {
      code: "final-action",
      label: "Final action selected (§11)",
      pass: c.finalAction !== null,
      detail: c.finalAction ? CDR_FINAL_ACTION_LABEL[c.finalAction] : "Not selected",
    },
  ];

  return {
    conditions,
    canClose: conditions.every((x) => x.pass),
    blockedBy: conditions.filter((x) => !x.pass),
  };
}

/* ================================================================== *
 * Damage — CMTS `DamageDetail` (8)
 * ================================================================== */

export interface DamageDetail {
  DamageId: number;
  AWBId: number;
  HWBId: number | null;
  TypeofPack: string;
  TypeofDamage: string;
  DamagedPcs: number;
  DamageWeight: number;
  Remarks: string | null;
  /** AirVault addition — link back to the CDR that recorded it. */
  cdrRef: string | null;
  photos: string[];
}

export const PACK_TYPES = ["Carton", "Wooden Crate", "Pallet", "Drum", "Bag", "Loose", "ULD"] as const;
export const DAMAGE_TYPES = [
  "Crushed",
  "Torn",
  "Punctured",
  "Wet",
  "Leaking",
  "Seal broken",
  "Contents exposed",
  "Temperature excursion",
] as const;

/* ================================================================== *
 * Holds — CMTS `HOLDINGSTATUS` (29), both sides fully attributed
 * ================================================================== */

/**
 * Who is holding the cargo, and under what authority.
 *
 * `anf` and `asf` are separate members rather than one `security` member
 * because they are two different Pakistani agencies: the Anti-Narcotics
 * Force acts under the Control of Narcotic Substances Act, the Airport
 * Security Force under the ASF Act. They issue their own clearance
 * references, they staff different desks, and — the operational point —
 * only the agency that placed a hold can lift it. A register that says
 * "Security" does not tell the duty officer who to call, which is the one
 * question the register exists to answer. The vocabulary was already in
 * the domain: `AgencyClearance.agency` in `customs.ts` has modelled ANF
 * and ASF separately since FC-06; it simply never reached this union.
 *
 * `security` stays for rows that predate the split, where CMTS recorded a
 * security hold without naming the agency. Dropping it would force every
 * historical row to be re-labelled as one agency or the other, which is
 * inventing an attribution rather than migrating one.
 *
 * `internal` is SAPS holding its own cargo — a stock reconciliation, a
 * location audit, a supervisor's stop — with no external agency behind
 * it. Folded into `customs` it overstated the legal weight of a hold the
 * terminal can lift itself, and understated how many holds SAPS owns.
 */
export type HoldType =
  | "customs"
  | "anf"
  | "asf"
  | "security"
  | "cdr-osd"
  | "discrepancy"
  | "internal"
  | "payment";

export const HOLD_TYPE_LABEL: Record<HoldType, string> = {
  customs: "Customs hold",
  anf: "ANF hold",
  asf: "ASF hold",
  security: "Security",
  "cdr-osd": "CDR / OSD hold",
  discrepancy: "Discrepancy",
  internal: "Internal (SAPS)",
  payment: "Payment",
};

export interface HoldRecord extends DomainRecord {
  SEQUENCE: number;
  AWBNo: string;
  IGMNO: string;
  HWBNo: string | null;
  CARGOCLASSID: number;
  STATUS: string;
  type: HoldType;

  // Hold side
  HeldBy: string;
  NameOfPerson: string;
  NIC: string;
  HoldingCompany: string;
  Designation: string;
  Date: string;
  REMARKS: string;

  // Release side — the seven CMTS release columns
  Release: boolean;
  ReleasePersonName: string | null;
  ReleaseCompany: string | null;
  ReleaseBy: string | null;
  ReleasePersonDesignation: string | null;
  ReleasePersonNic: string | null;
  ReleaseRemarks: string | null;
  ReleaseDateTime: string | null;

  site: SiteCode;
}

export function isHoldLive(h: HoldRecord): boolean {
  return !h.Release && !h.IsDeleted;
}

/* ================================================================== *
 * FC-10-A — Mishandled / misrouted. No dedicated CMTS table.
 * ================================================================== */

export type MishandledStage =
  | "A1-identified"
  | "A2-exception-hold"
  | "A3-cdr-raised"
  | "A4-airline-notified"
  | "A5-instruction-received"
  | "A6-recovery-selected"
  | "A7-re-tendered"
  | "A8-closed";

export const MISHANDLED_STAGE_LABEL: Record<MishandledStage, string> = {
  "A1-identified": "A1. Wrong destination / misrouted / offloaded in error",
  "A2-exception-hold": "A2. Move to exception hold",
  "A3-cdr-raised": "A3. Create DIS / CDR",
  "A4-airline-notified": "A4. Notify airline",
  "A5-instruction-received": "A5. Airline issues recovery instruction",
  "A6-recovery-selected": "A6. Recovery action by customs",
  "A7-re-tendered": "A7. Re-tender to outbound carrier",
  "A8-closed": "A8. Close as mishandled-forwarded",
};

/** FC-10-A's three recovery options, each with its own required fields. */
export type RecoveryAction = "forward-correct-destination" | "reroute-original-awb" | "corrective-awb";

export const RECOVERY_ACTION_LABEL: Record<RecoveryAction, string> = {
  "forward-correct-destination": "Forward to correct destination",
  "reroute-original-awb": "Re-route under original AWB",
  "corrective-awb": "Corrective AWB / endorsement",
};

export interface MishandledCase extends DomainRecord {
  id: number;
  awbId: number;
  AWBNO: string;
  IGMNO: string;
  stage: MishandledStage;
  cdrRef: string | null;
  identifiedAt: string;
  holdLocationId: number | null;

  airlineNotifiedAt: string | null;
  instructionRef: string | null;
  instructionAt: string | null;
  instructionText: string | null;

  recoveryAction: RecoveryAction | null;
  correctiveAwbNo: string | null;
  endorsementRef: string | null;
  onwardRouting: string | null;

  reTenderedAt: string | null;
  reTenderCarrier: string | null;
  closedAt: string | null;
  /** Days in exception hold — drives the aging dashboard. */
  ageDays: number;
  site: SiteCode;
}

/* ================================================================== *
 * FC-10-B — Re-export
 * ================================================================== */

export type ReExportStage =
  | "B1-cannot-clear"
  | "B2-re-export-hold"
  | "B3-request-raised"
  | "B4-sd-lodged"
  | "B5-permission-granted"
  | "B6-charges-settled"
  | "B7-re-tendered"
  | "B8-closed";

export const REEXPORT_STAGE_LABEL: Record<ReExportStage, string> = {
  "B1-cannot-clear": "B1. Cannot be cleared / consignee refuses / customs rejects",
  "B2-re-export-hold": "B2. Move to re-export hold",
  "B3-request-raised": "B3. Re-export request raised",
  "B4-sd-lodged": "B4. Re-export SD lodged in PSW",
  "B5-permission-granted": "B5. Customs permission granted",
  "B6-charges-settled": "B6. Charges / demurrage settled",
  "B7-re-tendered": "B7. Re-tender as export",
  "B8-closed": "B8. Close import AWB as re-exported",
};

export type ReExportCause = "cannot-clear" | "consignee-refused" | "customs-rejected";

export interface ReExportCase extends DomainRecord {
  id: number;
  awbId: number;
  AWBNO: string;
  IGMNO: string;
  stage: ReExportStage;
  cause: ReExportCause;
  raisedAt: string;
  holdLocationId: number | null;

  /** PSW-primary per the FC-10-B amendment — no WeBOC path. */
  sdRef: string | null;
  sdLodgedAt: string | null;
  permissionRef: string | null;
  permissionGrantedAt: string | null;

  outstandingCharges: Amount;
  chargesSettledAt: string | null;

  reTenderedAt: string | null;
  exportAwbNo: string | null;
  closedAt: string | null;
  ageDays: number;
  site: SiteCode;
}

/* ================================================================== *
 * FC-10-C — Long-stay / Section 82. CMTS `AWBSECTION82` (22)
 * ================================================================== */

export type LongStayStage =
  | "C1-not-cleared"
  | "C2-alert-triggered"
  | "C3-parties-notified"
  | "C4-escalated-customs"
  | "C5-section-82"
  | "C6-disposition-recorded"
  | "C7-closed";

export const LONGSTAY_STAGE_LABEL: Record<LongStayStage, string> = {
  "C1-not-cleared": "C1. Not cleared after allowed period",
  "C2-alert-triggered": "C2. Long-stay alert triggered",
  "C3-parties-notified": "C3. Notify consignee / CHA / airline",
  "C4-escalated-customs": "C4. Escalate to customs",
  "C5-section-82": "C5. Section 82",
  "C6-disposition-recorded": "C6. Final disposition recorded",
  "C7-closed": "C7. File closed",
};

/** FC-10-C's three dispositions. */
export type Disposition = "release-after-clearance" | "auction" | "disposal-destruction";

export const DISPOSITION_LABEL: Record<Disposition, string> = {
  "release-after-clearance": "Release after clearance",
  auction: "Auction",
  "disposal-destruction": "Disposal / destruction",
};

/** FC-10 amendment — "notices to consignee / CHA / airline scheduled automatically". */
export interface StatutoryNotice {
  id: number;
  noticeNo: string;
  docNumber: DocNumberRef;
  /** Days before the statutory deadline this notice is due. */
  dueOffsetDays: number;
  dueAt: string;
  recipients: Array<"consignee" | "cha" | "airline">;
  sentAt: string | null;
  status: "scheduled" | "sent" | "overdue";
}

export interface LongStayCase extends DomainRecord {
  id: number;
  awbId: number;
  AWBNO: string;
  IGMNO: string;
  HWBNo: string | null;
  stage: LongStayStage;

  arrivedAt: string;
  /** From Section82Days — configurable per site pending BLK-07. */
  section82Days: number;
  ageDays: number;
  daysToDeadline: number;

  notices: StatutoryNotice[];
  escalatedToCustomsAt: string | null;

  // CMTS `AWBSECTION82` specifics
  Examiner: string | null;
  ReceivingPerson: string | null;
  DCNumber: string | null;
  Sequences: string | null;
  SubIndex: string | null;
  Lock: boolean;

  disposition: Disposition | null;
  /** Auction specifics. */
  auctionLotNo: string | null;
  auctionReserve: Amount | null;
  auctionDate: string | null;
  auctionProceeds: Amount | null;
  /** Disposal specifics. */
  disposalMethod: string | null;
  disposalAuthorisedBy: string | null;
  disposalCertificateNo: string | null;

  closedAt: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * Unified exception queue — FC-10 amendment asks for one aging
 * dashboard across all hold states, not just long-stay.
 * ================================================================== */

export type ExceptionKind = "cdr" | "hold" | "mishandled" | "re-export" | "long-stay" | "detend";

export interface ExceptionQueueRow {
  kind: ExceptionKind;
  ref: string;
  awbId: number;
  AWBNO: string;
  summary: string;
  ageDays: number;
  /** Escalation threshold in days for this kind. */
  thresholdDays: number;
  overThreshold: boolean;
  locationId: number | null;
  site: SiteCode;
  href: string;
}

export const EXCEPTION_THRESHOLD_DAYS: Record<ExceptionKind, number> = {
  cdr: 3,
  hold: 7,
  mishandled: 5,
  "re-export": 14,
  "long-stay": 30,
  detend: 10,
};

/* ================================================================== *
 * The variance screen — FC-04's entry decision, including its No edge
 *
 * The flow starts before §01. A variance is flagged at intake, then
 * "Declared vs physical variance ≥ tolerance?" decides:
 *
 *   Yes → 01. Discrepancy Identified          (a CDR exists)
 *   No  → continue normal flow (no CDR)       (nothing exists)
 *
 * The No edge leaves no record behind, which is precisely why it is worth
 * surfacing: a screen that only lists CDRs cannot distinguish "the rule
 * ran and found nothing" from "the rule is not running". Near-misses are
 * the evidence that the auto-raise is alive, and the row just under
 * tolerance is the one an auditor asks about.
 * ================================================================== */

export type VarianceMeasure = "pieces" | "weightKg" | "volumeM3";

export interface VarianceScreenRow {
  awbId: number;
  AWBNO: string;
  site: SiteCode;
  measure: VarianceMeasure;
  variance: Variance;
  /** True where this measure alone would have raised a CDR. */
  overTolerance: boolean;
  /** Set when a CDR was actually raised on this AWB. */
  cdrRef: string | null;
}

export const VARIANCE_MEASURE_LABEL: Record<VarianceMeasure, string> = {
  pieces: "Pieces",
  weightKg: "Gross weight",
  volumeM3: "Volume",
};

/**
 * FC-04 entry decision, evaluated across every measure of one intake.
 * Returns null where intake recorded no variance at all — a clean receipt
 * never entered the decision, which is different from passing it.
 */
export function screenVariance(awb: {
  AWBId: number;
  AWBNO: string;
  site: SiteCode;
  intakeVariance: { pieces: Variance; weightKg: Variance; volumeM3: Variance } | null;
  cdrRaised: boolean;
}, cdrRef: string | null) {
  if (!awb.intakeVariance) return null;

  const rows: VarianceScreenRow[] = (
    ["pieces", "weightKg", "volumeM3"] as VarianceMeasure[]
  ).map((measure) => ({
    awbId: awb.AWBId,
    AWBNO: awb.AWBNO,
    site: awb.site,
    measure,
    variance: awb.intakeVariance![measure],
    overTolerance: awb.intakeVariance![measure].overTolerance,
    cdrRef,
  }));

  const breaching = rows.filter((r) => r.overTolerance);
  // The widest miss that stayed inside tolerance — the interesting row.
  const nearest = rows
    .filter((r) => !r.overTolerance)
    .sort((a, b) => b.variance.ratio - a.variance.ratio)[0] ?? null;

  return {
    rows,
    breaching,
    /** Yes edge — the auto-raise fires. */
    shouldRaise: breaching.length > 0,
    /** No edge — flagged at intake, but inside tolerance on every measure. */
    nearMiss: breaching.length === 0 && rows.some((r) => r.variance.delta !== 0),
    nearest,
    cdrRef,
    /** Set where the flow and the record disagree — worth seeing loudly. */
    inconsistent: breaching.length > 0 !== awb.cdrRaised,
  };
}
