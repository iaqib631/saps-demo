import { FileText, CheckCircle, Truck, Clock, Package, Weight, User, Building, Tag } from "lucide-react";

interface SummaryData {
  awb: string;
  gd: string;
  channel: string;
  cha: string;
  consignee: string;
  filedAt: string;
  status: string;
  age: string;
  cargoClass: string;
  pieces: string;
  weight: string;
}

interface SummaryCardProps {
  data: SummaryData;
}

const channelConfig: Record<string, { bg: string; text: string; border: string }> = {
  Green: { bg: "#DCFCE7", text: "#16A34A", border: "#86EFAC" },
  Yellow: { bg: "#FEF3C7", text: "#D97706", border: "#FDE68A" },
  Red: { bg: "#FEE2E2", text: "#DC2626", border: "#FECACA" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  Filed: { bg: "#F1F5F9", text: "#64748B" },
  "Under Review": { bg: "#FEF3C7", text: "#D97706" },
  Query: { bg: "#FEE2E2", text: "#DC2626" },
  "Exam Scheduled": { bg: "#DBEAFE", text: "#1B4F8B" },
  Examined: { bg: "#F3E8FF", text: "#7C3AED" },
  "OOC Pending": { bg: "#FEF3C7", text: "#D97706" },
  "OOC Issued": { bg: "#DCFCE7", text: "#16A34A" },
  Released: { bg: "#DCFCE7", text: "#16A34A" },
  Held: { bg: "#FEE2E2", text: "#DC2626" },
};

export default function SummaryCard({ data }: SummaryCardProps) {
  const ch = channelConfig[data.channel] || channelConfig.Green;
  const st = statusConfig[data.status] || statusConfig.Filed;

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Customs Channel Summary</h2>
        </div>
        <div className="flex items-center gap-3">
          <span
            className="inline-flex items-center gap-1.5 h-7 px-3 rounded-lg text-[12px] font-semibold"
            style={{ backgroundColor: ch.bg, color: ch.text, border: `1px solid ${ch.border}` }}
          >
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: ch.text }} />
            {data.channel} Channel
          </span>
          <span
            className="inline-flex items-center h-7 px-3 rounded-lg text-[12px] font-semibold"
            style={{ backgroundColor: st.bg, color: st.text }}
          >
            {data.status}
          </span>
        </div>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#0B2545]/10 flex items-center justify-center flex-shrink-0">
              <FileText size={18} className="text-[#0B2545]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">AWB #</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.awb}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#1B4F8B]/10 flex items-center justify-center flex-shrink-0">
              <Tag size={18} className="text-[#1B4F8B]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">GD #</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.gd}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
              <User size={18} className="text-[#7C3AED]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">CHA</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.cha}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#D97706]/10 flex items-center justify-center flex-shrink-0">
              <Building size={18} className="text-[#D97706]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Consignee</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.consignee}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#64748B]/10 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-[#64748B]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Filed At</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.filedAt}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
              <Clock size={18} className="text-[#DC2626]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Age</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.age}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#2E75B6]/10 flex items-center justify-center flex-shrink-0">
              <Truck size={18} className="text-[#2E75B6]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Cargo Class</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.cargoClass}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
              <Package size={18} className="text-[#16A34A]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Pieces</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.pieces}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#4338CA]/10 flex items-center justify-center flex-shrink-0">
              <Weight size={18} className="text-[#4338CA]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Weight</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.weight}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
            <div className="w-9 h-9 rounded-lg bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
              <CheckCircle size={18} className="text-[#16A34A]" />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</p>
              <p className="text-[13px] font-bold text-[#0F172A]">{data.status}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}