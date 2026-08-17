"use client";

/**
 * One key-prefix group, rendered as a card.
 *
 * Grouping exists so a few hundred rows stay navigable, and the prefix shown
 * in the header was learned from the key set (`detectSeparator` + `groupKey`),
 * not read off a list of known prefixes. The header states the separator that
 * produced it so the reader can see the grouping is derived.
 */

import { FlaskConical, Database, HelpCircle } from "lucide-react";
import { formatDate } from "@/lib/domain/common";
import {
  SHAPE_LABEL,
  UNGROUPED,
  inferEditor,
  type SettingGroup,
  type SettingRow,
} from "@/lib/domain/settings";
import ValueControl from "./ValueControl";

const SHAPE_TONE: Record<string, { bg: string; text: string }> = {
  Boolean: { bg: "#EDE9FE", text: "#7C3AED" },
  Number: { bg: "#DBEAFE", text: "#1B4F8B" },
  Date: { bg: "#DCFCE7", text: "#16A34A" },
  Enum: { bg: "#FEF3C7", text: "#D97706" },
  Text: { bg: "#F1F5F9", text: "#64748B" },
};

export default function RegistryGroup({
  group,
  allRows,
  separator,
  onCommit,
}: {
  group: SettingGroup;
  /** The WHOLE store, not the group — enum vocabulary is observed store-wide. */
  allRows: SettingRow[];
  separator: string;
  onCommit: (key: string, value: string) => void;
}) {
  /* The header shows THIS group's own separator, not the store's consensus
     one. After an import the two diverge — a `GR_*` group grouped on `_` sits
     beside dotted groups — and printing the consensus character on both would
     misdescribe half the screen. */
  const shown = group.rows[0]?.key.charAt(group.prefix.length) || separator;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-b border-[#E2E8F0] bg-[#F8FAFC] flex-wrap">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-[13px] font-bold text-[#0B2545] truncate">
            {group.prefix}
            {group.prefix !== UNGROUPED && <span className="text-[#CBD5E1]">{shown}*</span>}
          </span>
          <span className="text-[11px] font-semibold text-[#64748B]">
            {group.rows.length} {group.rows.length === 1 ? "key" : "keys"}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {group.seeded > 0 && <OriginBadge origin="demo-seeded" count={group.seeded} />}
          {group.migrated > 0 && <OriginBadge origin="migrated" count={group.migrated} />}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[880px]">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              {["Key", "Value", "Inferred shape", "Source", "Provenance", "Updated"].map((h) => (
                <th
                  key={h}
                  className="text-left text-[10px] font-bold uppercase tracking-wider text-[#64748B] px-4 py-2.5 whitespace-nowrap"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group.rows.map((row, idx) => {
              const editor = inferEditor(row, allRows);
              const tone = SHAPE_TONE[SHAPE_LABEL[editor.shape]];
              return (
                <tr
                  key={row.key}
                  className="border-b border-[#E2E8F0] last:border-b-0 align-top"
                  style={{ backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "white" }}
                >
                  <td className="px-4 py-3 max-w-[300px]">
                    <div className="font-mono text-[12px] font-semibold text-[#0F172A] break-all">
                      {row.key}
                    </div>
                    {row.note && (
                      <div className="text-[11px] text-[#94A3B8] mt-1 leading-[15px]">{row.note}</div>
                    )}
                  </td>

                  <td className="px-4 py-3">
                    <ValueControl
                      row={row}
                      editor={editor}
                      onCommit={(next) => onCommit(row.key, next)}
                    />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <span
                      className="inline-flex items-center gap-1 h-6 px-2.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: tone.bg, color: tone.text }}
                      title={editor.reason}
                    >
                      {SHAPE_LABEL[editor.shape]}
                      <HelpCircle size={11} />
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {/* CMTS parity marker. Names the legacy TABLE, not a column —
                        the column names of Lookup/Setting are not in the restored
                        schema, only their counts. See SETTING_PARITY_NOTE. */}
                    <span
                      className="text-[10px] font-mono text-[#94A3B8]"
                      title={`CMTS table: ${row.table} — column mapping not recovered`}
                    >
                      {row.table}
                    </span>
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <OriginBadge origin={row.origin} />
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    <div className="text-[12px] text-[#64748B]">{formatDate(row.updatedAt)}</div>
                    <div className="text-[11px] text-[#94A3B8]">{row.updatedBy}</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * The demo-seeded / migrated distinction, on every row.
 *
 * Deliberately not a subtle tint. A seeded value is AirVault's own number
 * lifted out of this repo's constants; reading one as SAPS configuration is
 * the failure this badge exists to prevent, and a totals line at the top of
 * the page cannot prevent it once somebody screenshots a single row.
 */
export function OriginBadge({
  origin,
  count,
}: {
  origin: SettingRow["origin"];
  count?: number;
}) {
  const seeded = origin === "demo-seeded";
  return (
    <span
      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
      style={{
        backgroundColor: seeded ? "#FEF3C7" : "#DBEAFE",
        color: seeded ? "#B45309" : "#1B4F8B",
      }}
      title={
        seeded
          ? "Demo-seeded — lifted from a constant this prototype hard-codes. NOT SAPS configuration."
          : "Migrated — arrived from a CMTS extract."
      }
    >
      {seeded ? <FlaskConical size={11} /> : <Database size={11} />}
      {count !== undefined ? `${count} ` : ""}
      {seeded ? "Demo-seeded" : "Migrated"}
    </span>
  );
}
