"use client";

import { useMemo } from "react";

interface Message {
  id: string;
  type: string;
  status: string;
}

interface MessageTypeSummaryProps {
  messages: Message[];
}

export default function MessageTypeSummary({ messages }: MessageTypeSummaryProps) {
  const typeCounts = useMemo(() => {
    const counts: Record<string, { total: number; failed: number }> = {};
    messages.forEach((m) => {
      if (!counts[m.type]) counts[m.type] = { total: 0, failed: 0 };
      counts[m.type].total++;
      if (m.status === "Failed") counts[m.type].failed++;
    });
    return Object.entries(counts).sort((a, b) => b[1].total - a[1].total);
  }, [messages]);

  const total = messages.length;
  const failedTotal = messages.filter((m) => m.status === "Failed").length;
  const failureRate = total > 0 ? Math.round((failedTotal / total) * 100) : 0;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Message Type Summary</h2>
        </div>
      </div>
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[12px] text-[#64748B]">Overall failure rate</span>
            <div className="flex items-baseline gap-2 mt-1">
              <span className="text-[24px] font-bold text-[#0F172A]">{failureRate}%</span>
              <span className="text-[12px] text-[#64748B]">{failedTotal} of {total} failed</span>
            </div>
          </div>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center"
            style={{ backgroundColor: failureRate > 5 ? "#FEE2E2" : "#DCFCE7" }}
          >
            <span
              className="text-[14px] font-bold"
              style={{ color: failureRate > 5 ? "#DC2626" : "#16A34A" }}
            >
              {failureRate}%
            </span>
          </div>
        </div>

        <div className="space-y-3">
          {typeCounts.map(([type, { total, failed }]) => {
            const pct = total > 0 ? Math.round((total / messages.length) * 100) : 0;
            const failRate = total > 0 ? Math.round((failed / total) * 100) : 0;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[13px] font-semibold text-[#0F172A]">{type}</span>
                  <span className="text-[12px] text-[#64748B]">{total} msgs</span>
                </div>
                <div className="h-2 rounded-full bg-[#F1F5F9] overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: failRate > 0 ? "#D97706" : "#1B4F8B",
                    }}
                  />
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[11px] text-[#94A3B8]">{pct}% of total</span>
                  {failRate > 0 && (
                    <span className="text-[11px] font-medium text-[#DC2626]">{failRate}% failed</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}