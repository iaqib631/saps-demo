/**
 * AirVault domain — transhipment & bonded transfer (FC-09). **New module (M15).**
 *
 * CMTS source:
 *   `AWBTRANSFER` (25)  the transfer record itself — all 25 columns below
 *
 * Everything else FC-09 needs has no legacy home: the permit, bond
 * supervision, the connecting-flight wait, and the inter-station handoff are
 * all AirVault additions. That is why M15 has sat at "not-started" — FC-01
 * branches into it and FC-03 routes cargo to a transhipment bonded zone,
 * and both were live dead ends until this module existed.
 *
 * Two amendments shape the model:
 *
 *   • **RFID-tracked bonded zone + digital bond supervision.** Cargo under
 *     customs bond is not merely stored, it is *supervised* — each check is
 *     an attributable event, not a shift note. Without that trail the bond
 *     cannot be discharged.
 *
 *   • **Inter-station handoff.** If the onward leg is another SAPS site
 *     (KHI ↔ LHE ↔ PEW) the cargo does not leave the operator — ownership
 *     moves between sites, synced through the Islamabad HQ tier, and **bond
 *     continuity must be preserved across the move**. A handoff that breaks
 *     bond continuity turns a transhipment into an import.
 */

import type { Amount, DomainRecord, SiteCode } from "./common";

/* ================================================================== *
 * FC-09 stages
 * ================================================================== */

export type TranshipmentStage =
  | "T01-received"
  | "T02-identified"
  | "T03-indexed"
  | "T04-bonded-zone"
  | "T05-rct-sent"
  | "T06-permit-issued"
  | "T07-under-supervision"
  | "T08-awaiting-flight"
  | "T09-charges-raised"
  | "T10-re-tendered"
  | "T11-tfd-sent"
  | "T12-departed"
  | "T13-closed";

export const TRANSHIPMENT_STAGE_LABEL: Record<TranshipmentStage, string> = {
  "T01-received": "T01. Received as transhipment",
  "T02-identified": "T02. Identified against the onward manifest",
  "T03-indexed": "T03. Indexed",
  "T04-bonded-zone": "T04. Moved to the bonded transhipment zone",
  "T05-rct-sent": "T05. RCT sent to the receiving carrier",
  "T06-permit-issued": "T06. Transhipment permit issued",
  "T07-under-supervision": "T07. Under customs bond supervision",
  "T08-awaiting-flight": "T08. Awaiting the connecting flight",
  "T09-charges-raised": "T09. Storage charges raised",
  "T10-re-tendered": "T10. Re-tendered to the onward carrier",
  "T11-tfd-sent": "T11. TFD sent",
  "T12-departed": "T12. DEP — onward flight departed",
  "T13-closed": "T13. File closed",
};

export const TRANSHIPMENT_STAGE_ORDER: TranshipmentStage[] = [
  "T01-received",
  "T02-identified",
  "T03-indexed",
  "T04-bonded-zone",
  "T05-rct-sent",
  "T06-permit-issued",
  "T07-under-supervision",
  "T08-awaiting-flight",
  "T09-charges-raised",
  "T10-re-tendered",
  "T11-tfd-sent",
  "T12-departed",
  "T13-closed",
];

/* ================================================================== *
 * Transfer record — CMTS `AWBTRANSFER` (all 25 columns)
 * ================================================================== */

export interface AwbTransfer {
  AWBTRANSID: number;
  AirlineId: string;
  AirlineName: string;
  AirlineAbb: string;
  ArrivalDate: string;
  ArrivalTime: string;
  FlightNo: string;
  TotalWeight: number;
  Destination: string;
  AirportName: string;
  /** Receiving carrier or station. */
  TransferTo: string;
  SerialNo: number;
  AWBNo: string;
  Origin: string;
  NoOfPackages: number;
  Weight: number;
  Remarks: string | null;
  /** Carries through to the onward leg — the transhipment's identity. */
  UniqueIdentification: string;
  IGMNO: string;
  TransferBy: string;
  CreatedOn: string;
  Staff: string;
  TransferFlight: string;
  HWBNO: string | null;
  CityId: number;
}

/* ================================================================== *
 * Permit — AirVault addition, no CMTS table
 * ================================================================== */

export interface TranshipmentPermit {
  permitNo: string;
  issuedAt: string;
  issuedBy: string;
  /** Customs bond the cargo moves under. */
  bondRef: string;
  bondAmount: Amount;
  /** Permit lapses if the cargo has not moved by this date. */
  validUntil: string;
  /** True once the onward carrier has physically taken the cargo. */
  discharged: boolean;
  dischargedAt: string | null;
}

/** Days remaining on the permit; negative once lapsed. */
export function permitDaysRemaining(p: TranshipmentPermit, nowIso: string): number {
  const MS = 24 * 60 * 60 * 1000;
  return Math.floor((Date.parse(p.validUntil) - Date.parse(nowIso)) / MS);
}

export function permitLapsed(p: TranshipmentPermit, nowIso: string): boolean {
  return !p.discharged && permitDaysRemaining(p, nowIso) < 0;
}

/* ================================================================== *
 * Bond supervision — the FC-09 amendment's "digital bond supervision"
 * ================================================================== */

export type SupervisionKind = "seal-check" | "rfid-sweep" | "physical-count" | "customs-visit";

export const SUPERVISION_KIND_LABEL: Record<SupervisionKind, string> = {
  "seal-check": "Seal integrity check",
  "rfid-sweep": "RFID zone sweep",
  "physical-count": "Physical piece count",
  "customs-visit": "Customs officer visit",
};

export interface SupervisionEvent {
  id: number;
  kind: SupervisionKind;
  at: string;
  by: string;
  /** Officer present, where the check requires one. */
  customsOfficer: string | null;
  piecesExpected: number;
  piecesObserved: number;
  sealIntact: boolean | null;
  /** Tags read during an RFID sweep. */
  tagsRead: number | null;
  finding: string;
  /** True when the check found nothing wrong. */
  clean: boolean;
}

/* ================================================================== *
 * Inter-station handoff (P8-2) — the FC-12 platform tier in action
 * ================================================================== */

export type HandoffState =
  | "not-applicable"
  | "proposed"
  | "hq-approved"
  | "in-transit"
  | "accepted"
  | "rejected";

export const HANDOFF_STATE_LABEL: Record<HandoffState, string> = {
  "not-applicable": "Onward leg is not a SAPS station",
  proposed: "Proposed by the origin site",
  "hq-approved": "Approved by HQ",
  "in-transit": "In transit between stations",
  accepted: "Accepted by the receiving site",
  rejected: "Rejected by the receiving site",
};

export interface InterStationHandoff {
  fromSite: SiteCode;
  toSite: SiteCode;
  state: HandoffState;
  proposedAt: string | null;
  hqApprovedAt: string | null;
  hqApprovedBy: string | null;
  acceptedAt: string | null;
  acceptedBy: string | null;
  rejectedReason: string | null;
  /** The whole point: the bond must survive the move. */
  bondContinuityRef: string | null;
  bondContinuityVerified: boolean;
  /** Outbox row id — the CDC sync that carries ownership across sites. */
  syncOutboxId: string | null;
  syncedAt: string | null;
}

/* ================================================================== *
 * The case
 * ================================================================== */

export interface TranshipmentCase extends DomainRecord {
  id: number;
  awbId: number;
  AWBNO: string;
  IGMNO: string;
  stage: TranshipmentStage;

  transfer: AwbTransfer;
  permit: TranshipmentPermit | null;
  supervision: SupervisionEvent[];
  handoff: InterStationHandoff;

  /** Bonded zone the cargo occupies while it waits. */
  locationId: number | null;
  /** Inbound flight it arrived on, and the onward leg it is waiting for. */
  inboundFlight: string;
  onwardFlight: string | null;
  onwardCarrier: string | null;
  scheduledDeparture: string | null;

  rctSentAt: string | null;
  tfdSentAt: string | null;
  depSentAt: string | null;

  storageCharges: Amount;
  chargesRaisedAt: string | null;

  /** Days in the bonded zone — drives the aging view. */
  dwellDays: number;
  closedAt: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * Readiness gate — what has to be true before re-tender
 * ================================================================== */

export interface RetenderCondition {
  code: "permit-valid" | "bond-supervised" | "charges-settled" | "flight-confirmed" | "handoff-clear";
  label: string;
  pass: boolean;
  detail: string;
  applicable: boolean;
}

/**
 * FC-09 §10 — the cargo cannot be re-tendered until the permit is live, the
 * bond trail is unbroken, charges are raised, the onward flight is confirmed,
 * and any inter-station handoff has been accepted with bond continuity intact.
 */
export function evaluateRetender(c: TranshipmentCase, nowIso: string) {
  const lastSweep = c.supervision.filter((s) => s.clean).slice(-1)[0] ?? null;
  const handoffApplies = c.handoff.state !== "not-applicable";

  const conditions: RetenderCondition[] = [
    {
      code: "permit-valid",
      label: "Transhipment permit valid",
      pass: !!c.permit && !permitLapsed(c.permit, nowIso),
      detail: !c.permit
        ? "No permit issued"
        : permitLapsed(c.permit, nowIso)
          ? `Lapsed ${Math.abs(permitDaysRemaining(c.permit, nowIso))} days ago — must be re-issued`
          : `${c.permit.permitNo} · ${permitDaysRemaining(c.permit, nowIso)} days remaining`,
      applicable: true,
    },
    {
      code: "bond-supervised",
      label: "Bond supervision trail unbroken",
      pass: c.supervision.length > 0 && c.supervision.every((s) => s.clean),
      detail:
        c.supervision.length === 0
          ? "No supervision events recorded"
          : c.supervision.every((s) => s.clean)
            ? `${c.supervision.length} checks, all clean${lastSweep ? ` — last ${SUPERVISION_KIND_LABEL[lastSweep.kind]}` : ""}`
            : `${c.supervision.filter((s) => !s.clean).length} check(s) found a discrepancy`,
      applicable: true,
    },
    {
      code: "charges-settled",
      label: "Storage charges raised",
      pass: c.chargesRaisedAt !== null,
      detail: c.chargesRaisedAt ? "Raised against the onward carrier" : "Not yet raised",
      applicable: true,
    },
    {
      code: "flight-confirmed",
      label: "Onward flight confirmed",
      pass: !!c.onwardFlight && !!c.scheduledDeparture,
      detail: c.onwardFlight
        ? `${c.onwardFlight} · ${c.onwardCarrier ?? "carrier TBC"}`
        : "No connecting flight allocated",
      applicable: true,
    },
    {
      code: "handoff-clear",
      label: "Inter-station handoff accepted",
      pass: c.handoff.state === "accepted" && c.handoff.bondContinuityVerified,
      detail: !handoffApplies
        ? "Onward leg is not a SAPS station"
        : c.handoff.state === "accepted"
          ? c.handoff.bondContinuityVerified
            ? `Accepted by ${c.handoff.toSite}, bond continuity verified`
            : `Accepted by ${c.handoff.toSite} but bond continuity NOT verified`
          : HANDOFF_STATE_LABEL[c.handoff.state],
      applicable: handoffApplies,
    },
  ];

  const applicable = conditions.filter((x) => x.applicable);
  return {
    conditions,
    canRetender: applicable.every((x) => x.pass),
    blockedBy: applicable.filter((x) => !x.pass),
  };
}
