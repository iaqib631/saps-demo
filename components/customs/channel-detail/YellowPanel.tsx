"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { CheckCircle, Circle, Paperclip, Save, ArrowRight, MessageSquare, FileText } from "lucide-react";

interface YellowPanelProps {
  awb: string;
}

interface ChecklistItem {
  id: string;
  label: string;
  checked: boolean;
  required: boolean;
}

export default function YellowPanel({ awb }: YellowPanelProps) {
  const { addToast } = useToast();
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: "1", label: "GD filed", checked: true, required: true },
    { id: "2", label: "MAWB attached", checked: true, required: true },
    { id: "3", label: "HAWB attached if applicable", checked: false, required: false },
    { id: "4", label: "Commercial invoice attached", checked: true, required: true },
    { id: "5", label: "Packing list attached", checked: true, required: true },
    { id: "6", label: "Certificates attached if required", checked: false, required: false },
    { id: "7", label: "Duty/tax payment proof attached", checked: false, required: true },
    { id: "8", label: "CHA response attached", checked: false, required: true },
    { id: "9", label: "Consignee details verified", checked: true, required: true },
  ]);

  const [queryRef, setQueryRef] = useState("");
  const [queryDesc, setQueryDesc] = useState("");
  const [responseNotes, setResponseNotes] = useState("");
  const [reviewRemarks, setReviewRemarks] = useState("");
  const [queryRaisedAt, setQueryRaisedAt] = useState("31 May 2026 10:45");

  const toggleCheck = (id: string) => {
    setChecklist((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, checked: !item.checked } : item
      )
    );
    const item = checklist.find((c) => c.id === id);
    if (item) {
      addToast(
        `${item.label} ${item.checked ? "marked pending" : "marked complete"}`,
        "success"
      );
    }
  };

  const checkedCount = checklist.filter((c) => c.checked).length;
  const requiredChecked = checklist.filter((c) => c.required && c.checked).length;
  const requiredTotal = checklist.filter((c) => c.required).length;
  const progress = (checkedCount / checklist.length) * 100;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Yellow Channel Panel</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[12px] text-[#64748B]">
            {requiredChecked}/{requiredTotal} required
          </span>
          <div className="w-24 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "#D97706" }}
            />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="mb-6">
          <h3 className="text-[13px] font-bold text-[#0F172A] mb-3">Document Review Checklist</h3>
          <div className="space-y-2">
            {checklist.map((item) => (
              <button
                key={item.id}
                onClick={() => toggleCheck(item.id)}
                className="w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left"
                style={{
                  backgroundColor: item.checked ? "#FEF3C7" : "#F8FAFC",
                  borderColor: item.checked ? "#FDE68A" : "#E2E8F0",
                }}
              >
                {item.checked ? (
                  <div className="w-6 h-6 rounded-full bg-[#D97706] flex items-center justify-center flex-shrink-0">
                    <CheckCircle size={14} className="text-white" />
                  </div>
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-[#CBD5E1] flex items-center justify-center flex-shrink-0">
                    <Circle size={12} className="text-[#CBD5E1]" />
                  </div>
                )}
                <span
                  className="text-[13px] font-semibold flex-1"
                  style={{ color: item.checked ? "#D97706" : "#475569" }}
                >
                  {item.label}
                </span>
                {item.required && (
                  <span className="text-[10px] font-bold text-[#DC2626] bg-[#FEE2E2] px-2 py-0.5 rounded-full">
                    REQUIRED
                  </span>
                )}
                {item.checked && (
                  <span className="text-[11px] font-semibold text-[#D97706] bg-white/60 px-2 py-0.5 rounded-full">
                    CHECKED
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
          <h3 className="text-[13px] font-bold text-[#0F172A] mb-3 flex items-center gap-2">
            <MessageSquare size={16} className="text-[#D97706]" />
            Query & Response
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Query Reference #</label>
              <input
                type="text"
                value={queryRef}
                onChange={(e) => setQueryRef(e.target.value)}
                placeholder="Enter query reference"
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#D97706] transition-colors"
              />
            </div>
            <div>
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Query Raised At</label>
              <input
                type="text"
                value={queryRaisedAt}
                onChange={(e) => setQueryRaisedAt(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#D97706] transition-colors"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Query Description</label>
              <textarea
                value={queryDesc}
                onChange={(e) => setQueryDesc(e.target.value)}
                placeholder="Describe the query raised by customs"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#D97706] transition-colors resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Response Notes</label>
              <textarea
                value={responseNotes}
                onChange={(e) => setResponseNotes(e.target.value)}
                placeholder="Enter CHA response notes"
                rows={3}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#D97706] transition-colors resize-none"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Supporting Documents</label>
              <button className="flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-[#CBD5E1] text-[13px] text-[#64748B] cursor-pointer hover:border-[#D97706] hover:text-[#D97706] transition-colors">
                <Paperclip size={16} />
                Upload supporting documents
              </button>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[12px] font-semibold text-[#64748B] mb-1.5">Review Remarks</label>
              <textarea
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder="Enter review remarks"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#D97706] transition-colors resize-none"
              />
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => addToast("Review saved", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#D97706" }}
          >
            <Save size={14} />
            Save Review
          </button>
          <button
            onClick={() => addToast("Requested more documents", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            style={{ borderColor: "#D97706", color: "#D97706" }}
          >
            <FileText size={14} />
            Request More Documents
          </button>
          <button
            onClick={() => addToast("Documents marked accepted", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <CheckCircle size={14} />
            Mark Documents Accepted
          </button>
          <button
            onClick={() => addToast("Moved to OOC capture", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <ArrowRight size={14} />
            Move to OOC Capture
          </button>
        </div>
      </div>
    </div>
  );
}