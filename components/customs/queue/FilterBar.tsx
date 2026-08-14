"use client";

import { useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

interface FilterBarProps {
  onSearch: (query: string) => void;
  onFilterChange: (filters: Record<string, string>) => void;
}

export default function FilterBar({ onSearch, onFilterChange }: FilterBarProps) {
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<Record<string, string>>({
    channel: "All",
    status: "All",
    cha: "All",
    cargoClass: "All",
  });

  const handleSearchChange = (val: string) => {
    setSearch(val);
    onSearch(val);
  };

  const handleFilterChange = (key: string, val: string) => {
    const next = { ...filters, [key]: val };
    setFilters(next);
    onFilterChange(next);
  };

  const statusOptions = ["All", "Filed", "Under Review", "Query", "Exam Scheduled", "Examined", "OOC Pending", "OOC Issued", "Released", "Held"];
  const chaOptions = ["All", "Al-Huda Clearing", "Pak Gulf CHA", "Swift Clear Agency", "United Customs", "Al-Falah CHA", "Global Clearance"];
  const cargoClassOptions = ["All", "General Cargo", "Pharma", "Perishable", "DG", "Valuable", "Live Animals"];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 flex items-center justify-center">
            <Search size={16} className="text-[#94A3B8]" />
          </div>
          <input
            type="text"
            placeholder="Search AWB, GD, CHA, Consignee..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full h-10 pl-10 pr-4 rounded-xl border border-[#E2E8F0] bg-white text-[13px] text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:border-[#1B4F8B] focus:ring-1 focus:ring-[#1B4F8B]/20"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 flex items-center justify-center text-[#94A3B8] hover:text-[#64748B] cursor-pointer"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 h-10 px-4 rounded-xl border border-[#E2E8F0] bg-white text-[13px] font-semibold text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
        >
          <SlidersHorizontal size={16} />
          Filters
        </button>
      </div>

      {showFilters && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {statusOptions.map((s) => (
                <button
                  key={s}
                  onClick={() => handleFilterChange("status", s)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors border whitespace-nowrap"
                  style={{
                    backgroundColor: filters.status === s ? "#0B2545" : "white",
                    color: filters.status === s ? "white" : "#64748B",
                    borderColor: filters.status === s ? "#0B2545" : "#E2E8F0",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">CHA</label>
            <div className="flex flex-wrap gap-1.5">
              {chaOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => handleFilterChange("cha", c)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors border whitespace-nowrap"
                  style={{
                    backgroundColor: filters.cha === c ? "#0B2545" : "white",
                    color: filters.cha === c ? "white" : "#64748B",
                    borderColor: filters.cha === c ? "#0B2545" : "#E2E8F0",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Cargo Class</label>
            <div className="flex flex-wrap gap-1.5">
              {cargoClassOptions.map((c) => (
                <button
                  key={c}
                  onClick={() => handleFilterChange("cargoClass", c)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors border whitespace-nowrap"
                  style={{
                    backgroundColor: filters.cargoClass === c ? "#0B2545" : "white",
                    color: filters.cargoClass === c ? "white" : "#64748B",
                    borderColor: filters.cargoClass === c ? "#0B2545" : "#E2E8F0",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider">Channel</label>
            <div className="flex flex-wrap gap-1.5">
              {["All", "Green", "Yellow", "Red"].map((c) => (
                <button
                  key={c}
                  onClick={() => handleFilterChange("channel", c)}
                  className="h-7 px-2.5 rounded-lg text-[11px] font-medium cursor-pointer transition-colors border whitespace-nowrap"
                  style={{
                    backgroundColor: filters.channel === c ? "#0B2545" : "white",
                    color: filters.channel === c ? "white" : "#64748B",
                    borderColor: filters.channel === c ? "#0B2545" : "#E2E8F0",
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}