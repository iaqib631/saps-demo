/**
 * AirVault domain — airmail / postal (FC-18). **New module (M26).**
 *
 * Built under decision Q2 in `CMTS_SCOPE_DECISIONS.md`: airmail is in scope,
 * SAPS already confirmed it, and FC-18 was declared with every step carrying
 * `href: null`. This file is the model behind the screens that fill them.
 *
 * ------------------------------------------------------------------------
 * CMTS sources — READ THIS BEFORE TRUSTING A COLUMN NAME BELOW
 * ------------------------------------------------------------------------
 *   `AIRMAILDELIVERYBILL`      25 cols — the AV7 delivery bill, one per dispatch
 *   `AIRMAILTRANSFERMANIFEST`  19 cols — the onward-leg manifest
 *   `POMailType`                3 cols — the mail-type lookup
 *
 * **The three column COUNTS above are evidenced. Most of the column NAMES
 * below are not.** The restored CMTS database is schema-only and the three
 * reports in this repo carry, for airmail, exactly this much:
 *
 *   • the table names and their column counts — 25 / 19 / 3
 *     (`CMTS_SCHEMA_AUDIT.md` §2.3, `CMTS_MIGRATION_GAP_REPORT.md` §C)
 *   • a seven-item semantic sketch of what those columns hold —
 *     "dispatch no, AV7 no, PO origin/destination, mail type, loose-parcels
 *     gross/physical wt, irregularity" (`AIRVAULT_DEMO_BUILD_PLAN.md` G4,
 *     repeated in the FC-18 amendment in `lib/architecture.ts`)
 *
 * No report anywhere in this repo lists the columns of these three tables.
 * So the split is:
 *
 *   EVIDENCED  the counts, and the seven concepts named above — which appear
 *              here as `MailDispatch`, `AV7NO`, `POORIGIN`, `PODESTINATIONs`,
 *              `MailType`, `LOOSEPARCELSGROSSWT`, `LOOSEPARCELSPHYSICALWT`
 *              and `IRREGULARITY`.
 *   MODELLED   every other column name, spelling and type on all three
 *              interfaces. They are derived from the FC-18 steps, the table
 *              names, and the naming conventions this schema demonstrably
 *              uses elsewhere (`ManifiestId`, `IGMNO`, `REGNO`, `CARGODATE`
 *              are the live spellings on `IMPORTMANIFIEST` / `IMPORTAWB`
 *              and are reused here on that basis, not on evidence that
 *              `AIRMAILDELIVERYBILL` carries them).
 *
 * The names are arranged to hit the evidenced counts exactly — 24 modelled
 * columns plus an excluded `Id` on the delivery bill, all 19 on the transfer
 * manifest, 2 plus an excluded `MailTypeId` on the lookup — so the shape is
 * checkable even where a name is not. **Treat the screens as a specification
 * SAPS can correct, not as a migration mapping.** When the extract arrives,
 * renaming a field here is the whole change; nothing outside this file
 * hard-codes a column name except the parity markers that quote it.
 *
 * Two surrogates are excluded on the migration report's own rule (no backend,
 * so a database identity carries no meaning): the delivery bill's `Id` and
 * `POMailType.MailTypeId`. `AIRMAILTRANSFERMANIFEST` is modelled with no
 * surrogate at all — its key is taken as the five-column business key
 * TRANSFERNO/TRANSFERDATE/DISPATCHNO/DISPATCHDATE/AV7NO — so all 19 are kept.
 *
 * The 25 and 19 are modelled as business columns only, with no `AuditColumns`
 * among them. AirVault's audit trail therefore sits on `AirmailDispatch`,
 * which extends `DomainRecord`. If the extract shows the legacy tables do
 * carry CreatedBy/CreatedDate/…, they move down onto the bill and the count
 * of business columns shrinks by six.
 *
 * ------------------------------------------------------------------------
 * Airmail is NOT air waybill cargo
 * ------------------------------------------------------------------------
 * Postal cargo moves on a **delivery bill** (the AV7 / UPU CN-38) against a
 * **dispatch**, and is counted in **receptacles** — bags, trays, M-bags and
 * loose parcels. It has no AWB, no HAWB, no consignee and no piece-level
 * split. Nothing here extends the `AWB` model, and it deliberately does not
 * reuse `Piece`: a receptacle is a closed unit with its own UPU identifier
 * and its own tag weight, and flattening it into pieces would lose exactly
 * the fact §04 needs.
 *
 * ------------------------------------------------------------------------
 * §04 / §05 — the pair this module exists for
 * ------------------------------------------------------------------------
 * CMTS carries `LOOSEPARCELSGROSSWT` and `LOOSEPARCELSPHYSICALWT` side by
 * side and an `IRREGULARITY varchar(40)` beside them, and nothing that says
 * when the second should be written. The threshold lived in an operator's
 * head. Here the tolerance is a named constant, the variance is computed, and
 * the irregularity is a **record with a lifecycle** (`MailIrregularity`) —
 * the legacy free-text column is *derived from it* and truncated to its real
 * varchar(40) width, never the source. See `legacyIrregularityText`.
 *
 * ------------------------------------------------------------------------
 * Determinism
 * ------------------------------------------------------------------------
 * Dates are literal ISO-8601 strings with the +05:00 (PKT) offset, in the
 * style of `masters.ts`. `fixtures.ts` derives its dates arithmetically from
 * `DEMO_NOW` via `setHours`, which is host-timezone sensitive; with only
 * seven dispatches, literals are both stabler and easier to read against a
 * walkthrough script. No `Math.random()`, no `Date.now()`.
 */

import {
  DEMO_NOW,
  daysBetween,
  round2,
  variance,
  type AuditColumns,
  type DomainRecord,
  type SiteCode,
  type SiteScope,
  type Variance,
} from "./common";
import { SITES } from "./masters";

/* ================================================================== *
 * Column provenance — the honesty layer the screens render
 *
 * Per the file header: the column counts are evidenced, most of the column
 * names are not. Rather than leave that in a comment nobody opens, the split
 * is data, and every CMTS parity token on an airmail screen is drawn from it.
 * An evidenced column renders as a plain mono token; a modelled one renders
 * dimmed with a "?" so a reader can see at a glance which names SAPS still
 * have to confirm.
 *
 * `evidenced` is the exact set of concepts the build plan's G4 row and the
 * FC-18 amendment name. Nothing else may be added to it without a citation.
 * ================================================================== */

export const CMTS_COLUMNS_EVIDENCED: readonly string[] = [
  "MailDispatch",
  "AV7NO",
  "POORIGIN",
  "PODESTINATIONs",
  "MailType",
  "LOOSEPARCELSGROSSWT",
  "LOOSEPARCELSPHYSICALWT",
  "IRREGULARITY",
];

/**
 * Is this column name backed by something in the migration reports, or is it
 * AirVault's model of what the column is probably called?
 *
 * Note `PODESTINATIONs`: the *concept* is evidenced, the *casing* is not —
 * see its field comment. It counts as evidenced here because a reader who
 * asks "is there a PO-destination column?" should be told yes.
 */
export function cmtsColumnEvidenced(column: string): boolean {
  return CMTS_COLUMNS_EVIDENCED.includes(column);
}

/* ================================================================== *
 * POMailType (3 cols; `MailTypeId` excluded as a surrogate)
 *
 * The FC-18 note says "the code list itself has to come from SAPS before
 * this node is buildable". The *code list* is not SAPS's invention though —
 * these are UPU mail categories, the same ones printed on a CN-38. What
 * SAPS owns is which of them Karachi actually handles and what integer key
 * each carries. So the demo seeds the UPU set and keys on `Abbreviation`
 * (business identity) rather than on the surrogate.
 * ================================================================== */

export interface PoMailType {
  /** CMTS `MailType` varchar(50) */
  MailType: string;
  /** CMTS `Abbreviation` varchar(10) — the UPU category code. */
  Abbreviation: string;
  /**
   * AirVault addition. Priority mail is worked first off the ramp; CMTS has
   * no column for it, so segregation order was tribal knowledge.
   */
  priority: boolean;
}

export const PO_MAIL_TYPES: PoMailType[] = [
  { MailType: "Letters & Cards (Lettres et Cartes)", Abbreviation: "LC", priority: true },
  { MailType: "Express Mail Service", Abbreviation: "EMS", priority: true },
  { MailType: "Other Articles / Printed Papers (Autres Objets)", Abbreviation: "AO", priority: false },
  { MailType: "Postal Parcels (Colis Postaux)", Abbreviation: "CP", priority: false },
  { MailType: "Surface Air Lifted", Abbreviation: "SAL", priority: false },
  { MailType: "M-bag — bulk printed matter", Abbreviation: "MBAG", priority: false },
];

export function poMailType(abb: string): PoMailType {
  return PO_MAIL_TYPES.find((m) => m.Abbreviation === abb) ?? PO_MAIL_TYPES[0];
}

/* ================================================================== *
 * Office of exchange — the PO of origin / destination
 *
 * `AIRMAILDELIVERYBILL.POORIGIN` and `PODESTINATIONs` are **int**, so they
 * point at a lookup table. **There is no such table in the 105.** Nothing in
 * the schema resolves a postal office of exchange, which means the migration
 * cannot resolve those two integers from CMTS alone — a real finding, not a
 * modelling choice. AirVault models the office itself and keys on the UPU
 * office-of-exchange code.
 *
 * NOTE the column spelling: `PODESTINATIONs`, with a trailing lowercase "s"
 * on an otherwise all-caps name. **That casing is modelled, not read off the
 * schema** — see the provenance block at the top of this file. It is written
 * this way because this database demonstrably does exactly that sort of thing
 * (`RECIEVEDBY`, `GrosssWeight`, `TARRIFRATE`, `Nonuseabel`), so a mixed-case
 * tail is the *likely* shape rather than a tidy one. **Deliberate — do not
 * "fix" it**, and do not treat it as confirmed either: it is on the list SAPS
 * are asked to correct.
 * ================================================================== */

export interface PostalExchangeOffice {
  /** UPU office-of-exchange code, e.g. "KHIAA" for Karachi. */
  code: string;
  name: string;
  country: string;
  /** IATA airport the office dispatches through. */
  airportCode: string;
}

export const EXCHANGE_OFFICES: PostalExchangeOffice[] = [
  { code: "KHIAA", name: "Karachi Foreign Post Office", country: "Pakistan", airportCode: "KHI" },
  { code: "LHEAA", name: "Lahore Foreign Post Office", country: "Pakistan", airportCode: "LHE" },
  { code: "PEWAA", name: "Peshawar Post Office of Exchange", country: "Pakistan", airportCode: "PEW" },
  { code: "LONAA", name: "London Heathrow Worldwide DC", country: "United Kingdom", airportCode: "LHR" },
  { code: "DXBAA", name: "Dubai Emirates Post Exchange", country: "United Arab Emirates", airportCode: "DXB" },
  { code: "DOHAA", name: "Doha Q-Post Exchange Office", country: "Qatar", airportCode: "DOH" },
  { code: "ISTAA", name: "Istanbul PTT Exchange Office", country: "Türkiye", airportCode: "IST" },
  { code: "JEDAA", name: "Jeddah Saudi Post Exchange", country: "Saudi Arabia", airportCode: "JED" },
  { code: "FRAAA", name: "Frankfurt Briefzentrum Exchange", country: "Germany", airportCode: "FRA" },
  { code: "AUHAA", name: "Abu Dhabi Post Exchange", country: "United Arab Emirates", airportCode: "AUH" },
];

export function exchangeOffice(code: string): PostalExchangeOffice {
  return EXCHANGE_OFFICES.find((o) => o.code === code) ?? EXCHANGE_OFFICES[0];
}

/* ================================================================== *
 * AIRMAILDELIVERYBILL — 24 of 25 columns (`Id` excluded as a surrogate)
 * ================================================================== */

export interface AirmailDeliveryBill {
  /**
   * CMTS `ManifiestId` — the flight manifest the bill was received against.
   *
   * The misspelling ("Manifiest") is CMTS's own: `IMPORTMANIFIEST` is a real
   * table name and `Manifest.ManifiestId` is already modelled in this demo
   * off it. **Deliberate — do not correct it**, or the migration mapping
   * stops matching by column name. That the *airmail* bill carries this FK is
   * modelled; the spelling of the FK is not.
   */
  ManifiestId: number;
  /** CMTS `IGMNO` varchar(15) */
  IGMNO: string;
  /** CMTS `FLIGHT` varchar(15) */
  FLIGHT: string;
  /** CMTS `REGNO` varchar(15) — aircraft registration. */
  REGNO: string | null;
  /** CMTS `CARGODATE` datetime — when the mail came off the flight. */
  CARGODATE: string | null;
  /**
   * CMTS `ORIGIN` / `DESTINATION` — **int** airport keys in the source. The
   * prototype renders the airport, never its key, so these carry the IATA
   * code and the parity marker still names the legacy column.
   */
  ORIGIN: string | null;
  DESTINATION: string | null;
  /** CMTS `AIRLINENAME` varchar(40) */
  AIRLINENAME: string | null;
  /** CMTS `MailDispatch` varchar(20) — the UPU dispatch number. */
  MailDispatch: string | null;
  /** CMTS `POORIGIN` — int in the source; office-of-exchange code here. */
  POORIGIN: string | null;
  /**
   * CMTS `PODESTINATIONs` — int in the source. The trailing lowercase "s" on
   * an otherwise all-caps column name is a **modelled** spelling, not a read
   * one. **Deliberate — do not correct it**; see the block comment above
   * `PostalExchangeOffice` for why it is written this way.
   */
  PODESTINATIONs: string | null;
  /** CMTS `MailType` — int → `POMailType` in the source; the UPU code here. */
  MailType: string;
  /** CMTS `Packages` int — receptacles on the bill. */
  Packages: number;
  /** CMTS `Weight` decimal(18,0) — total declared weight of the dispatch, kg. */
  Weight: number;
  /** CMTS `REMARKS` varchar(100), NOT NULL in the source. */
  REMARKS: string;
  /** CMTS `LOOSEPARCELSGROSSWT` numeric(38,3) — gross off the AV7. */
  LOOSEPARCELSGROSSWT: number;
  /** CMTS `LOOSEPARCELSPHYSICALWT` numeric(38,3) — what the scale said. */
  LOOSEPARCELSPHYSICALWT: number;
  /**
   * CMTS `IRREGULARITY` varchar(40) — free text in the legacy system.
   *
   * **Derived here, never keyed.** `MailIrregularity` is the record; this is
   * the 40-character shadow of it that migrates back into CMTS. See
   * `legacyIrregularityText`.
   */
  IRREGULARITY: string | null;
  /** CMTS `TRANSFERSTATUS` bit, default 0 — has an onward leg been raised? */
  TRANSFERSTATUS: boolean;
  /** CMTS `TRANSFERNO` varchar(20) — joins to `AIRMAILTRANSFERMANIFEST`. */
  TRANSFERNO: string | null;
  /**
   * CMTS `Deliverdto` varchar(50) — who took the mail at handover.
   *
   * The misspelling ("Delivered to" with the "e" dropped) is **modelled**,
   * in the same class as the schema's real `RECIEVEDBY` and `Nonuseabel`.
   * **Deliberate — do not correct it**, and flagged for SAPS confirmation.
   */
  Deliverdto: string | null;
  /**
   * CMTS `PartOrShortPackeges` int — receptacles part-received or short.
   *
   * The misspelling ("Packages") is **modelled**, on the same reasoning as
   * `Deliverdto` above and by analogy with the schema's real
   * `cahrgesUniqueIdentification`. **Deliberate — do not correct it.**
   */
  PartOrShortPackeges: number | null;
  /** CMTS `PartOrShortWeight` int — kg part-received or short. */
  PartOrShortWeight: number | null;
  /** CMTS `ShipmentType` varchar(7) — "IMPORT" / "EXPORT" / "TRANSIT". */
  ShipmentType: string | null;
}

/* ================================================================== *
 * AIRMAILTRANSFERMANIFEST — all 19 columns
 *
 * No surrogate key: the PK is the five-column business key
 * TRANSFERNO + TRANSFERDATE + DISPATCHNO + DISPATCHDATE + AV7NO. Every one
 * of those is something an operator reads off paper, so all five are kept.
 * ================================================================== */

export interface AirmailTransferManifest {
  /** CMTS `TRANSFERNO` varchar(20) — PK part 1. */
  TRANSFERNO: string;
  /** CMTS `TRANSFERDATE` datetime — PK part 2. */
  TRANSFERDATE: string;
  /** CMTS `DISPATCHNO` varchar(20) — PK part 3. */
  DISPATCHNO: string;
  /** CMTS `DISPATCHDATE` datetime — PK part 4. */
  DISPATCHDATE: string;
  /**
   * CMTS `AV7NO` varchar(20) — PK part 5. The delivery-bill number.
   *
   * Worth noticing: **`AV7NO` exists only here, not on
   * `AIRMAILDELIVERYBILL`.** A dispatch that terminates at Karachi and never
   * transfers therefore has no AV7 number anywhere in CMTS, even though the
   * paper bill it was received against carries one. AirVault carries
   * `AirmailDispatch.av7No` on the dispatch to close that hole.
   */
  AV7NO: string;
  /** CMTS `TRANSFERTOSCHFLT` varchar(1) — "Y"/"N": onward leg on a scheduled flight? */
  TRANSFERTOSCHFLT: string | null;
  /** CMTS `TRANSFERTOFLTNO` varchar(20) */
  TRANSFERTOFLTNO: string | null;
  /** CMTS `TRANSFERTOAIRLINEID` varchar(10) — IATA code, not a surrogate. */
  TRANSFERTOAIRLINEID: string | null;
  /** CMTS `TRANSFERTOAIRLINENAME` varchar(100) */
  TRANSFERTOAIRLINENAME: string | null;
  /** CMTS `TRANSFERTOAIRLINEABB` varchar(10) */
  TRANSFERTOAIRLINEABB: string | null;
  /** CMTS `DESTINATION` varchar(10) */
  DESTINATION: string | null;
  /** CMTS `ORIGIN` varchar(10) */
  ORIGIN: string | null;
  /** CMTS `ARRIVEDBYSCHFLT` varchar(1) — "Y"/"N". */
  ARRIVEDBYSCHFLT: string | null;
  /** CMTS `ARRIVEDBYFLTNO` varchar(20) */
  ARRIVEDBYFLTNO: string | null;
  /** CMTS `ARRIVEDBYAIRLINEID` varchar(10) */
  ARRIVEDBYAIRLINEID: string | null;
  /** CMTS `ARRIVEDBYAIRLINENAME` varchar(100) */
  ARRIVEDBYAIRLINENAME: string | null;
  /** CMTS `ARRIVEDBYAIRLINEABB` varchar(10) */
  ARRIVEDBYAIRLINEABB: string | null;
  /** CMTS `ARRIVEDDATE` datetime */
  ARRIVEDDATE: string | null;
  /** CMTS `TRANSFERTO` varchar(30) — receiving carrier or station. */
  TRANSFERTO: string | null;
}

/* ================================================================== *
 * Receptacles — AirVault addition, no CMTS table
 *
 * CMTS records `Packages` and `Weight` on the bill and nothing beneath them,
 * so when a dispatch weighs short the legacy system cannot say *which*
 * receptacle is short — only that the total is. That is precisely the fact a
 * CN-43 verification note has to state, which is why this table exists.
 * ================================================================== */

export type ReceptacleKind = "bag" | "tray" | "mbag" | "loose-parcel";

export const RECEPTACLE_KIND_LABEL: Record<ReceptacleKind, string> = {
  bag: "Mail bag",
  tray: "Letter tray",
  mbag: "M-bag",
  "loose-parcel": "Loose parcel",
};

export type ReceptacleCondition = "sound" | "torn" | "wet" | "resealed" | "missing";

export const RECEPTACLE_CONDITION_LABEL: Record<ReceptacleCondition, string> = {
  sound: "Sound",
  torn: "Torn",
  wet: "Wet",
  resealed: "Re-sealed in transit",
  missing: "Not presented",
};

export interface Receptacle {
  id: number;
  /** UPU receptacle identifier off the CN-35 label / S9 barcode. */
  receptacleNo: string;
  kind: ReceptacleKind;
  /** UPU category code — a dispatch may mix categories across receptacles. */
  mailTypeAbb: string;
  /** Weight printed on the CN-35 tag by the despatching office. */
  declaredKg: number;
  /** Weight read on the terminal scale. Null where the receptacle never arrived. */
  weighedKg: number | null;
  sealIntact: boolean;
  condition: ReceptacleCondition;
  /** CN-22 / CN-23 items inside — the §09 population. */
  dutiableItems: number;
  weighedAt: string | null;
  weighedBy: string | null;
}

/** Per-receptacle difference, tag vs scale. Null while unweighed. */
export function receptacleDeltaKg(r: Receptacle): number | null {
  return r.weighedKg === null ? null : round2(r.weighedKg - r.declaredKg);
}

/* ================================================================== *
 * §03 / §04 — weights, tolerance, variance
 * ================================================================== */

/**
 * §04 tolerance — **an AirVault addition, and the number to argue about.**
 *
 * CMTS has no tolerance column. It has `LOOSEPARCELSGROSSWT`,
 * `LOOSEPARCELSPHYSICALWT` and a free-text `IRREGULARITY varchar(40)`, and
 * nothing anywhere that says how far apart the first two may drift before
 * the third gets written. That threshold lived in an operator's head, which
 * is why no two clerks agreed and why the column cannot be reported on.
 *
 * 1.5% of declared gross is pinned here so the rule is visible and arguable
 * rather than invisible and unarguable. It is deliberately *tighter* than
 * FC-01's 2% `VARIANCE_TOLERANCE`, because a postal dispatch is weighed
 * receptacle by receptacle against tags written at the despatching office —
 * a much closer measurement than a declared AWB gross.
 *
 * **SAPS have not stated the real figure.** If they do, change this constant
 * and nothing else: every screen reads it from here.
 */
export const AIRMAIL_WEIGHT_TOLERANCE = 0.015;

/**
 * Absolute floor, kg. Below this the percentage rule is noise — a 0.2 kg
 * drift on a 6 kg tray is 3% and means nothing. AirVault addition.
 */
export const AIRMAIL_TOLERANCE_FLOOR_KG = 1.5;

export interface DispatchWeights {
  /** Sum of the CN-35 tag weights across every receptacle. */
  declaredReceptacleKg: number;
  /** Sum of the scale readings. Excludes receptacles never presented. */
  weighedReceptacleKg: number;
  /** CMTS `LOOSEPARCELSGROSSWT` — gross figure off the AV7 / CN-38. */
  looseParcelsGrossKg: number;
  /** CMTS `LOOSEPARCELSPHYSICALWT` — the scale's answer for loose parcels. */
  looseParcelsPhysicalKg: number;
  /** The §04 left-hand side: everything the paperwork says. */
  grossKg: number;
  /** The §04 right-hand side: everything the scale says. */
  physicalKg: number;
}

export type VarianceDirection = "short" | "over" | "level";

export const VARIANCE_DIRECTION_LABEL: Record<VarianceDirection, string> = {
  short: "Short — physical under gross",
  over: "Over — physical above gross",
  level: "Level",
};

export interface AirmailVarianceCheck {
  /**
   * The measured delta, from the shared `variance()` helper.
   *
   * **Read `beyondTolerance` below, not `measure.overTolerance`.** That flag
   * is computed against FC-01's 2% `VARIANCE_TOLERANCE`, which is not the
   * airmail rule. It is left on the object because the helper returns it,
   * not because it applies here.
   */
  measure: Variance;
  /** The fraction applied — `AIRMAIL_WEIGHT_TOLERANCE`. */
  tolerance: number;
  /** That fraction expressed in kg against this dispatch's gross. */
  toleranceKg: number;
  /** Absolute floor applied — `AIRMAIL_TOLERANCE_FLOOR_KG`. */
  floorKg: number;
  /** kg still available before the threshold trips; negative once past it. */
  headroomKg: number;
  direction: VarianceDirection;
  /**
   * True while §03 has not finished, so §04 has not been asked yet.
   *
   * This matters: a dispatch that is off the aircraft but not on the scale
   * has a physical weight of zero, and zero against a 59.5 kg gross is a
   * 100% variance. Without this flag the register would light up every
   * un-weighed dispatch as an irregularity, which is the opposite of useful.
   */
  pending: boolean;
  /** The §04 answer. True → §05. Always false while `pending`. */
  beyondTolerance: boolean;
}

/**
 * FC-18 §04 — gross versus physical against the tolerance.
 *
 * Trips only when the delta clears **both** the percentage and the absolute
 * floor, so a rounding wobble on a light dispatch does not raise a CN-43 that
 * a clerk then has to talk their way out of.
 *
 * Prefer `dispatchVariance()` on screens — it adds the "not weighed yet"
 * state, which this function cannot know from the weights alone.
 */
export function evaluateWeightVariance(w: DispatchWeights, pending = false): AirmailVarianceCheck {
  const measure = variance(w.grossKg, w.physicalKg);
  const toleranceKg = round2(w.grossKg * AIRMAIL_WEIGHT_TOLERANCE);
  const threshold = Math.max(toleranceKg, AIRMAIL_TOLERANCE_FLOOR_KG);
  const absDelta = Math.abs(measure.delta);

  return {
    measure,
    tolerance: AIRMAIL_WEIGHT_TOLERANCE,
    toleranceKg,
    floorKg: AIRMAIL_TOLERANCE_FLOOR_KG,
    headroomKg: round2(threshold - absDelta),
    direction: measure.delta < 0 ? "short" : measure.delta > 0 ? "over" : "level",
    pending,
    beyondTolerance: pending ? false : absDelta > threshold,
  };
}

/**
 * The §04 decision for a whole dispatch — the form every screen should use.
 *
 * The decision is only live once §03 has completed, which is a property of
 * the dispatch's stage, not of its weights.
 */
export function dispatchVariance(d: AirmailDispatch): AirmailVarianceCheck {
  const pending = airmailStageIndex(d.stage) < airmailStageIndex("AM04-variance-checked");
  return evaluateWeightVariance(d.weights, pending);
}

/* ================================================================== *
 * §05 — the irregularity, as a state rather than a label
 *
 * The instrument is real: a **CN-43 Verification Note** is what one postal
 * administration raises against another when a dispatch arrives irregular.
 * CMTS reduced it to 40 characters of free text.
 * ================================================================== */

export type MailIrregularityKind =
  | "weight-variance"
  | "receptacle-short"
  | "receptacle-excess"
  | "seal-broken"
  | "receptacle-damaged"
  | "missing-cn38"
  | "misrouted-dispatch";

export const MAIL_IRREGULARITY_KIND_LABEL: Record<MailIrregularityKind, string> = {
  "weight-variance": "Weight variance",
  "receptacle-short": "Receptacle short",
  "receptacle-excess": "Receptacle excess",
  "seal-broken": "Seal broken",
  "receptacle-damaged": "Receptacle damaged",
  "missing-cn38": "CN-38 missing",
  "misrouted-dispatch": "Dispatch misrouted",
};

export type MailIrregularityStatus =
  | "raised"
  | "po-notified"
  | "airline-notified"
  | "awaiting-instruction"
  | "resolved"
  | "written-off";

export const MAIL_IRREGULARITY_STATUS_LABEL: Record<MailIrregularityStatus, string> = {
  raised: "Raised",
  "po-notified": "Post Office notified",
  "airline-notified": "Carrier notified",
  "awaiting-instruction": "Awaiting instruction",
  resolved: "Resolved",
  "written-off": "Written off",
};

/** Statuses that still need somebody to do something. */
export const OPEN_IRREGULARITY_STATUSES: MailIrregularityStatus[] = [
  "raised",
  "po-notified",
  "airline-notified",
  "awaiting-instruction",
];

export function isIrregularityOpen(x: MailIrregularity): boolean {
  return OPEN_IRREGULARITY_STATUSES.includes(x.status);
}

export interface MailIrregularity {
  /** UPU CN-43 verification note reference — the actual postal instrument. */
  cn43Ref: string;
  kind: MailIrregularityKind;
  status: MailIrregularityStatus;
  raisedAt: string;
  raisedBy: string;

  /** The facts the note was raised on, frozen at the moment of raising. */
  observedGrossKg: number;
  observedPhysicalKg: number;
  varianceKg: number;
  varianceRatio: number;
  /** The tolerance in force when it was raised — not read live. */
  toleranceApplied: number;
  /** Receptacle numbers implicated, so the note names units not just a total. */
  receptaclesAffected: string[];

  narrative: string;
  poNotifiedAt: string | null;
  airlineNotifiedAt: string | null;
  instructionReceivedAt: string | null;
  instructionText: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;

  /**
   * The FC-18 amendment's position is that airmail irregularities should be
   * raised through the **FC-04 CDR mechanism with the dispatch number as the
   * entity**, so there is one record of one fact rather than two.
   *
   * That cannot be done from here yet: `CDR` in `exceptions.ts` requires
   * `awbId`, `AWBNO` and `IGMNO`, and a postal dispatch has no air waybill —
   * widening the CDR entity is a change to a file this module does not own.
   * So this is the record today and the link is null until the CDR entity
   * accepts a dispatch. Recording it as a null with a reason is the point:
   * the intent stays visible instead of being quietly dropped.
   */
  cdrRef: string | null;
}

/**
 * The legacy `IRREGULARITY varchar(40)` column, **derived** from the record.
 *
 * The truncation is not decoration. It is what the migration will actually do
 * to a structured note on the way back into CMTS, and rendering the truncated
 * string beside the full record is the clearest possible argument for why the
 * free-text column should not be the source of truth.
 */
export function legacyIrregularityText(x: MailIrregularity | null): string | null {
  if (!x) return null;
  return `${MAIL_IRREGULARITY_KIND_LABEL[x.kind]} ${x.cn43Ref}`.slice(0, 40);
}

/* ================================================================== *
 * §06 — segregation and storage by mail type
 *
 * FC-18's own note: "No mail-type → zone rule exists in
 * CARGOSUBCLASSLOCATION, so FC-03 cannot allocate airmail today." These
 * zones are the missing rule, supplied by AirVault and flagged as such.
 * ================================================================== */

export interface MailTypeZone {
  /** UPU category this zone holds. */
  mailTypeAbb: string;
  zoneCode: string;
  zoneName: string;
  /** Locked cage — required for EMS and anything dutiable. */
  secured: boolean;
  capacityReceptacles: number;
}

export const MAIL_TYPE_ZONES: MailTypeZone[] = [
  { mailTypeAbb: "LC", zoneCode: "PM-A", zoneName: "Postal A — letters & cards", secured: false, capacityReceptacles: 220 },
  { mailTypeAbb: "EMS", zoneCode: "PM-S", zoneName: "Postal S — EMS secure cage", secured: true, capacityReceptacles: 60 },
  { mailTypeAbb: "AO", zoneCode: "PM-B", zoneName: "Postal B — printed papers", secured: false, capacityReceptacles: 180 },
  { mailTypeAbb: "CP", zoneCode: "PM-C", zoneName: "Postal C — parcels", secured: false, capacityReceptacles: 140 },
  { mailTypeAbb: "SAL", zoneCode: "PM-D", zoneName: "Postal D — surface air lifted", secured: false, capacityReceptacles: 200 },
  { mailTypeAbb: "MBAG", zoneCode: "PM-B", zoneName: "Postal B — printed papers", secured: false, capacityReceptacles: 180 },
];

export function mailTypeZone(abb: string): MailTypeZone {
  return MAIL_TYPE_ZONES.find((z) => z.mailTypeAbb === abb) ?? MAIL_TYPE_ZONES[0];
}

export interface DispatchSegregation {
  mailTypeAbb: string;
  zoneCode: string;
  receptacleCount: number;
  weightKg: number;
  storedAt: string | null;
  storedBy: string | null;
}

/* ================================================================== *
 * §09 — dutiable postal items
 *
 * FC-18 draws this as an OPEN BRANCH, not as FC-06. Postal items travel on
 * a CN-22 or CN-23 declaration attached to the item, never on a Single
 * Declaration, so the PSW / WeBOC gateway does not apply and no SD number is
 * ever issued. That is encoded in the type below: `singleDeclarationNo` is
 * typed as the literal `null`, so a future edit that tries to put an SD
 * number on a postal dispatch fails to compile rather than quietly
 * pretending FC-06 covers this.
 * ================================================================== */

export type DutiableOutcome = "not-presented" | "presented" | "assessed" | "released" | "detained";

export const DUTIABLE_OUTCOME_LABEL: Record<DutiableOutcome, string> = {
  "not-presented": "Not yet presented",
  presented: "Presented, awaiting assessment",
  assessed: "Assessed",
  released: "Released",
  detained: "Detained by customs",
};

export interface DutiablePresentation {
  /** CN-22 declarations (low-value items). */
  cn22Count: number;
  /** CN-23 declarations (items above the CN-22 threshold). */
  cn23Count: number;
  /** Receptacle numbers held back for presentation. */
  receptaclesHeld: string[];
  presentedAt: string | null;
  presentedBy: string | null;
  customsOfficer: string | null;
  outcome: DutiableOutcome;
  /**
   * Always null, by regime. Postal items do not move on a Single
   * Declaration — see the block comment above. The literal type is the guard.
   */
  singleDeclarationNo: null;
}

/* ================================================================== *
 * FC-18 stages
 * ================================================================== */

export type AirmailStage =
  | "AM01-received"
  | "AM02-identified"
  | "AM03-weighed"
  | "AM04-variance-checked"
  | "AM05-irregularity"
  | "AM06-segregated"
  | "AM07-onward-decided"
  | "AM08-transfer-manifested"
  | "AM09-customs-presented"
  | "AM10-handed-over"
  | "AM11-closed";

export const AIRMAIL_STAGE_LABEL: Record<AirmailStage, string> = {
  "AM01-received": "AM01. Mail received off the flight against the AV7",
  "AM02-identified": "AM02. Dispatch identified — PO origin, PO destination, mail type",
  "AM03-weighed": "AM03. Receptacles counted and weighed",
  "AM04-variance-checked": "AM04. Gross vs physical checked against tolerance",
  "AM05-irregularity": "AM05. Irregularity recorded against the dispatch",
  "AM06-segregated": "AM06. Segregated and stored by mail type",
  "AM07-onward-decided": "AM07. Onward leg decided",
  "AM08-transfer-manifested": "AM08. Transfer manifest raised",
  "AM09-customs-presented": "AM09. Dutiable items presented to customs",
  "AM10-handed-over": "AM10. Delivery bill signed at handover",
  "AM11-closed": "AM11. Dispatch closed",
};

export const AIRMAIL_STAGE_ORDER: AirmailStage[] = [
  "AM01-received",
  "AM02-identified",
  "AM03-weighed",
  "AM04-variance-checked",
  "AM05-irregularity",
  "AM06-segregated",
  "AM07-onward-decided",
  "AM08-transfer-manifested",
  "AM09-customs-presented",
  "AM10-handed-over",
  "AM11-closed",
];

export function airmailStageIndex(s: AirmailStage): number {
  return AIRMAIL_STAGE_ORDER.indexOf(s);
}

/* ================================================================== *
 * The dispatch
 * ================================================================== */

export interface AirmailDispatch extends DomainRecord {
  id: number;
  /** UPU dispatch number — CMTS `MailDispatch` / `AIRMAILTRANSFERMANIFEST.DISPATCHNO`. */
  dispatchNo: string;
  dispatchDate: string;
  /**
   * AirVault addition. CMTS carries `AV7NO` **only** on
   * `AIRMAILTRANSFERMANIFEST`, so a dispatch that terminates here has no AV7
   * number in the legacy system at all — even though FC-18 §01 receives the
   * mail *against* that bill. Carried on the dispatch to close the hole.
   */
  av7No: string;
  stage: AirmailStage;

  bill: AirmailDeliveryBill;
  mailType: PoMailType;
  poOrigin: PostalExchangeOffice;
  poDestination: PostalExchangeOffice;

  receptacles: Receptacle[];
  weights: DispatchWeights;

  /** Null when §04 said No. A record, never a label — see `MailIrregularity`. */
  irregularity: MailIrregularity | null;

  segregation: DispatchSegregation[];

  /** §07. */
  onwardLegRequired: boolean;
  /** §08 — null until the manifest is raised. */
  transfer: AirmailTransferManifest | null;

  /** §09 — null when the dispatch carries nothing dutiable. */
  customs: DutiablePresentation | null;

  arrivedFlight: string;
  arrivedAt: string;
  /** §10 — the AV7 signed back to Pakistan Post. */
  handedOverAt: string | null;
  closedAt: string | null;
  site: SiteCode;
}

/* ================================================================== *
 * §07 → §08 gate — what must be true before a transfer manifest is raised
 *
 * Same shape as FC-09's re-tender gate, deliberately: an onward leg on
 * postal mail is the same class of act as re-tendering bonded cargo, and a
 * reviewer who has read one should recognise the other.
 * ================================================================== */

export interface TransferCondition {
  code:
    | "weights-reconciled"
    | "irregularity-cleared"
    | "customs-clear"
    | "receiving-carrier"
    | "segregated";
  label: string;
  pass: boolean;
  detail: string;
  applicable: boolean;
}

export function evaluateOnwardTransfer(d: AirmailDispatch) {
  const check = dispatchVariance(d);
  const unweighed = d.receptacles.filter((r) => r.weighedKg === null);
  const irr = d.irregularity;
  const dutiable = d.customs;

  const conditions: TransferCondition[] = [
    {
      code: "weights-reconciled",
      label: "Every receptacle weighed",
      pass: unweighed.length === 0,
      detail:
        unweighed.length === 0
          ? `${d.receptacles.length} receptacles on the scale`
          : `${unweighed.length} of ${d.receptacles.length} never presented — ${unweighed
              .map((r) => r.receptacleNo)
              .join(", ")}`,
      applicable: true,
    },
    {
      code: "irregularity-cleared",
      label: "Irregularity closed or instruction received",
      pass: !irr || !isIrregularityOpen(irr),
      detail: !irr
        ? `No irregularity — variance ${(check.measure.ratio * 100).toFixed(2)}% inside ${(
            AIRMAIL_WEIGHT_TOLERANCE * 100
          ).toFixed(1)}%`
        : isIrregularityOpen(irr)
          ? `${irr.cn43Ref} still ${MAIL_IRREGULARITY_STATUS_LABEL[irr.status].toLowerCase()}`
          : `${irr.cn43Ref} ${MAIL_IRREGULARITY_STATUS_LABEL[irr.status].toLowerCase()}`,
      applicable: true,
    },
    {
      code: "customs-clear",
      label: "Dutiable items released",
      pass: dutiable ? dutiable.outcome === "released" : true,
      detail: !dutiable
        ? "Nothing dutiable in this dispatch"
        : dutiable.outcome === "detained"
          ? `${dutiable.receptaclesHeld.length} receptacle(s) detained — the dispatch cannot leave complete`
          : DUTIABLE_OUTCOME_LABEL[dutiable.outcome],
      applicable: dutiable !== null,
    },
    {
      code: "segregated",
      label: "Mail segregated by type",
      pass: d.segregation.length > 0 && d.segregation.every((s) => s.storedAt !== null),
      detail:
        d.segregation.length === 0
          ? "Not yet segregated"
          : `${d.segregation.length} mail type(s) across ${new Set(d.segregation.map((s) => s.zoneCode)).size} zone(s)`,
      applicable: true,
    },
    {
      code: "receiving-carrier",
      label: "Receiving carrier or station confirmed",
      pass: !!d.transfer?.TRANSFERTO && !!d.transfer?.TRANSFERTOFLTNO,
      detail: d.transfer
        ? `${d.transfer.TRANSFERTO ?? "carrier TBC"} · ${d.transfer.TRANSFERTOFLTNO ?? "flight TBC"}`
        : "No transfer manifest raised",
      applicable: true,
    },
  ];

  const applicable = conditions.filter((c) => c.applicable);
  return {
    conditions,
    canTransfer: applicable.every((c) => c.pass),
    blockedBy: applicable.filter((c) => !c.pass),
  };
}

/* ================================================================== *
 * Fixtures
 *
 * Seven dispatches: one live irregularity (the §04 → §05 demo case), one
 * resolved irregularity, and five clean dispatches spread across the stages
 * and all three sites. Dates are literal ISO strings in +05:00.
 * ================================================================== */

function siteKeys(code: SiteCode) {
  const s = SITES.find((x) => x.code === code)!;
  return { CityId: s.CityId, Comp_Code: s.Comp_Code, Off_Code: s.Off_Code };
}

function audit(createdDate: string, updatedDate: string | null = null, by = "a.rehman"): AuditColumns {
  return {
    CreatedBy: by,
    UpdatedBy: updatedDate ? by : null,
    CreatedDate: createdDate,
    UpdatedDate: updatedDate,
    IsActive: true,
    IsDeleted: false,
  };
}

/** Sum helper — kept local so the fixture arithmetic reads in one line. */
function sum(xs: number[]): number {
  return round2(xs.reduce((n, x) => n + x, 0));
}

function weighFrom(receptacles: Receptacle[], grossKg: number, physicalKg: number): DispatchWeights {
  const declaredReceptacleKg = sum(receptacles.map((r) => r.declaredKg));
  const weighedReceptacleKg = sum(receptacles.map((r) => r.weighedKg ?? 0));
  return {
    declaredReceptacleKg,
    weighedReceptacleKg,
    looseParcelsGrossKg: grossKg,
    looseParcelsPhysicalKg: physicalKg,
    grossKg,
    physicalKg,
  };
}

function segregate(receptacles: Receptacle[], storedAt: string | null, storedBy: string | null): DispatchSegregation[] {
  const byType = new Map<string, Receptacle[]>();
  for (const r of receptacles) {
    const list = byType.get(r.mailTypeAbb) ?? [];
    list.push(r);
    byType.set(r.mailTypeAbb, list);
  }
  return [...byType.entries()].map(([abb, rs]) => ({
    mailTypeAbb: abb,
    zoneCode: mailTypeZone(abb).zoneCode,
    receptacleCount: rs.length,
    weightKg: sum(rs.map((r) => r.weighedKg ?? r.declaredKg)),
    storedAt,
    storedBy,
  }));
}

/* ---- Receptacle sets ---------------------------------------------- */

const R_0417: Receptacle[] = [
  { id: 1, receptacleNo: "LONAA-KHIAA-LC-0417-001", kind: "tray", mailTypeAbb: "LC", declaredKg: 18.4, weighedKg: 18.4, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-07-28T07:40:00+05:00", weighedBy: "f.iqbal" },
  { id: 2, receptacleNo: "LONAA-KHIAA-LC-0417-002", kind: "tray", mailTypeAbb: "LC", declaredKg: 17.9, weighedKg: 18.0, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-07-28T07:42:00+05:00", weighedBy: "f.iqbal" },
  { id: 3, receptacleNo: "LONAA-KHIAA-LC-0417-003", kind: "bag", mailTypeAbb: "LC", declaredKg: 21.2, weighedKg: 21.1, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-07-28T07:45:00+05:00", weighedBy: "f.iqbal" },
  { id: 4, receptacleNo: "LONAA-KHIAA-LC-0417-004", kind: "bag", mailTypeAbb: "LC", declaredKg: 20.5, weighedKg: 20.6, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-07-28T07:47:00+05:00", weighedBy: "f.iqbal" },
];

const R_0419: Receptacle[] = [
  { id: 11, receptacleNo: "FRAAA-LHEAA-CP-0419-001", kind: "bag", mailTypeAbb: "CP", declaredKg: 29.6, weighedKg: 29.5, sealIntact: true, condition: "sound", dutiableItems: 3, weighedAt: "2026-07-29T11:10:00+05:00", weighedBy: "h.sadiq" },
  { id: 12, receptacleNo: "FRAAA-LHEAA-CP-0419-002", kind: "bag", mailTypeAbb: "CP", declaredKg: 31.2, weighedKg: 31.0, sealIntact: false, condition: "resealed", dutiableItems: 5, weighedAt: "2026-07-29T11:14:00+05:00", weighedBy: "h.sadiq" },
  { id: 13, receptacleNo: "FRAAA-LHEAA-CP-0419-003", kind: "bag", mailTypeAbb: "CP", declaredKg: 27.8, weighedKg: 27.9, sealIntact: true, condition: "sound", dutiableItems: 2, weighedAt: "2026-07-29T11:18:00+05:00", weighedBy: "h.sadiq" },
];

/**
 * The demo case. Two loose parcels never presented and one bag torn open, so
 * the physical weight lands 16.25 kg under the AV7 gross — 3.94% against a
 * 1.5% tolerance, well past both the percentage and the 1.5 kg floor.
 */
const R_0421: Receptacle[] = [
  { id: 21, receptacleNo: "DXBAA-KHIAA-CP-0421-001", kind: "bag", mailTypeAbb: "CP", declaredKg: 32.4, weighedKg: 32.5, sealIntact: true, condition: "sound", dutiableItems: 4, weighedAt: "2026-07-31T06:35:00+05:00", weighedBy: "f.iqbal" },
  { id: 22, receptacleNo: "DXBAA-KHIAA-CP-0421-002", kind: "bag", mailTypeAbb: "CP", declaredKg: 30.1, weighedKg: 26.35, sealIntact: false, condition: "torn", dutiableItems: 6, weighedAt: "2026-07-31T06:38:00+05:00", weighedBy: "f.iqbal" },
  { id: 23, receptacleNo: "DXBAA-KHIAA-CP-0421-003", kind: "bag", mailTypeAbb: "CP", declaredKg: 33.8, weighedKg: 33.9, sealIntact: true, condition: "sound", dutiableItems: 2, weighedAt: "2026-07-31T06:41:00+05:00", weighedBy: "f.iqbal" },
  { id: 24, receptacleNo: "DXBAA-KHIAA-CP-0421-004", kind: "loose-parcel", mailTypeAbb: "CP", declaredKg: 6.8, weighedKg: null, sealIntact: false, condition: "missing", dutiableItems: 1, weighedAt: null, weighedBy: null },
  { id: 25, receptacleNo: "DXBAA-KHIAA-CP-0421-005", kind: "loose-parcel", mailTypeAbb: "CP", declaredKg: 5.9, weighedKg: null, sealIntact: false, condition: "missing", dutiableItems: 1, weighedAt: null, weighedBy: null },
  { id: 26, receptacleNo: "DXBAA-KHIAA-AO-0421-006", kind: "mbag", mailTypeAbb: "AO", declaredKg: 25.4, weighedKg: 25.4, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-07-31T06:46:00+05:00", weighedBy: "f.iqbal" },
];

const R_0424: Receptacle[] = [
  { id: 31, receptacleNo: "DOHAA-KHIAA-EMS-0424-001", kind: "bag", mailTypeAbb: "EMS", declaredKg: 14.6, weighedKg: 14.5, sealIntact: true, condition: "sound", dutiableItems: 7, weighedAt: "2026-08-01T05:55:00+05:00", weighedBy: "n.abbas" },
  { id: 32, receptacleNo: "DOHAA-KHIAA-EMS-0424-002", kind: "bag", mailTypeAbb: "EMS", declaredKg: 15.2, weighedKg: 15.3, sealIntact: true, condition: "sound", dutiableItems: 9, weighedAt: "2026-08-01T05:58:00+05:00", weighedBy: "n.abbas" },
  { id: 33, receptacleNo: "DOHAA-KHIAA-EMS-0424-003", kind: "bag", mailTypeAbb: "EMS", declaredKg: 13.8, weighedKg: 13.9, sealIntact: true, condition: "sound", dutiableItems: 4, weighedAt: "2026-08-01T06:02:00+05:00", weighedBy: "n.abbas" },
];

const R_0426: Receptacle[] = [
  { id: 41, receptacleNo: "ISTAA-LHEAA-AO-0426-001", kind: "mbag", mailTypeAbb: "AO", declaredKg: 28.5, weighedKg: 28.2, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-08-02T09:20:00+05:00", weighedBy: "h.sadiq" },
  { id: 42, receptacleNo: "ISTAA-LHEAA-AO-0426-002", kind: "mbag", mailTypeAbb: "AO", declaredKg: 26.9, weighedKg: 26.7, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-08-02T09:24:00+05:00", weighedBy: "h.sadiq" },
  { id: 43, receptacleNo: "ISTAA-LHEAA-LC-0426-003", kind: "tray", mailTypeAbb: "LC", declaredKg: 12.4, weighedKg: 12.4, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-08-02T09:27:00+05:00", weighedBy: "h.sadiq" },
];

const R_0428: Receptacle[] = [
  { id: 51, receptacleNo: "JEDAA-KHIAA-MBAG-0428-001", kind: "mbag", mailTypeAbb: "MBAG", declaredKg: 30.0, weighedKg: null, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: null, weighedBy: null },
  { id: 52, receptacleNo: "JEDAA-KHIAA-MBAG-0428-002", kind: "mbag", mailTypeAbb: "MBAG", declaredKg: 29.5, weighedKg: null, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: null, weighedBy: null },
];

const R_0429: Receptacle[] = [
  { id: 61, receptacleNo: "AUHAA-PEWAA-SAL-0429-001", kind: "bag", mailTypeAbb: "SAL", declaredKg: 22.7, weighedKg: 22.6, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-08-03T08:15:00+05:00", weighedBy: "z.gul" },
  { id: 62, receptacleNo: "AUHAA-PEWAA-SAL-0429-002", kind: "bag", mailTypeAbb: "SAL", declaredKg: 24.1, weighedKg: 24.0, sealIntact: true, condition: "sound", dutiableItems: 0, weighedAt: "2026-08-03T08:19:00+05:00", weighedBy: "z.gul" },
];

/* ---- Dispatches ---------------------------------------------------- */

export const AIRMAIL_DISPATCHES: AirmailDispatch[] = [
  /* 1 — clean, terminated at Karachi, closed. */
  {
    ...audit("2026-07-28T07:20:00+05:00", "2026-07-28T15:10:00+05:00", "f.iqbal"),
    ...siteKeys("KHI"),
    id: 1,
    dispatchNo: "LONAA-KHIAA-0417",
    dispatchDate: "2026-07-27T21:00:00+05:00",
    av7No: "AV7-KHI-2026-0417",
    stage: "AM11-closed",
    bill: {
      ManifiestId: 4101,
      IGMNO: "KHI-2026-11482",
      FLIGHT: "PK-786",
      REGNO: "AP-BLA",
      CARGODATE: "2026-07-28T07:20:00+05:00",
      ORIGIN: "LHR",
      DESTINATION: "KHI",
      AIRLINENAME: "Pakistan International Airlines",
      MailDispatch: "LONAA-KHIAA-0417",
      POORIGIN: "LONAA",
      PODESTINATIONs: "KHIAA",
      MailType: "LC",
      Packages: 4,
      Weight: 78,
      REMARKS: "Priority letter mail, four trays and bags, presented complete.",
      LOOSEPARCELSGROSSWT: 78.0,
      LOOSEPARCELSPHYSICALWT: 78.1,
      IRREGULARITY: null,
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: "Pakistan Post — Karachi FPO, s.jameel",
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "IMPORT",
    },
    mailType: poMailType("LC"),
    poOrigin: exchangeOffice("LONAA"),
    poDestination: exchangeOffice("KHIAA"),
    receptacles: R_0417,
    weights: weighFrom(R_0417, 78.0, 78.1),
    irregularity: null,
    segregation: segregate(R_0417, "2026-07-28T09:05:00+05:00", "f.iqbal"),
    onwardLegRequired: false,
    transfer: null,
    customs: null,
    arrivedFlight: "PK-786",
    arrivedAt: "2026-07-28T06:55:00+05:00",
    handedOverAt: "2026-07-28T15:10:00+05:00",
    closedAt: "2026-07-28T15:30:00+05:00",
    site: "KHI",
  },

  /* 2 — resolved irregularity: a bag re-sealed in transit, seal broken. */
  {
    ...audit("2026-07-29T10:50:00+05:00", "2026-08-01T12:05:00+05:00", "h.sadiq"),
    ...siteKeys("LHE"),
    id: 2,
    dispatchNo: "FRAAA-LHEAA-0419",
    dispatchDate: "2026-07-29T04:30:00+05:00",
    av7No: "AV7-LHE-2026-0419",
    stage: "AM11-closed",
    bill: {
      ManifiestId: 4118,
      IGMNO: "LHE-2026-03310",
      FLIGHT: "TK-714",
      REGNO: "TC-JYK",
      CARGODATE: "2026-07-29T10:50:00+05:00",
      ORIGIN: "FRA",
      DESTINATION: "LHE",
      AIRLINENAME: "Turkish Airlines",
      MailDispatch: "FRAAA-LHEAA-0419",
      POORIGIN: "FRAAA",
      PODESTINATIONs: "LHEAA",
      MailType: "CP",
      Packages: 3,
      Weight: 89,
      REMARKS: "One bag arrived re-sealed with a carrier tape; weight reconciled on the scale.",
      LOOSEPARCELSGROSSWT: 88.6,
      LOOSEPARCELSPHYSICALWT: 88.4,
      // Derived from the CN-43 record below — never keyed. See legacyIrregularityText().
      IRREGULARITY: "Seal broken CN43-LHE-2026-0031",
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: "Pakistan Post — Lahore FPO, r.mehmood",
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "IMPORT",
    },
    mailType: poMailType("CP"),
    poOrigin: exchangeOffice("FRAAA"),
    poDestination: exchangeOffice("LHEAA"),
    receptacles: R_0419,
    weights: weighFrom(R_0419, 88.6, 88.4),
    irregularity: {
      cn43Ref: "CN43-LHE-2026-0031",
      kind: "seal-broken",
      status: "resolved",
      raisedAt: "2026-07-29T11:35:00+05:00",
      raisedBy: "h.sadiq",
      observedGrossKg: 88.6,
      observedPhysicalKg: 88.4,
      varianceKg: -0.2,
      varianceRatio: 0.0023,
      toleranceApplied: AIRMAIL_WEIGHT_TOLERANCE,
      receptaclesAffected: ["FRAAA-LHEAA-CP-0419-002"],
      narrative:
        "Receptacle 002 presented with the original UPU seal cut and carrier tape applied. Weight reconciled to within 0.2 kg, so the note was raised on the seal rather than on a variance. Frankfurt confirmed a security re-screen at FRA.",
      poNotifiedAt: "2026-07-29T12:00:00+05:00",
      airlineNotifiedAt: "2026-07-29T12:04:00+05:00",
      instructionReceivedAt: "2026-07-31T09:20:00+05:00",
      instructionText:
        "FRAAA confirm re-seal was performed by airport security under supervision. No shortage. Deliver as normal.",
      resolvedAt: "2026-08-01T12:05:00+05:00",
      resolvedBy: "h.sadiq",
      cdrRef: null,
    },
    segregation: segregate(R_0419, "2026-07-29T13:10:00+05:00", "h.sadiq"),
    onwardLegRequired: false,
    transfer: null,
    customs: {
      cn22Count: 6,
      cn23Count: 4,
      receptaclesHeld: ["FRAAA-LHEAA-CP-0419-002"],
      presentedAt: "2026-07-30T10:00:00+05:00",
      presentedBy: "h.sadiq",
      customsOfficer: "Appraising Officer — Postal Wing, LHE",
      outcome: "released",
      singleDeclarationNo: null,
    },
    arrivedFlight: "TK-714",
    arrivedAt: "2026-07-29T10:25:00+05:00",
    handedOverAt: "2026-08-01T14:40:00+05:00",
    closedAt: "2026-08-01T15:00:00+05:00",
    site: "LHE",
  },

  /* 3 — THE DEMO CASE. Live irregularity, past tolerance, onward leg blocked. */
  {
    ...audit("2026-07-31T06:15:00+05:00", "2026-08-02T10:30:00+05:00", "f.iqbal"),
    ...siteKeys("KHI"),
    id: 3,
    dispatchNo: "DXBAA-KHIAA-0421",
    dispatchDate: "2026-07-31T02:10:00+05:00",
    av7No: "AV7-KHI-2026-0421",
    stage: "AM05-irregularity",
    bill: {
      ManifiestId: 4126,
      IGMNO: "KHI-2026-11517",
      FLIGHT: "EK-602",
      REGNO: "A6-EDL",
      CARGODATE: "2026-07-31T06:15:00+05:00",
      ORIGIN: "DXB",
      DESTINATION: "KHI",
      AIRLINENAME: "Emirates",
      MailDispatch: "DXBAA-KHIAA-0421",
      POORIGIN: "DXBAA",
      PODESTINATIONs: "PEWAA",
      MailType: "CP",
      Packages: 6,
      Weight: 134,
      REMARKS:
        "Two loose parcels on the AV7 were not presented at the ramp; bag 002 arrived torn. Onward leg to Peshawar held.",
      LOOSEPARCELSGROSSWT: 134.4,
      LOOSEPARCELSPHYSICALWT: 118.15,
      // Derived — the 40-char truncation of the CN-43 record below.
      IRREGULARITY: "Weight variance CN43-KHI-2026-0044",
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: null,
      PartOrShortPackeges: 2,
      PartOrShortWeight: 13,
      ShipmentType: "TRANSIT",
    },
    mailType: poMailType("CP"),
    poOrigin: exchangeOffice("DXBAA"),
    poDestination: exchangeOffice("PEWAA"),
    receptacles: R_0421,
    weights: weighFrom(R_0421, 134.4, 118.15),
    irregularity: {
      cn43Ref: "CN43-KHI-2026-0044",
      kind: "weight-variance",
      status: "awaiting-instruction",
      raisedAt: "2026-07-31T07:05:00+05:00",
      raisedBy: "f.iqbal",
      observedGrossKg: 134.4,
      observedPhysicalKg: 118.15,
      varianceKg: -16.25,
      varianceRatio: 0.1209,
      toleranceApplied: AIRMAIL_WEIGHT_TOLERANCE,
      receptaclesAffected: [
        "DXBAA-KHIAA-CP-0421-002",
        "DXBAA-KHIAA-CP-0421-004",
        "DXBAA-KHIAA-CP-0421-005",
      ],
      narrative:
        "AV7 gross 134.400 kg against a physical 118.150 kg — 16.250 kg short, 12.09% of gross against a 1.5% tolerance. Two loose parcels (004, 005) listed on the CN-38 were never presented at the ramp. Bag 002 was presented torn along the base seam and weighed 3.75 kg under its CN-35 tag. Dubai exchange office and Emirates both notified; awaiting instruction before the Peshawar leg is manifested.",
      poNotifiedAt: "2026-07-31T07:40:00+05:00",
      airlineNotifiedAt: "2026-07-31T07:44:00+05:00",
      instructionReceivedAt: null,
      instructionText: null,
      resolvedAt: null,
      resolvedBy: null,
      cdrRef: null,
    },
    segregation: segregate(R_0421, "2026-07-31T08:30:00+05:00", "f.iqbal"),
    onwardLegRequired: true,
    transfer: null,
    customs: {
      cn22Count: 9,
      cn23Count: 5,
      receptaclesHeld: ["DXBAA-KHIAA-CP-0421-001", "DXBAA-KHIAA-CP-0421-002"],
      presentedAt: "2026-08-01T11:15:00+05:00",
      presentedBy: "f.iqbal",
      customsOfficer: "Appraising Officer — Postal Wing, KHI",
      outcome: "detained",
      singleDeclarationNo: null,
    },
    arrivedFlight: "EK-602",
    arrivedAt: "2026-07-31T05:50:00+05:00",
    handedOverAt: null,
    closedAt: null,
    site: "KHI",
  },

  /* 4 — clean, onward leg raised to Peshawar. */
  {
    ...audit("2026-08-01T05:40:00+05:00", "2026-08-02T07:15:00+05:00", "n.abbas"),
    ...siteKeys("KHI"),
    id: 4,
    dispatchNo: "DOHAA-KHIAA-0424",
    dispatchDate: "2026-08-01T01:20:00+05:00",
    av7No: "AV7-KHI-2026-0424",
    stage: "AM08-transfer-manifested",
    bill: {
      ManifiestId: 4133,
      IGMNO: "KHI-2026-11534",
      FLIGHT: "QR-604",
      REGNO: "A7-BFG",
      CARGODATE: "2026-08-01T05:40:00+05:00",
      ORIGIN: "DOH",
      DESTINATION: "PEW",
      AIRLINENAME: "Qatar Airways",
      MailDispatch: "DOHAA-KHIAA-0424",
      POORIGIN: "DOHAA",
      PODESTINATIONs: "PEWAA",
      MailType: "EMS",
      Packages: 3,
      Weight: 44,
      REMARKS: "EMS dispatch in transit for Peshawar; held in the secure cage pending the PK-355 leg.",
      LOOSEPARCELSGROSSWT: 43.6,
      LOOSEPARCELSPHYSICALWT: 43.7,
      IRREGULARITY: null,
      TRANSFERSTATUS: true,
      TRANSFERNO: "AMT-KHI-2026-0207",
      Deliverdto: null,
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "TRANSIT",
    },
    mailType: poMailType("EMS"),
    poOrigin: exchangeOffice("DOHAA"),
    poDestination: exchangeOffice("PEWAA"),
    receptacles: R_0424,
    weights: weighFrom(R_0424, 43.6, 43.7),
    irregularity: null,
    segregation: segregate(R_0424, "2026-08-01T06:40:00+05:00", "n.abbas"),
    onwardLegRequired: true,
    transfer: {
      TRANSFERNO: "AMT-KHI-2026-0207",
      TRANSFERDATE: "2026-08-02T07:15:00+05:00",
      DISPATCHNO: "DOHAA-KHIAA-0424",
      DISPATCHDATE: "2026-08-01T01:20:00+05:00",
      AV7NO: "AV7-KHI-2026-0424",
      TRANSFERTOSCHFLT: "Y",
      TRANSFERTOFLTNO: "PK-355",
      TRANSFERTOAIRLINEID: "PK",
      TRANSFERTOAIRLINENAME: "Pakistan International Airlines",
      TRANSFERTOAIRLINEABB: "PK",
      DESTINATION: "PEW",
      ORIGIN: "DOH",
      ARRIVEDBYSCHFLT: "Y",
      ARRIVEDBYFLTNO: "QR-604",
      ARRIVEDBYAIRLINEID: "QR",
      ARRIVEDBYAIRLINENAME: "Qatar Airways",
      ARRIVEDBYAIRLINEABB: "QR",
      ARRIVEDDATE: "2026-08-01T05:15:00+05:00",
      TRANSFERTO: "PIA — Peshawar station",
    },
    customs: {
      cn22Count: 14,
      cn23Count: 6,
      receptaclesHeld: [],
      presentedAt: "2026-08-01T09:30:00+05:00",
      presentedBy: "n.abbas",
      customsOfficer: "Appraising Officer — Postal Wing, KHI",
      outcome: "released",
      singleDeclarationNo: null,
    },
    arrivedFlight: "QR-604",
    arrivedAt: "2026-08-01T05:15:00+05:00",
    handedOverAt: null,
    closedAt: null,
    site: "KHI",
  },

  /* 5 — segregated, terminating, awaiting handover. */
  {
    ...audit("2026-08-02T09:05:00+05:00", null, "h.sadiq"),
    ...siteKeys("LHE"),
    id: 5,
    dispatchNo: "ISTAA-LHEAA-0426",
    dispatchDate: "2026-08-02T03:50:00+05:00",
    av7No: "AV7-LHE-2026-0426",
    stage: "AM06-segregated",
    bill: {
      ManifiestId: 4141,
      IGMNO: "LHE-2026-03352",
      FLIGHT: "TK-710",
      REGNO: "TC-JYL",
      CARGODATE: "2026-08-02T09:05:00+05:00",
      ORIGIN: "IST",
      DESTINATION: "LHE",
      AIRLINENAME: "Turkish Airlines",
      MailDispatch: "ISTAA-LHEAA-0426",
      POORIGIN: "ISTAA",
      PODESTINATIONs: "LHEAA",
      MailType: "AO",
      Packages: 3,
      Weight: 68,
      REMARKS: "Mixed AO and LC dispatch; segregated across Postal B and Postal A.",
      LOOSEPARCELSGROSSWT: 67.8,
      LOOSEPARCELSPHYSICALWT: 67.3,
      IRREGULARITY: null,
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: null,
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "IMPORT",
    },
    mailType: poMailType("AO"),
    poOrigin: exchangeOffice("ISTAA"),
    poDestination: exchangeOffice("LHEAA"),
    receptacles: R_0426,
    weights: weighFrom(R_0426, 67.8, 67.3),
    irregularity: null,
    segregation: segregate(R_0426, "2026-08-02T10:15:00+05:00", "h.sadiq"),
    onwardLegRequired: false,
    transfer: null,
    customs: null,
    arrivedFlight: "TK-710",
    arrivedAt: "2026-08-02T08:35:00+05:00",
    handedOverAt: null,
    closedAt: null,
    site: "LHE",
  },

  /* 6 — just identified; nothing on the scale yet. */
  {
    ...audit("2026-08-03T11:20:00+05:00", null, "n.abbas"),
    ...siteKeys("KHI"),
    id: 6,
    dispatchNo: "JEDAA-KHIAA-0428",
    dispatchDate: "2026-08-03T06:00:00+05:00",
    av7No: "AV7-KHI-2026-0428",
    stage: "AM02-identified",
    bill: {
      ManifiestId: 4149,
      IGMNO: "KHI-2026-11561",
      FLIGHT: "SV-702",
      REGNO: "HZ-AK21",
      CARGODATE: "2026-08-03T11:20:00+05:00",
      ORIGIN: "JED",
      DESTINATION: "KHI",
      AIRLINENAME: "Saudia",
      MailDispatch: "JEDAA-KHIAA-0428",
      POORIGIN: "JEDAA",
      PODESTINATIONs: "KHIAA",
      MailType: "MBAG",
      Packages: 2,
      Weight: 60,
      REMARKS: "Two M-bags off SV-702, identified against the AV7. Weighing queued.",
      LOOSEPARCELSGROSSWT: 59.5,
      LOOSEPARCELSPHYSICALWT: 0,
      IRREGULARITY: null,
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: null,
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "IMPORT",
    },
    mailType: poMailType("MBAG"),
    poOrigin: exchangeOffice("JEDAA"),
    poDestination: exchangeOffice("KHIAA"),
    receptacles: R_0428,
    weights: weighFrom(R_0428, 59.5, 0),
    irregularity: null,
    segregation: [],
    onwardLegRequired: false,
    transfer: null,
    customs: null,
    arrivedFlight: "SV-702",
    arrivedAt: "2026-08-03T10:55:00+05:00",
    handedOverAt: null,
    closedAt: null,
    site: "KHI",
  },

  /* 7 — Peshawar, weighed and inside tolerance, variance decision just taken. */
  {
    ...audit("2026-08-03T08:05:00+05:00", null, "z.gul"),
    ...siteKeys("PEW"),
    id: 7,
    dispatchNo: "AUHAA-PEWAA-0429",
    dispatchDate: "2026-08-03T02:40:00+05:00",
    av7No: "AV7-PEW-2026-0429",
    stage: "AM04-variance-checked",
    bill: {
      ManifiestId: 4152,
      IGMNO: "PEW-2026-00918",
      FLIGHT: "EY-238",
      REGNO: "A6-BLV",
      CARGODATE: "2026-08-03T08:05:00+05:00",
      ORIGIN: "AUH",
      DESTINATION: "PEW",
      AIRLINENAME: "Etihad Airways",
      MailDispatch: "AUHAA-PEWAA-0429",
      POORIGIN: "AUHAA",
      PODESTINATIONs: "PEWAA",
      MailType: "SAL",
      Packages: 2,
      Weight: 47,
      REMARKS: "Surface air lifted dispatch; 0.2 kg under gross, inside tolerance.",
      LOOSEPARCELSGROSSWT: 46.8,
      LOOSEPARCELSPHYSICALWT: 46.6,
      IRREGULARITY: null,
      TRANSFERSTATUS: false,
      TRANSFERNO: null,
      Deliverdto: null,
      PartOrShortPackeges: null,
      PartOrShortWeight: null,
      ShipmentType: "IMPORT",
    },
    mailType: poMailType("SAL"),
    poOrigin: exchangeOffice("AUHAA"),
    poDestination: exchangeOffice("PEWAA"),
    receptacles: R_0429,
    weights: weighFrom(R_0429, 46.8, 46.6),
    irregularity: null,
    segregation: [],
    onwardLegRequired: false,
    transfer: null,
    customs: null,
    arrivedFlight: "EY-238",
    arrivedAt: "2026-08-03T07:35:00+05:00",
    handedOverAt: null,
    closedAt: null,
    site: "PEW",
  },
];

/* ================================================================== *
 * Queries
 *
 * These live here rather than in `lib/domain/index.ts` because that barrel
 * is owned by another workstream right now. Screens import from
 * `@/lib/domain/airmail` directly; folding the exports into the barrel is a
 * one-line follow-up when the file is free.
 * ================================================================== */

function inScope<T extends { site: SiteCode }>(rows: T[], scope: SiteScope): T[] {
  return scope === "HQ" ? rows : rows.filter((r) => r.site === scope);
}

export function listAirmailDispatches(scope: SiteScope = "HQ", openOnly = false): AirmailDispatch[] {
  const rows = inScope(AIRMAIL_DISPATCHES, scope);
  return openOnly ? rows.filter((d) => d.stage !== "AM11-closed") : rows;
}

export function airmailDispatch(id: number): AirmailDispatch | null {
  return AIRMAIL_DISPATCHES.find((d) => d.id === id) ?? null;
}

export function airmailDispatchByNo(dispatchNo: string): AirmailDispatch | null {
  return AIRMAIL_DISPATCHES.find((d) => d.dispatchNo === dispatchNo) ?? null;
}

export interface IrregularityRow {
  dispatch: AirmailDispatch;
  irregularity: MailIrregularity;
  check: AirmailVarianceCheck;
  open: boolean;
  /** Days the note has been open, measured against `DEMO_NOW`. */
  ageDays: number;
}

export function listMailIrregularities(scope: SiteScope = "HQ", openOnly = false): IrregularityRow[] {
  const rows = inScope(AIRMAIL_DISPATCHES, scope)
    .filter((d): d is AirmailDispatch & { irregularity: MailIrregularity } => d.irregularity !== null)
    .map((d) => ({
      dispatch: d,
      irregularity: d.irregularity,
      check: dispatchVariance(d),
      open: isIrregularityOpen(d.irregularity),
      // A closed note stops aging at its resolution; an open one ages to now.
      ageDays: daysBetween(d.irregularity.raisedAt, d.irregularity.resolvedAt ?? DEMO_NOW),
    }));
  return openOnly ? rows.filter((r) => r.open) : rows;
}

export interface TransferManifestRow {
  dispatch: AirmailDispatch;
  manifest: AirmailTransferManifest | null;
  gate: ReturnType<typeof evaluateOnwardTransfer>;
}

/** §07 → §08 — every dispatch whose onward-leg decision said Yes. */
export function listAirmailTransfers(scope: SiteScope = "HQ"): TransferManifestRow[] {
  return inScope(AIRMAIL_DISPATCHES, scope)
    .filter((d) => d.onwardLegRequired)
    .map((d) => ({ dispatch: d, manifest: d.transfer, gate: evaluateOnwardTransfer(d) }));
}

export interface SegregationCell {
  zone: MailTypeZone;
  mailType: PoMailType;
  receptacleCount: number;
  weightKg: number;
  dispatches: Array<{ id: number; dispatchNo: string; receptacleCount: number; storedAt: string | null }>;
}

/** §06 — the mail-type → zone board, with what is sitting in each zone. */
export function airmailSegregationBoard(scope: SiteScope = "HQ"): SegregationCell[] {
  const rows = inScope(AIRMAIL_DISPATCHES, scope);
  return PO_MAIL_TYPES.map((mt) => {
    const zone = mailTypeZone(mt.Abbreviation);
    const entries = rows
      .map((d) => ({ d, seg: d.segregation.find((s) => s.mailTypeAbb === mt.Abbreviation) }))
      .filter((x): x is { d: AirmailDispatch; seg: DispatchSegregation } => x.seg !== undefined);

    return {
      zone,
      mailType: mt,
      receptacleCount: entries.reduce((n, x) => n + x.seg.receptacleCount, 0),
      weightKg: round2(entries.reduce((n, x) => n + x.seg.weightKg, 0)),
      dispatches: entries.map((x) => ({
        id: x.d.id,
        dispatchNo: x.d.dispatchNo,
        receptacleCount: x.seg.receptacleCount,
        storedAt: x.seg.storedAt,
      })),
    };
  });
}

export function airmailKpis(scope: SiteScope = "HQ") {
  const rows = inScope(AIRMAIL_DISPATCHES, scope);
  const open = rows.filter((d) => d.stage !== "AM11-closed");
  const irregular = rows.filter((d) => d.irregularity !== null && isIrregularityOpen(d.irregularity));
  const awaitingWeigh = rows.filter((d) => d.receptacles.some((r) => r.weighedKg === null));
  const detained = rows.filter((d) => d.customs?.outcome === "detained");

  return {
    dispatches: rows.length,
    open: open.length,
    inIrregularity: irregular.length,
    awaitingWeigh: awaitingWeigh.length,
    receptacles: rows.reduce((n, d) => n + d.receptacles.length, 0),
    dutiableItems: rows.reduce(
      (n, d) => n + (d.customs ? d.customs.cn22Count + d.customs.cn23Count : 0),
      0,
    ),
    customsDetained: detained.length,
    onwardLegs: rows.filter((d) => d.onwardLegRequired).length,
    shortKg: round2(
      rows.reduce((n, d) => {
        const c = dispatchVariance(d);
        return c.beyondTolerance && c.direction === "short" ? n + Math.abs(c.measure.delta) : n;
      }, 0),
    ),
  };
}
