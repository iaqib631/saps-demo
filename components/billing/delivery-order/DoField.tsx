"use client";

/**
 * P5-7 · The delivery-order screen's CMTS field marker.
 *
 * Factored out of the authorised-agent grid it was first written inline in, so
 * that every column added to this screen carries the same marker instead of a
 * fourth hand-rolled variant of the same two spans drifting a pixel off the
 * ones beside it.
 *
 * Deliberately NOT the boxed `Field` the AWB tabs export, even though that one
 * takes the same `cmts` prop. A DO is read at a collection counter in a single
 * glance and the boxed input treatment roughly doubles the height of every
 * value; this screen chose the dense mono-column-over-value form for that
 * reason and the new parity fields have to read like the ones already on it.
 *
 * Empty renders as the literal word `null`, not an em-dash, matching the
 * authorised-agent grid. On this record that is the right word: an empty
 * `DUPLICATEREASON` is a fact about the delivery order — no reissue was
 * raised — whereas an em-dash reads as "we did not fetch it", which is the one
 * reading that would send an operator hunting for a value that does not exist.
 */

import type { ReactNode } from "react";

export default function DoField({
  cmts,
  value,
  tone = "default",
}: {
  /**
   * The CMTS column, rendered verbatim. This is the parity marker — the
   * migration check reads these off the screen, so the spelling here follows
   * CMTS_MIGRATION_GAP_REPORT.md and is never "corrected".
   */
  cmts: string;
  value: ReactNode;
  tone?: "default" | "muted" | "warn" | "ok";
}) {
  const empty = value === null || value === undefined || value === "";
  const colour = empty
    ? "#CBD5E1"
    : tone === "muted"
      ? "#94A3B8"
      : tone === "warn"
        ? "#D97706"
        : tone === "ok"
          ? "#16A34A"
          : "#0F172A";

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[9px] font-mono text-[#CBD5E1]" title={`CMTS column: ${cmts}`}>
        {cmts}
      </span>
      <span className="text-[13px] font-medium break-words" style={{ color: colour }}>
        {empty ? "null" : value}
      </span>
    </div>
  );
}
