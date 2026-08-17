"use client";

/**
 * T3 · Statutory & escalation breach board.
 *
 * `listExceptionQueue("HQ")` is the unified FC-10 aging queue across all six
 * exception kinds, and every row already carries its own `href`, so
 * drill-through costs nothing to wire. Filtered to `overThreshold` and sorted
 * by how far PAST its own threshold each row is — the ordering matters, because
 * a CDR three days over a three-day threshold and a Section 82 case seventeen
 * days past a statutory deadline are not the same urgency and an age-sorted
 * list would rank them by the wrong number.
 *
 * WHY IT BELONGS AT HQ RATHER THAN ON /exceptions/queue, which already exists:
 * that screen answers "what is breaching HERE" and is exactly right for a shed
 * supervisor. This one answers "which node is carrying the breaches", which is
 * a resourcing question, and the answer today is lopsided — the estate's
 * breaches are not evenly spread. A per-site screen cannot see a distribution.
 */

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import AwbLink from "@/components/awb/AwbLink";
import { HqCard, SeverityPill } from "@/components/hq/HqUi";
import { SITES, listExceptionQueue, type ExceptionKind } from "@/lib/domain";

const KIND_LABEL: Record<ExceptionKind, string> = {
  cdr: "CDR",
  hold: "Hold",
  mishandled: "Mishandled",
  "re-export": "Re-export",
  "long-stay": "Long-stay",
  detend: "Detained",
};

export default function BreachBoard() {
  const all = listExceptionQueue("HQ");
  const breached = all
    .filter((r) => r.overThreshold)
    .map((r) => ({ ...r, past: r.ageDays - r.thresholdDays }))
    .sort((a, b) => b.past - a.past);

  const bySite = SITES.map((s) => ({
    site: s.code,
    open: all.filter((r) => r.site === s.code).length,
    breached: breached.filter((r) => r.site === s.code).length,
  }));

  return (
    <HqCard
      title="Breach board — past threshold, estate-wide"
      icon={AlertTriangle}
      source="listExceptionQueue('HQ') filtered on overThreshold · EXCEPTION_THRESHOLD_DAYS · lib/domain/exceptions.ts"
      intro="Each exception kind is measured against its own escalation threshold, and long-stay's is statutory. Ranked by days past that threshold, not by age."
      action={{ label: "Aging dashboard", href: "/exceptions/queue" }}
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {bySite.map((s) => (
          <div
            key={s.site}
            className="flex items-center gap-2 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2"
          >
            <span className="text-[12px] font-bold text-[#0F172A]">{s.site}</span>
            <span className="text-[11px] text-[#64748B]">
              {s.breached} of {s.open} breaching
            </span>
            <SeverityPill
              severity={s.breached === 0 ? "good" : s.breached >= 5 ? "serious" : "warning"}
              label={s.breached === 0 ? "Clear" : "Breaching"}
            />
          </div>
        ))}
      </div>

      {breached.length === 0 ? (
        <p className="text-[12px] text-[#64748B]">
          Nothing on the estate is past its escalation threshold.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {["Ref", "Kind", "Node", "AWB", "Age", "Threshold", "Past by", ""].map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {breached.map((r) => (
                <tr key={`${r.kind}-${r.ref}`} className="border-b border-[#F1F5F9] last:border-b-0">
                  <td className="px-2 py-2.5 font-mono text-[11px] text-[#475569]">{r.ref}</td>
                  <td className="px-2 py-2.5 text-[12px] font-semibold text-[#0F172A]">
                    {KIND_LABEL[r.kind]}
                  </td>
                  <td className="px-2 py-2.5 text-[12px] font-bold text-[#0F172A]">{r.site}</td>
                  <td className="px-2 py-2.5">
                    <AwbLink awbNo={r.AWBNO} awbId={r.awbId} />
                  </td>
                  <td className="px-2 py-2.5 text-[12px] tabular-nums text-[#475569]">
                    {r.ageDays}d
                  </td>
                  <td className="px-2 py-2.5 text-[12px] tabular-nums text-[#94A3B8]">
                    {r.thresholdDays}d
                  </td>
                  <td className="px-2 py-2.5">
                    <SeverityPill
                      severity={r.kind === "long-stay" ? "critical" : r.past >= 5 ? "serious" : "warning"}
                      label={
                        r.kind === "long-stay"
                          ? `${r.past}d past statutory deadline`
                          : `${r.past}d over`
                      }
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <Link
                      href={r.href}
                      className="text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </HqCard>
  );
}
