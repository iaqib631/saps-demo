/**
 * AirVault domain — cargo records.
 *
 * CMTS sources:
 *   `IMPORTMANIFIEST` (31)  manifest header
 *   `CUSTOMIGM` (17)        customs IGM header
 *   `IMPORTAWB` (64)        the AWB record — widest operational table in CMTS
 *   `IMPORTAWBDETAIL` (32)  per-line receipt, incl. shortlanded / damage
 *   `IMPORTAWBLOCATION` (26) logical vs physical location assignment
 *   `AWBCONSOLE` (41)       house AWBs on a consolidation
 *   `AWBConsolDetail` (13) per-house detail lines under the master
 *   `AWBSplit` (10)         split shipments
 *   `AwbDetendDetail` (7)   customs-detained sub-identity
 *   `AWBARRIVALADVICE` (15) arrival advice / NOA document
 */

import type {
  Amount,
  DocNumberRef,
  DomainRecord,
  Dimensions,
  OcrValue,
  SiteCode,
  Variance,
  WeightSet,
} from "./common";

/* ================================================================== *
 * Lifecycle — FC-01's 27 steps, collapsed to the states a record can
 * actually be in. The AWB hub's lifecycle bar renders this.
 * ================================================================== */

export type LifecycleStage =
  | "handover" //          FC-01 §01–04  cargo + pouch received
  | "doc-verification" //  FC-01 §05     incl. 05a–05f OCR intake
  | "awb-summary" //       FC-01 §06
  | "reconciliation" //    FC-01 §07–08  manifest vs physical vs FFM/FWB/FHL
  | "indexation" //        FC-01 §09     class/subclass set here
  | "tagging" //           FC-01 §10     barcode / RFID / AWB label
  | "segregation" //       FC-01 §11–12
  /**
   * FC-01 §13–14 — weigh / dimension / condition check.
   *
   * A discrepancy found here does NOT send the record back to §07–08
   * reconciliation. It branches sideways to FC-04 by setting `BranchState`
   * to `"cdr"` while the lifecycle stage stays where it is; §07–08 now
   * covers manifest-vs-document findings only. Nothing here needs code —
   * `hasReached` is deliberately monotonic and no caller moves a stage
   * backwards — but the rule is easy to re-break by "fixing" a screen to
   * reset the stage, so it is stated at the type.
   */
  | "acceptance" //        FC-01 §13–14  weigh / dimension / condition
  | "stored" //            FC-01 §15–16  storage allocation + CMTS capture
  | "notified" //          FC-01 §17–18  IATA messaging + NOA
  | "customs" //           FC-01 §19     clearance tracking
  | "charged" //           FC-01 §20–21  charges + invoice
  /**
   * FC-01 §22a — the CHA requests the DO once the NOA has gone out. A
   * requested DO carries no release authority; it only records who asked
   * and against which NOA. §22b below is the terminal's issuance, and it
   * is gated on payment plus the five release conditions — which is why
   * the two are separate stages rather than one "delivery order" step.
   */
  | "do-requested" //      FC-01 §22a    CHA requests the DO (after §18 NOA)
  | "do-issued" //         FC-01 §22b    terminal issues it — payment + release gate
  | "gate-pass" //         FC-01 §23
  | "dispatched" //        FC-01 §24
  | "delivered" //         FC-01 §25–26  POD + DLV
  | "closed"; //           FC-01 §27     AWB closure / archive

export const LIFECYCLE_ORDER: LifecycleStage[] = [
  "handover",
  "doc-verification",
  "awb-summary",
  "reconciliation",
  "indexation",
  "tagging",
  "segregation",
  "acceptance",
  "stored",
  "notified",
  "customs",
  "charged",
  "do-requested",
  "do-issued",
  "gate-pass",
  "dispatched",
  "delivered",
  "closed",
];

export const LIFECYCLE_LABEL: Record<LifecycleStage, string> = {
  handover: "Handover",
  "doc-verification": "Doc Verification",
  "awb-summary": "AWB Summary",
  reconciliation: "Reconciliation",
  indexation: "Indexation",
  tagging: "Piece Tagging",
  segregation: "Segregation",
  acceptance: "Acceptance",
  stored: "Stored",
  notified: "Notified (NOA)",
  customs: "Customs",
  charged: "Charged",
  "do-requested": "DO Requested",
  "do-issued": "DO Issued",
  "gate-pass": "Gate Pass",
  dispatched: "Dispatched",
  delivered: "Delivered",
  closed: "Closed",
};

/** FC-01 step numbers, for the flow walkthrough. */
export const LIFECYCLE_FC01_STEPS: Record<LifecycleStage, string> = {
  handover: "01–04",
  "doc-verification": "05 (05a–05f)",
  "awb-summary": "06",
  reconciliation: "07–08",
  indexation: "09",
  tagging: "10",
  segregation: "11–12",
  acceptance: "13–14",
  stored: "15–16",
  notified: "17–18",
  customs: "19",
  charged: "20–21",
  "do-requested": "22a",
  "do-issued": "22b",
  "gate-pass": "23",
  dispatched: "24",
  delivered: "25–26",
  closed: "27",
};

export function stageIndex(s: LifecycleStage): number {
  return LIFECYCLE_ORDER.indexOf(s);
}

export function hasReached(current: LifecycleStage, target: LifecycleStage): boolean {
  return stageIndex(current) >= stageIndex(target);
}

/** FC-01 branches. An AWB on a branch is not on the main lifecycle. */
export type BranchState =
  | null
  | "transhipment" //  SB1 → FC-09
  | "re-export" //     SB2 → FC-10-B
  | "cdr" //           SB3 → FC-04
  | "long-stay" //     SB4 → FC-10-C
  | "mishandled"; //   FC-10-A

export const BRANCH_LABEL: Record<NonNullable<BranchState>, string> = {
  transhipment: "Transhipment (FC-09)",
  "re-export": "Re-export (FC-10-B)",
  cdr: "CDR / Discrepancy (FC-04)",
  "long-stay": "Long-stay / Section 82 (FC-10-C)",
  mishandled: "Mishandled / Misrouted (FC-10-A)",
};

/* ================================================================== *
 * Manifest — CMTS `IMPORTMANIFIEST` (31)
 * ================================================================== */

export interface Manifest extends DomainRecord {
  ManifiestId: number;
  /** CMTS `IGMNO` — the composite key root across ~25 CMTS tables. */
  IGMNO: string;
  /** CMTS `REGNO` — aircraft registration. */
  REGNO: string;
  CARGODATE: string;
  MANIFESTDATE: string;
  TOTALWEIGHT: number;
  AIRLINEID: string;
  AIRLINENAME: string;
  ABBREVATION: string;
  FLIGHT: string;
  ORIGIN: string;
  DESTINATION: string;
  STATUS1: string;
  STATUS2: string;
  MANIFESTSTATUS: string;
  POSTINGDATE: string | null;
  MANIFESTNIL: string | null;
  /**
   * CMTS `DFLAG` varchar(1) — a legacy single-character status flag.
   *
   * Its value set is UNKNOWN and stays a string rather than a union. The
   * restored CMTS database is schema-only: all 105 tables are empty, so the
   * column's type, length and nullability are knowable and its actual
   * domain is not. Any enum written here — `"Y" | "N"`, `"A" | "D"` — would
   * be a guess wearing the authority of a type, and the migration would
   * then reject legitimate legacy rows carrying a character we invented
   * away. Narrow this only once SAPS supplies a data-bearing extract or
   * confirms the value set; until then the flag is carried across verbatim.
   */
  DFLAG: string | null;
  USERID: string;
  TRNO: number | null;
  /** CMTS `IsCloseIGM` — blocked while unreconciled AWBs remain. */
  IsCloseIGM: boolean;
  /** CMTS `TransferSerialCounter` — used by transhipment (FC-09). */
  TransferSerialCounter: number;
  site: SiteCode;

  /** AirVault addition — FC-05 group A pre-arrival message completeness. */
  messages: {
    FFM: MessageReceipt;
    FWB: MessageReceipt;
    FHL: MessageReceipt;
    NOTOC: MessageReceipt;
  };
}

export interface MessageReceipt {
  received: boolean;
  receivedAt: string | null;
}

/* ================================================================== *
 * AWB — CMTS `IMPORTAWB` (64 columns, all present)
 * ================================================================== */

export interface AWB extends DomainRecord {
  AWBId: number;
  ManifiestId: number;
  /** Composite legacy key: IGMNO + AWBNO + SEQUENCE. */
  IGMNO: string;
  AWBNO: string;
  SEQUENCE: number;
  PAGENO: number;

  CARGODATE: string;
  CARGOTIME: string;
  REMARK: string | null;
  ORIGIN: string;
  DESTINATION: string;
  SHIPMENTTYPE: string;

  AIRLINECODE: string;
  AIRLINENAME: string;
  FLIGHT: string;
  ABBREVATION: string;
  /** CMTS `PHYSICALSTATUS` — single char in CMTS. */
  PHYSICALSTATUS: string;

  /** CMTS stores parties as four flat lines each. */
  SHIPPER1: string;
  SHIPPER2: string | null;
  SHIPPER3: string | null;
  SHIPPER4: string | null;
  CONSIGNEE1: string;
  CONSIGNEE2: string | null;
  CONSIGNEE3: string | null;
  CONSIGNEE4: string | null;
  AGENT1: string | null;
  AGENT2: string | null;
  AGENT3: string | null;
  AGENT4: string | null;

  /** Identity documents — `PASSPORT` has 0 occurrences in the pre-P0 demo. */
  NIC: string | null;
  PASSPORT: string | null;
  CHALLANNO: string | null;

  /** True while any hold is live (see HOLDINGSTATUS). Gates DO release. */
  HOLDINGSTATUS: boolean;

  /** DO pre-fields, denormalised onto the AWB by CMTS. */
  DONO: string | null;
  DODATE: string | null;
  DOAMOUNT: Amount;
  DOFREE: boolean;

  TOTALPCS: number;
  TOTALWEIGHT: number;
  TOTALCHRGWEIGHT: number;

  SHIFT: string;
  DFLAG: boolean;
  DELIVERED: boolean;
  CARGOCLASSID: number;

  /** Transhipment linkage (FC-09). */
  TRAIRLINEID: string | null;
  TRID: number | null;

  ImportProcess: number;
  Process: string;
  /** CMTS `Lock` — set at closure; record becomes read-only. */
  Lock: boolean;
  Status: number;

  /** Is this a consolidation with house AWBs? */
  IsHwb: boolean;
  /** Customs-detained — see AwbDetendDetail. */
  IsDetend: boolean;
  DetendUniqueIdentification: string | null;

  isSpecial: boolean;
  isSpecialRemarks: string | null;

  // ---- AirVault additions ----
  site: SiteCode;
  /** Subclass is set at indexation per the FC-02 amendment. */
  cargoSubClassId: number;
  stage: LifecycleStage;
  branch: BranchState;
  /** Populated once storage is allocated (FC-03). */
  locationId: number | null;
  /** FC-01 05e — declared (OCR) vs physical (received). */
  intakeVariance: {
    pieces: Variance;
    weightKg: Variance;
    volumeM3: Variance;
  } | null;
  /** Set true when 05e variance exceeded tolerance and a CDR was raised. */
  cdrRaised: boolean;
  /**
   * ISO — FLIGHT arrival, and nothing else.
   *
   * This field used to double as the storage-clock origin, which quietly
   * billed the gap between the aircraft landing and the cargo actually
   * being taken into the shed — breakdown, ramp queue and off-hours
   * handovers can put hours or days between the two events. Storage now
   * starts at `intakeAt`; keep this one for the flight record, the arrival
   * advice and the CMTS `ARRIVALDATE` column.
   */
  arrivedAt: string;
  /**
   * ISO — recorded cargo INTAKE, FC-07 §01. The storage clock starts here.
   *
   * This is the origin of the whole charging chain and the field every
   * demurrage figure hangs off:
   *   §01 intake recorded (this field)
   *   §02 storage clock starts at `intakeAt`
   *   §03 free / grace period runs from `intakeAt` — nothing is charged
   *   §03a chargeable period = dwell − free period
   * Dwell is therefore measured from `intakeAt`, never from `arrivedAt`.
   */
  intakeAt: string;
}

/** Convenience view over the four-line party blocks. */
export function partyLines(a: AWB, role: "shipper" | "consignee" | "agent"): string[] {
  const src =
    role === "shipper"
      ? [a.SHIPPER1, a.SHIPPER2, a.SHIPPER3, a.SHIPPER4]
      : role === "consignee"
        ? [a.CONSIGNEE1, a.CONSIGNEE2, a.CONSIGNEE3, a.CONSIGNEE4]
        : [a.AGENT1, a.AGENT2, a.AGENT3, a.AGENT4];
  return src.filter((x): x is string => !!x);
}

/* ================================================================== *
 * AWB detail lines — CMTS `IMPORTAWBDETAIL` (32)
 * ================================================================== */

export interface AWBDetail {
  DetailId: number;
  AWBId: number;
  IGMNO: string;
  AWBNO: string;
  SEQUENCE: number;
  GOODS: string;

  /** Declared. */
  PCS: number;
  WEIGTH: number;
  CHARGEWEIGTH: number;
  /** Physically received — the FC-01 05e pair. */
  RECEIVEDPCS: number;
  RECEIVEDWT: number;
  CHARGEDRECEIVEDWT: number;

  /** Damage block — feeds `DamageDetail` and FC-04. */
  TYPEOFPACK: string | null;
  TYPEOFDAM: string | null;
  DEMAGEDETAIL: string | null;
  DAMAGEPCS: number;
  DAMAGEWEIGHT: number;

  /** Short-landing block — 0 occurrences in the pre-P0 demo. */
  SHORTLANDED: number;
  SHORTLANDEDREC: number;
  IsShortDetailed: boolean;

  /** Part-shipment block. */
  Shipment: string | null;
  PartRemaining: number;
  PartReceievd: number;

  ClassId: number;
  SplitClassId: number | null;
  DetendUniqueIdentification: string | null;

  DFLAG: boolean;
  UniqueIdentification: string;
  Remarks: string | null;
  IsLock: boolean;
  IsHold: boolean;
  CityId: number;

  /** AirVault addition — dimensions captured at acceptance (FC-01 §14). */
  dimensions: Dimensions | null;
  /** AirVault addition — what OCR read at 05b, before operator acceptance. */
  ocr: {
    goods: OcrValue<string>;
    pcs: OcrValue<number>;
    weightKg: OcrValue<number>;
  } | null;
}

/* ================================================================== *
 * Pieces — AirVault addition (RFID chain, FC-03 → FC-08)
 * ================================================================== */

export type ScanState = "unbound" | "bound" | "picked" | "verified" | "dispatched" | "unreadable";

export interface Piece {
  pieceId: string;
  awbId: number;
  AWBNO: string;
  /** RFID EPC, bound to a location at putaway (FC-03 amendment). */
  rfidEpc: string | null;
  /** Barcode fallback where no tag exists. */
  barcode: string | null;
  dimensions: Dimensions;
  weights: WeightSet;
  cargoClassId: number;
  cargoSubClassId: number;
  /** Current physical location. */
  locationId: number | null;
  scanState: ScanState;
  lastMovementAt: string;
  lastMovementBy: string;
}

/* ================================================================== *
 * Location assignment — CMTS `IMPORTAWBLOCATION` (26)
 *
 * Note the dual model: CMTS keeps LOGICAL (booked-to) and PHYSICAL
 * (actually-in) as separate column pairs. Retained pending BLK-08.
 * ================================================================== */

export interface AWBLocation {
  Id: number;
  IGMNO: string;
  AWBNO: string;
  SEQUENCE: number;
  PCS: number;
  WEIGHT: number;

  /** Where the cargo is *booked to*. */
  LOGICALCARGOSUBCLASSID: number;
  LOGICALLOCATIONID: number;
  /** Where the cargo *actually is*. */
  PHYSICALCARGOSUBCLASSID: number;
  PHYSICALLOCATIONID: number;

  HWBNO: string | null;
  Cargoclassid: number;
  ConsolId: number | null;
  DetendUniqueIdentification: string | null;
  SplitClassId: number | null;
  UniqueIdentification: string;
  DFLAG: string | null;
  CityId: number;

  /** AirVault addition — when the two diverged, for the divergence queue. */
  divergedAt: string | null;
  divergenceReason: string | null;
}

export function isDiverged(l: AWBLocation): boolean {
  return l.LOGICALLOCATIONID !== l.PHYSICALLOCATIONID;
}

/* ================================================================== *
 * Consolidation & split — CMTS `AWBCONSOLE` (41), `AWBConsolDetail` (13),
 * `AWBSplit` (10)
 * ================================================================== */

export interface HouseAWB extends DomainRecord {
  ConsolId: number;
  IGMNO: string;
  AWBNO: string;
  /** CMTS `HWB` */
  HWB: string;
  SUBINDEX: string | null;
  PCS: number;
  WEIGHT: number;
  CHARGEDWEIGH: number;
  CARGOCLASSID: number;
  CARGOSUBCLASSID: number;
  LOCATIONID: number;

  SHIPPER1: string;
  SHIPPER2: string | null;
  SHIPPER3: string | null;
  CONSIGNEE1: string;
  CONSIGNEE2: string | null;
  CONSIGNEE3: string | null;
  AGENT1: string | null;
  AGENT2: string | null;
  AGENT3: string | null;
  CONSIGNEEADD: string | null;
  SHIPPERADD: string | null;
  AGENTADD: string | null;

  CONTENTS: string;
  SUBDONO: string | null;
  DELIVERED: number;
  PHYSICALSTATUS: string;
  HOLDINGSTATUS: boolean;
  DFLAG: string | null;
  IsLock: boolean;
  UniqueIdentification: string;
  DetendIdentification: string | null;
}

/**
 * Per-house detail lines under the master — CMTS `AWBConsolDetail` (13).
 *
 * `AWBCONSOLE` above carries the house AWB itself; this table carries the
 * lines beneath it, and the consolidation screen names it as a source
 * without anything typed behind it. Only the two columns below are modelled
 * here, because only these two arrived with their names and types verified
 * against the schema restore. The remaining eleven — including whatever
 * column carries the link back to the parent house — are deliberately
 * absent rather than guessed: a column name invented here would travel onto
 * a screen as a `cmts="…"` parity marker and read as verified migration
 * mapping when it is nothing of the kind. Add them when the verbatim column
 * list lands; a wrong name is worse than a missing one.
 */
export interface AWBConsolDetail {
  /** CMTS `GROSSWEIGHT` float, nullable — gross vs the chargeable weight. */
  GROSSWEIGHT: number | null;
  /**
   * CMTS `UNIQUEINDENTIFICATION` varchar(50), nullable.
   *
   * The misspelling is the column name. CMTS spells it INDENTIFICATION —
   * with the extra N — on this table, while `AWBCONSOLE`, `AWBSplit` and the
   * detend chain spell their own correlator `UniqueIdentification`. Both
   * spellings are real and they are different columns on different tables,
   * so "correcting" this one silently breaks the migration mapping for the
   * table it belongs to. Keep it verbatim.
   */
  UNIQUEINDENTIFICATION: string | null;
}

export interface AWBSplitRecord {
  SplitId: number;
  ID: number;
  IGMNo: string;
  AWBNo: string;
  HWBNo: string | null;
  Pcs: number;
  Weight: number;
  ChargeWeight: number;
  ConsigneeName: string;
  UniqueIdentification: string;
  /** CMTS `SplitClassId` on the detail/location rows. */
  splitClassId: number;
}

/* ================================================================== *
 * Detend — CMTS `AwbDetendDetail` (7)
 *
 * A customs-detained portion of an AWB becomes its own identity. The
 * identifier then appears on 12 other CMTS tables (DO, gate pass,
 * godown rent, physical delivery, delivery info, Section 82, …).
 * ================================================================== */

export interface DetendDetail {
  DetendId: number;
  AwbId: number;
  /** CMTS `UniqueIdentification` — the identity carried across 12 tables. */
  UniqueIdentification: string;
  TotalPieces: number;
  TotalWeight: number;
  TotalChargeWeight: number;
  GOODS: string;

  // ---- AirVault additions ----
  detainedAt: string;
  detainedBy: string;
  reason: string;
  /** Null while still detained. */
  releasedAt: string | null;
  locationId: number;
}

/* ================================================================== *
 * Arrival advice — CMTS `AWBARRIVALADVICE` (15)
 * ================================================================== */

export interface ArrivalAdvice {
  AdviceNumber: number;
  docNumber: DocNumberRef;
  IGMNO: string;
  AWBNO: string;
  SEQUENCE: string;
  ADVICEDATE: string;
  /** CMTS `SAPSNO` */
  SAPSNO: string;
  AIRLINENAME: string;
  FLIGHT: string;
  TOTALWEIGHT: number;
  TOTALPCS: number;
  ConsigneeName: string;
  ConsigneeAdd: string;
  Goods: string;
  ArrivalDate: string;
  Cityid: number;

  // ---- AirVault additions (FC-05) ----
  dispatchedTo: Array<{
    partyId: number;
    channel: "email" | "sms" | "whatsapp";
    sentAt: string;
    deliveredAt: string | null;
    readAt: string | null;
  }>;
}
