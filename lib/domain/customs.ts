/**
 * AirVault domain — Pakistan customs clearance (FC-06).
 *
 * CMTS sources:
 *   `CUSTOMIGM` (17)        customs IGM header — gap G13, no screen in the demo
 *   `AWBINFORMATION` (35)   GD line data      — gap G13, no screen in the demo
 *   `AwbDetendDetail` (7)   modelled in cargo.ts as DetendDetail
 *
 * FC-06's amendments are the whole point of this module:
 *   • **PSW is primary**, WeBOC legacy/parallel-run — so every filing is a
 *     *pair* of submissions, not one. See `GatewaySubmission` (BLK-04).
 *   • **Single Declaration (SD) replaces GD.** The legacy vocabulary is kept
 *     alongside so an operator reading a CMTS-era document can still follow.
 *   • SD status, risk channel and OOC are **fetched electronically**, not
 *     typed. `fetchedAt` on those records is what makes that visible.
 *   • **OOC is captured — PSW fetch, counter scan, or keyed from the print
 *     — and then verified against the SD** — the verification is the
 *     control, not the capture. Issuance releases nothing on its own:
 *     `SdStatus` carries an explicit `ooc-verified` state and `released` is
 *     only reachable through it.
 *     Drawn as an OCR step; converted once SAPS confirmed OCR is limited
 *     to the two scan points. See the SCOPE note in `common.ts`.
 *
 * BLK-03: FC-06 labels the red-channel edge "Normal" (Green / Yellow /
 * Normal). We render Green / Yellow / Red and treat "Normal" as the red
 * synonym. `RISK_CHANNEL_FLOW_LABEL` keeps the flow's own wording visible so
 * the discrepancy stays on screen rather than being quietly resolved.
 */

import type { Amount, DocNumberRef, DomainRecord, FormValue, SiteCode } from "./common";

/* ================================================================== *
 * Risk channel
 * ================================================================== */

export type RiskChannel = "green" | "yellow" | "red";

export const RISK_CHANNEL_LABEL: Record<RiskChannel, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Red",
};

/** BLK-03 — what FC-06 itself calls each edge. */
export const RISK_CHANNEL_FLOW_LABEL: Record<RiskChannel, string> = {
  green: "Green",
  yellow: "Yellow",
  red: "Normal",
};

export const RISK_CHANNEL_TREATMENT: Record<RiskChannel, string> = {
  green: "Auto-cleared — no scrutiny, straight to duty assessment",
  yellow: "Document scrutiny, with a query loop back to the CHA",
  red: "Physical examination and sampling",
};

/* ================================================================== *
 * Customs IGM header — CMTS `CUSTOMIGM` (all 17 columns)
 * ================================================================== */

export interface CustomsIgm extends DomainRecord {
  DOCUMENTNO: string;
  PORT: string;
  SHIPPINGAGENTNO: string;
  FLIGHTNO: string;
  VOYAGE: string;
  COUNTRY: string;
  ORIGIN: string;
  CAPTAINNAME: string;
  AIRPORTNAME: string;
  /** Cargo remaining on the same aircraft — not landed here. */
  SAMEBOTTOMCARGO: string;
  IGMNO: string;
  IGMYEAR: number;
  TOTALCONSIGNMENTS: number;
  INDEXNO: string;
  ARRIVALDATE: string;
  FILINGDATE: string;
  SHIPPINGCOMPANY: string;

  // ---- AirVault additions ----
  manifestId: number;
  site: SiteCode;
}

/* ================================================================== *
 * GD / SD line data — CMTS `AWBINFORMATION` (all 35 columns)
 *
 * This is the commercial detail customs assesses on: PCT code, value per
 * unit, country of origin, insurance, LC and licence numbers. The demo has
 * never carried any of it — an AWB screen that cannot show a PCT code
 * cannot support a duty conversation.
 * ================================================================== */

export interface AwbInformation {
  DOCUMENTNO: string;
  AIRWAYBILLNO: string;
  DESTINATIONPORT: string;
  INDEXNO: string;
  TYPE: string;
  CARGOTYPE: string;
  TYPEBL: string;
  LCNUMBER: string | null;
  IMPORTLICENCENO: string | null;
  NATIONALTAXNO: string;
  CONSIGNEE: string;
  IMPORTNAME: string;
  ADDRESS: string;
  SHIPPERNAME: string;
  SHIPPERADDRESS: string;
  ORIGIN: string;
  PORTDISCHARGE: string;
  CONSIGNMENTVALUE: Amount;
  INSURANCEAMOUNT: Amount;
  WEIGHT: number;
  NETWEIGHT: number;
  REMARKS: string | null;
  PORTOFDELIVERY: string;
  AMOUNTOFFREIGHT: Amount;
  PORTOFSHIPMENT: string;
  /** Pakistan Customs Tariff heading — drives the duty rate. */
  PCTCODE: string;
  SERIALTYPE: string;
  UNITOFMEASURE: string;
  QUANTITY: number;
  VALUEPERUNIT: Amount;
  UNITOFPACKING: string;
  NUMBEROFPACKS: number;
  COUNTRYOFORIGIN: string;
  DESCRIPTION: string;
  CASEMARKINGS: string | null;

  // ---- AirVault addition ----
  awbId: number;
}

/* ================================================================== *
 * Gateway submission — the PSW / WeBOC pair (BLK-04)
 * ================================================================== */

export type GatewayProvider = "psw" | "weboc";

export type SubmissionState = "queued" | "accepted" | "rejected" | "not-filed";

export interface GatewaySubmission {
  provider: GatewayProvider;
  /** PSW is `primary`; WeBOC runs `parallel` during the phased rollout. */
  role: "primary" | "parallel";
  state: SubmissionState;
  reference: string | null;
  submittedAt: string | null;
  acknowledgedAt: string | null;
  /** Populated on `rejected`. */
  errorCode: string | null;
  errorText: string | null;
}

/**
 * A divergence between the two providers is the thing worth catching during
 * a parallel run — if PSW accepts and WeBOC rejects, the filing is not
 * settled no matter what the primary says.
 */
export function submissionsDiverge(subs: GatewaySubmission[]): boolean {
  const filed = subs.filter((s) => s.state !== "not-filed");
  if (filed.length < 2) return false;
  return new Set(filed.map((s) => s.state)).size > 1;
}

/* ================================================================== *
 * Single Declaration — FC-06's replacement for the legacy GD
 * ================================================================== */

export type SdStatus =
  | "draft"
  | "filed"
  | "channel-assigned"
  | "under-scrutiny"
  | "query-raised"
  | "under-examination"
  | "assessed"
  | "duty-paid"
  | "agency-clearance"
  | "ooc-issued"
  /**
   * The OOC has been reconciled field-by-field against the SD with no
   * mismatches. This state exists so the forbidden edge is unrepresentable:
   * `released` sits below it in the union because issuance alone never made
   * cargo releasable, and a status model that ran "ooc-issued" straight into
   * "released" let every screen draw the two as adjacent. `oocVerified()`
   * is what separates them.
   */
  | "ooc-verified"
  | "released";

export const SD_STATUS_LABEL: Record<SdStatus, string> = {
  draft: "Draft — CHA preparing",
  filed: "Filed with customs",
  "channel-assigned": "Risk channel assigned",
  "under-scrutiny": "Document scrutiny (yellow)",
  "query-raised": "Query raised — awaiting CHA",
  "under-examination": "Physical examination (red)",
  assessed: "Assessed — duty and taxes calculated",
  "duty-paid": "Duty and taxes paid",
  "agency-clearance": "ANF / ASF clearance",
  "ooc-issued": "Out-of-charge issued",
  "ooc-verified": "Out-of-charge verified against SD",
  released: "Eligible for release",
};

/** FC-06's yellow-channel query loop. */
export interface CustomsQuery {
  id: number;
  raisedAt: string;
  raisedBy: string;
  subject: string;
  detail: string;
  respondedAt: string | null;
  responseBy: string | null;
  responseText: string | null;
  /** Cleared once the assessing officer accepts the response. */
  closedAt: string | null;
}

/** FC-06's red-channel examination and sampling. */
export interface ExaminationRecord {
  scheduledAt: string | null;
  examinedAt: string | null;
  examiningOfficer: string | null;
  /** Percentage of packages opened. */
  packagesOpened: number;
  packagesTotal: number;
  sampleDrawn: boolean;
  sampleRef: string | null;
  labReportRef: string | null;
  labReportAt: string | null;
  findings: string | null;
  /** Set when the exam disagrees with the declaration. */
  discrepancyFound: boolean;
}

/** FC-06 duty/tax — the four heads the flow names. */
export interface DutyAssessment {
  assessedAt: string | null;
  assessingOfficer: string | null;
  assessedValue: Amount;
  customsDuty: Amount;
  salesTax: Amount;
  /** Federal Excise Duty. */
  fed: Amount;
  /** Withholding tax. */
  wht: Amount;
  total: Amount;
  paidAt: string | null;
  paymentRef: string | null;
}

export function dutyTotal(d: Omit<DutyAssessment, "total">): Amount {
  return Math.round((d.customsDuty + d.salesTax + d.fed + d.wht) * 100) / 100;
}

/** FC-06 ANF / ASF — narcotics and security clearance before OOC. */
export interface AgencyClearance {
  agency: "ANF" | "ASF";
  required: boolean;
  clearedAt: string | null;
  clearanceRef: string | null;
  officer: string | null;
}

/* ================================================================== *
 * Out-of-charge
 *
 * FC-06 originally drew OOC capture as an OCR step. SAPS has since
 * confirmed OCR runs at two points only — MAWB/HAWB off the flight pouch,
 * and the receiver's documents at collection — so OOC is captured by
 * **electronic fetch from PSW**, by **scanning the OOC print** at the
 * counter, or, with both unavailable, **keyed from the print**.
 *
 * The control that mattered is untouched and is the point of this block:
 * however the value arrives, it is **verified field-by-field against the
 * SD**. A document nobody reconciled is not a control — the mismatch list
 * below is the control. Capture and verification are two events, and the
 * gates only ever read the second: `oocVerified()` is what FC-06's
 * clearance gate and FC-07's release gate both consult, so an OOC that has
 * been issued but not reconciled releases nothing.
 * ================================================================== */

export type OocVerifyField = "sdRef" | "awbNo" | "channel" | "packages" | "issuedAt";

export interface OocFieldCheck {
  field: OocVerifyField;
  label: string;
  /** What the OOC document carries, however it was captured — see `source`. */
  captured: FormValue<string>;
  /** What the SD says. */
  expected: string;
  matches: boolean;
}

export interface OutOfCharge {
  oocNo: string;
  docNumber: DocNumberRef;
  /**
   * How the document reached us. Three distinct routes, not two:
   *   `psw-fetch` — pulled electronically from the gateway (the norm);
   *   `scanner`   — the OOC print imaged at the counter scanner and its
   *                 values entered against that image;
   *   `keyed`     — typed straight off the print, gateway and scanner both
   *                 unavailable.
   * `scanner` is a capture route, **not** a third OCR site — the values
   * remain a keyed `FormValue`, see the SCOPE note in `common.ts`. The
   * distinction is worth storing because the screens badge it, and a badge
   * that says "scanner capture" over a keyed record is a lie about
   * provenance.
   */
  source: "psw-fetch" | "scanner" | "keyed";
  fetchedAt: string | null;
  /** When the print was scanned, where `source` is "scanner". */
  scannedAt: string | null;
  /** When the operator keyed it, where `source` is "keyed". */
  keyedAt: string | null;
  issuedAt: string;
  issuingOfficer: string;
  documentId: string | null;

  checks: OocFieldCheck[];
  verifiedAt: string | null;
  verifiedBy: string | null;
}

/** The failing checks — what an operator has to go back to customs about. */
export function oocMismatches(o: OutOfCharge): OocFieldCheck[] {
  return o.checks.filter((c) => !c.matches);
}

/**
 * The whole OOC control in one predicate: someone signed the reconciliation
 * off (`verifiedAt`) AND every field agrees with the SD.
 *
 * Exported deliberately, and imported rather than re-implemented: FC-06's
 * clearance gate (`evaluateClearance` below), FC-07's release gate
 * (finance.ts, which takes the result as a fact) and the fixture generator
 * all read this. Two gates deriving "verified" two different ways is how
 * the demo ended up releasing cargo on issuance alone.
 */
export function oocVerified(o: OutOfCharge): boolean {
  return o.verifiedAt !== null && oocMismatches(o).length === 0;
}

/* ================================================================== *
 * The clearance record — one per AWB
 * ================================================================== */

export interface CustomsClearance extends DomainRecord {
  id: number;
  awbId: number;
  AWBNO: string;
  IGMNO: string;
  INDEXNO: string;

  /** SD is the AirVault term; gdNo carries the legacy CMTS reference. */
  sdRef: string | null;
  gdNo: string | null;
  docNumber: DocNumberRef | null;
  cha: string;

  status: SdStatus;
  filedAt: string | null;

  /** Electronically fetched per the FC-06 amendment — not typed by staff. */
  channel: RiskChannel | null;
  channelAssignedAt: string | null;
  channelFetchedFrom: GatewayProvider | null;

  submissions: GatewaySubmission[];

  queries: CustomsQuery[];
  examination: ExaminationRecord | null;
  duty: DutyAssessment | null;
  agencies: AgencyClearance[];
  ooc: OutOfCharge | null;

  site: SiteCode;
}

/**
 * FC-06's final gate — "eligible for release". Every condition the flow
 * names, evaluated independently so a blocked AWB says *why*.
 */
export interface ClearanceCondition {
  key: "channel-worked" | "duty-paid" | "agencies-cleared" | "ooc-verified" | "not-detained";
  label: string;
  pass: boolean;
  detail: string;
}

/**
 * FC-06's clearance gate — and, since the OOC amendment, the single place
 * where "is the out-of-charge good?" is decided for the whole system.
 *
 * The `ooc-verified` condition below reads the real clearance record via
 * `oocVerified()`: an OOC that was captured *and* reconciled field-by-field
 * against the SD with zero mismatches. Issuance alone clears nothing — an
 * `OutOfCharge` whose `verifiedAt` is still null, or that carries a single
 * failing `OocFieldCheck`, fails this condition closed. That is why
 * `SdStatus` now has an explicit `ooc-verified` state between `ooc-issued`
 * and `released`.
 *
 * Both gates read this one source. FC-06's clearance gate is this function;
 * FC-07's release gate (`evaluateReleaseGate` in finance.ts) is *handed*
 * `oocVerified()` as a fact rather than re-deriving eligibility from the
 * lifecycle stage — the stage-derived boolean is exactly what let an OOC
 * that had only been issued release cargo. Change the rule in
 * `oocVerified()` and both gates move together; re-derive it anywhere else
 * and they drift apart again.
 */
export function evaluateClearance(
  c: CustomsClearance,
  opts: { isDetained: boolean },
): { conditions: ClearanceCondition[]; eligible: boolean } {
  const openQueries = c.queries.filter((q) => !q.closedAt).length;
  const channelWorked =
    c.channel === "green"
      ? true
      : c.channel === "yellow"
        ? openQueries === 0
        : c.examination?.examinedAt != null && !c.examination.discrepancyFound;

  const requiredAgencies = c.agencies.filter((a) => a.required);

  const conditions: ClearanceCondition[] = [
    {
      key: "channel-worked",
      label: "Channel treatment complete",
      pass: channelWorked,
      detail:
        c.channel === null
          ? "No risk channel assigned yet"
          : c.channel === "green"
            ? "Green — auto-cleared, no scrutiny required"
            : c.channel === "yellow"
              ? openQueries === 0
                ? "Yellow — all queries closed"
                : `Yellow — ${openQueries} query${openQueries === 1 ? "" : "ies"} still open`
              : c.examination?.examinedAt
                ? c.examination.discrepancyFound
                  ? "Red — examination found a discrepancy"
                  : "Red — examined, no discrepancy"
                : "Red — examination not completed",
    },
    {
      key: "duty-paid",
      label: "Duty and taxes paid",
      pass: c.duty?.paidAt != null,
      detail: c.duty?.paidAt
        ? `Paid ${c.duty.paymentRef ?? ""}`.trim()
        : c.duty?.assessedAt
          ? "Assessed but unpaid"
          : "Not assessed",
    },
    {
      key: "agencies-cleared",
      label: "ANF / ASF clearance",
      pass: requiredAgencies.every((a) => a.clearedAt != null),
      detail: requiredAgencies.length
        ? requiredAgencies
            .map((a) => `${a.agency} ${a.clearedAt ? "cleared" : "pending"}`)
            .join(" · ")
        : "Not required for this consignment",
    },
    {
      key: "ooc-verified",
      label: "OOC issued and verified vs SD",
      pass: c.ooc != null && oocVerified(c.ooc),
      // Three distinct not-yet states, because "not verified" and "verified
      // and wrong" are different conversations with customs — and because
      // reporting "0 field mismatch" on an OOC nobody has reconciled yet
      // reads as a pass.
      detail: !c.ooc
        ? "No OOC yet"
        : oocVerified(c.ooc)
          ? `Verified against SD ${c.sdRef ?? ""}`.trim()
          : oocMismatches(c.ooc).length === 0
            ? "OOC captured but not yet verified against the SD"
            : `${oocMismatches(c.ooc).length} field mismatch vs SD`,
    },
    {
      key: "not-detained",
      label: "No customs detention",
      pass: !opts.isDetained,
      detail: opts.isDetained
        ? "Part of this AWB is detained — see the Detend register"
        : "No detention on this AWB",
    },
  ];

  return { conditions, eligible: conditions.every((x) => x.pass) };
}
