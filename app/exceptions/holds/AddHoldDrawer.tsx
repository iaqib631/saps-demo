"use client";

/**
 * The create path, merged in from the compliance-side hold register.
 *
 * The canonical register could read a hold from every angle and place
 * none, which made it a report rather than a screen. This is the missing
 * half.
 *
 * It asks for more than the screen it came from did. That drawer collected
 * AWB, type, reason, owner and priority and left the four attribution
 * columns — `NameOfPerson`, `NIC`, `HoldingCompany`, `Designation` — blank.
 * A hold placed that way is a row nobody can be held to, which is exactly
 * the failure the seven release columns exist to prevent on the other
 * side. If the release side demands a named person and an NIC, the hold
 * side has to demand the same or the audit trail is asymmetric.
 *
 * The agency fields prefill from the hold type: picking ANF fills in the
 * Anti-Narcotics Force, picking ASF fills in the Airport Security Force.
 * Free-texting those is how one agency becomes three spellings in the
 * same register.
 */

import { useState } from "react";
import { Paperclip, Plus, ShieldAlert, X } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { HOLD_TYPE_LABEL, type HoldType } from "@/lib/domain";
import {
  DEFAULT_OWNER_FOR_TYPE,
  HOLD_AUTHORITY,
  HOLD_OWNER_LABEL,
  HOLD_OWNER_ORDER,
  HOLD_PRIORITY_LABEL,
  HOLD_PRIORITY_ORDER,
  HOLD_TYPE_ORDER,
  HOLD_TYPE_TONE,
  NIC_PATTERN,
  type HoldOwnerQueue,
  type HoldPriority,
  type NewHoldDraft,
} from "./model";

interface Props {
  open: boolean;
  onClose: () => void;
  onSubmit: (draft: NewHoldDraft) => void;
  /** Shown up front so the operator can quote the number before saving. */
  nextHoldNo: string;
}

/** Types an operator can place by hand. */
const SELECTABLE_TYPES: HoldType[] = HOLD_TYPE_ORDER.filter(
  // A CDR/OSD hold is raised by FC-04 when the CDR is opened, and a bare
  // "security" hold only exists on migrated rows where CMTS failed to
  // record the agency. Offering either here would let an operator create
  // the ambiguity this screen was merged to remove.
  (t) => t !== "cdr-osd" && t !== "security",
);

const fieldClass = (invalid: boolean) =>
  `w-full h-10 px-3 rounded-lg border text-[13px] text-[#0F172A] outline-none transition-colors ${
    invalid ? "border-[#DC2626] bg-[#FEE2E2]/20" : "border-[#E2E8F0] focus:border-[#1B4F8B]"
  }`;

export default function AddHoldDrawer({ open, onClose, onSubmit, nextHoldNo }: Props) {
  const { addToast } = useToast();

  const [AWBNo, setAWBNo] = useState("");
  const [HWBNo, setHWBNo] = useState("");
  const [type, setType] = useState<HoldType>("customs");
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState<HoldOwnerQueue>("compliance");
  const [priority, setPriority] = useState<HoldPriority>("medium");
  const [NameOfPerson, setNameOfPerson] = useState("");
  const [NIC, setNIC] = useState("");
  const [Designation, setDesignation] = useState("");
  const [notes, setNotes] = useState("");
  const [documents, setDocuments] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const authority = HOLD_AUTHORITY[type];

  // Changing the type re-points the owner queue too, unless the operator
  // has already moved it off the default for the previous type — an
  // explicit choice should not be silently undone by a later edit.
  const selectType = (next: HoldType) => {
    setOwner((current) => (current === DEFAULT_OWNER_FOR_TYPE[type] ? DEFAULT_OWNER_FOR_TYPE[next] : current));
    setType(next);
  };

  const clearError = (key: string) => setErrors((p) => ({ ...p, [key]: "" }));

  const validate = () => {
    const next: Record<string, string> = {};
    if (!AWBNo.trim()) next.AWBNo = "AWB # is required";
    if (!reason.trim()) next.reason = "Reason is required";
    if (!description.trim()) next.description = "Description is required — it becomes REMARKS";
    if (!NameOfPerson.trim()) next.NameOfPerson = "The person placing the hold must be named";
    if (!NIC.trim()) next.NIC = "NIC is required — this is what makes the hold attributable";
    else if (!NIC_PATTERN.test(NIC.trim())) next.NIC = "NIC must read 00000-0000000-0";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const reset = () => {
    setAWBNo("");
    setHWBNo("");
    setType("customs");
    setReason("");
    setDescription("");
    setOwner("compliance");
    setPriority("medium");
    setNameOfPerson("");
    setNIC("");
    setDesignation("");
    setNotes("");
    setDocuments([]);
    setErrors({});
  };

  const handleSubmit = () => {
    if (!validate()) {
      addToast("Hold not placed — required fields are missing", "error");
      return;
    }
    onSubmit({
      AWBNo: AWBNo.trim(),
      HWBNo: HWBNo.trim(),
      type,
      reason: reason.trim(),
      description: description.trim(),
      owner,
      priority,
      HeldBy: authority.heldBy,
      NameOfPerson: NameOfPerson.trim(),
      NIC: NIC.trim(),
      Designation: Designation.trim() || "Not recorded",
      documents,
      notes: notes.trim(),
    });
    reset();
  };

  const handleAttach = () => {
    setDocuments((d) => [...d, `hold-support-${String(d.length + 1).padStart(3, "0")}.pdf`]);
    addToast("Supporting document attached", "success");
  };

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
            <h2 className="text-[16px] font-bold text-[#0F172A]">Place a hold</h2>
            <p className="text-[11px] font-mono text-[#94A3B8]">{nextHoldNo}</p>
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
          {/* ---- What is being held ---- */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                AWB # <span className="text-[#DC2626]">*</span>
              </label>
              <input
                value={AWBNo}
                onChange={(e) => {
                  setAWBNo(e.target.value);
                  clearError("AWBNo");
                }}
                placeholder="214-45678901"
                className={fieldClass(!!errors.AWBNo)}
              />
              {errors.AWBNo && <p className="text-[11px] text-[#DC2626] mt-1">{errors.AWBNo}</p>}
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">HAWB #</label>
              <input
                value={HWBNo}
                onChange={(e) => setHWBNo(e.target.value)}
                placeholder="HAWB-7781"
                className={fieldClass(false)}
              />
            </div>
          </div>

          {/* ---- Type, and the agency it implies ---- */}
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Hold type</label>
            <div className="flex flex-wrap gap-2">
              {SELECTABLE_TYPES.map((t) => {
                const tone = HOLD_TYPE_TONE[t];
                const on = type === t;
                return (
                  <button
                    key={t}
                    onClick={() => selectType(t)}
                    className="h-8 px-3 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap border"
                    style={{
                      backgroundColor: on ? tone.bg : "#F8FAFC",
                      color: on ? tone.fg : "#64748B",
                      borderColor: on ? tone.fg : "#E2E8F0",
                    }}
                  >
                    {HOLD_TYPE_LABEL[t]}
                  </button>
                );
              })}
            </div>
            <div className="mt-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] px-3.5 py-3 flex items-start gap-2.5">
              <ShieldAlert size={15} className="text-[#64748B] flex-shrink-0 mt-0.5" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 flex-1">
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-[#CBD5E1]">HeldBy</span>
                  <span className="text-[12px] font-medium text-[#0F172A]">{authority.heldBy}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] font-mono text-[#CBD5E1]">HoldingCompany</span>
                  <span className="text-[12px] font-medium text-[#0F172A]">{authority.company}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ---- Why ---- */}
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Reason <span className="text-[#DC2626]">*</span>
            </label>
            <input
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                clearError("reason");
              }}
              placeholder="One line — this is the register column"
              className={fieldClass(!!errors.reason)}
            />
            {errors.reason && <p className="text-[11px] text-[#DC2626] mt-1">{errors.reason}</p>}
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Description <span className="text-[#DC2626]">*</span>
              <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">REMARKS</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                clearError("description");
              }}
              rows={3}
              placeholder="What is wrong, what has to happen before it can be lifted, and who lifts it"
              className={`w-full px-3 py-2 rounded-lg border text-[13px] text-[#0F172A] outline-none resize-none transition-colors ${
                errors.description
                  ? "border-[#DC2626] bg-[#FEE2E2]/20"
                  : "border-[#E2E8F0] focus:border-[#1B4F8B]"
              }`}
            />
            {errors.description && (
              <p className="text-[11px] text-[#DC2626] mt-1">{errors.description}</p>
            )}
          </div>

          {/* ---- Who works it ---- */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                Owner queue
              </label>
              <select
                value={owner}
                onChange={(e) => setOwner(e.target.value as HoldOwnerQueue)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors cursor-pointer"
              >
                {HOLD_OWNER_ORDER.map((o) => (
                  <option key={o} value={o}>
                    {HOLD_OWNER_LABEL[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as HoldPriority)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors cursor-pointer"
              >
                {HOLD_PRIORITY_ORDER.map((p) => (
                  <option key={p} value={p}>
                    {HOLD_PRIORITY_LABEL[p]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* ---- Attribution: the hold-side counterpart of the seven release columns ---- */}
          <div className="rounded-xl border border-[#E2E8F0] p-4 flex flex-col gap-3">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              Attribution
            </p>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                Person placing the hold <span className="text-[#DC2626]">*</span>
                <span className="ml-1.5 font-mono text-[9px] text-[#CBD5E1]">NameOfPerson</span>
              </label>
              <input
                value={NameOfPerson}
                onChange={(e) => {
                  setNameOfPerson(e.target.value);
                  clearError("NameOfPerson");
                }}
                placeholder="Rank and name"
                className={fieldClass(!!errors.NameOfPerson)}
              />
              {errors.NameOfPerson && (
                <p className="text-[11px] text-[#DC2626] mt-1">{errors.NameOfPerson}</p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                  NIC <span className="text-[#DC2626]">*</span>
                </label>
                <input
                  value={NIC}
                  onChange={(e) => {
                    setNIC(e.target.value);
                    clearError("NIC");
                  }}
                  placeholder="00000-0000000-0"
                  className={fieldClass(!!errors.NIC)}
                />
                {errors.NIC && <p className="text-[11px] text-[#DC2626] mt-1">{errors.NIC}</p>}
              </div>
              <div>
                <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
                  Designation
                </label>
                <input
                  value={Designation}
                  onChange={(e) => setDesignation(e.target.value)}
                  placeholder="Appraising Officer"
                  className={fieldClass(false)}
                />
              </div>
            </div>
          </div>

          {/* ---- Supporting documents ---- */}
          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">
              Supporting documents
            </label>
            <div className="flex flex-col gap-2">
              {documents.map((d) => (
                <div key={d} className="flex items-center gap-2">
                  <div className="flex items-center gap-2 h-10 px-3 rounded-lg border border-[#DCFCE7] bg-[#DCFCE7] text-[#16A34A] text-[13px] font-medium flex-1">
                    <Paperclip size={16} />
                    {d}
                  </div>
                  <button
                    onClick={() => setDocuments((all) => all.filter((x) => x !== d))}
                    className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#FEE2E2] text-[#DC2626] cursor-pointer transition-colors"
                    aria-label={`Remove ${d}`}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
              <button
                onClick={handleAttach}
                className="flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-[#CBD5E1] text-[13px] text-[#64748B] cursor-pointer hover:border-[#1B4F8B] hover:text-[#1B4F8B] transition-colors"
              >
                <Paperclip size={16} />
                Attach supporting document
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Anything the next shift needs to know"
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors resize-none"
            />
          </div>
        </div>

        <div className="px-5 py-4 border-t border-[#E2E8F0] flex items-center gap-3 flex-shrink-0">
          <button
            onClick={handleSubmit}
            className="flex items-center gap-2 h-10 px-5 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            <Plus size={16} />
            Place hold
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
