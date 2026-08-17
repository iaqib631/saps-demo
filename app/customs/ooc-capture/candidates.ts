/**
 * Local fixture for /customs/ooc-capture.
 *
 * Mock-data only, and deliberately local rather than read off
 * `CUSTOMS_CLEARANCES`: the typed fixture generates an OOC that has already
 * been captured, whereas this screen exists for the AWBs where one has NOT.
 * Reading the generator here would mean showing the keying form over records
 * that are already keyed.
 *
 * What the record does carry that the old excise-side mock did not is the
 * pair the reconciliation needs — `sd` (what the declaration says) against
 * `print` (what the OOC document in the officer's hand says). Those two
 * blocks are the same five fields as `OocVerifyField`, in the same order, so
 * `ReleaseReadinessPanel` can zip them into typed `OocFieldCheck`s without a
 * per-field mapping table.
 */

/** The four agencies that can independently stop a release (FC-06 / FC-04). */
export type OocHoldKind = "customs" | "anf" | "asf" | "discrepancy";

/**
 * The five values that get reconciled, held twice — once as the declaration
 * recorded them, once as they appear on the OOC print. Same keys as
 * `OocVerifyField`; a field added to one side must be added to the other.
 */
export interface OocFieldPair {
  sdRef: string;
  awbNo: string;
  channel: string;
  packages: string;
  issuedAt: string;
}

/**
 * `awb`…`holdStatus` are the shape `SearchCard` and `OOCFormCard` already
 * consume — kept byte-identical so those two components need no change.
 * Everything below `holds` is what the SD reconciliation added.
 */
export interface OocCandidate {
  awb: string;
  gd: string;
  channel: string;
  cha: string;
  consignee: string;
  cargoClass: string;
  pieces: string;
  weight: string;
  status: string;
  /** The chip SearchCard renders. Written to agree with `holds` below. */
  holdStatus: string;

  /**
   * Holds as a list rather than a sentence. The old panel asked
   * `holdStatus.includes("ANF")`, which cannot express an AWB carrying both
   * an ASF hold and a discrepancy hold — and ANF and ASF are two different
   * Pakistani agencies, so collapsing them loses who has to release it.
   */
  holds: OocHoldKind[];

  oocNo: string;
  issuingOfficer: string;
  /** Who keyed the print, and when — the OOC becomes a `keyed` capture. */
  keyedBy: string;
  keyedAt: string;
  /** The paper the values were read off, carried into every FormValue. */
  printSource: string;

  /** What the Single Declaration says. */
  sd: OocFieldPair;
  /** What the OOC print says. Any divergence is the control firing. */
  print: OocFieldPair;
}

export const OOC_CANDIDATES: OocCandidate[] = [
  {
    awb: "214-45678901",
    gd: "GD-KHI-2026-00091",
    channel: "Yellow",
    cha: "Al-Huda Clearing",
    consignee: "Al Noor Traders",
    cargoClass: "General Cargo",
    pieces: "42",
    weight: "1,234.5 kg",
    status: "OOC Pending",
    holdStatus: "No active hold",
    holds: [],
    oocNo: "OOC-KHI-2026-00422",
    issuingOfficer: "Deputy Collector — Appraisement",
    keyedBy: "a.qureshi",
    keyedAt: "31 May 2026 11:35",
    printSource: "OOC print — counter copy",
    sd: {
      sdRef: "PSW-SD-2026-8841207",
      awbNo: "214-45678901",
      channel: "Yellow",
      packages: "42",
      issuedAt: "31 May 2026 11:15",
    },
    print: {
      sdRef: "PSW-SD-2026-8841207",
      awbNo: "214-45678901",
      channel: "Yellow",
      packages: "42",
      issuedAt: "31 May 2026 11:15",
    },
  },
  {
    awb: "157-90811223",
    gd: "GD-KHI-2026-00092",
    channel: "Green",
    cha: "Pak Gulf CHA",
    consignee: "Karachi Pharma Imports",
    cargoClass: "Pharmaceuticals",
    pieces: "24",
    weight: "856.2 kg",
    status: "OOC Pending",
    holdStatus: "No active hold",
    holds: [],
    oocNo: "OOC-KHI-2026-00423",
    issuingOfficer: "Deputy Collector — Appraisement",
    keyedBy: "a.qureshi",
    keyedAt: "31 May 2026 10:05",
    printSource: "OOC print — counter copy",
    sd: {
      sdRef: "PSW-SD-2026-8841219",
      awbNo: "157-90811223",
      channel: "Green",
      packages: "24",
      issuedAt: "31 May 2026 09:50",
    },
    print: {
      sdRef: "PSW-SD-2026-8841219",
      awbNo: "157-90811223",
      channel: "Green",
      packages: "24",
      issuedAt: "31 May 2026 09:50",
    },
  },
  {
    // The gateway was down and the print was keyed off the counter copy — and
    // the package count on the print is two short of the declaration. This is
    // the case the whole panel exists for: the capture succeeded, the
    // reconciliation did not, and release stays blocked.
    awb: "074-88219033",
    gd: "GD-KHI-2026-00093",
    channel: "Red",
    cha: "Swift Clear Agency",
    consignee: "Metro Engineering",
    cargoClass: "Machinery",
    pieces: "8",
    weight: "3,200.0 kg",
    status: "Examined",
    holdStatus: "Customs hold active",
    holds: ["customs"],
    oocNo: "OOC-KHI-2026-00424",
    issuingOfficer: "Deputy Collector — Appraisement",
    keyedBy: "a.qureshi",
    keyedAt: "31 May 2026 13:20",
    printSource: "OOC print — counter copy (PSW gateway down)",
    sd: {
      sdRef: "PSW-SD-2026-8841233",
      awbNo: "074-88219033",
      channel: "Red",
      packages: "8",
      issuedAt: "31 May 2026 13:05",
    },
    print: {
      sdRef: "PSW-SD-2026-8841233",
      awbNo: "074-88219033",
      channel: "Red",
      packages: "6",
      issuedAt: "31 May 2026 13:05",
    },
  },
  {
    awb: "235-77890112",
    gd: "GD-KHI-2026-00094",
    channel: "Green",
    cha: "Al-Huda Clearing",
    consignee: "Sapphire Textiles",
    cargoClass: "Textiles",
    pieces: "156",
    weight: "2,450.0 kg",
    status: "OOC Pending",
    holdStatus: "No active hold",
    holds: [],
    oocNo: "OOC-KHI-2026-00425",
    issuingOfficer: "Deputy Collector — Appraisement",
    keyedBy: "i.ali",
    keyedAt: "31 May 2026 12:10",
    printSource: "OOC print — counter copy",
    sd: {
      sdRef: "PSW-SD-2026-8841244",
      awbNo: "235-77890112",
      channel: "Green",
      packages: "156",
      issuedAt: "31 May 2026 11:55",
    },
    print: {
      sdRef: "PSW-SD-2026-8841244",
      awbNo: "235-77890112",
      channel: "Green",
      packages: "156",
      issuedAt: "31 May 2026 11:55",
    },
  },
  {
    // Two mismatches at once — the print quotes a superseded SD reference and
    // an issue date a day early, because customs reissued the declaration
    // after the ANF referral. The panel has to name both, not just the first.
    awb: "189-33445566",
    gd: "GD-KHI-2026-00095",
    channel: "Yellow",
    cha: "Pak Gulf CHA",
    consignee: "Universal Electronics",
    cargoClass: "Electronics",
    pieces: "35",
    weight: "1,120.0 kg",
    status: "OOC Pending",
    holdStatus: "ANF hold active",
    holds: ["anf"],
    oocNo: "OOC-KHI-2026-00426",
    issuingOfficer: "Deputy Collector — Appraisement",
    keyedBy: "i.ali",
    keyedAt: "31 May 2026 15:40",
    printSource: "OOC print — counter copy (PSW gateway down)",
    sd: {
      sdRef: "PSW-SD-2026-8841262",
      awbNo: "189-33445566",
      channel: "Yellow",
      packages: "35",
      issuedAt: "31 May 2026 15:20",
    },
    print: {
      sdRef: "PSW-SD-2026-8841258",
      awbNo: "189-33445566",
      channel: "Yellow",
      packages: "35",
      issuedAt: "30 May 2026 15:20",
    },
  },
];
