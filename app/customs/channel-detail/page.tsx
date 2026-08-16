"use client";

/**
 * P4-3b · Channel detail — the officer's working surface.
 *
 * Relocated out of /excise-compliance/channel-detail with every field kept.
 * This is the screen where a customs scrutiny is actually *recorded*, and it
 * is the reason the relocation had to happen rather than a deletion:
 * /customs/channels is a read-only viewer of query and examination records,
 * so the pair is list → detail, viewer → workbench. Delete the workbench and
 * nothing in the product can raise a query or schedule an examination.
 *
 * The three panels are three different jobs, which is why they are three
 * components rather than one form with a channel switch:
 *   Green  → a 5-point readiness checklist before auto-release
 *   Yellow → the 9-item document review, plus query capture with a query
 *            reference, response notes, supporting documents and reviewer
 *            remarks
 *   Red    → examination scheduling — date, time, bay, officer, sample
 *            required and type, result tri-state, remarks, photo evidence
 *
 * Mock-data only, and the summary below is a local const rather than a
 * lib/domain fixture on purpose: the case-summary header carries age in
 * queue and cargo class against the declaration, neither of which the typed
 * CustomsClearance record models. Wiring it to a fixture would mean dropping
 * two of the six header fields.
 */

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastContext";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import SummaryCard from "@/components/customs/channel-detail/SummaryCard";
import ChannelSwitcher from "@/components/customs/channel-detail/ChannelSwitcher";
import GreenPanel from "@/components/customs/channel-detail/GreenPanel";
import YellowPanel from "@/components/customs/channel-detail/YellowPanel";
import RedPanel from "@/components/customs/channel-detail/RedPanel";
import TimelineCard from "@/components/customs/channel-detail/TimelineCard";

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

const sampleSummary: SummaryData = {
  awb: "214-45678901",
  gd: "GD-KHI-2026-00091",
  channel: "Yellow",
  cha: "Al-Huda Clearing",
  consignee: "Al Noor Traders",
  filedAt: "31 May 2026 10:20",
  status: "Under Review",
  age: "2h 15m",
  cargoClass: "General Cargo",
  pieces: "42",
  weight: "1,234.5 kg",
};

export default function CustomsChannelDetailPage() {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState("yellow");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selected, setSelected] = useState(true);

  const summaryData = selected ? sampleSummary : null;

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleSimulateError = () => {
    setError(true);
    setTimeout(() => setError(false), 3000);
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    const channelMap: Record<string, string> = {
      green: "Green",
      yellow: "Yellow",
      red: "Red",
    };
    addToast(`Switched to ${channelMap[tab]} Channel`, "success");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="h-4 w-32 bg-[#F1F5F9] rounded animate-pulse mb-3" />
          <div className="h-8 w-64 bg-[#F1F5F9] rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-[#F1F5F9] rounded-2xl animate-pulse" />
          ))}
        </div>
        <div className="h-64 bg-[#F1F5F9] rounded-2xl animate-pulse" />
        <div className="h-96 bg-[#F1F5F9] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Customs" }, { label: "Channel Detail" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M09
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-06 §04–08 · scrutiny recorded here
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Channel Detail
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Record the document review, capture queries, and schedule the examination against one
            declaration.
          </p>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Failed to load channel data"
          message="Unable to fetch channel details from the customs system."
          onRetry={() => {
            setError(false);
            addToast("Retrying channel data load", "success");
          }}
        />
      )}

      {!summaryData ? (
        <EmptyState
          title="Select an AWB to view channel detail"
          description="Navigate to the Customs Queue and select an AWB to review its channel-specific workflow."
        />
      ) : (
        <>
          <SummaryCard data={summaryData} />

          <ChannelSwitcher activeTab={activeTab} onChange={handleTabChange} />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              {activeTab === "green" && <GreenPanel awb={summaryData.awb} />}
              {activeTab === "yellow" && <YellowPanel awb={summaryData.awb} />}
              {activeTab === "red" && <RedPanel awb={summaryData.awb} />}
            </div>
            <div className="lg:col-span-1">
              <TimelineCard status={summaryData.status} />
            </div>
          </div>
        </>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={handleSimulateError}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer transition-colors"
        >
          Simulate Error
        </button>
        <button
          onClick={() => setSelected(!selected)}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-[#E2E8F0] text-[#475569] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          {selected ? "Simulate Empty" : "Show Declaration"}
        </button>
        <button
          onClick={() => addToast("Workflow updated successfully", "success")}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
          style={{ backgroundColor: "#0B2545" }}
        >
          Simulate Success
        </button>
      </div>
    </div>
  );
}
