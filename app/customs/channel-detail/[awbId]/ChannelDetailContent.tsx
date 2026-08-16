"use client";

/**
 * P4-3b · Channel detail — the officer's working surface, client half.
 *
 * Every field the pre-slug screen carried is still here. What changed is
 * where the record comes from: the summary used to be a module-level const
 * (`sampleSummary`) with one hard-coded declaration, so every route into this
 * screen showed AWB 214-45678901 no matter which row had been clicked. The
 * server route now resolves `[awbId]` against the real fixtures and hands the
 * summary down — the same split `/awb/[awbId]` uses with `AwbHubContent`.
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
 * The old header comment justified the local const on the grounds that a
 * `CustomsClearance` does not model age-in-queue or cargo class. It does not —
 * but the AWB it points at models both, so the route reads the pair rather
 * than dropping two of the six header fields.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { useToast } from "@/components/ToastContext";
import Breadcrumb from "@/components/Breadcrumb";
import ErrorState from "@/components/ErrorState";
import AwbLink from "@/components/awb/AwbLink";
import SummaryCard from "@/components/customs/channel-detail/SummaryCard";
import ChannelSwitcher from "@/components/customs/channel-detail/ChannelSwitcher";
import GreenPanel from "@/components/customs/channel-detail/GreenPanel";
import YellowPanel from "@/components/customs/channel-detail/YellowPanel";
import RedPanel from "@/components/customs/channel-detail/RedPanel";
import TimelineCard from "@/components/customs/channel-detail/TimelineCard";

/** Exactly the shape `SummaryCard` consumes — the header's six-plus fields. */
export interface SummaryData {
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

interface Props {
  summary: SummaryData;
  /** The AWB the declaration belongs to — for the hub link. */
  awbId: number;
  /** Opens on the channel this declaration is actually on. */
  initialTab: "green" | "yellow" | "red";
}

export default function ChannelDetailContent({ summary, awbId, initialTab }: Props) {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<string>(initialTab);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

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
        <Breadcrumb
          items={[
            { label: "Customs", href: "/customs" },
            { label: "Channels & OOC", href: "/customs/channels" },
            { label: summary.awb },
          ]}
        />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M09
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-06 §04–08 · scrutiny recorded here
            </span>
          </div>
          <div className="flex items-end justify-between gap-3 flex-wrap mt-1.5">
            <div>
              <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight">
                Channel Detail
              </h1>
              <p className="text-[13px] text-[#64748B] mt-1">
                Record the document review, capture queries, and schedule the examination against{" "}
                <AwbLink awbNo={summary.awb} awbId={awbId} tab="customs" /> — {summary.gd}.
              </p>
            </div>
            <Link
              href="/customs/channels"
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              All declarations <ArrowUpRight size={12} />
            </Link>
          </div>
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

      <SummaryCard data={summary} />

      <ChannelSwitcher activeTab={activeTab} onChange={handleTabChange} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {activeTab === "green" && <GreenPanel awb={summary.awb} />}
          {activeTab === "yellow" && <YellowPanel awb={summary.awb} />}
          {activeTab === "red" && <RedPanel awb={summary.awb} />}
        </div>
        <div className="lg:col-span-1">
          <TimelineCard status={summary.status} />
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={handleSimulateError}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer transition-colors"
        >
          Simulate Error
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
