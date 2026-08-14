"use client";

/**
 * P3-6 · Long-stay register filters.
 *
 * Ported from the legacy compliance register, which is the only place these
 * six facets have ever existed. The canonical screen ships no filters, which
 * works while the register holds one case and stops working the moment it
 * holds a hundred: a compliance officer works one consignee, one cargo class
 * or one customs decision at a time, and "scroll until you find it" is not a
 * filter.
 *
 * Stage is chipped by its C-number rather than its full label — the labels run
 * to seven words each ("C1. Not cleared after allowed period") and would wrap
 * a filter row into a paragraph. The full label stays on the tooltip and on
 * the register row.
 */

import { Search, SlidersHorizontal, X } from "lucide-react";
import { LONGSTAY_STAGE_LABEL, type LongStayStage } from "@/lib/domain";
import {
  CUSTOMS_DECISIONS,
  CUSTOMS_DECISION_LABEL,
  EMPTY_CASE_FILTERS,
  NOTICE_STATUSES,
  NOTICE_STATUS_LABEL,
  activeCaseFilterCount,
  type CaseFilterState,
} from "./caseFile";

const STAGES = Object.keys(LONGSTAY_STAGE_LABEL) as LongStayStage[];

function Chip({
  label,
  title,
  active,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="h-7 px-3 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors whitespace-nowrap border"
      style={{
        backgroundColor: active ? "#EBF0F7" : "#F8FAFC",
        color: active ? "#0B2545" : "#64748B",
        borderColor: active ? "#0B2545" : "#E2E8F0",
      }}
    >
      {label}
    </button>
  );
}

function TextFilter({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  type?: "text" | "number";
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B] transition-colors"
      />
    </div>
  );
}

export default function CaseFilterBar({
  filters,
  onChange,
  expanded,
  onToggleExpanded,
  showing,
  total,
}: {
  filters: CaseFilterState;
  onChange: (next: CaseFilterState) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  showing: number;
  total: number;
}) {
  const set = <K extends keyof CaseFilterState>(key: K, value: CaseFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount = activeCaseFilterCount(filters);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-[400px] h-10 px-4 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#1B4F8B] transition-colors">
          <Search size={16} className="text-[#94A3B8] flex-shrink-0" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search case #, AWB or HAWB"
            className="flex-1 bg-transparent text-[13px] text-[#0F172A] outline-none"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set("search", "")}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E2E8F0] text-[#94A3B8] cursor-pointer"
            >
              <X size={12} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onToggleExpanded}
          className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold border cursor-pointer transition-colors"
          style={{
            borderColor: expanded ? "#1B4F8B" : "#E2E8F0",
            color: expanded ? "#1B4F8B" : "#64748B",
            backgroundColor: expanded ? "#EBF0F7" : "#FFFFFF",
          }}
        >
          <SlidersHorizontal size={15} />
          Filters
          {activeCount > 0 && (
            <span className="w-5 h-5 rounded-full bg-[#1B4F8B] text-white text-[10px] font-bold flex items-center justify-center">
              {activeCount}
            </span>
          )}
        </button>

        <span className="text-[12px] text-[#64748B] ml-auto">
          {showing} of {total} cases
        </span>
      </div>

      {expanded && (
        <div className="px-5 pb-5 border-t border-[#E2E8F0] pt-4 flex flex-col gap-4">
          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Notice status
            </label>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="All"
                active={filters.noticeStatus === "all"}
                onClick={() => set("noticeStatus", "all")}
              />
              {NOTICE_STATUSES.map((s) => (
                <Chip
                  key={s}
                  label={NOTICE_STATUS_LABEL[s]}
                  active={filters.noticeStatus === s}
                  onClick={() => set("noticeStatus", s)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Current stage
            </label>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="All"
                active={filters.stage === "all"}
                onClick={() => set("stage", "all")}
              />
              {STAGES.map((s) => (
                <Chip
                  key={s}
                  label={s.split("-")[0].toUpperCase()}
                  title={LONGSTAY_STAGE_LABEL[s]}
                  active={filters.stage === s}
                  onClick={() => set("stage", s)}
                />
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-1.5">
              Customs decision
            </label>
            <div className="flex flex-wrap gap-1.5">
              <Chip
                label="All"
                active={filters.customsDecision === "all"}
                onClick={() => set("customsDecision", "all")}
              />
              {CUSTOMS_DECISIONS.map((d) => (
                <Chip
                  key={d}
                  label={CUSTOMS_DECISION_LABEL[d]}
                  active={filters.customsDecision === d}
                  onClick={() => set("customsDecision", d)}
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            <TextFilter
              label="Consignee"
              value={filters.consignee}
              placeholder="Filter by consignee"
              onChange={(v) => set("consignee", v)}
            />
            <TextFilter
              label="Days in storage (min)"
              value={filters.minDwellDays}
              placeholder="Min days"
              type="number"
              onChange={(v) => set("minDwellDays", v)}
            />
            <TextFilter
              label="Cargo class"
              value={filters.cargoClass}
              placeholder="Abbreviation or name"
              onChange={(v) => set("cargoClass", v)}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={() => onChange(EMPTY_CASE_FILTERS)}
                className="h-9 px-4 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
              >
                Clear all
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
