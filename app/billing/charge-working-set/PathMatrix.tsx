"use client";

/**
 * The three paths, side by side.
 *
 * This is the argument for Q8's decision rendered as a table. Three CMTS tables
 * record how a charge was computed; they do not record the same things, and the
 * differences are not cosmetic — each one is a question an operator can ask on
 * one path and cannot ask on another.
 *
 * It renders on both new tabs rather than once at the bottom of the screen,
 * because the comparison is only useful next to the table it is comparing. The
 * standard tab does not carry it: `grCharges` already has its own audit §3
 * disagreement register, and stacking a second matrix under it would bury the
 * one that prices the run in front of the reader.
 */

import { Columns3 } from "lucide-react";
import { PATH_CAPABILITIES } from "@/lib/domain/importcalc";
import { Card, Th, SUPPORT_TONE } from "./ui";

export default function PathMatrix({ highlight }: { highlight: "temp" | "freehand" }) {
  return (
    <Card
      icon={<Columns3 size={15} />}
      title="What each path can record — and therefore what it can explain"
      subtitle="Three tables, one question. The columns a table does not have are the questions its path cannot answer, and they are different questions on each path."
      footer={
        <p className="text-[11px] text-[#64748B] leading-snug">
          Read down the <strong>consequence</strong> column rather than across the ticks. A missing
          column is not a gap to be filled — it is a statement about what the legacy system
          considered worth recording on that path, and every one of them survives migration unless
          somebody decides otherwise.
        </p>
      }
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <Th>Can the row…</Th>
              <Th>Columns</Th>
              <Th>grCharges</Th>
              <Th>TempImportCalculation</Th>
              <Th>ImportFreeHandedCalc</Th>
              <Th>What follows</Th>
            </tr>
          </thead>
          <tbody>
            {PATH_CAPABILITIES.map((c) => {
              const cells = [
                { key: "gr", support: c.grCharges, on: false },
                { key: "temp", support: c.tempImport, on: highlight === "temp" },
                { key: "fh", support: c.freeHand, on: highlight === "freehand" },
              ];
              return (
                <tr key={c.capability} className="border-b border-[#F1F5F9] last:border-0 align-top">
                  <td className="px-3 py-3 min-w-[170px]">
                    <p className="text-[12px] font-medium text-[#0F172A] leading-snug">
                      {c.capability}
                    </p>
                  </td>
                  <td className="px-3 py-3 font-mono text-[10px] text-[#94A3B8] leading-snug min-w-[150px]">
                    {c.columns}
                  </td>
                  {cells.map((cell) => {
                    const tone = SUPPORT_TONE[cell.support];
                    return (
                      <td
                        key={cell.key}
                        className="px-3 py-3 whitespace-nowrap"
                        style={{ backgroundColor: cell.on ? "#F8FAFC" : undefined }}
                      >
                        <span
                          className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center font-mono"
                          style={{ backgroundColor: tone.bg, color: tone.fg }}
                        >
                          {tone.label}
                        </span>
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-[11.5px] text-[#334155] leading-snug min-w-[280px]">
                    {c.consequence}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
