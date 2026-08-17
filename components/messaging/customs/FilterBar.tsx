"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface FilterBarProps {
  onSearch: (q: string) => void;
  onFilterChange: (filters: Record<string, string>) => void;
}

const messageTypes = ["FFM", "FWB", "FHL", "NOTOC", "RCT", "AWD", "TFD", "RCF", "DEP", "TGC", "NFD", "DLV", "DIS", "ARR", "FIW"];
const directions = ["Inbound", "Outbound"];
const statuses = ["Sent", "Received", "Failed", "Pending", "Retrying", "Acknowledged"];
const airlines = ["Emirates", "Qatar Airways", "Turkish Cargo", "Pakistan International"];

export default function FilterBar({ onSearch, onFilterChange }: FilterBarProps) {
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [filters, setFilters] = useState({ type: "All", direction: "All", status: "All", airline: "All" });
  const [activeFilterCount, setActiveFilterCount] = useState(0);

  const handleSearch = (val: string) => {
    setQuery(val);
    onSearch(val);
  };

  const handleFilter = (key: string, val: string) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    onFilterChange(next);
    const count = Object.values(next).filter((v) => v !== "All").length;
    setActiveFilterCount(count);
  };

  const clearFilters = () => {
    const reset = { type: "All", direction: "All", status: "All", airline: "All" };
    setFilters(reset);
    setQuery("");
    setActiveFilterCount(0);
    onSearch("");
    onFilterChange(reset);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
            <Search size={16} className="text-[#94A3B8]" />
          </div>
          <input
            type="text"
            placeholder="Search by AWB #, message ID, reference #, or airline..."
            value={query}
            onChange={(e) => handleSearch(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1B4F8B] focus:ring-1 focus:ring-[#1B4F8B]/20 transition-all"
          />
          {query && (
            <button
              onClick={() => handleSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[13px] font-medium text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <SlidersHorizontal size={16} />
          </div>
          Filters
          {activeFilterCount > 0 && (
            <span className="h-5 px-1.5 rounded-full bg-[#0B2545] text-white text-[11px] font-bold flex items-center justify-center min-w-[20px]">
              {activeFilterCount}
            </span>
          )}
        </button>
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="h-10 px-3 rounded-xl border border-[#E2E8F0] bg-white text-[13px] font-medium text-[#DC2626] hover:bg-[#FEE2E2] cursor-pointer transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            <div className="w-4 h-4 flex items-center justify-center">
              <X size={14} />
            </div>
            Clear
          </button>
        )}
      </div>

      {expanded && (
        <div className="flex flex-wrap gap-3 p-4 rounded-xl border border-[#E2E8F0] bg-white">
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Message Type</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleFilter("type", "All")}
                className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.type === "All" ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
              >
                All
              </button>
              {messageTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => handleFilter("type", t)}
                  className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.type === t ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Direction</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleFilter("direction", "All")}
                className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.direction === "All" ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
              >
                All
              </button>
              {directions.map((d) => (
                <button
                  key={d}
                  onClick={() => handleFilter("direction", d)}
                  className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.direction === d ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleFilter("status", "All")}
                className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.status === "All" ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
              >
                All
              </button>
              {statuses.map((s) => (
                <button
                  key={s}
                  onClick={() => handleFilter("status", s)}
                  className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.status === s ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Airline</span>
            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => handleFilter("airline", "All")}
                className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.airline === "All" ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
              >
                All
              </button>
              {airlines.map((a) => (
                <button
                  key={a}
                  onClick={() => handleFilter("airline", a)}
                  className={`h-7 px-3 rounded-full text-[12px] font-medium cursor-pointer transition-colors whitespace-nowrap ${filters.airline === a ? "bg-[#0B2545] text-white" : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"}`}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}