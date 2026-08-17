"use client";

/**
 * The landing-page snapshot — twelve string literals replaced by seven computed
 * figures and five stated gaps.
 *
 * WHAT THIS FILE USED TO BE. Four tiles holding twelve hard-coded values:
 * "14,237 pieces", "892,450 kg", "1,204 pallets", "47 ULDs", "342 Green",
 * "89 Yellow", "23 Red", "PKR 8,450,000", "124 invoices", "3 stackers",
 * "12 lifters", "94% uptime". Not one of them came from anywhere. They sat
 * under a heading reading "Live snapshot · auto-refreshing" on the FIRST screen
 * a client sees and the only screen in the product that shows all three portals
 * side by side, directly beneath the portal chips that had just been added to
 * name those portals correctly.
 *
 * The heading was the worse half. Static numbers are a gap; "auto-refreshing"
 * over a component with no timer, no fetch and no state is a claim the code
 * cannot support, and a client who watches it for a minute finds that out
 * before anyone gets to explain it.
 *
 * THE TEST EVERY FIGURE HERE PASSED. Is there a real function over real
 * fixtures behind it, at the scope this page actually has? Seven passed and are
 * computed at render. Five failed and are named in the panel below the grid,
 * with the concrete blocker for each — a missing column, a missing register, a
 * missing time dimension — rather than being deleted quietly. A gap that is not
 * stated reads as "we forgot"; a gap that is stated is a scoping fact, and the
 * fix is costed instead of discovered in UAT.
 *
 * SCOPE IS "HQ", AND THAT IS NOT A PREFERENCE. LayoutClient lists "/" in
 * NO_APP_SHELL_PATHS, so Home renders outside AppShell and therefore outside
 * SiteProvider — `useSite()` would throw here, and there is no node selected
 * because there is no switcher on the page. `SiteScope = "HQ"` is what
 * lib/domain resolves to no site filter (FC-12 §02, the Islamabad HQ tier), so
 * the estate-wide read is both the only one available and the right one for a
 * page whose whole job is to show all three portals at once.
 *
 * WHY THE TILE MARKUP IS LOCAL rather than importing `SiteStat` from
 * components/admin/dashboard/SiteKpiUi or `HqStat` from components/hq/HqUi.
 * The same argument SiteKpiUi itself makes for not importing HqCard: the tier
 * prefix is load-bearing. `SiteStat` asserts one configured node (FC-12 §01)
 * and `HqStat` asserts the Islamabad tier, and this strip is on the front door,
 * which belongs to neither — it is the doorway to all three portals. There is
 * also a hard mechanical reason: NotShownOnDashboard, the card this panel
 * follows, calls `useSite()`, which cannot run on a page with no SiteProvider.
 * What IS copied from those two files is the part that matters — `source` is a
 * REQUIRED prop and it renders under every tile, and there is no trend field.
 *
 * NO LINKS ON THE TILES, deliberately. Every other stat row in this product
 * deep-links, because it sits on a screen with no other navigation. This one
 * sits directly below a grid of sixteen portal tiles that is the navigation, so
 * an "Open" on each card would be a second, competing route list on the same
 * page — and the one thing that page is careful about is not saying the same
 * thing two ways.
 */

import {
  DEMO_NOW,
  SITES,
  formatDateTime,
  formatKg,
  formatPkr,
  hasReached,
  listAwbs,
  listClearances,
  listInvoices,
  listPieces,
  portalKpis,
} from "@/lib/domain";

/* ------------------------------------------------------------------ *
 * The reserved status palette, spelled as components/hq/HqUi.tsx and
 * components/admin/dashboard/SiteKpiUi.tsx spell it, so the front door
 * cannot colour a customs channel differently from the screens it opens.
 * Colour is never the only carrier here: the channel's own name is the
 * label beside every coloured figure.
 * ------------------------------------------------------------------ */

type Tone = "plain" | "green" | "amber" | "red";

const TONE: Record<Tone, string> = {
  plain: "#0F172A",
  green: "#16A34A",
  amber: "#D97706",
  red: "#DC2626",
};

interface Figure {
  value: string;
  label: string;
  tone?: Tone;
}

interface Tile {
  title: string;
  figures: Figure[];
  detail: string;
  /** The lib/domain function this came from, verbatim. Required, and it renders. */
  source: string;
}

/* ------------------------------------------------------------------ *
 * Gaps — same shape as SiteKpiUi's NotFedTile, kept local for the
 * reason given in the header comment.
 * ------------------------------------------------------------------ */

interface Gap {
  /** What the old tile claimed, verbatim, so the removal is auditable. */
  was: string;
  title: string;
  reason: string;
}

const GAPS: Gap[] = [
  {
    was: "1,204 pallets",
    title: "Pallets on hand",
    reason:
      "`Piece` in lib/domain/cargo.ts carries dimensions, weights, a cargo class and a location — and no packaging type. “Pallet” exists in the repo only as one of seven words in PACK_TYPES (lib/domain/exceptions.ts), a vocabulary offered when describing a damaged or discrepant package, and never as a column on anything in store. There is no row to count, at any scope.",
  },
  {
    was: "47 ULDs",
    title: "ULDs on hand",
    reason:
      "There is no ULD register. The only ULD rows anywhere are three transcribed from one real manifest — BULK, PAG40387JT and PAG40479JT on flight OD 0131 into LHE, in lib/domain/reference.ts — and six more held as editable React state inside the UCM builder for a single flight (components/uld-message-builder/ucm/ULDTable.tsx). Neither set has a site column, and FC-16 is a messaging track that joins the cargo flows on the flight, never a count of units standing on the ground.",
  },
  {
    was: "3 stackers · 12 lifters",
    title: "Handling equipment on the floor",
    reason:
      "No asset, fleet or equipment table exists in lib/domain. The only “lifter” in the codebase is `lifter_operator`, a role slug in lib/domain/access.ts — a person who may sign in, not a machine that can be counted — and “stacker” appeared nowhere in the repo except in the literal this file used to hold.",
  },
  {
    was: "94% uptime",
    title: "Equipment uptime",
    reason:
      "This one fails twice over, which is why it is the figure that mattered most. It needs the fleet above, which does not exist; and it needs a time dimension, because uptime is a ratio measured over an interval and every fixture in this demo is a single instant. The only other uptime figures in the repo are the “99.9%” on the login and hero panels, which are marketing copy rather than a measurement.",
  },
];

/* ================================================================== */

export default function QuickStatsStrip() {
  const k = portalKpis("HQ");

  /* Cargo in house. Pieces and kilograms are deliberately read off the SAME
     rows — the pieces actually bound to a location — so the tile does not put a
     scan count beside a declared weight and let a reader assume one basis. */
  const bound = listPieces("HQ").filter((p) => p.scanState === "bound");
  const boundKg = bound.reduce((n, p) => n + p.weights.actualKg, 0);

  /* The declared piece total needs the AWB rows, which portalKpis does not
     return — only its count. So the stored-not-dispatched predicate is spelled
     a second time here, and the duplication is POLICED rather than trusted:
     the "of N declared" clause is only rendered when this list is the same
     length as portalKpis' own awbsInWarehouse. Same discipline as the balance
     column on components/hq/console/EstateRollup.tsx, which re-adds its site
     columns on every row instead of asserting that they close. */
  const inHouse = listAwbs({ scope: "HQ" }).filter(
    (a) => hasReached(a.stage, "stored") && !hasReached(a.stage, "dispatched"),
  );
  const declaredPcs = inHouse.reduce((n, a) => n + a.TOTALPCS, 0);
  const predicateAgrees = inHouse.length === k.awbsInWarehouse;

  /* Customs channels. */
  const clearances = listClearances("HQ");
  const green = listClearances("HQ", "green").length;
  const yellow = listClearances("HQ", "yellow").length;
  const red = listClearances("HQ", "red").length;
  const unchannelled = clearances.length - (green + yellow + red);

  /* Money. */
  const invoices = listInvoices("HQ");
  const unpaid = invoices.filter((i) => i.outstanding > 0);
  const settled = invoices.length - unpaid.length;

  const siteList = SITES.map((s) => s.code).join(" · ");

  const tiles: Tile[] = [
    {
      title: "Cargo in the warehouse",
      figures: [
        { value: String(k.awbsInWarehouse), label: "AWBs" },
        { value: bound.length.toLocaleString("en-PK"), label: "pieces located" },
        { value: formatKg(boundKg), label: "actual" },
      ],
      detail:
        `Stored and not yet dispatched. The piece count and the weight are the same ${bound.length} scanned rows` +
        (predicateAgrees
          ? `, out of the ${declaredPcs.toLocaleString("en-PK")} pieces those AWBs declare`
          : "") +
        ` — bound to a location is what the estate can actually put a hand on, so both figures sit on one basis instead of pairing a scan count with a declared weight.`,
      source: "portalKpis('HQ') · listPieces('HQ') where scanState is bound · lib/domain",
    },
    {
      title: "Customs declarations by channel",
      figures: [
        { value: String(green), label: "Green", tone: "green" },
        { value: String(yellow), label: "Yellow", tone: "amber" },
        { value: String(red), label: "Red", tone: "red" },
      ],
      detail:
        (unchannelled === 0
          ? `Every one of the ${clearances.length} declarations on file carries a channel — none unassigned.`
          : `${green + yellow + red} of ${clearances.length} declarations on file carry a channel; ${unchannelled} ${unchannelled === 1 ? "is" : "are"} unassigned and counted in none of the three.`) +
        " FC-06 §04 fetches the channel electronically rather than having staff type it, so this is a read of the register and not an operator's opinion of it.",
      source: "listClearances('HQ', 'green' | 'yellow' | 'red') · lib/domain/index.ts",
    },
    {
      title: "Outstanding charges",
      figures: [
        { value: formatPkr(k.outstandingAmount), label: "unpaid" },
        { value: `${unpaid.length} / ${invoices.length}`, label: "invoices" },
      ],
      detail:
        `Unpaid balance across every invoice on file estate-wide, with ${formatPkr(k.collectedAmount)} already collected against the other ${settled}. ` +
        `That leaves ${unpaid.length} unpaid ${unpaid.length === 1 ? "invoice" : "invoices"} out of ${invoices.length} as the entire denominator, so the exposure is shown as an amount and a count — a collection rate off ${invoices.length} rows would read as a finding when it is a sample size.`,
      source: "portalKpis('HQ').outstandingAmount · listInvoices('HQ') · lib/domain",
    },
    {
      title: "Open exceptions",
      figures: [
        { value: String(k.exceptionsOpen), label: "open" },
        {
          value: String(k.exceptionsOverThreshold),
          label: "past threshold",
          tone: k.exceptionsOverThreshold > 0 ? "amber" : "plain",
        },
      ],
      /* This tile stands where "Active handling equipment" stood. Its three
         figures had no register behind them and are named in the panel below;
         the slot was refilled with a measure that does have one rather than
         being left as a hole in a four-across grid. */
      detail:
        "The FC-10 §aging queue — six exception kinds on one board, each aged against its own escalation threshold rather than a single shared clock. This tile stands where handling equipment used to; those figures are named below.",
      source: "portalKpis('HQ').exceptionsOpen / .exceptionsOverThreshold · lib/domain",
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <p className="text-[12px] leading-relaxed text-[#64748B]">
        Estate-wide — scope <span className="font-mono text-[11px] text-[#475569]">HQ</span>, all{" "}
        {SITES.length} sites at once ({siteList}). Home renders outside the app shell and its site
        switcher, so no node is selected and there is nothing to switch; every figure below names
        the function it was computed from.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map((tile) => (
          <div
            key={tile.title}
            className="flex flex-col rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <h3 className="text-[12px] font-semibold leading-snug text-[#64748B]">{tile.title}</h3>

            <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-2">
              {tile.figures.map((f) => (
                <div key={f.label} className="flex items-baseline gap-1">
                  <span
                    className="text-[20px] font-bold leading-none tabular-nums"
                    style={{ color: TONE[f.tone ?? "plain"] }}
                  >
                    {f.value}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: f.tone && f.tone !== "plain" ? TONE[f.tone] : "#64748B" }}
                  >
                    {f.label}
                  </span>
                </div>
              ))}
            </div>

            <p className="mt-2.5 text-[11px] leading-relaxed text-[#64748B]">{tile.detail}</p>

            <div className="mt-auto pt-3">
              <p className="font-mono text-[10px] leading-snug text-[#94A3B8]">{tile.source}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ---------------------------------------------------------------- *
       * The five figures that came out, and why. Follows
       * components/admin/dashboard/NotShownOnDashboard.tsx: name the gap,
       * state the concrete blocker, quote what the tile used to claim so
       * the removal can be checked against the old screen.
       * ---------------------------------------------------------------- */}
      <section className="rounded-[16px] border border-[#E2E8F0] bg-white">
        <header className="border-b border-[#F1F5F9] px-5 py-4">
          <h3 className="text-[14px] font-semibold text-[#0F172A]">
            Not shown here, and why
          </h3>
          <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">
            Five figures this strip used to carry. None has a register behind it at any scope, so
            none is drawn — and none is silently dropped either, because each names something a
            cargo terminal genuinely should be able to answer one day.
          </p>
          <p className="mt-1.5 font-mono text-[10px] text-[#94A3B8]">
            no fixture — stated rather than estimated
          </p>
        </header>

        <div className="grid grid-cols-1 gap-3 px-5 py-4 lg:grid-cols-2">
          {GAPS.map((gap) => (
            <div
              key={gap.title}
              className="rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3"
            >
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-[12px] font-semibold text-[#475569]">{gap.title}</p>
                <span className="font-mono text-[10px] text-[#94A3B8] line-through">{gap.was}</span>
              </div>
              <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{gap.reason}</p>
            </div>
          ))}
        </div>

        <div className="px-5 pb-4">
          <div className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#0F172A]">
              And nothing here refreshes, or trends
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
              The heading over this strip read &quot;Live snapshot · auto-refreshing&quot; above a
              component with no timer, no fetch and no state — it now names the instant instead.
              Each of the four tiles this replaces also carried{" "}
              <span className="font-mono text-[10px] text-[#475569]">badge: &quot;inc&quot;</span>,
              an increase marker declared on every tile and rendered by none, which left the strip
              one line of JSX away from drawing four upward arrows. A delta needs two points in
              time, and every fixture in this demo is one snapshot at {formatDateTime(DEMO_NOW)}, so
              there is no yesterday to compare against and no arrow that could point anywhere. The
              tile type above has no field for a trend, rather than an unused one.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
