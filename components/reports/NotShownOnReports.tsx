"use client";

/**
 * What this screen no longer claims, and why.
 *
 * The load-bearing card on /reports, in the same role
 * components/auditor/dashboard/NotShownOnAuditorHome.tsx plays for the auditor
 * home, components/hq/console/NotFed.tsx for the HQ console and
 * components/admin/dashboard/NotShownOnDashboard.tsx for the site tier.
 *
 * The failure mode for a report screen is not a missing report. It is a
 * PLAUSIBLE one — a card with a green arrow, a sparkline and a "last updated"
 * timestamp, which is what all twenty-four of these were. So the six things
 * removed are named here with the reason, and two of them are DEMONSTRATED
 * rather than asserted: the old cargo-class filter's behaviour is recomputed
 * from the live catalogue below, so the claim about what it did cannot rot.
 */

import { useMemo } from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { HqCard, NotAvailable } from "@/components/hq/HqUi";
import { DEMO_NOW, SITES, formatDateTime } from "@/lib/domain";
import type { ReportEntry } from "./reportCatalogue";

/** The seven values the old cargo-class selector offered. */
const OLD_CARGO_CLASS_OPTIONS = ["GCR", "ICG", "DGR", "VAL", "PER", "VUN", "AVI"];

/** The five values the old station selector offered, checked against SITES below. */
const OLD_STATION_OPTIONS = ["KHI", "LHE", "ISB", "PEW", "MUX"];

/** The other five selectors on the old filter bar, none of which was read at all. */
const OLD_DEAD_FILTERS = ["Customs channel", "Station", "Agent", "Consignee", "Airline"];

export default function NotShownOnReports({ entries }: { entries: ReportEntry[] }) {
  /**
   * The old filter, re-run against the live catalogue. It compared the selected
   * cargo class against the report TITLE — `r.title.toLowerCase().includes(...)`
   * — so this reproduces exactly what a user got, rather than describing it from
   * memory.
   */
  const oldFilter = useMemo(() => {
    const hits = OLD_CARGO_CLASS_OPTIONS.map((code) => ({
      code,
      matches: entries.filter((e) => e.title.toLowerCase().includes(code.toLowerCase())),
    }));
    return {
      emptied: hits.filter((h) => h.matches.length === 0),
      matched: hits.filter((h) => h.matches.length > 0),
    };
  }, [entries]);

  /** Stations the selector offered that are not nodes in this build. */
  const phantomStations = useMemo(
    () => OLD_STATION_OPTIONS.filter((code) => !SITES.some((s) => s.code === code)),
    [],
  );

  const unavailable = entries.filter((e) => e.coverage === "unavailable").length;

  return (
    <HqCard
      title="Not shown on this screen, and why"
      icon={EyeOff}
      source="no fixture — stated rather than estimated"
      intro="Six things this screen displayed. Each was an affordance for a measurement, a filter or a file that does not exist, and each is named here rather than quietly deleted."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <NotAvailable
          title={`Trend arrows — all ${entries.length} of them`}
          reason={`Every card carried a hand-written trend: "up", "down" or "neutral", rendered three times over — as a green or red arrow in the table, as the same arrow on the card, and in the drawer as the WORD beside it. Nothing computed any of them. A delta needs two observations and every fixture in this build is one snapshot at ${formatDateTime(DEMO_NOW)}, so there was no previous day, week, month or quarter for an arrow to point away from. They are removed rather than recalculated, and NOT replaced with a neutral dash: an indicator that is always grey still says a comparison was attempted. ReportEntry has no trend field and nothing on this screen has the affordance.`}
          nearest="Magnitude within one breakdown, which one snapshot can support — the bars on each card are scaled against the largest row of that breakdown and mean nothing outside it."
        />

        <NotAvailable
          title="The sparkline on every card"
          reason={`Each card also held a chartData array — Mon 42, Tue 38, Wed 55, or W1 8, W2 12, or Apr 82, May 88, Jun 93 — drawn as a bar chart on the card and again, larger, in the drawer. Those days, weeks, months and quarters do not exist in this build. The charts were the more persuasive half of the defect: an arrow states a direction, but a SHAPE implies a series was measured, and a reader who distrusts the arrow will still believe the shape.`}
          nearest="Real distributions, where a dated or categorical column exists to distribute over: intake date, cargo class, tariff band, dwell band, invoice issue date, days to the Section 82 threshold. Each is a histogram of a column, and each card says which column."
        />

        <NotAvailable
          title="The from / to date range"
          reason="It filtered nothing — the range was never read by any code on the screen — and there is nothing for it to filter. One snapshot has no windows, which is the same reason the Today / 7 Days / 30 Days / Custom selector was removed from the auditor home one click away."
          nearest="The scope strip at the top of this screen: all three nodes, one instant, both stated exactly."
        />

        <NotAvailable
          title={`The six dimension filters — cargo class, ${OLD_DEAD_FILTERS.map((f) => f.toLowerCase()).join(", ")}`}
          reason={`Five of the six were never read at all: ${OLD_DEAD_FILTERS.join(", ")} were bound to state and to nothing else${
            phantomStations.length > 0
              ? `, and the station list offered ${OLD_STATION_OPTIONS.length} terminals of which ${phantomStations.join(" and ")} ${phantomStations.length === 1 ? "is not a node" : "are not nodes"} in this build at all — SITES holds ${SITES.map((s) => s.code).join(", ")}`
              : ""
          }. The sixth was worse than dead, because it appeared to work — the cargo-class selector matched the chosen class against the report TITLE rather than against any data. Re-running that comparison against this catalogue right now: ${oldFilter.emptied.length} of the ${OLD_CARGO_CLASS_OPTIONS.length} classes (${oldFilter.emptied.map((h) => h.code).join(", ")}) match no report title at all and emptied the screen${
            oldFilter.matched.length > 0
              ? `, while ${oldFilter.matched
                  .map((h) => `${h.code} matches ${h.matches.length} — ${h.matches.map((m) => `"${m.title}"`).join(", ")}`)
                  .join(" and ")}, on the letters inside the word rather than on anything about the cargo.`
              : "."
          }`}
          nearest="Filters over the thing this screen actually is: a search across report names and descriptions, the category, and whether a register can feed the report. All three filter the catalogue, which is a real list."
        />

        <NotAvailable
          title="Export to CSV, XLSX and PDF, and the scheduled email"
          reason={`Nothing in this build writes a file. The three export buttons raised a toast reading "Report exported as CSV" for zero bytes, and Schedule Email reported "Recurring email export scheduled" against no scheduler, no job store and no delivery channel. A success message for an act that did not occur is the same defect as an invented number, one layer further out — /auditor/export-centre states the identical position for the evidence pack.`}
          nearest="Every figure a report would export is on the card that names it, with the lib/domain call it came from, so the numbers are obtainable even though the artefact is not."
        />

        <NotAvailable
          title="The inc. / exc. tag, and the simulated loading and error states"
          reason={`Every card carried scope: "inc" or "exc". The tag is defined nowhere — not in lib/domain, not in lib/architecture.ts, not in any of the scope documents — and the same two literals appear in other component-local arrays in this repo, labelling nothing there either. The screen also opened with a loading skeleton and an error state wired to a 1,200 ms timer and a Retry button: there is no fetch on this route, so nothing could load slowly and nothing could fail. The fixtures are imported synchronously.`}
          nearest={`Coverage, which is a real property of each report and is computed: ${unavailable} of the ${entries.length} reports in this catalogue have no register behind them, and each says so on its own card.`}
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#0F172A]">
          Estate-wide, and deliberately not following the site switcher
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
          FC-12 §18 sits in the Audit &amp; reporting lane beside §16, §17, §17a and §06, and those
          are cross-site reads — that is what puts them in the HQ tier rather than in the per-site
          node. Every query behind this catalogue passes &quot;HQ&quot; explicitly and shows the
          per-node split inside the figure, so a reader sees all three nodes whatever the shell&apos;s
          scope is set to. The same figures are on the{" "}
          <Link href="/auditor" className="font-semibold text-[#1B4F8B] no-underline hover:underline">
            auditor home
          </Link>
          , and the cards marked &quot;restated&quot; read them from there rather than deriving them
          a second time.
        </p>
      </div>
    </HqCard>
  );
}
