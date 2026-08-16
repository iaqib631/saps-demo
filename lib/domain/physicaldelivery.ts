/**
 * AirVault domain — CMTS `PHYSICALDELIVERY` (22) and `DELIVERYINFO` (20).
 *
 * THE RECORD OF CARGO PHYSICALLY HANDED OVER
 * ------------------------------------------
 * `PHYSICALDELIVERY` is the counter's own ledger row: one voucher per
 * consignment collected, naming the paperwork the handover was booked against
 * and carrying the `DELIVERED` bit. `DELIVERYINFO` is the contact sheet keyed
 * beside it — who took the cargo, who shipped it, who cleared it.
 *
 * WHERE IT SITS — FC-08
 * ---------------------
 *   §04  gate pass generated            /dispatch/gate-pass
 *   §11  gate-out verification           /dispatch/gate-out   ← the boundary
 *   §12  POD captured                    /dispatch/gate-out   ← the evidence
 *   §14  AWB marked delivered            **this record**      ← the ledger
 *   §16  file closed                     /dispatch/closure
 *
 * Gate-out asks "may this vehicle leave"; the POD is the receiver's signed
 * evidence that it did. This table is neither. It is the terminal's book
 * entry that the consignment left, booked to a date, against a voucher, with
 * the settlement receipts named. That is why it survives as a separate table
 * rather than as three more columns on `GATEPASS`: the gate event, the
 * evidence and the book entry are written by three different people at three
 * different moments, and CMTS lets all three disagree.
 *
 * NOTHING IS REDECLARED HERE
 * --------------------------
 * `PhysicalDelivery` and `DeliveryInfo` are already declared, correctly and in
 * full, in `lib/domain/dispatch.ts`. Both are imported as types. What was
 * missing was never the modelling:
 *
 *   • `PhysicalDelivery` had no fixture row and no screen.
 *   • `DeliveryInfo` had no fixture row and ZERO owners — a column-name scan
 *     reports it as 11/20 rendered, but every one of those 11 is a collision
 *     with a DIFFERENT table's `AWBNO` / `CONSIGNEENAME` on a different
 *     screen. `AWBARRIVALADVICE` carries its own `ConsigneeName` /
 *     `ConsigneeAdd`; `/import/arrival-advice` renders those, not these. Real
 *     coverage was 0/20.
 *
 * So this module supplies the fixtures, the derivations the screen needs, and
 * the queries. Declaring a second `PhysicalDelivery` beside the first would
 * split one legacy table across two TypeScript types and guarantee that
 * whichever one a screen failed to read went silently blank.
 *
 * OUT OF SCOPE — the surrogate keys
 * ---------------------------------
 * `PHYSICALDELIVERYID`, `DeliveryInfo.DevId`, `AWBId`, `CargoClassId` and
 * `CityId` are keys. They are populated so the records type-check and join,
 * and they are NOT rendered as parity fields: there is no backend for them to
 * key, so a screen showing `DevId: 3` shows nothing a reader can act on. The
 * ticket's column scan lists `DevId` among the never-rendered contact fields;
 * it is a key, so it stays out. Eight contact columns get their first home
 * here, not nine — `ShipName`, `ShipAdd`, `ShipPhone`, `ShipEid`,
 * `ConsigneeEid`, `ConsgneePhone`, `AgentPhone` and `AgentEid`.
 *
 * The audit six ARE modelled — `PhysicalDelivery extends DomainRecord`, so
 * they arrive from `AuditColumns` in `common.ts`. Note the one naming
 * difference held deliberately: CMTS spells them `CreatedOn` / `UpdatedOn` on
 * this table and `CreatedDate` / `UpdatedDate` on most others, and
 * `AuditColumns` standardises on the majority spelling. Adding a `CreatedOn`
 * twin beside `CreatedDate` would split one column across two fields, which is
 * exactly what rule 3 forbids, so `AuditStrip` renders the shared six and the
 * spelling difference is recorded here instead.
 *
 * `DELIVERYINFO` HAS NO AUDIT COLUMNS AND NO SITE
 * -----------------------------------------------
 * Not an omission in the interface — the legacy table genuinely carries
 * neither. The contact block a delivery dispute would be argued from cannot
 * say who keyed it or when, and it has no `Comp_Code` / `Off_Code`; only a
 * `CityId`. Scoping therefore runs through the parent AWB, the same way
 * `grCharges` scopes. Both facts are surfaced on the screen rather than
 * papered over.
 *
 * IMPORT NOTE
 * -----------
 * Deliberately NOT re-exported from `lib/domain/index.ts`. Several tickets are
 * landing domain files in the same window and the barrel is a shared-conflict
 * file, so the one screen that reads this imports `@/lib/domain/physicaldelivery`
 * directly. Fold it into the barrel once they land together.
 */

import { DEMO_NOW, MS_PER_DAY, type SiteCode, type SiteScope } from "./common";
import { PARTIES, SITES, cargoClass } from "./masters";
import { hasReached } from "./cargo";
import { AWBS, GATE_PASSES, GODOWN_RENTS, PODS, awbByNo } from "./fixtures";
import type { DeliveryInfo, PhysicalDelivery } from "./dispatch";

/* ================================================================== *
 * Deterministic date construction
 *
 * Every timestamp below is built from `DEMO_NOW` with an explicit +05:00
 * offset written into the string. `new Date().setHours()` — the older helper
 * in fixtures.ts — reads the RUNNER's timezone, so the same fixture renders a
 * different day for a reviewer in another zone. These do not move.
 * ================================================================== */

const NOW_MS = Date.parse(DEMO_NOW);

/** Pakistan Standard Time. Fixed; the country does not observe DST. */
const PKT = "+05:00";
const PKT_OFFSET_MS = 5 * 60 * 60 * 1000;

/** `YYYY-MM-DD` for the day `n` days before `DEMO_NOW`, read in PKT. */
function pktDay(n: number): string {
  return new Date(NOW_MS - n * MS_PER_DAY + PKT_OFFSET_MS).toISOString().slice(0, 10);
}

/** Move a `YYYY-MM-DD` forward (or, negative, back) by whole days. */
function shiftDay(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Compose a day and an `HH:MM:SS` into one PKT instant. */
function stamp(day: string, time: string): string {
  return `${day}T${time}${PKT}`;
}

/* ================================================================== *
 * The three temporal columns — what the distinction actually is
 * ================================================================== */

/**
 * `DELIVERYDATE`, `DATE` and `TIME` are three columns doing three jobs, and
 * collapsing them into one timestamp destroys the only thing they can prove
 * together. Worked out from the column set itself:
 *
 *   DELIVERYDATE  datetime   the date the delivery is BOOKED TO — the
 *                            effective date the voucher carries, the date the
 *                            storage clock is stopped at, the date finance
 *                            reconciles against.
 *   DATE          datetime   the date the record was WRITTEN at the counter.
 *   TIME          time       the clock time it was written. A separate column,
 *                            not part of `DATE`.
 *
 * `DATE` being `datetime` while `TIME` is `time` is the giveaway: if `DATE`
 * held the instant, `TIME` would be redundant. It does not — `DATE` is a date
 * wearing a datetime type, which is why nearly every row carries midnight in
 * its time half, and the clock lives in `TIME`. The pair exists because the
 * legacy form had a date box and a time box, keyed independently.
 *
 * The consequence is the thing worth putting on a screen: `DELIVERYDATE` and
 * `DATE` can differ, and nothing in CMTS constrains them. A voucher booked two
 * days before the record was written is a back-dated delivery — which may be
 * perfectly legitimate (the cargo left on Friday, the clerk keyed it on
 * Monday) or may be a charge stopped early. Presented as one timestamp, that
 * difference is unrecoverable.
 */
export interface ClockNote {
  tone: "fault" | "info";
  text: string;
}

export interface DeliveryClock {
  /** `DELIVERYDATE`, date half — the day the delivery is booked to. */
  effectiveDay: string;
  /** `DATE`, date half — the day the record was written. */
  recordedDay: string;
  /** `TIME`, as stored. */
  recordedTime: string;
  /** The time-of-day sitting inside the `DATE` datetime. Usually midnight. */
  dateColumnTimeOfDay: string;
  /** `DATE`'s day + `TIME` — the instant the counter keyed the record. */
  keyedAt: string;
  /** `DELIVERYDATE` − `DATE`, whole days. Negative = booked to an earlier day. */
  bookedOffsetDays: number;
  /** `DATE` carries midnight, i.e. its time half is unused and `TIME` is the clock. */
  dateIsDateOnly: boolean;
  /** `TIME` agrees with the clock sitting inside `DATE`. Vacuous when midnight. */
  timeAgreesWithDate: boolean;
  notes: ClockNote[];
}

const dayOf = (iso: string) => iso.slice(0, 10);
const timeOf = (iso: string) => iso.slice(11, 19);

function dayDelta(fromDay: string, toDay: string): number {
  return Math.round(
    (Date.parse(`${toDay}T00:00:00Z`) - Date.parse(`${fromDay}T00:00:00Z`)) / MS_PER_DAY,
  );
}

export function deliveryClock(pd: PhysicalDelivery): DeliveryClock {
  const effectiveDay = dayOf(pd.DELIVERYDATE);
  const recordedDay = dayOf(pd.DATE);
  const dateColumnTimeOfDay = timeOf(pd.DATE);
  const dateIsDateOnly = dateColumnTimeOfDay === "00:00:00";
  const bookedOffsetDays = dayDelta(recordedDay, effectiveDay);
  const timeAgreesWithDate = dateIsDateOnly || dateColumnTimeOfDay === pd.TIME;

  const notes: ClockNote[] = [];

  if (dateIsDateOnly) {
    notes.push({
      tone: "info",
      text: "DATE carries midnight. The column is typed datetime but only its date half is used — the clock is in TIME, which is why the two are separate columns rather than one.",
    });
  } else if (!timeAgreesWithDate) {
    notes.push({
      tone: "fault",
      text: `Two clocks in one record: DATE carries ${dateColumnTimeOfDay} in its time half while TIME says ${pd.TIME}. The legacy form keyed the date box and the time box independently and nothing reconciles them, so the handover has no single defensible timestamp.`,
    });
  }

  if (bookedOffsetDays < 0) {
    notes.push({
      tone: "fault",
      text: `Back-dated by ${Math.abs(bookedOffsetDays)} day(s) — DELIVERYDATE is booked to ${effectiveDay} on a record written ${recordedDay}. Legitimate when the cargo left before the clerk keyed it; it also stops the storage clock ${Math.abs(bookedOffsetDays)} day(s) early, and CMTS has no constraint that distinguishes the two.`,
    });
  } else if (bookedOffsetDays > 0) {
    notes.push({
      tone: pd.DELIVERED ? "fault" : "info",
      text: pd.DELIVERED
        ? `DELIVERED is set while DELIVERYDATE is booked ${bookedOffsetDays} day(s) AFTER the record was written. A completed handover cannot take effect in the future.`
        : `Booked forward ${bookedOffsetDays} day(s) — the voucher was cut at the counter against a collection scheduled for ${effectiveDay}. DELIVERED is still 0, which is consistent.`,
    });
  }

  if (!pd.DELIVERED) {
    notes.push({
      tone: "info",
      text: "DELIVERED = 0 with all three date columns populated. Nothing in the schema ties the flag to the dates, so a delivery date and a delivery time on an undelivered record is a legal row — the flag is the only statement that the cargo actually moved.",
    });
  }

  return {
    effectiveDay,
    recordedDay,
    recordedTime: pd.TIME,
    dateColumnTimeOfDay,
    keyedAt: stamp(recordedDay, pd.TIME),
    bookedOffsetDays,
    dateIsDateOnly,
    timeAgreesWithDate,
    notes,
  };
}

/* ================================================================== *
 * DFLAG — deliberately unresolved
 * ================================================================== */

/**
 * `PHYSICALDELIVERY.DFLAG varchar(1)`. There is no data-dictionary entry, no
 * CHECK constraint and no lookup table behind it, so this module does not
 * assign it a meaning and the screen does not decorate it. It is rendered as
 * the raw character, with the observed values listed and the question left
 * open — a guessed label on a release-side flag is worse than a blank one,
 * because the next reader inherits the guess as fact.
 *
 * Two things ARE known and are worth carrying:
 *
 *   • `IMPORTAWB.DFLAG` is a `bit`. This one is `varchar(1)`. Same name, two
 *     types, two tables — they are not the same flag and must not be mapped
 *     onto one another during migration.
 *   • At least one legacy row holds a single SPACE rather than NULL, so any
 *     migration predicate written as `DFLAG IS NULL` misses it.
 */
export const DFLAG_STATUS = "unresolved" as const;

export const DFLAG_QUESTION =
  "DFLAG is a single-character flag with no documented meaning. No dictionary entry, no CHECK constraint, no lookup table. Blocked on SAPS — until they answer, it is carried verbatim and interpreted nowhere.";

export interface DflagObservation {
  /** The stored value, exactly as held. `null` is a distinct observation. */
  value: string | null;
  /** How the value is displayed when it is not printable. */
  display: string;
  count: number;
  vouchers: string[];
}

export function observedDflags(rows: PhysicalDelivery[]): DflagObservation[] {
  const byValue = new Map<string, DflagObservation>();
  for (const r of rows) {
    // DFLAG is varchar(1) in CMTS, so a multi-character sentinel cannot collide
    // with a real value. (The original write here emitted a raw NUL byte -
    // interrupted-write corruption, not authorship.)
    const key = r.DFLAG === null ? "(null)" : r.DFLAG;
    const existing = byValue.get(key);
    if (existing) {
      existing.count += 1;
      existing.vouchers.push(r.VOUCHERNO);
      continue;
    }
    byValue.set(key, {
      value: r.DFLAG,
      display:
        r.DFLAG === null ? "null" : r.DFLAG.trim() === "" ? "' ' (single space)" : r.DFLAG,
      count: 1,
      vouchers: [r.VOUCHERNO],
    });
  }
  // Sorted by the display string so the list is stable across renders.
  return [...byValue.values()].sort((a, b) => a.display.localeCompare(b.display));
}

/* ================================================================== *
 * "Delivered" is asserted in four places
 * ================================================================== */

/**
 * The roll-up on this table is not a money total, it is a BIT — and its parts
 * are three other columns in two other tables plus the AirVault POD. Showing
 * the arithmetic here means showing the four sources side by side, because
 * CMTS has no trigger, no view and no constraint keeping them in step:
 *
 *   PHYSICALDELIVERY.DELIVERED   bit   this record
 *   IMPORTAWB.DELIVERED          bit   the AWB's own copy
 *   GATEPASS.DeliveryDate        date  set/null is a third assertion
 *   AirVault POD                 —     CMTS has no POD table; the flow holds
 *                                      it loosely across GATEPASS.RcvngPersonPic
 *                                      and AWBDELEIVERYORDER.RECIEVEDBY
 *
 * No majority vote is taken. Four sources that disagree are four sources that
 * disagree, and picking a winner on screen would manufacture a fact the data
 * does not hold.
 */
export interface DeliveryAssertion {
  source: string;
  /** The legacy column, or `null` where the source is an AirVault addition. */
  cmts: string | null;
  delivered: boolean;
  detail: string;
}

export interface DeliveredVerdict {
  assertions: DeliveryAssertion[];
  agreed: boolean;
  /** How many of the four say delivered. Reported, never voted on. */
  sayingDelivered: number;
  conflict: string | null;
}

export function deliveredVerdict(pd: PhysicalDelivery): DeliveredVerdict {
  const awb = awbByNo(pd.AWBNO);
  const gp = GATE_PASSES.find((g) => g.AWBNO === pd.AWBNO);
  const pod = PODS.find((p) => p.AWBNO === pd.AWBNO);

  const assertions: DeliveryAssertion[] = [
    {
      source: "Physical delivery record",
      cmts: "PHYSICALDELIVERY.DELIVERED",
      delivered: pd.DELIVERED,
      detail: pd.DELIVERED ? "bit = 1" : "bit = 0",
    },
    {
      source: "AWB record",
      cmts: "IMPORTAWB.DELIVERED",
      delivered: awb?.DELIVERED ?? false,
      detail: awb ? (awb.DELIVERED ? "bit = 1" : "bit = 0") : "no AWB row",
    },
    {
      source: "Gate pass",
      cmts: "GATEPASS.DeliveryDate",
      delivered: !!gp?.DeliveryDate,
      detail: gp
        ? gp.DeliveryDate
          ? `set — ${dayOf(gp.DeliveryDate)}`
          : "null"
        : "no gate pass raised",
    },
    {
      source: "Proof of delivery",
      cmts: null,
      delivered: !!pod?.complete,
      detail: pod
        ? pod.complete
          ? "captured and complete"
          : "captured, incomplete"
        : "no POD captured",
    },
  ];

  const sayingDelivered = assertions.filter((a) => a.delivered).length;
  const agreed = sayingDelivered === 0 || sayingDelivered === assertions.length;

  const yes = assertions.filter((a) => a.delivered).map((a) => a.cmts ?? a.source);
  const no = assertions.filter((a) => !a.delivered).map((a) => a.cmts ?? a.source);

  return {
    assertions,
    agreed,
    sayingDelivered,
    conflict: agreed
      ? null
      : `${yes.join(", ")} say the cargo was handed over; ${no.join(", ")} say it was not. Nothing in CMTS keeps the four in step — the bit is flipped by hand on whichever screen the clerk had open.`,
  };
}

/* ================================================================== *
 * PHYSICALDELIVERY ↔ DELIVERYINFO — the join that is not one
 * ================================================================== */

/**
 * The two tables describe one handover and share four keys, and there is no
 * foreign key between them. `DELIVERYINFO` is matched to its delivery by
 * `AWBNO` alone, which is not unique on its own in CMTS — the composite is
 * `IGMNO + AWBNO + SEQUENCE` — so a mistyped `IGMNO` on the contact sheet is
 * invisible: the row still resolves, it just resolves to a consignment the
 * contacts do not belong to.
 *
 * The detained key is the sharper case. The same identity is spelled
 * `DetendIdentification` on one table and `DetendUniqueIdentification` on the
 * other. A migration mapping keyed on column name will not pair them.
 */
export interface KeyCheck {
  label: string;
  pdColumn: string;
  diColumn: string;
  pdValue: string | null;
  diValue: string | null;
  agrees: boolean;
  /** Set where the two tables spell one concept differently. */
  nameMismatch?: string;
}

export interface TableReconciliation {
  checks: KeyCheck[];
  agrees: boolean;
  faults: string[];
}

const sameKey = (a: string | null, b: string | null) => (a ?? "") === (b ?? "");

export function reconcileTables(
  pd: PhysicalDelivery,
  di: DeliveryInfo | undefined,
): TableReconciliation {
  if (!di) {
    return {
      checks: [],
      agrees: false,
      faults: [
        "No DELIVERYINFO row for this delivery. The handover is booked and the contact sheet behind it does not exist — there is nobody recorded as having taken the cargo.",
      ],
    };
  }

  const checks: KeyCheck[] = [
    {
      label: "AWB number",
      pdColumn: "AWBNO",
      diColumn: "AWBNO",
      pdValue: pd.AWBNO,
      diValue: di.AWBNO,
      agrees: sameKey(pd.AWBNO, di.AWBNO),
    },
    {
      label: "IGM number",
      pdColumn: "IGMNO",
      diColumn: "IGMNO",
      pdValue: pd.IGMNO,
      diValue: di.IGMNO,
      agrees: sameKey(pd.IGMNO, di.IGMNO),
    },
    {
      label: "House waybill",
      pdColumn: "HWBNO",
      diColumn: "HWBNO",
      pdValue: pd.HWBNO,
      diValue: di.HWBNO,
      agrees: sameKey(pd.HWBNO, di.HWBNO),
    },
    {
      label: "Detained sub-identity",
      pdColumn: "DetendIdentification",
      diColumn: "DetendUniqueIdentification",
      pdValue: pd.DetendIdentification,
      diValue: di.DetendUniqueIdentification,
      agrees: sameKey(pd.DetendIdentification, di.DetendUniqueIdentification),
      nameMismatch:
        "One identity, two column names. PHYSICALDELIVERY calls it DetendIdentification and DELIVERYINFO calls it DetendUniqueIdentification — a name-keyed migration mapping will not pair them.",
    },
  ];

  const faults = checks
    .filter((c) => !c.agrees)
    .map(
      (c) =>
        `${c.pdColumn} disagrees across the two tables — PHYSICALDELIVERY holds ${c.pdValue ?? "null"}, DELIVERYINFO holds ${c.diValue ?? "null"}. The contact sheet is matched on AWBNO alone, so nothing catches it.`,
    );

  return { checks, agrees: faults.length === 0, faults };
}

/* ================================================================== *
 * The three contact blocks — parallel by construction
 * ================================================================== */

export type ContactRole = "consignee" | "shipper" | "agent";

export interface ContactFieldSpec {
  label: string;
  /** The CMTS column — the parity marker the screen prints. */
  column: string;
  read: (di: DeliveryInfo) => string | null;
  /** Present where CMTS misspells the column and the field reproduces it. */
  sic?: string;
}

export interface ContactField extends ContactFieldSpec {
  value: string | null;
}

export interface ContactBlock {
  role: ContactRole;
  title: string;
  subtitle: string;
  /** CMTS declares the agent block nullable and the other two NOT NULL. */
  optional: boolean;
  fields: ContactField[];
  filled: number;
  /** Every column blank — legitimate only on the agent block. */
  empty: boolean;
  /** Some set, some blank. Four independent nullable columns, no constraint. */
  partial: boolean;
}

/**
 * One spec, three blocks. The consignee, shipper and agent blocks are the same
 * four facts about three parties, so they are built from a single shape and
 * render in lockstep — name, address, phone, email, in that order, every time.
 * Writing them as three hand-built card bodies is how one of them quietly ends
 * up missing a field.
 *
 * They are parallel in SHAPE and not in OBLIGATION, which is the part worth
 * showing: the agent's four columns are nullable and the other eight are not.
 * A direct consignee shipment has no clearing agent, and an empty agent block
 * is the correct record of that — not missing data.
 *
 * `Eid` is undocumented. The legacy values are email addresses, so it is
 * labelled Email; the column marker beside it is the authority, not the label.
 */
const CONTACT_SPEC: Array<Omit<ContactBlock, "fields" | "filled" | "empty" | "partial"> & {
  fields: ContactFieldSpec[];
}> = [
  {
    role: "consignee",
    title: "Consignee",
    subtitle: "Who is taking the cargo",
    optional: false,
    fields: [
      { label: "Name", column: "ConsigneeName", read: (d) => d.ConsigneeName },
      { label: "Address", column: "ConsigneeAdd", read: (d) => d.ConsigneeAdd },
      {
        label: "Phone",
        column: "ConsgneePhone",
        read: (d) => d.ConsgneePhone,
        // [sic] — CMTS drops the "i". Reproduced exactly, because migration
        // parity is checked by column name and "correcting" it here would make
        // a mapped column read as unmapped.
        sic: "CMTS spells it ConsgneePhone — no “i”. Reproduced exactly; parity is checked by column name.",
      },
      { label: "Email", column: "ConsigneeEid", read: (d) => d.ConsigneeEid },
    ],
  },
  {
    role: "shipper",
    title: "Shipper",
    subtitle: "Who sent it",
    optional: false,
    fields: [
      { label: "Name", column: "ShipName", read: (d) => d.ShipName },
      { label: "Address", column: "ShipAdd", read: (d) => d.ShipAdd },
      { label: "Phone", column: "ShipPhone", read: (d) => d.ShipPhone },
      { label: "Email", column: "ShipEid", read: (d) => d.ShipEid },
    ],
  },
  {
    role: "agent",
    title: "Clearing agent",
    subtitle: "Who cleared it — nullable, unlike the other two",
    optional: true,
    fields: [
      { label: "Name", column: "AgentName", read: (d) => d.AgentName },
      { label: "Address", column: "AgentAdd", read: (d) => d.AgentAdd },
      { label: "Phone", column: "AgentPhone", read: (d) => d.AgentPhone },
      { label: "Email", column: "AgentEid", read: (d) => d.AgentEid },
    ],
  },
];

const isFilled = (v: string | null) => v !== null && v.trim() !== "";

export function contactBlocks(di: DeliveryInfo): ContactBlock[] {
  return CONTACT_SPEC.map((spec) => {
    const fields: ContactField[] = spec.fields.map((f) => ({ ...f, value: f.read(di) }));
    const filled = fields.filter((f) => isFilled(f.value)).length;
    return {
      role: spec.role,
      title: spec.title,
      subtitle: spec.subtitle,
      optional: spec.optional,
      fields,
      filled,
      empty: filled === 0,
      partial: filled > 0 && filled < fields.length,
    };
  });
}

/**
 * The four columns of a block are independently nullable, so CMTS happily
 * stores a phone number with no name against it. A block that is half-recorded
 * is worse than an empty one: it reads as a contact the terminal has, right up
 * until somebody tries to use it.
 */
export function contactFaults(blocks: ContactBlock[]): string[] {
  const out: string[] = [];
  for (const b of blocks) {
    if (b.partial) {
      const missing = b.fields.filter((f) => !isFilled(f.value)).map((f) => f.column);
      out.push(
        `${b.title} block is half-recorded — ${b.filled} of ${b.fields.length} columns set, ${missing.join(", ")} blank. The four columns are independently nullable, so nothing required them together.`,
      );
    }
    if (b.empty && !b.optional) {
      out.push(
        `${b.title} block is empty on a NOT NULL column set — the legacy row satisfied the constraint with empty strings.`,
      );
    }
  }
  return out;
}

/* ================================================================== *
 * Fixtures
 * ================================================================== */

/**
 * Which AWBs have a physical-delivery record.
 *
 * The voucher is cut when the consignee presents to collect — FC-08 §01,
 * which needs the DO to exist — and `DELIVERED` flips when the cargo actually
 * leaves. So the record set starts at `do-issued`, and it carries both states
 * rather than only the completed ones. A fixture set where every row reads
 * DELIVERED = 1 cannot exercise the flag at all.
 */
const DELIVERY_AWBS = AWBS.filter((a) => hasReached(a.stage, "do-issued"));

interface Scenario {
  /** How many days before DEMO_NOW the counter wrote the record. */
  writtenDaysAgo: number;
  /** `DELIVERYDATE` − `DATE`, whole days. Negative back-dates the voucher. */
  bookedOffsetDays: number;
  /** `TIME` — the clock column. */
  TIME: string;
  /**
   * The time half of the `DATE` datetime. `00:00:00` on every row but one:
   * the column is a date wearing a datetime type. The exception is the record
   * whose two boxes were keyed independently and disagree.
   */
  dateTimeOfDay: string;
  DELIVERED: boolean;
  /** Verbatim. No meaning is assigned — see DFLAG_QUESTION. */
  DFLAG: string | null;
  BLNO: string | null;
  BECASHNO: string | null;
  agent: "full" | "partial" | "absent";
  /**
   * `DELIVERYINFO.IGMNO` as keyed, where it differs from the delivery row's.
   * Left undefined on a clean record.
   */
  infoIgmno?: string;
  /** Who touched the record after it was written, if anyone. */
  updatedBy?: string;
}

/**
 * Keyed on AWB number rather than on array index so the coverage survives a
 * reordering of the seed list — an index-keyed scenario table silently moves
 * the back-dated voucher onto a different consignment the moment somebody
 * inserts an AWB above it.
 */
const SCENARIOS: Record<string, Scenario> = {
  // Clean and complete: delivered, booked to the day it was written, POD on
  // file, full agent block. The row everything else is read against.
  "176-88213340": {
    writtenDaysAgo: 2,
    bookedOffsetDays: 0,
    TIME: "15:12:00",
    dateTimeOfDay: "00:00:00",
    DELIVERED: true,
    DFLAG: "D",
    BLNO: null,
    BECASHNO: "BEC-2026-00841",
    agent: "full",
  },

  // The back-dated voucher. Cargo went out on the Friday; the clerk keyed it
  // on the Monday and booked the delivery to the day it actually left — which
  // also stops the storage clock two days early. Both readings are available
  // and the schema distinguishes neither.
  "306-77120943": {
    writtenDaysAgo: 4,
    bookedOffsetDays: -2,
    TIME: "17:40:00",
    dateTimeOfDay: "00:00:00",
    DELIVERED: true,
    DFLAG: "Y",
    BLNO: "BL-CMA-4471982",
    BECASHNO: "BEC-2026-00790",
    agent: "full",
  },

  // The disagreement. Somebody flipped DELIVERED on this record while the AWB
  // still reads 0, the gate pass has no DeliveryDate and no POD was ever
  // captured. One bit against three.
  "176-44029183": {
    writtenDaysAgo: 1,
    bookedOffsetDays: 0,
    TIME: "11:05:00",
    dateTimeOfDay: "00:00:00",
    DELIVERED: true,
    DFLAG: "D",
    BLNO: null,
    BECASHNO: null,
    agent: "full",
    updatedBy: "counter.clerk",
  },

  // Loaded and out of the gate, bit not flipped. All four sources agree that
  // the handover is not booked — the record exists, the cargo has moved, and
  // the ledger has not caught up. Direct consignee, so the agent block is
  // legitimately empty.
  "214-30049917": {
    writtenDaysAgo: 1,
    bookedOffsetDays: 0,
    TIME: "09:30:00",
    dateTimeOfDay: "00:00:00",
    DELIVERED: false,
    DFLAG: null,
    BLNO: null,
    BECASHNO: null,
    agent: "absent",
  },

  // Voucher cut against a collection booked for two days' time. DELIVERYDATE
  // in the future with DELIVERED = 0 is the one forward-booked shape that is
  // internally consistent. The agent block is half-keyed.
  "157-33448821": {
    writtenDaysAgo: 1,
    bookedOffsetDays: 2,
    TIME: "14:20:00",
    // A single space, not null — the migration predicate `DFLAG IS NULL`
    // misses this row entirely.
    dateTimeOfDay: "00:00:00",
    DELIVERED: false,
    DFLAG: " ",
    BLNO: null,
    BECASHNO: null,
    agent: "partial",
  },

  // The two-clock record, and the mistyped IGM on the contact sheet. DATE
  // carries 09:20 in its time half while TIME says 07:45, and DELIVERYINFO
  // was keyed against IGM 4418 for a delivery booked under 4417.
  "157-81002234": {
    writtenDaysAgo: 0,
    bookedOffsetDays: 0,
    TIME: "07:45:00",
    dateTimeOfDay: "09:20:00",
    DELIVERED: false,
    DFLAG: "N",
    BLNO: null,
    BECASHNO: null,
    agent: "full",
    infoIgmno: "MISKEY",
  },
};

const DEFAULT_SCENARIO: Scenario = {
  writtenDaysAgo: 2,
  bookedOffsetDays: 0,
  TIME: "12:00:00",
  dateTimeOfDay: "00:00:00",
  DELIVERED: false,
  DFLAG: null,
  BLNO: null,
  BECASHNO: null,
  agent: "full",
};

function siteKeysFor(code: SiteCode) {
  const s = SITES.find((x) => x.code === code)!;
  return { CityId: s.CityId, Comp_Code: s.Comp_Code, Off_Code: s.Off_Code };
}

/** `PHYSICALDELIVERY.VOUCHERNO` — its own series. See the note on the query below. */
const voucherNo = (site: SiteCode, i: number) =>
  `PD-${site}-2026-${String(1180 + i).padStart(5, "0")}`;

export const PHYSICAL_DELIVERIES: PhysicalDelivery[] = DELIVERY_AWBS.map((a, i) => {
  const s = SCENARIOS[a.AWBNO] ?? DEFAULT_SCENARIO;
  const gr = GODOWN_RENTS.find((g) => g.AWBNO === a.AWBNO);

  const writtenDay = pktDay(s.writtenDaysAgo);
  const DATE = stamp(writtenDay, s.dateTimeOfDay);
  const DELIVERYDATE = stamp(shiftDay(writtenDay, s.bookedOffsetDays), "00:00:00");
  const keyedAt = stamp(writtenDay, s.TIME);

  return {
    CreatedBy: "delivery.counter",
    UpdatedBy: s.updatedBy ?? null,
    CreatedDate: keyedAt,
    UpdatedDate: s.updatedBy ? stamp(writtenDay, "18:05:00") : null,
    IsActive: true,
    IsDeleted: false,
    ...siteKeysFor(a.site),

    PHYSICALDELIVERYID: 1180 + i,
    VOUCHERNO: voucherNo(a.site, i),
    DELIVERYDATE,
    IGMNO: a.IGMNO,
    AWBNO: a.AWBNO,
    // No consolidation reaches collection in the fixture set, so every house
    // waybill here is legitimately null rather than unmapped.
    HWBNO: null,
    // The cash receipt exists only where the rent voucher was settled in cash.
    CASHNO: gr?.CASH ? `CN-${String(4400 + i)}` : null,
    // Bill of lading, on an air-cargo table. Carried verbatim: CMTS holds it,
    // the schema audit records it as never rendered, and this is the first
    // screen to show it. Whether it is dead weight or a multimodal reference
    // is a question for SAPS, not something to decide by naming it.
    BLNO: s.BLNO,
    // Bill-of-entry cash receipt — the customs-side settlement, distinct from
    // CASHNO, which is the terminal's.
    BECASHNO: s.BECASHNO,
    DATE,
    TIME: s.TIME,
    DELIVERED: s.DELIVERED,
    classId: a.CARGOCLASSID,
    DFLAG: s.DFLAG,
    DetendIdentification: a.DetendUniqueIdentification,
    site: a.site,
  } satisfies PhysicalDelivery;
});

/**
 * `DELIVERYINFO` — the contact sheet.
 *
 * Sourced from the AWB's own party lines and the party master, so the contact
 * block and the AWB record cannot disagree about who the consignee is. The
 * eight columns that render nowhere else in the product — the whole shipper
 * block, both e-mail columns, the two phone columns — come off the party
 * master, which is where the terminal actually holds them.
 */
export const DELIVERY_INFOS: DeliveryInfo[] = PHYSICAL_DELIVERIES.map((pd, i) => {
  const a = awbByNo(pd.AWBNO)!;
  const s = SCENARIOS[a.AWBNO] ?? DEFAULT_SCENARIO;

  const consignee = PARTIES.find((p) => p.NAME === a.CONSIGNEE1);
  const shipper = PARTIES.find((p) => p.NAME === a.SHIPPER1);
  const agent = a.AGENT1 ? PARTIES.find((p) => p.NAME === a.AGENT1) : undefined;

  const addressOf = (p: typeof consignee, line2: string | null) =>
    p ? `${p.ADDRESS}, ${p.CITY}` : (line2 ?? "");

  const wantsAgent = s.agent !== "absent" && !!agent;
  const fullAgent = s.agent === "full" && wantsAgent;

  return {
    DevId: 1180 + i,
    AWBId: a.AWBId,
    AWBNO: pd.AWBNO,
    // Off by one on the one record where the counter keyed the contact sheet
    // against the wrong manifest. Nothing joins these two tables, so CMTS
    // never notices.
    IGMNO: s.infoIgmno === "MISKEY" ? nudgeIgm(pd.IGMNO) : pd.IGMNO,
    HWBNO: pd.HWBNO,
    CargoClassId: a.CARGOCLASSID,
    DetendUniqueIdentification: a.DetendUniqueIdentification,
    CityId: pd.CityId,

    ConsigneeName: a.CONSIGNEE1,
    ConsigneeAdd: addressOf(consignee, a.CONSIGNEE2),
    // [sic] — the CMTS spelling, missing the "i". Deliberate.
    ConsgneePhone: consignee?.PHONENO ?? "",
    ConsigneeEid: consignee?.EMAIL ?? "",

    ShipName: a.SHIPPER1,
    ShipAdd: addressOf(shipper, a.SHIPPER2),
    ShipPhone: shipper?.PHONENO ?? "",
    ShipEid: shipper?.EMAIL ?? "",

    AgentName: wantsAgent ? (a.AGENT1 ?? null) : null,
    AgentAdd: wantsAgent ? addressOf(agent, a.AGENT2) : null,
    // The half-keyed block: name and address taken, phone and e-mail never
    // asked for. Four independently nullable columns is what allows it.
    AgentPhone: fullAgent ? (agent?.PHONENO ?? null) : null,
    AgentEid: fullAgent ? (agent?.EMAIL ?? null) : null,
  } satisfies DeliveryInfo;
});

/** Bump the last digit of an IGM number — a plausible counter miskey. */
function nudgeIgm(igm: string): string {
  const last = Number(igm.slice(-1));
  return Number.isNaN(last) ? igm : `${igm.slice(0, -1)}${(last + 1) % 10}`;
}

/* ================================================================== *
 * Settlement — three receipt numbers and no amount
 * ================================================================== */

/**
 * `PHYSICALDELIVERY` names the receipts a handover was settled against and
 * carries no figure: `CASHNO`, `BECASHNO` and `BLNO` are all `varchar(20)`.
 * There is no amount column on the table at all. So the money on this screen
 * has to be RESOLVED — through `GODOWNRENT`, which is where the figure lives —
 * and it is labelled as resolved rather than printed as though the delivery
 * record held it.
 *
 * A collision worth stating while resolving it: `GODOWNRENT.VOUCHERNO` and
 * `PHYSICALDELIVERY.VOUCHERNO` are the same column name on two tables and are
 * NOT the same series. `GR-2026-04420` and `PD-KHI-2026-01180` are different
 * documents. The join between them runs through `AWBNO`, not through the two
 * `VOUCHERNO`s — a migration that pairs them on name will produce nonsense.
 */
export interface ReceiptRef {
  label: string;
  column: string;
  value: string | null;
  note: string;
}

export interface DeliverySettlement {
  receipts: ReceiptRef[];
  /** Resolved through GODOWNRENT on AWBNO. Not a column on this table. */
  rentVoucherNo: string | null;
  rentNetPayable: number | null;
  rentPaid: boolean;
  rentCash: boolean;
}

export function settlementFor(pd: PhysicalDelivery): DeliverySettlement {
  const gr = GODOWN_RENTS.find((g) => g.AWBNO === pd.AWBNO);

  const receipts: ReceiptRef[] = [
    {
      label: "Terminal cash receipt",
      column: "CASHNO",
      value: pd.CASHNO,
      note: "The terminal's own window. Set only where the rent voucher was settled in cash.",
    },
    {
      label: "Bill-of-entry cash receipt",
      column: "BECASHNO",
      value: pd.BECASHNO,
      note: "The customs-side settlement, distinct from CASHNO. Zero occurrences in the pre-P0 demo — this screen is its first home.",
    },
    {
      label: "Bill of lading",
      column: "BLNO",
      value: pd.BLNO,
      note: "Sea-freight vocabulary on an air-cargo table. Carried verbatim; whether it is dead weight or a multimodal reference is a question for SAPS, not something to settle by naming it.",
    },
  ];

  return {
    receipts,
    rentVoucherNo: gr?.VOUCHERNO ?? null,
    rentNetPayable: gr?.NETPAYABLE ?? null,
    rentPaid: gr?.PAID ?? false,
    rentCash: gr?.CASH ?? false,
  };
}

/* ================================================================== *
 * Queries
 * ================================================================== */

export function listPhysicalDeliveries(scope: SiteScope = "HQ"): PhysicalDelivery[] {
  return scope === "HQ"
    ? PHYSICAL_DELIVERIES
    : PHYSICAL_DELIVERIES.filter((d) => d.site === scope);
}

export function physicalDeliveryByVoucher(voucher: string): PhysicalDelivery | undefined {
  return PHYSICAL_DELIVERIES.find((d) => d.VOUCHERNO === voucher);
}

/**
 * The contact sheet for a delivery.
 *
 * Matched on `AWBNO` because that is the only link the legacy tables hold —
 * `DELIVERYINFO` has no voucher column and no foreign key. The lookup is
 * therefore an inference the application makes, not a relationship the data
 * enforces, which is exactly why `reconcileTables` exists to check the other
 * three keys after the match has already succeeded.
 */
export function deliveryInfoFor(awbNo: string): DeliveryInfo | undefined {
  return DELIVERY_INFOS.find((d) => d.AWBNO === awbNo);
}

/** `DELIVERYINFO` carries no site column; scope runs through the parent AWB. */
export function listDeliveryInfos(scope: SiteScope = "HQ"): DeliveryInfo[] {
  return scope === "HQ"
    ? DELIVERY_INFOS
    : DELIVERY_INFOS.filter((d) => awbByNo(d.AWBNO)?.site === scope);
}

/** The cargo class name behind `classId` / `CargoClassId`, for context only. */
export function deliveryClassName(pd: PhysicalDelivery): string {
  const c = cargoClass(pd.classId);
  return `${c.NAME} (${c.ABBREVATION})`;
}
