/**
 * `/exceptions/holds` — the queue layer, merged in from the
 * compliance-side hold register that ran alongside this screen.
 *
 * CMTS `HOLDINGSTATUS` (29 cols) records who placed a hold and who
 * released it, and `HoldRecord` carries all 29 faithfully. What it records
 * nothing about is the work in between: no priority, no functional owner,
 * and a status that is binary — held, or released. So a hold three people
 * have been chasing for a week looks exactly like one nobody has opened.
 *
 * The excise-compliance register carried that missing layer. It lives here
 * rather than in `lib/domain/exceptions.ts` because `HoldRecord` is a
 * *parity* model — every field on it maps to a CMTS column — and none of
 * the fields below has a CMTS ancestor. `HoldView` is `HoldRecord` plus
 * the queue, and the extra members are named in AirVault's own casing so
 * the CMTS columns stay visually distinct from the additions.
 *
 * The one exception is `HoldType`, which *was* widened in the domain
 * (ANF / ASF / internal) — because the type of a hold is a property of the
 * hold itself, not of the queue that works it, and `/customs/channels`
 * already modelled ANF and ASF separately.
 */

import {
  DEMO_NOW,
  awbByNo,
  cargoClass,
  daysBetween,
  listHolds,
  type HoldRecord,
  type HoldType,
  type SiteScope,
} from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * Priority
 * ------------------------------------------------------------------ */

export type HoldPriority = "critical" | "high" | "medium" | "low";

/** Highest first — this is also the sort order of the register. */
export const HOLD_PRIORITY_ORDER: HoldPriority[] = ["critical", "high", "medium", "low"];

export const HOLD_PRIORITY_LABEL: Record<HoldPriority, string> = {
  critical: "Critical",
  high: "High",
  medium: "Medium",
  low: "Low",
};

export const HOLD_PRIORITY_TONE: Record<HoldPriority, { bg: string; fg: string }> = {
  critical: { bg: "#FEE2E2", fg: "#DC2626" },
  high: { bg: "#FFEDD5", fg: "#EA580C" },
  medium: { bg: "#FEF3C7", fg: "#D97706" },
  low: { bg: "#F1F5F9", fg: "#64748B" },
};

/* ------------------------------------------------------------------ *
 * Functional owner
 *
 * Deliberately distinct from `HoldingCompany` / `Designation`, which
 * record who *placed* the hold. Those are attribution; this is the work
 * queue. A customs hold is placed by the Model Customs Collectorate and
 * worked by SAPS Compliance, and a register that only carries the former
 * cannot answer "what is on my desk this morning".
 * ------------------------------------------------------------------ */

export type HoldOwnerQueue = "compliance" | "warehouse" | "operations" | "finance";

export const HOLD_OWNER_ORDER: HoldOwnerQueue[] = [
  "compliance",
  "warehouse",
  "operations",
  "finance",
];

export const HOLD_OWNER_LABEL: Record<HoldOwnerQueue, string> = {
  compliance: "Compliance",
  warehouse: "Warehouse",
  operations: "Operations",
  finance: "Finance",
};

/**
 * Which desk a hold lands on follows from what kind of hold it is, so the
 * owner is derived rather than asked for. The Add Hold drawer can still
 * override it — an ANF hold on damaged cargo may genuinely belong to
 * Warehouse — but the default should never be blank, because an unowned
 * hold is one nobody is chasing.
 */
export const DEFAULT_OWNER_FOR_TYPE: Record<HoldType, HoldOwnerQueue> = {
  customs: "compliance",
  anf: "compliance",
  asf: "operations",
  security: "operations",
  "cdr-osd": "warehouse",
  discrepancy: "warehouse",
  internal: "operations",
  payment: "finance",
};

/* ------------------------------------------------------------------ *
 * Work status
 *
 * CMTS `STATUS` is HELD or RELEASED and nothing else, which is why the
 * canonical register could not distinguish a hold under active review
 * from one that has been sitting untouched since it was placed.
 *
 * `resolved` is the interesting one: it means the underlying reason is
 * gone but the release has not been *recorded*. That hold still blocks
 * the FC-07 release gate, because `isHoldLive()` reads the `Release`
 * column — not this field. The screen calls that out rather than letting
 * a green chip imply the cargo can move.
 * ------------------------------------------------------------------ */

export type HoldWorkStatus = "active" | "under-review" | "escalated" | "resolved" | "released";

export const HOLD_WORK_STATUS_ORDER: HoldWorkStatus[] = [
  "active",
  "under-review",
  "escalated",
  "resolved",
  "released",
];

export const HOLD_WORK_STATUS_LABEL: Record<HoldWorkStatus, string> = {
  active: "Active",
  "under-review": "Under Review",
  escalated: "Escalated",
  resolved: "Resolved",
  released: "Released",
};

export const HOLD_WORK_STATUS_TONE: Record<HoldWorkStatus, { bg: string; fg: string }> = {
  active: { bg: "#FEE2E2", fg: "#DC2626" },
  "under-review": { bg: "#FEF3C7", fg: "#D97706" },
  escalated: { bg: "#DBEAFE", fg: "#1B4F8B" },
  resolved: { bg: "#DCFCE7", fg: "#16A34A" },
  released: { bg: "#DCFCE7", fg: "#16A34A" },
};

/* ------------------------------------------------------------------ *
 * Type presentation
 * ------------------------------------------------------------------ */

/** Every member of the widened union gets a tone — ANF and ASF distinct. */
export const HOLD_TYPE_TONE: Record<HoldType, { bg: string; fg: string }> = {
  customs: { bg: "#DBEAFE", fg: "#1B4F8B" },
  anf: { bg: "#FEF3C7", fg: "#D97706" },
  asf: { bg: "#F3E8FF", fg: "#7C3AED" },
  security: { bg: "#F5F3FF", fg: "#7C3AED" },
  "cdr-osd": { bg: "#FEE2E2", fg: "#DC2626" },
  discrepancy: { bg: "#FFEDD5", fg: "#EA580C" },
  internal: { bg: "#F1F5F9", fg: "#475569" },
  payment: { bg: "#DCFCE7", fg: "#16A34A" },
};

/** Chip order for the type filter / per-type counts. */
export const HOLD_TYPE_ORDER: HoldType[] = [
  "customs",
  "anf",
  "asf",
  "security",
  "cdr-osd",
  "discrepancy",
  "internal",
  "payment",
];

/**
 * The organisation behind each hold type, used to prefill `HeldBy` and
 * `HoldingCompany` on the create path. Typing the agency name by hand is
 * how "ANF", "A.N.F." and "Anti Narcotics" end up as three agencies in
 * the same register.
 */
export const HOLD_AUTHORITY: Record<HoldType, { heldBy: string; company: string }> = {
  customs: { heldBy: "Pakistan Customs", company: "Model Customs Collectorate" },
  anf: { heldBy: "Anti-Narcotics Force", company: "ANF Regional Directorate" },
  asf: { heldBy: "Airport Security Force", company: "ASF Cargo Complex Unit" },
  security: { heldBy: "Security agency", company: "Agency not recorded" },
  "cdr-osd": { heldBy: "SAPS Operations", company: "Shaheen Airport Services" },
  discrepancy: { heldBy: "SAPS Operations", company: "Shaheen Airport Services" },
  internal: { heldBy: "SAPS Operations", company: "Shaheen Airport Services" },
  payment: { heldBy: "SAPS Finance", company: "Shaheen Airport Services" },
};

/* ------------------------------------------------------------------ *
 * The view record
 * ------------------------------------------------------------------ */

export interface HoldView extends HoldRecord {
  /**
   * Business key — `HOLD-<year>-<sequence>`. CMTS keys holds on
   * `SEQUENCE`, an integer nobody can quote down a phone line. The series
   * resets annually, matching how `AutoIncrementValues` scopes every
   * other AirVault document number.
   */
  holdNo: string;
  /**
   * One-line reason for the register column. `REMARKS` is the CMTS
   * narrative field and runs to a paragraph; truncating a paragraph into
   * a table cell is how a register stops being readable, so the short
   * form is carried separately and the full text stays on the detail card.
   */
  reason: string;
  priority: HoldPriority;
  owner: HoldOwnerQueue;
  workStatus: HoldWorkStatus;
  /** Supporting documents on the hold side. */
  documents: string[];
  /** Supporting document on the release side — the counterpart artefact. */
  releaseDocument: string | null;
}

/* ------------------------------------------------------------------ *
 * Derivations
 * ------------------------------------------------------------------ */

export function holdNoFor(h: Pick<HoldRecord, "SEQUENCE" | "Date">): string {
  const year = new Date(h.Date).getFullYear();
  return `HOLD-${year}-${String(h.SEQUENCE).padStart(5, "0")}`;
}

/**
 * Priority is not a CMTS column and is not worth inventing one for — it
 * falls out of two facts already on the record. A hold on cargo that
 * needs special clearance is slower to lift, and a hold on cargo that has
 * already burned its free period is costing the consignee money every
 * day it stands. Cargo that is both is the row the shift should open
 * first.
 */
export function derivePriority(h: HoldRecord): HoldPriority {
  const cls = cargoClass(h.CARGOCLASSID);
  const days = daysBetween(h.Date, h.ReleaseDateTime ?? DEMO_NOW);
  const pastFreePeriod = days > cls.freeDays;

  if (cls.requiresSpecialClearance && pastFreePeriod) return "critical";
  if (pastFreePeriod) return "high";
  if (cls.requiresSpecialClearance) return "medium";
  return "low";
}

/** First clause of `REMARKS` — see the note on `HoldView.reason`. */
export function reasonFrom(remarks: string): string {
  const head = remarks.split(/\s+[—–-]\s+/)[0].trim();
  return head.length > 58 ? `${head.slice(0, 57)}…` : head;
}

/**
 * Age in the register is read at a glance, so a hold placed this morning
 * has to show hours rather than the "0d" that `daysBetween` would give
 * it. Past a day the hours stop mattering and the day count leads.
 */
export function ageLabel(fromIso: string, toIso: string = DEMO_NOW): string {
  const ms = Math.max(0, Date.parse(toIso) - Date.parse(fromIso));
  const totalMinutes = Math.floor(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  if (hours < 24) {
    return hours === 0 ? `${totalMinutes}m` : `${hours}h ${totalMinutes % 60}m`;
  }
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

/** Fixture holds carry no queue fields — this is where they acquire them. */
export function enrich(h: HoldRecord): HoldView {
  return {
    ...h,
    holdNo: holdNoFor(h),
    reason: reasonFrom(h.REMARKS),
    priority: derivePriority(h),
    owner: DEFAULT_OWNER_FOR_TYPE[h.type],
    workStatus: h.Release ? "released" : "active",
    documents: [],
    releaseDocument: null,
  };
}

/* ------------------------------------------------------------------ *
 * Local rows for the hold types the fixtures do not yet carry
 *
 * `lib/domain` seeds exactly two holds — one live customs hold and one
 * released discrepancy hold — because `HOLDINGSTATUS` is derived from the
 * single AWB seed flagged `onHold`. The ANF / ASF / internal split is the
 * whole point of this merge, so those rows are authored here rather than
 * left invisible. They are built off real AWB numbers from the fixture
 * seed table, so the AWB links resolve and the cargo class, IGM and site
 * keys come from the same place every other screen reads them from.
 *
 * When `lib/domain/fixtures.ts` grows agency holds of its own, this block
 * is what gets deleted.
 * ------------------------------------------------------------------ */

interface LocalHoldSpec {
  SEQUENCE: number;
  awbNo: string;
  HWBNo?: string | null;
  type: HoldType;
  reason: string;
  REMARKS: string;
  NameOfPerson: string;
  NIC: string;
  Designation: string;
  /** Hours before `DEMO_NOW` the hold was placed. */
  placedHoursAgo: number;
  owner?: HoldOwnerQueue;
  priority?: HoldPriority;
  workStatus?: HoldWorkStatus;
  documents?: string[];
  CreatedBy: string;
}

/** Loud rather than silent: a renamed AWB seed should not become a dead link. */
function requireAwb(awbNo: string) {
  const a = awbByNo(awbNo);
  if (!a) throw new Error(`Hold register seed references an unknown AWB: ${awbNo}`);
  return a;
}

function hoursBefore(hours: number): string {
  return new Date(Date.parse(DEMO_NOW) - hours * 3_600_000).toISOString();
}

function materialise(s: LocalHoldSpec): HoldView {
  const awb = requireAwb(s.awbNo);
  const authority = HOLD_AUTHORITY[s.type];
  const placedAt = hoursBefore(s.placedHoursAgo);
  const base: HoldRecord = {
    // Audit columns — the six that appear on ~60 CMTS tables.
    CreatedBy: s.CreatedBy,
    UpdatedBy: null,
    CreatedDate: placedAt,
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
    // Site keys, taken from the AWB so the site selector filters correctly.
    CityId: awb.CityId,
    Comp_Code: awb.Comp_Code,
    Off_Code: awb.Off_Code,

    SEQUENCE: s.SEQUENCE,
    AWBNo: awb.AWBNO,
    IGMNO: awb.IGMNO,
    HWBNo: s.HWBNo ?? null,
    CARGOCLASSID: awb.CARGOCLASSID,
    STATUS: "HELD",
    type: s.type,

    HeldBy: authority.heldBy,
    NameOfPerson: s.NameOfPerson,
    NIC: s.NIC,
    HoldingCompany: authority.company,
    Designation: s.Designation,
    Date: placedAt,
    REMARKS: s.REMARKS,

    Release: false,
    ReleasePersonName: null,
    ReleaseCompany: null,
    ReleaseBy: null,
    ReleasePersonDesignation: null,
    ReleasePersonNic: null,
    ReleaseRemarks: null,
    ReleaseDateTime: null,

    site: awb.site,
  };

  return {
    ...base,
    holdNo: holdNoFor(base),
    reason: s.reason,
    priority: s.priority ?? derivePriority(base),
    owner: s.owner ?? DEFAULT_OWNER_FOR_TYPE[s.type],
    workStatus: s.workStatus ?? "active",
    documents: s.documents ?? [],
    releaseDocument: null,
  };
}

const LOCAL_HOLD_SPECS: LocalHoldSpec[] = [
  {
    SEQUENCE: 112,
    awbNo: "125-40028811",
    HWBNo: "HAWB-7781",
    type: "anf",
    reason: "Precursor screening — clearance reference pending",
    REMARKS:
      "ANF precursor screening on a pharmaceutical consignment — consignment held pending an ANF clearance reference. Only ANF can lift this; SAPS Compliance is chasing the reference.",
    NameOfPerson: "Insp. K. Shah",
    NIC: "42101-3345567-1",
    Designation: "Inspector",
    placedHoursAgo: 19,
    workStatus: "under-review",
    documents: ["anf-screening-request.pdf"],
    CreatedBy: "i.ali",
  },
  {
    SEQUENCE: 113,
    awbNo: "607-11902288",
    type: "anf",
    reason: "NOC clearance required",
    REMARKS:
      "ANF NOC required before release. Consignment profile matched a watch item on the ANF list; NOC requested and acknowledged, awaiting issue.",
    NameOfPerson: "Insp. R. Baig",
    NIC: "35202-7781203-4",
    Designation: "Inspector",
    placedHoursAgo: 63,
    workStatus: "escalated",
    documents: ["anf-noc-request.pdf", "watchlist-match.pdf"],
    CreatedBy: "t.ahmed",
  },
  {
    SEQUENCE: 114,
    awbNo: "176-10293847",
    HWBNo: "HAWB-3310",
    type: "asf",
    reason: "Security screening pending",
    REMARKS:
      "ASF secondary screening on vulnerable cargo. Held at the screening point pending a second-pass X-ray and an ASF release endorsement.",
    NameOfPerson: "Sgt. B. Nawaz",
    NIC: "42201-9987654-3",
    Designation: "Sergeant",
    placedHoursAgo: 4,
    documents: ["asf-screening-log.pdf"],
    CreatedBy: "s.khan",
  },
  {
    SEQUENCE: 115,
    awbNo: "306-40077665",
    type: "asf",
    reason: "Tamper indication at screening point",
    REMARKS:
      "ASF flagged a tamper indication on two pieces at the screening point. Cargo held for joint inspection with SAPS Operations before any onward movement.",
    NameOfPerson: "Sgt. H. Yousaf",
    NIC: "17301-2244668-7",
    Designation: "Sergeant",
    placedHoursAgo: 31,
    workStatus: "escalated",
    priority: "critical",
    documents: ["asf-tamper-report.pdf"],
    CreatedBy: "a.khan",
  },
  {
    SEQUENCE: 116,
    awbNo: "125-66710244",
    type: "internal",
    reason: "Strongroom reconciliation",
    REMARKS:
      "SAPS-raised hold. Valuable cargo pulled from issue pending a strongroom count against the intake record. No external agency is involved — Operations can lift this once the count reconciles.",
    NameOfPerson: "F. Qureshi",
    NIC: "42101-9988776-3",
    Designation: "Operations Supervisor",
    placedHoursAgo: 8,
    workStatus: "under-review",
    documents: ["strongroom-count-sheet.pdf"],
    CreatedBy: "f.qureshi",
  },
  {
    SEQUENCE: 117,
    awbNo: "157-33448821",
    type: "payment",
    reason: "Duty payment confirmation outstanding",
    REMARKS:
      "Held at the FC-07 release gate — duty and storage charges assessed but no payment confirmation received against the invoice.",
    NameOfPerson: "M. Siddiqui",
    NIC: "42101-4455661-2",
    Designation: "Finance Officer",
    placedHoursAgo: 27,
    workStatus: "resolved",
    documents: [],
    CreatedBy: "m.siddiqui",
  },
  {
    SEQUENCE: 118,
    awbNo: "214-66778899",
    type: "security",
    reason: "Security hold — agency not recorded",
    REMARKS:
      "Migrated from CMTS. The legacy row recorded a security hold without naming the agency, so it cannot be attributed to ANF or ASF without inventing the attribution. Left as-is deliberately; the next release note should name the agency.",
    NameOfPerson: "Not recorded",
    NIC: "00000-0000000-0",
    Designation: "Not recorded",
    placedHoursAgo: 214,
    priority: "high",
    CreatedBy: "cmts.migration",
  },
];

const LOCAL_HOLDS: HoldView[] = LOCAL_HOLD_SPECS.map(materialise);

/* ------------------------------------------------------------------ *
 * The register
 * ------------------------------------------------------------------ */

/**
 * Fixture holds first-class, local agency rows alongside them, newest
 * first. Site scoping runs over both — a hold belongs to the site whose
 * cargo it stops.
 */
export function buildHoldRegister(scope: SiteScope): HoldView[] {
  const fixtures = listHolds(scope).map(enrich);
  const local = LOCAL_HOLDS.filter((h) => scope === "HQ" || h.site === scope);
  return [...fixtures, ...local].sort((a, b) => Date.parse(b.Date) - Date.parse(a.Date));
}

/* ------------------------------------------------------------------ *
 * Drawer payloads
 * ------------------------------------------------------------------ */

/** What the Add Hold drawer hands back. */
export interface NewHoldDraft {
  AWBNo: string;
  HWBNo: string;
  type: HoldType;
  reason: string;
  /** Becomes `REMARKS`. */
  description: string;
  owner: HoldOwnerQueue;
  priority: HoldPriority;
  HeldBy: string;
  NameOfPerson: string;
  NIC: string;
  Designation: string;
  documents: string[];
  notes: string;
}

/**
 * What the Release Hold drawer hands back — six of the seven CMTS release
 * columns. `ReleaseDateTime` is stamped by the screen from `DEMO_NOW`
 * rather than typed, because a release time an operator can edit is not
 * an audit trail.
 */
export interface ReleaseDraft {
  ReleasePersonName: string;
  ReleaseCompany: string;
  ReleaseBy: string;
  ReleasePersonDesignation: string;
  ReleasePersonNic: string;
  ReleaseRemarks: string;
  releaseDocument: string | null;
}

/** CMTS NIC shape — five, seven, one. Both parties are keyed on it. */
export const NIC_PATTERN = /^\d{5}-\d{7}-\d$/;
