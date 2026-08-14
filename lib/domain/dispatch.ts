/**
 * AirVault domain — gate pass, physical delivery, POD and closure.
 *
 * CMTS sources:
 *   `GATEPASS` (43)          the cross-reference hub for release
 *   `PHYSICALDELIVERY` (22)
 *   `DELIVERYINFO` (20)
 *
 * Digital POD is an AirVault addition — CMTS holds POD loosely across
 * `GATEPASS.RcvngPersonPic`, `PHYSICALDELIVERY.DELIVERED` and
 * `AWBDELEIVERYORDER.RECIEVEDBY`.
 */

import type { DocNumberRef, DomainRecord, SiteCode } from "./common";
import type { CdrOrigin } from "./exceptions";

/* ================================================================== *
 * Gate pass — CMTS `GATEPASS` (43), all columns
 * ================================================================== */

export interface GatePass extends DomainRecord {
  GATEPASSNO: number;
  docNumber: DocNumberRef;
  GATEPASSDATE: string;

  // Cross-references — CMTS pairs each document with its date
  IGMNO: string;
  IGMNODate: string;
  AWBNO: string;
  AWBNODate: string;
  HWBNO: string | null;
  HWBNODate: string | null;
  DONo: string;
  DoDate: string;
  GRNo: string;
  GRDate: string;
  BDNo: string | null;
  BDDate: string | null;
  CASHNO: string | null;
  CASHNODate: string | null;
  ChallanNo: string | null;

  ARRIVALDATE: string;
  INDEXNO: number | null;
  PIECES: number;
  WEIGHT: number;
  CARGOCLASSID: number;

  CONSIGNEE: string;
  Agent: string | null;
  RecivingPerson: string;
  NICNO: string;
  /** CMTS `CPNO` — customs pass number. */
  CPNO: string | null;
  RcvngPersonPic: string | null;

  VehicleNo: string;
  ClearingTime: string | null;
  MarksNumber: string | null;
  DeliveryDate: string | null;
  NAMEOFCUSTODIANSHED: string;

  SerialNo: number;
  SerialNoWithYear: string;
  DetendIdentification: string | null;
  site: SiteCode;

  // ---- AirVault additions (FC-08 amendment) ----
  /** Scannable code read at gate-out. */
  scanCode: string;
  status: "issued" | "picking" | "loaded" | "exited" | "cancelled";
}

/* ================================================================== *
 * Picking & retrieval — FC-08 §07–10
 * ================================================================== */

export type PickOutcome = "pending" | "retrieved" | "unavailable" | "short" | "damaged";

export interface PickLine {
  id: number;
  gatePassNo: number;
  awbId: number;
  pieceId: string;
  /** Where the pick list says to go — physical location. */
  locationId: number;
  expectedRfid: string | null;
  scannedRfid: string | null;
  outcome: PickOutcome;
  scannedAt: string | null;
  scannedBy: string | null;
  note: string | null;
}

/** The two picking-side routes into FC-04 — see `pickSessionCdrTrigger`. */
export type PickCdrReason = "piece-count-mismatch" | "cargo-unavailable";

export interface PickSession {
  gatePassNo: number;
  awbId: number;
  startedAt: string;
  completedAt: string | null;
  lines: PickLine[];
  expectedPieces: number;
  scannedPieces: number;
  /** FC-08 "Piece Count Matched?" */
  countMatched: boolean;

  /**
   * FC-08 §09–10 routes into FC-04.
   *
   * A single `cdrRef` could not state the rule: a session that owed a CDR and
   * a session that owed none were the same shape — null — so nothing could
   * distinguish "no discrepancy" from "discrepancy not yet escalated", and the
   * screens each decided for themselves. The requirement is now recorded
   * separately from its fulfilment. While `cdrRequired` is true and `cdrRef`
   * is null the session is unresolved: it must not be completed, and the
   * gate pass it belongs to must not proceed to gate-out.
   */
  cdrRequired: boolean;
  cdrReason: PickCdrReason | null;
  cdrRef: string | null;
}

/**
 * The FC-08 §09/§10 decision, evaluated once here rather than re-derived by
 * the pick screen, the gate-pass banner and the fixtures — three copies of a
 * rule is three chances for the screen to say "short" while the record says
 * "clean". Takes the two fields the decision actually reads, so a generator
 * can call it while still building the session.
 */
export function pickSessionCdrTrigger(s: Pick<PickSession, "countMatched" | "lines">): {
  required: boolean;
  reason: PickCdrReason | null;
  unavailableLines: PickLine[];
} {
  const unavailableLines = s.lines.filter((l) => l.outcome === "unavailable");

  // Both routes raise a shortage CDR, so the reason exists to decide which
  // finding is put in front of the operator. An unavailable line names the
  // piece and the location it was not at, which is actionable; a bare count
  // mismatch — a line that came back short, damaged, or was never scanned —
  // can only restate the arithmetic. The specific finding wins.
  const reason: PickCdrReason | null =
    unavailableLines.length > 0
      ? "cargo-unavailable"
      : !s.countMatched
        ? "piece-count-mismatch"
        : null;

  return { required: reason !== null, reason, unavailableLines };
}

/**
 * Picking speaks of reasons, FC-04 speaks of origins. Mapping them here keeps
 * the two vocabularies from drifting apart at whichever screen raises the CDR.
 */
export const PICK_CDR_ORIGIN: Record<PickCdrReason, CdrOrigin> = {
  "piece-count-mismatch": "picking-count",
  "cargo-unavailable": "picking-unavailable",
};

/* ================================================================== *
 * Physical delivery — CMTS `PHYSICALDELIVERY` (22) + `DELIVERYINFO` (20)
 * ================================================================== */

export interface PhysicalDelivery extends DomainRecord {
  PHYSICALDELIVERYID: number;
  VOUCHERNO: string;
  DELIVERYDATE: string;
  IGMNO: string;
  AWBNO: string;
  HWBNO: string | null;
  CASHNO: string | null;
  BLNO: string | null;
  BECASHNO: string | null;
  DATE: string;
  TIME: string;
  DELIVERED: boolean;
  classId: number;
  DFLAG: string | null;
  DetendIdentification: string | null;
  site: SiteCode;
}

export interface DeliveryInfo {
  DevId: number;
  AWBId: number;
  AWBNO: string;
  IGMNO: string;
  HWBNO: string | null;
  CargoClassId: number;
  DetendUniqueIdentification: string | null;
  CityId: number;

  ConsigneeName: string;
  ConsigneeAdd: string;
  ConsgneePhone: string;
  ConsigneeEid: string;
  ShipName: string;
  ShipAdd: string;
  ShipPhone: string;
  ShipEid: string;
  AgentName: string | null;
  AgentAdd: string | null;
  AgentPhone: string | null;
  AgentEid: string | null;
}

/* ================================================================== *
 * Gate-out verification — FC-08 §13 + amendment node 168:3591
 *
 * "Gate-out matches the tag to the gate pass + DO and auto-checks OOC,
 *  DO charges paid & no-hold (FC-07 gate)."
 *
 * This is the second evaluation of the release gate, at the physical
 * boundary — a pass printed this morning does not prove the cargo is
 * still releasable this afternoon.
 * ================================================================== */

export interface GateOutCheck {
  gatePassNo: number;
  checkedAt: string;
  checkedBy: string;
  /** Tags read on the vehicle. */
  scannedTags: string[];
  expectedTags: string[];
  tagsMatched: boolean;
  extraTags: string[];
  missingTags: string[];
  /** Re-evaluation of the FC-07 five conditions at exit. */
  releaseStillValid: boolean;
  newlyFailedConditions: string[];

  /**
   * FC-08 §13 — condition at the physical boundary. Cargo can carry every tag
   * on the pass and still fail here, and this is the last moment the terminal
   * can say the damage was present before handover rather than after it.
   */
  damageFound: boolean;
  damageNote: string | null;
  damagedPieceIds: string[];
  /** The `handover-damage` CDR this check raised; null until it exists. */
  cdrRef: string | null;

  outcome: "cleared" | "blocked";
  blockReason: string | null;
}

/**
 * The causes of a blocked exit, resolved in one place so damage cannot be
 * quietly outvoted by a clean tag read — cargo that reconciles piece-for-piece
 * and is crushed is still not fit to leave.
 *
 * Reasons are composed rather than picked, because an exit blocked for two
 * causes must say both: clearing only the one on screen sends the vehicle back
 * to the gate a second time for a fault that was already known.
 */
export function gateOutOutcome(
  c: Pick<
    GateOutCheck,
    | "tagsMatched"
    | "missingTags"
    | "extraTags"
    | "releaseStillValid"
    | "newlyFailedConditions"
    | "damageFound"
    | "damageNote"
    | "damagedPieceIds"
  >,
): { outcome: GateOutCheck["outcome"]; blockReason: string | null } {
  const reasons: string[] = [];

  if (c.damageFound) {
    const pieces =
      c.damagedPieceIds.length > 0
        ? `${c.damagedPieceIds.length} piece(s) — ${c.damagedPieceIds.join(", ")}`
        : "cargo on the vehicle";
    reasons.push(
      `Damage found at gate-out on ${pieces}${c.damageNote ? `: ${c.damageNote}` : ""}. A CDR (FC-04) is required before this vehicle leaves.`,
    );
  }

  if (!c.releaseStillValid) {
    reasons.push(
      c.newlyFailedConditions.length > 0
        ? `Release conditions that passed at issuance now fail: ${c.newlyFailedConditions.join(", ")}.`
        : "The release evaluated at issuance is no longer valid.",
    );
  }

  if (c.missingTags.length > 0) {
    reasons.push(`${c.missingTags.length} tag(s) on the gate pass were not read on the vehicle.`);
  }
  if (c.extraTags.length > 0) {
    reasons.push(`${c.extraTags.length} tag(s) read on the vehicle are not on the gate pass.`);
  }
  // The stored flag is checked last so a mismatch recorded without either list
  // still blocks rather than falling through to "cleared".
  if (!c.tagsMatched && c.missingTags.length === 0 && c.extraTags.length === 0) {
    reasons.push("The tag read did not match the gate pass.");
  }

  return {
    outcome: reasons.length === 0 ? "cleared" : "blocked",
    blockReason: reasons.length === 0 ? null : reasons.join(" "),
  };
}

/* ================================================================== *
 * Digital POD — FC-08 §14 + amendment node 168:3594
 *
 * The flow's five evidence items, plus geo which the amendment adds, plus the
 * condition at handover — the third of the three FC-08 routes into FC-04.
 * ================================================================== */

export interface ProofOfDelivery {
  id: number;
  awbId: number;
  AWBNO: string;
  gatePassNo: number;
  capturedAt: string;
  capturedBy: string;

  /** FC-08 §14 evidence items. */
  receiverSignature: string | null;
  receiverName: string;
  /** CNIC scanned and OCR-matched against the DO's named receiver. */
  receiverCnic: string | null;
  cnicMatchesDo: boolean;
  piecesDelivered: number;
  piecesOnDo: number;
  photos: string[];
  timestamp: string;
  /** AirVault addition — geo capture. */
  geo: { lat: number; lng: number; accuracyM: number } | null;

  /**
   * FC-08 §14 — damage noticed as the consignee takes the cargo. Distinct from
   * `GateOutCheck.damageFound`: that is the terminal's own inspection at the
   * boundary, this is the receiver's, and the two disagreeing is exactly the
   * dispute a POD is signed to settle.
   */
  damageAtHandover: boolean;
  damageNote: string | null;
  /** The `handover-damage` CDR raised for it; null until it exists. */
  cdrRef: string | null;

  /** FC-08 "POD Complete?" — all five items plus geo. */
  complete: boolean;
  /** Partial delivery where fewer pieces were handed over than the DO covers. */
  partial: boolean;
  /** DLV dispatched on completion. */
  dlvSentAt: string | null;
  site: SiteCode;
}

export function podComplete(p: Omit<ProofOfDelivery, "complete">): boolean {
  // Damage at handover is not an evidence defect — signature, CNIC, pieces and
  // photos can all be present — but a complete POD is the terminal's assertion
  // that the consignee took clean delivery, and the DLV that fires off it says
  // the same to the airline. Until the CDR exists the damage has no record to
  // be argued from later, so the POD stays open over it rather than closing.
  // A POD with `damageAtHandover: false` evaluates exactly as it did before.
  if (p.damageAtHandover && !p.cdrRef) return false;

  return (
    !!p.receiverSignature &&
    !!p.receiverCnic &&
    p.piecesDelivered > 0 &&
    p.photos.length > 0 &&
    !!p.timestamp
  );
}

/* ================================================================== *
 * Closure — FC-08 §15–19 / FC-01 §27
 * ================================================================== */

export interface ClosureChecklistItem {
  code: "delivered" | "pod" | "charges" | "no-open-cdr" | "no-hold" | "archived";
  label: string;
  pass: boolean;
  detail: string;
  href: string | null;
}

export interface ClosureState {
  awbId: number;
  items: ClosureChecklistItem[];
  canClose: boolean;
  closedAt: string | null;
  closedBy: string | null;
  /** CMTS `Lock` — propagates to houses, splits, detends, DO and gate pass. */
  locked: boolean;
  archiveBundleId: string | null;
}
