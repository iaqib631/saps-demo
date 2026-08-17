/**
 * The report catalogue — every figure /reports is allowed to print, derived in
 * one place.
 *
 * WHY THIS FILE EXISTS. This screen carried twenty-four report cards and every
 * one of them was a literal. Each had a `trend: "up" | "down" | "neutral"`
 * written into the fixture by hand and rendered three times — as an arrow in
 * the table, as an arrow on the card, and in the drawer as the WORD "Up" beside
 * the arrow — and nothing computed any of them. Each also carried a
 * `chartData` array (Mon 42, Tue 38, Wed 55 …) drawn as a bar chart, so a
 * reader saw a shape, a direction and a colour for measurements that did not
 * exist. /reports is a leaf of Audit & Oversight — the same superadmin block
 * whose auditor screens were rebuilt to zero fabricated measurements — and it
 * is two clicks from Home.
 *
 * A DIRECTION IS THE ONE THING THIS REPO CANNOT SUPPORT. A delta needs two
 * observations. Every fixture here is a single snapshot at DEMO_NOW, so there
 * is no previous day, week, month or quarter for an arrow to point away from.
 * The arrows are therefore removed rather than recomputed, and they are not
 * replaced by a neutral dash either: `ReportEntry` has no trend field, nothing
 * on the screen has the affordance, and neither should grow one. This matches
 * components/hq/HqUi (rule 2), components/auditor/AuditorUi.tsx (no trend prop)
 * and components/admin/dashboard/NotShownOnDashboard.tsx.
 *
 * WHAT THIS SCREEN IS NOW. A CATALOGUE — the list of reports a user can run,
 * each stating what it covers, what feeds it, what it returns over the fixtures
 * on file right now, and where it falls short. That is a legitimate and useful
 * thing for FC-12 §18 to be. A catalogue dressed as a live metrics dashboard is
 * not, which is what the sparklines made it.
 *
 * THREE STATES, AND NO FOURTH:
 *
 *   derived      every figure on the card comes from a lib/domain call named on
 *                the card.
 *   partial      the report runs, and a NAMED part of it cannot be produced —
 *                the gap is printed on the card, because the gap is information
 *                the client is buying.
 *   unavailable  no register exists. The card stays, with the reason and with
 *                the nearest real thing. A report silently dropped from a
 *                catalogue is a report nobody knows to ask for.
 *
 * ESTATE-WIDE, LIKE THE REST OF AUDIT & OVERSIGHT. Every query below passes
 * "HQ" and shows the per-node split inside the figure rather than as a filter
 * over it — components/auditor/auditorMetrics.ts states the reason at length:
 * §16, §17, §17a, §06 and §18 are cross-site reads, and an auditor who sees
 * only the node the shell's switcher happens to be on cannot do the job.
 *
 * ONE SOURCE PER FIGURE. Where the auditor home already publishes a figure —
 * invoices, outstanding, waivers, holds, open CDRs, open exceptions — this
 * module RESTATES it through `estateFigures()` / `estatePanels()` instead of
 * recomputing it. Two derivations of one number is exactly how a screen and a
 * report come to disagree in front of a client, and the restated cards say on
 * their face that they are restatements.
 */

import {
  CARGO_CLASSES,
  DEMO_NOW,
  DISCREPANCY_LABEL,
  EXCEPTION_THRESHOLD_DAYS,
  SECTION_82_DAYS,
  SITES,
  STORAGE_LOCATIONS,
  TARIFF_SLABS,
  VARIANCE_TOLERANCE,
  cargoClass,
  daysBetween,
  formatDate,
  formatKg,
  formatPkr,
  listAwbs,
  listCdrs,
  listChargeCalculations,
  listDamage,
  listDeliveryOrders,
  listDivergedLocations,
  listExceptionQueue,
  listGateOutChecks,
  listGatePasses,
  listIataMessages,
  listInvoices,
  listPickSessions,
  listPieces,
  listPods,
  listVarianceScreen,
  listWaivers,
  portalKpis,
  type ExceptionKind,
  type SiteCode,
} from "@/lib/domain";
import {
  estateFigures,
  estatePanels,
  type EstateFigure,
  type EstatePanelItem,
} from "@/components/auditor/auditorMetrics";

/* ================================================================== *
 * Shapes
 * ================================================================== */

export type Coverage = "derived" | "partial" | "unavailable";

export const COVERAGE_LABEL: Record<Coverage, string> = {
  derived: "Derived",
  partial: "Runs with a gap",
  unavailable: "No register",
};

export const REPORT_CATEGORIES = [
  "Cargo & Operations",
  "Storage",
  "Dispatch",
  "Workforce",
  "Financial",
  "Dolley / GSE",
  "Predictive Layer",
] as const;

export type ReportCategory = (typeof REPORT_CATEGORIES)[number];

export interface ReportFigure {
  label: string;
  value: string;
  note?: string;
}

export interface BreakdownRow {
  label: string;
  value: string;
  /** 0–100, relative to the largest row — magnitude, never a direction. */
  pct: number;
  note?: string;
}

export interface ReportBreakdown {
  caption: string;
  rows: BreakdownRow[];
}

export interface ReportEntry {
  id: string;
  category: ReportCategory;
  title: string;
  /** What the report covers, in one sentence. */
  covers: string;
  coverage: Coverage;
  /** Rows the report returns over the fixtures on file; null when unavailable. */
  rows: number | null;
  rowUnit: string;
  /** The lib/domain calls behind it, verbatim. */
  source: string;
  figures: ReportFigure[];
  breakdown: ReportBreakdown | null;
  /** What the report cannot answer, and why. Always set unless `derived`. */
  gap: string | null;
  /** The nearest real thing, for a report with no register of its own. */
  nearest: string | null;
  /** Where the underlying register is on screen. */
  href: string | null;
  /** True where the figures are restated from the auditor home, not recomputed. */
  restated: boolean;
}

/* ================================================================== *
 * Small helpers — formatting only. Nothing here decides a number.
 * ================================================================== */

/** "KHI 20 · LHE 6 · PEW 3" — the split, never a total dressed as one. */
function perSite(pick: (site: SiteCode) => number): string {
  return SITES.map((s) => `${s.code} ${pick(s.code).toLocaleString("en-PK")}`).join(" · ");
}

function n(x: number): string {
  return x.toLocaleString("en-PK");
}

function pct1(part: number, whole: number): string {
  return whole === 0 ? "n/a" : `${((part / whole) * 100).toFixed(1)}%`;
}

/**
 * Bars are scaled against the LARGEST row, so the meter shows magnitude within
 * one breakdown and nothing else. It is never a percentage of a target and
 * never a change.
 */
function bars(rows: Array<{ label: string; value: string; n: number; note?: string }>): BreakdownRow[] {
  const max = rows.reduce((m, r) => Math.max(m, r.n), 0);
  return rows.map((r) => ({
    label: r.label,
    value: r.value,
    pct: max > 0 ? (r.n / max) * 100 : 0,
    note: r.note,
  }));
}

function countBy<T>(rows: T[], key: (r: T) => string): Array<{ label: string; n: number }> {
  const m = new Map<string, number>();
  for (const r of rows) {
    const k = key(r);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  /* Sorted by label, then count — deterministic whatever order the fixtures
     were generated in. */
  return [...m.entries()]
    .map(([label, count]) => ({ label, n: count }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

function humanDuration(ms: number): string {
  const mins = Math.round(Math.abs(ms) / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

const day = (iso: string) => iso.slice(0, 10);

/* ------------------------------------------------------------------ *
 * Restatement from the auditor home.
 *
 * These two readers exist so a report and the dashboard one click away cannot
 * print two different numbers for one question. If auditorMetrics stops
 * publishing a key, the figure degrades to a stated unavailability — it does
 * NOT silently fall back to a second local derivation, because a quiet
 * recomputation is the failure this is here to prevent.
 * ------------------------------------------------------------------ */

const RESTATE_MISSING = "auditorMetrics no longer publishes this figure — reconnect it rather than recomputing it here";

function restateFigure(figures: EstateFigure[], key: string, label: string): ReportFigure {
  const f = figures.find((x) => x.key === key);
  return f
    ? { label, value: f.value, note: `Restated from the auditor home — ${f.detail}` }
    : { label, value: "unavailable", note: RESTATE_MISSING };
}

function restateItem(
  panels: ReturnType<typeof estatePanels>,
  panelKey: string,
  itemLabel: string,
  label: string,
): ReportFigure {
  const item: EstatePanelItem | undefined = panels
    .find((p) => p.key === panelKey)
    ?.items.find((i) => i.label === itemLabel);
  return item
    ? { label, value: item.value, note: `Restated from the auditor home${item.note ? ` — ${item.note}` : ""}` }
    : { label, value: "unavailable", note: RESTATE_MISSING };
}

/* ================================================================== *
 * The catalogue
 * ================================================================== */

const EXCEPTION_KIND_LABEL: Record<ExceptionKind, string> = {
  cdr: "Discrepancy report",
  hold: "Hold",
  mishandled: "Mishandled",
  "re-export": "Re-export",
  "long-stay": "Long stay",
  detend: "Customs detention",
};

export function reportCatalogue(): ReportEntry[] {
  const figures = estateFigures();
  const panels = estatePanels();

  const kpis = portalKpis("HQ");
  const awbs = listAwbs({ scope: "HQ" });
  const pieces = listPieces("HQ");
  const bound = pieces.filter((p) => p.scanState === "bound");

  /* ---- Cargo & Operations ------------------------------------------ */

  const intakeByDay = countBy(awbs, (a) => day(a.intakeAt)).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const busiestIntake = [...intakeByDay].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))[0];
  const intakeDates = intakeByDay.map((r) => r.label).sort();
  /* `arrivedAt` is the ramp event and `intakeAt` starts the FC-07 storage
     clock. They are different columns and they disagree on real rows, so the
     report names which one it counted. */
  const arrivalDiffers = awbs.filter((a) => day(a.arrivedAt) !== day(a.intakeAt)).length;

  const piecesByClass = countBy(pieces, (p) => cargoClass(p.cargoClassId).ABBREVATION).sort(
    (a, b) => b.n - a.n || a.label.localeCompare(b.label),
  );

  const cdrs = listCdrs("HQ");
  const awbsWithCdr = new Set(cdrs.map((c) => c.awbId)).size;
  const varianceScreens = listVarianceScreen("HQ");
  const varianceBreaching = varianceScreens.filter((v) => v.shouldRaise).length;
  const varianceNearMiss = varianceScreens.filter((v) => v.nearMiss).length;
  const varianceInconsistent = varianceScreens.filter((v) => v.inconsistent).length;

  const queue = listExceptionQueue("HQ");
  const queueOver = queue.filter((q) => q.overThreshold);
  const queueByKind = (Object.keys(EXCEPTION_THRESHOLD_DAYS) as ExceptionKind[])
    .map((kind) => {
      const rowsOfKind = queue.filter((q) => q.kind === kind);
      return {
        kind,
        total: rowsOfKind.length,
        over: rowsOfKind.filter((q) => q.overThreshold).length,
        threshold: EXCEPTION_THRESHOLD_DAYS[kind],
      };
    })
    .filter((k) => k.total > 0);

  /* ---- Storage ------------------------------------------------------ */

  const zoneCapacity = sum(STORAGE_LOCATIONS.map((z) => z.capacityKg));
  const zoneOccupied = sum(STORAGE_LOCATIONS.map((z) => z.occupiedKg));
  /* The zone master DECLARES an occupancy; the piece register accounts for
     kilograms actually bound to a location. Both are real, they are not the
     same measurement, and the report prints both rather than the flattering
     one. */
  const boundKg = sum(bound.map((p) => p.weights.chargeableKg));
  const zonesHoldingPieces = new Set(
    bound.map((p) => p.locationId).filter((id): id is number => id !== null),
  ).size;
  const zoneAbbrevs = [...new Set(STORAGE_LOCATIONS.map((z) => z.ABBREVATION))];
  const occupancyByZoneType = zoneAbbrevs
    .map((abbr) => {
      const zones = STORAGE_LOCATIONS.filter((z) => z.ABBREVATION === abbr);
      const cap = sum(zones.map((z) => z.capacityKg));
      const occ = sum(zones.map((z) => z.occupiedKg));
      return { abbr, cap, occ, share: cap === 0 ? 0 : (occ / cap) * 100 };
    })
    .sort((a, b) => b.share - a.share || a.abbr.localeCompare(b.abbr));
  const holdZones = STORAGE_LOCATIONS.filter((z) => z.isHoldZone).length;

  const dwellDays = awbs.map((a) => daysBetween(a.intakeAt, DEMO_NOW)).sort((a, b) => a - b);
  const dwellMean = dwellDays.length === 0 ? 0 : sum(dwellDays) / dwellDays.length;
  const dwellMedian = dwellDays.length === 0 ? 0 : dwellDays[Math.floor(dwellDays.length / 2)];
  const DWELL_BANDS: Array<{ label: string; test: (d: number) => boolean }> = [
    { label: "Same day", test: (d) => d === 0 },
    { label: "1–3 days", test: (d) => d >= 1 && d <= 3 },
    { label: "4–7 days", test: (d) => d >= 4 && d <= 7 },
    { label: "8–14 days", test: (d) => d >= 8 && d <= 14 },
    { label: "15–29 days", test: (d) => d >= 15 && d <= 29 },
    { label: `${SECTION_82_DAYS} days or more`, test: (d) => d >= SECTION_82_DAYS },
  ];
  const pods = listPods("HQ");
  const completedJourneys = pods
    .map((p) => {
      const a = awbs.find((x) => x.AWBId === p.awbId);
      return a ? { AWBNO: p.AWBNO, days: daysBetween(a.intakeAt, p.capturedAt) } : null;
    })
    .filter((x): x is { AWBNO: string; days: number } => x !== null)
    .sort((a, b) => a.AWBNO.localeCompare(b.AWBNO));

  const damage = listDamage("HQ");
  const excursions = damage.filter((d) => d.TypeofDamage === "Temperature excursion");
  const tempZones = STORAGE_LOCATIONS.filter((z) => z.tempBandC !== undefined);
  const tempZoneIds = new Set(tempZones.map((z) => z.ID));
  const piecesInTempZones = bound.filter((p) => p.locationId !== null && tempZoneIds.has(p.locationId));

  /* ---- Dispatch ----------------------------------------------------- */

  const dos = listDeliveryOrders("HQ");
  const dosIssued = dos.filter((d) => d.issuedAt !== null);
  const doIssueDates = dos.map((d) => d.issuedAt).filter((x): x is string => x !== null);
  const doByDay = countBy(doIssueDates, (iso) => day(iso)).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const doWithGateSnapshot = dosIssued.filter((d) => (d.gateSnapshot ?? []).length > 0).length;

  const delivered = awbs.filter((a) => a.DELIVERED);
  const podComplete = pods.filter((p) => p.complete).length;
  const podCnicMatched = pods.filter((p) => p.cnicMatchesDo).length;
  const podGeo = pods.filter((p) => p.geo !== null).length;
  const podPieces = sum(pods.map((p) => p.piecesDelivered));
  const podPiecesOnDo = sum(pods.map((p) => p.piecesOnDo));

  const passes = listGatePasses("HQ");
  const checks = listGateOutChecks("HQ");
  const blocked = checks.filter((c) => c.outcome === "blocked");
  /* The only two timestamps the gate registers carry. Their difference is
     computed rather than assumed, so the sentence on the card is a
     measurement of the fixtures and not a claim about them. */
  const checkOffsets = checks
    .map((c) => {
      const p = passes.find((x) => x.GATEPASSNO === c.gatePassNo);
      return p ? Date.parse(p.GATEPASSDATE) - Date.parse(c.checkedAt) : null;
    })
    .filter((x): x is number => x !== null);
  const allChecksPrecedePass = checkOffsets.length > 0 && checkOffsets.every((d) => d > 0);
  const smallestOffset = checkOffsets.length === 0 ? 0 : Math.min(...checkOffsets.map(Math.abs));

  /* ---- Workforce ---------------------------------------------------- */

  const movers = countBy(pieces, (p) => p.lastMovementBy).sort(
    (a, b) => b.n - a.n || a.label.localeCompare(b.label),
  );
  const movementStamps = pieces.map((p) => p.lastMovementAt).sort();
  const sessions = listPickSessions("HQ");
  const pickLines = sessions.flatMap((s) => s.lines);
  const scannedLines = pickLines.filter((l) => l.scannedAt !== null);
  const pickAccounts = [...new Set(scannedLines.map((l) => l.scannedBy).filter((x): x is string => x !== null))];
  const completedSessions = sessions.filter((s) => s.completedAt !== null);
  const sessionSpans = completedSessions.map((s) => Date.parse(s.completedAt as string) - Date.parse(s.startedAt));

  const shifts = [...new Set(awbs.map((a) => a.SHIFT))].sort();
  const byShift = shifts.map((sh) => {
    const rows = awbs.filter((a) => a.SHIFT === sh);
    return {
      shift: sh,
      awbs: rows.length,
      kg: sum(rows.map((a) => a.TOTALCHRGWEIGHT)),
      dos: dos.filter((d) => d.SHIFT === sh).length,
    };
  });

  /* ---- Financial ---------------------------------------------------- */

  const invoices = listInvoices("HQ");
  const invoiceTotal = sum(invoices.map((i) => i.total));
  const invoiceByDay = countBy(invoices, (i) => day(i.issuedAt)).sort((a, b) =>
    b.label.localeCompare(a.label),
  );
  const amountByDay = invoiceByDay.map((d) => ({
    label: d.label,
    amount: sum(invoices.filter((i) => day(i.issuedAt) === d.label).map((i) => i.total)),
    count: d.n,
  }));
  const largestInvoice = [...invoices].sort((a, b) => b.total - a.total || a.invoiceNo.localeCompare(b.invoiceNo))[0];

  const waivers = listWaivers("HQ");
  const waivedAmount = sum(waivers.map((w) => w.amount));

  const openInvoices = invoices.filter((i) => i.outstanding > 0);
  const AGING_BANDS: Array<{ label: string; test: (d: number) => boolean }> = [
    { label: "0–30 days", test: (d) => d <= 30 },
    { label: "31–60 days", test: (d) => d > 30 && d <= 60 },
    { label: "61–90 days", test: (d) => d > 60 && d <= 90 },
    { label: "90+ days", test: (d) => d > 90 },
  ];
  const pastDue = openInvoices.filter((i) => Date.parse(i.dueAt) < Date.parse(DEMO_NOW)).length;
  const oldestOpen = openInvoices
    .map((i) => daysBetween(i.issuedAt, DEMO_NOW))
    .reduce((m, d) => Math.max(m, d), 0);

  const calcs = listChargeCalculations("HQ");
  const slabLines = calcs.flatMap((c) => c.slabLines);
  const bandLabels = [...new Set(slabLines.map((l) => l.label))];
  const byBand = bandLabels.map((label) => {
    const lines = slabLines.filter((l) => l.label === label);
    return {
      label,
      days: sum(lines.map((l) => l.daysInBand)),
      amount: sum(lines.map((l) => l.amount)),
      rate: lines[0]?.ratePerKgPerDay ?? 0,
      consignments: lines.length,
    };
  });
  const bandDays = sum(byBand.map((b) => b.days));
  const bandAmount = sum(byBand.map((b) => b.amount));

  /* ---- Predictive --------------------------------------------------- */

  const undelivered = awbs.filter((a) => !a.DELIVERED);
  const toSection82 = undelivered
    .map((a) => ({ AWBNO: a.AWBNO, left: SECTION_82_DAYS - daysBetween(a.intakeAt, DEMO_NOW), site: a.site }))
    .sort((a, b) => a.left - b.left || a.AWBNO.localeCompare(b.AWBNO));
  const S82_BANDS: Array<{ label: string; test: (left: number) => boolean }> = [
    { label: "Past the threshold", test: (l) => l < 0 },
    { label: "7 days or fewer left", test: (l) => l >= 0 && l <= 7 },
    { label: "8–14 days left", test: (l) => l >= 8 && l <= 14 },
    { label: "More than 14 days left", test: (l) => l > 14 },
  ];

  const iata = listIataMessages("HQ");
  const iataFailed = iata.filter((m) => m.status === "failed").length;
  const diverged = listDivergedLocations("HQ").length;
  const podCnicMismatch = pods.filter((p) => !p.cnicMatchesDo).length;

  /* ================================================================== *
   * The twenty-four entries, in the order the screen has always had them
   * ================================================================== */

  return [
    /* ---------------- Cargo & Operations --------------------------- */
    {
      id: "inbound-by-day",
      category: "Cargo & Operations",
      title: "Inbound by Day",
      covers:
        "Consignments taken into the shed, counted on the date the storage clock started, across all three nodes.",
      coverage: "derived",
      rows: intakeByDay.length,
      rowUnit: "intake dates",
      source: "listAwbs({ scope: 'HQ' }) · AWB.intakeAt · lib/domain/index.ts",
      figures: [
        {
          label: "Consignments",
          value: n(awbs.length),
          note: perSite((s) => listAwbs({ scope: s }).length),
        },
        {
          label: "Intake dates covered",
          value: n(intakeByDay.length),
          note:
            intakeDates.length > 0
              ? `${formatDate(intakeDates[0])} to ${formatDate(intakeDates[intakeDates.length - 1])}`
              : "No intake is dated",
        },
        {
          label: "Busiest date",
          value: busiestIntake ? `${n(busiestIntake.n)} on ${formatDate(busiestIntake.label)}` : "n/a",
          note: "The single largest intake day in the register",
        },
        {
          label: "Pieces on those consignments",
          value: n(pieces.length),
          note: `${n(bound.length)} bound to a location, ${n(pieces.length - bound.length)} not`,
        },
      ],
      breakdown: {
        caption: "Consignments by intake date — a histogram of a dated column, newest first",
        rows: bars(
          intakeByDay.map((r) => ({
            label: formatDate(r.label),
            value: `${n(r.n)} AWB${r.n === 1 ? "" : "s"}`,
            n: r.n,
          })),
        ),
      },
      gap:
        `Counted on intakeAt, which is where the FC-07 storage clock starts — not on flight arrival. The two columns disagree on ${n(arrivalDiffers)} of the ${n(awbs.length)} consignments, so the report names which one it used. This is a distribution of dated records, not a rate: there is no earlier week for a day to be up or down against, which is why the Mon–Sun sparkline and its arrow are gone rather than recalculated.`,
      nearest: null,
      href: "/warehouse-manager/awb-detail",
      restated: false,
    },
    {
      id: "pieces-by-class",
      category: "Cargo & Operations",
      title: "Pieces by Class",
      covers: "Every piece on file, split by the cargo handling class its consignment was indexed into.",
      coverage: "derived",
      rows: piecesByClass.length,
      rowUnit: "classes present",
      source: "listPieces('HQ') · Piece.cargoClassId · cargoClass() · lib/domain/masters.ts",
      figures: [
        { label: "Pieces", value: n(pieces.length), note: perSite((s) => listPieces(s).length) },
        {
          label: "Classes present",
          value: `${n(piecesByClass.length)} of ${n(CARGO_CLASSES.length)}`,
          note: "Classes in the master with no piece against them are absent from the split, not zero-filled",
        },
        {
          label: "Bound to a location",
          value: `${n(bound.length)} of ${n(pieces.length)}`,
          note: "Piece.scanState === 'bound' — the rest are unbound, picked, dispatched or unreadable",
        },
      ],
      breakdown: {
        caption: "Pieces by handling class, largest first",
        rows: bars(
          piecesByClass.map((r) => ({
            label: r.label,
            value: `${n(r.n)} (${pct1(r.n, pieces.length)})`,
            n: r.n,
          })),
        ),
      },
      gap: null,
      nearest: null,
      href: "/warehouse-manager/storage-map",
      restated: false,
    },
    {
      id: "storage-occupancy",
      category: "Cargo & Operations",
      title: "Storage Occupancy",
      covers: "Occupancy against capacity for every storage zone at every node, by zone type.",
      coverage: "partial",
      rows: STORAGE_LOCATIONS.length,
      rowUnit: "zone rows",
      source:
        "STORAGE_LOCATIONS · occupiedKg / capacityKg · lib/domain/masters.ts — cross-checked against listPieces('HQ') · Piece.locationId",
      figures: [
        {
          label: "Declared occupancy",
          value: pct1(zoneOccupied, zoneCapacity),
          note: `${formatKg(zoneOccupied)} of ${formatKg(zoneCapacity)} across ${n(STORAGE_LOCATIONS.length)} zone rows`,
        },
        {
          label: "Accounted for by pieces",
          value: formatKg(boundKg),
          note: `${n(bound.length)} bound pieces across ${n(zonesHoldingPieces)} zones — the two figures are independent, see below`,
        },
        {
          label: "Hold and quarantine zones",
          value: `${n(holdZones)} of ${n(STORAGE_LOCATIONS.length)}`,
          note: "StorageLocation.isHoldZone — bonded, detained, CDR, mishandled, re-export and auction areas",
        },
      ],
      breakdown: {
        caption: "Occupancy by zone type, all three nodes combined",
        rows: bars(
          occupancyByZoneType.map((z) => ({
            label: z.abbr,
            value: `${z.share.toFixed(1)}%`,
            n: z.share,
            note: `${formatKg(z.occ)} of ${formatKg(z.cap)}`,
          })),
        ),
      },
      gap:
        `StorageLocation.occupiedKg is carried ON THE ZONE MASTER, not summed from the pieces in the zone: the master declares ${formatKg(zoneOccupied)} occupied while the pieces actually bound to a location account for ${formatKg(boundKg)}. Both numbers are real and they are not the same measurement, so both are printed. A live occupancy would need a stock ledger that debits and credits a zone as cargo moves, and there is none — Piece.locationId is a current position, not a movement.`,
      nearest: null,
      href: "/warehouse-manager/storage-map",
      restated: false,
    },
    {
      id: "cdr-rate",
      category: "Cargo & Operations",
      title: "CDR Rate",
      covers:
        "Discrepancy reports raised against consignments screened at intake, with the tolerance rule that raises them.",
      coverage: "partial",
      rows: cdrs.length,
      rowUnit: "discrepancy reports",
      source:
        "estatePanels() 'Discrepancy reports' · listCdrs('HQ') · listVarianceScreen('HQ') · VARIANCE_TOLERANCE",
      figures: [
        restateItem(panels, "cargo", "Discrepancy reports", "Open of all on file"),
        {
          label: "Consignments carrying one",
          value: `${n(awbsWithCdr)} of ${n(awbs.length)}`,
          note: `${pct1(awbsWithCdr, awbs.length)} of the AWBs on file carry at least one report — counted on distinct AWBs, not on reports, because one consignment can hold several`,
        },
        {
          label: "Intakes screened for variance",
          value: n(varianceScreens.length),
          note: `${n(varianceBreaching)} over the ${(VARIANCE_TOLERANCE * 100).toFixed(0)}% tolerance, ${n(varianceNearMiss)} inside it with a non-zero delta, ${n(varianceInconsistent)} where the screen and the record disagree`,
        },
        {
          label: "Types present",
          value: `${n(new Set(cdrs.map((c) => c.type)).size)} of ${n(Object.keys(DISCREPANCY_LABEL).length)}`,
          note: countBy(cdrs, (c) => DISCREPANCY_LABEL[c.type])
            .map((r) => `${r.label} ${r.n}`)
            .join(" · "),
        },
      ],
      breakdown: {
        caption: "Discrepancy reports by where they have reached in the FC-04 loop",
        rows: bars(
          countBy(cdrs, (c) => c.status)
            .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
            .map((r) => ({ label: r.label, value: n(r.n), n: r.n })),
        ),
      },
      gap:
        "A rate needs a denominator per period; this is a share at one instant. The old card drew W1–W4 columns, and there are no weeks here — every fixture is dated inside one snapshot. The open-of-all figure is restated from the auditor home rather than recounted, so the two screens cannot disagree.",
      nearest: null,
      href: "/exceptions/cdr",
      restated: true,
    },
    {
      id: "sla-conformance",
      category: "Cargo & Operations",
      title: "SLA Conformance",
      covers:
        "Reported as escalation-threshold conformance: open exceptions measured against the six thresholds FC-10 sets for them. Per-process SLA conformance is not what this returns — see below.",
      coverage: "partial",
      rows: queue.length,
      rowUnit: "open exception rows",
      source: "listExceptionQueue('HQ') · EXCEPTION_THRESHOLD_DAYS · lib/domain/exceptions.ts",
      figures: [
        restateItem(panels, "compliance", "Open exceptions", "Open exceptions"),
        {
          label: "Past their own threshold",
          value: `${n(queueOver.length)} of ${n(queue.length)}`,
          note: `${pct1(queueOver.length, queue.length)} of the queue — ExceptionQueueRow.overThreshold, computed from ageDays against thresholdDays`,
        },
        {
          label: "Thresholds in force",
          value: n(Object.keys(EXCEPTION_THRESHOLD_DAYS).length),
          note: Object.entries(EXCEPTION_THRESHOLD_DAYS)
            .map(([k, v]) => `${EXCEPTION_KIND_LABEL[k as ExceptionKind]} ${v}d`)
            .join(" · "),
        },
      ],
      breakdown: {
        caption: "Rows past their threshold, by exception kind",
        rows: bars(
          queueByKind.map((k) => ({
            label: `${EXCEPTION_KIND_LABEL[k.kind]} (${k.threshold}d)`,
            value: `${n(k.over)} of ${n(k.total)}`,
            n: k.over,
          })),
        ),
      },
      gap:
        "This is NOT SLA conformance and the card does not claim to be. Conformance needs a promised time and a measured duration, and the domain has neither for putaway, picking, customs, dispatch or the gate: no record anywhere carries a service target, and only picking pairs a start with an end (PickSession.startedAt / completedAt). The five bars the old card drew — Putaway 94, Picking 88, Customs 76, Dispatch 91, Gate 97 — were literals against targets that do not exist. The escalation thresholds above are the only targets in the repo, so they are what is reported, under their own name.",
      nearest: null,
      href: "/exceptions/queue",
      restated: true,
    },

    /* ---------------- Storage --------------------------------------- */
    {
      id: "rack-utilisation",
      category: "Storage",
      title: "Rack Utilisation",
      covers: "Utilisation per node, from the same zone register as Storage Occupancy, cut by site rather than by zone type.",
      coverage: "partial",
      rows: SITES.length,
      rowUnit: "nodes",
      source: "STORAGE_LOCATIONS · capacityKg / occupiedKg grouped by site · lib/domain/masters.ts",
      figures: [
        {
          label: "Zones per node",
          value: n(STORAGE_LOCATIONS.length / SITES.length),
          note: `${n(STORAGE_LOCATIONS.length)} zone rows across ${n(SITES.length)} nodes — every node carries the same twenty zone types`,
        },
        {
          label: "Busiest node",
          value: (() => {
            const ranked = SITES.map((s) => {
              const zs = STORAGE_LOCATIONS.filter((z) => z.site === s.code);
              const cap = sum(zs.map((z) => z.capacityKg));
              return { code: s.code, share: cap === 0 ? 0 : (sum(zs.map((z) => z.occupiedKg)) / cap) * 100 };
            }).sort((a, b) => b.share - a.share || a.code.localeCompare(b.code));
            return ranked[0] ? `${ranked[0].code} at ${ranked[0].share.toFixed(1)}%` : "n/a";
          })(),
          note: "Declared occupancy against declared capacity, per node",
        },
        {
          label: "Zones over 80% declared",
          value: n(STORAGE_LOCATIONS.filter((z) => z.capacityKg > 0 && z.occupiedKg / z.capacityKg > 0.8).length),
          note: "Where the allocation engine would start proposing an overflow zone",
        },
      ],
      breakdown: {
        caption: "Declared occupancy by node",
        rows: bars(
          SITES.map((s) => {
            const zs = STORAGE_LOCATIONS.filter((z) => z.site === s.code);
            const cap = sum(zs.map((z) => z.capacityKg));
            const occ = sum(zs.map((z) => z.occupiedKg));
            const share = cap === 0 ? 0 : (occ / cap) * 100;
            return {
              label: `${s.code} — ${s.city}`,
              value: `${share.toFixed(1)}%`,
              n: share,
              note: `${formatKg(occ)} of ${formatKg(cap)}`,
            };
          }),
        ),
      },
      gap:
        "Rack- and level-level utilisation does not exist. A piece's finest recorded position is a ZONE — Piece.locationId points at a StorageLocation — so R1…R4 have nothing to be derived from. The heat map on /storage-map draws rows, racks and three levels each from lib/rackData.ts, which GENERATES them from a seeded pseudo-random function: deterministic, so the demo is stable, but not a register, and no piece in the domain references any rack in it. This card and Storage Occupancy are two cuts of ONE register, stated so that agreeing with each other is not mistaken for corroboration.",
      nearest: null,
      href: "/warehouse-manager/storage-map",
      restated: false,
    },
    {
      id: "average-dwell",
      category: "Storage",
      title: "Average Dwell",
      covers: "How long cargo has been in the shed, measured from intake to the demo instant, and intake to POD where a consignment has been delivered.",
      coverage: "partial",
      rows: awbs.length,
      rowUnit: "consignments",
      source: "listAwbs({ scope: 'HQ' }) · daysBetween(AWB.intakeAt, DEMO_NOW) · listPods('HQ')",
      figures: [
        {
          label: "Mean dwell to date",
          value: `${dwellMean.toFixed(1)} days`,
          note: `Median ${n(dwellMedian)} · longest ${n(dwellDays[dwellDays.length - 1] ?? 0)} · shortest ${n(dwellDays[0] ?? 0)}`,
        },
        {
          label: "Still in the warehouse",
          value: n(kpis.awbsInWarehouse),
          note: "portalKpis('HQ').awbsInWarehouse — stored and not yet dispatched, the population the mean above is mostly made of",
        },
        {
          label: "Intake to POD, completed",
          value: completedJourneys.length === 0 ? "none" : completedJourneys.map((c) => `${c.days}d`).join(" · "),
          note:
            completedJourneys.length === 0
              ? "No consignment has a proof of delivery"
              : `${completedJourneys.map((c) => c.AWBNO).join(", ")} — printed as the individual journeys, because ${completedJourneys.length} is not a population`,
        },
        {
          label: "Chargeable days priced",
          value: n(sum(calcs.map((c) => c.chargeableDays))),
          note: `Across ${n(calcs.length)} charge calculations — dwell minus the free period, which is what demurrage actually accrues on`,
        },
      ],
      breakdown: {
        caption: "Consignments by dwell to date",
        rows: bars(
          DWELL_BANDS.map((b) => {
            const count = dwellDays.filter(b.test).length;
            return { label: b.label, value: `${n(count)} AWB${count === 1 ? "" : "s"}`, n: count };
          }),
        ),
      },
      gap:
        `Dwell TO DATE at one instant, not average time-to-dispatch. Only ${n(completedJourneys.length)} of the ${n(awbs.length)} consignments have a proof of delivery, so a completed-journey mean would be an average of ${n(completedJourneys.length)}; the individual journeys are printed instead. The old card's May1/May2/Jun1/Jun2 columns implied four measured periods, and there are none.`,
      nearest: null,
      href: "/exceptions/long-stay",
      restated: false,
    },
    {
      id: "cold-chain-anomalies",
      category: "Storage",
      title: "Cold-chain Anomalies",
      covers: "Temperature excursions recorded against cargo, and the zones that carry a temperature regime.",
      coverage: "partial",
      rows: excursions.length,
      rowUnit: "excursion records",
      source:
        "listDamage('HQ') · DamageDetail.TypeofDamage === 'Temperature excursion' · STORAGE_LOCATIONS.tempBandC",
      figures: [
        {
          label: "Excursion-typed records",
          value: `${n(excursions.length)} of ${n(damage.length)}`,
          note:
            excursions.length === 0
              ? "No damage record is typed as a temperature excursion"
              : `${n(sum(excursions.map((e) => e.DamagedPcs)))} ${sum(excursions.map((e) => e.DamagedPcs)) === 1 ? "piece" : "pieces"}, ${formatKg(sum(excursions.map((e) => e.DamageWeight)))} · DamageDetail carries no site column, so these are scoped through the parent consignment`,
        },
        {
          label: "Zones with a temperature band",
          value: `${n(tempZones.length)} of ${n(STORAGE_LOCATIONS.length)}`,
          note: [...new Set(tempZones.map((z) => `${z.ABBREVATION} ${z.tempBandC?.[0]}…${z.tempBandC?.[1]} C`))].join(" · "),
        },
        {
          label: "Pieces in a temperature-regime zone",
          value: n(piecesInTempZones.length),
          note: "Bound pieces whose zone carries a band — the population an excursion would apply to",
        },
      ],
      breakdown: null,
      gap:
        "No temperature is recorded anywhere in lib/domain: no sensor, no reading, no excursion duration, no magnitude and no breach record. The only trace of a cold-chain failure in the entire domain is the string 'Temperature excursion' as a DamageDetail.TypeofDamage, which says one happened and nothing about how cold, for how long, or in which zone. The old W1–W4 bars (2, 5, 3, 7) had nothing behind them, and the temperature trend on /cold-chain is drawn from an array held inside that component — its sensors S-ERT-01…S-FRO-02 exist in no register.",
      nearest: null,
      href: "/exceptions/cdr",
      restated: false,
    },

    /* ---------------- Dispatch -------------------------------------- */
    {
      id: "dos-issued",
      category: "Dispatch",
      title: "DOs Issued",
      covers: "Delivery orders issued, by issue date and node, with the release evaluation each one snapshotted.",
      coverage: "derived",
      rows: dosIssued.length,
      rowUnit: "delivery orders",
      source: "listDeliveryOrders('HQ') · DeliveryOrder.issuedAt / issuedBy / gateSnapshot · lib/domain/finance.ts",
      figures: [
        {
          label: "Issued",
          value: `${n(dosIssued.length)} of ${n(dos.length)}`,
          note: perSite((s) => listDeliveryOrders(s).filter((d) => d.issuedAt !== null).length),
        },
        {
          label: "Issue dates covered",
          value: n(doByDay.length),
          note: doByDay.map((d) => `${formatDate(d.label)} ${d.n}`).join(" · "),
        },
        {
          label: "Carrying a release snapshot",
          value: `${n(doWithGateSnapshot)} of ${n(dosIssued.length)}`,
          note: "The FC-07 conditions that were true at the moment authority was granted, recorded on the order itself",
        },
      ],
      breakdown: {
        caption: "Delivery orders by issue date, newest first",
        rows: bars(
          doByDay.map((d) => ({ label: formatDate(d.label), value: `${n(d.n)} DO${d.n === 1 ? "" : "s"}`, n: d.n })),
        ),
      },
      gap: null,
      nearest: null,
      href: "/dispatch/gate-out",
      restated: false,
    },
    {
      id: "pod-compliance",
      category: "Dispatch",
      title: "POD Compliance",
      covers: "Proof-of-delivery capture against the consignments that have actually been delivered, item by item.",
      coverage: "partial",
      rows: pods.length,
      rowUnit: "proofs of delivery",
      source: "listPods('HQ') · ProofOfDelivery.complete / cnicMatchesDo / geo · lib/domain/dispatch.ts",
      figures: [
        {
          label: "Captured",
          value: `${n(pods.length)} of ${n(delivered.length)}`,
          note: `Against consignments marked AWB.DELIVERED — ${perSite((s) => listPods(s).length)}`,
        },
        {
          label: "Complete",
          value: `${n(podComplete)} of ${n(pods.length)}`,
          note: "ProofOfDelivery.complete — all five FC-08 §12 evidence items plus geo",
        },
        {
          label: "CNIC matched to the DO",
          value: `${n(podCnicMatched)} of ${n(pods.length)}`,
          note: `${n(podGeo)} carry a geo capture · ${n(podPieces)} of ${n(podPiecesOnDo)} pieces on the orders were handed over`,
        },
      ],
      breakdown: null,
      gap:
        `n = ${n(pods.length)}. A capture RATE off ${n(pods.length)} records is not a rate, so every figure here is printed as a count. The old card's Apr / May / Jun columns (82, 88, 93) implied three measured months; there are none, and both proofs on file were captured on the same day at one node.`,
      nearest: null,
      href: "/consignee/pod-history",
      restated: false,
    },
    {
      id: "vehicle-dwell-gate",
      category: "Dispatch",
      title: "Vehicle Dwell at Gate",
      covers: "Time a vehicle spends between entering and leaving the terminal gate.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no vehicle-in event exists in lib/domain — GatePass carries VehicleNo and GATEPASSDATE, and nothing records an arrival",
      figures: [],
      breakdown: null,
      gap:
        `A dwell is out minus in, and there is no in. No vehicle arrival is recorded at any node: no gate-entry event, no appointment, no queue position and no import-side weighbridge. The two timestamps the gate registers do carry cannot be subtracted into a dwell either — ${
          allChecksPrecedePass
            ? `all ${n(checks.length)} gate-out checks are stamped ${humanDuration(smallestOffset)} or more BEFORE the GATEPASSDATE of the pass they belong to, so their difference runs backwards`
            : `GatePass.GATEPASSDATE and GateOutCheck.checkedAt are two different events on two different records, not an entry and an exit of one vehicle`
        }. The four bars — Entry 12, Exit 18, Peak 25, Off-Peak 8 minutes — measured nothing, and peak versus off-peak is a second dimension no record carries.`,
      nearest: `What the gate registers DO answer, and it is the operationally useful half: ${n(checks.length)} gate-out checks, of which ${n(checks.length - blocked.length)} cleared and ${n(blocked.length)} were blocked at the boundary — one for a tag on the pass that was not read on the vehicle, one for a release condition that had failed since issuance, and one for damage found on the loaded vehicle. Each block carries its reason on the record.`,
      href: "/dispatch/gate-out",
      restated: false,
    },

    /* ---------------- Workforce ------------------------------------- */
    {
      id: "operator-productivity",
      category: "Workforce",
      title: "Operator Productivity",
      covers: "Work attributable to a named account: pieces whose last recorded movement is theirs, and pick lines they scanned.",
      coverage: "partial",
      rows: movers.length,
      rowUnit: "accounts",
      source: "listPieces('HQ') · Piece.lastMovementBy / lastMovementAt · listPickSessions('HQ') · PickLine.scannedBy",
      figures: [
        {
          label: "Accounts with movements",
          value: n(movers.length),
          note: movers.map((m) => `${m.label} ${m.n}`).join(" · "),
        },
        {
          label: "Pieces carrying an attribution",
          value: n(sum(movers.map((m) => m.n))),
          note:
            movementStamps.length > 0
              ? `Piece.lastMovementBy is not nullable, so every piece has one — and it is the LAST move only, never a count of moves. Dated ${formatDate(movementStamps[0])} to ${formatDate(movementStamps[movementStamps.length - 1])}`
              : "No movement is dated",
        },
        {
          label: "Pick lines scanned",
          value: `${n(scannedLines.length)} of ${n(pickLines.length)}`,
          note: `Across ${n(sessions.length)} sessions, all under ${pickAccounts.length === 1 ? `the single account ${pickAccounts[0]}` : `${n(pickAccounts.length)} accounts`}${
            sessionSpans.length > 0
              ? ` · ${n(completedSessions.length)} of ${n(sessions.length)} sessions reached a completion stamp, the shortest taking ${humanDuration(Math.min(...sessionSpans))}`
              : ""
          }`,
        },
      ],
      breakdown: {
        caption: "Pieces by the account that last moved them",
        rows: bars(movers.map((m) => ({ label: m.label, value: n(m.n), n: m.n }))),
      },
      gap:
        "Moves per hour is not computable. Piece.lastMovementAt / lastMovementBy keeps only the LAST movement of each piece — there is no movement history table anywhere in the domain — so a piece moved five times counts once, and the elapsed time between moves is unrecoverable. There is also no roster, so hours worked has no denominator. The three shift bars (22, 19, 24 moves per hour) were literals. The one real duration is picking, and the account on every scanned line is a role login rather than a person.",
      nearest: null,
      href: "/warehouse-manager/picking",
      restated: false,
    },
    {
      id: "lifter-utilisation",
      category: "Workforce",
      title: "Lifter Utilisation",
      covers: "Utilisation of each lifting machine, by asset.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no equipment register exists in lib/domain — no asset, no fleet, no runtime meter",
      figures: [],
      breakdown: null,
      gap:
        "There is no machine in this domain. No asset table, no fleet, no engine hours, no telemetry, and no field on any movement that says which machine performed it. The only occurrence of a lifter anywhere in lib/domain is the role slug `lifter_operator` in lib/domain/access.ts, which grants a PERSON a screen — it does not model a vehicle. LF-01 through LF-04 were four names with four numbers beside them.",
      nearest: `Work attributable to the people who would operate them, which is real: ${n(sum(movers.map((m) => m.n)))} pieces carry the account that last moved them across ${n(movers.length)} accounts, and ${n(sessions.length)} pick sessions carry a start and a finish. That is the Operator Productivity card above.`,
      href: "/lifter-operator/tasks",
      restated: false,
    },
    {
      id: "shift-comparison",
      category: "Workforce",
      title: "Shift Comparison",
      covers: "Consignments and chargeable weight split by the shift stamped on the record.",
      coverage: "partial",
      rows: byShift.length,
      rowUnit: "shifts",
      source: "listAwbs({ scope: 'HQ' }) · AWB.SHIFT / TOTALCHRGWEIGHT · listDeliveryOrders('HQ') · DeliveryOrder.SHIFT",
      figures: [
        {
          label: "Shifts on the register",
          value: n(byShift.length),
          note: byShift.map((s) => `${s.shift} ${s.awbs}`).join(" · "),
        },
        {
          label: "Chargeable weight",
          value: formatKg(sum(byShift.map((s) => s.kg))),
          note: byShift.map((s) => `${s.shift} ${formatKg(s.kg)}`).join(" · "),
        },
        {
          label: "Delivery orders by shift",
          value: n(sum(byShift.map((s) => s.dos))),
          note: byShift.map((s) => `${s.shift} ${s.dos}`).join(" · "),
        },
      ],
      breakdown: {
        caption: "Consignments and chargeable weight by shift",
        rows: bars(
          byShift.map((s) => ({
            label: `Shift ${s.shift}`,
            value: `${n(s.awbs)} AWBs`,
            n: s.awbs,
            note: `${formatKg(s.kg)} chargeable · ${n(s.dos)} delivery order${s.dos === 1 ? "" : "s"}`,
          })),
        ),
      },
      gap:
        "AWB.SHIFT and DeliveryOrder.SHIFT are single-letter columns stamped on a record. There is no shift roster, no shift start or end time, and no attribution of a piece movement to a shift — so consignments and chargeable weight can be split three ways, and moves, hours worked and throughput per hour cannot. The old card's A-Moves / B-Moves columns had no register behind them; the tonnage columns now do.",
      nearest: null,
      href: "/operations-supervisor/shift-handover",
      restated: false,
    },

    /* ---------------- Financial ------------------------------------- */
    {
      id: "daily-billing",
      category: "Financial",
      title: "Daily Billing",
      covers: "Invoiced amount by the date each invoice was issued, with what has been collected against it.",
      coverage: "partial",
      rows: invoices.length,
      rowUnit: "invoices",
      source: "estatePanels() financial · listInvoices('HQ') · Invoice.issuedAt / total · lib/domain/finance.ts",
      figures: [
        restateItem(panels, "financial", "Invoices issued", "Invoices"),
        {
          label: "Invoiced",
          value: formatPkr(invoiceTotal),
          note: `Across ${n(invoiceByDay.length)} issue dates · largest single invoice ${largestInvoice ? `${formatPkr(largestInvoice.total)} (${largestInvoice.invoiceNo})` : "n/a"}`,
        },
        restateItem(panels, "financial", "Collected", "Collected"),
        restateItem(panels, "financial", "Outstanding", "Outstanding"),
      ],
      breakdown: {
        caption: "Amount invoiced by issue date, newest first",
        rows: bars(
          amountByDay.map((d) => ({
            label: formatDate(d.label),
            value: formatPkr(d.amount),
            n: d.amount,
            note: `${n(d.count)} invoice${d.count === 1 ? "" : "s"}`,
          })),
        ),
      },
      gap:
        `"Daily" here is the invoice's own issue date, not a billing period — ${n(invoices.length)} invoices land on ${n(invoiceByDay.length)} dates${largestInvoice ? `, and ${formatPkr(largestInvoice.total)} of the ${formatPkr(invoiceTotal)} total is a single invoice` : ""}. The amounts are printed beside every bar for that reason: the shape of this distribution is one spike and some small bars, which is what the register says. Collected and outstanding are restated from the auditor home, not recomputed.`,
      nearest: null,
      href: "/billing/invoice",
      restated: true,
    },
    {
      id: "waiver-rate",
      category: "Financial",
      title: "Waiver Rate",
      covers: "Charges waived across the estate, as amounts and as the vouchers they were granted on.",
      coverage: "partial",
      rows: waivers.length,
      rowUnit: "waiver requests",
      source: "estateFigures() 'waivers' · listWaivers('HQ') · WaiverRequest.amount / originalTotal / revisedTotal",
      figures: [
        restateFigure(figures, "waivers", "Waivers on file"),
        {
          label: "Amount waived",
          value: formatPkr(waivedAmount),
          note:
            waivers.length === 0
              ? "No waiver has been requested at any node"
              : waivers
                  .map(
                    (w) =>
                      `${w.voucherNo} — ${w.mode === "percent" ? `${w.percent}% of ${w.scope.toLowerCase()}` : "fixed amount"}, ${formatPkr(w.originalTotal)} to ${formatPkr(w.revisedTotal)}, ${w.status}`,
                  )
                  .join(" · "),
        },
      ],
      breakdown: null,
      gap:
        `No rate is published, for the reason the auditor home states in the same words: amounts, not rates. ${
          waivers.length === 1
            ? "One waiver exists estate-wide"
            : `${n(waivers.length)} waivers exist estate-wide`
        }, so "percentage of charges waived" would be a statement about ${waivers.length === 1 ? "a single voucher" : "a handful of vouchers"} dressed as an estate figure — a percentage off n=${n(waivers.length)} reads as a finding when it is a sample size. The Apr / May / Jun series (4.8, 3.9, 2.7) had no months behind it.`,
      nearest: null,
      href: "/finance-manager/waiver-workflow",
      restated: true,
    },
    {
      id: "outstanding-aging",
      category: "Financial",
      title: "Outstanding Aging",
      covers: "Open invoice balances, aged from the date each invoice was issued, with the past-due position stated separately.",
      coverage: "derived",
      rows: openInvoices.length,
      rowUnit: "invoices carrying a balance",
      source: "estatePanels() financial 'Outstanding' · listInvoices('HQ') · Invoice.outstanding / issuedAt / dueAt",
      figures: [
        restateItem(panels, "financial", "Outstanding", "Outstanding"),
        {
          label: "Invoices carrying a balance",
          value: `${n(openInvoices.length)} of ${n(invoices.length)}`,
          note: openInvoices.map((i) => `${i.invoiceNo} ${formatPkr(i.outstanding)} (${i.site})`).join(" · ") || "Every invoice is settled",
        },
        {
          label: "Past due",
          value: `${n(pastDue)} of ${n(openInvoices.length)}`,
          note:
            openInvoices.length === 0
              ? "Nothing is open"
              : `Measured against Invoice.dueAt at the demo instant · oldest open balance is ${n(oldestOpen)} days from issue`,
        },
      ],
      breakdown: {
        caption: "Open balance by age from issue — empty bands are drawn, because empty is an answer",
        rows: bars(
          AGING_BANDS.map((b) => {
            const inBand = openInvoices.filter((i) => b.test(daysBetween(i.issuedAt, DEMO_NOW)));
            const amount = sum(inBand.map((i) => i.outstanding));
            return {
              label: b.label,
              value: formatPkr(amount),
              n: amount,
              note: `${n(inBand.length)} invoice${inBand.length === 1 ? "" : "s"}`,
            };
          }),
        ),
      },
      gap: null,
      nearest: null,
      href: "/finance-manager/payment-reconciliation",
      restated: true,
    },
    {
      id: "tariff-slab-distribution",
      category: "Financial",
      title: "Tariff Slab Distribution",
      covers: "Chargeable days and the amount each tariff band produced, across every charge calculation on file.",
      coverage: "partial",
      rows: byBand.length,
      rowUnit: "bands used",
      source: "listChargeCalculations('HQ') · ChargeCalculation.slabLines · slabBreakdown() · lib/domain/finance.ts",
      figures: [
        {
          label: "Charge calculations",
          value: n(calcs.length),
          note: `${n(slabLines.length)} band lines · ${n(bandDays)} chargeable days priced in total`,
        },
        {
          label: "Priced by the bands",
          value: formatPkr(bandAmount),
          note: "The storage component only — surcharges, handling, documentation and tax sit outside the band table",
        },
        {
          label: "Bands actually used",
          value: `${n(byBand.length)} of ${n(TARIFF_SLABS.length)}`,
          note: byBand.map((b) => `${b.label} at ${formatPkr(b.rate)}/kg/day`).join(" · "),
        },
      ],
      breakdown: {
        caption: "Chargeable days and amount by tariff band",
        rows: bars(
          byBand.map((b) => ({
            label: b.label,
            value: `${n(b.days)} days`,
            n: b.days,
            note: `${formatPkr(b.amount)} across ${n(b.consignments)} consignment${b.consignments === 1 ? "" : "s"}`,
          })),
        ),
      },
      gap:
        "Two caveats this report inherits from the rate card, both stated in lib/domain/masters.ts rather than discovered here. CMTS selects a band set by subclass, location AND weight band, and that selection is not implemented — every consignment in this demo is priced on the general-cargo light-weight card, so this distribution is one card's, not the estate's. And the free period is granted twice, once as cargoClass.freeDays and again as the zero-rated leading band, which under-bills. Both are engine facts; the distribution below is what the engine actually produced, not a corrected version of it.",
      nearest: null,
      href: "/finance-manager/tariff-master-editor",
      restated: false,
    },

    /* ---------------- Dolley / GSE ---------------------------------- */
    {
      id: "dolley-utilisation",
      category: "Dolley / GSE",
      title: "GSE Utilisation",
      covers: "Utilisation of ground support equipment — dollies, tugs and belt loaders.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no ground-support-equipment register exists in lib/domain",
      figures: [],
      breakdown: null,
      gap:
        "There is no equipment of any kind in this domain: no dolley, no tug, no belt loader, no asset table and no utilisation clock. The word 'dolley' appears nowhere in lib/domain, and 'GSE' appears exactly once — as the role slug `gse_manager` in lib/domain/access.ts, a person who would manage equipment that is not modelled. The three bars (Dolley 67, Tug 73, Belt 58) named three machines and gave each a percentage of nothing.",
      nearest:
        "Nothing in the cargo registers stands in for equipment. The honest statement is that this module was never built — which is worth carrying on the catalogue, because a client reading a report list needs to know this one is a commitment rather than a query.",
      href: null,
      restated: false,
    },
    {
      id: "gse-maintenance",
      category: "Dolley / GSE",
      title: "Maintenance Compliance",
      covers: "Scheduled maintenance completed on time, per asset, across the GSE fleet.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no maintenance schedule and no asset register exist in lib/domain",
      figures: [],
      breakdown: null,
      gap:
        "Maintenance compliance needs three things — an asset, a schedule with a due date, and a completion record. None of the three exists. There are no assets at all (see GSE Utilisation), so there is nothing for a schedule to hang off. The Q1 / Q2 / Q3 series also implies three measured quarters, and every fixture in this build is one instant.",
      nearest: "None. This is an unbuilt module, not a query that returns zero rows.",
      href: null,
      restated: false,
    },
    {
      id: "gse-mtbf",
      category: "Dolley / GSE",
      title: "MTBF",
      covers: "Mean time between failures for GSE assets, in operating hours.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no failure record and no runtime meter exist in lib/domain",
      figures: [],
      breakdown: null,
      gap:
        "MTBF is operating hours divided by failures. Neither term exists: no equipment, no failure event, no runtime meter and no maintenance log to derive either from. The two values (Dolley 340 h, Tug 520 h) named assets the domain does not hold and a unit nothing measures.",
      nearest: "None. Reliability engineering needs a fleet history, which is several registers away from anything this build models.",
      href: null,
      restated: false,
    },

    /* ---------------- Predictive Layer ------------------------------ */
    {
      id: "demand-forecast",
      category: "Predictive Layer",
      title: "Demand Forecast",
      covers: "Projected inbound demand over the coming seven days, with confidence bands.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no time series and no model exist — every fixture is one snapshot at DEMO_NOW",
      figures: [],
      breakdown: null,
      gap:
        `A forecast needs a history to fit and an interval to project onto. There is no second observation of anything in this build: every fixture is a single snapshot at ${formatDate(DEMO_NOW)}, there is no model, no fitted parameter and no distribution, so the "confidence bands" the card advertised had nothing to be confident about. The seven D1–D7 columns were typed numbers.`,
      nearest: `What actually arrived, dated: ${n(awbs.length)} consignments across ${n(intakeByDay.length)} intake dates — the Inbound by Day card at the top of this catalogue. That is the observed series a forecast would have to be fitted to, and one month of arrivals at three nodes is not enough to fit one.`,
      href: "/planner/capacity-dashboard",
      restated: false,
    },
    {
      id: "anomaly-detection",
      category: "Predictive Layer",
      title: "Anomaly Detection",
      covers: "Machine-learning anomaly scores over operational events.",
      coverage: "unavailable",
      rows: null,
      rowUnit: "",
      source: "no model, no training data and no score exist in lib/domain",
      figures: [],
      breakdown: null,
      gap:
        "An anomaly score is a number a fitted model produces. There is no model, no training set, no scoring service and no score column on any record — the five values on the old card (0.2, 0.8, 0.3, 0.9, 0.4) were typed, and a score between 0 and 1 is the most credible-looking thing a demo can invent, because it looks like output rather than data.",
      nearest: `What this repo DOES detect, it detects by a stated rule rather than by a model, and every one is countable right now: ${n(varianceBreaching)} intakes over the ${(VARIANCE_TOLERANCE * 100).toFixed(0)}% variance tolerance and ${n(varianceNearMiss)} inside it with a non-zero delta; ${n(queueOver.length)} of ${n(queue.length)} exception rows past their escalation threshold; ${n(diverged)} storage divergences where the logical location is not the physical one; ${n(iataFailed)} of ${n(iata.length)} IATA messages failed; ${n(blocked.length)} of ${n(checks.length)} gate-out checks blocked; ${n(podCnicMismatch)} of ${n(pods.length)} proofs of delivery with a CNIC that does not match the order. Each of those has a rule you can read.`,
      href: "/exceptions/queue",
      restated: false,
    },
    {
      id: "auction-risk",
      category: "Predictive Layer",
      title: "Auction-risk Score",
      covers:
        "Reported as the statutory position: how far each undelivered consignment is from the Section 82 threshold, counted in days. A predictive score is not what this returns — see below.",
      coverage: "partial",
      rows: undelivered.length,
      rowUnit: "undelivered consignments",
      source: "listAwbs({ scope: 'HQ' }) · SECTION_82_DAYS · daysBetween(AWB.intakeAt, DEMO_NOW) · lib/domain/masters.ts",
      figures: [
        {
          label: "Statutory threshold",
          value: `${n(SECTION_82_DAYS)} days`,
          note: "SECTION_82_DAYS · lib/domain/masters.ts — the FC-10 branch C clock, measured on total dwell and not paused by the free period",
        },
        {
          label: "Past the threshold",
          value: n(toSection82.filter((x) => x.left < 0).length),
          note:
            toSection82.filter((x) => x.left < 0).map((x) => `${x.AWBNO} (${x.site}, ${Math.abs(x.left)}d over)`).join(" · ") ||
            "No undelivered consignment is past the threshold",
        },
        {
          label: "Within 14 days of it",
          value: n(toSection82.filter((x) => x.left >= 0 && x.left <= 14).length),
          note:
            toSection82.filter((x) => x.left >= 0 && x.left <= 14).map((x) => `${x.AWBNO} (${x.left}d left)`).join(" · ") ||
            "Nothing is inside fourteen days of the threshold",
        },
      ],
      breakdown: {
        caption: "Undelivered consignments by days to the Section 82 threshold",
        rows: bars(
          S82_BANDS.map((b) => {
            const count = toSection82.filter((x) => b.test(x.left)).length;
            return { label: b.label, value: `${n(count)} AWB${count === 1 ? "" : "s"}`, n: count };
          }),
        ),
      },
      gap:
        "No score is computed and none is drawn. A risk score would need a model and an outcome history — how many consignments like this one actually went to auction — and neither exists. What IS exact is the statutory position: the threshold is a constant in the masters, dwell runs from AWB.intakeAt, and the countdown is arithmetic rather than prediction. The four AWB bars (62, 45, 78, 33) were scores from no model; the countdown here is a deadline. Auction lot, reserve price and disposal live on the long-stay register, not on this card.",
      nearest: null,
      href: "/exceptions/long-stay",
      restated: false,
    },
  ];
}

/* ================================================================== *
 * Catalogue-level counts — the four tiles on the screen
 * ================================================================== */

export interface CatalogueSummary {
  total: number;
  derived: number;
  partial: number;
  unavailable: number;
  /** Rows every runnable report would return, added up. */
  rows: number;
  /** Distinct lib/domain-backed categories with at least one runnable report. */
  categoriesWithData: number;
}

export function catalogueSummary(entries: ReportEntry[]): CatalogueSummary {
  const runnable = entries.filter((e) => e.coverage !== "unavailable");
  return {
    total: entries.length,
    derived: entries.filter((e) => e.coverage === "derived").length,
    partial: entries.filter((e) => e.coverage === "partial").length,
    unavailable: entries.filter((e) => e.coverage === "unavailable").length,
    rows: runnable.reduce((acc, e) => acc + (e.rows ?? 0), 0),
    categoriesWithData: new Set(runnable.map((e) => e.category)).size,
  };
}
