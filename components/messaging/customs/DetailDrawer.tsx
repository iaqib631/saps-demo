"use client";

import { useEffect } from "react";
import { X, RefreshCw, Download, FileText, CheckCircle, AlertTriangle, Clock, ArrowRight } from "lucide-react";

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

interface DetailDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message | null;
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

export default function DetailDrawer({ isOpen, onClose, message, onRetry, onDownload, onLinkAWB, onMarkReviewed }: DetailDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!message) return null;

  const sc = statusConfig[message.status] || statusConfig.Sent;

  return (
    <>
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-[60] transition-opacity duration-300"
          onClick={onClose}
        />
      )}
      <div
        className="fixed top-0 right-0 h-full bg-white shadow-xl z-[70] transition-transform duration-300 ease-out flex flex-col"
        style={{
          width: "100%",
          maxWidth: 480,
          transform: isOpen ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div className="flex items-center justify-between px-5 h-[64px] border-b border-[#E2E8F0] flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <h2 className="text-[16px] font-bold text-[#0F172A]">Message Detail</h2>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Header info */}
          <div className="p-5 border-b border-[#E2E8F0]">
            <div className="flex items-center gap-3 mb-4">
              <span className="text-[28px] font-bold text-[#0B2545]">{message.type}</span>
              <span
                className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold"
                style={{ backgroundColor: sc.bg, color: sc.text }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: sc.dot }} />
                {message.status}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Message ID</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.id}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">AWB #</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.awb}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Direction</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.direction}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Airline</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.airline}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Reference #</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.reference}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Sent / Received At</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.sentAt}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Linked Cargo Event</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.linkedEvent}</p>
              </div>
              <div>
                <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Retry Count</span>
                <p className="text-[13px] font-medium text-[#0F172A] mt-0.5">{message.retryCount}</p>
              </div>
            </div>
          </div>

          {/* Error message if failed */}
          {message.errorMsg && (
            <div className="p-5 border-b border-[#E2E8F0]">
              <div className="flex items-start gap-3 p-3 rounded-xl border border-[#DC2626]/20 bg-[#DC2626]/5">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#DC2626]/10 flex items-center justify-center">
                  <AlertTriangle size={16} className="text-[#DC2626]" />
                </div>
                <div>
                  <p className="text-[13px] font-bold text-[#DC2626] mb-1">Error Message</p>
                  <p className="text-[13px] text-[#334155] leading-relaxed">{message.errorMsg}</p>
                </div>
              </div>
            </div>
          )}

          {/* Parsed Fields */}
          <div className="p-5 border-b border-[#E2E8F0]">
            <h3 className="text-[13px] font-bold text-[#0F172A] mb-3">Parsed Fields</h3>
            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
              <p className="text-[13px] text-[#334155] leading-relaxed font-mono">{message.parsedFields}</p>
            </div>
          </div>

          {/* Raw Message Preview */}
          <div className="p-5 border-b border-[#E2E8F0]">
            <h3 className="text-[13px] font-bold text-[#0F172A] mb-3">Raw Message Preview</h3>
            <div className="p-3 rounded-xl border border-[#E2E8F0] bg-[#0B2545]">
              <p className="text-[12px] text-[#94A3B8] leading-relaxed font-mono">{message.rawPreview}</p>
            </div>
          </div>

          {/* Audit Trail */}
          <div className="p-5">
            <h3 className="text-[13px] font-bold text-[#0F172A] mb-3">Audit Trail</h3>
            <div className="space-y-4">
              {message.audit.map((entry, idx) => (
                <div key={idx} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="w-2.5 h-2.5 rounded-full bg-[#1B4F8B]" />
                    {idx < message.audit.length - 1 && (
                      <div className="w-px h-full bg-[#E2E8F0] mt-1" />
                    )}
                  </div>
                  <div className="pb-4">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[12px] font-semibold text-[#0F172A]">{entry.action}</span>
                      <span className="text-[11px] text-[#94A3B8]">by {entry.user}</span>
                    </div>
                    <p className="text-[11px] text-[#64748B] mb-1">{entry.timestamp}</p>
                    {entry.oldStatus !== "-" && entry.newStatus !== "-" && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[11px] text-[#94A3B8]">{entry.oldStatus}</span>
                        <div className="w-3 h-3 flex items-center justify-center">
                          <ArrowRight size={10} className="text-[#94A3B8]" />
                        </div>
                        <span className="text-[11px] font-medium text-[#0B2545]">{entry.newStatus}</span>
                      </div>
                    )}
                    <p className="text-[12px] text-[#64748B]">{entry.remarks}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 py-4 border-t border-[#E2E8F0] flex flex-col gap-2">
          <div className="flex gap-2">
            {message.status === "Failed" && (
              <button
                onClick={() => onRetry(message)}
                className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
                style={{ backgroundColor: "#D97706" }}
              >
                <div className="w-4 h-4 flex items-center justify-center">
                  <RefreshCw size={15} />
                </div>
                Retry Failed Message
              </button>
            )}
            <button
              onClick={() => onDownload(message)}
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <Download size={15} />
              </div>
              Download Raw
            </button>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => onLinkAWB(message)}
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <FileText size={15} />
              </div>
              Link to AWB Detail
            </button>
            <button
              onClick={() => onMarkReviewed(message)}
              className="flex-1 h-10 flex items-center justify-center gap-2 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
              style={{ backgroundColor: "#0B2545" }}
            >
              <div className="w-4 h-4 flex items-center justify-center">
                <CheckCircle size={15} />
              </div>
              Mark Reviewed
            </button>
          </div>
        </div>
      </div>
    </>
  );
}