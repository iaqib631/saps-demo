"use client";

/**
 * P3-6 · Exception aging dashboard.
 *
 * The FC-10 amendment asks for "an aging dashboard that surfaces the
 * exception queue" across *every* hold state — not just long-stay. That is
 * the gap: CMTS can tell you an AWB is held, but not that it has been held
 * for nineteen days while three other branches also hold cargo that nobody
 * is watching.
 *
 * Six kinds, six different escalation thresholds, one board. The warehouse's
 * own slice of this used to be a separate screen; its queue layer merged into
 * the CDR workbench, and this stays the compliance-side view across all six.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Filter, Timer } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import {
  EXCEPTION_THRESHOLD_DAYS,
  listExceptionQueue,
  storageLocation,
  type ExceptionKind,
} from "@/lib/domain";

const KIND_META: Record<
  ExceptionKind,
  { label: string; tone: string; bg: string; href: string; flow: string }
> = {
  cdr: {
    label: "CDR",
    tone: "#DC2626",
    bg: "#FEE2E2",
    href: "/exceptions/cdr",
    flow: "FC-04",
  },
  hold: {
    label: "Hold",
    tone: "#1B4F8B",
    bg: "#DBEAFE",
    href: "/exceptions/holds",
    flow: "FC-06 / FC-07",
  },
  mishandled: {
    label: "Mishandled",
    tone: "#7C3AED",
    bg: "#F5F3FF",
    href: "/exceptions/mishandled",
    flow: "FC-10-A",
  },
  "re-export": {
    label: "Re-export",
    tone: "#BE185D",
    bg: "#FCE7F3",
    href: "/exceptions/re-export",
    flow: "FC-10-B",
  },
  "long-stay": {
    label: "Long-stay",
    tone: "#D97706",
    bg: "#FEF3C7",
    href: "/exceptions/long-stay",
    flow: "FC-10-C",
  },
  detend: {
    label: "Detained",
    tone: "#0F766E",
    bg: "#CCFBF1",
    // Detained cargo drills into the purpose-built Detend register, not into the
    // general customs work queue. The old target was the legacy compliance queue,
    // which pre-dated /customs/detained and only ever listed the detention as one
    // more row; the register is the screen that models the detention itself.
    href: "/customs/detained",
    flow: "FC-06",
  },
};

const ALL_KINDS = Object.keys(KIND_META) as ExceptionKind[];

export default function ExceptionQueuePage() {
  const { scope, isHq } = useSite();
  const rows = useMemo(() => listExceptionQueue(scope), [scope]);

  const [kinds, setKinds] = useState<Set<ExceptionKind>>(new Set(ALL_KINDS));
  const [overOnly, setOverOnly] = useState(false);

  const visible = rows.filter(
    (r) => kinds.has(r.kind) && (!overOnly || r.overThreshold),
  );

  const toggle = (k: ExceptionKind) => {
    const next = new Set(kinds);
    if (next.has(k)) next.delete(k);
    else next.add(k);
    setKinds(next.size === 0 ? new Set(ALL_KINDS) : next);
  };

  const overThreshold = rows.filter((r) => r.overThreshold);
  const oldest = rows.length ? Math.max(...rows.map((r) => r.ageDays)) : 0;
  const maxAge = Math.max(1, oldest);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Exceptions" }, { label: "Aging Dashboard" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M06 · M16–M18
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-10 amendment
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Exception Aging Dashboard
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Every hold state on one board, each against its own escalation threshold. CMTS can show
            that cargo is held; it cannot show how long, across branches.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Open exceptions", value: String(rows.length), tone: "#0F172A" },
          { label: "Past threshold", value: String(overThreshold.length), tone: "#DC2626" },
          { label: "Oldest", value: oldest ? `${oldest}d` : "—", tone: "#D97706" },
          {
            label: "Branches in play",
            value: String(new Set(rows.map((r) => r.kind)).size),
            tone: "#1B4F8B",
          },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[24px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* Per-kind summary — each with its own threshold */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ALL_KINDS.map((k) => {
          const meta = KIND_META[k];
          const n = rows.filter((r) => r.kind === k).length;
          const over = rows.filter((r) => r.kind === k && r.overThreshold).length;
          const on = kinds.has(k);
          return (
            <button
              key={k}
              onClick={() => toggle(k)}
              className="rounded-[14px] border p-4 text-left transition-all cursor-pointer hover:border-[#94A3B8]"
              style={{
                borderColor: on ? meta.tone : "#E2E8F0",
                backgroundColor: on ? meta.bg : "#FFFFFF",
                opacity: on ? 1 : 0.55,
              }}
            >
              <p
                className="text-[11px] font-bold uppercase tracking-wider"
                style={{ color: on ? meta.tone : "#94A3B8" }}
              >
                {meta.label}
              </p>
              <p className="text-[22px] font-bold mt-0.5" style={{ color: on ? "#0F172A" : "#94A3B8" }}>
                {n}
              </p>
              <p className="text-[10px] text-[#64748B] mt-0.5">
                {over > 0 ? `${over} past ` : ""}
                {EXCEPTION_THRESHOLD_DAYS[k]}d threshold
              </p>
              <p className="text-[9px] font-mono text-[#94A3B8] mt-1">{meta.flow}</p>
            </button>
          );
        })}
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[12px] text-[#64748B]">
          <Filter size={13} />
          Filter by branch above
        </span>
        <button
          onClick={() => setOverOnly(!overOnly)}
          className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer inline-flex items-center gap-1.5"
          style={{
            backgroundColor: overOnly ? "#DC2626" : "#FFFFFF",
            color: overOnly ? "#FFFFFF" : "#475569",
            borderColor: overOnly ? "#DC2626" : "#E2E8F0",
          }}
        >
          <AlertTriangle size={12} />
          Past threshold only
        </button>
        <span className="text-[12px] text-[#94A3B8]">
          {visible.length} of {rows.length} shown
        </span>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          title="No exceptions match"
          description="Nothing on this filter. Every branch feeds this board automatically — a case appears here the moment it opens."
        />
      ) : (
        <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
          <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
            <Timer size={15} className="text-[#64748B]" />
            <h3 className="text-[14px] font-semibold text-[#0F172A]">
              Aging — oldest first
            </h3>
          </div>
          <div className="divide-y divide-[#F1F5F9]">
            {visible.map((r) => {
              const meta = KIND_META[r.kind];
              const pct = Math.min(100, (r.ageDays / maxAge) * 100);
              const thresholdPct = Math.min(100, (r.thresholdDays / maxAge) * 100);
              return (
                <div key={`${r.kind}-${r.ref}`} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span
                        className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                        style={{ backgroundColor: meta.bg, color: meta.tone }}
                      >
                        {meta.label}
                      </span>
                      <AwbLink awbNo={r.AWBNO} awbId={r.awbId} />
                      <span className="font-mono text-[11px] text-[#94A3B8]">{r.ref}</span>
                      {isHq && (
                        <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-semibold inline-flex items-center">
                          {r.site}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-bold"
                        style={{ color: r.overThreshold ? "#DC2626" : "#0F172A" }}
                      >
                        {r.ageDays}d
                      </span>
                      <span className="text-[11px] text-[#94A3B8]">/ {r.thresholdDays}d</span>
                      <Link
                        href={meta.href}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                      >
                        Open <ArrowUpRight size={11} />
                      </Link>
                    </div>
                  </div>

                  <p className="text-[12px] text-[#64748B] mt-1.5">
                    {r.summary}
                    {r.locationId && (
                      <span className="text-[#94A3B8]">
                        {" · "}
                        {storageLocation(r.locationId)?.ABBREVATION ?? "—"}
                      </span>
                    )}
                  </p>

                  {/* Age bar with the threshold marker in place */}
                  <div className="relative h-[8px] rounded-full bg-[#F1F5F9] mt-2.5 overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: r.overThreshold ? "#DC2626" : meta.tone,
                      }}
                    />
                    <div
                      className="absolute inset-y-0 w-px bg-[#0F172A]"
                      style={{ left: `${thresholdPct}%` }}
                      title={`Escalation threshold — ${r.thresholdDays} days`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-[11px] text-[#94A3B8]">
        The vertical marker on each bar is that branch&apos;s escalation threshold. Thresholds differ
        by kind — a CDR is late at {EXCEPTION_THRESHOLD_DAYS.cdr} days, a re-export not until{" "}
        {EXCEPTION_THRESHOLD_DAYS["re-export"]} — so a single &ldquo;days held&rdquo; column would
        rank them wrongly.
      </p>
    </div>
  );
}
