"use client";

/**
 * The editor for ONE key/value row.
 *
 * The control rendered here is chosen by `inferEditor` from the VALUE, never
 * from the key. That is the point of decision Q6, so the reason travels onto
 * the screen too: the shape chip beside the control is titled with the
 * sentence the inference produced. If a reader can see that a value made this
 * a checkbox, nobody concludes there is a hard-coded list of boolean keys
 * somewhere behind it.
 */

import { useEffect, useState } from "react";
import { AlertTriangle, Check, Pencil, X } from "lucide-react";
import {
  booleanTokens,
  isoDatePrecision,
  parseBoolean,
  validateValue,
  type EditorSpec,
  type SettingRow,
} from "@/lib/domain/settings";

const inputBase =
  "h-9 px-3 rounded-lg border bg-white text-[13px] text-[#0F172A] outline-none transition-colors focus:border-[#1B4F8B]";

export default function ValueControl({
  row,
  editor,
  onCommit,
}: {
  row: SettingRow;
  editor: EditorSpec;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(row.value);
  const [freeform, setFreeform] = useState(false);

  // A row can be replaced under this control by an import. Re-sync rather than
  // stranding the operator's view on a value the store no longer holds.
  useEffect(() => {
    setDraft(row.value);
    setFreeform(false);
  }, [row.key, row.value]);

  const explicit = !!(row.options && row.options.length > 0);
  const { error, warning } = validateValue(editor, draft, explicit);
  const dirty = draft !== row.value;

  const commit = () => {
    if (error || !dirty) return;
    onCommit(draft.trim());
  };

  const errorBorder = error ? "border-[#DC2626]" : "border-[#E2E8F0]";

  return (
    <div className="flex flex-col gap-1 min-w-[220px]">
      <div className="flex items-center gap-2 flex-wrap">
        {editor.shape === "boolean" && <BooleanControl value={draft} onChange={setDraft} />}

        {editor.shape === "enum" && !freeform && (
          <>
            <select
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              className={`${inputBase} border-[#E2E8F0] pr-8 cursor-pointer`}
            >
              {editor.options.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
              {!editor.options.includes(draft) && <option value={draft}>{draft}</option>}
            </select>
            {!explicit && (
              /* An inferred vocabulary is evidence, not a constraint. This escape
                 hatch is what stops the inference hardening into the whitelist
                 the whole module refuses to have. An option list the SOURCE
                 stated is different, and is enforced — so no hatch there. */
              <button
                onClick={() => setFreeform(true)}
                title="The vocabulary was observed from sibling keys, not declared. Type a value outside it."
                className="h-9 px-2.5 rounded-lg border border-[#E2E8F0] text-[11px] font-semibold text-[#1B4F8B] bg-white hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
              >
                Other…
              </button>
            )}
          </>
        )}

        {editor.shape === "enum" && freeform && (
          <input
            type="text"
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={`${inputBase} ${error ? "border-[#DC2626]" : "border-[#1B4F8B]"} w-full max-w-[240px]`}
          />
        )}

        {editor.shape === "number" && (
          <input
            type="number"
            value={draft}
            step={editor.integer ? 1 : "any"}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={`${inputBase} ${errorBorder} w-[140px] font-mono`}
          />
        )}

        {editor.shape === "date" && editor.precision === "date" && (
          <input
            type="date"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className={`${inputBase} ${errorBorder} w-[170px] font-mono`}
          />
        )}

        {editor.shape === "date" && editor.precision === "datetime" && (
          /* Deliberately a text box, not datetime-local: the seeded value carries
             a +05:00 offset that datetime-local silently drops, and losing the
             offset on the timestamp the whole demo clock hangs off would be a
             quiet data change rather than an edit. */
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={`${inputBase} ${errorBorder} w-full max-w-[260px] font-mono text-[12px]`}
          />
        )}

        {editor.shape === "text" && (
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && commit()}
            className={`${inputBase} ${errorBorder} w-full max-w-[280px]`}
          />
        )}

        {row.unit && <span className="text-[11px] font-semibold text-[#94A3B8]">{row.unit}</span>}

        {dirty ? (
          <div className="flex items-center gap-1">
            <button
              onClick={commit}
              disabled={!!error}
              title={error ?? "Save"}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "#16A34A" }}
            >
              <Check size={13} />
            </button>
            <button
              onClick={() => {
                setDraft(row.value);
                setFreeform(false);
              }}
              title="Discard"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#F1F5F9] text-[#64748B] cursor-pointer transition-colors hover:bg-[#E2E8F0]"
            >
              <X size={13} />
            </button>
          </div>
        ) : (
          <Pencil size={12} className="text-[#CBD5E1]" aria-hidden />
        )}
      </div>

      {error && (
        <span className="text-[11px] font-semibold text-[#DC2626] flex items-center gap-1">
          <AlertTriangle size={11} /> {error}
        </span>
      )}
      {!error && warning && dirty && (
        <span className="text-[11px] text-[#D97706] flex items-center gap-1">
          <AlertTriangle size={11} /> {warning}
        </span>
      )}
    </div>
  );
}

function BooleanControl({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const parsed = parseBoolean(value);
  // The store's own vocabulary and casing are preserved — see `booleanTokens`.
  const { trueToken, falseToken } = booleanTokens(value);

  return (
    <div className="inline-flex rounded-lg border border-[#E2E8F0] overflow-hidden">
      {[
        { label: "True", token: trueToken, on: parsed === true },
        { label: "False", token: falseToken, on: parsed === false },
      ].map((opt) => (
        <button
          key={opt.label}
          onClick={() => onChange(opt.token)}
          className="h-9 px-3 text-[12px] font-semibold cursor-pointer transition-colors"
          style={{
            backgroundColor: opt.on ? "#0B2545" : "white",
            color: opt.on ? "white" : "#64748B",
          }}
        >
          {opt.label}
        </button>
      ))}
      <span className="h-9 px-2.5 flex items-center text-[11px] font-mono text-[#94A3B8] bg-[#F8FAFC] border-l border-[#E2E8F0]">
        {value}
      </span>
    </div>
  );
}

/** Read-only rendering, used by the import preview where nothing is editable yet. */
export function ValuePreview({ value }: { value: string }) {
  const isDate = isoDatePrecision(value) !== null;
  return (
    <span className={`text-[12px] ${isDate ? "font-mono" : ""} text-[#0F172A]`} title={value}>
      {value.length > 48 ? `${value.slice(0, 48)}...` : value}
    </span>
  );
}
