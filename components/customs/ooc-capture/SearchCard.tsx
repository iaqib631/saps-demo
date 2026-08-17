"use client";
import { Search, FileText, Tag, Truck, User, Building, Package, Weight, CheckCircle, Clock, Lock, X, ChevronDown } from "lucide-react";

interface AwbSummary {
  awb: string;
  gd: string;
  channel: string;
  cha: string;
  consignee: string;
  cargoClass: string;
  pieces: string;
  weight: string;
  status: string;
  holdStatus: string;
}

interface SearchCardProps {
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  showDropdown: boolean;
  setShowDropdown: (v: boolean) => void;
  filteredAWBs: AwbSummary[];
  onSelect: (awb: AwbSummary) => void;
  selectedAWB: AwbSummary | null;
}

const channelConfig: Record<string, { bg: string; text: string }> = {
  Green: { bg: "#DCFCE7", text: "#16A34A" },
  Yellow: { bg: "#FEF3C7", text: "#D97706" },
  Red: { bg: "#FEE2E2", text: "#DC2626" },
};

const statusConfig: Record<string, { bg: string; text: string }> = {
  "OOC Pending": { bg: "#FEF3C7", text: "#D97706" },
  Examined: { bg: "#F3E8FF", text: "#7C3AED" },
  Released: { bg: "#DCFCE7", text: "#16A34A" },
  Held: { bg: "#FEE2E2", text: "#DC2626" },
};

export default function SearchCard({
  searchQuery,
  setSearchQuery,
  showDropdown,
  setShowDropdown,
  filteredAWBs,
  onSelect,
  selectedAWB,
}: SearchCardProps) {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="text-[15px] font-bold text-[#0F172A]">Select AWB / GD</h2>
      </div>

      <div className="p-5">
        <div className="relative max-w-[480px] mb-5">
          <div className="flex items-center gap-2 h-11 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#1B4F8B] transition-colors">
            <Search size={16} className="text-[#94A3B8] flex-shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
              }}
              onFocus={() => setShowDropdown(true)}
              placeholder="Search AWB #, GD #, or consignee"
              className="flex-1 bg-transparent text-[13px] text-[#0F172A] outline-none"
            />
            {searchQuery && (
              <button
                onClick={() => {
                  setSearchQuery("");
                  setShowDropdown(false);
                }}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-[#E2E8F0] text-[#94A3B8] cursor-pointer transition-colors"
              >
                <X size={14} />
              </button>
            )}
            <ChevronDown size={16} className="text-[#94A3B8]" />
          </div>

          {showDropdown && searchQuery && filteredAWBs.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-[#E2E8F0] bg-white shadow-lg z-30 overflow-hidden">
              {filteredAWBs.map((awb) => (
                <button
                  key={awb.awb}
                  onClick={() => onSelect(awb)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#F8FAFC] cursor-pointer transition-colors border-b border-[#F1F5F9] last:border-0"
                >
                  <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: channelConfig[awb.channel]?.text || "#64748B" }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-[13px] font-bold text-[#0B2545]">{awb.awb}</span>
                      <span className="text-[11px] text-[#94A3B8]">{awb.gd}</span>
                    </div>
                    <p className="text-[12px] text-[#64748B] truncate">{awb.consignee} / {awb.cha}</p>
                  </div>
                  <span
                    className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-semibold flex-shrink-0"
                    style={{
                      backgroundColor: statusConfig[awb.status]?.bg || "#F1F5F9",
                      color: statusConfig[awb.status]?.text || "#64748B",
                    }}
                  >
                    {awb.status}
                  </span>
                </button>
              ))}
            </div>
          )}

          {showDropdown && searchQuery && filteredAWBs.length === 0 && (
            <div className="absolute top-full left-0 right-0 mt-2 rounded-xl border border-[#E2E8F0] bg-white shadow-lg z-30 p-4 text-center">
              <p className="text-[13px] text-[#64748B]">No AWBs found</p>
            </div>
          )}
        </div>

        {selectedAWB && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#0B2545]/10 flex items-center justify-center flex-shrink-0">
                <FileText size={16} className="text-[#0B2545]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">AWB #</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.awb}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#1B4F8B]/10 flex items-center justify-center flex-shrink-0">
                <Tag size={16} className="text-[#1B4F8B]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">GD #</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.gd}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#2E75B6]/10 flex items-center justify-center flex-shrink-0">
                <Truck size={16} className="text-[#2E75B6]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Channel</p>
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: channelConfig[selectedAWB.channel]?.text }} />
                  <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.channel}</p>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#7C3AED]/10 flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-[#7C3AED]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">CHA</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.cha}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#D97706]/10 flex items-center justify-center flex-shrink-0">
                <Building size={16} className="text-[#D97706]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Consignee</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.consignee}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#2E75B6]/10 flex items-center justify-center flex-shrink-0">
                <Truck size={16} className="text-[#2E75B6]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Cargo Class</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.cargoClass}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
                <Package size={16} className="text-[#16A34A]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Pieces</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.pieces}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#4338CA]/10 flex items-center justify-center flex-shrink-0">
                <Weight size={16} className="text-[#4338CA]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Weight</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.weight}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#16A34A]/10 flex items-center justify-center flex-shrink-0">
                <CheckCircle size={16} className="text-[#16A34A]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Current Status</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.status}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <div className="w-8 h-8 rounded-lg bg-[#DC2626]/10 flex items-center justify-center flex-shrink-0">
                <Lock size={16} className="text-[#DC2626]" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Hold Status</p>
                <p className="text-[13px] font-bold text-[#0F172A]">{selectedAWB.holdStatus}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}