/**
 * AWB-scoped rent ledger — the modelling half of the legacy
 * `/cmts-absorption/godown-rent-history` port.
 *
 * WHY THIS EXISTS
 * ---------------
 * The canonical Godown Rent screen is **voucher-scoped**: you pick a GRV and
 * everything below it belongs to that GRV, so its rate-tier table stamped one
 * voucher number on every row. The legacy CMTS screen was **AWB-scoped**, and
 * its five period rows carried *four different* voucher numbers — because CMTS
 * bills rent forward in instalments and cuts a fresh GODOWNRENT voucher each
 * time. One AWB spanning several GRVs is therefore a shape the voucher-scoped
 * screen cannot hold at all. That is a modelling loss, not a missing search box,
 * which is why the fix is a second lens over a shared model rather than an input
 * field bolted onto the existing one.
 *
 * The model here is AWB-first: `AwbRentLedger` owns the periods, and each
 * `RentPeriodRow` carries its own voucher. Filtering the rows by voucher gives
 * back the canonical voucher-scoped view for free, so the two lenses cannot
 * drift apart — there is exactly one place a rent period is constructed.
 *
 * FC-07 BC-3 ORDERING
 * -------------------
 * The row sequence is built, never authored: the storage clock starts at cargo
 * intake, the free/grace band runs first and is exactly `cargoClass.freeDays`
 * long, and only the days after it reach a rate tier. Nothing in this file may
 * hardcode a free band ("Day 1–3 free" was the old literal) — `buildLedger`
 * reads the length off the cargo class, so a class with `freeDays: 0` correctly
 * renders no free row and a class with `freeDays: 7` gets a seven-day one.
 */

import {
  awbByNo,
  cargoClass,
  chargesFor,
  formatPkr,
  type Amount,
  type GodownRent,
} from "@/lib/domain";

const MS_PER_DAY = 86_400_000;

/**
 * Rent periods are whole-day, inclusive-of-both-ends bands, so a 4-day band
 * starting on the 4th ends on the 7th — hence the `n - 1` at every call site.
 * Kept local rather than added to lib/domain: it is presentation arithmetic
 * over already-computed values, not a second dwell engine.
 */
function shiftDays(iso: string, n: number): string {
  return new Date(Date.parse(iso) + n * MS_PER_DAY).toISOString();
}

/** One row of the rate-tier breakdown, carrying the voucher it was billed on. */
export interface RentPeriodRow {
  /**
   * Derived from the band's absolute dwell days — never a literal. The free
   * row's label is a function of `cargoClass.freeDays`.
   */
  label: string;
  band: "free" | "chargeable";
  /** ISO. */
  from: string;
  /** ISO, inclusive. */
  to: string;
  days: number;
  /** Zero inside the free band — the grace period is not priced. */
  ratePerKgPerDay: Amount;
  surchargeLabel: string;
  computed: Amount;
  waived: Amount;
  net: Amount;
  /**
   * The GRV this period was billed on. Null on the free band: nothing is
   * charged inside the grace period, so no voucher is cut for it. This is the
   * field the voucher-scoped view could not vary.
   */
  voucher: string | null;
  user: string;
  remark: string;
}

/** Per-voucher roll-up across an AWB's periods — the multi-GRV evidence. */
export interface VoucherSlice {
  voucher: string;
  periodCount: number;
  days: number;
  computed: Amount;
  waived: Amount;
  net: Amount;
}

export interface AwbRentLedger {
  awbNo: string;
  /** Set when the AWB resolves in the fixtures, so the row can link to its hub. */
  awbId: number | null;
  cargoClassId: number;
  /** FC-07 §02 — cargo intake. The storage clock starts here, not at arrival. */
  clockStartedAt: string;
  /** FC-07 §03 — read off the cargo class; never a literal. */
  freeDays: number;
  totalDays: number;
  /** FC-07 §03a — dwell minus free. */
  chargeableDays: number;
  periods: RentPeriodRow[];
  vouchers: VoucherSlice[];
  totals: { days: number; computed: Amount; waived: Amount; net: Amount };
  /**
   * `derived` ledgers are computed from the typed ChargeCalculation and the
   * GODOWNRENT records. `legacy-cmts` is the migration reference case carried
   * over verbatim from the CMTS history screen — see LEGACY_MULTI_VOUCHER.
   */
  origin: "derived" | "legacy-cmts";
  note: string | null;
}

/** A chargeable band, before dates and labels are walked onto it. */
export interface TierSpec {
  days: number;
  ratePerKgPerDay: Amount;
  surchargeLabel: string;
  computed: Amount;
  waived: Amount;
  voucher: string | null;
  user: string;
  remark: string;
}

function sum(rows: RentPeriodRow[], pick: (r: RentPeriodRow) => number): number {
  return rows.reduce((n, r) => n + pick(r), 0);
}

/**
 * The single constructor for a rent ledger. Both lenses and both data origins
 * come through here, which is what keeps the free band honest: callers supply
 * only the *chargeable* tiers, and the grace band is prepended from the cargo
 * class. A caller cannot accidentally bill day one.
 */
export function buildLedger(spec: {
  awbNo: string;
  awbId: number | null;
  cargoClassId: number;
  clockStartedAt: string;
  tiers: TierSpec[];
  origin: AwbRentLedger["origin"];
  note?: string | null;
  freeUser?: string;
}): AwbRentLedger {
  const cls = cargoClass(spec.cargoClassId);
  const freeDays = cls.freeDays;
  const periods: RentPeriodRow[] = [];

  // FC-07 §03 — the grace band, straight off CARGOCLASS. A class with no free
  // allowance (CDT, CDR, LST, REX all sit at 0) must produce no row at all
  // rather than a zero-day one, or the table implies a grace that does not
  // exist.
  if (freeDays > 0) {
    periods.push({
      label: `Free period · day 1–${freeDays}`,
      band: "free",
      from: spec.clockStartedAt,
      to: shiftDays(spec.clockStartedAt, freeDays - 1),
      days: freeDays,
      ratePerKgPerDay: 0,
      surchargeLabel: "—",
      computed: 0,
      waived: 0,
      net: 0,
      voucher: null,
      user: spec.freeUser ?? "—",
      remark: `${cls.ABBREVATION} grace period — ${freeDays}d from cargo intake, nothing accrues`,
    });
  }

  // Walk the chargeable tiers forward from the end of the grace band. `cursor`
  // is the absolute dwell day the next band opens on, so the labels below read
  // as dwell days ("Day 8–14") the way the legacy screen wrote them.
  let cursor = freeDays + 1;
  for (const t of spec.tiers) {
    if (t.days <= 0) continue;
    const from = shiftDays(spec.clockStartedAt, cursor - 1);
    const to = shiftDays(from, t.days - 1);
    periods.push({
      label: `Day ${cursor}–${cursor + t.days - 1}`,
      band: "chargeable",
      from,
      to,
      days: t.days,
      ratePerKgPerDay: t.ratePerKgPerDay,
      surchargeLabel: t.surchargeLabel,
      computed: t.computed,
      waived: t.waived,
      net: t.computed - t.waived,
      voucher: t.voucher,
      user: t.user,
      remark: t.remark,
    });
    cursor += t.days;
  }

  // One slice per distinct voucher, in the order the vouchers first appear —
  // i.e. billing order. The count of these is the whole point of the screen.
  const vouchers: VoucherSlice[] = [];
  for (const p of periods) {
    if (!p.voucher) continue;
    let slice = vouchers.find((v) => v.voucher === p.voucher);
    if (!slice) {
      slice = { voucher: p.voucher, periodCount: 0, days: 0, computed: 0, waived: 0, net: 0 };
      vouchers.push(slice);
    }
    slice.periodCount += 1;
    slice.days += p.days;
    slice.computed += p.computed;
    slice.waived += p.waived;
    slice.net += p.net;
  }

  const totalDays = sum(periods, (p) => p.days);

  return {
    awbNo: spec.awbNo,
    awbId: spec.awbId,
    cargoClassId: spec.cargoClassId,
    clockStartedAt: spec.clockStartedAt,
    freeDays,
    totalDays,
    chargeableDays: Math.max(0, totalDays - freeDays),
    periods,
    vouchers,
    totals: {
      days: totalDays,
      computed: sum(periods, (p) => p.computed),
      waived: sum(periods, (p) => p.waived),
      net: sum(periods, (p) => p.net),
    },
    origin: spec.origin,
    note: spec.note ?? null,
  };
}

/**
 * Pick the GRV a period falls inside. CMTS bills forward, so vouchers partition
 * the dwell into consecutive windows; a period belongs to the last voucher that
 * had opened by the time the period started. Falls back to the first voucher so
 * a period can never end up unattributed on screen.
 */
function voucherCovering(rents: GodownRent[], fromIso: string): GodownRent | null {
  if (rents.length === 0) return null;
  const from = Date.parse(fromIso);
  const inWindow = rents.find(
    (r) => Date.parse(r.FROMDATE) <= from && from <= Date.parse(r.TODATE),
  );
  if (inWindow) return inWindow;
  const opened = rents.filter((r) => Date.parse(r.FROMDATE) <= from);
  return opened.length > 0 ? opened[opened.length - 1] : rents[0];
}

/**
 * Build a ledger for a real AWB out of the typed fixtures: the rate tiers are
 * the ChargeCalculation's `slabLines` (which already ran the FC-07 §08 band
 * split), and the vouchers are the GODOWNRENT records for that AWB.
 *
 * Nothing here re-derives dwell or the free period — both come off the
 * ChargeCalculation, which is the only place the clock is allowed to start.
 */
export function deriveLedger(awbNo: string, rents: GodownRent[]): AwbRentLedger | null {
  const awb = awbByNo(awbNo);
  if (!awb) return null;
  const calc = chargesFor(awb.AWBId);
  if (!calc) return null;

  const ordered = [...rents].sort((a, b) => a.FROMDATE.localeCompare(b.FROMDATE));

  // FC-07 §07 — the category surcharge is levied on the storage base as a
  // whole, so the same percentage annotates every chargeable band rather than
  // varying by band. Showing it per row is what the legacy screen did.
  const surchargeLabel =
    calc.surcharges.length === 0
      ? "0%"
      : calc.surcharges.map((s) => `${s.percent}% ${s.code}`).join(" + ");

  const tiers: TierSpec[] = calc.slabLines.map((line) => {
    const from = shiftDays(calc.clockStartedAt, calc.freeDays + line.DAYFROM - 1);
    const gr = voucherCovering(ordered, from);

    // CMTS `WaivOfStorageOrAmount` — a STORAGE waiver reduces the rent bands
    // themselves, so it lands on the period rows. An AMOUNT waiver is applied
    // to the voucher total instead and deliberately does not appear here.
    const storageWaiver =
      gr && gr.WAIVEOFF && gr.WaivOfStorageOrAmount === "STORAGE" ? gr : null;
    const waived = storageWaiver
      ? Math.round((line.amount * storageWaiver.WAIVEOFFPERCENT) / 100)
      : 0;

    return {
      days: line.daysInBand,
      ratePerKgPerDay: line.ratePerKgPerDay,
      surchargeLabel,
      computed: line.amount,
      waived,
      voucher: gr?.VOUCHERNO ?? null,
      user: gr?.UpdatedBy ?? gr?.CreatedBy ?? "—",
      remark: storageWaiver
        ? `${line.label} · ${storageWaiver.WAIVEOFFREASON ?? "waiver approved"} (${storageWaiver.WAIVEOFFPERCENT}%)`
        : line.label,
    };
  });

  return buildLedger({
    awbNo,
    awbId: awb.AWBId,
    cargoClassId: awb.CARGOCLASSID,
    clockStartedAt: calc.clockStartedAt,
    tiers,
    origin: "derived",
    freeUser: ordered[0]?.CreatedBy ?? "—",
    note:
      ordered.length > 1
        ? null
        : "One GRV covers this AWB's whole dwell, so the AWB lens and the voucher lens agree here. They stop agreeing the moment rent is billed forward in instalments.",
  });
}

/**
 * The CMTS reference case: **one AWB, five period rows, four vouchers**.
 *
 * Carried across from `/cmts-absorption/godown-rent-history` because the
 * canonical fixture cuts exactly one GRV per AWB, so nothing derived from it
 * can demonstrate the shape this screen exists to hold. Amounts, voucher
 * numbers and operators are the legacy screen's own; the free band and the day
 * labels are rebuilt from the cargo class rather than copied, which is why the
 * legacy "Day 1–3 free" literal is gone — GCR happens to carry three free days,
 * and now the row says so because the class says so, not because the string did.
 */
export const LEGACY_MULTI_VOUCHER: AwbRentLedger = buildLedger({
  awbNo: "618-12345678",
  awbId: null,
  // GCR — CARGOCLASS.freeDays = 3, which is where the legacy "Day 1–3" came from.
  cargoClassId: 1,
  clockStartedAt: "2026-05-12T14:20:00.000Z",
  origin: "legacy-cmts",
  freeUser: "S. Khan",
  note:
    "CMTS billed this AWB forward in four instalments and cut a fresh GODOWNRENT voucher each time. " +
    "The voucher lens can show any one of them; only the AWB lens shows that they are one consignment.",
  tiers: [
    {
      days: 4,
      ratePerKgPerDay: 35,
      surchargeLabel: "0%",
      computed: 18620,
      waived: 0,
      voucher: "GR-2026-04421",
      user: "S. Khan",
      remark: "Standard godown rate",
    },
    {
      days: 5,
      ratePerKgPerDay: 50,
      surchargeLabel: "0%",
      computed: 26500,
      waived: 5300,
      voucher: "GR-2026-04498",
      user: "S. Khan",
      remark: "Customs hold waiver (20%) — hold 19–23 May approved by Finance",
    },
    {
      days: 2,
      ratePerKgPerDay: 50,
      surchargeLabel: "15% DGR",
      computed: 12190,
      waived: 0,
      voucher: "GR-2026-04555",
      user: "I. Ali",
      remark: "DGR class surcharge active from 24 May",
    },
    {
      days: 6,
      ratePerKgPerDay: 75,
      surchargeLabel: "35%",
      computed: 50625,
      waived: 0,
      voucher: "GR-2026-04612",
      user: "I. Ali",
      remark: "Premium long-stay tier · Vault zone location surcharge",
    },
  ],
});

/**
 * Every AWB that has rent against it, one ledger each, newest dwell first.
 * The CMTS reference case is appended rather than merged so it is never
 * mistaken for site data — it belongs to no site and says so on screen.
 */
export function buildAwbLedgers(rents: GodownRent[]): AwbRentLedger[] {
  const byAwb = new Map<string, GodownRent[]>();
  for (const r of rents) {
    const bucket = byAwb.get(r.AWBNO);
    if (bucket) bucket.push(r);
    else byAwb.set(r.AWBNO, [r]);
  }

  const derived: AwbRentLedger[] = [];
  for (const [awbNo, group] of byAwb) {
    const ledger = deriveLedger(awbNo, group);
    if (ledger) derived.push(ledger);
  }
  derived.sort((a, b) => b.totalDays - a.totalDays);

  return [LEGACY_MULTI_VOUCHER, ...derived];
}

/** The legacy screen's search box: AWB number or voucher number. */
export function matchesLedger(ledger: AwbRentLedger, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  if (ledger.awbNo.toLowerCase().includes(q)) return true;
  return ledger.vouchers.some((v) => v.voucher.toLowerCase().includes(q));
}

/** Rate column text — "free" reads better than "PKR 0/kg/day" on a grace row. */
export function rateLabel(row: RentPeriodRow): string {
  return row.band === "free" ? "free" : `${formatPkr(row.ratePerKgPerDay)}/kg/day`;
}
