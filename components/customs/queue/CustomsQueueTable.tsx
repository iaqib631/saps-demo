"use client";
import { useToast } from "@/components/ToastContext";
import { Eye, FileText, Lock, Unlock, MessageSquare, CheckCircle } from "lucide-react";

interface QueueRow {
  id: string;
  awb: string;
  gd: string;
  channel: string;
  filedAt: string;
  cha: string;
  consignee: string;
  age: string;
  status: string;
  cargoClass: string;
}

interface CustomsQueueTableProps {
  rows: QueueRow[];
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Filed: { bg: "#F1F5F9", text: "#64748B", dot: "#94A3B8" },
  "Under Review": { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  Query: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
  "Exam Scheduled": { bg: "#DBEAFE", text: "#1B4F8B", dot: "#2E75B6" },
  Examined: { bg: "#F3E8FF", text: "#7C3AED", dot: "#7C3AED" },
  "OOC Pending": { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  "OOC Issued": { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
  Released: { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
  Held: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
};

const channelDot: Record<string, string> = {
  Green: "#16A34A",
  Yellow: "#D97706",
  Red: "#DC2626",
};

export default function CustomsQueueTable({ rows }: CustomsQueueTableProps) {
  const { addToast } = useToast();

  const handleAction = (action: string, awb: string) => {
    addToast(`${action} for ${awb}`, "success");
  };

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Customs Queue</h2>
          <span className="text-[12px] text-[#64748B] ml-1">{rows.length} records</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {["AWB #", "GD #", "Channel", "Filed At", "CHA", "Consignee", "Age", "Status", "Action"].map(
                (h) => (
                  <th
                    key={h}
                    className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-3 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const sc = statusConfig[row.status] || statusConfig.Filed;
              return (
                <tr
                  key={row.id}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-semibold text-[#0B2545]">{row.awb}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-medium text-[#475569]">{row.gd}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: channelDot[row.channel] || "#64748B" }}
                      />
                      <span className="text-[13px] font-medium text-[#475569]">{row.channel}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{row.filedAt}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{row.cha}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{row.consignee}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-semibold text-[#475569]">{row.age}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: sc.bg, color: sc.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                      {row.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleAction("Viewed detail", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0B2545] cursor-pointer transition-colors"
                        title="View Channel Detail"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => handleAction("Captured OOC", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#16A34A] cursor-pointer transition-colors"
                        title="Capture OOC"
                      >
                        <CheckCircle size={15} />
                      </button>
                      <button
                        onClick={() => handleAction("Applied hold", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#DC2626] cursor-pointer transition-colors"
                        title="Apply Hold"
                      >
                        <Lock size={15} />
                      </button>
                      <button
                        onClick={() => handleAction("Released hold", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1B4F8B] cursor-pointer transition-colors"
                        title="Release Hold"
                      >
                        <Unlock size={15} />
                      </button>
                      <button
                        onClick={() => handleAction("Opened AWB", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#7C3AED] cursor-pointer transition-colors"
                        title="View AWB"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => handleAction("Opened messaging", row.awb)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0B2545] cursor-pointer transition-colors"
                        title="Customs Messaging"
                      >
                        <MessageSquare size={15} />
                      </button>
                    </div>
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