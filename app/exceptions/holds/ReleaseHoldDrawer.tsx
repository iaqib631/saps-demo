"use client";

/**
 * The release path, merged in from the compliance-side hold register.
 *
 * This is the gap the merge exists to close. The canonical register was
 * the first screen in the product to render all seven CMTS release
 * columns — `ReleasePersonName`, `ReleaseCompany`, `ReleaseBy`,
 * `ReleasePersonDesignation`, `ReleasePersonNic`, `ReleaseRemarks`,
 * `ReleaseDateTime` — and there was no action anywhere that could put a
 * value in any of them. Seven columns that are always null are not an
 * audit trail; they are a promise of one.
 *
 * So the drawer is laid out as the seven columns rather than as a form:
 * every field is labelled with the column it writes, and the panel at the
 * bottom shows the row exactly as the register will hold it. What gets
 * signed is what gets stored.
 *
 * `ReleaseDateTime` is the one field the operator cannot type. A release
 * timestamp an operator chooses is not evidence of when the cargo was
 * let go, and the whole point of the pair of records is that a dispute
 * can be settled on them.
 */

import { useState } from "react";
import { Clock, LockOpen, Paperclip, X } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { DEMO_NOW, HOLD_TYPE_LABEL, formatDateTime } from "@/lib/domain";
import { NIC_PATTERN, type HoldView, type ReleaseDraft } from "./model";

interface Props {
  open: boolean;
  hold: HoldView | null;
  onClose: () => void;
  onSubmit: (draft: ReleaseDraft) => void;
}

const fieldClass = (invalid: boolean) =>
  `w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
    invalid ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#16A34A]"
  }`;

export default function ReleaseHoldDrawer({ open, hold, onClose, onSubmit }: Props) {
  const { addToast } = useToast();

  const [ReleasePersonName, setReleasePersonName] = useState("");
  const [ReleaseCompany, setReleaseCompany] = useState("");
  const [ReleaseBy, setReleaseBy] = useState("");
  const [ReleasePersonDesignation, setReleasePersonDesignation] = useState("");
  const [ReleasePersonNic, setReleasePersonNic] = useState("");
  const [releaseReason, setReleaseReason] = useState("");
  const [releaseNotes, setReleaseNotes] = useState("");
  const [releaseDocument, setReleaseDocument] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const clearError = (key: string) => setErrors((p) => ({ ...p, [key]: "" }));

  // Reason and notes are two fields on screen and one column in CMTS. The
  // reason is what the register shows; the notes are the detail a dispute
  // is argued on, and losing them to keep the field short would be the
  // wrong trade.
  const ReleaseRemarks = releaseNotes.trim()
    ? `${releaseReason.trim()} — ${releaseNotes.trim()}`
    : releaseReason.trim();

  const validate = () => {
    const next: Record<string, string> = {};
    if (!releaseReason.trim()) next.releaseReason = "Release reason is required";
    if (!ReleasePersonName.trim()) next.ReleasePersonName = "The person releasing must be named";
    if (!ReleaseCompany.trim()) next.ReleaseCompany = "Releasing company is required";
    if (!ReleasePersonNic.trim()) next.ReleasePersonNic = "NIC is required";
    else if (!NIC_PATTERN.test(ReleasePersonNic.trim()))
      next.ReleasePersonNic = "NIC must read 00000-0000000-0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = () => {
    setReleasePersonName("");
    setReleaseCompany("");
    setReleaseBy("");
    setReleasePersonDesignation("");
    setReleasePersonNic("");
    setReleaseReason("");
    setReleaseNotes("");
    setReleaseDocument(null);
    setErrors({});
  };

  const handleSubmit = () => {
    if (!validate()) {
      addToast("Hold not released — the release columns are incomplete", "error");
      return;
    }
    onSubmit({
      ReleasePersonName: ReleasePersonName.trim(),
      ReleaseCompany: ReleaseCompany.trim(),
      ReleaseBy: ReleaseBy.trim() || ReleasePersonName.trim().toLowerCase().replace(/\s+/g, "."),
      ReleasePersonDesignation: ReleasePersonDesignation.trim() || "Not recorded",
      ReleasePersonNic: ReleasePersonNic.trim(),
      ReleaseRemarks,
      releaseDocument,
    });
    reset();
  };

  /** The row as the register will hold it — same order as the schema. */
  const preview: Array<[string, string]> = [
    ["ReleasePersonName", ReleasePersonName.trim() || "—"],
    ["ReleaseCompany", ReleaseCompany.trim() || "—"],
    [
      "ReleaseBy",
      ReleaseBy.trim() ||
        (ReleasePersonName.trim()
          ? ReleasePersonName.trim().toLowerCase().replace(/\s+/g, ".")
          : "—"),
    ],
    ["ReleasePersonDesignation", ReleasePersonDesignation.trim() || "—"],
    ["ReleasePersonNic", ReleasePersonNic.trim() || "—"],
    ["ReleaseRemarks", ReleaseRemarks || "—"],
    ["ReleaseDateTime", formatDateTime(DEMO_NOW)],
  ];

  return (
    <>
      {open && <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />}
      <div
        className="fixed top-0 right-0 h-full bg-white shadow-xl z-[70] transition-transform duration-300 ease-out flex flex-col"
        style={{
          width: "100%",
          maxWidth: 460,
          transform: open ? "translateX(0)" : "translateX(100%)",
        }}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between px-5 h-[64px] border-b border-[#E2E8F0] flex-shrink-0">
          <div>
            <h2 className="text-[16px] font-bold text-[#0F172A]">Record release</h2>
            <p className="text-[11px] font-mono text-[#94A3B8]">{hold?.holdNo ?? "—"}</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-4">
          {hold && (
            <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="font-mono text-[13px] font-semibold text-[#0F172A]">
                  {hold.AWBNo}
                </span>
                <span className="text-[11px] font-semibold text-[#475569]">
                  {HOLD_TYPE_LABEL[hold.type]}
                </span>
              </div>
              <p className="text-[12px] text-[#64748B] mt-1.5">
                Placed by {hold.NameOfPerson} ({hold.Designation}, {hold.HoldingCompany}) on{" "}
                {formatDateTime(hold.Date)}.
              </p>
              <p className="text-[12px] text-[#94A3B8] mt-1">
                Only the authority that placed a hold can lift it — the releasing company below
                should be {hold.HoldingCompany} unless the hold has been formally transferred.
              </p>
            </div>
          )}

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Release reason <span className="text-[#DC2626]">*</span>
            </label>
            <input
              value={releaseReason}
              onChange={(e) => {
                setReleaseReason(e.target.value);
                clearError("releaseReason");
              }}
              placeholder="What changed that lets the cargo move"
              className={fieldClass(!!errors.releaseReason)}
            />
            {errors.releaseReason && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.releaseReason}</p>
            )}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Release notes
            </label>
            <textarea
              value={releaseNotes}
              onChange={(e) => setReleaseNotes(e.target.value)}
              rows={3}
              placeholder="Reference numbers, who authorised it, what was checked"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#16A34A] transition-colors resize-none"
            />
          </div>

          <div className="rounded-xl border border-[#E2E8F0] p-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Releasing party
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                Person releasing <span className="text-[#DC2626]">*</span>
                <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">ReleasePersonName</span>
              </label>
              <input
                value={ReleasePersonName}
                onChange={(e) => {
                  setReleasePersonName(e.target.value);
                  clearError("ReleasePersonName");
                }}
                placeholder="Rank and name"
                className={fieldClass(!!errors.ReleasePersonName)}
              />
              {errors.ReleasePersonName && (
                <p className="text-[11px] text-[#DC2626] mt-1">{errors.ReleasePersonName}</p>
              )}
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                Company <span className="text-[#DC2626]">*</span>
                <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">ReleaseCompany</span>
              </label>
              <input
                value={ReleaseCompany}
                onChange={(e) => {
                  setReleaseCompany(e.target.value);
                  clearError("ReleaseCompany");
                }}
                placeholder={hold?.HoldingCompany ?? "Releasing organisation"}
                className={fieldClass(!!errors.ReleaseCompany)}
              />
              {errors.ReleaseCompany && (
                <p className="text-[11px] text-[#DC2626] mt-1">{errors.ReleaseCompany}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                  NIC <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={ReleasePersonNic}
                  onChange={(e) => {
                    setReleasePersonNic(e.target.value);
                    clearError("ReleasePersonNic");
                  }}
                  placeholder="00000-0000000-0"
                  className={fieldClass(!!errors.ReleasePersonNic)}
                />
                {errors.ReleasePersonNic && (
                  <p className="text-[11px] text-[#DC2626] mt-1">{errors.ReleasePersonNic}</p>
                )}
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                  Designation
                </label>
                <input
                  value={ReleasePersonDesignation}
                  onChange={(e) => setReleasePersonDesignation(e.target.value)}
                  placeholder="Operations Supervisor"
                  className={fieldClass(false)}
                />
              </div>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                System user
                <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">ReleaseBy</span>
              </label>
              <input
                value={ReleaseBy}
                onChange={(e) => setReleaseBy(e.target.value)}
                placeholder="Derived from the name if left blank"
                className={fieldClass(false)}
              />
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Supporting document
            </label>
            {releaseDocument ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[#DCFCE7] bg-[#DCFCE7] text-[#16A34A] text-[13px] font-medium flex-1">
                  <Paperclip size={16} />
                  {releaseDocument}
                </div>
                <button
                  onClick={() => setReleaseDocument(null)}
                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer transition-colors"
                  aria-label="Remove document"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  setReleaseDocument("release-authority.pdf");
                  addToast("Supporting document attached", "success");
                }}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-[#CBD5E1] text-[13px] text-[#64748B] cursor-pointer hover:border-[#16A34A] hover:text-[#16A34A] transition-colors"
              >
                <Paperclip size={16} />
                Attach release authority
              </button>
            )}
          </div>

          {/* ---- What will actually be written ---- */}
          <div className="rounded-xl border border-[#BBF7D0] bg-[#F0FDF4] p-4">
            <div className="flex items-center gap-2">
              <Clock size={14} className="text-[#16A34A]" />
              <p className="text-[12px] font-semibold text-[#16A34A]">
                The seven CMTS release columns, as they will be stored
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-1.5">
              {preview.map(([col, value]) => (
                <div key={col} className="flex items-start justify-between gap-3">
                  <span className="text-[11px] font-mono text-[#15803D] flex-shrink-0">{col}</span>
                  <span className="text-[11px] text-[#166534] text-right break-words">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#16A34A" }}
          >
            <LockOpen size={16} />
            Release hold
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            Cancel
          </button>
        </div>
      </div>
    </>
  );
}
