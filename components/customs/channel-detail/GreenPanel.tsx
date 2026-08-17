"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { CheckCircle, FileText, Eye, Circle, ArrowRight } from "lucide-react";

interface GreenPanelProps {
  awb: string;
}

interface CheckItem {
  label: string;
  checked: boolean;
}

export default function GreenPanel({ awb }: GreenPanelProps) {
  const { addToast } = useToast();
  const [items, setItems] = useState<CheckItem[]>([
    { label: "Auto-clear status", checked: true },
    { label: "Document completeness", checked: true },
    { label: "Duty/tax status", checked: true },
    { label: "OOC readiness", checked: false },
    { label: "Release recommendation", checked: false },
  ]);

  const toggleItem = (index: number) => {
    const updated = [...items];
    updated[index].checked = !updated[index].checked;
    setItems(updated);
    addToast(`${updated[index].label} ${updated[index].checked ? "marked complete" : "marked pending"}`, "success");
  };

  const completedCount = items.filter((i) => i.checked).length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Green Channel Panel</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[12px] text-[#64748B]">{completedCount}/{items.length} checks</span>
          <div className="w-24 h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress}%`, backgroundColor: "#16A34A" }}
            />
          </div>
        </div>
      </div>

      <div className="p-5">
        <div className="space-y-3 mb-6">
          {items.map((item, index) => (
            <button
              key={item.label}
              onClick={() => toggleItem(index)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all text-left"
              style={{
                backgroundColor: item.checked ? "#DCFCE7" : "#F8FAFC",
                borderColor: item.checked ? "#86EFAC" : "#E2E8F0",
              }}
            >
              {item.checked ? (
                <div className="w-6 h-6 rounded-full bg-[#16A34A] flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={14} className="text-white" />
                </div>
              ) : (
                <div className="w-6 h-6 rounded-full border-2 border-[#CBD5E1] flex items-center justify-center flex-shrink-0">
                  <Circle size={12} className="text-[#CBD5E1]" />
                </div>
              )}
              <span
                className="text-[13px] font-semibold flex-1"
                style={{ color: item.checked ? "#16A34A" : "#475569" }}
              >
                {item.label}
              </span>
              {item.checked && (
                <span className="text-[11px] font-semibold text-[#16A34A] bg-white/60 px-2 py-0.5 rounded-full">
                  PASS
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => addToast("Marked ready for OOC", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#16A34A" }}
          >
            <ArrowRight size={14} />
            Mark Ready for OOC
          </button>
          <button
            onClick={() => addToast("OOC capture initiated", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            style={{ borderColor: "#1B4F8B", color: "#1B4F8B" }}
          >
            <FileText size={14} />
            Capture OOC
          </button>
          <button
            onClick={() => addToast("Viewing documents", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <Eye size={14} />
            View Documents
          </button>
        </div>
      </div>
    </div>
  );
}