/**
 * AirVault domain — export billing (FC-11 §25, charging half).
 *
 * CMTS source: `ExportGodownrent` (53 columns), the **only** billing table on
 * the export side of the legacy schema. It had no form, no interface and no
 * screen — the migration gap report scores the best existing overlap at 9%,
 * and `/export/buildup` merely names the table in a comment.
 *
 * WHAT THIS IS, IN ONE LINE
 * -------------------------
 * The import side's `GODOWNRENT` charges a consignee for the days cargo sat
 * in the shed between arrival and delivery. This charges a **shipper** for the
 * days cargo sits in the export shed between acceptance (FC-11 §12) and
 * uplift (§24), and it is collected at the counter before the paper is
 * released. Same clock, other direction, and a much thinner record.
 *
 * WHAT THE EXPORT TABLE HAS THAT THE IMPORT ONE DOES NOT
 * ------------------------------------------------------
 *   • a **second cargo description at house-bill level** — `Hwbno` through
 *     `HwbShipper`, eight columns mirroring eight master-level ones. See
 *     `houseMirror` for the relationship and the structural limit it carries.
 *   • a **counter-release block** — `GrentAgent`, `Grentcnicn`,
 *     `GrentPrintDate`, `GrentTime`: who collected the printed voucher, on
 *     whose CNIC, at what moment. The import voucher records `RECIEVEDBY` for
 *     the money and nothing at all for the paper.
 *
 * AND WHAT IT DOES NOT HAVE — the shape of this screen is decided by absence
 * ------------------------------------------------------------------------
 * The import godown-rent screen is built on four things. Only two of them
 * exist here, and the column list is the evidence:
 *
 *   1. **Voucher header** — yes. `Voucherno` / `GRDATE` / `CHALLANNO`.
 *   2. **Charge breakdown** — yes, but header-only. CMTS has no
 *      `ExportGodownrentDetail`; the five charge columns sit on the voucher
 *      row itself, so the breakdown is a decomposition of one roll-up rather
 *      than a grid of priced lines. `HANDLING + DEMURRAGE + DOCUMENTATION +
 *      DECONSOLIDATION + MISCELLANEOUS = TOTALAMOUNT` is the whole arithmetic
 *      the table can express, and it is rendered as that addition.
 *   3. **Waiver chain** — NO. There is no `WAIVEOFF`, no `WAIVEOFFPERCENT`,
 *      no `WAIVEOFFAMOUNT`, no `WAIVEOFFREASON`, no `WaivOfStorageOrAmount`.
 *      Relief on the export side is the single bit `FREE`, with no percentage,
 *      no reason and no approver — so this module builds no waiver UI and
 *      instead reports what the missing columns cost (`EXPORT_RENT_LIMITS`).
 *   4. **Reconciliation** — yes, and it has more to check than the import
 *      side because `NETPAYABLE` here has *nothing* that may lawfully make it
 *      differ from `TOTALAMOUNT`. On the import voucher a gap is the waiver;
 *      here a gap is unattributable by construction.
 *
 * THE CMTS MISSPELLINGS ARE DELIBERATE — DO NOT "CORRECT" THEM
 * -----------------------------------------------------------
 * `RECIEVEDBY`, `AccpetanceDate`, `Grentcnicn`, `NatureOfgood` and
 * `HwbChargableWt` are spelt exactly as the legacy schema spells them.
 * Parity means matching the source including its typos: a migration script
 * looks for the column CMTS has, not the one we wish it had. Renaming any of
 * them here silently breaks the mapping this prototype exists to prove.
 *
 * Out of scope per the standing rules: `GodownId` (surrogate FK). The six
 * audit columns come from `AuditColumns` via `DomainRecord` rather than being
 * redeclared — note that CMTS names them `CreatedOn` / `UpdatedOn` on this
 * table and `CreatedDate` / `UpdatedDate` on most others; the shared interface
 * wins, and the disagreement is a mapping note, not a second pair of fields.
 */

import {
  DEMO_NOW,
  MS_PER_DAY,
  round2,
  type Amount,
  type DomainRecord,
  type SiteCode,
  type SiteScope,
} from "./common";

/* ================================================================== *
 * The voucher — CMTS `ExportGodownrent`, all 46 in-scope columns
 * ================================================================== */

export interface ExportGodownRent extends DomainRecord {
  /* ---- identity ---- */
  /**
   * CMTS `varchar(50)`, and the voucher's whole identity — there is no
   * `DocNumberRef` on this record. The AirVault numbering primitive is keyed
   * on `DocSeriesCode`, which has no export-rent member, and adding one means
   * editing `common.ts`, which this ticket does not own. The CMTS column is
   * the number an operator reads off the printed voucher anyway, so it is
   * rendered as itself with its parity marker rather than dressed up.
   */
  Voucherno: string;
  GRDATE: string;
  CHALLANNO: string | null;
  AWBNO: string;

  /* ---- the storage clock ---- */
  /** When the cargo reached the export terminal — the truck in, not a flight. */
  ARRIVALDATE: string;
  /** CMTS spelling. The counter event at FC-11 §12, where the clock starts. */
  AccpetanceDate: string;
  FROMDATE: string;
  TODATE: string;
  /**
   * The billed day count. CMTS bills calendar days **inclusive of both ends**
   * (`DATEDIFF(day, from, to) + 1`, schema audit §3.1), which is not the same
   * as the elapsed-day count `daysBetween` returns — one voucher in the seed
   * carries the elapsed figure so the difference is visible rather than
   * asserted.
   */
  DAYS: number;
  /**
   * The entire relief mechanism on the export side: one bit. No percentage, no
   * reason, no approver, no amount. Whatever a `true` here cost the terminal
   * is not recoverable from this table.
   */
  FREE: boolean;

  /* ---- charges. Five parts and two roll-ups, no detail table ---- */
  HANDLING: Amount;
  DEMURRAGE: Amount;
  DOCUMENTATION: Amount;
  DECONSOLIDATION: Amount;
  MISCELLANEOUS: Amount;
  TOTALAMOUNT: Amount;
  /**
   * With no waiver, discount, tax or rounding column anywhere on the table,
   * `NETPAYABLE` has nothing that can lawfully make it differ from
   * `TOTALAMOUNT`. A difference is therefore a finding, never a feature.
   */
  NETPAYABLE: Amount;

  /* ---- payment ---- */
  PAID: boolean;
  CASHAMOUNT: Amount;
  PayOrder: boolean;
  PAYORDERNO: string | null;
  PAYORDERDATE: string | null;
  PAYORDERAMOUNT: Amount;
  /** CMTS spelling — the cashier who took the money. */
  RECIEVEDBY: string | null;
  PAYDATE: string | null;

  /* ---- master-level cargo description ---- */
  Airline: string;
  /**
   * CMTS `varchar(50)` — a **piece count held as free text**, while the house
   * count `Hwbpcs` on the same row is an `int`. Modelled as the string it is:
   * typing it as a number would quietly discard whatever the counter actually
   * wrote, and what the counter actually wrote is the finding. See `piecesOf`.
   */
  Pcs: string;
  /**
   * CMTS `int`, both of these. Weights on this table cannot hold a fraction,
   * so the IATA half-kilo rounding step the rest of the demo implements
   * (`roundUpHalfKg`, `common.ts`) cannot round-trip through the export
   * voucher — 1240.5 kg is stored as 1240 or 1241 and the original is gone.
   */
  GrossWeight: number;
  ChargeableWeight: number;
  /** CMTS spelling. */
  NatureOfgood: string;
  Destination: string;
  /** Where in the export shed it sat — the legacy free-text zone label. */
  Location: string;
  Shippername: string;
  AgencyName: string;

  /* ---- house-level cargo description ---- *
   * The same seven attributes again, one house-bill deep. Null across the
   * block means "not a consolidation", which is an answer; see `houseMirror`
   * for why a populated block is not necessarily the whole answer. */
  Hwbno: string | null;
  Hwbpcs: number | null;
  HwbGrossWeight: number | null;
  /** CMTS spelling — `Chargable`, one 'e' short. */
  HwbChargableWt: number | null;
  /** CMTS spelling. */
  HwbNatureofGood: string | null;
  HwbDest: string | null;
  HwbLocation: string | null;
  HwbShipper: string | null;

  /* ---- counter release of the printed voucher ---- */
  GrentAgent: string | null;
  /** CMTS spelling — the collecting agent's CNIC. */
  Grentcnicn: string | null;
  /**
   * `datetime` and `time` for one instant, in two columns. The datetime
   * already carries a time component, so when the two disagree nothing in the
   * schema says which one was the print. Kept as two fields — folding them
   * into one timestamp is the lossy transform `exportcargo.ts` refuses for
   * `TIMEOFACCEPTENCE`, for the same reason.
   */
  GrentPrintDate: string | null;
  /** `HH:MM:SS`, no date attached. */
  GrentTime: string | null;

  site: SiteCode;
}

/* ================================================================== *
 * Reading the two columns CMTS typed loosely
 * ================================================================== */

/**
 * `Pcs` as a number, or null when the text is not a clean count.
 *
 * Null is the interesting case and must not be coerced to 0: a `varchar(50)`
 * piece count lets the counter write "156 + 2 LOOSE", and a consignment whose
 * master count cannot be added is one whose house rows cannot be checked
 * against it. Returning 0 would report that as a balanced nothing.
 */
export function piecesOf(v: ExportGodownRent): number | null {
  const text = v.Pcs.trim();
  return /^\d+$/.test(text) ? Number(text) : null;
}

/**
 * The instant the voucher was printed, composed from the two columns, plus
 * whether they agree about it.
 *
 * `agrees` is null when there is nothing to compare — either column absent —
 * because "no time recorded" and "two times that contradict" are different
 * findings and a boolean cannot hold both.
 */
export function printedAt(v: ExportGodownRent): {
  iso: string | null;
  clock: string | null;
  agrees: boolean | null;
} {
  if (!v.GrentPrintDate) return { iso: null, clock: v.GrentTime, agrees: null };
  const d = new Date(v.GrentPrintDate);
  const stamped = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  if (!v.GrentTime) return { iso: v.GrentPrintDate, clock: null, agrees: null };
  return {
    iso: v.GrentPrintDate,
    clock: v.GrentTime,
    agrees: v.GrentTime.slice(0, 5) === stamped,
  };
}

/* ================================================================== *
 * Reconciliation — the voucher rebuilt from its own columns
 *
 * The import side reconciles a header against `GODOWNRENTDETAIL` lines. There
 * are no lines here, so what is checkable is the header against itself: the
 * roll-up against its five parts, the net against the total, the day count
 * against the period it claims to bill, and the money tendered against the
 * money owed. Every one of those is an identity CMTS can violate and does.
 * ================================================================== */

/** Money compared at paisa resolution, not at the rupee `formatPkr` displays. */
const EPSILON = 0.005;

function agrees(a: Amount, b: Amount): boolean {
  return Math.abs(a - b) < EPSILON;
}

/**
 * Exact money text. `formatPkr` rounds to whole rupees, which is right for a
 * headline and wrong for a discrepancy — a 240.50 gap must not print as
 * "PKR 241" beside the two figures it fails to bridge.
 */
export function formatExactPkr(n: Amount): string {
  const whole = Number.isInteger(round2(n));
  return `PKR ${round2(n).toLocaleString("en-PK", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/**
 * CMTS's own day count: calendar days inclusive of both ends. Schema audit
 * §3.1 — `DATEDIFF(day, i.CARGODATE, @enddate) + 1`. Deliberately NOT
 * `daysBetween`, which counts elapsed 24-hour periods and is one short on
 * every whole day; that difference is a live billing defect and this function
 * exists so the screen can show both figures rather than pick one.
 */
export function billedDaysInclusive(fromIso: string, toIso: string): number {
  const a = new Date(fromIso);
  const b = new Date(toIso);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / MS_PER_DAY) + 1);
}

/**
 * One row of the charge addition, read top to bottom as a sum on paper. `op`
 * prints to the LEFT of the row, so the opening term carries none and a stated
 * total carries "=".
 */
export interface ChargeStep {
  op: "" | "+" | "−" | "=";
  label: string;
  /** The CMTS column this term is stored in. */
  cmts: string;
  amount: Amount;
  /** True where the row states a stored roll-up rather than a term added into one. */
  isResult: boolean;
  /**
   * What the amount works out at per kilo — derived, never stored. CMTS puts
   * `HANDLINGUNIT` / `STORGEUNIT` / `LOCATIONUNIT` on `GODOWNRENTDETAIL` and
   * gives the export table no unit column at all, so the basis of every figure
   * below is unrecorded. Null where a per-kg reading would be meaningless.
   */
  impliedRate: string | null;
}

/** An identity the voucher claims and does not satisfy. */
export interface ExportRentBreak {
  title: string;
  detail: string;
  delta: Amount;
}

export type SettlementState = "unpaid" | "settled" | "short" | "over";

export interface Settlement {
  state: SettlementState;
  /** `CASHAMOUNT` + `PAYORDERAMOUNT` — what actually came across the counter. */
  tendered: Amount;
  /** `NETPAYABLE` − tendered. Positive is short, negative is over. */
  balance: Amount;
}

export interface ClockCheck {
  /** `DAYS` as stored. */
  stored: number;
  /** CMTS's own rule applied to `FROMDATE`/`TODATE`. */
  inclusive: number;
  /** Elapsed 24-hour periods — what the demo's `daysBetween` would give. */
  elapsed: number;
  agrees: boolean;
  /**
   * Where the billed period is supposed to open. A first voucher opens on the
   * acceptance date, because that is where the export storage clock starts
   * (FC-11 §12). A second voucher against the same AWB opens the day after the
   * previous one closed — and treating that as a late start would report every
   * instalment as forgiven days, which is the wrong reading of a correct row.
   */
  basis: "acceptance" | "continuation";
  opensCorrectly: boolean;
  /** The expected opening date, so the screen can print what it checked against. */
  expectedOpening: string;
}

export interface RentTimelineEvent {
  label: string;
  cmts: string;
  iso: string | null;
  why: string;
  outOfOrder: boolean;
}

export interface ExportRentReconciliation {
  chain: ChargeStep[];
  /** Σ of the five charge columns. */
  partsTotal: Amount;
  totalAgrees: boolean;
  netAgrees: boolean;
  /** `TOTALAMOUNT` − `NETPAYABLE`. Nothing on this table can explain it. */
  netGap: Amount;
  settlement: Settlement;
  clock: ClockCheck;
  timeline: RentTimelineEvent[];
  timelineOrdered: boolean;
  breaks: ExportRentBreak[];
}

function rate(amount: Amount, kg: number, suffix: string): string | null {
  if (amount <= 0 || kg <= 0) return null;
  return `≈ PKR ${(amount / kg).toFixed(2)}${suffix}`;
}

function sameDay(a: string, b: string): boolean {
  return new Date(a).toDateString() === new Date(b).toDateString();
}

/**
 * The one piece of context the voucher cannot supply about itself.
 *
 * `previous` is the voucher that last billed this AWB, matched on `AWBNO`
 * because that is the only relation the export table supports — see
 * `exportRentsForAwb`. It is passed in rather than looked up so the
 * reconciler stays a pure function of what it is given.
 */
export interface ExportRentContext {
  previous: ExportGodownRent | null;
}

export function reconcileExportRent(
  v: ExportGodownRent,
  ctx: ExportRentContext = { previous: null },
): ExportRentReconciliation {
  const kg = v.ChargeableWeight;

  const chain: ChargeStep[] = [
    {
      op: "",
      label: "Handling",
      cmts: "HANDLING",
      amount: v.HANDLING,
      isResult: false,
      impliedRate: rate(v.HANDLING, kg, " / kg"),
    },
    {
      op: "+",
      label: "Demurrage — storage beyond the free period",
      cmts: "DEMURRAGE",
      amount: v.DEMURRAGE,
      isResult: false,
      impliedRate: v.DAYS > 0 ? rate(v.DEMURRAGE, kg * v.DAYS, " / kg / day") : null,
    },
    {
      op: "+",
      label: "Documentation",
      cmts: "DOCUMENTATION",
      amount: v.DOCUMENTATION,
      isResult: false,
      impliedRate: null,
    },
    {
      op: "+",
      label: "Deconsolidation",
      cmts: "DECONSOLIDATION",
      amount: v.DECONSOLIDATION,
      isResult: false,
      impliedRate: null,
    },
    {
      op: "+",
      label: "Miscellaneous",
      cmts: "MISCELLANEOUS",
      amount: v.MISCELLANEOUS,
      isResult: false,
      impliedRate: null,
    },
    {
      op: "=",
      label: "Voucher total",
      cmts: "TOTALAMOUNT",
      amount: v.TOTALAMOUNT,
      isResult: true,
      impliedRate: null,
    },
    {
      // Stated, not derived. Printing the sum of the parts here would hide the
      // very defect this chain exists to expose — the two are compared.
      op: "=",
      label: "Net payable",
      cmts: "NETPAYABLE",
      amount: v.NETPAYABLE,
      isResult: true,
      impliedRate: null,
    },
  ];

  const partsTotal = round2(
    v.HANDLING + v.DEMURRAGE + v.DOCUMENTATION + v.DECONSOLIDATION + v.MISCELLANEOUS,
  );
  const totalAgrees = agrees(v.TOTALAMOUNT, partsTotal);
  const netGap = round2(v.TOTALAMOUNT - v.NETPAYABLE);
  const netAgrees = agrees(v.NETPAYABLE, v.TOTALAMOUNT);

  const tendered = round2(v.CASHAMOUNT + v.PAYORDERAMOUNT);
  const balance = round2(v.NETPAYABLE - tendered);
  const settlement: Settlement = {
    tendered,
    balance,
    state: !v.PAID && tendered === 0
      ? "unpaid"
      : Math.abs(balance) < EPSILON
        ? "settled"
        : balance > 0
          ? "short"
          : "over",
  };

  const inclusive = billedDaysInclusive(v.FROMDATE, v.TODATE);
  const elapsed = Math.max(
    0,
    Math.floor((Date.parse(v.TODATE) - Date.parse(v.FROMDATE)) / MS_PER_DAY),
  );
  const expectedOpening = ctx.previous
    ? new Date(Date.parse(ctx.previous.TODATE) + MS_PER_DAY).toISOString()
    : v.AccpetanceDate;
  const clock: ClockCheck = {
    stored: v.DAYS,
    inclusive,
    elapsed,
    agrees: v.DAYS === inclusive,
    basis: ctx.previous ? "continuation" : "acceptance",
    expectedOpening,
    opensCorrectly: sameDay(v.FROMDATE, expectedOpening),
  };

  const rawTimeline: Array<Omit<RentTimelineEvent, "outOfOrder">> = [
    {
      label: "Cargo at the terminal",
      cmts: "ARRIVALDATE",
      iso: v.ARRIVALDATE,
      why: "The truck in. Nothing is charged from here — the clock starts at the counter.",
    },
    {
      label: "Accepted at the counter",
      cmts: "AccpetanceDate",
      iso: v.AccpetanceDate,
      why: "FC-11 §12. The storage clock starts here, which is why FROMDATE should open on this date.",
    },
    /*
     * FROMDATE and TODATE are deliberately NOT in this sequence, for the same
     * reason the import timeline leaves them out and one more of its own. They
     * bound the period being billed rather than marking an event; and the
     * period opens at 00:00 of the acceptance day, so folding it in would put
     * every voucher's FROMDATE before its own AccpetanceDate and report the
     * whole set as running backwards. They are checked in `clock` instead,
     * against the rule that actually governs them.
     */
    {
      label: "Voucher raised",
      cmts: "GRDATE",
      iso: v.GRDATE,
      why: "The date this voucher was cut. It cannot precede the period it bills.",
    },
    {
      label: "Pay order dated",
      cmts: "PAYORDERDATE",
      iso: v.PAYORDERDATE,
      why: "Null when the voucher was settled in cash or not settled at all.",
    },
    {
      label: "Payment received",
      cmts: "PAYDATE",
      iso: v.PAYDATE,
      why: "Null while the voucher is outstanding — which is a state, not missing data.",
    },
    {
      label: "Voucher printed & collected",
      cmts: "GrentPrintDate",
      iso: v.GrentPrintDate,
      why: "The paper leaves the counter with the agent named in the release block.",
    },
  ];

  let previous = Number.NEGATIVE_INFINITY;
  const timeline = rawTimeline.map((e) => {
    if (e.iso === null) return { ...e, outOfOrder: false };
    const t = Date.parse(e.iso);
    const outOfOrder = t < previous;
    previous = Math.max(previous, t);
    return { ...e, outOfOrder };
  });

  const breaks: ExportRentBreak[] = [];

  if (!totalAgrees) {
    breaks.push({
      title: "TOTALAMOUNT does not equal the five charge columns",
      detail: `The header stores ${formatExactPkr(v.TOTALAMOUNT)}; HANDLING + DEMURRAGE + DOCUMENTATION + DECONSOLIDATION + MISCELLANEOUS come to ${formatExactPkr(
        partsTotal,
      )}. There is no ExportGodownrentDetail table to hold a sixth charge, so nothing off-row can account for the difference.`,
      delta: round2(v.TOTALAMOUNT - partsTotal),
    });
  }

  if (!netAgrees) {
    breaks.push({
      title: "NETPAYABLE does not equal TOTALAMOUNT",
      detail: `The voucher totals ${formatExactPkr(v.TOTALAMOUNT)} and bills ${formatExactPkr(
        v.NETPAYABLE,
      )} — a difference of ${formatExactPkr(
        Math.abs(netGap),
      )} that no column on this table can explain. ExportGodownrent has no waiver, discount, tax or rounding column: on the import voucher this gap is WAIVEOFFAMOUNT and is defensible, here it is an adjustment made off the record. Whoever granted it left no name, no reason and no percentage behind.`,
      delta: netGap,
    });
  }

  if (!clock.agrees) {
    breaks.push({
      title: "DAYS does not match the period it bills",
      detail: `FROMDATE → TODATE spans ${clock.inclusive} calendar day${
        clock.inclusive === 1 ? "" : "s"
      } inclusive of both ends — the count CMTS's own Charges procedure uses — and DAYS carries ${
        clock.stored
      }. ${
        clock.stored === clock.elapsed
          ? "The stored figure is the elapsed-24-hour count, which is exactly the +1 the schema audit §3.1 flags as under-billing every consignment."
          : "Neither the inclusive nor the elapsed count reaches the stored figure."
      }`,
      delta: clock.stored - clock.inclusive,
    });
  }

  if (v.PAID && settlement.state === "short") {
    breaks.push({
      title: "PAID is set on a voucher that is not fully settled",
      detail: `CASHAMOUNT + PAYORDERAMOUNT come to ${formatExactPkr(
        tendered,
      )} against a NETPAYABLE of ${formatExactPkr(v.NETPAYABLE)} — ${formatExactPkr(
        balance,
      )} short. The bit says settled and the money columns say otherwise; a receivables report reading PAID would drop this balance entirely.`,
      delta: balance,
    });
  }

  if (settlement.state === "over") {
    breaks.push({
      title: "More was tendered than the voucher bills, and there is nowhere to record it",
      detail: `${formatExactPkr(
        tendered,
      )} came across the counter against ${formatExactPkr(
        v.NETPAYABLE,
      )} payable. The import voucher carries OverPaidAmount for exactly this; ExportGodownrent has no such column, so the ${formatExactPkr(
        Math.abs(balance),
      )} sits in the cash drawer with no record on the document that produced it.`,
      delta: balance,
    });
  }

  if (!clock.opensCorrectly) {
    breaks.push({
      title:
        clock.basis === "acceptance"
          ? "The billed period does not open on the acceptance date"
          : "The billed period does not continue where the previous voucher stopped",
      detail:
        clock.basis === "acceptance"
          ? "The export storage clock starts when the counter accepts the cargo (FC-11 §12). A FROMDATE later than AccpetanceDate silently forgives days; earlier, it bills days the terminal did not hold the cargo."
          : `The previous voucher on this AWB closed at ${new Date(
              ctx.previous!.TODATE,
            ).toDateString()}, so this one should open the day after. A gap leaves days billed to nobody; an overlap bills them twice, and with no GRREFERENCE column neither is detectable from the row itself.`,
      delta: 0,
    });
  }

  const stamp = printedAt(v);
  if (stamp.agrees === false) {
    breaks.push({
      title: "GrentPrintDate and GrentTime disagree about the print",
      detail: `GrentPrintDate carries ${new Date(v.GrentPrintDate!).toLocaleTimeString("en-GB", {
        hour: "2-digit",
        minute: "2-digit",
      })} and GrentTime carries ${stamp.clock}. One instant, two columns, and no rule in the schema saying which one is the print — so the release cannot be timed to better than a working day.`,
      delta: 0,
    });
  }

  return {
    chain,
    partsTotal,
    totalAgrees,
    netAgrees,
    netGap,
    settlement,
    clock,
    timeline,
    timelineOrdered: timeline.every((e) => !e.outOfOrder),
    breaks,
  };
}

/* ================================================================== *
 * Master vs house — what the HWB block actually is
 *
 * `Hwbno` … `HwbShipper` are not extra attributes of the consignment. They are
 * the SAME seven attributes as the master block, one bill deeper: the house
 * air waybill's own pieces, weights, goods, destination, shed location and
 * shipper. CMTS flattens them onto the voucher row, which has one consequence
 * worth stating plainly on screen: **a voucher row can describe exactly one
 * house.** A consolidation of three houses either cuts three vouchers with the
 * master figures repeated on each — and then the master weight is triple-
 * counted by anything that sums the column — or loses two houses. There is no
 * third option in this schema.
 * ================================================================== */

export interface HouseMirrorRow {
  label: string;
  /** CMTS master-level column, and its value on this voucher. */
  masterCmts: string;
  master: string;
  /** CMTS house-level counterpart. Null values render as the null they are. */
  houseCmts: string;
  house: string | null;
  /**
   * Whether the house figure can exceed, must equal, or should sit inside the
   * master one — stated per row because the answer differs by attribute.
   */
  note: string | null;
}

export interface HouseMirror {
  /** False when the whole house block is null — a straight master. */
  present: boolean;
  rows: HouseMirrorRow[];
  /**
   * House pieces / weights as a share of the master figures, where both are
   * readable. Null where `Pcs` is text that will not parse.
   */
  piecesCovered: { house: number; master: number | null } | null;
  weightCovered: { house: number; master: number };
}

export function houseMirror(v: ExportGodownRent): HouseMirror {
  const present = v.Hwbno !== null;
  const masterPcs = piecesOf(v);

  const rows: HouseMirrorRow[] = [
    {
      label: "Bill number",
      masterCmts: "AWBNO",
      master: v.AWBNO,
      houseCmts: "Hwbno",
      house: v.Hwbno,
      note: "The house bill the shipper actually holds; the master is the airline's.",
    },
    {
      label: "Pieces",
      masterCmts: "Pcs",
      master: v.Pcs,
      houseCmts: "Hwbpcs",
      house: v.Hwbpcs === null ? null : String(v.Hwbpcs),
      note:
        masterPcs === null
          ? "Master pieces is varchar(50) and this value will not parse, so the house count cannot be checked against it."
          : "House pieces must sit inside the master count — one row can hold only one house, so the rest are not here to add.",
    },
    {
      label: "Gross weight",
      masterCmts: "GrossWeight",
      master: `${v.GrossWeight} kg`,
      houseCmts: "HwbGrossWeight",
      house: v.HwbGrossWeight === null ? null : `${v.HwbGrossWeight} kg`,
      note: "Both int — neither column can hold a fraction of a kilo.",
    },
    {
      label: "Chargeable weight",
      masterCmts: "ChargeableWeight",
      master: `${v.ChargeableWeight} kg`,
      houseCmts: "HwbChargableWt",
      house: v.HwbChargableWt === null ? null : `${v.HwbChargableWt} kg`,
      note: "The voucher prices the master figure. The house figure is carried and never billed on.",
    },
    {
      label: "Nature of goods",
      masterCmts: "NatureOfgood",
      master: v.NatureOfgood,
      houseCmts: "HwbNatureofGood",
      house: v.HwbNatureofGood,
      note: null,
    },
    {
      label: "Destination",
      masterCmts: "Destination",
      master: v.Destination,
      houseCmts: "HwbDest",
      house: v.HwbDest,
      note: "A house may be routed beyond the master's destination; the two are allowed to differ.",
    },
    {
      label: "Shed location",
      masterCmts: "Location",
      master: v.Location,
      houseCmts: "HwbLocation",
      house: v.HwbLocation,
      note: "Free text on both — CMTS has no FK from either to the location master.",
    },
    {
      label: "Shipper",
      masterCmts: "Shippername",
      master: v.Shippername,
      houseCmts: "HwbShipper",
      house: v.HwbShipper,
      note: "The master shipper is the consolidator; the house shipper is the party who owns the goods.",
    },
  ];

  return {
    present,
    rows,
    piecesCovered:
      v.Hwbpcs === null ? null : { house: v.Hwbpcs, master: masterPcs },
    weightCovered: { house: v.HwbGrossWeight ?? 0, master: v.GrossWeight },
  };
}

/* ================================================================== *
 * What this table cannot record
 *
 * Every entry below is a column the import-side voucher has and this one does
 * not, or a type the export table declares loosely. They are listed as data
 * rather than prose so the screen can mark which ones are actually biting the
 * voucher on screen — a structural limit that is currently costing money reads
 * differently from one that merely might.
 * ================================================================== */

export interface ExportRentLimit {
  code: string;
  title: string;
  /** What the import side has that this table does not. */
  importSide: string;
  consequence: string;
  /**
   * True where the limit applies to every row of the table by construction —
   * a missing column or a wrong type is not something a particular voucher
   * does. `bites` is not consulted for these.
   */
  always: boolean;
  /**
   * For the conditional ones: is this limit costing something on THIS voucher
   * right now. The distinction matters on screen — a limit that is currently
   * doing damage reads differently from one that merely could.
   */
  bites: (v: ExportGodownRent, siblingVouchers: number, housesAtAcceptance: number) => boolean;
}

export const EXPORT_RENT_LIMITS: ExportRentLimit[] = [
  {
    code: "no-waiver",
    title: "Relief is one bit — FREE — with no reason, percentage or approver",
    importSide: "GODOWNRENT.WAIVEOFF + WAIVEOFFPERCENT + WAIVEOFFAMOUNT + WAIVEOFFREASON, behind the FC-07 §10–12 three-level approval",
    consequence:
      "A free period granted on the export side cannot be priced, attributed or approved after the fact. The revenue forgone is not a number anyone can produce from this table.",
    always: false,
    bites: (v) => v.FREE,
  },
  {
    code: "no-detail",
    title: "No detail table — five charge columns and nothing beneath them",
    importSide: "GODOWNRENTDETAIL (26 columns), one row per class / subclass / location / day band",
    consequence:
      "A consignment split across two shed zones at two rates is one number here. The charge cannot be shown to be right; it can only be shown to add up.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-tax",
    title: "No tax columns at all",
    importSide: "sumTax, TaxPercentage, Tax, TaxAmount on the detail lines",
    consequence:
      "Whether TOTALAMOUNT is tax-inclusive is not recorded anywhere on the export voucher. Two readers can reach two different figures from the same row.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-reference",
    title: "No GRREFERENCE — a second voucher cannot point at the first",
    importSide: "GODOWNRENT.GRREFERENCE, which links an instalment or supplementary voucher to its parent",
    consequence:
      "When a consignment is re-warehoused and billed again, the two vouchers are related only by sharing an AWBNO. Nothing records that the second continues the first.",
    always: false,
    bites: (_v, siblings) => siblings > 1,
  },
  {
    code: "one-house",
    title: "One house per voucher row",
    importSide: "CARGOACCEPTANCEHWB, which holds as many house rows as the consolidation has",
    consequence:
      "A consolidation is either split across repeated vouchers — triple-counting the master weight — or truncated to its first house. The acceptance record knows the true count; this table cannot hold it.",
    always: false,
    bites: (v, _siblings, houses) => houses > 1 && v.Hwbno !== null,
  },
  {
    code: "pcs-varchar",
    title: "Pcs is varchar(50) while Hwbpcs is int",
    importSide: "GODOWNRENT.TOTALPIECES, an int",
    consequence:
      "The master piece count on this table cannot reliably be added, compared or totalled. The house count on the same row can.",
    always: false,
    bites: (v) => piecesOf(v) === null,
  },
  {
    code: "weights-int",
    title: "GrossWeight and ChargeableWeight are int",
    importSide: "GODOWNRENT.TOTALWEIGHT / CHARGEABLEWEIGHT, float",
    consequence:
      "IATA rounds chargeable weight up to the next half kilo. That step cannot be stored here, so the figure the voucher prices is not the figure the scale produced.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-overpaid",
    title: "No OverPaidAmount — an overpayment has nowhere to go",
    importSide: "GODOWNRENT.OverPaidAmount",
    consequence:
      "Cash tendered above NETPAYABLE leaves no trace on the voucher it was tendered against.",
    always: false,
    bites: (v) => round2(v.CASHAMOUNT + v.PAYORDERAMOUNT) > v.NETPAYABLE + EPSILON,
  },
  {
    code: "split-print-time",
    title: "GrentPrintDate and GrentTime hold one instant in two columns",
    importSide: "no import counterpart — the import voucher records nothing about the printed paper",
    consequence:
      "When the datetime's own time component disagrees with the time column, nothing says which is the release.",
    always: false,
    bites: (v) => printedAt(v).agrees === false,
  },
];

/* ================================================================== *
 * Fixtures
 *
 * Six vouchers over the five export consignments in `fixtures.ts`, keyed on
 * the same AWB numbers so the billing screen and the acceptance screen are
 * talking about the same cargo. Hand-authored rather than generated: every
 * figure below is load-bearing for one check or another, and a seeded RNG
 * would make the faults accidental instead of chosen.
 *
 * Deterministic by construction — no Math.random, no Date.now. Dates hang off
 * DEMO_NOW exactly as `fixtures.ts` does.
 *
 * Each voucher carries a fault the screen has to survive:
 *   1. clean — every identity holds
 *   2. DAYS short by the CMTS +1, and PAID set on a short settlement
 *   3. NETPAYABLE below TOTALAMOUNT with no column to explain it; Pcs unreadable
 *   4. clean and closed — the perishable that ran the full flow to E13
 *   5. overpaid, with no OverPaidAmount column to hold the difference
 *   6. the second voucher on AWB 5 after it was offloaded and re-warehoused —
 *      related to voucher 5 by nothing but a shared AWBNO
 * ================================================================== */

const NOW_MS = Date.parse(DEMO_NOW);

function at(daysAgo: number, hour: number, minute: number): string {
  const d = new Date(NOW_MS - daysAgo * MS_PER_DAY);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

/** Site keys, matching `masters.ts` — KHI 1/1/1, LHE 2/1/2, PEW 3/1/3. */
const SITE_KEYS: Record<SiteCode, { CityId: number; Comp_Code: number; Off_Code: number }> = {
  KHI: { CityId: 1, Comp_Code: 1, Off_Code: 1 },
  LHE: { CityId: 2, Comp_Code: 1, Off_Code: 2 },
  PEW: { CityId: 3, Comp_Code: 1, Off_Code: 3 },
};

function audit(site: SiteCode, createdDaysAgo: number, by: string) {
  return {
    ...SITE_KEYS[site],
    CreatedBy: by,
    UpdatedBy: null,
    CreatedDate: at(createdDaysAgo, 11, 20),
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
    site,
  };
}

export const EXPORT_GODOWN_RENTS: ExportGodownRent[] = [
  /* ---- 1 · clean. Straight master, cash-settled, paper collected. ---- */
  {
    ...audit("KHI", 1, "f.abbas"),
    Voucherno: "EGR-2026-00318",
    GRDATE: at(1, 10, 5),
    CHALLANNO: "CHL-88214",
    AWBNO: "618-44120935",
    ARRIVALDATE: at(3, 6, 40),
    AccpetanceDate: at(3, 7, 55),
    FROMDATE: at(3, 0, 0),
    TODATE: at(1, 0, 0),
    DAYS: 3,
    FREE: false,
    HANDLING: 5580,
    DEMURRAGE: 3720,
    DOCUMENTATION: 1500,
    DECONSOLIDATION: 0,
    MISCELLANEOUS: 350,
    TOTALAMOUNT: 11150,
    NETPAYABLE: 11150,
    PAID: true,
    CASHAMOUNT: 11150,
    PayOrder: false,
    PAYORDERNO: null,
    PAYORDERDATE: null,
    PAYORDERAMOUNT: 0,
    RECIEVEDBY: "N. Farooq",
    PAYDATE: at(1, 10, 35),
    Airline: "EK — Emirates SkyCargo",
    Pcs: "84",
    GrossWeight: 1240,
    ChargeableWeight: 1240,
    NatureOfgood: "Surgical instruments",
    Destination: "DXB",
    Location: "EXP-A1",
    Shippername: "Sialkot Surgical Works (Pvt) Ltd",
    AgencyName: "Skyline Cargo Services",
    Hwbno: null,
    Hwbpcs: null,
    HwbGrossWeight: null,
    HwbChargableWt: null,
    HwbNatureofGood: null,
    HwbDest: null,
    HwbLocation: null,
    HwbShipper: null,
    GrentAgent: "Skyline Cargo Services",
    Grentcnicn: "42101-6633821-9",
    GrentPrintDate: at(1, 10, 42),
    GrentTime: "10:42:00",
  },

  /* ---- 2 · a three-house consolidation on a row that holds one house,
          DAYS short by the CMTS inclusive +1, and PAID set on a short
          settlement. ---- */
  {
    ...audit("LHE", 2, "m.rauf"),
    Voucherno: "EGR-2026-00319",
    GRDATE: at(0, 9, 30),
    CHALLANNO: "CHL-88231",
    AWBNO: "618-44120946",
    ARRIVALDATE: at(2, 5, 50),
    AccpetanceDate: at(2, 7, 20),
    FROMDATE: at(2, 0, 0),
    TODATE: at(0, 0, 0),
    // Three calendar days inclusive; 2 is the elapsed-24-hour count.
    DAYS: 2,
    FREE: false,
    HANDLING: 14310,
    DEMURRAGE: 2650,
    DOCUMENTATION: 1500,
    DECONSOLIDATION: 2700,
    MISCELLANEOUS: 0,
    TOTALAMOUNT: 21160,
    NETPAYABLE: 21160,
    PAID: true,
    CASHAMOUNT: 12000,
    PayOrder: true,
    PAYORDERNO: "PO-441182",
    PAYORDERDATE: at(0, 11, 15),
    PAYORDERAMOUNT: 8000,
    RECIEVEDBY: "A. Latif",
    PAYDATE: at(0, 11, 20),
    Airline: "BA — British Airways World Cargo",
    Pcs: "210",
    GrossWeight: 3180,
    ChargeableWeight: 3180,
    NatureOfgood: "Cotton garments",
    Destination: "LHR",
    Location: "EXP-B2",
    Shippername: "Indus Consolidators (Pvt) Ltd",
    AgencyName: "Indus Consolidators (Pvt) Ltd",
    Hwbno: "SKY-LHR-88214",
    Hwbpcs: 96,
    HwbGrossWeight: 1420,
    HwbChargableWt: 1420,
    HwbNatureofGood: "Cotton garments — knitwear",
    HwbDest: "MAN",
    HwbLocation: "EXP-B2",
    HwbShipper: "Ravi Textiles (Pvt) Ltd",
    GrentAgent: "Indus Consolidators (Pvt) Ltd",
    Grentcnicn: "35202-4471903-1",
    // Printed after the money was in, at 11:45 — and the time column says
    // 14:20. One instant, two columns, no rule saying which is the release.
    GrentPrintDate: at(0, 11, 45),
    GrentTime: "14:20:00",
  },

  /* ---- 3 · NETPAYABLE below TOTALAMOUNT with nothing on the table that can
          explain it, a piece count that will not parse, and the voucher still
          outstanding so the whole release block is null. ---- */
  {
    ...audit("KHI", 0, "f.abbas"),
    Voucherno: "EGR-2026-00320",
    GRDATE: at(0, 8, 45),
    CHALLANNO: null,
    AWBNO: "618-44120957",
    ARRIVALDATE: at(1, 6, 15),
    AccpetanceDate: at(1, 8, 10),
    FROMDATE: at(1, 0, 0),
    TODATE: at(0, 0, 0),
    DAYS: 2,
    FREE: true,
    HANDLING: 10980,
    DEMURRAGE: 0,
    DOCUMENTATION: 1500,
    DECONSOLIDATION: 1800,
    MISCELLANEOUS: 0,
    TOTALAMOUNT: 14280,
    // 240 below the total. No waiver, discount, tax or rounding column exists.
    NETPAYABLE: 14040,
    PAID: false,
    CASHAMOUNT: 0,
    PayOrder: false,
    PAYORDERNO: null,
    PAYORDERDATE: null,
    PAYORDERAMOUNT: 0,
    RECIEVEDBY: null,
    PAYDATE: null,
    Airline: "QR — Qatar Airways Cargo",
    Pcs: "156 + 2 LOOSE",
    GrossWeight: 2440,
    ChargeableWeight: 2440,
    NatureOfgood: "Sports goods",
    Destination: "JFK",
    Location: "EXP-C1",
    Shippername: "Chenab Sports International",
    AgencyName: "Meridian Freight (Pvt) Ltd",
    Hwbno: "MRD-JFK-40117",
    Hwbpcs: 88,
    HwbGrossWeight: 1310,
    HwbChargableWt: 1310,
    HwbNatureofGood: "Footballs, hand-stitched",
    HwbDest: "JFK",
    HwbLocation: "EXP-C1",
    HwbShipper: "Chenab Sports International",
    GrentAgent: null,
    Grentcnicn: null,
    GrentPrintDate: null,
    GrentTime: null,
  },

  /* ---- 4 · the perishable that ran to E13. Clean, pay-order settled. ---- */
  {
    ...audit("KHI", 2, "s.khan"),
    Voucherno: "EGR-2026-00321",
    GRDATE: at(2, 16, 10),
    CHALLANNO: "CHL-88190",
    AWBNO: "618-44120968",
    ARRIVALDATE: at(6, 4, 30),
    AccpetanceDate: at(6, 6, 5),
    FROMDATE: at(6, 0, 0),
    TODATE: at(2, 0, 0),
    DAYS: 5,
    FREE: false,
    HANDLING: 5880,
    DEMURRAGE: 4900,
    DOCUMENTATION: 1500,
    DECONSOLIDATION: 0,
    MISCELLANEOUS: 1200,
    TOTALAMOUNT: 13480,
    NETPAYABLE: 13480,
    PAID: true,
    CASHAMOUNT: 0,
    PayOrder: true,
    PAYORDERNO: "PO-441097",
    // After GRDATE — a pay order cannot be dated before the voucher it settles.
    PAYORDERDATE: at(2, 16, 20),
    PAYORDERAMOUNT: 13480,
    RECIEVEDBY: "S. Khan",
    PAYDATE: at(2, 16, 30),
    Airline: "KL — KLM Cargo",
    Pcs: "64",
    GrossWeight: 980,
    ChargeableWeight: 980,
    NatureOfgood: "Chilled seafood",
    Destination: "AMS",
    Location: "EXP-COLD-1",
    Shippername: "Karachi Marine Exports",
    AgencyName: "Blue Water Logistics",
    Hwbno: null,
    Hwbpcs: null,
    HwbGrossWeight: null,
    HwbChargableWt: null,
    HwbNatureofGood: null,
    HwbDest: null,
    HwbLocation: null,
    HwbShipper: null,
    GrentAgent: "Blue Water Logistics",
    Grentcnicn: "42201-8830145-3",
    GrentPrintDate: at(2, 16, 45),
    GrentTime: "16:45:00",
  },

  /* ---- 5 · overpaid at the counter. The change went back across the desk and
          the voucher has no column that says so. ---- */
  {
    ...audit("KHI", 2, "f.abbas"),
    Voucherno: "EGR-2026-00322",
    GRDATE: at(2, 12, 20),
    CHALLANNO: "CHL-88205",
    AWBNO: "618-44120979",
    ARRIVALDATE: at(4, 5, 25),
    AccpetanceDate: at(4, 7, 40),
    FROMDATE: at(4, 0, 0),
    TODATE: at(2, 0, 0),
    DAYS: 3,
    FREE: false,
    HANDLING: 19170,
    DEMURRAGE: 3550,
    DOCUMENTATION: 1500,
    DECONSOLIDATION: 0,
    MISCELLANEOUS: 0,
    TOTALAMOUNT: 24220,
    NETPAYABLE: 24220,
    PAID: true,
    CASHAMOUNT: 25000,
    PayOrder: false,
    PAYORDERNO: null,
    PAYORDERDATE: null,
    PAYORDERAMOUNT: 0,
    RECIEVEDBY: "N. Farooq",
    PAYDATE: at(2, 12, 50),
    Airline: "TK — Turkish Cargo",
    Pcs: "122",
    GrossWeight: 4260,
    ChargeableWeight: 4260,
    NatureOfgood: "Machinery parts",
    Destination: "IST",
    Location: "EXP-A3",
    Shippername: "Ravi Engineering Works",
    AgencyName: "Trans-Asia Forwarders",
    Hwbno: null,
    Hwbpcs: null,
    HwbGrossWeight: null,
    HwbChargableWt: null,
    HwbNatureofGood: null,
    HwbDest: null,
    HwbLocation: null,
    HwbShipper: null,
    GrentAgent: "Trans-Asia Forwarders",
    Grentcnicn: "35201-2298764-7",
    GrentPrintDate: at(2, 12, 55),
    GrentTime: "12:55:00",
  },

  /* ---- 6 · the same AWB again. It was offloaded for payload at E12, came back
          to warehousing, and started accruing a second time. Nothing on this
          row records that it continues EGR-2026-00322 — the export table has
          no GRREFERENCE. ---- */
  {
    ...audit("KHI", 0, "f.abbas"),
    Voucherno: "EGR-2026-00327",
    GRDATE: at(0, 10, 15),
    CHALLANNO: null,
    AWBNO: "618-44120979",
    ARRIVALDATE: at(4, 5, 25),
    AccpetanceDate: at(4, 7, 40),
    // Opens the day after EGR-2026-00322 closed — correct for a continuation,
    // and only checkable because the screen infers the pair from a shared
    // AWBNO. The row itself does not know it has a predecessor.
    FROMDATE: at(1, 0, 0),
    TODATE: at(0, 0, 0),
    DAYS: 2,
    FREE: false,
    HANDLING: 0,
    DEMURRAGE: 7242,
    DOCUMENTATION: 0,
    DECONSOLIDATION: 0,
    MISCELLANEOUS: 600,
    TOTALAMOUNT: 7842,
    NETPAYABLE: 7842,
    PAID: false,
    CASHAMOUNT: 0,
    PayOrder: false,
    PAYORDERNO: null,
    PAYORDERDATE: null,
    PAYORDERAMOUNT: 0,
    RECIEVEDBY: null,
    PAYDATE: null,
    Airline: "TK — Turkish Cargo",
    Pcs: "122",
    GrossWeight: 4260,
    ChargeableWeight: 4260,
    NatureOfgood: "Machinery parts",
    Destination: "IST",
    Location: "EXP-A3",
    Shippername: "Ravi Engineering Works",
    AgencyName: "Trans-Asia Forwarders",
    Hwbno: null,
    Hwbpcs: null,
    HwbGrossWeight: null,
    HwbChargableWt: null,
    HwbNatureofGood: null,
    HwbDest: null,
    HwbLocation: null,
    HwbShipper: null,
    GrentAgent: null,
    Grentcnicn: null,
    GrentPrintDate: null,
    GrentTime: null,
  },
];

/* ================================================================== *
 * Queries
 * ================================================================== */

export function listExportRents(scope: SiteScope = "HQ"): ExportGodownRent[] {
  return scope === "HQ"
    ? EXPORT_GODOWN_RENTS
    : EXPORT_GODOWN_RENTS.filter((v) => v.site === scope);
}

/**
 * Every voucher cut against one AWB.
 *
 * This is the only relation the export table supports between two vouchers —
 * a shared `AWBNO` and nothing else. The import side would carry `GRREFERENCE`
 * to say that one continues the other; here that fact is unrecorded, so the
 * grouping is an inference the screen makes, not a link the data holds.
 */
export function exportRentsForAwb(awbNo: string): ExportGodownRent[] {
  return EXPORT_GODOWN_RENTS.filter((v) => v.AWBNO === awbNo);
}
