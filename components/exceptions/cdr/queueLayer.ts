/**
 * P3-1 · The CDR queue-management layer.
 *
 * `CDR` in lib/domain models FC-04 completely: nine discrepancy types, six
 * evidence kinds, the §08 dispatch rounds, the §10 instruction loop, the §11
 * final actions and the §12 closure gate. What it does not model is the *work*
 * — who owns the CDR, how urgent it is, and how long it has been sitting.
 * That layer only ever existed on `/warehouse-manager/exceptions-queue`, and
 * without it the workbench can describe a discrepancy in full and still not
 * answer "whose is it and is it late".
 *
 * The sharpest of the three losses is the owner. `CDR.raisedBy` records who
 * *found* it, which is almost never who has to *fix* it, so a CDR nobody has
 * picked up is indistinguishable from one being actively worked. An unowned
 * CDR is invisible, and invisible is how a discrepancy becomes a claim.
 *
 * Two axes, deliberately not merged:
 *
 *   `CdrStatus`     — where the CDR is in FC-04. Drives the stage rail.
 *   `CdrQueueState` — where the CDR is in somebody's day. Drives the queue.
 *
 * A CDR can be at §10 awaiting-instruction (flow) and escalated (queue), or at
 * §10 and unassigned. Collapsing the two would lose exactly the rows worth
 * looking at.
 */

import {
  DAMAGE_DETAILS,
  DEMO_NOW,
  awbById,
  cargoClass,
  cdrEscalations,
  type CDR,
  type CdrOrigin,
  type CdrStatus,
  type DiscrepancyType,
} from "@/lib/domain";

/**
 * The FC-04 position in table-cell length. The full labels the workbench uses
 * on the stage rail run to seven words; a register column that carries both
 * axes needs the section number and one verb, not the sentence.
 */
export const CDR_STAGE_SHORT: Record<CdrStatus, string> = {
  draft: "§01–02 identified",
  evidence: "§03–05 evidenced",
  notified: "§06–08 notified",
  "on-hold": "§09 quarantined",
  "awaiting-instruction": "§10 awaiting",
  "action-selected": "§11 action set",
  closed: "§12 closed",
};

/* ------------------------------------------------------------------ *
 * Priority, owner, queue state
 * ------------------------------------------------------------------ */

export type CdrPriority = "high" | "medium" | "low";

export const CDR_PRIORITY_LABEL: Record<CdrPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

/** Sort weight — high first, which is the only order a queue is read in. */
const PRIORITY_RANK: Record<CdrPriority, number> = { high: 0, medium: 1, low: 2 };

/**
 * Spelled out rather than left as an empty string or a null. "Unassigned" is a
 * value an operator filters *for* — the whole point of the owner column is to
 * find the rows nobody has claimed — and a blank cell is not filterable.
 */
export const CDR_UNASSIGNED = "Unassigned";

export type CdrQueueState = "unassigned" | "assigned" | "escalated" | "resolved" | "closed";

export const CDR_QUEUE_STATE_LABEL: Record<CdrQueueState, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  escalated: "Escalated",
  resolved: "Resolved",
  closed: "Closed",
};

export const CDR_QUEUE_STATES = Object.keys(CDR_QUEUE_STATE_LABEL) as CdrQueueState[];

/**
 * The warehouse queue's own service target, in hours.
 *
 * Worth being clear about what this measures, because the fixtures make it
 * look broken: it is the target for *picking a CDR up and working it*, not for
 * closing it. FC-04 closure runs through an airline instruction loop that
 * takes days by design, so a workbench full of multi-day CDRs breaching a
 * six-hour target is the correct reading, not a bug in the tile.
 */
export const CDR_SLA_HOURS = 6;

/**
 * The window a trend delta compares against.
 *
 * The legacy queue printed "+3 today" as a literal. Day-over-day cannot be
 * computed from this fixture set at all — the newest CDR is two days old, so
 * both sides of a 24h comparison are zero and every tile would read "no
 * change", which says less than nothing. Three days against the three before
 * is the shortest window this data can actually answer, and it is computed
 * rather than typed, so it stays true when the fixtures move.
 */
export const TREND_WINDOW_DAYS = 3;

/* ------------------------------------------------------------------ *
 * The overlay
 * ------------------------------------------------------------------ */

interface QueueAssignment {
  owner: string;
  priority: CdrPriority;
}

/**
 * Keyed on `CDR.id`, which is stable in the fixture set. Anything the overlay
 * does not name falls through to unassigned at medium priority — the truthful
 * default, and the one this screen exists to surface rather than hide.
 */
const QUEUE_ASSIGNMENT: Record<number, QueueAssignment> = {
  1: { owner: "Imran Ali", priority: "high" },
  2: { owner: "Sana Khan", priority: "low" },
  3: { owner: "Ahmed Khan", priority: "high" },
  4: { owner: "Fatima Raza", priority: "high" },
  5: { owner: "Bilal Ahmed", priority: "medium" },
  6: { owner: "Imran Ali", priority: "low" },
  // Deliberately unclaimed: the thin-evidence CDR that the §12 closure gate
  // already refuses. Nobody owns it, which is precisely why it is still thin.
  7: { owner: CDR_UNASSIGNED, priority: "high" },
  8: { owner: "Sana Khan", priority: "medium" },
  9: { owner: "Ahmed Khan", priority: "high" },
};

/**
 * Queue state is derived wherever the canonical record already answers it, and
 * only falls back to the overlay for the assigned/unassigned split. Storing a
 * state the record can contradict is how the two axes come to disagree about
 * the same CDR.
 */
function queueStateOf(c: CDR, owner: string): CdrQueueState {
  if (c.closedAt) return "closed";
  if (c.finalAction) return "resolved";
  if (cdrEscalations(c) > 0) return "escalated";
  return owner === CDR_UNASSIGNED ? "unassigned" : "assigned";
}

/* ------------------------------------------------------------------ *
 * The composed row
 * ------------------------------------------------------------------ */

export interface CdrQueueRow extends CDR {
  owner: string;
  priority: CdrPriority;
  queueState: CdrQueueState;
  /** Hours since §01, against the demo clock. */
  ageHours: number;
  overSla: boolean;
  /**
   * Pieces the discrepancy actually touches. From the intake variance where
   * one raised the CDR, otherwise from the damage register row that names this
   * CDR. Null where neither exists — an honest gap beats a zero that reads as
   * "no pieces affected".
   */
  piecesAffected: number | null;
  cargoClassAbbr: string;
  cargoClassName: string;
  consignee: string;
}

export function buildQueue(cdrs: CDR[], asOf: string = DEMO_NOW): CdrQueueRow[] {
  const now = Date.parse(asOf);

  return cdrs.map((c) => {
    const awb = awbById(c.awbId);
    const klass = awb ? cargoClass(awb.CARGOCLASSID) : null;
    const assignment = QUEUE_ASSIGNMENT[c.id] ?? {
      owner: CDR_UNASSIGNED,
      priority: "medium" as CdrPriority,
    };
    const ageHours = Math.max(0, (now - Date.parse(c.raisedAt)) / 3_600_000);
    const damage = DAMAGE_DETAILS.find((d) => d.cdrRef === c.cdrRef);

    return {
      ...c,
      ...assignment,
      queueState: queueStateOf(c, assignment.owner),
      ageHours,
      overSla: ageHours > CDR_SLA_HOURS,
      piecesAffected: c.variance
        ? Math.abs(c.variance.delta)
        : damage
          ? damage.DamagedPcs
          : null,
      cargoClassAbbr: klass?.ABBREVATION ?? "—",
      cargoClassName: klass?.NAME ?? "—",
      consignee: awb?.CONSIGNEE1 ?? "—",
    };
  });
}

/* ------------------------------------------------------------------ *
 * Age formatting and banding
 * ------------------------------------------------------------------ */

export function formatAge(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  if (hours < 24) return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
  return `${Math.floor(hours / 24)}d ${Math.floor(hours % 24)}h`;
}

/**
 * Bands anchored on the SLA and then widened.
 *
 * The legacy queue banded in hours all the way up (<1h, 1–3h, 3–6h, 6–12h,
 * >12h) because it assumed a CDR was a same-shift problem. FC-04 says
 * otherwise: §10 waits on an airline, and that wait is measured in days. Bands
 * that all collapse into ">12h" are a filter that cannot narrow anything, so
 * the first band is the SLA and the rest follow the instruction loop.
 */
export type AgeBand = "all" | "within-sla" | "6-24h" | "1-3d" | "3-7d" | "over-7d";

export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  all: "Any age",
  "within-sla": `Within SLA (< ${CDR_SLA_HOURS}h)`,
  "6-24h": `${CDR_SLA_HOURS}h – 1 day`,
  "1-3d": "1 – 3 days",
  "3-7d": "3 – 7 days",
  "over-7d": "Over 7 days",
};

export const AGE_BANDS = Object.keys(AGE_BAND_LABEL) as AgeBand[];

function inBand(hours: number, band: AgeBand): boolean {
  switch (band) {
    case "all":
      return true;
    case "within-sla":
      return hours < CDR_SLA_HOURS;
    case "6-24h":
      return hours >= CDR_SLA_HOURS && hours < 24;
    case "1-3d":
      return hours >= 24 && hours < 72;
    case "3-7d":
      return hours >= 72 && hours < 168;
    case "over-7d":
      return hours >= 168;
  }
}

/* ------------------------------------------------------------------ *
 * Filters
 * ------------------------------------------------------------------ */

export interface QueueFilterState {
  /** Free text over CDR ref, AWB, HAWB, owner. */
  search: string;
  /** Quick-filter chips — multi-select, empty means every type. */
  types: DiscrepancyType[];
  owner: string | "all";
  queueState: CdrQueueState | "all";
  ageBand: AgeBand;
  cargoClass: string | "all";
  /**
   * BC-2 — which decision raised the CDR. The reason this is a filter and not
   * just a column: `type` cannot separate the routes, because intake and
   * picking both raise `shortage`. Without it a dispatch-side CDR and an
   * intake-side one are the same row.
   */
  origin: CdrOrigin | "all";
}

export const EMPTY_QUEUE_FILTERS: QueueFilterState = {
  search: "",
  types: [],
  owner: "all",
  queueState: "all",
  ageBand: "all",
  cargoClass: "all",
  origin: "all",
};

export function activeQueueFilterCount(f: QueueFilterState): number {
  return [
    f.search !== "",
    f.types.length > 0,
    f.owner !== "all",
    f.queueState !== "all",
    f.ageBand !== "all",
    f.cargoClass !== "all",
    f.origin !== "all",
  ].filter(Boolean).length;
}

export function filterQueue(rows: CdrQueueRow[], f: QueueFilterState): CdrQueueRow[] {
  const search = f.search.trim().toLowerCase();

  return rows.filter((r) => {
    if (
      search &&
      ![r.cdrRef, r.AWBNO, r.HWBNO ?? "", r.owner].some((v) => v.toLowerCase().includes(search))
    ) {
      return false;
    }
    if (f.types.length > 0 && !f.types.includes(r.type)) return false;
    if (f.owner !== "all" && r.owner !== f.owner) return false;
    if (f.queueState !== "all" && r.queueState !== f.queueState) return false;
    if (f.cargoClass !== "all" && r.cargoClassAbbr !== f.cargoClass) return false;
    if (f.origin !== "all" && r.origin !== f.origin) return false;
    if (!inBand(r.ageHours, f.ageBand)) return false;
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * Sorting
 * ------------------------------------------------------------------ */

export type QueueSortKey =
  | "cdrRef"
  | "AWBNO"
  | "type"
  | "origin"
  | "piecesAffected"
  | "raisedAt"
  | "owner"
  /** FC-04 flow position — the other axis, sortable alongside the queue one. */
  | "status"
  | "queueState"
  | "ageHours"
  | "priority";

export function sortQueue(
  rows: CdrQueueRow[],
  key: QueueSortKey,
  direction: "asc" | "desc",
): CdrQueueRow[] {
  const sign = direction === "asc" ? 1 : -1;

  const value = (r: CdrQueueRow): number | string => {
    switch (key) {
      case "priority":
        return PRIORITY_RANK[r.priority];
      case "ageHours":
        return r.ageHours;
      // A CDR with no known piece count sorts last in either direction rather
      // than colliding with a genuine zero.
      case "piecesAffected":
        return r.piecesAffected ?? Number.POSITIVE_INFINITY;
      case "raisedAt":
        return Date.parse(r.raisedAt);
      default:
        return String(r[key]);
    }
  };

  return [...rows].sort((a, b) => {
    const av = value(a);
    const bv = value(b);
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv)) * sign;
  });
}

/* ------------------------------------------------------------------ *
 * Trend deltas
 * ------------------------------------------------------------------ */

/**
 * How many more (or fewer) matching CDRs were raised in the last
 * `TREND_WINDOW_DAYS` than in the window before it. Computed, never typed.
 */
export function trendDelta(
  rows: CdrQueueRow[],
  match: (r: CdrQueueRow) => boolean,
  asOf: string = DEMO_NOW,
): number {
  const now = Date.parse(asOf);
  const window = TREND_WINDOW_DAYS * 86_400_000;
  let recent = 0;
  let prior = 0;

  for (const r of rows) {
    if (!match(r)) continue;
    const raised = Date.parse(r.raisedAt);
    if (raised > now - window) recent += 1;
    else if (raised > now - 2 * window) prior += 1;
  }

  return recent - prior;
}

export function formatTrend(delta: number): string {
  if (delta === 0) return `No change vs prior ${TREND_WINDOW_DAYS}d`;
  return `${delta > 0 ? "+" : "−"}${Math.abs(delta)} vs prior ${TREND_WINDOW_DAYS}d`;
}
