/**
 * AirVault domain — export cargo (FC-11). **M16-adjacent, largely greenfield.**
 *
 * CMTS sources — the only export tables that exist:
 *   `CARGOACCEPTANCE`    (31)  acceptance header — all 31 columns
 *   `CARGOACCEPTANCEHWB` (7)   house breakdown at acceptance
 *   `ACCEPTENCEDETAIL`   (10)  per-line nature/pcs/weight/dimensions
 *   `ExportGodownrent`   (53)  export-side godown rent
 *
 * Everything else FC-11 needs has **no legacy field to inherit**: security
 * screening, chain of custody, ULD build verification against a PFM, the
 * discrepancy note, and the PSW export declaration. The build plan flags
 * this as the highest design-risk area for exactly that reason — here the
 * flow *is* the specification, so this module is a proposal, not a
 * transcription.
 *
 * Two tickets are deliberately absent:
 *   • P9-1 export revenue (`INTERNATIONALCARGO`, SAPS revenue share) — BLK-02
 *   • P9-6 airmail / postal (`AIRMAILDELIVERYBILL` et al.)         — BLK-01
 * Both are parked pending SAPS flow confirmation and are not modelled here.
 */

import type { Amount, DocNumberRef, DomainRecord, FormValue, SiteCode } from "./common";

/* ================================================================== *
 * FC-11 stages
 * ================================================================== */

export type ExportStage =
  | "E01-booked"
  | "E02-accepted"
  | "E03-docs-captured"
  | "E04-weighed"
  | "E05-customs-checked"
  | "E06-screened"
  | "E07-classified"
  | "E08-warehoused"
  | "E09-built-up"
  | "E10-messages-sent"
  | "E11-handed-to-ramp"
  | "E12-onboarded"
  | "E13-closed";

export const EXPORT_STAGE_LABEL: Record<ExportStage, string> = {
  "E01-booked": "E01. Booking received from airline",
  "E02-accepted": "E02. Cargo accepted at the export counter",
  "E03-docs-captured": "E03. Export documents captured (OCR)",
  "E04-weighed": "E04. Weighed — gross / tare / net",
  "E05-customs-checked": "E05. Customs / ANF check",
  "E06-screened": "E06. Security screening",
  "E07-classified": "E07. Classified — special cargo?",
  "E08-warehoused": "E08. Warehoused pending build-up",
  "E09-built-up": "E09. Built up per PFM / load plan",
  "E10-messages-sent": "E10. FFM / FWB / FHL transmitted",
  "E11-handed-to-ramp": "E11. Handed to ramp",
  "E12-onboarded": "E12. Onboarded",
  "E13-closed": "E13. Export invoice raised, file closed",
};

export const EXPORT_STAGE_ORDER: ExportStage[] = [
  "E01-booked", "E02-accepted", "E03-docs-captured", "E04-weighed",
  "E05-customs-checked", "E06-screened", "E07-classified", "E08-warehoused",
  "E09-built-up", "E10-messages-sent", "E11-handed-to-ramp", "E12-onboarded", "E13-closed",
];

/* ================================================================== *
 * Acceptance — CMTS `CARGOACCEPTANCE` (all 31 columns)
 * ================================================================== */

export interface CargoAcceptance {
  CARGODATE: string;
  /**
   * CMTS `varchar(13)` — and a **business** identifier, not a surrogate key:
   * it is the physical cargo reference an operator reads off the consignment
   * in front of them. Typing it as a number would be wrong twice over. It
   * would invent a database key the legacy system does not have, and it
   * would silently destroy references that are not purely numeric — leading
   * zeros, station prefixes, and check characters all survive a varchar and
   * none of them survive a parse to int. The same column appears on
   * `ACCEPTENCEDETAIL`, which is how a line is tied back to its header.
   */
  CARGOID: string;
  REVENUECODE: string;
  CARGOGROUP: string;
  CARGOTYPE: string;
  PAYMENT: string;
  AWBCODE: string;
  BAGNO: string | null;
  LOADEDWEIGHT: number;
  UNLOADEDWEIGHT: number;
  /**
   * `TIMEOFWEIGHMENT` and `TIMEOFACCEPTENCE` are CMTS `varchar(5)` — clock
   * times held as text, `HH:MM`, with no date attached. They stay strings.
   *
   * The tempting cleanup is to fold each one into `CARGODATE` and store a
   * single timestamp. That is a **lossy transform** and must not happen at
   * migration. A varchar(5) can hold what the counter actually recorded,
   * including the states a timestamp cannot represent: blank when the step
   * was skipped, and a wall-clock time that legitimately precedes or crosses
   * midnight relative to `CARGODATE` on a night shift. Combining the two
   * columns forces a date onto a value that never had one, and the operator's
   * original entry is then unrecoverable — the reverse transform does not
   * exist. Parse to a real time at the point of display, never in storage.
   */
  TIMEOFWEIGHMENT: string;
  TIMEOFACCEPTENCE: string;
  VEHICALNO: string;
  AGENTNAME: string;
  CARGOAGENTNAME: string;
  DESTINATION: string;
  ORIGIN: string;
  SHIPPERNAME: string;
  SHIPPERADDRESS: string;
  SHIPPERPHONENO: string;
  CONSIGNEENAME: string;
  CONSIGNEEADDRESS: string;
  CONSIGNEEPHONENO: string;
  REMARKS: string | null;
  STATUS: string;
  PCSAWB: number;
  WEIGHTAWB: number;
  DISCREPANCY: string | null;
  LEASHINGWEIGHT: number;
  PALLETWEIGHT: number;
  AIRLINEABB: string;
}

/** CMTS `ACCEPTENCEDETAIL` (10) — the legacy spelling is the schema's own. */
export interface AcceptanceLine {
  CARGODATE: string;
  /**
   * Same business reference as the header's `CARGOID`, same `varchar(13)`.
   * `CARGODATE` + `CARGOID` is how CMTS relates a detail line to its
   * acceptance header — there is no join column beyond the two the operator
   * already sees, which is why neither may be retyped as a generated key.
   */
  CARGOID: string;
  SEQUENCE: number;
  NATUREOFGOODS: string;
  PCS: number;
  WEIGHT: number;
  WIDTH: number;
  HEIGHT: number;
  LENGTH: number;
  UNIT: string;
}

/**
 * CMTS `CARGOACCEPTANCEHWB` (7) — the house breakdown captured at acceptance,
 * i.e. the rows that exist only when the accepted consignment is a
 * consolidation and one master covers many houses.
 *
 * The trio `CARGOACCEPTANCE` / `ACCEPTENCEDETAIL` / `CARGOACCEPTANCEHWB` is
 * cited as source lineage by both the export and the import acceptance
 * screens, because in CMTS one set of tables records the acceptance event on
 * either side of the terminal.
 */
export interface AcceptanceHwb {
  /**
   * `varchar(45)`. The widest HWB column in CMTS — the same house number is
   * `varchar(40)` on `AWBDELEIVERYORDER` and narrower still elsewhere. The
   * widest declaration is the one worth modelling, since a house number that
   * round-trips through the acceptance table must not be truncated by a type
   * chosen from a different table's copy of the column.
   */
  HWBNO: string;
  /**
   * `int` here — and deliberately not the same shape as `CARGOGROUP` on
   * `CARGOACCEPTANCE`, which is a varchar. The legacy schema really does
   * carry this column as a code number on the house rows and as text on the
   * header. Reconciling the two is a migration decision that has not been
   * taken, so each table keeps the type it actually has and the disagreement
   * stays visible rather than being papered over here.
   */
  CARGOGROUP: number | null;
  /** Part of the acceptance key the house rows hang off, with `CARGOID`. */
  CARGODATE: string;
}

/* ================================================================== *
 * Weighment — the FC-11 amendment's scale integration
 *
 * CMTS has LOADEDWEIGHT / UNLOADEDWEIGHT / LEASHINGWEIGHT / PALLETWEIGHT
 * but nothing that says where the numbers came from. The amendment makes
 * them auto-captured, which means the reading has a provenance and a
 * tolerance rather than being whatever the operator typed.
 * ================================================================== */

export interface Weighment {
  scaleId: string;
  weighedAt: string;
  weighedBy: string;
  /** Vehicle in, vehicle out — net is the difference. */
  grossKg: number;
  tareKg: number;
  netKg: number;
  /** Pallet and lashing deducted separately, per CMTS. */
  palletKg: number;
  lashingKg: number;
  /** What the shipper declared, for the variance check. */
  declaredKg: number;
  varianceKg: number;
  varianceRatio: number;
  withinTolerance: boolean;
  /** True when the reading came off the scale rather than a keyboard. */
  autoCaptured: boolean;
}

/* ================================================================== *
 * Security screening & chain of custody — no CMTS field at all
 * ================================================================== */

export type ScreeningMethod = "x-ray" | "etd" | "edd" | "physical-search" | "known-consignor";

export const SCREENING_METHOD_LABEL: Record<ScreeningMethod, string> = {
  "x-ray": "X-ray",
  etd: "ETD — explosive trace detection",
  edd: "EDD — explosive detection dog",
  "physical-search": "Physical search",
  "known-consignor": "Known-consignor exemption",
};

export type ScreeningResult = "pass" | "fail" | "re-screen" | "referred";

export interface ScreeningRecord {
  id: number;
  method: ScreeningMethod;
  screenedAt: string;
  /** Attributable to a person, not a shift — this is a regulated record. */
  screenerId: string;
  screenerName: string;
  result: ScreeningResult;
  piecesScreened: number;
  notes: string | null;
  /** Tamper-evident seal applied after a pass. */
  sealNo: string | null;
  sealAppliedAt: string | null;
  /** RFID seal tag, per the amendment. */
  sealRfid: string | null;
}

/** ACC3 / known-consignor status the consignment travels under. */
export type CustodyRegime = "ACC3" | "known-consignor" | "account-consignor" | "unknown";

export interface CustodyEvent {
  id: number;
  at: string;
  fromParty: string;
  toParty: string;
  location: string;
  sealIntact: boolean | null;
  sealNo: string | null;
  signedBy: string;
  note: string | null;
}

/* ================================================================== *
 * ULD build-up against the PFM — FC-11's ULD Build Report
 * ================================================================== */

export interface PfmLine {
  uldNo: string;
  uldType: string;
  /** What the load plan says should go on this ULD. */
  plannedAwbs: string[];
  plannedPieces: number;
  plannedWeightKg: number;
  /** What was actually built. */
  actualAwbs: string[];
  actualPieces: number;
  actualWeightKg: number;
  builtAt: string | null;
  builtBy: string | null;
}

export interface BuildDiscrepancy {
  uldNo: string;
  kind: "missing" | "excess" | "weight-variance";
  awbNo: string | null;
  detail: string;
  pieces: number;
}

/** FC-11 — a build that does not match the PFM raises a Discrepancy Note. */
export function buildDiscrepancies(lines: PfmLine[]): BuildDiscrepancy[] {
  const out: BuildDiscrepancy[] = [];
  for (const l of lines) {
    for (const awb of l.plannedAwbs) {
      if (!l.actualAwbs.includes(awb)) {
        out.push({
          uldNo: l.uldNo,
          kind: "missing",
          awbNo: awb,
          detail: `Planned on ${l.uldNo} but not built.`,
          pieces: 0,
        });
      }
    }
    for (const awb of l.actualAwbs) {
      if (!l.plannedAwbs.includes(awb)) {
        out.push({
          uldNo: l.uldNo,
          kind: "excess",
          awbNo: awb,
          detail: `Built onto ${l.uldNo} but not on the load plan.`,
          pieces: 0,
        });
      }
    }
    if (l.actualPieces !== l.plannedPieces) {
      out.push({
        uldNo: l.uldNo,
        kind: "missing",
        awbNo: null,
        detail: `${l.plannedPieces} planned, ${l.actualPieces} built.`,
        pieces: Math.abs(l.plannedPieces - l.actualPieces),
      });
    }
    const wv = Math.abs(l.actualWeightKg - l.plannedWeightKg);
    if (l.plannedWeightKg > 0 && wv / l.plannedWeightKg > 0.02) {
      out.push({
        uldNo: l.uldNo,
        kind: "weight-variance",
        awbNo: null,
        detail: `${l.plannedWeightKg} kg planned vs ${l.actualWeightKg} kg built (${((wv / l.plannedWeightKg) * 100).toFixed(1)}%).`,
        pieces: 0,
      });
    }
  }
  return out;
}

/* ================================================================== *
 * Export declaration — PSW-primary from day one (FC-11 amendment)
 * ================================================================== */

export interface ExportDeclaration {
  /** Single Declaration — the export counterpart of FC-06's import SD. */
  sdRef: string | null;
  sdLodgedAt: string | null;
  /** Form-E / Electronic Form-E — the FX undertaking. */
  formERef: string | null;
  formEBank: string | null;
  formEValue: Amount;
  formEExpiry: string | null;
  /** PSW EDI acknowledgement. */
  pswAckRef: string | null;
  pswAckAt: string | null;
  clearedAt: string | null;
  /** Populated on rejection. */
  rejectionCode: string | null;
  rejectionText: string | null;
}

/* ================================================================== *
 * The consignment
 * ================================================================== */

export interface ExportConsignment extends DomainRecord {
  id: number;
  awbNo: string;
  stage: ExportStage;

  /** E01 — what the airline sold, before any cargo arrived. */
  booking: ExportBooking | null;

  acceptance: CargoAcceptance;
  lines: AcceptanceLine[];
  /**
   * Empty for a straight master. Populated only when the consignment is a
   * consolidation, which is the condition under which CMTS writes
   * `CARGOACCEPTANCEHWB` rows at all — an empty array is therefore a
   * meaningful "not a consolidation", not missing data.
   */
  hwb: AcceptanceHwb[];
  /**
   * Export documents are **keyed at the acceptance counter**, not scanned.
   * FC-11 drew this as OCR by analogy with the import side; the import
   * scan point is inbound MAWB/HAWB off the flight pouch, which has no
   * export equivalent — the shipper hands paper across a counter and the
   * clerk types it. See the SCOPE note in `common.ts`.
   */
  capturedDocs: Array<{ label: string; value: FormValue<string>; documentId: string | null }>;

  weighment: Weighment | null;
  /** E05 — the customs / ANF check and its correction loop. */
  clearance: ExportClearance;
  screening: ScreeningRecord[];
  custodyRegime: CustodyRegime;
  custodyChain: CustodyEvent[];

  /** E07 — classification and the 08a / 08b branch. */
  classification: ExportClassification | null;
  /** E08 — where it sits until build-up. */
  warehousing: ExportWarehousing | null;

  flightNo: string | null;
  scheduledDeparture: string | null;
  pfm: PfmLine[];
  discrepancyNoteNo: string | null;
  discrepancyNote: DocNumberRef | null;
  /** E10 — when FFM / FWB / FHL went out. */
  messagesSentAt: string | null;

  declaration: ExportDeclaration;

  /** E12 — the aircraft's decision, which is not the ramp handover. */
  uplift: UpliftRecord | null;
  /** E13 — closure and archive; the invoice half is parked (BLK-02). */
  closure: ExportClosure | null;

  exportCharges: Amount;
  closedAt: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * Ramp-handover gate — what must be true before E11
 * ================================================================== */

export interface RampCondition {
  code: "screened" | "sealed" | "custody-unbroken" | "declaration-cleared" | "build-matches-pfm";
  label: string;
  pass: boolean;
  detail: string;
}

/**
 * FC-11 §22 — cargo cannot go airside until it is screened and sealed, the
 * custody chain is unbroken, the export declaration has cleared PSW, and the
 * build matches the load plan. Each is independently regulated; passing four
 * of five is not "nearly ready", it is not ready.
 */
export function evaluateRampHandover(c: ExportConsignment) {
  const lastScreen = c.screening[c.screening.length - 1] ?? null;
  const sealed = c.screening.some((s) => s.result === "pass" && s.sealNo);
  const custodyBroken = c.custodyChain.some((e) => e.sealIntact === false);
  const disc = buildDiscrepancies(c.pfm);

  const conditions: RampCondition[] = [
    {
      code: "screened",
      label: "Security screening passed",
      pass: !!lastScreen && lastScreen.result === "pass",
      detail: !lastScreen
        ? "Not screened"
        : lastScreen.result === "pass"
          ? `${SCREENING_METHOD_LABEL[lastScreen.method]} by ${lastScreen.screenerName}`
          : `Last result: ${lastScreen.result}`,
    },
    {
      code: "sealed",
      label: "Tamper-evident seal applied",
      pass: sealed,
      detail: sealed
        ? `Seal ${c.screening.find((s) => s.sealNo)?.sealNo}`
        : "No seal recorded after screening",
    },
    {
      code: "custody-unbroken",
      label: "Chain of custody unbroken",
      pass: !custodyBroken && c.custodyChain.length > 0,
      detail:
        c.custodyChain.length === 0
          ? "No custody events recorded"
          : custodyBroken
            ? "A handover recorded a broken seal — re-screening required"
            : `${c.custodyChain.length} handovers, seals intact · regime ${c.custodyRegime}`,
    },
    {
      code: "declaration-cleared",
      label: "Export declaration cleared (PSW)",
      pass: c.declaration.clearedAt !== null,
      detail: c.declaration.clearedAt
        ? `${c.declaration.sdRef} cleared`
        : c.declaration.rejectionCode
          ? `Rejected ${c.declaration.rejectionCode} — ${c.declaration.rejectionText ?? ""}`
          : c.declaration.sdLodgedAt
            ? "Lodged, awaiting PSW acknowledgement"
            : "Not lodged",
    },
    {
      code: "build-matches-pfm",
      label: "ULD build matches the load plan",
      pass: c.pfm.length > 0 && disc.length === 0,
      detail:
        c.pfm.length === 0
          ? "Not built up"
          : disc.length === 0
            ? `${c.pfm.length} ULD(s) match the PFM`
            : `${disc.length} discrepancy item(s) — Discrepancy Note required`,
    },
  ];

  return {
    conditions,
    canHandOver: conditions.every((x) => x.pass),
    blockedBy: conditions.filter((x) => !x.pass),
    discrepancies: disc,
  };
}

/* ================================================================== *
 * E01 — Booking from the airline / GSA
 *
 * FC-11's start node. Nothing in CMTS: the legacy system picks the export
 * story up at acceptance, which means the allotment the airline actually
 * sold is invisible to the terminal until cargo is already on the floor.
 * Modelling it is what lets E12 answer "does this fit the aircraft?" with
 * something other than a guess.
 * ================================================================== */

export interface ExportBooking {
  bookingRef: string;
  /** Booked directly by the carrier, or through a General Sales Agent. */
  channel: "airline-direct" | "gsa" | "forwarder";
  gsaName: string | null;
  bookedAt: string;
  /** What the airline sold — the allotment this consignment is held against. */
  allottedPieces: number;
  allottedWeightKg: number;
  allottedVolumeM3: number;
  /** Flight the booking is held against; may move before uplift. */
  bookedFlightNo: string;
  bookedDeparture: string;
  /** Rate the booking was sold at, for the E13 export invoice. */
  agreedRatePerKg: Amount;
  shipperName: string;
  commodity: string;
}

/* ================================================================== *
 * E05 — Customs / ANF check, and the correction loop
 *
 * The part of FC-11 with the most edges and the least legacy support. The
 * flow does NOT go check → cleared. It goes:
 *
 *   Custom / ANF Check ─┬→ Inspection for Clearance ─┐
 *                       └→ Document Check (AWB / GD) ─┴→ Clearance?
 *                                                        │ Yes → Physical Check
 *                                                        │ No  → Hold till correction?
 *                                                                 │ Yes → back to Custom / ANF Check
 *                                                                 └ No  → Returned to shipper / Detained
 *
 * Both arms feed the same decision, and the hold is itself a decision with
 * a terminal reject on the No edge. A model that stores a single boolean
 * "cleared" cannot express a consignment on its second correction round,
 * which is the state an export desk spends most of its day in.
 * ================================================================== */

export type ClearanceArm = "inspection" | "document-check";

export type ClearanceOutcome =
  | "cleared" //           → physical check, then weighment
  | "held-for-correction" //  correctable — loops back to the check
  | "returned-to-shipper" //  terminal
  | "detained"; //            terminal, customs retains the goods

export const CLEARANCE_OUTCOME_LABEL: Record<ClearanceOutcome, string> = {
  cleared: "Cleared",
  "held-for-correction": "Held till correction",
  "returned-to-shipper": "Returned to shipper",
  detained: "Detained by customs",
};

/** One pass through the Custom / ANF check. A consignment may have several. */
export interface ClearanceRound {
  round: number;
  startedAt: string;
  /** Which arm(s) of the check this round ran. */
  arms: ClearanceArm[];
  /** Officer for the inspection arm. */
  inspectingOfficer: string | null;
  /** AWB / GD signed off by customs or ANF on the document arm. */
  documentsSignedBy: string | null;
  anfRequired: boolean;
  anfClearedAt: string | null;
  outcome: ClearanceOutcome;
  /** Why it did not clear — the thing the shipper has to fix. */
  defect: string | null;
  closedAt: string | null;
}

export interface ExportClearance {
  rounds: ClearanceRound[];
  /** Terminal state, or null while the loop is still running. */
  settledAs: ClearanceOutcome | null;
  settledAt: string | null;
}

/**
 * FC-11 — a consignment is through §08 only on a `cleared` round. An open
 * `held-for-correction` round means the loop is still live, which is a
 * different thing from having failed.
 */
export function clearanceState(c: ExportClearance) {
  const last = c.rounds[c.rounds.length - 1] ?? null;
  const terminal =
    c.settledAs === "returned-to-shipper" || c.settledAs === "detained";
  return {
    last,
    rounds: c.rounds.length,
    /** Still looping — held, awaiting the shipper's correction. */
    inCorrectionLoop: last?.outcome === "held-for-correction" && !terminal,
    cleared: c.settledAs === "cleared",
    terminal,
    /** How many times this consignment has been round the loop. */
    corrections: c.rounds.filter((r) => r.outcome === "held-for-correction").length,
  };
}

/* ================================================================== *
 * E07 — Classification and the special-cargo branch
 *
 * FC-11 §16: "Special cargo?" → §16a special handling verification
 * (DGR / PER / AVI / VAL) or §16b general export storage. The branch is not
 * cosmetic: §16a is a verification with a named verifier and a document
 * behind it, and skipping it for cargo that needed it is how a DG shipment
 * reaches a ULD unverified.
 * ================================================================== */

export type SpecialHandlingCode = "DGR" | "PER" | "AVI" | "VAL" | "HUM" | "COL";

export const SPECIAL_HANDLING_LABEL: Record<SpecialHandlingCode, string> = {
  DGR: "Dangerous goods",
  PER: "Perishable",
  AVI: "Live animals",
  VAL: "Valuable cargo",
  HUM: "Human remains",
  COL: "Cool chain",
};

export interface SpecialHandlingCheck {
  code: SpecialHandlingCode;
  label: string;
  /** e.g. "Shipper's Declaration for Dangerous Goods". */
  requiredDocument: string;
  documentRef: string | null;
  verifiedBy: string | null;
  verifiedAt: string | null;
  pass: boolean;
  note: string | null;
}

export interface ExportClassification {
  /** IATA Special Cargo Code carried on the booking. */
  scc: string | null;
  isSpecial: boolean;
  codes: SpecialHandlingCode[];
  /** Empty on the 08b normal path. */
  checks: SpecialHandlingCheck[];
  classifiedBy: string;
  classifiedAt: string;
  /** 08a for special, 08b for normal — kept so the branch stays visible. */
  route: "08a-special-handling" | "08b-normal-storage";
}

/** Special cargo may not proceed to E08 with an unverified handling check. */
export function classificationCleared(x: ExportClassification): boolean {
  if (!x.isSpecial) return true;
  return x.checks.length > 0 && x.checks.every((c) => c.pass);
}

/* ================================================================== *
 * E08 — Export warehousing
 * ================================================================== */

export interface ExportWarehousing {
  /** Bay / rack the consignment sits in until build-up. */
  locationCode: string;
  zone: "general" | "dgr" | "cool-chain" | "strongroom" | "avi";
  putawayAt: string;
  putawayBy: string;
  /** Temperature-controlled ULDs are labelled — FC-11 annotation. */
  temperatureControlled: boolean;
  temperatureC: number | null;
  /** Set when E12 sends the consignment back here after an offload. */
  returnedFromOffload: boolean;
}

/* ================================================================== *
 * E12 — Payload compatibility and uplift
 *
 * FC-11's most consequential loop, and the one most easily missed: the
 * "Payload compatibility with Flight" diamond has a **No** edge that goes
 * back to §17 export warehousing, annotated "Can be offloaded depending
 * upon weight provision". Cargo that has passed every gate — screened,
 * sealed, cleared, built — can still come off the aircraft for payload,
 * and it re-enters at warehousing rather than dropping out of the flow.
 *
 * Modelling only the Yes edge would make the demo claim that a handover to
 * ramp is an uplift. It is not; the aircraft decides.
 * ================================================================== */

export interface UpliftRecord {
  /** Aircraft payload available for this consignment's ULD position. */
  availablePayloadKg: number;
  offeredWeightKg: number;
  assessedAt: string;
  assessedBy: string;
  compatible: boolean;
  outcome: "onboarded" | "offloaded";
  onboardedAt: string | null;
  /** Populated on the No edge. */
  offloadReason: string | null;
  /** The flight it rolled to, once rebooked. */
  rebookedFlightNo: string | null;
  rebookedDeparture: string | null;
}

/**
 * FC-11 — "Can be offloaded depending upon weight provision". Compatibility
 * is decided on the payload actually available at the ULD position, not on
 * what the booking sold at E01, which is why both numbers are carried.
 */
export function evaluateUplift(u: UpliftRecord | null, booking: ExportBooking | null) {
  if (!u) {
    return {
      assessed: false,
      compatible: false,
      marginKg: null as number | null,
      overBookedKg: null as number | null,
      summary: "Payload compatibility not yet assessed",
    };
  }
  const marginKg = Math.round((u.availablePayloadKg - u.offeredWeightKg) * 100) / 100;
  const overBookedKg =
    booking === null
      ? null
      : Math.round((u.offeredWeightKg - booking.allottedWeightKg) * 100) / 100;
  return {
    assessed: true,
    compatible: u.compatible,
    marginKg,
    overBookedKg,
    summary: u.compatible
      ? `Onboarded — ${marginKg} kg payload margin`
      : `Offloaded — ${Math.abs(marginKg)} kg over available payload · ${u.offloadReason ?? "no reason recorded"}`,
  };
}

/* ================================================================== *
 * E13 — Closure and archive
 *
 * The flow's end node is "15. Export Invoice / Closure / Archive". The
 * closure and archive halves are modelled here. The **invoice** half is
 * not: export revenue (`INTERNATIONALCARGO`, the SAPS revenue share) is
 * P9-1 / BLK-02 and is parked pending SAPS confirmation of how export
 * revenue is split. `invoiceRaised` is therefore deliberately a reference
 * with no amount behind it — the gap is visible rather than guessed.
 * ================================================================== */

export interface ExportClosure {
  /** BLK-02 — reference only; the revenue model is not settled. */
  invoiceRef: string | null;
  invoiceRaisedAt: string | null;
  /** All export charges other than the parked revenue share. */
  chargesSettled: boolean;
  fileClosedAt: string | null;
  archivedAt: string | null;
  archiveRef: string | null;
  closedBy: string | null;
}

export interface ClosureCondition {
  code: "uplifted" | "messages-sent" | "declaration-cleared" | "charges-settled";
  label: string;
  pass: boolean;
  detail: string;
}

/** A file may not be closed while any of these is outstanding. */
export function evaluateClosure(c: {
  uplift: UpliftRecord | null;
  declaration: ExportDeclaration;
  closure: ExportClosure | null;
  messagesSentAt: string | null;
}) {
  const conditions: ClosureCondition[] = [
    {
      code: "uplifted",
      label: "Consignment onboarded",
      pass: c.uplift?.outcome === "onboarded",
      detail:
        c.uplift === null
          ? "Uplift not assessed"
          : c.uplift.outcome === "onboarded"
            ? `Onboarded ${c.uplift.onboardedAt ?? ""}`
            : "Offloaded — returned to warehousing, file stays open",
    },
    {
      code: "messages-sent",
      label: "FFM / FWB / FHL transmitted",
      pass: c.messagesSentAt !== null,
      detail: c.messagesSentAt ? `Sent ${c.messagesSentAt}` : "Not transmitted",
    },
    {
      code: "declaration-cleared",
      label: "Export declaration cleared",
      pass: c.declaration.clearedAt !== null,
      detail: c.declaration.clearedAt ? `${c.declaration.sdRef} cleared` : "Not cleared",
    },
    {
      code: "charges-settled",
      label: "Export charges settled",
      pass: c.closure?.chargesSettled ?? false,
      detail: c.closure?.chargesSettled
        ? "Settled — excludes the parked revenue share (BLK-02)"
        : "Outstanding",
    },
  ];
  return {
    conditions,
    canClose: conditions.every((x) => x.pass),
    blockedBy: conditions.filter((x) => !x.pass),
  };
}
