"use client";
import { useToast } from "@/components/ToastContext";
import { Eye, FileText, CheckCircle, Lock } from "lucide-react";

interface OOCRow {
  id: string;
  oocRef: string;
  awb: string;
  gd: string;
  channel: string;
  consignee: string;
  issuedAt: string;
  recordedBy: string;
  releaseStatus: string;
}

interface RecentOOCTableProps {
  rows: OOCRow[];
}

const channelDot: Record<string, string> = {
  Green: "#16A34A",
  Yellow: "#D97706",
  Red: "#DC2626",
};

const releaseConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Released: { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
  "Pending Release": { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  Held: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
};

export default function RecentOOCTable({ rows }: RecentOOCTableProps) {
  const { addToast } = useToast();

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Recent OOC Captures</h2>
          <span className="text-[12px] text-[#64748B] ml-1">{rows.length} records</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {["OOC Ref #", "AWB #", "GD #", "Channel", "Consignee", "Issued At", "Recorded By", "Release Status", "Action"].map(
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
              const rc = releaseConfig[row.releaseStatus] || releaseConfig["Pending Release"];
              return (
                <tr
                  key={row.id}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-semibold text-[#0B2545]">{row.oocRef}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-medium text-[#475569]">{row.awb}</span>
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
                    <span className="text-[13px] text-[#475569]">{row.consignee}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{row.issuedAt}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{row.recordedBy}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: rc.bg, color: rc.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: rc.dot }} />
                      {row.releaseStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => addToast(`Viewed OOC ${row.oocRef}`, "success")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0B2545] cursor-pointer transition-colors"
                        title="View OOC"
                      >
                        <Eye size={15} />
                      </button>
                      <button
                        onClick={() => addToast(`Downloaded OOC ${row.oocRef}`, "success")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1B4F8B] cursor-pointer transition-colors"
                        title="Download OOC"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => addToast(`Released cargo for ${row.awb}`, "success")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#16A34A] cursor-pointer transition-colors"
                        title="Release"
                      >
                        <CheckCircle size={15} />
                      </button>
                      <button
                        onClick={() => addToast(`Applied hold on ${row.awb}`, "success")}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#DC2626] cursor-pointer transition-colors"
                        title="Hold"
                      >
                        <Lock size={15} />
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