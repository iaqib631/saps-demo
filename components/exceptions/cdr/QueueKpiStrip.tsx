"use client";

/**
 * P3-1 · CDR queue summary.
 *
 * Six tiles ported from `/warehouse-manager/exceptions-queue`. Two things
 * changed on the way across, both because the legacy tiles were typed rather
 * than measured:
 *
 *   • The trend deltas are computed off `raisedAt` against a stated window,
 *     so they cannot drift away from the rows underneath them.
 *   • The average-age tile carries the six-hour SLA as a target *and* the
 *     count breaching it. A target with no breach count is decoration.
 *
 * Direction matters on a backlog: more open CDRs is worse, so a positive
 * delta is red here and green nowhere.
 */

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";

export interface QueueTile {
  label: string;
  value: string;
  /** Reads under the value — what the number is measured against. */
  subtitle: string;
  /** Already formatted; omit where a delta is not meaningful. */
  trend?: string;
  /** Sign of the underlying delta, so the tone can follow the direction. */
  delta?: number;
  /** Which way is good. Backlogs want "down"; nothing here wants "up". */
  goodDirection?: "down";
  /** Overrides the trend tone — used for the SLA breach count. */
  alert?: boolean;
}

function toneFor(tile: QueueTile): string {
  if (tile.alert) return "#DC2626";
  if (tile.delta === undefined || tile.delta === 0) return "#64748B";
  const worse = tile.goodDirection === "down" ? tile.delta > 0 : tile.delta < 0;
  return worse ? "#DC2626" : "#16A34A";
}

function TrendIcon({ delta }: { delta?: number }) {
  if (delta === undefined || delta === 0) return <ArrowRight size={11} />;
  return delta > 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />;
}

export default function QueueKpiStrip({ tiles }: { tiles: QueueTile[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
            {t.label}
          </p>
          <p className="text-[24px] font-bold text-[#0F172A] mt-1 leading-tight">{t.value}</p>
          <p className="text-[11px] text-[#64748B] mt-1">{t.subtitle}</p>
          {t.trend && (
            <p
              className="text-[11px] font-semibold mt-1.5 inline-flex items-center gap-1"
              style={{ color: toneFor(t) }}
            >
              <TrendIcon delta={t.alert ? 1 : t.delta} />
              {t.trend}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
