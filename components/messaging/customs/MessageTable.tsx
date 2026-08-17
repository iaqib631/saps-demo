"use client";

import { useState } from "react";
import { Eye, RefreshCw, Download, FileText, CheckCircle, MoreHorizontal } from "lucide-react";

interface Message {
  id: string;
  awb: string;
  type: string;
  direction: string;
  airline: string;
  reference: string;
  sentAt: string;
  status: string;
  linkedEvent: string;
  errorMsg: string;
  retryCount: number;
  parsedFields: string;
  rawPreview: string;
  audit: { action: string; user: string; timestamp: string; oldStatus: string; newStatus: string; remarks: string }[];
}

interface MessageTableProps {
  messages: Message[];
  onView: (msg: Message) => void;
  onRetry: (msg: Message) => void;
  onDownload: (msg: Message) => void;
  onLinkAWB: (msg: Message) => void;
  onMarkReviewed: (msg: Message) => void;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string }> = {
  Sent: { bg: "#DBEAFE", text: "#1B4F8B", dot: "#2E75B6" },
  Received: { bg: "#DCFCE7", text: "#16A34A", dot: "#16A34A" },
  Failed: { bg: "#FEE2E2", text: "#DC2626", dot: "#DC2626" },
  Pending: { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  Retrying: { bg: "#FEF3C7", text: "#D97706", dot: "#D97706" },
  Acknowledged: { bg: "#F3E8FF", text: "#7C3AED", dot: "#7C3AED" },
};

const directionConfig: Record<string, { bg: string; text: string; icon: string }> = {
  Inbound: { bg: "#DCFCE7", text: "#16A34A", icon: "In" },
  Outbound: { bg: "#DBEAFE", text: "#1B4F8B", icon: "Out" },
};

export default function MessageTable({ messages, onView, onRetry, onDownload, onLinkAWB, onMarkReviewed }: MessageTableProps) {
  const [actionOpenRow, setActionOpenRow] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  const totalPages = Math.ceil(messages.length / rowsPerPage);
  const paginated = messages.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Message Log</h2>
          <span className="text-[12px] text-[#64748B] ml-1">{messages.length} messages</span>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[1100px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              {["Message ID", "AWB #", "Type", "Direction", "Airline", "Reference #", "Sent / Received At", "Status", "Linked Event", "Action"].map(
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
            {paginated.map((msg, idx) => {
              const sc = statusConfig[msg.status] || statusConfig.Sent;
              const dc = directionConfig[msg.direction] || directionConfig.Inbound;
              return (
                <tr
                  key={msg.id}
                  className="border-b border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors"
                >
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-semibold text-[#0B2545]">{msg.id}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-medium text-[#475569]">{msg.awb}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] font-bold text-[#0B2545]">{msg.type}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: dc.bg, color: dc.text }}
                    >
                      {dc.icon}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{msg.airline}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{msg.reference}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{msg.sentAt}</span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span
                      className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ backgroundColor: sc.bg, color: sc.text }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                      {msg.status}
                    </span>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-[13px] text-[#475569]">{msg.linkedEvent}</span>
                  </td>
                  <td className="px-4 py-3.5 relative">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onView(msg)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0B2545] cursor-pointer transition-colors"
                        title="View Message"
                      >
                        <Eye size={15} />
                      </button>
                      {msg.status === "Failed" && (
                        <button
                          onClick={() => onRetry(msg)}
                          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#D97706] cursor-pointer transition-colors"
                          title="Retry Failed Message"
                        >
                          <RefreshCw size={15} />
                        </button>
                      )}
                      <button
                        onClick={() => onDownload(msg)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#1B4F8B] cursor-pointer transition-colors"
                        title="Download Raw Message"
                      >
                        <Download size={15} />
                      </button>
                      <button
                        onClick={() => onLinkAWB(msg)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#7C3AED] cursor-pointer transition-colors"
                        title="Link to AWB Detail"
                      >
                        <FileText size={15} />
                      </button>
                      <button
                        onClick={() => onMarkReviewed(msg)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#16A34A] cursor-pointer transition-colors"
                        title="Mark Reviewed"
                      >
                        <CheckCircle size={15} />
                      </button>
                      <button
                        onClick={() => setActionOpenRow(actionOpenRow === idx ? null : idx)}
                        className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] text-[#64748B] hover:text-[#0B2545] cursor-pointer transition-colors"
                        title="More"
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                    {actionOpenRow === idx && (
                      <div className="absolute right-4 top-12 z-10 w-[180px] bg-white rounded-xl shadow-lg border border-[#E2E8F0] overflow-hidden">
                        <button
                          onClick={() => { onView(msg); setActionOpenRow(null); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer flex items-center gap-2"
                        >
                          <Eye size={14} className="text-[#64748B]" /> View Message
                        </button>
                        <button
                          onClick={() => { onDownload(msg); setActionOpenRow(null); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer flex items-center gap-2"
                        >
                          <Download size={14} className="text-[#64748B]" /> Download Raw
                        </button>
                        <button
                          onClick={() => { onLinkAWB(msg); setActionOpenRow(null); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer flex items-center gap-2"
                        >
                          <FileText size={14} className="text-[#64748B]" /> Link to AWB
                        </button>
                        <button
                          onClick={() => { onMarkReviewed(msg); setActionOpenRow(null); }}
                          className="w-full text-left px-3 py-2 text-[13px] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer flex items-center gap-2"
                        >
                          <CheckCircle size={14} className="text-[#64748B]" /> Mark Reviewed
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-[#E2E8F0]">
          <span className="text-[12px] text-[#64748B]">
            Showing {(currentPage - 1) * rowsPerPage + 1} to{" "}
            {Math.min(currentPage * rowsPerPage, messages.length)} of {messages.length} entries
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer transition-colors"
            >
              <span className="text-[12px]">&lt;</span>
            </button>
            <span className="text-[12px] font-medium text-[#0F172A] px-3">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] disabled:opacity-40 cursor-pointer transition-colors"
            >
              <span className="text-[12px]">&gt;</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}