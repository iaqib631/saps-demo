/**
 * Voucher arithmetic — the modelling half of "how was this total reached".
 *
 * WHY THIS EXISTS
 * ---------------
 * The Godown Rent screen printed `NETPAYABLE` and four of the seven `sum*`
 * roll-ups, and nothing on the page connected either to the GODOWNRENTDETAIL
 * lines underneath. A voucher total with no visible derivation is the one
 * number a finance officer cannot sign off, because reconciling it against the
 * legacy voucher means re-adding it by hand.
 *
 * So this file does not format anything. It rebuilds every identity the voucher
 * claims and reports whether each one HOLDS, and by how much it misses when it
 * does not. The screen renders the answer either way — a failed identity is
 * surfaced, never suppressed, because a roll-up that silently disagrees with
 * its own lines is exactly the migration defect this demo exists to catch.
 *
 * THREE COLUMNS THAT ARE NOT ADDENDS
 * ----------------------------------
 * Getting the arithmetic right is mostly a matter of knowing which
 * GODOWNRENTDETAIL money columns do NOT belong in the sum:
 *
 *   • `MinimumCharges` (CARGOSUBCLASS.MINCHARGES) is a FLOOR, not a charge.
 *     CMTS prices the line and then lifts it to the floor if it came in under
 *     — `max(raw, MINCHARGES)`. Adding it would bill every consignment an
 *     extra minimum on top of the rent it already owes.
 *   • `AFUAmount` is the AFU-classed SLICE OF `SpecialCharges`, not a charge
 *     beside it. Adding both double-bills advance-freight consignments.
 *   • `TaxAmount` duplicates `Tax` — CMTS carries the same figure in both
 *     columns. They are shown together precisely so a migration reader can
 *     confirm they agree rather than assuming it.
 *
 * WHAT THE DETAIL GRID CANNOT HOLD
 * --------------------------------
 * `sumTotalAmountWithoutTax` is reliably LARGER than the priced detail columns
 * add up to, and that is not a bug. Two components of the CMTS subtotal have no
 * GODOWNRENTDETAIL column at all — the FC-07 §07 category surcharge and
 * `GODOWNRENT.MISCELLANEOUS` — and the minimum-charge floor can lift the
 * subtotal above the sum of its own parts. `explainResidual` decomposes that
 * gap exactly, so the difference is named on screen instead of appearing as an
 * unattributed shortfall in the grid.
 */

import {
  cargoClass,
  chargesFor,
  round2,
  storageLocation,
  type Amount,
  type ChargeCalculation,
  type GodownRent,
  type GodownRentDetail,
} from "@/lib/domain";

/**
 * Money is compared at paisa resolution, not at the rounded-rupee resolution
 * `formatPkr` displays at. A reconciliation view that inherits the display
 * rounding would report a genuine half-paisa drift as "balanced" — which is the
 * failure this whole module is meant to detect, so the tolerance is set one
 * order below the smallest unit CMTS stores rather than at the display step.
 */
const EPSILON = 0.005;

function agrees(a: Amount, b: Amount): boolean {
  return Math.abs(a - b) < EPSILON;
}

function total(rows: number[]): Amount {
  return round2(rows.reduce((n, v) => n + v, 0));
}

/**
 * Exact money text. `formatPkr` rounds to whole rupees, which is right for a
 * headline figure and wrong here: a 12,518.90 discrepancy must not render as
 * "PKR 12,519" beside the two figures it fails to bridge, and a residual of
 * 0.50 must not render as "PKR 0". Whole values still print clean, so the
 * decimals only appear when they are carrying information.
 */
export function formatExact(n: Amount): string {
  const whole = Number.isInteger(round2(n));
  return `PKR ${round2(n).toLocaleString("en-PK", {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

/** One priced money column on a detail line, with the unit column that qualifies it. */
export interface ChargeRow {
  label: string;
  /** CMTS `GODOWNRENTDETAIL` column. */
  cmts: string;
  /**
   * The `*UNIT` column describing the basis this amount was charged on. CMTS
   * stores the basis as free text beside the money ("PER KG", "PER KG / DAY"),
   * so it is rendered against the amount it qualifies rather than in a separate
   * units block, where it would read as three unattached strings.
   */
  unit: { value: string; cmts: string } | null;
  amount: Amount;
}

/** A detail line rebuilt as the addition it represents. */
export interface LineLedger {
  detail: GodownRentDetail;
  zone: string;
  classLabel: string;
  /** The additive columns, in the order CMTS prices them. */
  charges: ChargeRow[];
  /** Σ `charges` — what the grid can actually account for. */
  pricedSum: Amount;
  /** `TOTALAMOUNTWITHOUTTAX` − `pricedSum`. Named at voucher level. */
  residual: Amount;
  withoutTax: Amount;
  taxPercent: number;
  /** CMTS `TAXAMOUNT`. */
  taxAmount: Amount;
  /** CMTS `Tax` — the duplicate column, carried so the two can be compared. */
  tax: Amount;
  withTax: Amount;
  /** CMTS `MINIMUMCHARGES` — a floor, never added. */
  minimumCharges: Amount;
  /** True when the floor actually lifted this line, i.e. it is doing work. */
  minimumBinds: boolean;
  /** CMTS `AFUAMOUNT` — a slice of `SPECIALCHARGES`, never added. */
  afuAmount: Amount;
  /** `TAXAMOUNT` = `TOTALAMOUNTWITHOUTTAX` × `TAXPERCENTAGE`%. */
  taxAgrees: boolean;
  /** `TOTALAMOUNTWITHTAX` = `TOTALAMOUNTWITHOUTTAX` + `TAXAMOUNT`. */
  totalAgrees: boolean;
  /** `Tax` and `TAXAMOUNT` carry the same figure. */
  taxColumnsAgree: boolean;
}

/** One header roll-up measured against the detail column it rolls up. */
export interface RollupRow {
  label: string;
  /** CMTS `GODOWNRENT` column. */
  headerCmts: string;
  /** CMTS `GODOWNRENTDETAIL` counterpart — null when the header stands alone. */
  detailCmts: string | null;
  header: Amount;
  /** Σ of the detail column; null when there is no such column to sum. */
  lines: Amount | null;
  delta: Amount;
  agrees: boolean;
}

/** A named component of the gap between the subtotal and the priced columns. */
export interface ResidualPart {
  label: string;
  /** Null where the amount is derived rather than stored in a CMTS column. */
  cmts: string | null;
  amount: Amount;
  why: string;
}

/**
 * One step of the voucher's headline arithmetic, read top to bottom as a sum on
 * paper. `op` is the operator printed to the LEFT of the row, so the opening
 * row carries none and the rows that state a result carry "=".
 */
export interface ChainStep {
  op: "" | "+" | "−" | "=";
  label: string;
  cmts: string;
  amount: Amount;
  /** True where this row is a stated total rather than a term being added. */
  isResult: boolean;
}

/** An identity the voucher claims but does not satisfy. */
export interface ReconBreak {
  title: string;
  detail: string;
  delta: Amount;
}

export interface VoucherReconciliation {
  lines: LineLedger[];
  rollups: RollupRow[];
  /** Σ over lines of `TOTALAMOUNTWITHOUTTAX` − Σ priced columns. */
  residualTotal: Amount;
  residualParts: ResidualPart[];
  /** Residual left over after every named part — must be zero. */
  residualUnexplained: Amount;
  residualExplained: boolean;
  chain: ChainStep[];
  /** What the chain arrives at versus what the header stores. */
  netPayable: Amount;
  netPayableDerived: Amount;
  netPayableAgrees: boolean;
  breaks: ReconBreak[];
}

/**
 * Rebuild one detail line as the addition CMTS performed to reach it.
 *
 * The six columns below are the additive ones and they are listed in pricing
 * order — storage and handling first because they are the rent proper, then the
 * per-consignment service charges. `MinimumCharges`, `AFUAmount`, `Tax` and
 * `TaxAmount` are deliberately absent from `charges`: see the file header for
 * why each is not an addend.
 */
function buildLine(d: GodownRentDetail): LineLedger {
  const charges: ChargeRow[] = [
    {
      label: "Storage",
      cmts: "STORGEUNITCHARGES",
      unit: { value: d.StorgeUnit, cmts: "STORGEUNIT" },
      amount: d.StorgeUnitCharges,
    },
    {
      label: "Handling",
      cmts: "HANDLINGCHARGES",
      unit: { value: d.HandlingUnit, cmts: "HANDLINGUNIT" },
      amount: d.HandlingCharges,
    },
    {
      label: "Location",
      cmts: "LOCATIONCHARGES",
      unit: { value: d.LocationUnit, cmts: "LOCATIONUNIT" },
      amount: d.LocationCharges,
    },
    { label: "Documentation", cmts: "DOCCHARGES", unit: null, amount: d.DocCharges },
    { label: "Deconsolidation", cmts: "DECONSOLIDATION", unit: null, amount: d.Deconsolidation },
    { label: "Special handling", cmts: "SPECIALCHARGES", unit: null, amount: d.SpecialCharges },
  ];

  const pricedSum = total(charges.map((c) => c.amount));
  const taxPercent = Number(d.TaxPercentage);
  const zone = storageLocation(d.LOCATIONID);

  return {
    detail: d,
    zone: zone ? `${zone.ABBREVATION} — ${zone.NAME}` : String(d.LOCATIONID),
    classLabel: `${cargoClass(d.CLASSID).ABBREVATION} / #${d.SUBCLASSID}`,
    charges,
    pricedSum,
    residual: round2(d.TotalAmountWithoutTax - pricedSum),
    withoutTax: d.TotalAmountWithoutTax,
    taxPercent,
    taxAmount: d.TaxAmount,
    tax: d.Tax,
    withTax: d.TotalAmountWithTax,
    minimumCharges: d.MinimumCharges,
    // The floor only bit if the priced line came in under it. Reporting it as
    // "applied" whenever it is merely non-zero would imply a charge was added
    // on eight vouchers where nothing of the sort happened.
    minimumBinds: d.MinimumCharges > d.TotalAmountWithoutTax + EPSILON,
    afuAmount: d.AFUAmount,
    taxAgrees: agrees(d.TaxAmount, round2((d.TotalAmountWithoutTax * taxPercent) / 100)),
    totalAgrees: agrees(d.TotalAmountWithTax, round2(d.TotalAmountWithoutTax + d.TaxAmount)),
    taxColumnsAgree: agrees(d.Tax, d.TaxAmount),
  };
}

/**
 * Name every rupee of the gap between `sumTotalAmountWithoutTax` and the priced
 * detail columns.
 *
 * The decomposition mirrors `calculateCharges` exactly — subtotal =
 * `max(priced + surcharge + miscellaneous, MINCHARGES)` — so the parts are the
 * surcharge, the miscellaneous charge, and whatever the floor added on top. Any
 * remainder after those three is genuinely unexplained and the caller surfaces
 * it as a break rather than absorbing it into the last part, which would make
 * an unaccounted difference look accounted for.
 */
function explainResidual(
  g: GodownRent,
  calc: ChargeCalculation | undefined,
  pricedSum: Amount,
): { parts: ResidualPart[]; residual: Amount; unexplained: Amount } {
  const residual = round2(g.sumTotalAmountWithoutTax - pricedSum);
  const parts: ResidualPart[] = [];

  const surcharge = calc ? total(calc.surcharges.map((s) => s.amount)) : 0;
  if (surcharge > 0) {
    parts.push({
      label:
        calc && calc.surcharges.length > 0
          ? `Category surcharge · ${calc.surcharges.map((s) => `${s.percent}% ${s.code}`).join(" + ")}`
          : "Category surcharge",
      cmts: null,
      amount: surcharge,
      why: "FC-07 §07 — levied on the storage base. CMTS has no GODOWNRENTDETAIL column for it, so it cannot appear on a line.",
    });
  }

  if (g.MISCELLANEOUS > 0) {
    parts.push({
      label: "Miscellaneous",
      cmts: "MISCELLANEOUS",
      amount: g.MISCELLANEOUS,
      why: "Header-only charge — GODOWNRENTDETAIL has no counterpart column, so it never reaches the grid.",
    });
  }

  // `max(raw, MINCHARGES)`: the floor only contributes when the priced line
  // plus the header-only charges came in beneath it.
  const raw = round2(pricedSum + surcharge + g.MISCELLANEOUS);
  const floorUplift = round2(Math.max(0, g.sumMinimumCharges - raw));
  if (floorUplift > 0) {
    parts.push({
      label: "Minimum-charge floor lift",
      cmts: "SUMMINIMUMCHARGES",
      amount: floorUplift,
      why: `CARGOSUBCLASS.MINCHARGES floors the subtotal at ${formatExact(g.sumMinimumCharges)}; the priced line reached only ${formatExact(raw)}.`,
    });
  }

  return {
    parts,
    residual,
    unexplained: round2(residual - total(parts.map((p) => p.amount))),
  };
}

/**
 * The whole voucher, rebuilt from its own columns.
 *
 * Everything here is derived from `g` and its detail lines; the only outside
 * read is the ChargeCalculation, and that is used solely to NAME the surcharge
 * inside the residual. If it is missing the residual still computes — it just
 * reports as unexplained, which is the honest outcome rather than a silent zero.
 */
export function reconcileVoucher(
  g: GodownRent,
  lines: GodownRentDetail[],
  awbId: number | null,
): VoucherReconciliation {
  const ledgers = lines.map(buildLine);
  const calc = awbId !== null ? chargesFor(awbId) : undefined;

  /**
   * Each roll-up is stated as the header column, the detail column it claims to
   * be the sum of, and the accessor for that detail column — so the comparison
   * is written once and cannot drift into summing one column while labelling
   * another.
   */
  const check = (
    label: string,
    headerCmts: string,
    detailCmts: string,
    header: Amount,
    pick: (d: GodownRentDetail) => number,
  ): RollupRow => {
    const linesTotal = total(lines.map(pick));
    return {
      label,
      headerCmts,
      detailCmts,
      header,
      lines: linesTotal,
      delta: round2(header - linesTotal),
      agrees: agrees(header, linesTotal),
    };
  };

  /*
   * Column names are the UPPERCASE CMTS spellings from the migration gap
   * report, not the camelCase TypeScript property names they happen to be
   * modelled under. Parity is checked against the source schema, so the marker
   * has to name the source column — `sumAFUAmount` is this demo's field, and
   * `SUMAFUAMOUNT` is the thing a migration has to find.
   */
  const rollups: RollupRow[] = [
    check("Storage", "SUMSTORGEUNITCHARGES", "STORGEUNITCHARGES", g.sumStorgeUnitCharges, (d) => d.StorgeUnitCharges),
    check("Handling", "SUMHANDLINGCHARGES", "HANDLINGCHARGES", g.sumHandlingCharges, (d) => d.HandlingCharges),
    check("Location", "SUMLOCATIONCHARGESAMOUNT", "LOCATIONCHARGES", g.sumLocationChargesAmount, (d) => d.LocationCharges),
    check("Documentation", "DOCUMENTATION", "DOCCHARGES", g.DOCUMENTATION, (d) => d.DocCharges),
    check("Deconsolidation", "DECONSOLIDATION", "DECONSOLIDATION", g.DECONSOLIDATION, (d) => d.Deconsolidation),
    check("Special handling", "SPECIALHANDLING", "SPECIALCHARGES", g.SPECIALHANDLING, (d) => d.SpecialCharges),
    check("Advance freight (AFU)", "SUMAFUAMOUNT", "AFUAMOUNT", g.sumAFUAmount, (d) => d.AFUAmount),
    check("Minimum-charge floor", "SUMMINIMUMCHARGES", "MINIMUMCHARGES", g.sumMinimumCharges, (d) => d.MinimumCharges),
    check("Sub-total ex-tax", "SUMTOTALAMOUNTWITHOUTTAX", "TOTALAMOUNTWITHOUTTAX", g.sumTotalAmountWithoutTax, (d) => d.TotalAmountWithoutTax),
    check("Tax", "SUMTAX", "TAXAMOUNT", g.sumTax, (d) => d.TaxAmount),
  ];

  // MISCELLANEOUS has no detail counterpart, so it is listed with a null
  // `lines` rather than being compared against zero — "nothing to compare" and
  // "compared and came to nothing" are different findings.
  rollups.push({
    label: "Miscellaneous",
    headerCmts: "MISCELLANEOUS",
    detailCmts: null,
    header: g.MISCELLANEOUS,
    lines: null,
    delta: 0,
    agrees: true,
  });

  const pricedSum = total(ledgers.map((l) => l.pricedSum));
  const { parts, residual, unexplained } = explainResidual(g, calc, pricedSum);

  const netPayableDerived = round2(g.TOTALAMOUNT - g.WAIVEOFFAMOUNT);
  const netPayableAgrees = agrees(g.NETPAYABLE, netPayableDerived);

  const chain: ChainStep[] = [
    { op: "", label: "Sub-total ex-tax", cmts: "SUMTOTALAMOUNTWITHOUTTAX", amount: g.sumTotalAmountWithoutTax, isResult: false },
    { op: "+", label: "Tax", cmts: "SUMTAX", amount: g.sumTax, isResult: false },
    { op: "=", label: "Voucher total", cmts: "TOTALAMOUNT", amount: g.TOTALAMOUNT, isResult: true },
    { op: "−", label: "Waiver", cmts: "WAIVEOFFAMOUNT", amount: g.WAIVEOFFAMOUNT, isResult: false },
    // The closing row states what the header STORES, not what the rows above
    // add up to. Printing the derived figure here would hide precisely the
    // defect this chain exists to expose — the two are compared, not merged.
    { op: "=", label: "Net payable", cmts: "NETPAYABLE", amount: g.NETPAYABLE, isResult: true },
  ];

  const breaks: ReconBreak[] = [];

  for (const r of rollups) {
    if (r.lines !== null && !r.agrees) {
      breaks.push({
        title: `${r.headerCmts} does not equal Σ ${r.detailCmts}`,
        // Both the noun and the verb agree with the line count. A voucher
        // billed against a single zone is the common case, not the exotic one,
        // so "the 1 detail line add up to" is the string that renders most
        // often — and a reconciliation notice that reads as broken English
        // undercuts the figure it is reporting.
        detail: `The header carries ${formatExact(r.header)}; the ${lines.length} detail line${
          lines.length === 1 ? " adds" : "s add"
        } up to ${formatExact(r.lines)}. A roll-up that cannot be reached from its own grid cannot be reconciled against the legacy voucher.`,
        delta: r.delta,
      });
    }
  }

  const totalStep = round2(g.sumTotalAmountWithoutTax + g.sumTax);
  if (!agrees(g.TOTALAMOUNT, totalStep)) {
    breaks.push({
      title: "TOTALAMOUNT does not equal SUMTOTALAMOUNTWITHOUTTAX + SUMTAX",
      detail: `The header stores ${formatExact(g.TOTALAMOUNT)}; its own ex-tax and tax roll-ups come to ${formatExact(totalStep)}.`,
      delta: round2(g.TOTALAMOUNT - totalStep),
    });
  }

  if (!netPayableAgrees) {
    breaks.push({
      title: "NETPAYABLE does not equal TOTALAMOUNT − WAIVEOFFAMOUNT",
      detail:
        `A waiver of ${formatExact(g.WAIVEOFFAMOUNT)} (${g.WAIVEOFFPERCENT}%${
          g.WaivOfStorageOrAmount ? `, ${g.WaivOfStorageOrAmount}` : ""
        }) is recorded on this voucher, but NETPAYABLE still carries the full ${formatExact(
          g.TOTALAMOUNT,
        )} — so the consignee is billed as though the waiver had never been approved. ` +
        (g.WaivOfStorageOrAmount === "STORAGE"
          ? "The rate-tier table below already shows the waiver against the storage bands, which is why the two net figures on this page disagree."
          : "Deducting it would give " + formatExact(netPayableDerived) + "."),
      delta: round2(g.NETPAYABLE - netPayableDerived),
    });
  }

  if (Math.abs(unexplained) >= EPSILON) {
    breaks.push({
      title: "Part of the sub-total cannot be attributed to any column",
      detail: `${formatExact(
        unexplained,
      )} of SUMTOTALAMOUNTWITHOUTTAX is left over after the priced detail columns, the surcharge, MISCELLANEOUS and the minimum-charge floor are accounted for.`,
      delta: unexplained,
    });
  }

  for (const l of ledgers) {
    if (!l.taxAgrees) {
      breaks.push({
        title: `Line ${l.detail.Id}: TAXAMOUNT is not ${l.taxPercent}% of TOTALAMOUNTWITHOUTTAX`,
        detail: `${formatExact(l.taxAmount)} charged against a ${formatExact(l.withoutTax)} base.`,
        delta: round2(l.taxAmount - round2((l.withoutTax * l.taxPercent) / 100)),
      });
    }
    if (!l.totalAgrees) {
      breaks.push({
        title: `Line ${l.detail.Id}: TOTALAMOUNTWITHTAX is not the ex-tax total plus tax`,
        detail: `${formatExact(l.withTax)} against ${formatExact(l.withoutTax)} + ${formatExact(l.taxAmount)}.`,
        delta: round2(l.withTax - round2(l.withoutTax + l.taxAmount)),
      });
    }
    if (!l.taxColumnsAgree) {
      breaks.push({
        title: `Line ${l.detail.Id}: the two CMTS tax columns disagree`,
        detail: `Tax carries ${formatExact(l.tax)} and TAXAMOUNT carries ${formatExact(
          l.taxAmount,
        )}. CMTS stores the same figure twice, so a migration that reads one column and not the other must know which.`,
        delta: round2(l.tax - l.taxAmount),
      });
    }
  }

  return {
    lines: ledgers,
    rollups,
    residualTotal: residual,
    residualParts: parts,
    residualUnexplained: unexplained,
    residualExplained: Math.abs(unexplained) < EPSILON,
    chain,
    netPayable: g.NETPAYABLE,
    netPayableDerived,
    netPayableAgrees,
    breaks,
  };
}

/**
 * The voucher's document timeline, in the order the events happen.
 *
 * `FROMDATE`/`TODATE` are deliberately NOT part of this sequence. They bound the
 * period being billed rather than marking an event, and `TODATE` sits at the
 * billing cut-off — so folding them in would report a voucher raised mid-period
 * as running backwards, which is normal CMTS behaviour when rent is billed
 * forward in instalments.
 */
export interface TimelineEvent {
  label: string;
  cmts: string;
  iso: string | null;
  why: string;
  /** True when this event lands before the one preceding it. */
  outOfOrder: boolean;
}

export function buildTimeline(g: GodownRent): {
  events: TimelineEvent[];
  ordered: boolean;
} {
  const raw: Array<Omit<TimelineEvent, "outOfOrder">> = [
    {
      label: "Arrival",
      cmts: "ARRIVALDATE",
      iso: g.ARRIVALDATE,
      why: "Flight arrival. The storage clock starts at intake, not here — this date is provenance.",
    },
    {
      label: "Voucher raised",
      cmts: "GRDATE",
      iso: g.GRDATE,
      why: "The date this GRV was cut.",
    },
    {
      label: "Delivery",
      cmts: "DELIVERYDATE",
      iso: g.DELIVERYDATE,
      why: "Cargo released to the consignee. Null while the consignment is still in the shed.",
    },
    {
      label: "Pay order",
      cmts: "PAYORDERDATE",
      iso: g.PAYORDERDATE,
      why: "Dated with its instrument in the payment block. A pay order cannot predate the voucher it settles.",
    },
  ];

  let previous = Number.NEGATIVE_INFINITY;
  const events = raw.map((e) => {
    if (e.iso === null) return { ...e, outOfOrder: false };
    const t = Date.parse(e.iso);
    const outOfOrder = t < previous;
    previous = Math.max(previous, t);
    return { ...e, outOfOrder };
  });

  return { events, ordered: events.every((e) => !e.outOfOrder) };
}
