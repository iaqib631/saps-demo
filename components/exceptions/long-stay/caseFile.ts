/**
 * P3-6 · The long-stay case-management layer.
 *
 * `LongStayCase` in lib/domain is the *statutory* record — the dwell clock,
 * the auto-scheduled notices with their due dates, the AWBSECTION82 columns,
 * the auction and disposal field sets. It is deliberately silent about who is
 * working the case, because CMTS has no column for it. That silence is what
 * the legacy compliance register carried and the canonical screen lost: a
 * register with no owner, no case number and no filters is a list, not a
 * working surface.
 *
 * Three facts live here rather than in lib/domain, because they are workbench
 * facts rather than statutory ones:
 *
 *   • Case #          — the business key an officer quotes on the phone. The
 *                       statutory record is keyed on AWBNO + SEQUENCE, which
 *                       is an AWB identity, not a case identity.
 *   • Owner           — the functional queue that has to act. Distinct from
 *                       `Examiner` (customs' own officer, on the AWBSECTION82
 *                       record) and from the audit `CreatedBy` (whoever typed
 *                       the row).
 *   • Customs decision — see `CustomsDecision` below. The most important of
 *                       the three.
 *
 * Everything else the register needs is *derived* from the canonical record
 * and the AWB behind it, so a new fixture case appears with a consignee, a
 * piece count and a free-period expiry without anyone editing this file.
 */

import {
  MS_PER_DAY,
  awbById,
  cargoClass,
  type Disposition,
  type LongStayCase,
  type LongStayStage,
} from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * Customs decision — a field, not a stage
 * ------------------------------------------------------------------ */

/**
 * What customs ruled, recorded in its own right.
 *
 * The canonical stage rail runs C4-escalated-customs → C5-section-82 →
 * C6-disposition-recorded, which quietly assumes that the moment customs
 * rules, the terminal has already recorded the outcome. In practice those are
 * two events, days apart, belonging to two different actors: customs approves
 * an auction; the auction happens later, if at all.
 *
 * Without this field a case sits at C4 looking untouched, and "customs decided
 * X but the final disposition has not been recorded yet" — the single most
 * common state on a live long-stay register — cannot be expressed at all.
 *
 * The vocabulary is deliberately *not* `Disposition`'s. "Release approved" is
 * a permission granted; "release after clearance" is an event that happened.
 */
export type CustomsDecision = "pending" | "release-approved" | "auction" | "disposal";

export const CUSTOMS_DECISION_LABEL: Record<CustomsDecision, string> = {
  pending: "Pending",
  "release-approved": "Release approved",
  auction: "Auction",
  disposal: "Disposal",
};

export const CUSTOMS_DECISIONS = Object.keys(CUSTOMS_DECISION_LABEL) as CustomsDecision[];

/**
 * The decision a recorded disposition implies, used only as a fallback for a
 * case the overlay below says nothing about. A disposition cannot exist
 * without a decision behind it, so inferring backwards is safe; inferring
 * forwards is exactly what this field exists to prevent.
 */
const DECISION_FROM_DISPOSITION: Record<Disposition, CustomsDecision> = {
  "release-after-clearance": "release-approved",
  auction: "auction",
  "disposal-destruction": "disposal",
};

/* ------------------------------------------------------------------ *
 * Notice status — the case-level roll-up
 * ------------------------------------------------------------------ */

/**
 * One word for the notice trail, for the register column.
 *
 * `StatutoryNotice.status` is per notice (scheduled / sent / overdue) and the
 * canonical screen renders all three rows, which is right on a detail card and
 * useless in a table cell. "Final notice" is the addition the canonical
 * vocabulary cannot express: the notice due on the statutory deadline itself
 * (`dueOffsetDays === 0`) is legally different from the two that precede it —
 * it is the last one served before the cargo becomes disposable — and a status
 * set of sent/overdue flattens that distinction away.
 */
export type NoticeStatus = "not-notified" | "notice-sent" | "escalated" | "final-notice";

export const NOTICE_STATUS_LABEL: Record<NoticeStatus, string> = {
  "not-notified": "Not notified",
  "notice-sent": "Notice sent",
  escalated: "Escalated",
  "final-notice": "Final notice",
};

export const NOTICE_STATUSES = Object.keys(NOTICE_STATUS_LABEL) as NoticeStatus[];

/**
 * Strongest state wins: a served final notice outranks an escalation, because
 * escalating to customs is a step the terminal takes and serving the final
 * notice is a statutory milestone the case cannot go back behind.
 */
function noticeStatusOf(c: LongStayCase): NoticeStatus {
  const finalNoticeServed = c.notices.some((n) => n.dueOffsetDays === 0 && n.sentAt !== null);
  if (finalNoticeServed) return "final-notice";
  if (c.escalatedToCustomsAt) return "escalated";
  if (c.notices.some((n) => n.sentAt !== null)) return "notice-sent";
  return "not-notified";
}

/* ------------------------------------------------------------------ *
 * Owner — the functional queue
 * ------------------------------------------------------------------ */

/**
 * Who has to act, as a queue rather than a person. A named individual goes
 * stale the week they change desk; the queue is what an escalation is actually
 * routed to, and it is what the legacy register filtered on.
 */
export type LongStayOwner = "Compliance" | "Warehouse" | "Operations" | "Finance";

export const LONGSTAY_OWNERS: LongStayOwner[] = [
  "Compliance",
  "Warehouse",
  "Operations",
  "Finance",
];

/* ------------------------------------------------------------------ *
 * The overlay
 * ------------------------------------------------------------------ */

interface CaseManagementFacts {
  caseNo: string;
  owner: LongStayOwner;
  customsDecision: CustomsDecision;
}

/**
 * Keyed on `LongStayCase.id`, which is stable in the fixture set. A case the
 * overlay does not name still renders — it falls back to a derived case number,
 * the Compliance queue, and whatever decision its disposition implies — so the
 * register never silently drops a statutory record just because nobody has
 * assigned it yet.
 *
 * Case 1 is deliberately set to `auction` while its `disposition` is still
 * null. That is not an inconsistency, it is the demonstration: customs ruled,
 * the auction has not been held, and the canonical stage rail is stuck at C4
 * because C6 needs a disposition it does not have.
 */
const CASE_MANAGEMENT: Record<number, CaseManagementFacts> = {
  1: { caseNo: "LS-KHI-2026-00451", owner: "Compliance", customsDecision: "auction" },
};

/* ------------------------------------------------------------------ *
 * The composed row
 * ------------------------------------------------------------------ */

export interface LongStayCaseFile extends LongStayCase {
  /** Business key — `LS-<site>-<year>-<seq>`. */
  caseNo: string;
  owner: LongStayOwner;
  customsDecision: CustomsDecision;

  // Derived from the AWB behind the case
  consignee: string;
  cargoClassAbbr: string;
  cargoClassName: string;
  /** FC-07 §03 free days for this class — what the dwell badge tones against. */
  freeDays: number;
  pieces: number;
  weightKg: number;

  /**
   * FC-07 §03 — the free period runs from cargo intake, never from flight
   * arrival, so this is `intakeAt + freeDays` and not `arrivedAt + freeDays`.
   * Null where the AWB behind the case is not in scope.
   */
  freePeriodExpiryAt: string | null;
  /** Same instant as `escalatedToCustomsAt`, named as the register names it. */
  escalationDate: string | null;
  noticeStatus: NoticeStatus;
}

export function buildCaseFiles(cases: LongStayCase[]): LongStayCaseFile[] {
  return cases.map((c) => {
    const awb = awbById(c.awbId);
    const klass = awb ? cargoClass(awb.CARGOCLASSID) : null;
    const managed: CaseManagementFacts = CASE_MANAGEMENT[c.id] ?? {
      caseNo: `LS-${c.site}-2026-${String(450 + c.id).padStart(5, "0")}`,
      owner: "Compliance",
      customsDecision: c.disposition ? DECISION_FROM_DISPOSITION[c.disposition] : "pending",
    };

    return {
      ...c,
      ...managed,
      consignee: awb?.CONSIGNEE1 ?? "—",
      cargoClassAbbr: klass?.ABBREVATION ?? "—",
      cargoClassName: klass?.NAME ?? "—",
      freeDays: klass?.freeDays ?? 0,
      pieces: awb?.TOTALPCS ?? 0,
      weightKg: awb?.TOTALWEIGHT ?? 0,
      freePeriodExpiryAt:
        awb && klass
          ? new Date(Date.parse(awb.intakeAt) + klass.freeDays * MS_PER_DAY).toISOString()
          : null,
      escalationDate: c.escalatedToCustomsAt,
      noticeStatus: noticeStatusOf(c),
    };
  });
}

/**
 * True where customs has ruled but the outcome has not been recorded — the
 * state the whole `customsDecision` field exists to make visible.
 */
export function decisionAheadOfDisposition(c: LongStayCaseFile): boolean {
  return c.customsDecision !== "pending" && c.disposition === null;
}

/* ------------------------------------------------------------------ *
 * Filters
 *
 * The canonical screen has none at all, which is defensible on a one-case
 * fixture set and indefensible on a real register where a compliance officer
 * works one consignee, one cargo class or one decision at a time.
 * ------------------------------------------------------------------ */

export interface CaseFilterState {
  /** Free text over case #, AWB, HAWB. */
  search: string;
  consignee: string;
  /** Minimum days in storage, as typed — empty string means no floor. */
  minDwellDays: string;
  cargoClass: string;
  noticeStatus: NoticeStatus | "all";
  stage: LongStayStage | "all";
  customsDecision: CustomsDecision | "all";
}

export const EMPTY_CASE_FILTERS: CaseFilterState = {
  search: "",
  consignee: "",
  minDwellDays: "",
  cargoClass: "",
  noticeStatus: "all",
  stage: "all",
  customsDecision: "all",
};

export function activeCaseFilterCount(f: CaseFilterState): number {
  return [
    f.search !== "",
    f.consignee !== "",
    f.minDwellDays !== "",
    f.cargoClass !== "",
    f.noticeStatus !== "all",
    f.stage !== "all",
    f.customsDecision !== "all",
  ].filter(Boolean).length;
}

export function filterCases(rows: LongStayCaseFile[], f: CaseFilterState): LongStayCaseFile[] {
  const search = f.search.trim().toLowerCase();
  const consignee = f.consignee.trim().toLowerCase();
  const klass = f.cargoClass.trim().toLowerCase();
  // An unparseable floor is treated as no floor rather than as zero, so a
  // half-typed "1" in the box does not silently empty the register.
  const minDays = Number.parseInt(f.minDwellDays, 10);

  return rows.filter((r) => {
    if (
      search &&
      ![r.caseNo, r.AWBNO, r.HWBNo ?? ""].some((v) => v.toLowerCase().includes(search))
    ) {
      return false;
    }
    if (consignee && !r.consignee.toLowerCase().includes(consignee)) return false;
    if (klass && !`${r.cargoClassAbbr} ${r.cargoClassName}`.toLowerCase().includes(klass)) {
      return false;
    }
    if (!Number.isNaN(minDays) && r.ageDays < minDays) return false;
    if (f.noticeStatus !== "all" && r.noticeStatus !== f.noticeStatus) return false;
    if (f.stage !== "all" && r.stage !== f.stage) return false;
    if (f.customsDecision !== "all" && r.customsDecision !== f.customsDecision) return false;
    return true;
  });
}
