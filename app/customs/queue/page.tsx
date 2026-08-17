"use client";

/**
 * P4-2 · The customs work queue — one row per declaration in play.
 *
 * Relocated out of /excise-compliance/customs-queue, unchanged in substance.
 * The move is a portal correction, not a rewrite: this is a customs screen
 * for customs officers and it was sitting in a compliance module that no
 * longer exists as a portal.
 *
 * It is deliberately NOT the same screen as /customs/channels. That one is
 * master-detail — pick a declaration, read its channel treatment. This one
 * is the list you work FROM: every declaration filed today, filterable by
 * channel, CHA and cargo class, searchable across AWB / GD / CHA /
 * consignee, aged, and carrying the six actions an officer takes without
 * opening a record. A master-detail viewer cannot answer "which of Al-Huda's
 * yellow-channel pharma consignments has been sitting longest" — that is
 * what a queue is for, and why deleting this screen in favour of the viewer
 * would have removed a job rather than a duplicate.
 *
 * Mock-data only. The typed customs fixtures in lib/domain drive
 * /customs/channels; this screen keeps its own local rows because it
 * carries a cargo-class facet and an age-in-queue measure the typed
 * CustomsClearance record does not model yet.
 */

import { useEffect, useState, useMemo } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/components/ToastContext";
import KPIStrip from "@/components/customs/queue/KPIStrip";
import ChannelTabs from "@/components/customs/queue/ChannelTabs";
import FilterBar from "@/components/customs/queue/FilterBar";
import CustomsQueueTable from "@/components/customs/queue/CustomsQueueTable";
import ChannelSummaryCard from "@/components/customs/queue/ChannelSummaryCard";

const allRows = [
  { id: "1", awb: "214-45678901", gd: "GD-KHI-2026-00091", channel: "Yellow", filedAt: "31 May 2026 10:20", cha: "Al-Huda Clearing", consignee: "Al Noor Traders", age: "2h 15m", status: "Under Review", cargoClass: "General Cargo" },
  { id: "2", awb: "157-90811223", gd: "GD-KHI-2026-00092", channel: "Green", filedAt: "31 May 2026 09:45", cha: "Pak Gulf CHA", consignee: "Karachi Pharma Imports", age: "3h", status: "OOC Pending", cargoClass: "Pharma" },
  { id: "3", awb: "074-88219033", gd: "GD-KHI-2026-00093", channel: "Red", filedAt: "31 May 2026 11:00", cha: "Swift Clear Agency", consignee: "Metro Engineering", age: "1h 20m", status: "Exam Scheduled", cargoClass: "DG" },
  { id: "4", awb: "999-11223344", gd: "GD-KHI-2026-00094", channel: "Green", filedAt: "31 May 2026 08:30", cha: "United Customs", consignee: "Sindh Textile Mills", age: "5h 45m", status: "Released", cargoClass: "General Cargo" },
  { id: "5", awb: "111-55667788", gd: "GD-KHI-2026-00095", channel: "Yellow", filedAt: "31 May 2026 10:50", cha: "Al-Falah CHA", consignee: "Habib Auto Parts", age: "1h 45m", status: "Query", cargoClass: "General Cargo" },
  { id: "6", awb: "222-33445566", gd: "GD-KHI-2026-00096", channel: "Red", filedAt: "31 May 2026 09:15", cha: "Global Clearance", consignee: "Lahore Chemicals", age: "3h 30m", status: "Held", cargoClass: "DG" },
  { id: "7", awb: "333-77889900", gd: "GD-KHI-2026-00097", channel: "Green", filedAt: "31 May 2026 07:00", cha: "Pak Gulf CHA", consignee: "Faisal Edibles", age: "6h 30m", status: "OOC Issued", cargoClass: "Perishable" },
  { id: "8", awb: "444-22334455", gd: "GD-KHI-2026-00098", channel: "Yellow", filedAt: "31 May 2026 11:30", cha: "Al-Huda Clearing", consignee: "K-Electric Spares", age: "45m", status: "Filed", cargoClass: "Valuable" },
  { id: "9", awb: "555-66778899", gd: "GD-KHI-2026-00099", channel: "Red", filedAt: "31 May 2026 10:05", cha: "Swift Clear Agency", consignee: "Pakistan Oilfields", age: "2h 30m", status: "Examined", cargoClass: "DG" },
  { id: "10", awb: "666-00998877", gd: "GD-KHI-2026-00100", channel: "Green", filedAt: "31 May 2026 06:45", cha: "United Customs", consignee: "Nishat Mills", age: "7h 15m", status: "Released", cargoClass: "General Cargo" },
  { id: "11", awb: "777-44556677", gd: "GD-KHI-2026-00101", channel: "Yellow", filedAt: "31 May 2026 09:30", cha: "Al-Falah CHA", consignee: "Gul Ahmed Fabrics", age: "3h 45m", status: "Under Review", cargoClass: "General Cargo" },
  { id: "12", awb: "888-11224433", gd: "GD-KHI-2026-00102", channel: "Red", filedAt: "31 May 2026 08:00", cha: "Global Clearance", consignee: "Engro Chemicals", age: "5h 10m", status: "Held", cargoClass: "DG" },
];

export default function CustomsQueuePage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showError, setShowError] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [activeChannel, setActiveChannel] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ channel: "All", status: "All", cha: "All", cargoClass: "All" });
  const { addToast } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 1500);
    return () => clearTimeout(timer);
  }, []);

  const handleRetry = () => {
    setShowError(false);
    setIsLoading(true);
    setTimeout(() => setIsLoading(false), 1000);
  };

  // The channel tab and the channel dropdown are intentionally both live and
  // ANDed: the tab is the officer's working set, the dropdown is a narrowing
  // inside a saved filter. Collapsing them into one control loses the ability
  // to hold a tab while re-filtering.
  const filteredRows = useMemo(() => {
    let data = [...allRows];
    if (activeChannel !== "All") {
      data = data.filter((r) => r.channel === activeChannel);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (r) =>
          r.awb.toLowerCase().includes(q) ||
          r.gd.toLowerCase().includes(q) ||
          r.cha.toLowerCase().includes(q) ||
          r.consignee.toLowerCase().includes(q)
      );
    }
    if (filters.channel !== "All") {
      data = data.filter((r) => r.channel === filters.channel);
    }
    if (filters.status !== "All") {
      data = data.filter((r) => r.status === filters.status);
    }
    if (filters.cha !== "All") {
      data = data.filter((r) => r.cha === filters.cha);
    }
    if (filters.cargoClass !== "All") {
      data = data.filter((r) => r.cargoClass === filters.cargoClass);
    }
    return data;
  }, [activeChannel, searchQuery, filters]);

  // Tab counts read the unfiltered set on purpose — a tab that shows "0 Red"
  // because a CHA filter is on tells the officer nothing about the red queue.
  const channelCounts = useMemo(() => {
    return {
      All: allRows.length,
      Green: allRows.filter((r) => r.channel === "Green").length,
      Yellow: allRows.filter((r) => r.channel === "Yellow").length,
      Red: allRows.filter((r) => r.channel === "Red").length,
    };
  }, []);

  const greenCount = allRows.filter((r) => r.channel === "Green").length;
  const yellowCount = allRows.filter((r) => r.channel === "Yellow").length;
  const redCount = allRows.filter((r) => r.channel === "Red").length;

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + Title */}
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Customs" }, { label: "Customs Queue" }]} />
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M09
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                FC-06 · declarations in play
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
              Customs Queue
            </h1>
            <p className="text-[13px] text-[#64748B] mt-1">
              Every declaration filed and not yet released, aged and worked from the list.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => {
                setShowError(!showError);
                if (!showError) addToast("Error state simulated", "error");
              }}
              className="text-[12px] font-semibold text-[#1B4F8B] hover:text-[#0B2545] cursor-pointer transition-colors"
            >
              {showError ? "Hide Error" : "Simulate Error"}
            </button>
            <button
              onClick={() => {
                setShowEmpty(!showEmpty);
                if (!showEmpty) addToast("Empty state shown", "success");
              }}
              className="text-[12px] font-semibold text-[#1B4F8B] hover:text-[#0B2545] cursor-pointer transition-colors"
            >
              {showEmpty ? "Show Data" : "Simulate Empty"}
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      {showError ? (
        <ErrorState
          title="Customs data unavailable"
          message="WeBOC feed could not be refreshed. Last successful sync: 10:45 AM."
          onRetry={handleRetry}
        />
      ) : isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
              <div className="h-4 w-24 bg-[#F1F5F9] rounded animate-pulse mb-3" />
              <div className="h-8 w-16 bg-[#F1F5F9] rounded animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <KPIStrip />
      )}

      {/* Channel Tabs + Filter */}
      {!isLoading && !showError && (
        <div className="flex flex-col gap-4">
          <ChannelTabs active={activeChannel} onChange={setActiveChannel} counts={channelCounts} />
          <FilterBar onSearch={setSearchQuery} onFilterChange={setFilters} />
        </div>
      )}

      {/* Main Content */}
      {showEmpty ? (
        <EmptyState
          title="No customs records found for selected filters"
          description="Try adjusting your filters or search criteria. New declarations will appear automatically from WeBOC."
          actionLabel="Clear Filters"
          onAction={() => {
            setShowEmpty(false);
            setActiveChannel("All");
            setSearchQuery("");
            setFilters({ channel: "All", status: "All", cha: "All", cargoClass: "All" });
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="h-5 w-40 bg-[#F1F5F9] rounded animate-pulse mb-5" />
                <LoadingSkeleton rows={6} columns={8} />
              </div>
            ) : (
              <CustomsQueueTable rows={filteredRows} />
            )}
          </div>

          {/* Sidebar Cards */}
          <div className="flex flex-col gap-6">
            {isLoading ? (
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="h-5 w-32 bg-[#F1F5F9] rounded animate-pulse mb-4" />
                <div className="h-20 w-20 bg-[#F1F5F9] rounded-full animate-pulse mx-auto mb-4" />
                <div className="space-y-2">
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <ChannelSummaryCard green={greenCount} yellow={yellowCount} red={redCount} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}
