"use client";

interface ChannelSummaryCardProps {
  green: number;
  yellow: number;
  red: number;
}

export default function ChannelSummaryCard({ green, yellow, red }: ChannelSummaryCardProps) {
  const total = green + yellow + red;
  const greenPct = total ? (green / total) * 100 : 0;
  const yellowPct = total ? (yellow / total) * 100 : 0;
  const redPct = total ? (red / total) * 100 : 0;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
      <div className="flex items-center gap-2.5 mb-4">
        <h2 className="text-[15px] font-bold text-[#0F172A]">Channel Breakdown</h2>
      </div>

      <div className="flex items-center gap-4 mb-5">
        <div className="relative w-20 h-20">
          <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
            <circle cx="18" cy="18" r="15.9" fill="none" stroke="#E2E8F0" strokeWidth="3" />
            {total > 0 && (
              <>
                <circle
                  cx="18" cy="18" r="15.9" fill="none" stroke="#16A34A" strokeWidth="3"
                  strokeDasharray={`${greenPct} ${100 - greenPct}`}
                  strokeDashoffset={0}
                  strokeLinecap="round"
                />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" stroke="#D97706" strokeWidth="3"
                  strokeDasharray={`${yellowPct} ${100 - yellowPct}`}
                  strokeDashoffset={-greenPct}
                  strokeLinecap="round"
                />
                <circle
                  cx="18" cy="18" r="15.9" fill="none" stroke="#DC2626" strokeWidth="3"
                  strokeDasharray={`${redPct} ${100 - redPct}`}
                  strokeDashoffset={-(greenPct + yellowPct)}
                  strokeLinecap="round"
                />
              </>
            )}
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-[14px] font-bold text-[#0F172A]">{total}</span>
          </div>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#16A34A]" />
            <span className="text-[13px] font-medium text-[#475569]">Green</span>
            <span className="text-[13px] font-bold text-[#0F172A] ml-auto">{green}</span>
            <span className="text-[11px] text-[#64748B]">({greenPct.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#D97706]" />
            <span className="text-[13px] font-medium text-[#475569]">Yellow</span>
            <span className="text-[13px] font-bold text-[#0F172A] ml-auto">{yellow}</span>
            <span className="text-[11px] text-[#64748B]">({yellowPct.toFixed(0)}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-[#DC2626]" />
            <span className="text-[13px] font-medium text-[#475569]">Red</span>
            <span className="text-[13px] font-bold text-[#0F172A] ml-auto">{red}</span>
            <span className="text-[11px] text-[#64748B]">({redPct.toFixed(0)}%)</span>
          </div>
        </div>
      </div>
    </div>
  );
}