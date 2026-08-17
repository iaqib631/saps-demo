"use client";

/**
 * The table that replaces "Recent Audit Events".
 *
 * The ten rows here were the sharpest single instance of the defect on this
 * portal: real-looking usernames, real-looking entity references and real-
 * looking evidence filenames — `inv_42_detail.pdf`, `rbac_snapshot_08jun.pdf`,
 * `exit_gatepass_1356.png` — every one of which resolves to nothing, under a
 * search box that filtered nothing and a "Viewed" action that no store records.
 *
 * What is drawn instead is every WRITE in the demo that carries both a
 * timestamp and an actor column, from the twelve registers that have them. The
 * Source column is the point: each row prints the fixture field its actor was
 * read from, so any row can be checked. Where a record genuinely has no actor —
 * a notification is dispatched off a trigger, not by a person — the cell says
 * so instead of borrowing a name.
 *
 * Filters are real filters over those rows. So is the search box.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { History, Search } from "lucide-react";
import DataTable from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { HqCard } from "@/components/hq/HqUi";
import { DEMO_NOW, formatDateTime } from "@/lib/domain";
import {
  TRAIL_MODULES,
  TRAIL_REGISTERS,
  recordTrail,
  trailSpan,
  type TrailModule,
} from "../auditorMetrics";

export default function RecordTrail() {
  const rows = useMemo(() => recordTrail(), []);
  const span = useMemo(() => trailSpan(rows), [rows]);

  const [module, setModule] = useState<TrailModule | "All">("All");
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (module !== "All" && r.module !== module) return false;
      if (!needle) return true;
      return (
        (r.actor ?? "").toLowerCase().includes(needle) ||
        r.entity.toLowerCase().includes(needle) ||
        r.action.toLowerCase().includes(needle) ||
        r.site.toLowerCase().includes(needle)
      );
    });
  }, [rows, module, q]);

  return (
    <HqCard
      title="Record trail — every dated write, estate-wide"
      icon={History}
      source="recordTrail() · components/auditor/auditorMetrics.ts"
      intro={`${span.rows.toLocaleString("en-PK")} records across the ${TRAIL_REGISTERS.length} registers that carry both a timestamp and an actor, spanning ${span.oldestDaysAgo} days back from ${formatDateTime(DEMO_NOW)}. This is not an audit log — no store records who read or exported anything — so the trail holds writes only, and says so rather than implying coverage it does not have.`}
    >
      {span.futureDated > 0 && (
        <div className="mb-4 rounded-[12px] border border-[#FDE68A] bg-[#FFFBEB] px-4 py-3">
          <p className="text-[12px] font-semibold text-[#B45309]">
            {span.futureDated} {span.futureDated === 1 ? "record is" : "records are"} dated after{" "}
            {formatDateTime(DEMO_NOW)}
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-[#92400E]">
            Out-of-charge verification stamps in the customs register run past the demo instant.
            They are shown where their timestamps put them rather than clipped to now,
            because a trail that quietly drops the rows that do not fit is the same failure as one
            that invents rows that do. Sorting by time is what surfaced it.
          </p>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap overflow-hidden rounded-lg border border-[#E2E8F0]">
          {(["All", ...TRAIL_MODULES] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => setModule(opt)}
              className="h-8 cursor-pointer whitespace-nowrap px-3 text-[12px] font-medium transition-colors"
              style={{
                backgroundColor: module === opt ? "#0B2545" : "white",
                color: module === opt ? "white" : "#64748B",
              }}
            >
              {opt}
              <span className="ml-1.5 text-[10px] opacity-70">
                {opt === "All" ? rows.length : rows.filter((r) => r.module === opt).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Actor, entity, action, node…"
            className="h-8 w-[220px] rounded-lg border border-[#E2E8F0] bg-white pl-9 pr-3 text-[12px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2E75B6]"
          />
        </div>
        <span className="text-[11px] text-[#64748B]">
          {filtered.length.toLocaleString("en-PK")} of {rows.length.toLocaleString("en-PK")} records
        </span>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No records match"
          description="Every record in this trail comes from a register with a timestamp and an actor column. Clear the filter to see all of them."
        />
      ) : (
        <DataTable
          /* DataTable holds its own page index; re-keying on the filter resets
             it, so narrowing a few hundred rows down to eight cannot land the
             reader on an empty page five. */
          key={`${module}-${q}`}
          columns={[
            { key: "at", header: "When", width: "150px" },
            { key: "actor", header: "Actor", width: "150px" },
            { key: "module", header: "Register", width: "130px" },
            { key: "entity", header: "Entity", width: "160px" },
            { key: "action", header: "What was written", width: "260px" },
            { key: "site", header: "Node", width: "70px" },
            { key: "source", header: "Source", width: "300px" },
          ]}
          rows={filtered.map((r) => ({
            at: (
              <span className="font-mono text-[12px] text-[#0F172A]">{formatDateTime(r.at)}</span>
            ),
            actor: r.actor ? (
              <span className="text-[12px] font-medium text-[#0F172A]">{r.actor}</span>
            ) : (
              <span className="text-[11px] italic text-[#94A3B8]">{r.actorField}</span>
            ),
            module: <span className="text-[12px] text-[#334155]">{r.module}</span>,
            entity: r.entityHref ? (
              <Link
                href={r.entityHref}
                className="text-[12px] font-medium text-[#1B4F8B] no-underline hover:underline"
              >
                {r.entity}
              </Link>
            ) : (
              <span className="text-[12px] font-medium text-[#0F172A]">{r.entity}</span>
            ),
            action: (
              <span className="text-[12px] text-[#334155]">
                {r.action}
                {r.documentId && (
                  <span className="ml-1.5 inline-flex h-[18px] items-center rounded bg-[#DBEAFE] px-1.5 font-mono text-[10px] font-bold text-[#1B4F8B]">
                    {r.documentId}
                  </span>
                )}
              </span>
            ),
            site: (
              <span className="inline-flex h-6 items-center rounded-full bg-[#F1F5F9] px-2 text-[11px] font-semibold text-[#334155]">
                {r.site}
              </span>
            ),
            source: <span className="font-mono text-[10px] text-[#94A3B8]">{r.source}</span>,
          }))}
          headerStyle="navy"
        />
      )}
    </HqCard>
  );
}
