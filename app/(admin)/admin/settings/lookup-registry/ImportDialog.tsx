"use client";

/**
 * Import.
 *
 * The behaviour that matters here is what happens to a key nobody has ever
 * seen: it is ADDED. Decision Q6 turns on that single edge — an editor that
 * rejects unknown keys has assumed a key set, and the whole reason this screen
 * exists is that the key set is not knowable. So the preview counts unknown
 * keys as additions, and the only thing that can be refused is a LINE that
 * does not split into a pair at all, which is reported with its reason and
 * does not fail the rest of the import.
 */

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, FileDown, Plus, RefreshCw, SkipForward } from "lucide-react";
import Modal from "@/components/Modal";
import {
  SAMPLE_CMTS_EXTRACT,
  parseSettingImport,
  planImport,
  type ImportAction,
  type ImportPlan,
  type SettingRow,
} from "@/lib/domain/settings";
import { ValuePreview } from "./ValueControl";

const ACTION_TONE: Record<ImportAction, { bg: string; text: string; label: string }> = {
  add: { bg: "#DCFCE7", text: "#16A34A", label: "New key — added" },
  update: { bg: "#FEF3C7", text: "#B45309", label: "Existing key — value replaced" },
  unchanged: { bg: "#F1F5F9", text: "#64748B", label: "Already matches — untouched" },
};

export default function ImportDialog({
  isOpen,
  onClose,
  store,
  onApply,
}: {
  isOpen: boolean;
  onClose: () => void;
  store: SettingRow[];
  onApply: (plan: ImportPlan) => void;
}) {
  const [text, setText] = useState("");

  const plan = useMemo<ImportPlan>(
    () => planImport(store, parseSettingImport(text)),
    [store, text],
  );

  const hasWork = plan.added + plan.updated > 0;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Import Lookup / Setting rows"
      maxWidth={820}
      footer={
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[11px] text-[#94A3B8] max-w-[420px]">
            Unknown keys are added, not rejected. Anything imported is marked{" "}
            <strong className="text-[#1B4F8B]">Migrated</strong> so it can never be confused with the
            demo seed.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="h-9 px-4 rounded-xl text-[13px] font-semibold text-[#64748B] border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
            >
              Cancel
            </button>
            <button
              onClick={() => onApply(plan)}
              disabled={!hasWork}
              className="h-9 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
              style={{ backgroundColor: "#0B2545" }}
            >
              Apply {plan.added + plan.updated} change
              {plan.added + plan.updated === 1 ? "" : "s"}
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-[12px] text-[#64748B] max-w-[460px]">
            Paste rows as <code className="font-mono text-[#0F172A]">key=value</code>. Colon, tab and
            comma also separate a pair; <code className="font-mono text-[#0F172A]">#</code> starts a
            comment.
          </p>
          <button
            onClick={() => setText(SAMPLE_CMTS_EXTRACT)}
            className="flex items-center gap-1.5 h-9 px-3 rounded-xl border border-[#E2E8F0] text-[12px] font-semibold text-[#1B4F8B] bg-white hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
          >
            <FileDown size={14} /> Load illustrative extract
          </button>
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={9}
          spellCheck={false}
          placeholder={"GR_FREE_DAYS=3\nSEC82_NOTICE_DAYS=21\nbilling.tax.default_percent=16"}
          className="w-full rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-3 font-mono text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors resize-y"
        />

        {text.trim() !== "" && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <Tally label="Added" value={plan.added} icon={<Plus size={13} />} tone="#16A34A" bg="#DCFCE7" />
              <Tally label="Updated" value={plan.updated} icon={<RefreshCw size={13} />} tone="#B45309" bg="#FEF3C7" />
              <Tally label="Unchanged" value={plan.unchanged} icon={<ArrowRight size={13} />} tone="#64748B" bg="#F1F5F9" />
              <Tally
                label="Skipped lines"
                value={plan.skipped.length}
                icon={<SkipForward size={13} />}
                tone="#DC2626"
                bg="#FEE2E2"
              />
            </div>

            {plan.rows.length > 0 && (
              <div className="rounded-xl border border-[#E2E8F0] overflow-hidden">
                <div className="overflow-x-auto max-h-[280px] overflow-y-auto">
                  <table className="w-full min-w-[560px]">
                    <thead className="sticky top-0">
                      <tr style={{ backgroundColor: "#0B2545" }}>
                        {["Key", "Current", "Incoming", "Outcome"].map((h) => (
                          <th
                            key={h}
                            className="text-left text-[10px] font-bold uppercase tracking-wider text-white px-3 py-2.5 whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {plan.rows.map((r, idx) => {
                        const tone = ACTION_TONE[r.action];
                        return (
                          <tr
                            key={r.key}
                            className="border-b border-[#E2E8F0] last:border-b-0"
                            style={{ backgroundColor: idx % 2 === 1 ? "#F8FAFC" : "white" }}
                          >
                            <td className="px-3 py-2 font-mono text-[11px] font-semibold text-[#0F172A] break-all max-w-[220px]">
                              {r.key}
                            </td>
                            <td className="px-3 py-2">
                              {r.existing ? (
                                <ValuePreview value={r.existing.value} />
                              ) : (
                                <span className="text-[12px] text-[#CBD5E1]">— not present</span>
                              )}
                            </td>
                            <td className="px-3 py-2">
                              <ValuePreview value={r.incoming} />
                            </td>
                            <td className="px-3 py-2 whitespace-nowrap">
                              <span
                                className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold"
                                style={{ backgroundColor: tone.bg, color: tone.text }}
                              >
                                {tone.label}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {plan.skipped.length > 0 && (
              <div className="rounded-xl border border-[#FDE68A] bg-[#FFFBEB] p-4">
                <p className="text-[12px] font-bold text-[#B45309] flex items-center gap-1.5 mb-2">
                  <AlertTriangle size={13} /> {plan.skipped.length} line
                  {plan.skipped.length === 1 ? "" : "s"} skipped — the import still applies
                </p>
                <ul className="flex flex-col gap-1.5">
                  {plan.skipped.map((s) => (
                    <li key={s.line} className="text-[11px] text-[#92400E]">
                      <span className="font-mono font-semibold">line {s.line}</span>{" "}
                      <span className="font-mono text-[#B45309]">{s.raw}</span> — {s.problem}
                    </li>
                  ))}
                </ul>
                <p className="text-[11px] text-[#92400E] mt-2 italic">
                  Only malformed lines land here. An unrecognised key is never a skip.
                </p>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  );
}

function Tally({
  label,
  value,
  icon,
  tone,
  bg,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  tone: string;
  bg: string;
}) {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white px-3 py-2.5">
      <div className="flex items-center gap-1.5 mb-1">
        <span
          className="w-5 h-5 rounded-md flex items-center justify-center"
          style={{ backgroundColor: bg, color: tone }}
        >
          {icon}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">{label}</span>
      </div>
      <span className="text-[20px] font-bold" style={{ color: tone }}>
        {value}
      </span>
    </div>
  );
}
