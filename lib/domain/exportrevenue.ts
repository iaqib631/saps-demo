/**
 * AirVault domain — export revenue share (FC-11 §25, the revenue half).
 *
 * CMTS source: `INTERNATIONALCARGO` (44 columns). No form, no interface, no
 * screen — the migration gap report scores the best existing overlap at 18%
 * (`/export/uplift` renders 6 of 43), which is the AWB number, the flight and
 * the route. Nothing anywhere models the money.
 *
 * WHAT THIS IS, IN ONE LINE
 * -------------------------
 * `ExportGodownrent` records what the terminal **invoices** a shipper for
 * holding cargo. This records what the terminal **earns** on the carriage
 * itself once the agent has been paid — the same booking seen from the revenue
 * side rather than the receivables side. CMTS_SCOPE_DECISIONS Q3 retains the
 * model in full, commission and share included, because it is the only record
 * anywhere in the schema that the two figures are different.
 *
 * WHY THIS SCREEN IS A SPLIT AND NOT A FORM
 * -----------------------------------------
 * Ten of the 43 columns are money and six are rates or freights. Rendered flat
 * they are a wall of numbers with no relation between them. Rendered as what
 * they are — a rate ladder resolving into a division of one pot between two
 * parties — they answer the only question the table exists to answer: of the
 * PKR 450,000 this booking billed, how much did the terminal keep.
 *
 * THE HARD PART, STATED PLAINLY
 * -----------------------------
 * The database is schema-only (schema audit §0) and **no stored procedure
 * touches this table**. So the arithmetic connecting these columns is not
 * documented anywhere: it has to be read off the column names, and reading is
 * not knowing. This module therefore separates three tiers and never lets them
 * blur — see `Confidence` and `REVENUE_READING`:
 *
 *   • `identity`   — true by what the words mean. A rate is per kilo, so a rate
 *                    times a chargeable weight is a freight amount. Checkable
 *                    against the stored figure, and it fails on one row here.
 *   • `inferred`   — a plausible reading of the names, unproven. Marked as
 *                    inferred ON SCREEN, not just in a comment.
 *   • `unresolved` — cannot be settled from names, types or procedures. Listed
 *                    as an open question rather than guessed at.
 *
 * The screen consequently derives the split rather than asserting it: it takes
 * the measured difference between two stored figures and searches the row's own
 * money columns for a combination that equals it (`attribute`). Where a
 * combination is found the arithmetic is discovered, not imposed; where none
 * is, the gap is reported as unattributed. That is the difference between
 * showing a client a relationship and inventing one for them.
 *
 * THE FIXTURES ARE SYNTHESISED — AND THAT MATTERS HERE MORE THAN USUAL
 * -------------------------------------------------------------------
 * Every CMTS table is empty, so these six rows are invented. They are built to
 * the reading in `REVENUE_READING`, which means the checks below mostly pass —
 * and that agreement is a property of the demo data, NOT evidence about how
 * CMTS computes anything. `RevenueReading.circularityWarning` carries that
 * sentence to the screen, and the screen renders it beside the split rather
 * than in a footnote, on the same principle CMTS_SCOPE_DECISIONS applies to the
 * illustrative rate card: an invention that gets mistaken for an extract is the
 * one failure mode with real consequences.
 *
 * THE CMTS MISSPELLINGS ARE DELIBERATE — DO NOT "CORRECT" THEM
 * -----------------------------------------------------------
 * `TARRIFRATE` (double r), `RECIEPTNO`, `RECIEPTDATE`, `CHRGWEIGHT` and
 * `DECLVALUE` are spelt exactly as the legacy schema spells them. Parity means
 * matching the source including its typos — a migration script looks for the
 * column CMTS has, not the one we wish it had. Renaming any of them here
 * silently breaks the mapping this prototype exists to prove. They are in the
 * same family as `RECIEVEDBY` on `GODOWNRENT`, `AccpetanceDate` on
 * `ExportGodownrent` and `Nonuseabel` on `CHARGETYPE`.
 *
 * Out of scope per the standing rules: surrogate keys and index columns. Note
 * that `SEQUENCE` is NOT one of those and is modelled — it is carried on 11
 * CMTS tables (schema audit §1) as half of a composite business key, and here
 * it is the only thing that distinguishes two revenue rows cut against the same
 * AWB. Dropping it would merge a revision into its original. The six audit
 * columns come from `AuditColumns` via `DomainRecord`.
 */

import {
  DEMO_NOW,
  MS_PER_DAY,
  formatPkr,
  round2,
  type Amount,
  type DomainRecord,
  type SiteCode,
  type SiteScope,
} from "./common";

/* ================================================================== *
 * The record — CMTS `INTERNATIONALCARGO`, all 43 business columns
 * ================================================================== */

export interface InternationalCargo extends DomainRecord {
  /* ---- identity. AWBNO alone does not identify a row. ---- */
  /** CMTS `varchar(20)`. Joined to everything else by naming convention only. */
  AWBNO: string;
  /**
   * CMTS `numeric`. The second half of the key: a re-cut revenue row against
   * the same AWB gets the next SEQUENCE. Nothing on the row says that one
   * supersedes another — no supersedes-reference, no void flag, no reason — so
   * "which of these two is live" is a question the table cannot answer.
   */
  SEQUENCE: number;
  /** The booking date the revenue is recognised against. */
  CARGODATE: string;
  /** CMTS `varchar(15)`. */
  FLIGHTNO: string;

  /* ---- the consignment ---- */
  /** CMTS `varchar(40)` — the whole goods description, in 40 characters. */
  GOODS: string;
  /** CMTS `varchar(3)` — IATA station. */
  ORIGIN: string;
  /** CMTS `varchar(3)` — IATA station. */
  DESTINATION: string;
  GROSSWEIGHT: number;
  /**
   * CMTS `float`. A piece count held as a floating-point number, so it can and
   * does hold 156.5. The same quantity is `varchar(50)` on `ExportGodownrent`
   * and `int` on its house block — three tables, three types, one count.
   */
  PIECES: number;
  /** CMTS spelling of "charge weight". Deliberate. This is what money is priced on. */
  CHRGWEIGHT: number;

  /* ---- the rate stack: four rates, three freights, no currency ---- */
  /** CMTS spelling — two r's. Deliberate. The rate off the tariff card. */
  TARRIFRATE: number;
  /** The rate actually applied. Nothing records which of the others it came from. */
  RATE: number;
  /** RATE × CHRGWEIGHT, when the row is consistent. */
  FREIGHT: number;
  FEE: number;
  TOTAL: number;
  /** CMTS spelling of "declared value". Deliberate. Declared value for carriage. */
  DECLVALUE: number;

  /* ---- collection ---- */
  /** CMTS `varchar(20)`, free text. `CPaymentMode` exists as a master and is not referenced. */
  PAYMODE: string;
  /** CMTS `varchar(30)`. The only instrument-number column, whatever the instrument. */
  CHEQUENO: string | null;
  /** CMTS spelling of "receipt no". Deliberate. */
  RECIEPTNO: string | null;
  /** CMTS spelling of "receipt date". Deliberate. `datetime2`. */
  RECIEPTDATE: string | null;

  /* ---- parties, as free text. SHIPPER / CONSIGNEE / AGENCY masters exist. ---- */
  CONSIGNEENAME: string;
  CONSIGNEEADDRESS: string;
  CONSIGNEEPHONE: string | null;
  CONSIGNEEEMAIL: string | null;
  SHIPPERNAME: string;
  SHIPPERADDRESS: string;
  SHIPPERPHONE: string | null;
  SHIPPEREMAIL: string | null;

  /** CMTS `varchar(40)` — the only narrative field on a row that can carry a negotiated rate. */
  REMARKS: string | null;
  /** CMTS `varchar(30)` — shorter than several real forwarder names. */
  AGENCYNAME: string;
  /** CMTS `varchar(20)`, free text. */
  SHIPMENTTYPE: string;

  /* ---- the revenue split ---- */
  OTHERCHARGES: number;
  /** The SAPS portion of the other charges. Nothing constrains it to sit inside them. */
  SAPSOTHERCHARGES: number;
  /** The published IATA tariff rate. */
  IATARATE: number;
  /** IATARATE × CHRGWEIGHT — what the carriage would have billed at list. */
  IATAFREIGHT: number;
  /** The third freight figure, and the only one with no rate column behind it. */
  NNFREIGHT: number;
  /** A negotiated rate. No approver column, no effective dates, no counterparty. */
  SPECIALRATE: number;
  INCENTIVEAMOUNT: number;
  AGENCYCOMMISSION: number;
  PAYABLE: number;
  /** What the terminal keeps. Stored as an amount, with no percentage behind it. */
  SAPSSHARE: number;

  /* ---- control ---- *
   * Two single characters govern whether this row is live and whether its
   * money is sanctioned. Between them they carry no name, no date and no
   * reason. */
  /** CMTS `varchar(1)` — a delete flag, alongside the audit column `IsDeleted`. */
  DFLAG: string;
  /** CMTS `varchar(1)` — an approval flag with no approver, date or reason. */
  APPROVED: string;

  site: SiteCode;
}

/* ================================================================== *
 * How confident we are in each relationship
 *
 * Rendered on screen against every derived figure. The tier is the point: a
 * reader has to be able to tell, at a glance and without reading prose, which
 * numbers are arithmetic and which are somebody's reading of a column name.
 * ================================================================== */

export type Confidence =
  /** True by what the words mean, and checkable against the stored figure. */
  | "identity"
  /** A plausible reading of the column names. Unproven. */
  | "inferred"
  /** Cannot be settled from names, types or procedures. Not guessed at. */
  | "unresolved";

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  identity: "ARITHMETIC",
  inferred: "INFERRED",
  unresolved: "UNRESOLVED",
};

export interface ReadingEntry {
  claim: string;
  confidence: Confidence;
  basis: string;
}

export interface RevenueReading {
  entries: ReadingEntry[];
  /** The open questions, stated as questions rather than answered. */
  unresolved: ReadingEntry[];
  circularityWarning: string;
}

/**
 * Everything this module believes about `INTERNATIONALCARGO`, with the evidence
 * for each belief, as data so the screen renders it rather than paraphrasing
 * it. Nothing in the analysis below uses a relationship that is not listed
 * here, and nothing listed here is used without its tier being shown.
 */
export const REVENUE_READING: RevenueReading = {
  entries: [
    {
      claim: "FREIGHT = RATE × CHRGWEIGHT",
      confidence: "identity",
      basis:
        "An air-cargo rate is quoted per kilo and the AWB itself computes the carriage charge as rate × chargeable weight. A rate column beside a chargeable-weight column and a freight column admits no other reading. Checkable, and one row here fails it.",
    },
    {
      claim: "IATAFREIGHT = IATARATE × CHRGWEIGHT",
      confidence: "identity",
      basis: "The same identity at the published tariff rate rather than the applied one.",
    },
    {
      claim: "RATE is the rate that was applied, selected from TARRIFRATE, SPECIALRATE or IATARATE",
      confidence: "inferred",
      basis:
        "Three rate columns and a fourth called simply RATE, and only RATE has a freight column behind it. Which of the three it was taken from is not recorded — but it is observable, because on any given row RATE either equals one of them or equals none.",
    },
    {
      claim: "TOTAL = FREIGHT + FEE",
      confidence: "inferred",
      basis:
        "The three columns are adjacent in the table in that order, and holds on every row in this set. Whether OTHERCHARGES belongs inside TOTAL is a separate question the schema does not answer — see the unresolved list.",
    },
    {
      claim: "NNFREIGHT is the freight net of what is given away — 'net-net', the standard forwarding term",
      confidence: "inferred",
      basis:
        "NNFREIGHT is the only freight column with no rate column behind it, and it sits below FREIGHT on every row. 'Net net' is ordinary trade usage for the rate left after commission and discount. The schema cannot confirm the expansion of the abbreviation.",
    },
    {
      claim: "AGENCYCOMMISSION and INCENTIVEAMOUNT are outflows — money leaving the terminal",
      confidence: "inferred",
      basis:
        "A commission is paid to an agent and an incentive is paid to win volume. Both reduce the gap between FREIGHT and NNFREIGHT on every row in this set.",
    },
    {
      claim: "SAPSSHARE is what the terminal keeps; PAYABLE is what is owed onward",
      confidence: "inferred",
      basis:
        "The SAPS- prefix pairs a total with the terminal's portion of it, exactly as OTHERCHARGES pairs with SAPSOTHERCHARGES. That makes SAPSSHARE a portion of something and PAYABLE the remainder. Which figure it is a portion OF is not recorded — the screen measures it rather than asserting it.",
    },
  ],
  unresolved: [
    {
      claim: "Is PAYABLE payable BY the customer, or payable TO the carrier?",
      confidence: "unresolved",
      basis:
        "Both readings are ordinary. Nothing on the row names a counterparty, and there is no second amount column to disambiguate. The two readings put the money in opposite directions.",
    },
    {
      claim: "Do OTHERCHARGES and SAPSOTHERCHARGES sit inside TOTAL or outside it?",
      confidence: "unresolved",
      basis:
        "They are stored far from the FREIGHT / FEE / TOTAL block, which suggests a later addition, and TOTAL reaches FREIGHT + FEE without them. Two readers can therefore produce two different gross figures from one row.",
    },
    {
      claim: "What percentage is AGENCYCOMMISSION, and of what base?",
      confidence: "unresolved",
      basis:
        "There is no percentage column — only an amount. The implied percentage can be computed against FREIGHT or against IATAFREIGHT and the screen shows both, but nothing on the row says which was intended or whether a rate was used at all.",
    },
    {
      claim: "What is SAPSSHARE a share of, and at what rate?",
      confidence: "unresolved",
      basis:
        "Stored as an amount with no percentage and no named base. The retention figure the screen shows is derived from the stored numbers and varies row to row; whether that variation is commercial or a keying error is not decidable from the table.",
    },
    {
      claim: "What currency are any of these ten money columns in?",
      confidence: "unresolved",
      basis:
        "There is no currency column. IATA tariffs are published in the currency of the country of departure or in USD; a revenue split between two parties with no currency recorded is not reconstructable if a rate was ever quoted in anything but PKR.",
    },
  ],
  circularityWarning:
    "Every CMTS table is empty, so the six rows below are synthesised — and they were built to the reading above. The checks passing therefore shows that this demo is internally consistent. It is NOT evidence that CMTS computes it this way, and it must not be presented to SAPS as though it were.",
};

/* ================================================================== *
 * Money comparison
 * ================================================================== */

/** Compared at paisa resolution, not at the rupee `formatPkr` displays. */
const EPSILON = 0.005;

function agrees(a: Amount, b: Amount): boolean {
  return Math.abs(a - b) < EPSILON;
}

/** Rates print to two decimals; `formatPkr` rounds to whole rupees, which is wrong for a per-kg figure. */
export function formatRate(n: number): string {
  return `PKR ${n.toLocaleString("en-PK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} / kg`;
}

/* ================================================================== *
 * The rate stack
 *
 * Six rate-or-freight columns, and they do not pair up. Two rates have a
 * freight column behind them and can be checked; two rates have none and are
 * priced nowhere; one freight has no rate and cannot be checked at all. That
 * asymmetry is the finding, so the model is built to make it visible rather
 * than to hide it behind a tidy list of six numbers.
 * ================================================================== */

export type RateSource = "tariff" | "special" | "iata" | "none";

export const RATE_SOURCE_LABEL: Record<RateSource, string> = {
  tariff: "the tariff card",
  special: "the negotiated special rate",
  iata: "the published IATA rate",
  none: "no rate on this row",
};

/**
 * Which of the three candidate rates `RATE` was taken from — observed by
 * comparison, not read off a column, because CMTS has no column that records
 * it. A zero `SPECIALRATE` is treated as "none negotiated" rather than as a
 * rate of zero: a rate column that means both is one of this table's problems,
 * and matching `RATE = 0` against it would report a free carriage as a
 * successfully applied special rate.
 */
export function appliedRateSource(r: InternationalCargo): RateSource {
  if (r.SPECIALRATE > 0 && agrees(r.RATE, r.SPECIALRATE)) return "special";
  if (r.TARRIFRATE > 0 && agrees(r.RATE, r.TARRIFRATE)) return "tariff";
  if (r.IATARATE > 0 && agrees(r.RATE, r.IATARATE)) return "iata";
  return "none";
}

export interface RateRung {
  label: string;
  /** The rate column, or null where a freight figure has no rate behind it. */
  rateCmts: string | null;
  rate: number | null;
  /** The freight column this rate produces, or null where the rate is priced nowhere. */
  freightCmts: string | null;
  freightStored: Amount | null;
  /** rate × CHRGWEIGHT. Null when there is no rate. */
  freightImplied: Amount | null;
  /** Null when there is nothing to compare — one side of the pair is missing. */
  agrees: boolean | null;
  /** True where `RATE` was taken from this rung. */
  applied: boolean;
  note: string;
}

export function rateStack(r: InternationalCargo): RateRung[] {
  const kg = r.CHRGWEIGHT;
  const source = appliedRateSource(r);

  const rung = (
    label: string,
    rateCmts: string | null,
    rate: number | null,
    freightCmts: string | null,
    freightStored: Amount | null,
    applied: boolean,
    note: string,
  ): RateRung => {
    const freightImplied = rate === null ? null : round2(rate * kg);
    return {
      label,
      rateCmts,
      rate,
      freightCmts,
      freightStored,
      freightImplied,
      agrees:
        freightImplied === null || freightStored === null
          ? null
          : agrees(freightImplied, freightStored),
      applied,
      note,
    };
  };

  return [
    rung(
      "Published IATA tariff",
      "IATARATE",
      r.IATARATE,
      "IATAFREIGHT",
      r.IATAFREIGHT,
      source === "iata",
      "The list price for this carriage. Both halves of the pair exist, so the multiplication is checkable.",
    ),
    rung(
      "Tariff card rate",
      "TARRIFRATE",
      r.TARRIFRATE,
      null,
      null,
      source === "tariff",
      "The rate off the card. There is no TARRIFFREIGHT column, so what this rate would have billed is computed here and stored nowhere.",
    ),
    rung(
      "Negotiated special rate",
      "SPECIALRATE",
      r.SPECIALRATE > 0 ? r.SPECIALRATE : null,
      null,
      null,
      source === "special",
      r.SPECIALRATE > 0
        ? "A rate agreed off the card. No approver, no effective dates, no counterparty — and a 40-character REMARKS is the only place to say why."
        : "Zero. On a float rate column that means both 'none negotiated' and 'agreed at zero', and nothing distinguishes them.",
    ),
    rung(
      "Rate applied",
      "RATE",
      r.RATE,
      "FREIGHT",
      r.FREIGHT,
      true,
      source === "none"
        ? "Matches none of the three rates above. Where the applied rate came from is not recoverable from this row."
        : `Equals ${RATE_SOURCE_LABEL[source]} — observed by comparison, because no column records the selection.`,
    ),
    rung(
      "Net-net freight",
      null,
      null,
      "NNFREIGHT",
      r.NNFREIGHT,
      false,
      "The one freight figure with no rate column behind it. Nothing can check what it was computed from; it can only be measured against the freight above it.",
    ),
  ];
}

/* ================================================================== *
 * Gap attribution — deriving the split instead of asserting it
 *
 * Take the measured difference between two stored figures and search the row's
 * OWN money columns for a combination that equals it. A match is a discovery
 * about the data; a miss is a gap that no column on the table can account for.
 * Neither is a formula this module imposed, which is the whole point: an
 * invented formula that looks authoritative is worse than an acknowledged gap,
 * because a client cannot tell the two apart.
 * ================================================================== */

export interface MoneyColumn {
  cmts: string;
  label: string;
  amount: Amount;
}

export interface Attribution {
  /** Columns whose amounts sum to the gap, or the closest combination under it. */
  columns: string[];
  /** True where the combination reaches the gap exactly. */
  exact: boolean;
  /** Gap − Σ matched. Zero when exact; what no column can explain when not. */
  residual: Amount;
  /**
   * Other distinct combinations that also reach the gap exactly. Non-zero means
   * the row is consistent with more than one reading and cannot say which — a
   * finding in its own right, not a rounding artefact.
   */
  alternatives: number;
}

/**
 * Subset search over the candidate columns, preferring the smallest
 * combination. Zero-valued columns are excluded before the search: a zero
 * matches every gap trivially and would attribute a difference to a column that
 * contributed nothing to it.
 *
 * Deterministic by construction — fixed candidate order, fixed tie-break, no
 * RNG. Capped at 14 candidates (16k subsets), which is well above the ten money
 * columns this table carries.
 */
export function attribute(gap: Amount, candidates: MoneyColumn[]): Attribution {
  const live = candidates.filter((c) => Math.abs(c.amount) > EPSILON).slice(0, 14);
  const exact: string[][] = [];
  let bestUnder: { cols: string[]; sum: number } = { cols: [], sum: 0 };

  for (let mask = 1; mask < 1 << live.length; mask++) {
    let sum = 0;
    const cols: string[] = [];
    for (let i = 0; i < live.length; i++) {
      if (mask & (1 << i)) {
        sum += live[i].amount;
        cols.push(live[i].cmts);
      }
    }
    sum = round2(sum);
    if (Math.abs(sum - gap) < EPSILON) exact.push(cols);
    else if (sum < gap && sum > bestUnder.sum) bestUnder = { cols, sum };
  }

  if (exact.length > 0) {
    // Fewest columns wins; ties broken on the joined name so the result is
    // stable across renders rather than dependent on iteration order.
    exact.sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    return { columns: exact[0], exact: true, residual: 0, alternatives: exact.length - 1 };
  }
  return {
    columns: bestUnder.cols,
    exact: false,
    residual: round2(gap - bestUnder.sum),
    alternatives: 0,
  };
}

/* ================================================================== *
 * The ladder — billed at the top, retained at the bottom
 * ================================================================== */

export interface LadderStep {
  label: string;
  cmts: string;
  amount: Amount;
  confidence: Confidence;
  why: string;
  /** Difference from the step above. Null on the opening rung. */
  gap: Amount | null;
  /** What accounts for that difference, searched out of the row's own columns. */
  attribution: Attribution | null;
  /** True where this figure is ABOVE the one before it — the ladder runs backwards. */
  inverted: boolean;
}

/** Every money column on the row, in table order — the search space for `attribute`. */
export function moneyColumns(r: InternationalCargo): MoneyColumn[] {
  return [
    { cmts: "FREIGHT", label: "Freight charged", amount: r.FREIGHT },
    { cmts: "FEE", label: "Fee", amount: r.FEE },
    { cmts: "TOTAL", label: "Total billed", amount: r.TOTAL },
    { cmts: "OTHERCHARGES", label: "Other charges", amount: r.OTHERCHARGES },
    { cmts: "SAPSOTHERCHARGES", label: "SAPS other charges", amount: r.SAPSOTHERCHARGES },
    { cmts: "IATAFREIGHT", label: "Freight at the IATA rate", amount: r.IATAFREIGHT },
    { cmts: "NNFREIGHT", label: "Net-net freight", amount: r.NNFREIGHT },
    { cmts: "INCENTIVEAMOUNT", label: "Incentive", amount: r.INCENTIVEAMOUNT },
    { cmts: "AGENCYCOMMISSION", label: "Agency commission", amount: r.AGENCYCOMMISSION },
    { cmts: "PAYABLE", label: "Payable", amount: r.PAYABLE },
    { cmts: "SAPSSHARE", label: "SAPS share", amount: r.SAPSSHARE },
  ];
}

/**
 * TOTAL → FREIGHT → NNFREIGHT → PAYABLE, each gap attributed out of the row's
 * remaining money columns.
 *
 * The ORDER is inferred, not known — it is the descending order the reading in
 * `REVENUE_READING` implies. A row whose stored figures contradict it produces
 * a negative gap, and that is surfaced as `inverted` rather than silently
 * absolute-valued, because a ladder that climbs is exactly the condition a
 * reader needs to see.
 */
export function revenueLadder(r: InternationalCargo): LadderStep[] {
  const all = moneyColumns(r);
  const raw: Array<Omit<LadderStep, "gap" | "attribution" | "inverted">> = [
    {
      label: "Billed to the customer",
      cmts: "TOTAL",
      amount: r.TOTAL,
      confidence: "inferred",
      why: "FREIGHT + FEE. The figure the shipper or agent is asked for, before anything is paid away.",
    },
    {
      label: "Freight charged for the carriage",
      cmts: "FREIGHT",
      amount: r.FREIGHT,
      confidence: "identity",
      why: "RATE × CHRGWEIGHT. The carriage on its own, with the fee stripped out.",
    },
    {
      label: "Net-net freight",
      cmts: "NNFREIGHT",
      amount: r.NNFREIGHT,
      confidence: "inferred",
      why: "The freight left after what was given away to the agent. The pot that gets divided.",
    },
    {
      label: "Payable onward",
      cmts: "PAYABLE",
      amount: r.PAYABLE,
      confidence: "unresolved",
      why: "Whether this is payable BY the customer or TO the carrier is not recorded. It is rendered where the numbers put it, not where a reading puts it.",
    },
  ];

  return raw.map((step, i) => {
    const above = i === 0 ? null : raw[i - 1];
    const gap = above === null ? null : round2(above.amount - step.amount);
    const inverted = gap !== null && gap < -EPSILON;
    /*
     * The two endpoints are excluded from their own attribution. Leaving them
     * in lets a gap be "explained" by one of the figures it was measured
     * between, which is not an explanation of anything.
     */
    const attribution =
      gap === null || inverted || Math.abs(gap) < EPSILON
        ? null
        : attribute(
            gap,
            all.filter((c) => c.cmts !== step.cmts && c.cmts !== above!.cmts),
          );
    return { ...step, gap, attribution, inverted };
  });
}

/* ================================================================== *
 * The division — what the terminal keeps
 * ================================================================== */

export interface RevenueSplit {
  /** The pot, per the reading: NNFREIGHT. */
  pot: Amount;
  payable: Amount;
  sapsShare: Amount;
  /** pot − payable − sapsShare. Non-zero means money fell out of the division. */
  residual: Amount;
  divides: boolean;
  /** SAPSSHARE ÷ TOTAL. Derived here; no percentage is stored anywhere. */
  retentionOfBilled: number;
  /** SAPSSHARE ÷ NNFREIGHT. Derived. */
  retentionOfPot: number;
}

export function revenueSplit(r: InternationalCargo): RevenueSplit {
  const residual = round2(r.NNFREIGHT - r.PAYABLE - r.SAPSSHARE);
  return {
    pot: r.NNFREIGHT,
    payable: r.PAYABLE,
    sapsShare: r.SAPSSHARE,
    residual,
    divides: Math.abs(residual) < EPSILON,
    retentionOfBilled: r.TOTAL > 0 ? r.SAPSSHARE / r.TOTAL : 0,
    retentionOfPot: r.NNFREIGHT > 0 ? r.SAPSSHARE / r.NNFREIGHT : 0,
  };
}

/**
 * The commission as a percentage, computed against both plausible bases.
 *
 * Both are shown because nothing on the row says which was intended, and
 * picking one would turn an open question into an assertion. Where one comes
 * out at a round figure and the other does not, that is a reader's evidence —
 * not this module's conclusion.
 */
export function commissionRates(r: InternationalCargo): {
  ofFreight: number | null;
  ofIataFreight: number | null;
} {
  return {
    ofFreight: r.FREIGHT > 0 ? r.AGENCYCOMMISSION / r.FREIGHT : null,
    ofIataFreight: r.IATAFREIGHT > 0 ? r.AGENCYCOMMISSION / r.IATAFREIGHT : null,
  };
}

/* ================================================================== *
 * Competing readings, tested against the row
 *
 * Each is a claim someone could reasonably make about these columns. The row is
 * measured against all of them and the screen reports which survive. Where two
 * survive, the data cannot choose between them and says so.
 * ================================================================== */

export interface ReadingCheck {
  code: string;
  claim: string;
  confidence: Confidence;
  lhs: Amount;
  rhs: Amount;
  delta: Amount;
  holds: boolean;
  note: string;
}

export function readingChecks(r: InternationalCargo): ReadingCheck[] {
  const check = (
    code: string,
    claim: string,
    confidence: Confidence,
    lhs: Amount,
    rhs: Amount,
    note: string,
  ): ReadingCheck => ({
    code,
    claim,
    confidence,
    lhs: round2(lhs),
    rhs: round2(rhs),
    delta: round2(lhs - rhs),
    holds: agrees(lhs, rhs),
    note,
  });

  return [
    check(
      "freight-is-rate-by-weight",
      "FREIGHT = RATE × CHRGWEIGHT",
      "identity",
      r.FREIGHT,
      round2(r.RATE * r.CHRGWEIGHT),
      "The AWB's own arithmetic. A failure here is a keying or rounding fault, not an open question.",
    ),
    check(
      "iata-freight-is-rate-by-weight",
      "IATAFREIGHT = IATARATE × CHRGWEIGHT",
      "identity",
      r.IATAFREIGHT,
      round2(r.IATARATE * r.CHRGWEIGHT),
      "The same identity at the published rate.",
    ),
    check(
      "total-is-freight-plus-fee",
      "TOTAL = FREIGHT + FEE",
      "inferred",
      r.TOTAL,
      round2(r.FREIGHT + r.FEE),
      "Reading the three adjacent columns in order.",
    ),
    check(
      "total-includes-other",
      "TOTAL = FREIGHT + FEE + OTHERCHARGES",
      "inferred",
      r.TOTAL,
      round2(r.FREIGHT + r.FEE + r.OTHERCHARGES),
      "The competing reading: other charges inside the total rather than beside it. Where OTHERCHARGES is zero the two readings are indistinguishable on this row.",
    ),
    check(
      "nn-is-freight-less-giveaway",
      "NNFREIGHT = FREIGHT − AGENCYCOMMISSION − INCENTIVEAMOUNT",
      "inferred",
      r.NNFREIGHT,
      round2(r.FREIGHT - r.AGENCYCOMMISSION - r.INCENTIVEAMOUNT),
      "The 'net-net' reading of NN.",
    ),
    check(
      "pot-divides",
      "NNFREIGHT = PAYABLE + SAPSSHARE",
      "inferred",
      r.NNFREIGHT,
      round2(r.PAYABLE + r.SAPSSHARE),
      "The net-net pot divided between the carrier and the terminal. This is the reading the demo fixtures were built to — see the circularity note.",
    ),
    check(
      "payable-is-the-invoice",
      "PAYABLE = TOTAL",
      "unresolved",
      r.PAYABLE,
      r.TOTAL,
      "The competing reading of PAYABLE: the amount payable BY the customer rather than TO the carrier. It fails on these rows because they were synthesised to the reading above, which is not evidence against it in CMTS.",
    ),
    check(
      "saps-other-inside-other",
      "SAPSOTHERCHARGES ≤ OTHERCHARGES",
      "inferred",
      Math.min(r.SAPSOTHERCHARGES, r.OTHERCHARGES),
      r.SAPSOTHERCHARGES,
      "A containment check rather than an equality: if the SAPS- prefix means 'the terminal's portion of', the portion cannot exceed the whole.",
    ),
  ];
}

/* ================================================================== *
 * Checks the row fails on its own terms
 *
 * Everything here is decidable from the row without settling any of the open
 * questions above. These are faults, not ambiguities.
 * ================================================================== */

export interface RevenueBreak {
  title: string;
  detail: string;
  /** Money at stake, where the fault has an amount. Zero where it does not. */
  delta: Amount;
  severity: "money" | "control" | "data";
}

/** The value set CMTS's own `CPaymentMode` master would constrain this to, if it were referenced. */
export const CANONICAL_PAYMODES = ["CASH", "CHEQUE", "PAY ORDER", "CREDIT", "BANK TRANSFER"];

export function revenueBreaks(
  r: InternationalCargo,
  siblings: InternationalCargo[] = [],
): RevenueBreak[] {
  const breaks: RevenueBreak[] = [];
  const checks = readingChecks(r);
  const byCode = (c: string) => checks.find((x) => x.code === c)!;
  const source = appliedRateSource(r);

  const freightCheck = byCode("freight-is-rate-by-weight");
  if (!freightCheck.holds) {
    breaks.push({
      title: "FREIGHT does not equal RATE × CHRGWEIGHT",
      detail: `${formatRate(r.RATE)} on ${r.CHRGWEIGHT} kg comes to ${formatPkr(
        freightCheck.rhs,
      )}; the row stores ${formatPkr(
        freightCheck.lhs,
      )}. This is the one relationship on the table that is not open to interpretation — a rate times a weight is a freight — so the difference is a fault, and because every figure below FREIGHT is measured from it, the whole split inherits the error.`,
      delta: freightCheck.delta,
      severity: "money",
    });
  }

  const iataCheck = byCode("iata-freight-is-rate-by-weight");
  if (!iataCheck.holds) {
    breaks.push({
      title: "IATAFREIGHT does not equal IATARATE × CHRGWEIGHT",
      detail: `The published-tariff pair does not multiply out either: ${formatPkr(
        iataCheck.rhs,
      )} against a stored ${formatPkr(
        iataCheck.lhs,
      )}. The IATA figure is the benchmark the applied rate is judged against, so a wrong benchmark misstates the discount rather than the bill.`,
      delta: iataCheck.delta,
      severity: "money",
    });
  }

  if (source === "none") {
    breaks.push({
      title: "The applied rate matches none of the three rate columns",
      detail: `RATE is ${formatRate(r.RATE)}. TARRIFRATE is ${formatRate(
        r.TARRIFRATE,
      )}, SPECIALRATE is ${
        r.SPECIALRATE > 0 ? formatRate(r.SPECIALRATE) : "zero"
      } and IATARATE is ${formatRate(
        r.IATARATE,
      )}. CMTS has no column recording where an applied rate came from, so when it matches none of them the basis of the charge is simply not on the record — and REMARKS, at varchar(40), is the only place anyone could have written it down.`,
      delta: 0,
      severity: "money",
    });
  }

  if (r.RATE > r.IATARATE + EPSILON) {
    breaks.push({
      title: "The applied rate is above the published IATA rate",
      detail: `${formatRate(r.RATE)} against a published ${formatRate(
        r.IATARATE,
      )}. Charging over the published tariff is a commercial decision somebody has to have taken, and this table records approval as a single character with no approver and no date behind it.`,
      delta: round2((r.RATE - r.IATARATE) * r.CHRGWEIGHT),
      severity: "money",
    });
  }

  if (r.CHRGWEIGHT < r.GROSSWEIGHT - EPSILON) {
    breaks.push({
      title: "CHRGWEIGHT is below GROSSWEIGHT",
      detail: `Chargeable weight is max(actual, volumetric) rounded up to the next half kilo — it cannot be less than the weight on the scale. ${r.CHRGWEIGHT} kg is being priced against a gross of ${r.GROSSWEIGHT} kg, so ${round2(
        r.GROSSWEIGHT - r.CHRGWEIGHT,
      )} kg of this consignment is carried and not billed.`,
      delta: round2((r.GROSSWEIGHT - r.CHRGWEIGHT) * r.RATE),
      severity: "money",
    });
  }

  if (!Number.isInteger(r.PIECES)) {
    breaks.push({
      title: "PIECES is not a whole number",
      detail: `The column is a float and holds ${r.PIECES}. A piece is a physical package; there is no such thing as half of one. The same count is varchar(50) on ExportGodownrent — where one row in that set holds "156 + 2 LOOSE" — and int on its house block. Three tables, three types, and no two of them can be totalled together without a decision about what a piece is.`,
      delta: 0,
      severity: "data",
    });
  }

  const split = revenueSplit(r);
  if (!split.divides) {
    breaks.push({
      title: "The split does not add up",
      detail: `PAYABLE + SAPSSHARE come to ${formatPkr(
        round2(r.PAYABLE + r.SAPSSHARE),
      )} against an NNFREIGHT of ${formatPkr(
        r.NNFREIGHT,
      )}. No column on this table can hold the difference: there is no tax column, no rounding column, no adjustment column and no second share. Whatever happened to it happened off the record.`,
      delta: split.residual,
      severity: "money",
    });
  }

  if (r.SAPSOTHERCHARGES > r.OTHERCHARGES + EPSILON) {
    breaks.push({
      title: "SAPSOTHERCHARGES exceeds OTHERCHARGES",
      detail: `The terminal's portion of the other charges is ${formatPkr(
        r.SAPSOTHERCHARGES,
      )} and the other charges themselves are ${formatPkr(
        r.OTHERCHARGES,
      )}. If the SAPS- prefix means what it means on every other pair in this schema, a portion is larger than the whole it is a portion of. If it does not mean that, then nothing on this table says what these two columns are to each other.`,
      delta: round2(r.SAPSOTHERCHARGES - r.OTHERCHARGES),
      severity: "money",
    });
  }

  if (r.APPROVED !== "Y") {
    breaks.push({
      title:
        r.APPROVED.trim() === ""
          ? "APPROVED is blank — neither approved nor refused"
          : "The row carries money and is not approved",
      detail: `APPROVED is varchar(1) and holds ${
        r.APPROVED.trim() === "" ? "an empty string" : `"${r.APPROVED}"`
      } on a row billing ${formatPkr(
        r.TOTAL,
      )} and retaining ${formatPkr(
        r.SAPSSHARE,
      )}. The column permits any single character, so "approved", "refused" and "nobody has looked at it yet" are all spelt in the same varchar(1) with no approver, no date and no reason beside them. The import waiver chain runs through three named approval levels (FC-07 §10–12) for a smaller decision than this one.`,
      delta: r.SAPSSHARE,
      severity: "control",
    });
  }

  if (r.DFLAG.toUpperCase() === "Y" && !r.IsDeleted) {
    breaks.push({
      title: "DFLAG says deleted and the audit column says live",
      detail: `DFLAG is "${r.DFLAG}" and IsDeleted is false. This table carries two deletion mechanisms that do not agree, so whether this row's ${formatPkr(
        r.TOTAL,
      )} appears in a revenue report depends entirely on which column the report happens to read. A migration has to pick one, and picking wrongly either resurrects voided revenue or drops live revenue.`,
      delta: r.TOTAL,
      severity: "control",
    });
  }

  if (!CANONICAL_PAYMODES.includes(r.PAYMODE)) {
    breaks.push({
      title: `PAYMODE holds "${r.PAYMODE}", which is outside the expected value set`,
      detail: `CMTS has a CPaymentMode master table and this varchar(20) does not reference it, so the payment mode is whatever the operator typed. Case, spacing and spelling are all unconstrained — a report grouping revenue by payment mode splits one mode across every variant anyone has ever keyed.`,
      delta: 0,
      severity: "data",
    });
  }

  if (r.CHEQUENO && r.PAYMODE.toUpperCase() === "CASH") {
    breaks.push({
      title: "An instrument number is recorded against a cash payment",
      detail: `PAYMODE is CASH and CHEQUENO holds "${r.CHEQUENO}". There is exactly one instrument-number column on this table, whatever the instrument, so it is also where pay-order and transfer references end up — and nothing distinguishes a cash row with a stale number from a cash row with a real one.`,
      delta: 0,
      severity: "data",
    });
  }

  if (r.RECIEPTDATE && Date.parse(r.RECIEPTDATE) < Date.parse(r.CARGODATE)) {
    breaks.push({
      title: "RECIEPTDATE precedes CARGODATE",
      detail: `The receipt is dated ${new Date(
        r.RECIEPTDATE,
      ).toDateString()} against a cargo date of ${new Date(
        r.CARGODATE,
      ).toDateString()} — money receipted before the booking it settles existed. Nothing in the schema constrains the order of the two.`,
      delta: 0,
      severity: "data",
    });
  }

  const others = siblings.filter((s) => s.SEQUENCE !== r.SEQUENCE);
  if (others.length > 0) {
    breaks.push({
      title: `${others.length + 1} revenue rows against one AWB, and nothing says which is live`,
      detail: `SEQUENCE ${others
        .map((s) => s.SEQUENCE)
        .concat(r.SEQUENCE)
        .sort((a, b) => a - b)
        .join(", ")} all carry the same AWBNO and the same CARGODATE. There is no supersedes-reference, no void flag and no revision reason, so whether these are amendments, corrections or duplicates is not decidable from the table — and a report that sums TOTAL over this AWB counts ${formatPkr(
        round2(others.reduce((n, s) => n + s.TOTAL, 0) + r.TOTAL),
      )} where the carriage was sold once.`,
      delta: round2(others.reduce((n, s) => n + s.TOTAL, 0)),
      severity: "control",
    });
  }

  if (r.SPECIALRATE > 0 && !r.REMARKS) {
    breaks.push({
      title: "A rate was agreed off the card and nothing says why",
      detail: `SPECIALRATE is ${formatRate(r.SPECIALRATE)} against a card rate of ${formatRate(
        r.TARRIFRATE,
      )} — ${formatPkr(
        round2((r.TARRIFRATE - r.SPECIALRATE) * r.CHRGWEIGHT),
      )} of freight given away — and REMARKS is null. That column is varchar(40) and it is the only narrative field on the row, so even a filled one could not hold much of an explanation.`,
      delta: round2((r.TARRIFRATE - r.SPECIALRATE) * r.CHRGWEIGHT),
      severity: "control",
    });
  }

  return breaks;
}

/* ================================================================== *
 * Field-length pressure
 *
 * Three columns on this table are narrower than the values they hold. A value
 * sitting exactly at the declared width is the interesting case: it is either
 * complete or it was cut, and the row cannot say which.
 * ================================================================== */

export interface WidthCheck {
  cmts: string;
  label: string;
  declared: number;
  value: string | null;
  length: number;
  atLimit: boolean;
  consequence: string;
}

export function widthChecks(r: InternationalCargo): WidthCheck[] {
  const w = (
    cmts: string,
    label: string,
    declared: number,
    value: string | null,
    consequence: string,
  ): WidthCheck => ({
    cmts,
    label,
    declared,
    value,
    length: value?.length ?? 0,
    atLimit: (value?.length ?? 0) >= declared,
    consequence,
  });

  return [
    w(
      "AGENCYNAME",
      "Agency",
      30,
      r.AGENCYNAME,
      "The commission on this row is paid to this name, and CMTS has an AGENCY master this column does not reference. A truncated name cannot be matched back to it.",
    ),
    w(
      "REMARKS",
      "Remarks",
      40,
      r.REMARKS,
      "The only free-text field on a row that can carry a negotiated rate, an unapproved revision and a share of revenue.",
    ),
    w(
      "GOODS",
      "Goods",
      40,
      r.GOODS,
      "The whole cargo description, in the width of a short sentence.",
    ),
  ];
}

/* ================================================================== *
 * What INTERNATIONALCARGO cannot record
 * ================================================================== */

export interface RevenueLimit {
  code: string;
  title: string;
  /** What elsewhere in CMTS or AirVault does hold this, for contrast. */
  elsewhere: string;
  consequence: string;
  /** True where the limit holds on every row by construction. */
  always: boolean;
  bites: (r: InternationalCargo, siblings: number) => boolean;
}

export const REVENUE_LIMITS: RevenueLimit[] = [
  {
    code: "no-currency",
    title: "No currency column anywhere on the table",
    elsewhere: "nothing in CMTS carries a currency — the assumption is global and unrecorded",
    consequence:
      "Six rate columns and ten money columns with no unit on any of them. IATA tariffs are published in the currency of the country of departure or in USD; the moment one rate on one booking was quoted in anything but PKR, the split on that row is unreconstructable and nothing marks it.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-share-basis",
    title: "SAPSSHARE is an amount with no percentage and no named base",
    elsewhere: "GODOWNRENT.WAIVEOFFPERCENT stores the rate beside the amount it produced",
    consequence:
      "The terminal's retention can be computed after the fact but never checked. A share keyed 10,000 too low looks exactly like a share that was commercially agreed 10,000 lower, and no report can tell them apart.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-approver",
    title: "APPROVED is one character with no approver, date or reason",
    elsewhere:
      "the FC-07 §10–12 waiver chain — three named approval levels, with WAIVEOFFREASON behind them",
    consequence:
      "The decision this flag governs is a division of revenue between two parties. It is sanctioned by a character that anybody with write access can set, and no column records who did or when.",
    always: true,
    bites: (r) => r.APPROVED !== "Y",
  },
  {
    code: "two-delete-flags",
    title: "DFLAG varchar(1) sits alongside the audit column IsDeleted",
    elsewhere: "~60 CMTS tables carry the six audit columns; this one adds a second delete flag",
    consequence:
      "Two mechanisms for one state, and a varchar(1) can spell it Y, N, 1, 0, a space or null. Which one a migration or a report trusts changes what the revenue figure is.",
    always: true,
    bites: (r) => r.DFLAG.toUpperCase() === "Y" && !r.IsDeleted,
  },
  {
    code: "no-rate-source",
    title: "Nothing records which rate was applied or why",
    elsewhere: "the tariff master carries effective dates and a rate card; this row carries neither",
    consequence:
      "Four rate columns and no selection column. Where the applied rate matches one of the others the source can be observed; where it matches none, the basis of the charge is off the record entirely.",
    always: false,
    bites: (r) => appliedRateSource(r) === "none",
  },
  {
    code: "no-supersedes",
    title: "A re-cut revenue row cannot point at the one it replaces",
    elsewhere: "GODOWNRENT.GRREFERENCE links a supplementary voucher to its parent",
    consequence:
      "Two rows sharing an AWBNO and a CARGODATE, distinguished only by SEQUENCE. Nothing says the later one supersedes the earlier, so both are live to anything that sums the column.",
    always: false,
    bites: (_r, siblings) => siblings > 1,
  },
  {
    code: "no-tax",
    title: "No tax column",
    elsewhere: "GODOWNRENTDETAIL.TaxPercentage / Tax / TaxAmount, and TaxType.IsDo for the split",
    consequence:
      "Whether TOTAL is tax-inclusive is not recorded. The same ambiguity as the export rent voucher, on a table where the number is then divided between two parties.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-valuation-charge",
    title: "DECLVALUE is captured and nothing prices it",
    elsewhere: "the IATA valuation charge is a percentage of declared value in excess of the free limit",
    consequence:
      "A declared value is recorded and there is no valuation-charge column beside it. If a valuation charge was levied it went into FEE, where nothing separates it from the handling fee.",
    always: false,
    bites: (r) => r.DECLVALUE > 0,
  },
  {
    code: "parties-free-text",
    title: "Eight party columns hold free text while three party masters exist",
    elsewhere: "SHIPPER (11 cols), CONSIGNEE (13), AGENCY (11) — none of them referenced from here",
    consequence:
      "The shipper, consignee and agency on this row are strings. The same shipper on two bookings is two strings, and the commission paid to an agency cannot be totalled by agency without matching names.",
    always: true,
    bites: () => true,
  },
  {
    code: "no-link-to-consignment",
    title: "Nothing links this row to the acceptance or the rent voucher",
    elsewhere: "CARGOACCEPTANCE keys on CARGODATE + CARGOID; this table carries neither",
    consequence:
      "The revenue row and the charging row for the same booking are related by a shared AWBNO and a naming convention. Schema audit §1: the cargo core has essentially no referential integrity, and this table is inside it.",
    always: true,
    bites: () => true,
  },
];

/* ================================================================== *
 * Cross-row observations
 *
 * Some faults are only visible across the set. A varchar(1) flag looks fine on
 * any single row and is chaos over six.
 * ================================================================== */

export interface FlagCensus {
  cmts: string;
  label: string;
  /** Distinct stored values, with how many rows carry each. */
  values: Array<{ value: string; display: string; count: number }>;
  note: string;
}

export function flagCensus(rows: InternationalCargo[]): FlagCensus[] {
  const tally = (get: (r: InternationalCargo) => string) => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(get(r), (map.get(get(r)) ?? 0) + 1);
    return [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([value, count]) => ({
        value,
        display: value.trim() === "" ? "(empty string)" : value,
        count,
      }));
  };

  return [
    {
      cmts: "DFLAG",
      label: "Delete flag",
      values: tally((r) => r.DFLAG),
      note: "varchar(1). Every distinct spelling below is a state some reader has to interpret, and the audit column IsDeleted is answering the same question separately.",
    },
    {
      cmts: "APPROVED",
      label: "Approval flag",
      values: tally((r) => r.APPROVED),
      note: "varchar(1). Nothing constrains the value set, so the difference between refused and not-yet-looked-at is whatever convention the operators kept in their heads.",
    },
    {
      cmts: "PAYMODE",
      label: "Payment mode",
      values: tally((r) => r.PAYMODE),
      note: "varchar(20) with a CPaymentMode master that this column does not reference. Case and spacing are unconstrained.",
    },
  ];
}

/* ================================================================== *
 * Reconciliation — everything the screen needs for one row
 * ================================================================== */

export interface RevenueReconciliation {
  rates: RateRung[];
  rateSource: RateSource;
  ladder: LadderStep[];
  split: RevenueSplit;
  checks: ReadingCheck[];
  widths: WidthCheck[];
  breaks: RevenueBreak[];
  commission: { ofFreight: number | null; ofIataFreight: number | null };
  /** IATAFREIGHT − FREIGHT: the discount off the published tariff. Negative where charged over it. */
  discountOffIata: Amount;
}

export function reconcileRevenue(
  r: InternationalCargo,
  siblings: InternationalCargo[] = [],
): RevenueReconciliation {
  return {
    rates: rateStack(r),
    rateSource: appliedRateSource(r),
    ladder: revenueLadder(r),
    split: revenueSplit(r),
    checks: readingChecks(r),
    widths: widthChecks(r),
    breaks: revenueBreaks(r, siblings),
    commission: commissionRates(r),
    discountOffIata: round2(r.IATAFREIGHT - r.FREIGHT),
  };
}

/* ================================================================== *
 * Fixtures
 *
 * Six revenue rows over the five export consignments in `fixtures.ts`, keyed on
 * the same AWB numbers so this screen, `/export/acceptance` and
 * `/export/billing` are talking about the same cargo. Hand-authored rather than
 * generated: every figure is load-bearing for one check or another, and a
 * seeded RNG would make the faults accidental instead of chosen.
 *
 * Deterministic — no Math.random, no Date.now. Dates hang off DEMO_NOW exactly
 * as `fixtures.ts` does, and the CARGODATE of each row is the acceptance day of
 * the consignment it belongs to.
 *
 * THE MONEY IS INVENTED. See `REVENUE_READING.circularityWarning`. The values
 * are deliberately round — 400.00/kg, a 5% commission, a 2% incentive — so that
 * nobody mistakes them for an extract, on the same principle
 * CMTS_SCOPE_DECISIONS applies to the illustrative rate card.
 *
 * Each row carries something the screen has to survive:
 *   1. clean — every check holds, special rate applied and recorded
 *   2. card rate applied, a name at the varchar(30) limit and a remark cut off
 *      mid-word at varchar(40), receipt dated before the cargo
 *   3. the re-cut of row 2 — unapproved, unexplained, sharing row 2's cheque,
 *      and 8,006 of the split going nowhere
 *   4. FREIGHT does not equal RATE × CHRGWEIGHT, the applied rate matches no
 *      rate column, PIECES is 156.5, APPROVED is blank, SAPSOTHERCHARGES
 *      exceeds OTHERCHARGES
 *   5. clean and closed — the perishable that ran the flow to §25
 *   6. the offloaded consignment: DFLAG set against a live audit column, and a
 *      chargeable weight below the gross
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
    CreatedDate: at(createdDaysAgo, 13, 5),
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
    site,
  };
}

export const INTERNATIONAL_CARGO: InternationalCargo[] = [
  /* ---- 1 · clean. Special rate applied and recorded, cash settled. ---- */
  {
    ...audit("KHI", 3, "r.jamil"),
    AWBNO: "618-44120935",
    SEQUENCE: 1,
    CARGODATE: at(3, 7, 55),
    FLIGHTNO: "EK-600",
    GOODS: "Surgical instruments",
    ORIGIN: "KHI",
    DESTINATION: "DXB",
    GROSSWEIGHT: 1240,
    PIECES: 84,
    CHRGWEIGHT: 1240,
    TARRIFRATE: 360,
    RATE: 350,
    FREIGHT: 434000,
    FEE: 16000,
    TOTAL: 450000,
    DECLVALUE: 0,
    PAYMODE: "CASH",
    CHEQUENO: null,
    RECIEPTNO: "ICR-2026-01188",
    RECIEPTDATE: at(3, 15, 20),
    CONSIGNEENAME: "Gulf Medical Supplies FZE",
    CONSIGNEEADDRESS: "Jebel Ali Free Zone, Dubai, UAE",
    CONSIGNEEPHONE: "+971-4-8831200",
    CONSIGNEEEMAIL: "ops@gulfmedical.ae",
    SHIPPERNAME: "Sialkot Surgical Works (Pvt) Ltd",
    SHIPPERADDRESS: "Industrial Estate, Sialkot, Pakistan",
    SHIPPERPHONE: "+92-52-4265510",
    SHIPPEREMAIL: "exports@sialkotsurgical.pk",
    REMARKS: "Agent rate per Q3 volume agreement",
    AGENCYNAME: "Skyline Cargo Services",
    SHIPMENTTYPE: "GENERAL",
    OTHERCHARGES: 12500,
    SAPSOTHERCHARGES: 4500,
    IATARATE: 400,
    IATAFREIGHT: 496000,
    NNFREIGHT: 403620,
    SPECIALRATE: 350,
    INCENTIVEAMOUNT: 8680,
    AGENCYCOMMISSION: 21700,
    PAYABLE: 323620,
    SAPSSHARE: 80000,
    DFLAG: "N",
    APPROVED: "Y",
  },

  /* ---- 2 · the consolidation. Card rate, an agency name sitting exactly on
          the varchar(30) boundary, a remark cut off mid-word at 40, and a
          receipt dated the day before the cargo. ---- */
  {
    ...audit("LHE", 2, "m.rauf"),
    AWBNO: "618-44120946",
    SEQUENCE: 1,
    CARGODATE: at(2, 7, 20),
    FLIGHTNO: "BA-601",
    GOODS: "Cotton garments",
    ORIGIN: "LHE",
    DESTINATION: "LHR",
    GROSSWEIGHT: 3180,
    PIECES: 210,
    // Volumetric above actual — garments cube out, so the chargeable figure is
    // the volume one. This is the normal case, not a fault.
    CHRGWEIGHT: 3240,
    TARRIFRATE: 480,
    RATE: 480,
    FREIGHT: 1555200,
    FEE: 32400,
    TOTAL: 1587600,
    DECLVALUE: 4200000,
    PAYMODE: "CHEQUE",
    CHEQUENO: "CHQ-0044182",
    RECIEPTNO: "ICR-2026-01191",
    // Before CARGODATE. Nothing in the schema orders the two.
    RECIEPTDATE: at(3, 12, 10),
    CONSIGNEENAME: "Northgate Apparel Ltd",
    CONSIGNEEADDRESS: "Unit 14, Heathrow Cargo Centre, London, UK",
    CONSIGNEEPHONE: "+44-20-88970140",
    CONSIGNEEEMAIL: "inbound@northgateapparel.co.uk",
    SHIPPERNAME: "Style Textile (Pvt) Ltd",
    SHIPPERADDRESS: "Quaid-e-Azam Industrial Estate, Lahore, Pakistan",
    SHIPPERPHONE: "+92-42-35112200",
    SHIPPEREMAIL: null,
    // Exactly 40 characters, and it ends mid-word. Complete or truncated is not
    // decidable from the row.
    REMARKS: "Card rate; no special rate on file for t",
    // Exactly 30 characters — sitting on the declared width.
    AGENCYNAME: "Indus Consolidators (Pvt) Ltd.",
    SHIPMENTTYPE: "CONSOLIDATION",
    OTHERCHARGES: 0,
    SAPSOTHERCHARGES: 0,
    IATARATE: 520,
    IATAFREIGHT: 1684800,
    NNFREIGHT: 1477440,
    SPECIALRATE: 0,
    INCENTIVEAMOUNT: 0,
    AGENCYCOMMISSION: 77760,
    PAYABLE: 1227440,
    SAPSSHARE: 250000,
    DFLAG: "N",
    APPROVED: "Y",
  },

  /* ---- 3 · the same AWB re-cut at a lower rate. Unapproved, unexplained,
          settled against the same cheque as SEQUENCE 1, and 8,006 of the split
          landing nowhere. ---- */
  {
    ...audit("LHE", 0, "m.rauf"),
    AWBNO: "618-44120946",
    SEQUENCE: 2,
    // Identical to SEQUENCE 1 — the cargo date does not move when the revenue
    // row is re-cut, which is exactly why SEQUENCE is load-bearing.
    CARGODATE: at(2, 7, 20),
    FLIGHTNO: "BA-601",
    GOODS: "Cotton garments",
    ORIGIN: "LHE",
    DESTINATION: "LHR",
    GROSSWEIGHT: 3180,
    PIECES: 210,
    CHRGWEIGHT: 3240,
    TARRIFRATE: 480,
    RATE: 455,
    FREIGHT: 1474200,
    FEE: 32400,
    TOTAL: 1506600,
    DECLVALUE: 4200000,
    PAYMODE: "CHEQUE",
    // The same instrument as SEQUENCE 1. Two revenue rows, one cheque, and
    // nothing saying which of them it settles.
    CHEQUENO: "CHQ-0044182",
    RECIEPTNO: null,
    RECIEPTDATE: null,
    CONSIGNEENAME: "Northgate Apparel Ltd",
    CONSIGNEEADDRESS: "Unit 14, Heathrow Cargo Centre, London, UK",
    CONSIGNEEPHONE: "+44-20-88970140",
    CONSIGNEEEMAIL: "inbound@northgateapparel.co.uk",
    SHIPPERNAME: "Style Textile (Pvt) Ltd",
    SHIPPERADDRESS: "Quaid-e-Azam Industrial Estate, Lahore, Pakistan",
    SHIPPERPHONE: "+92-42-35112200",
    SHIPPEREMAIL: null,
    // A 25/kg cut, PKR 81,000 of freight, and not a word about it.
    REMARKS: null,
    AGENCYNAME: "Indus Consolidators (Pvt) Ltd.",
    SHIPMENTTYPE: "CONSOLIDATION",
    OTHERCHARGES: 0,
    SAPSOTHERCHARGES: 0,
    IATARATE: 520,
    IATAFREIGHT: 1684800,
    NNFREIGHT: 1371006,
    SPECIALRATE: 455,
    INCENTIVEAMOUNT: 29484,
    AGENCYCOMMISSION: 73710,
    // 1,132,000 + 231,000 = 1,363,000 against an NNFREIGHT of 1,371,006.
    // 8,006 has no column to sit in.
    PAYABLE: 1132000,
    SAPSSHARE: 231000,
    DFLAG: "N",
    APPROVED: "N",
  },

  /* ---- 4 · the row where the arithmetic itself fails. ---- */
  {
    ...audit("KHI", 1, "r.jamil"),
    AWBNO: "618-44120957",
    SEQUENCE: 1,
    CARGODATE: at(1, 8, 10),
    FLIGHTNO: "QR-602",
    GOODS: "Sports goods",
    ORIGIN: "KHI",
    DESTINATION: "JFK",
    GROSSWEIGHT: 2440,
    // A float piece count, holding what "156 + 2 LOOSE" became when somebody
    // had to key it into a number.
    PIECES: 156.5,
    CHRGWEIGHT: 2440,
    TARRIFRATE: 575,
    // Matches none of TARRIFRATE, SPECIALRATE or IATARATE.
    RATE: 590,
    // 590 × 2440 = 1,439,600. The row stores 7,600 less, and every figure
    // below inherits the error.
    FREIGHT: 1432000,
    FEE: 24400,
    TOTAL: 1456400,
    DECLVALUE: 0,
    // Outside the CPaymentMode value set — mixed case, unconstrained column.
    PAYMODE: "Credit",
    CHEQUENO: null,
    RECIEPTNO: null,
    RECIEPTDATE: null,
    CONSIGNEENAME: "Atlantic Sports Inc",
    CONSIGNEEADDRESS: "Building 77, JFK Air Cargo Center, New York, USA",
    CONSIGNEEPHONE: "+1-718-5510440",
    CONSIGNEEEMAIL: null,
    SHIPPERNAME: "Chenab Sports International",
    SHIPPERADDRESS: "Small Industrial Estate, Sialkot, Pakistan",
    SHIPPERPHONE: "+92-52-3574180",
    SHIPPEREMAIL: "sales@chenabsports.pk",
    REMARKS: "Rate agreed on call - confirm",
    AGENCYNAME: "Meridian Freight (Pvt) Ltd",
    SHIPMENTTYPE: "GENERAL",
    OTHERCHARGES: 18000,
    // Larger than the charges it claims to be a portion of.
    SAPSOTHERCHARGES: 22000,
    IATARATE: 610,
    IATAFREIGHT: 1488400,
    NNFREIGHT: 1360400,
    SPECIALRATE: 0,
    INCENTIVEAMOUNT: 0,
    AGENCYCOMMISSION: 71600,
    PAYABLE: 1142400,
    SAPSSHARE: 218000,
    DFLAG: "0",
    // varchar(1) holding a blank — neither approved nor refused.
    APPROVED: "",
  },

  /* ---- 5 · the perishable that ran to §25. Clean, settled by pay order. ---- */
  {
    ...audit("KHI", 6, "s.khan"),
    AWBNO: "618-44120968",
    SEQUENCE: 1,
    CARGODATE: at(6, 6, 5),
    FLIGHTNO: "KL-603",
    GOODS: "Chilled seafood",
    ORIGIN: "KHI",
    DESTINATION: "AMS",
    GROSSWEIGHT: 980,
    PIECES: 64,
    // Insulated boxes cube out well ahead of their weight.
    CHRGWEIGHT: 1180,
    TARRIFRATE: 420,
    RATE: 420,
    FREIGHT: 495600,
    FEE: 23600,
    TOTAL: 519200,
    DECLVALUE: 0,
    PAYMODE: "PAY ORDER",
    // A pay-order number in a column called CHEQUENO — the only instrument
    // column this table has.
    CHEQUENO: "PO-441097",
    RECIEPTNO: "ICR-2026-01174",
    RECIEPTDATE: at(5, 11, 0),
    CONSIGNEENAME: "Noordzee Verse Vis B.V.",
    CONSIGNEEADDRESS: "Schiphol Zuidoost, Amsterdam, Netherlands",
    CONSIGNEEPHONE: "+31-20-4054420",
    CONSIGNEEEMAIL: "inkoop@noordzeevis.nl",
    SHIPPERNAME: "Karachi Marine Exports",
    SHIPPERADDRESS: "Fish Harbour, West Wharf, Karachi, Pakistan",
    SHIPPERPHONE: "+92-21-32313040",
    SHIPPEREMAIL: "cold@karachimarine.pk",
    REMARKS: "Perishable - PER handling, cold chain",
    AGENCYNAME: "Blue Water Logistics",
    SHIPMENTTYPE: "PERISHABLE",
    OTHERCHARGES: 6000,
    SAPSOTHERCHARGES: 6000,
    IATARATE: 445,
    IATAFREIGHT: 525100,
    NNFREIGHT: 470820,
    SPECIALRATE: 0,
    INCENTIVEAMOUNT: 0,
    AGENCYCOMMISSION: 24780,
    PAYABLE: 376820,
    SAPSSHARE: 94000,
    DFLAG: "N",
    APPROVED: "Y",
  },

  /* ---- 6 · offloaded at §23 and voided by DFLAG, while the audit column still
          says live. Chargeable weight below the gross on top of it. ---- */
  {
    ...audit("KHI", 4, "r.jamil"),
    AWBNO: "618-44120979",
    SEQUENCE: 1,
    CARGODATE: at(4, 7, 40),
    FLIGHTNO: "TK-604",
    GOODS: "Machinery parts",
    ORIGIN: "KHI",
    DESTINATION: "IST",
    GROSSWEIGHT: 4260,
    PIECES: 122,
    // 80 kg below the scale figure. Chargeable is max(actual, volumetric) — it
    // cannot be less than gross.
    CHRGWEIGHT: 4180,
    TARRIFRATE: 310,
    RATE: 296,
    FREIGHT: 1237280,
    FEE: 41800,
    TOTAL: 1279080,
    DECLVALUE: 1850000,
    PAYMODE: "CASH",
    // An instrument number against a cash payment.
    CHEQUENO: "CHQ-0044090",
    RECIEPTNO: null,
    RECIEPTDATE: null,
    CONSIGNEENAME: "Marmara Endustri A.S.",
    CONSIGNEEADDRESS: "Ataturk Cargo Terminal, Istanbul, Turkiye",
    CONSIGNEEPHONE: "+90-212-4658810",
    CONSIGNEEEMAIL: null,
    SHIPPERNAME: "Ravi Engineering Works",
    SHIPPERADDRESS: "Kot Lakhpat Industrial Area, Lahore, Pakistan",
    SHIPPERPHONE: "+92-42-35830112",
    SHIPPEREMAIL: "despatch@raviengineering.pk",
    REMARKS: "Offloaded TK-604 - payload; revoiced",
    AGENCYNAME: "Trans-Asia Forwarders",
    SHIPMENTTYPE: "GENERAL",
    OTHERCHARGES: 9000,
    SAPSOTHERCHARGES: 3000,
    IATARATE: 330,
    IATAFREIGHT: 1379400,
    NNFREIGHT: 1150416,
    SPECIALRATE: 296,
    INCENTIVEAMOUNT: 25000,
    AGENCYCOMMISSION: 61864,
    PAYABLE: 955416,
    SAPSSHARE: 195000,
    // Voided here and live in the audit columns.
    DFLAG: "Y",
    APPROVED: "Y",
  },
];

/* ================================================================== *
 * Queries
 * ================================================================== */

export function listExportRevenue(scope: SiteScope = "HQ"): InternationalCargo[] {
  return scope === "HQ"
    ? INTERNATIONAL_CARGO
    : INTERNATIONAL_CARGO.filter((r) => r.site === scope);
}

/**
 * Every revenue row cut against one AWB.
 *
 * A shared `AWBNO` is the only relation this table supports between two rows —
 * there is no supersedes-reference — so the grouping is an inference the screen
 * makes, not a link the data holds.
 */
export function revenueForAwb(awbNo: string): InternationalCargo[] {
  return INTERNATIONAL_CARGO.filter((r) => r.AWBNO === awbNo).sort(
    (a, b) => a.SEQUENCE - b.SEQUENCE,
  );
}

/** The row a report would treat as live: the highest SEQUENCE not flagged deleted. */
export function liveRevenueForAwb(awbNo: string): InternationalCargo | null {
  const rows = revenueForAwb(awbNo).filter((r) => r.DFLAG.toUpperCase() !== "Y");
  return rows.length === 0 ? null : rows[rows.length - 1];
}
