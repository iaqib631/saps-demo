/**
 * Charge-type attribution over a computed `ChargeCalculation` — the modelling
 * half of the CMTS `CHARGETYPE` render on the FC-07 charges calculator.
 *
 * WHY THIS EXISTS
 * ---------------
 * The calculator produces amounts in AirVault's own vocabulary
 * (`storageAmount`, `handlingAmount`, `documentationCharges`…). CMTS names the
 * same money differently: `CHARGETYPE` is a catalogue of *headings* — the
 * words that print on the voucher — keyed on `CHTYPEABB`, carrying no rate of
 * its own. Nothing in the domain joins the two: `CHARGETYPE` has no foreign key
 * to a calculation, and `ChargeCalculation` has no charge-type column. That
 * join is a **reading** of the legacy schema, so it is written down once, here,
 * where a reviewer can check it line by line — rather than scattered as string
 * literals through the JSX, where a wrong pairing would be invisible.
 *
 * The direction matters. This module attributes an already-computed number to a
 * heading; it never lets a heading change a number. `CHARGETYPE` is displayed
 * here, not maintained here — the master editor is a separate ticket, and
 * nothing in this file writes, filters or reorders the catalogue.
 *
 * NONUSEABEL
 * ----------
 * Two catalogue rows carry a `NONUSEABEL` value and it looks like a retirement
 * marker, but the meaning is UNCONFIRMED with SAPS (see the field comment in
 * lib/domain/masters.ts). So no function here branches on it: a charge type is
 * never hidden, skipped or excluded because of it. It is carried through to the
 * screen verbatim so a human reads the raw value and can question it. Reading
 * it as `!NONUSEABEL === active` is exactly the guess that would silently drop a
 * heading — or silently bill a retired one — on somebody's voucher.
 */

import {
  CHARGE_TYPES,
  chargeType,
  formatPkr,
  type Amount,
  type ChargeCalculation,
  type ChargeType,
} from "@/lib/domain";

/** One money line on the calculator, tied to the CMTS heading it prints under. */
export interface AttributedComponent {
  /** AirVault's own name for the line — what the calculator has always called it. */
  label: string;
  /**
   * How the amount was arrived at, where that is not obvious from the heading.
   * The waiver needs it: "−PKR 5,300" alone hides that the figure is a
   * percentage of one slab rather than a flat concession.
   */
  sublabel: string | null;
  amount: Amount;
  /** True for lines that reduce the bill; the screen renders them signed and in red. */
  negative: boolean;
  /**
   * The CMTS table the AMOUNT was priced from, where this screen already names
   * one. Distinct from the charge type: `LOCATIONCHARGES` holds the rate,
   * `CHARGETYPE` holds the words it prints under.
   */
  amountSource: string | null;
  /** CMTS `CHARGETYPE.CHTYPEABB`, or null where the legacy catalogue has no heading at all. */
  abb: string | null;
  /** The catalogue row `abb` resolves to. Null when `abb` is null, or when it fails to resolve. */
  type: ChargeType | null;
  /** Why this line carries no catalogue row. Null when it does. */
  unmappedNote: string | null;
}

/**
 * Rebuild the pre-floor total the way `calculateCharges` does: the eight
 * component amounts plus the §07 category surcharge, which is folded into the
 * subtotal without ever getting a component line of its own.
 *
 * This is presentation arithmetic over already-computed values, not a second
 * charge engine — it exists only so the screen can tell "the floor applied"
 * apart from "the floor exists and was not reached", which the stored fields
 * cannot distinguish on their own.
 */
function componentsBeforeFloor(c: ChargeCalculation): Amount {
  const surchargeTotal = c.surcharges.reduce((n, s) => n + s.amount, 0);
  return (
    Math.round(
      (c.storageAmount +
        c.handlingAmount +
        c.locationChargesAmount +
        surchargeTotal +
        c.documentationCharges +
        c.deconsolidationCharges +
        c.specialHandlingCharges +
        c.miscellaneousCharges) *
        100,
    ) / 100
  );
}

/**
 * FC-07 — `subTotal = max(components, CARGOSUBCLASS.MINCHARGES)`, so the floor
 * only *does* anything when it is the larger of the two.
 *
 * `minimumCharges` is populated on every calculation because every subclass has
 * a floor, which is why a `> 0` test is not the same question. The floor is an
 * ALTERNATIVE to the components, never an addition to them, so listing it as a
 * component line whenever it is non-zero shows an amount the consignee was not
 * charged, under a heading that says it was applied. On the current fixtures the
 * floor is never reached, so every voucher on this screen carried that line.
 * When it genuinely is not reached the number belongs in the "no line here"
 * table, with the comparison that explains why. The tolerance absorbs float
 * noise from summing already-rounded money.
 */
export function minimumFloorApplied(c: ChargeCalculation): boolean {
  return c.minimumCharges - componentsBeforeFloor(c) > 0.005;
}

/**
 * The component lines in the order the voucher reads them, each carrying the
 * `CHARGETYPE` row it prints under.
 *
 * The pairings are a reading of the CMTS catalogue against the FC-07 chain:
 * storage rent is CMTS's demurrage heading, `locationChargesAmount` is priced
 * from `LOCATIONCHARGES` but prints under the `LOC` heading, and so on. Every
 * line either names a `CHTYPEABB` or says in `unmappedNote` why it cannot —
 * silence is not an option, because an unattributed number on a bill is the
 * thing this screen exists to prevent.
 */
export function attributeComponents(
  c: ChargeCalculation,
  waiver: { percent: number; amount: Amount; source: string },
): AttributedComponent[] {
  const line = (
    label: string,
    amount: Amount,
    abb: string,
    amountSource: string | null = null,
  ): AttributedComponent => {
    // A code that does not resolve is surfaced on screen rather than swallowed:
    // it would mean the calculator is billing under a heading the catalogue no
    // longer contains, which is a migration defect worth seeing.
    const type = chargeType(abb) ?? null;
    return {
      label,
      sublabel: null,
      amount,
      negative: false,
      amountSource,
      abb,
      type,
      unmappedNote: type
        ? null
        : `No CHARGETYPE row with CHTYPEABB "${abb}" — the catalogue and the calculator disagree.`,
    };
  };

  const lines: AttributedComponent[] = [
    line("Storage", c.storageAmount, "DEM"),
    line("Handling", c.handlingAmount, "HND"),
    line("Location charges", c.locationChargesAmount, "LOC", "LOCATIONCHARGES"),
    line("Documentation", c.documentationCharges, "DOC"),
    line("Deconsolidation", c.deconsolidationCharges, "DECON"),
    line("Special handling", c.specialHandlingCharges, "SPH"),
    line("Miscellaneous", c.miscellaneousCharges, "MISC"),
  ];

  // Only when the floor actually raised the subtotal — see minimumFloorApplied.
  if (minimumFloorApplied(c)) {
    lines.push(line("Minimum charge floor applied", c.minimumCharges, "MIN"));
  }

  // The customs hold waiver is the one line with no catalogue row behind it.
  // CMTS recorded the waiver on the voucher, not as a charge heading, because it
  // was a manual act rather than a priced service — which is precisely why FC-07
  // §10–12 gives it an approval chain. Inventing a CHTYPEABB for it would make
  // the migration look more complete than it is.
  lines.push({
    label: "Customs hold waiver",
    sublabel: `−${waiver.percent}% × applicable slab`,
    amount: waiver.amount,
    negative: true,
    amountSource: waiver.source,
    abb: null,
    type: null,
    unmappedNote:
      "Not a CHARGETYPE heading — CMTS recorded the waiver against the voucher, not the charge catalogue.",
  });

  return lines;
}

/**
 * Why a catalogue heading produced no line on THIS calculation.
 *
 * Keyed on `CHTYPEABB` and deliberately partial: any heading without an entry
 * falls back to the generic reason below. A future row added to `CHARGE_TYPES`
 * then still appears on screen with an honest "not produced here" rather than
 * vanishing because this map was not updated — the failure mode of a lookup
 * like this should be a vaguer sentence, never a missing row.
 */
const NOT_PRODUCED_HERE: Record<string, string> = {
  DO: "Priced when the delivery order is raised, from AIRLINE.DOAMOUNT — it belongs to the DO, not to the rent calculation.",
  STU: "Per-unit charge from STORGEUNIT. FC-07 prices storage by weight-day slabs here, so no storage-unit line is produced.",
};

const NOT_PRODUCED_FALLBACK =
  "The FC-07 §01–08 chain on this screen produces no amount under this heading.";

/**
 * Every `CHARGETYPE` row that did NOT produce a line on this calculation, with
 * the reason it did not.
 *
 * These are shown, not filtered. A catalogue of twelve headings against a
 * voucher of eight lines raises the obvious question — "what happened to the
 * other four?" — and a screen that answers it is auditable in a way one that
 * quietly renders eight is not. Two of the absentees carry a `NONUSEABEL` value
 * and their absence here is NOT evidence that the flag caused it: nothing in
 * this file reads that column.
 */
export function chargeTypesWithNoLine(
  c: ChargeCalculation,
  lines: AttributedComponent[],
): Array<{ type: ChargeType; why: string }> {
  const used = new Set(lines.map((l) => l.abb).filter((a): a is string => a !== null));

  return CHARGE_TYPES.filter((t) => !used.has(t.CHTYPEABB)).map((t) => ({
    type: t,
    why:
      t.CHTYPEABB === "MIN"
        ? // Not "no floor" — the floor is real and simply was not reached, which
          // is the more useful thing to say next to a bill.
          `Floor of ${formatPkr(c.minimumCharges)} from CARGOSUBCLASS.MINCHARGES. The computed components come to ${formatPkr(
            componentsBeforeFloor(c),
          )}, so the floor was not reached and adds nothing.`
        : (NOT_PRODUCED_HERE[t.CHTYPEABB] ?? NOT_PRODUCED_FALLBACK),
  }));
}
