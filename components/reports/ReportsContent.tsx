"use client";

/**
 * /reports — FC-12 §18, "Reports & dashboards", module M19.
 *
 * WHAT THIS SCREEN WAS. Twenty-four report cards, every one of them a literal.
 * Each carried a hand-written `trend: "up" | "down" | "neutral"` rendered three
 * times — an arrow in the table at the row, the same arrow on the card, and the
 * direction spelled out as a WORD in the drawer — with nothing computing any of
 * them. Each also carried a chartData array (Mon 42, Tue 38, Wed 55 … / W1 8,
 * W2 12 … / Apr 82, May 88, Jun 93) drawn as a bar chart twice over. Above them
 * sat a from/to date range and six dimension selectors, of which five were never
 * read and the sixth matched the chosen cargo class against the report TITLE;
 * below them, three export buttons and a Schedule Email that produced toasts and
 * no bytes. It is two clicks from Home and it is a leaf of Audit & Oversight —
 * the same superadmin block whose auditor screens were rebuilt to zero
 * fabricated measurements.
 *
 * WHAT IT IS NOW. A CATALOGUE, which is what a reports screen honestly is at
 * this stage: the list of reports a user can run, each stating what it covers,
 * which lib/domain call feeds it, what it returns over the fixtures on file, and
 * where it falls short. Seventeen of the twenty-four have a register behind them
 * and print real figures — four with nothing missing, thirteen with a named gap.
 * Seven have no register at all, and they stay on the list with the reason and
 * the nearest real thing: a report silently dropped from a catalogue is a report
 * nobody knows to ask for, and the gap is information the client is buying.
 *
 * NO DIRECTIONS ANYWHERE. Not an arrow, not a word, not a neutral dash. A delta
 * needs two observations and every fixture here is one snapshot at DEMO_NOW.
 * The bars that remain are magnitude within a single breakdown, scaled against
 * the largest row of that breakdown, and each one is labelled with the column it
 * distributes over.
 *
 * Every derivation lives in components/reports/reportCatalogue.ts; this file is
 * layout. That separation is the auditor portal's, and it is what makes "is any
 * figure on this page invented?" answerable by reading one module.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  LayoutGrid,
  Search,
  Table2,
} from "lucide-react";
import DataTable from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { Meter, SeverityPill, type Severity } from "@/components/hq/HqUi";
import { AuditorStat } from "@/components/auditor/AuditorUi";
import { DEMO_NOW, SITES, formatDateTime } from "@/lib/domain";
import NotShownOnReports from "./NotShownOnReports";
import {
  COVERAGE_LABEL,
  REPORT_CATEGORIES,
  catalogueSummary,
  reportCatalogue,
  type Coverage,
  type ReportCategory,
  type ReportEntry,
} from "./reportCatalogue";

/**
 * Coverage is a state, so it is drawn with the reserved severity palette — and
 * always with an icon and a word beside it, never colour alone (HqUi rule 3).
 * "No register" is neutral rather than red: an unbuilt module is a fact about
 * scope, not an operational alarm.
 */
const COVERAGE_SEVERITY: Record<Coverage, Severity> = {
  derived: "good",
  partial: "warning",
  unavailable: "neutral",
};

const COVERAGE_OPTIONS: Array<{ value: "All" | Coverage; label: string }> = [
  { value: "All", label: "Any coverage" },
  { value: "derived", label: "Derived — every figure fed" },
  { value: "partial", label: "Runs with a named gap" },
  { value: "unavailable", label: "No register behind it" },
];

export default function ReportsContent() {
  const entries = useMemo(() => reportCatalogue(), []);
  const summary = useMemo(() => catalogueSummary(entries), [entries]);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | ReportCategory>("All");
  const [coverage, setCoverage] = useState<"All" | Coverage>("All");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const [expanded, setExpanded] = useState<string[]>([]);

  /* A search over the catalogue's own text — the report's name, what it covers
     and the functions that feed it. It filters the list, which is a real list. */
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (category !== "All" && e.category !== category) return false;
      if (coverage !== "All" && e.coverage !== coverage) return false;
      if (q === "") return true;
      return (
        e.title.toLowerCase().includes(q) ||
        e.covers.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        e.category.toLowerCase().includes(q)
      );
    });
  }, [entries, query, category, coverage]);

  const toggle = (list: string[], key: string) =>
    list.includes(key) ? list.filter((x) => x !== key) : [...list, key];

  return (
    <div className="space-y-6">
      {/* ---- Scope strip. What stands where the date range used to. ------- */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[14px] border border-[#E2E8F0] bg-white px-5 py-3.5 shadow-sm">
        <div className="flex items-center gap-2">
          <BookOpen size={15} className="text-[#64748B]" />
          <span className="text-[12px] font-semibold text-[#0F172A]">
            FC-12 §18 — report catalogue
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Scope
          </span>
          <span className="text-[13px] font-bold text-[#0F172A]">Estate-wide</span>
          <span className="text-[12px] text-[#64748B]">{SITES.map((s) => s.code).join(" · ")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            As at
          </span>
          <span className="font-mono text-[12px] text-[#0F172A]">{formatDateTime(DEMO_NOW)}</span>
        </div>
        <p className="ml-auto max-w-[52ch] text-[11px] leading-relaxed text-[#64748B]">
          A catalogue of what can be run, not a live dashboard. One snapshot, so nothing here
          carries a trend — see the last card for what was removed and why.
        </p>
      </div>

      {/* ---- Catalogue figures -------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuditorStat
          label="Reports in the catalogue"
          value={summary.total.toLocaleString("en-PK")}
          detail={`${REPORT_CATEGORIES.length} categories, ${summary.categoriesWithData} of them with at least one runnable report, ${summary.rows.toLocaleString("en-PK")} rows returned in total over the fixtures on file. The same list this screen has always carried — none dropped, including the ones nothing can feed.`}
          source="reportCatalogue() · components/reports/reportCatalogue.ts"
        />
        <AuditorStat
          label="Every figure fed"
          value={`${summary.derived} of ${summary.total}`}
          detail="Each figure on these cards comes from a lib/domain call printed on the card itself."
          source="reportCatalogue() · ReportEntry.coverage === 'derived'"
          severity="good"
          status="derived"
        />
        <AuditorStat
          label="Runs with a named gap"
          value={`${summary.partial} of ${summary.total}`}
          detail="The report returns real rows, and a part of what its name promises cannot be produced. The gap is printed on the card rather than left to be discovered."
          source="reportCatalogue() · ReportEntry.gap"
          severity="warning"
          status="partial"
        />
        <AuditorStat
          label="No register behind them"
          value={`${summary.unavailable} of ${summary.total}`}
          detail={`${entries
            .filter((e) => e.coverage === "unavailable")
            .map((e) => e.title)
            .join(", ")} — kept on the list with the reason on each card, because a report missing from a catalogue is one nobody knows to ask for.`}
          source="reportCatalogue() · ReportEntry.coverage === 'unavailable'"
          severity="neutral"
          status="unbuilt"
        />
      </div>

      {/* ---- Controls ------------------------------------------------------ */}
      <div className="flex flex-wrap items-center gap-3 rounded-[14px] border border-[#E2E8F0] bg-white p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search report names, coverage and sources"
            className="h-9 w-full rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-[13px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          />
        </div>

        <div className="relative">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as "All" | ReportCategory)}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            <option value="All">All categories</option>
            {REPORT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
        </div>

        <div className="relative">
          <select
            value={coverage}
            onChange={(e) => setCoverage(e.target.value as "All" | Coverage)}
            className="h-9 cursor-pointer appearance-none rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[13px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            {COVERAGE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <ChevronDown
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[#94A3B8]"
          />
        </div>

        <div className="ml-auto flex items-center gap-1 rounded-xl border border-[#E2E8F0] p-1">
          <button
            onClick={() => setView("grid")}
            className={`flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-semibold transition-all ${
              view === "grid" ? "bg-[#0B2545] text-white" : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            <LayoutGrid size={14} />
            Cards
          </button>
          <button
            onClick={() => setView("table")}
            className={`flex h-8 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-[12px] font-semibold transition-all ${
              view === "table" ? "bg-[#0B2545] text-white" : "text-[#64748B] hover:bg-[#F8FAFC]"
            }`}
          >
            <Table2 size={14} />
            Index
          </button>
        </div>

        <p className="w-full text-[11px] leading-relaxed text-[#64748B]">
          Three filters, all of which filter this catalogue. The cargo class, customs channel,
          station, agent, consignee and airline selectors that used to sit here are gone — five of
          them were never read, and the sixth matched the chosen class against the report title.
        </p>
      </div>

      {/* ---- The catalogue -------------------------------------------------- */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No report matches these filters"
          description="Every report in the catalogue is still listed — including the six with no register behind them. Clear the filters to see them all."
        />
      ) : view === "grid" ? (
        <div className="space-y-6">
          {REPORT_CATEGORIES.map((cat) => {
            const inCat = filtered.filter((e) => e.category === cat);
            if (inCat.length === 0) return null;
            const isOpen = !collapsed.includes(cat);
            const unfed = inCat.filter((e) => e.coverage === "unavailable").length;
            return (
              <section key={cat}>
                <button
                  onClick={() => setCollapsed((c) => toggle(c, cat))}
                  className="group mb-3 flex w-full cursor-pointer items-center gap-3 text-left"
                >
                  <h3 className="text-[14px] font-bold text-[#0B2545]">{cat}</h3>
                  <span className="text-[12px] text-[#94A3B8]">
                    {inCat.length} report{inCat.length === 1 ? "" : "s"}
                    {unfed > 0 ? ` · ${unfed} with no register` : ""}
                  </span>
                  <ChevronDown
                    size={16}
                    className={`text-[#94A3B8] transition-transform ${isOpen ? "" : "-rotate-90"}`}
                  />
                </button>
                {isOpen && (
                  <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                    {inCat.map((entry) => (
                      <CatalogueCard
                        key={entry.id}
                        entry={entry}
                        open={expanded.includes(entry.id)}
                        onToggle={() => setExpanded((x) => toggle(x, entry.id))}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      ) : (
        <CatalogueIndex entries={filtered} />
      )}

      <NotShownOnReports entries={entries} />
    </div>
  );
}

/**
 * "15 rows — intake dates". The grain is named after the count rather than
 * before it, so a report that returns exactly one row still reads properly.
 */
function returns(entry: ReportEntry): string {
  if (entry.rows === null) return "—";
  return `${entry.rows.toLocaleString("en-PK")} ${entry.rows === 1 ? "row" : "rows"} — ${entry.rowUnit}`;
}

/* ------------------------------------------------------------------ *
 * One report
 * ------------------------------------------------------------------ */

function CatalogueCard({
  entry,
  open,
  onToggle,
}: {
  entry: ReportEntry;
  open: boolean;
  onToggle: () => void;
}) {
  const unfed = entry.coverage === "unavailable";

  return (
    <article
      className="flex flex-col rounded-[16px] border bg-white p-5 shadow-sm"
      style={{
        borderColor: unfed ? "#CBD5E1" : "#E2E8F0",
        borderStyle: unfed ? "dashed" : "solid",
      }}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="text-[14px] font-bold text-[#0F172A]">{entry.title}</h4>
          <p className="mt-1 text-[12px] leading-relaxed text-[#64748B]">{entry.covers}</p>
        </div>
        <SeverityPill
          severity={COVERAGE_SEVERITY[entry.coverage]}
          label={COVERAGE_LABEL[entry.coverage]}
        />
      </header>

      <p className="mt-3 text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
        {entry.rows === null ? "Returns nothing — there is no query to run" : `Returns ${returns(entry)}`}
        {entry.restated ? " · restated from the auditor home" : ""}
      </p>

      {entry.figures.length > 0 && (
        <dl className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {entry.figures.map((f) => (
            <div
              key={f.label}
              className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3"
            >
              <dt className="text-[10px] font-semibold uppercase tracking-wider text-[#94A3B8]">
                {f.label}
              </dt>
              <dd className="mt-1 text-[18px] font-bold leading-tight tabular-nums text-[#0F172A]">
                {f.value}
              </dd>
              {f.note && (
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">{f.note}</p>
              )}
            </div>
          ))}
        </dl>
      )}

      {entry.breakdown && (
        <div className="mt-3">
          <button
            onClick={onToggle}
            className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[#1B4F8B] hover:underline"
          >
            {open ? "Hide the breakdown" : `Show the breakdown — ${entry.breakdown.rows.length} rows`}
            <ChevronDown size={12} className={open ? "rotate-180" : ""} />
          </button>
          {open && (
            <div className="mt-3 rounded-[12px] border border-[#E2E8F0] px-4 py-3">
              <p className="text-[11px] font-semibold text-[#475569]">{entry.breakdown.caption}</p>
              <ul className="mt-3 flex flex-col gap-2.5">
                {entry.breakdown.rows.map((r) => (
                  <li key={r.label}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-[12px] text-[#475569]">{r.label}</span>
                      <span className="whitespace-nowrap text-[12px] font-bold tabular-nums text-[#0F172A]">
                        {r.value}
                      </span>
                    </div>
                    <div className="mt-1">
                      <Meter pct={r.pct} height={6} />
                    </div>
                    {r.note && <p className="mt-1 text-[10px] text-[#94A3B8]">{r.note}</p>}
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[10px] leading-relaxed text-[#94A3B8]">
                Bars are scaled against the largest row of this breakdown. They show magnitude
                within it and nothing else — not a share of a target, and not a change.
              </p>
            </div>
          )}
        </div>
      )}

      {entry.gap && (
        <div className="mt-3 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[11px] font-semibold text-[#B45309]">
            {unfed ? "Why this cannot be run" : "What this report cannot answer"}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#92400E]">{entry.gap}</p>
        </div>
      )}

      {entry.nearest && (
        <p className="mt-3 text-[11px] leading-relaxed text-[#64748B]">
          <span className="font-semibold text-[#475569]">Nearest honest thing: </span>
          {entry.nearest}
        </p>
      )}

      <div className="mt-auto pt-3">
        {entry.href && (
          <Link
            href={entry.href}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            Open the register <ArrowUpRight size={11} />
          </Link>
        )}
        <p className="mt-1.5 font-mono text-[10px] leading-snug text-[#94A3B8]">{entry.source}</p>
      </div>
    </article>
  );
}

/* ------------------------------------------------------------------ *
 * The index view — the same catalogue as one list.
 *
 * The Trend column this table used to carry is replaced by Coverage, which is
 * the question a reader of a report index actually needs answered: can this one
 * be run, and against what.
 * ------------------------------------------------------------------ */

function CatalogueIndex({ entries }: { entries: ReportEntry[] }) {
  const columns = [
    { key: "report", header: "Report", width: "30%" },
    { key: "category", header: "Category" },
    { key: "coverage", header: "Coverage" },
    { key: "returns", header: "Returns" },
    { key: "source", header: "Fed by" },
  ];

  const rows = entries.map((e) => ({
    report: (
      <div>
        <span className="text-[13px] font-semibold text-[#0F172A]">{e.title}</span>
        <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{e.covers}</p>
      </div>
    ),
    category: <span className="text-[12px] text-[#64748B]">{e.category}</span>,
    coverage: (
      <SeverityPill severity={COVERAGE_SEVERITY[e.coverage]} label={COVERAGE_LABEL[e.coverage]} />
    ),
    returns: (
      <span className="text-[12px] font-semibold tabular-nums text-[#0F172A]">{returns(e)}</span>
    ),
    source: <span className="font-mono text-[10px] leading-snug text-[#94A3B8]">{e.source}</span>,
  }));

  return <DataTable columns={columns} rows={rows} headerStyle="navy" zebra />;
}
