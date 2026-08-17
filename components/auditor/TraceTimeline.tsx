"use client";

/**
 * The timeline both traces draw — FC-12 §16 and §17.
 *
 * One component rather than two near-identical blocks, because the two screens
 * previously each carried their own copy and each copy invented its own step
 * names. The node colour comes from the event's own severity (a failed message,
 * an unreconciled payment, an OOC field mismatch), never from its position in
 * the list — the old cargo timeline coloured its first twelve nodes blue, the
 * next four amber and the rest green purely by index, which reads as a status
 * and encodes nothing.
 *
 * Three columns of provenance on every node, and all three are the point:
 *   · the ACTOR, or the reason there is none — never a plausible name
 *   · the SOURCE, the fixture path the event was read from, verbatim
 *   · the DOCUMENT id, where the event actually produced a document row
 */

import Link from "next/link";
import { ArrowUpRight, Clock } from "lucide-react";
import { severityTone } from "@/components/hq/HqUi";
import { formatDateTime } from "@/lib/domain";
import type { TraceEvent } from "./traceModel";

export default function TraceTimeline({ events }: { events: TraceEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="text-[12px] text-[#64748B]">
        No dated record references this entity. That is a fact about the registers, not a load
        failure.
      </p>
    );
  }

  return (
    <div className="relative pl-8">
      <div className="absolute bottom-0 left-[15px] top-0 w-[2px] bg-[#E2E8F0]" />

      {events.map((e) => {
        const tone = severityTone(e.severity);
        return (
          <div key={e.key} className="relative pb-5 last:pb-0">
            <div
              className="absolute left-[-1.65rem] top-1 z-10 h-[14px] w-[14px] rounded-full border-2 border-white ring-2"
              style={
                {
                  backgroundColor: tone.fg,
                  "--tw-ring-color": tone.fg,
                } as React.CSSProperties
              }
            />
            <div className="ml-2 rounded-lg border border-[#E2E8F0] bg-white p-4">
              <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <span className="text-[14px] font-bold text-[#0F172A]">{e.label}</span>
                  {e.actor ? (
                    <span className="ml-2 text-[12px] text-[#64748B]">by {e.actor}</span>
                  ) : (
                    <span className="ml-2 text-[11px] italic text-[#94A3B8]">{e.actorField}</span>
                  )}
                </div>
                <div className="flex items-center gap-1 whitespace-nowrap text-[11px] text-[#94A3B8]">
                  <Clock size={12} />
                  {formatDateTime(e.at)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
                <span>
                  <span className="text-[#94A3B8]">Lane: </span>
                  <span className="font-medium text-[#334155]">{e.lane}</span>
                </span>
                {e.actor && (
                  <span>
                    <span className="text-[#94A3B8]">Actor field: </span>
                    <span className="font-mono text-[11px] text-[#334155]">{e.actorField}</span>
                  </span>
                )}
                {e.documentId ? (
                  <span className="inline-flex h-[20px] items-center rounded bg-[#DBEAFE] px-1.5 font-mono text-[10px] font-bold text-[#1B4F8B]">
                    {e.documentId}
                  </span>
                ) : (
                  <span className="text-[11px] text-[#CBD5E1]">no document row</span>
                )}
                {e.href && (
                  <Link
                    href={e.href}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1B4F8B] no-underline hover:underline"
                  >
                    Open <ArrowUpRight size={11} />
                  </Link>
                )}
              </div>

              {e.detail && (
                <p className="mt-2 text-[12px] leading-relaxed text-[#475569]">{e.detail}</p>
              )}
              <p className="mt-1.5 font-mono text-[10px] leading-snug text-[#94A3B8]">{e.source}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
