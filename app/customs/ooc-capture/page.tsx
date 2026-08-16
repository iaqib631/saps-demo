"use client";

/**
 * P4-3c · OOC capture — keying the out-of-charge when PSW is down.
 *
 * Relocated out of /excise-compliance/ooc-capture. This is not a duplicate of
 * /customs/channels: that screen *reads* an OOC and reconciles it, and its own
 * model already assumes a keyed one exists (`OutOfCharge.keyedAt`). Nothing
 * anywhere else can produce that value. When the gateway is down and no
 * scanner is available, this is the only path that gets cargo released — so
 * deleting it would have left the product with a field its own domain model
 * populates and no screen that writes it.
 *
 * `OutOfCharge.source` is therefore fixed at "keyed" on everything captured
 * here, by construction rather than by choice of dropdown. A record keyed off
 * a counter copy must not be able to badge itself as a gateway fetch.
 *
 * Mock-data only — see ./candidates.ts for why the local fixture is right
 * here rather than CUSTOMS_CLEARANCES.
 */

import { useState, useEffect } from "react";
import { useToast } from "@/components/ToastContext";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import SearchCard from "@/components/customs/ooc-capture/SearchCard";
import OOCFormCard from "@/components/customs/ooc-capture/OOCFormCard";
import RecentOOCTable from "@/components/customs/ooc-capture/RecentOOCTable";
import ReleaseReadinessPanel from "./ReleaseReadinessPanel";
import { OOC_CANDIDATES, type OocCandidate } from "./candidates";

const recentOOCs = [
  {
    id: "1",
    oocRef: "OOC-KHI-2026-00421",
    awb: "312-99887766",
    gd: "GD-KHI-2026-00087",
    channel: "Green",
    consignee: "Golden Gate Traders",
    issuedAt: "31 May 2026 09:30",
    recordedBy: "Ayesha Khan",
    releaseStatus: "Released",
  },
  {
    id: "2",
    oocRef: "OOC-KHI-2026-00420",
    awb: "147-22113344",
    gd: "GD-KHI-2026-00086",
    channel: "Yellow",
    consignee: "Rashid & Sons",
    issuedAt: "31 May 2026 08:45",
    recordedBy: "Imran Ali",
    releaseStatus: "Released",
  },
  {
    id: "3",
    oocRef: "OOC-KHI-2026-00419",
    awb: "089-55443322",
    gd: "GD-KHI-2026-00085",
    channel: "Green",
    consignee: "Pakistan Chemicals",
    issuedAt: "30 May 2026 16:20",
    recordedBy: "Ayesha Khan",
    releaseStatus: "Released",
  },
  {
    id: "4",
    oocRef: "OOC-KHI-2026-00418",
    awb: "256-77889900",
    gd: "GD-KHI-2026-00084",
    channel: "Red",
    consignee: "Heavy Industries Ltd",
    issuedAt: "30 May 2026 14:10",
    recordedBy: "Tariq Ahmed",
    releaseStatus: "Pending Release",
  },
  {
    id: "5",
    oocRef: "OOC-KHI-2026-00417",
    awb: "198-11223344",
    gd: "GD-KHI-2026-00083",
    channel: "Green",
    consignee: "Fresh Foods Intl",
    issuedAt: "30 May 2026 11:00",
    recordedBy: "Imran Ali",
    releaseStatus: "Released",
  },
  {
    id: "6",
    oocRef: "OOC-KHI-2026-00416",
    awb: "275-66778899",
    gd: "GD-KHI-2026-00082",
    channel: "Yellow",
    consignee: "MediCare Pakistan",
    issuedAt: "30 May 2026 09:15",
    recordedBy: "Ayesha Khan",
    releaseStatus: "Released",
  },
];

export default function CustomsOocCapturePage() {
  const { addToast } = useToast();
  const [selectedAWB, setSelectedAWB] = useState<OocCandidate | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);

  const filteredAWBs = OOC_CANDIDATES.filter(
    (a) =>
      a.awb.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.gd.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.consignee.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 800);
    return () => clearTimeout(timer);
  }, []);

  // SearchCard hands back only the fields it knows about, so the full
  // candidate — including the SD block the readiness panel reconciles
  // against — is resolved from the fixture by AWB number.
  const handleSelectAWB = (picked: { awb: string }) => {
    const full = OOC_CANDIDATES.find((c) => c.awb === picked.awb) ?? null;
    setSelectedAWB(full);
    setSearchQuery(picked.awb);
    setShowDropdown(false);
    addToast(`AWB ${picked.awb} selected`, "success");
  };

  const handleSimulateError = () => {
    setError(true);
    setTimeout(() => setError(false), 3000);
  };

  const handleRecordOOC = () => {
    addToast("OOC recorded and cargo released", "success");
  };

  const handleSaveDraft = () => {
    addToast("OOC draft saved", "success");
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <div>
          <div className="h-4 w-32 bg-[#F1F5F9] rounded animate-pulse mb-3" />
          <div className="h-8 w-56 bg-[#F1F5F9] rounded animate-pulse" />
        </div>
        <div className="h-32 bg-[#F1F5F9] rounded-2xl animate-pulse" />
        <div className="h-96 bg-[#F1F5F9] rounded-2xl animate-pulse" />
        <div className="h-56 bg-[#F1F5F9] rounded-2xl animate-pulse" />
        <div className="h-64 bg-[#F1F5F9] rounded-2xl animate-pulse" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Customs" }, { label: "OOC Capture" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M09
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-06 §08a-K · gateway-down fallback
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
              source = keyed
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            OOC Capture
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            Key the out-of-charge off the print when PSW cannot be reached — then reconcile it
            field-by-field against the declaration before anything is released.
          </p>
        </div>
      </div>

      {error && (
        <ErrorState
          title="Failed to load OOC data"
          message="Unable to fetch OOC records from the customs system."
          onRetry={() => {
            setError(false);
            addToast("Retrying OOC data load", "success");
          }}
        />
      )}

      <SearchCard
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        showDropdown={showDropdown}
        setShowDropdown={setShowDropdown}
        filteredAWBs={filteredAWBs}
        onSelect={handleSelectAWB}
        selectedAWB={selectedAWB}
      />

      {selectedAWB ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <OOCFormCard
              awb={selectedAWB}
              onRecordOOC={handleRecordOOC}
              onSaveDraft={handleSaveDraft}
            />
          </div>
          <div className="lg:col-span-1">
            <ReleaseReadinessPanel candidate={selectedAWB} />
          </div>
        </div>
      ) : (
        <EmptyState
          title="Select an AWB to record OOC"
          description="Search for an AWB or GD number to begin recording the Out of Charge clearance."
        />
      )}

      <RecentOOCTable rows={recentOOCs} />

      <div className="flex items-center gap-3">
        <button
          onClick={handleSimulateError}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold border border-[#DC2626]/30 text-[#DC2626] hover:bg-[#DC2626]/10 cursor-pointer transition-colors"
        >
          Simulate Error
        </button>
        <button
          onClick={() => addToast("OOC data refreshed", "success")}
          className="h-9 px-4 rounded-lg text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
          style={{ backgroundColor: "#0B2545" }}
        >
          Simulate Success
        </button>
      </div>
    </div>
  );
}
