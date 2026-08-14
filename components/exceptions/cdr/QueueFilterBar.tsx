"use client";

/**
 * P3-1 · CDR workbench filters.
 *
 * The canonical workbench has none: it renders one selected CDR beautifully
 * and offers no way to choose which one. Five facets come across from the
 * legacy queue (owner, queue state, age band, cargo class, free text) and one
 * is new with BC-2.
 *
 * The origin facet is the one that earns its place twice over. `CDR.origin`
 * exists because `type` cannot separate the routes — intake variance and a
 * short pick both raise `shortage` — so "show me the dispatch-side CDRs" is a
 * question the type filter is structurally incapable of answering. The owner
 * facet is the second: with `raisedBy` alone there is no query that returns
 * the CDRs nobody has picked up.
 *
 * Owner and cargo-class options are derived from the rows in view rather than
 * listed here, so a new fixture owner appears in the dropdown by itself and a
 * dropdown can never offer a value that matches nothing.
 */

import { Clock, Filter, Layers, Search, Tag, User, X } from "lucide-react";
import { CDR_ORIGIN_LABEL, type CdrOrigin } from "@/lib/domain";
import {
  AGE_BANDS,
  AGE_BAND_LABEL,
  CDR_QUEUE_STATES,
  CDR_QUEUE_STATE_LABEL,
  EMPTY_QUEUE_FILTERS,
  activeQueueFilterCount,
  type AgeBand,
  type CdrQueueState,
  type QueueFilterState,
} from "./queueLayer";

const ORIGINS = Object.keys(CDR_ORIGIN_LABEL) as CdrOrigin[];

function Select({
  icon,
  value,
  options,
  onChange,
  title,
}: {
  icon: React.ReactNode;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (v: string) => void;
  title: string;
}) {
  return (
    <div className="relative min-w-[170px] flex-1 max-w-[260px]" title={title}>
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8] pointer-events-none">
        {icon}
      </div>
      <select
        aria-label={title}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-9 pl-9 pr-8 rounded-lg border border-[#E2E8F0] bg-white text-[12px] font-medium text-[#0F172A] cursor-pointer appearance-none outline-none focus:border-[#1B4F8B] transition-colors"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export default function QueueFilterBar({
  filters,
  onChange,
  owners,
  cargoClasses,
  showing,
  total,
}: {
  filters: QueueFilterState;
  onChange: (next: QueueFilterState) => void;
  owners: string[];
  cargoClasses: Array<{ abbr: string; name: string }>;
  showing: number;
  total: number;
}) {
  const set = <K extends keyof QueueFilterState>(key: K, value: QueueFilterState[K]) =>
    onChange({ ...filters, [key]: value });

  const activeCount = activeQueueFilterCount(filters);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-4 flex flex-col gap-3">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px] max-w-[340px] h-9 px-3 rounded-lg border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-[#1B4F8B] transition-colors">
          <Search size={14} className="text-[#94A3B8] flex-shrink-0" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set("search", e.target.value)}
            placeholder="Search CDR #, AWB #, HAWB or owner"
            className="flex-1 bg-transparent text-[12px] text-[#0F172A] outline-none"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => set("search", "")}
              className="w-5 h-5 flex items-center justify-center rounded-full hover:bg-[#E2E8F0] text-[#94A3B8] cursor-pointer"
            >
              <X size={11} />
            </button>
          )}
        </div>

        <Select
          title="Owner"
          icon={<User size={14} />}
          value={filters.owner}
          onChange={(v) => set("owner", v)}
          options={[
            { value: "all", label: "All owners" },
            ...owners.map((o) => ({ value: o, label: o })),
          ]}
        />

        <Select
          title="Queue status"
          icon={<Filter size={14} />}
          value={filters.queueState}
          onChange={(v) => set("queueState", v as CdrQueueState | "all")}
          options={[
            { value: "all", label: "All queue statuses" },
            ...CDR_QUEUE_STATES.map((s) => ({ value: s, label: CDR_QUEUE_STATE_LABEL[s] })),
          ]}
        />

        <Select
          title="Age"
          icon={<Clock size={14} />}
          value={filters.ageBand}
          onChange={(v) => set("ageBand", v as AgeBand)}
          options={AGE_BANDS.map((b) => ({ value: b, label: AGE_BAND_LABEL[b] }))}
        />

        <Select
          title="Cargo class"
          icon={<Tag size={14} />}
          value={filters.cargoClass}
          onChange={(v) => set("cargoClass", v)}
          options={[
            { value: "all", label: "All cargo classes" },
            ...cargoClasses.map((c) => ({ value: c.abbr, label: `${c.abbr} — ${c.name}` })),
          ]}
        />

        <Select
          title="Origin — which decision raised the CDR (BC-2)"
          icon={<Layers size={14} />}
          value={filters.origin}
          onChange={(v) => set("origin", v as CdrOrigin | "all")}
          options={[
            { value: "all", label: "Any origin" },
            ...ORIGINS.map((o) => ({ value: o, label: CDR_ORIGIN_LABEL[o] })),
          ]}
        />
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[12px] text-[#64748B]">
          {showing} of {total} CDRs
          {activeCount > 0 ? ` · ${activeCount} filter${activeCount === 1 ? "" : "s"} on` : ""}
        </span>
        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => onChange(EMPTY_QUEUE_FILTERS)}
            className="h-7 px-3 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            Clear all
          </button>
        )}
        {filters.origin !== "all" && (
          <span className="text-[11px] text-[#94A3B8]">
            Origin is not derivable from the discrepancy type — intake and picking both raise a
            shortage, which is why this facet exists.
          </span>
        )}
      </div>
    </div>
  );
}
