"use client";

/**
 * P4-0 · Customs area index — the FC-06 hub.
 *
 * The customs portal had four leaf routes (filing, gateway, channels,
 * detained) and no landing page: the only hub was /excise-compliance, which
 * sat in a compliance module that is being retired. An area with seven
 * screens and no index forces the operator to navigate it entirely from the
 * sidebar, which is exactly where the FC-06 ordering was wrong (the nav had
 * the gateway ABOVE filing — a declaration is filed and only then
 * transmitted). This page is the replacement hub, and it states the flow
 * order on screen so the sequence survives the next nav edit.
 *
 * Three things came across from /excise-compliance:
 *   • the 5-tile customs KPI strip — /customs/channels only ever carried
 *     per-channel counts on its three cards;
 *   • the Customs SLA Watch panel — no free-period proximity surface exists
 *     anywhere else under /customs/*, and it is the one thing on this page
 *     that tells an officer what to do next rather than what happened;
 *   • the module entry cards, now covering all seven routes.
 *
 * Everything countable reads lib/domain rather than a literal, so a tile can
 * never disagree with the screen it links to. The old hub hardcoded all five
 * numbers, which is how it ended up claiming 12 active holds on a page whose
 * hold register showed a different set.
 */

import { useMemo } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  ChevronRight,
  ClipboardList,
  FileCheck2,
  GitBranch,
  Landmark,
  ListChecks,
  ScrollText,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  DEMO_NOW,
  MS_PER_DAY,
  RISK_CHANNEL_LABEL,
  awbById,
  cargoClass,
  formatDateTime,
  listClearances,
  listDetends,
  listHolds,
  oocVerified,
  submissionsDiverge,
  type RiskChannel,
} from "@/lib/domain";

const CHANNEL_TONE: Record<RiskChannel, { bg: string; fg: string }> = {
  green: { bg: "#DCFCE7", fg: "#16A34A" },
  yellow: { bg: "#FEF3C7", fg: "#D97706" },
  red: { bg: "#FEE2E2", fg: "#DC2626" },
};

const MS_PER_HOUR = 3_600_000;

/**
 * The SLA the watch panel is written against. Named rather than inlined
 * because it appears three times below — in the headline, in the row badge
 * and in the drill instruction — and an SLA that reads "4 hours" in one
 * place and "6" in another is worse than no SLA at all.
 */
const SLA_WINDOW_HOURS = 4;

/**
 * A named owner, kept from the demo deliberately. An SLA breach with no
 * owner is a number nobody acts on, and the drill path below is useless
 * without someone whose job it is to walk it. There is no staffing or
 * duty-roster fixture in lib/domain, so this is a local const — the counts
 * beside it are not.
 */
const SLA_OWNER = "Imran Ali — Customs SLA desk";

/** How many rows the watch panel shows before it stops being a summary. */
const WATCH_ROWS = 6;

interface FreePeriodRow {
  awbId: number;
  awbNo: string;
  consignee: string;
  channel: RiskChannel | null;
  cargoClassName: string;
  freeDays: number;
  expiresAt: string;
  /** Negative once the free period has run out and demurrage is accruing. */
  hoursToExpiry: number;
}

/**
 * "3h 20m left" / "2d 4h past expiry". Whole units only — an SLA panel that
 * reports minutes to two decimal places invites the reader to trust a
 * precision the day-granular fixtures do not have.
 */
function expiryLabel(hours: number): string {
  const abs = Math.abs(hours);
  const days = Math.floor(abs / 24);
  const hrs = Math.floor(abs % 24);
  const mins = Math.floor((abs % 1) * 60);
  const span = days > 0 ? `${days}d ${hrs}h` : hrs > 0 ? `${hrs}h ${mins}m` : `${mins}m`;
  return hours <= 0 ? `${span} past expiry` : `${span} left`;
}

interface EntryCard {
  /** The FC-06 position, shown so the ordering below is checkable. */
  step: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  count: number;
  countLabel: string;
}

export default function CustomsIndexPage() {
  const { scope, isHq } = useSite();

  const clearances = useMemo(() => listClearances(scope), [scope]);
  const liveHolds = useMemo(() => listHolds(scope, true), [scope]);
  const liveDetends = useMemo(() => listDetends(scope, true), [scope]);

  /**
   * The five tiles the old hub carried, recomputed from the typed customs
   * fixtures.
   *
   * One honest change of wording: the original sub-labels claimed time
   * windows — "today", "next 24h", "this shift" — over five hardcoded
   * numbers. The fixtures carry state against a fixed DEMO_NOW, not a live
   * clock, so those windows cannot be computed; every one of them would
   * render 0 and read as "nothing is happening". The tiles therefore count
   * state and say which state they count. A tile that names its own basis is
   * worth more than one that claims a window it cannot measure.
   */
  const kpi = useMemo(() => {
    const green = clearances.filter((c) => c.channel === "green");
    const yellow = clearances.filter((c) => c.channel === "yellow");
    const red = clearances.filter((c) => c.channel === "red");

    // Green is auto-cleared, so "cleared" for that channel means the OOC came
    // back AND reconciled against the SD — oocVerified(), not ooc != null.
    // Issuance alone releases nothing; see the FC-06 amendment in customs.ts.
    const greenCleared = green.filter((c) => c.ooc != null && oocVerified(c.ooc)).length;

    // Queries, not declarations: one yellow declaration can be sitting on
    // several open queries and the CHA owes a document for each.
    const yellowQueriesOpen = yellow.reduce(
      (n, c) => n + c.queries.filter((q) => !q.closedAt).length,
      0,
    );

    // An exam that has been scheduled but not signed off — either not yet
    // carried out, or carried out and found a discrepancy, which leaves the
    // case open on the customs side rather than closing it.
    const redExamsOpen = red.filter(
      (c) =>
        c.examination?.scheduledAt != null &&
        (c.examination.examinedAt == null || c.examination.discrepancyFound),
    ).length;

    const oocPending = clearances.filter((c) => c.ooc == null || !oocVerified(c.ooc)).length;

    // Channel treatment still outstanding — what /customs/channels is for.
    const channelWorkOpen =
      yellow.filter((c) => c.queries.some((q) => !q.closedAt)).length + redExamsOpen;

    const diverged = clearances.filter((c) => submissionsDiverge(c.submissions)).length;

    return {
      greenCleared,
      yellowQueriesOpen,
      redExamsOpen,
      oocPending,
      activeHolds: liveHolds.length,
      channelWorkOpen,
      diverged,
      inPlay: clearances.filter((c) => c.status !== "released").length,
    };
  }, [clearances, liveHolds]);

  /**
   * Customs SLA Watch — free-period proximity per declaration.
   *
   * FC-07 §02–03 is the only definition of the free period in the product:
   * the storage clock starts at cargo INTAKE (not flight arrival) and runs
   * for the cargo class's free days. Expiry is therefore intakeAt +
   * freeDays, computed here from the AWB and its class rather than stored,
   * because nothing in the domain persists an expiry instant and a second
   * copy of that arithmetic is a second place for it to drift.
   *
   * Released declarations are excluded: an AWB that has already left has no
   * SLA left to breach.
   */
  const watch = useMemo<FreePeriodRow[]>(() => {
    const nowMs = Date.parse(DEMO_NOW);
    return clearances
      .filter((c) => c.status !== "released")
      .map((c) => {
        const awb = awbById(c.awbId);
        if (!awb) return null;
        const cls = cargoClass(awb.CARGOCLASSID);
        const expiresMs = Date.parse(awb.intakeAt) + cls.freeDays * MS_PER_DAY;
        return {
          awbId: awb.AWBId,
          awbNo: awb.AWBNO,
          consignee: awb.CONSIGNEE1,
          channel: c.channel,
          cargoClassName: cls.NAME,
          freeDays: cls.freeDays,
          expiresAt: new Date(expiresMs).toISOString(),
          hoursToExpiry: (expiresMs - nowMs) / MS_PER_HOUR,
        } satisfies FreePeriodRow;
      })
      .filter((r): r is FreePeriodRow => r !== null)
      .sort((a, b) => a.hoursToExpiry - b.hoursToExpiry);
  }, [clearances]);

  const approaching = watch.filter(
    (r) => r.hoursToExpiry > 0 && r.hoursToExpiry <= SLA_WINDOW_HOURS,
  );
  const pastExpiry = watch.filter((r) => r.hoursToExpiry <= 0);

  // Everything inside the window, worst first — already-expired rows sort
  // ahead of approaching ones because the sort is ascending on hours
  // remaining. When nothing is breaching, the panel falls back to the
  // nearest declarations rather than rendering an empty card: "nothing is
  // due in the next four hours" is only useful next to what IS due.
  const breaching = watch.filter((r) => r.hoursToExpiry <= SLA_WINDOW_HOURS);
  const watchRows = (breaching.length ? breaching : watch).slice(0, WATCH_ROWS);

  /**
   * Channel Detail is a drill-in, so the card needs a record to drill into.
   * The bare path only redirects back to the channels list now, and a card
   * that lands on the list beside the card that IS the list is a dead entry.
   * Pick what an officer would open first — a declaration with an open query,
   * then one with an exam still to be signed off, then whatever is on file.
   */
  const workbenchHref = useMemo(() => {
    const target =
      clearances.find((c) => c.queries.some((q) => !q.closedAt)) ??
      clearances.find(
        (c) => c.examination?.scheduledAt != null && c.examination.examinedAt == null,
      ) ??
      clearances[0];
    return target ? `/customs/channel-detail/${target.awbId}` : "/customs/channels";
  }, [clearances]);

  /**
   * Entry cards in FC-06 FLOW ORDER, not alphabetical and not by portal
   * seniority. The sequence is the reason this page exists:
   *
   *   §03  a declaration is filed        → /customs/filing
   *   §03a and only then transmitted     → /customs/gateway
   *        the queue you work it from    → /customs/queue
   *   §04–08 channel treatment           → /customs/channels
   *        the officer's working surface → /customs/channel-detail/[awbId]
   *   §08a-K out-of-charge keyed         → /customs/ooc-capture
   *   §05-R1 what customs held back      → /customs/detained
   *
   * The retired nav had gateway above filing, which inverts the first two
   * steps. The `step` chip on each card is what makes a future re-order
   * visibly wrong instead of quietly wrong.
   */
  const cards = useMemo<EntryCard[]>(
    () => [
      {
        step: "FC-06 §03",
        title: "SD / GD Filing",
        description:
          "The declaration as customs holds it — Single Declaration reference, legacy GD number, PCT heading and the commercial detail duty is assessed on.",
        href: "/customs/filing",
        icon: <ScrollText size={20} color="#0B2545" />,
        count: clearances.length,
        countLabel: "declarations on file",
      },
      {
        step: "FC-06 §03a",
        title: "Gateway — PSW / WeBOC",
        description:
          "Every filing is a pair of submissions during the parallel run: PSW primary, WeBOC alongside. A divergence between them means the filing is not settled.",
        href: "/customs/gateway",
        icon: <Landmark size={20} color="#0B2545" />,
        count: kpi.diverged,
        countLabel: "PSW / WeBOC divergences",
      },
      {
        step: "FC-06 · queue",
        title: "Customs Queue",
        description:
          "The tabular work queue — every declaration filed and not yet released, aged, filterable by channel, CHA and cargo class.",
        href: "/customs/queue",
        icon: <ListChecks size={20} color="#0B2545" />,
        count: kpi.inPlay,
        countLabel: "in play",
      },
      {
        step: "FC-06 §04–08",
        title: "Channels & OOC",
        description:
          "Green auto-cleared, Yellow document scrutiny with the query loop, Red physical examination — then out-of-charge verified field-by-field against the SD.",
        href: "/customs/channels",
        icon: <GitBranch size={20} color="#0B2545" />,
        count: kpi.channelWorkOpen,
        countLabel: "awaiting treatment",
      },
      {
        step: "FC-06 §04–08 · detail",
        title: "Channel Detail",
        description:
          "The officer's working surface — record the yellow-channel document review, or schedule and result the red-channel examination.",
        href: workbenchHref,
        icon: <FileCheck2 size={20} color="#0B2545" />,
        count: kpi.yellowQueriesOpen,
        countLabel: "open queries",
      },
      {
        step: "FC-06 §08a-K",
        title: "OOC Capture",
        description:
          "Key an out-of-charge off the print when the gateway is down — reference, duties, taxes, ANF / ASF clearances and the OOC PDF.",
        href: "/customs/ooc-capture",
        icon: <ShieldCheck size={20} color="#0B2545" />,
        count: kpi.oocPending,
        countLabel: "awaiting a verified OOC",
      },
      {
        step: "FC-06 §05-R1",
        title: "Detained Cargo",
        description:
          "The Detend register. A detained portion becomes its own identity — separately stored, charged, released and delivered from the rest of the AWB.",
        href: "/customs/detained",
        icon: <ShieldAlert size={20} color="#0B2545" />,
        count: liveDetends.length,
        countLabel: "live detentions",
      },
    ],
    [clearances, kpi, liveDetends, workbenchHref],
  );

  const tiles = [
    { label: "Green channel cleared", value: kpi.greenCleared, sub: "OOC verified vs SD" },
    { label: "Yellow queries open", value: kpi.yellowQueriesOpen, sub: "awaiting CHA documents" },
    { label: "Red exams scheduled", value: kpi.redExamsOpen, sub: "not yet signed off" },
    { label: "OOC pending", value: kpi.oocPending, sub: "no verified out-of-charge" },
    { label: "Active holds", value: kpi.activeHolds, sub: "all types" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Customs" }, { label: "Overview" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M09
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-06 · area index
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Customs Clearance
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Filing through gateway, risk channel and out-of-charge to release — and what customs
            held back.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      {/* KPI strip — five tiles, every value derived from lib/domain */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 shadow-sm"
          >
            <div className="text-[11px] font-bold uppercase tracking-[1px] text-[#64748B] mb-1">
              {t.label}
            </div>
            <div className="text-[24px] font-bold text-[#0F172A] leading-none">{t.value}</div>
            <div className="text-[11px] text-[#94A3B8] mt-1">{t.sub}</div>
          </div>
        ))}
      </div>

      {/* Customs SLA Watch */}
      <div className="rounded-[16px] border border-[#FDE68A] bg-[#FFFBEB] p-5">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center flex-shrink-0 border border-[#FDE68A]">
            <ClipboardList size={18} color="#D97706" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <h2 className="text-[14px] font-bold text-[#0F172A]">Customs SLA Watch</h2>
              <span className="text-[11px] font-semibold text-[#92400E]">
                Owner: {SLA_OWNER}
              </span>
            </div>
            <p className="text-[12.5px] text-[#92400E] leading-relaxed mt-1">
              <strong>{approaching.length}</strong>{" "}
              {approaching.length === 1 ? "declaration is" : "declarations are"} within{" "}
              {SLA_WINDOW_HOURS} hours of free-period expiry, and{" "}
              <strong>{pastExpiry.length}</strong>{" "}
              {pastExpiry.length === 1 ? "is" : "are"} already past it and accruing demurrage.
              Free period runs from cargo intake for the cargo class&rsquo;s free days (FC-07
              §02–03), so the clock below is the same one the charge calculator prices from.
            </p>
            <p className="text-[12px] text-[#B45309] mt-1.5">
              Drill: Customs Queue → filter Channel: Yellow → sort by free-period expiry.
            </p>
          </div>
        </div>

        {watchRows.length === 0 ? (
          <EmptyState
            title="No declarations in play"
            description={`Nothing is on the customs clock for ${isHq ? "any site" : scope}. Declarations appear here from the moment they are filed until release.`}
          />
        ) : (
          <div className="mt-4 rounded-[12px] border border-[#FDE68A] bg-white overflow-x-auto">
            <table className="w-full min-w-[720px] text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0]">
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    AWB
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    Channel
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    Consignee
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    Free period
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    Expires
                  </th>
                  <th className="text-[10px] font-bold uppercase tracking-[1px] text-[#64748B] px-4 py-2.5">
                    Remaining
                  </th>
                </tr>
              </thead>
              <tbody>
                {watchRows.map((r) => {
                  const channel = r.channel;
                  const breached = r.hoursToExpiry <= 0;
                  return (
                    <tr key={r.awbId} className="border-b border-[#F1F5F9] last:border-b-0">
                      <td className="px-4 py-2.5">
                        <AwbLink awbNo={r.awbNo} awbId={r.awbId} tab="charges" />
                      </td>
                      <td className="px-4 py-2.5">
                        {channel ? (
                          <span
                            className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                            style={{
                              backgroundColor: CHANNEL_TONE[channel].bg,
                              color: CHANNEL_TONE[channel].fg,
                            }}
                          >
                            {RISK_CHANNEL_LABEL[channel]}
                          </span>
                        ) : (
                          <span className="text-[12px] text-[#94A3B8]">Not assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-[12.5px] text-[#0F172A]">{r.consignee}</td>
                      <td className="px-4 py-2.5 text-[12px] text-[#64748B]">
                        {r.freeDays} {r.freeDays === 1 ? "day" : "days"} · {r.cargoClassName}
                      </td>
                      <td className="px-4 py-2.5 text-[12px] text-[#64748B] font-mono">
                        {formatDateTime(r.expiresAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: breached ? "#DC2626" : "#D97706" }}
                        >
                          {expiryLabel(r.hoursToExpiry)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Link
          href="/customs/queue"
          className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#B45309] hover:text-[#92400E] no-underline mt-3"
        >
          Open the customs queue <ArrowUpRight size={14} />
        </Link>
      </div>

      {/* Entry cards — FC-06 flow order */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <h2 className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#1B4F8B]">
            Screens
          </h2>
          <div className="flex-1 h-px bg-[#E2E8F0]" />
        </div>
        <p className="text-[12px] text-[#64748B] mb-4">
          Ordered as FC-06 runs, not alphabetically — a declaration is filed (§03) and only then
          transmitted to the gateway (§03a).
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {cards.map((c) => (
            <Link key={c.href} href={c.href} className="no-underline">
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer h-full flex flex-col">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-9 h-9 rounded-lg bg-[#F1F5F9] flex items-center justify-center">
                    {c.icon}
                  </div>
                  <div className="text-right">
                    <div className="text-[22px] font-bold text-[#0B2545] leading-none">
                      {c.count}
                    </div>
                    <div className="text-[10px] text-[#94A3B8] font-medium mt-0.5">
                      {c.countLabel}
                    </div>
                  </div>
                </div>
                <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono self-start mb-1.5">
                  {c.step}
                </span>
                <h3 className="text-[16px] font-semibold text-[#0F172A] mb-1">{c.title}</h3>
                <p className="text-[12.5px] text-[#64748B] leading-relaxed flex-1">
                  {c.description}
                </p>
                <div className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-[#1B4F8B]">
                  Open <ChevronRight size={14} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
