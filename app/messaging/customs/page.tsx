"use client";

/**
 * Carrier message troubleshooting console — M07, FC-05.
 *
 * This screen used to live at `/excise-compliance/customs-messaging`, which
 * was a filing error rather than a design decision: nothing under `/customs/*`
 * renders an IATA message, and nothing on this screen touches a declaration,
 * a channel or an out-of-charge. It is a messaging screen, so it now sits in
 * the messaging block beside `/messaging/iata`.
 *
 * It is deliberately NOT a second copy of `/messaging/iata`. That console
 * answers the flight-level question — did every pre-arrival message for this
 * flight actually land, and is the manifest complete enough to index against.
 * This one answers the message-level question an operator asks at 3am when a
 * carrier's gateway is refusing traffic: which message, to which airline,
 * under which carrier reference, failed how many times, with what error, and
 * what does the raw payload actually say. Hence the dimensions the canonical
 * console has no field for at all — the AIRLINE (the canonical IataMessage
 * model carries no carrier), the carrier's own reference number, the retry
 * count, and the per-message audit trail.
 *
 * Two message types here sit outside FC-05's canonical thirteen: ARR (arrival)
 * and FIW (first wire). Both are real traffic on the Pakistani carriers' feeds
 * and both arrive before anything FC-05 models, so dropping them would make
 * the feed look cleaner than the wire actually is.
 *
 * Mock-data only: the airline / reference / retryCount / audit shape has no
 * counterpart in lib/domain, so the fixture stays local to this screen rather
 * than pretending the typed model already supports it.
 */

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import LoadingSkeleton from "@/components/LoadingSkeleton";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import { useToast } from "@/components/ToastContext";
import KPIStrip from "@/components/messaging/customs/KPIStrip";
import FilterBar from "@/components/messaging/customs/FilterBar";
import MessageTable from "@/components/messaging/customs/MessageTable";
import MessageTypeSummary from "@/components/messaging/customs/MessageTypeSummary";
import DetailDrawer from "@/components/messaging/customs/DetailDrawer";

const allMessages = [
  { id: "MSG-2026-00101", awb: "214-45678901", type: "FWB", direction: "Inbound", airline: "Emirates", reference: "EK-FWB-9912", sentAt: "31 May 2026 08:45", status: "Received", linkedEvent: "Master AWB", errorMsg: "", retryCount: 0, parsedFields: "MAWB: 214-45678901, Origin: DXB, Dest: KHI, Pieces: 24, Weight: 1240kg", rawPreview: "FFM/12\n214-45678901KHI1240.0\n...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 08:45", oldStatus: "-", newStatus: "Received", remarks: "Auto-processed from Emirates EDI feed" }] },
  { id: "MSG-2026-00102", awb: "214-45678901", type: "RCF", direction: "Outbound", airline: "Emirates", reference: "EK-RCF-4412", sentAt: "31 May 2026 09:30", status: "Sent", linkedEvent: "Received from Flight", errorMsg: "", retryCount: 0, parsedFields: "Flight: EK602, Date: 31May, RCF Time: 09:30", rawPreview: "RCF/7\nEK602/31MayKHI\n214-45678901KHI...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 09:30", oldStatus: "-", newStatus: "Sent", remarks: "Auto-generated upon flight arrival" }] },
  { id: "MSG-2026-00103", awb: "157-90811223", type: "NFD", direction: "Outbound", airline: "Qatar Airways", reference: "QR-NFD-7821", sentAt: "31 May 2026 10:15", status: "Acknowledged", linkedEvent: "Notified for Delivery", errorMsg: "", retryCount: 0, parsedFields: "Consignee: Karachi Pharma Imports, Contact: +92-21-34567890", rawPreview: "NFD/5\n157-90811223KHI\nKarachi Pharma Imports...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 10:15", oldStatus: "-", newStatus: "Sent", remarks: "Consignee notification dispatched" }, { action: "Acknowledged", user: "Qatar Airways", timestamp: "31 May 2026 10:16", oldStatus: "Sent", newStatus: "Acknowledged", remarks: "ACK received from QR hub" }] },
  { id: "MSG-2026-00104", awb: "074-88219033", type: "DIS", direction: "Outbound", airline: "Turkish Cargo", reference: "TK-DIS-2190", sentAt: "31 May 2026 11:20", status: "Failed", linkedEvent: "Discrepancy", errorMsg: "Connection timeout to Turkish Cargo API gateway", retryCount: 3, parsedFields: "Discrepancy Code: WGT, Expected: 680kg, Actual: 720kg", rawPreview: "DIS/8\n074-88219033KHI\nWGT/680.0/720.0...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 11:20", oldStatus: "-", newStatus: "Sent", remarks: "Discrepancy message queued" }, { action: "Failed", user: "System", timestamp: "31 May 2026 11:21", oldStatus: "Sent", newStatus: "Failed", remarks: "Connection timeout after 3 retries" }] },
  { id: "MSG-2026-00105", awb: "214-45678901", type: "FFM", direction: "Inbound", airline: "Emirates", reference: "EK-FFM-3341", sentAt: "31 May 2026 07:30", status: "Received", linkedEvent: "Flight Manifest", errorMsg: "", retryCount: 0, parsedFields: "Flight: EK602, Origin: DXB, Dest: KHI, AWBs: 12", rawPreview: "FFM/12\nEK602/31May/DXB/KHI\n...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 07:30", oldStatus: "-", newStatus: "Received", remarks: "Flight manifest received from Emirates" }] },
  { id: "MSG-2026-00106", awb: "333-77889900", type: "FHL", direction: "Inbound", airline: "Pakistan International", reference: "PK-FHL-5567", sentAt: "31 May 2026 06:45", status: "Received", linkedEvent: "House AWB", errorMsg: "", retryCount: 0, parsedFields: "HAWB: HBL-2091, Shipper: Faisal Edibles, Consignee: Metro Grocers", rawPreview: "FHL/6\n333-77889900KHI\nHBL-2091...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 06:45", oldStatus: "-", newStatus: "Received", remarks: "House AWB data from PIA" }] },
  { id: "MSG-2026-00107", awb: "555-66778899", type: "NOTOC", direction: "Inbound", airline: "Emirates", reference: "EK-NOTOC-8821", sentAt: "31 May 2026 07:15", status: "Received", linkedEvent: "Dangerous Goods", errorMsg: "", retryCount: 0, parsedFields: "UN Number: UN1993, Class: 3, PG: II, Pieces: 16", rawPreview: "NOTOC/9\nEK602/31May/DXB/KHI\nUN1993/3/II/16...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 07:15", oldStatus: "-", newStatus: "Received", remarks: "DG notification from flight crew" }] },
  { id: "MSG-2026-00108", awb: "157-90811223", type: "RCT", direction: "Outbound", airline: "Qatar Airways", reference: "QR-RCT-9901", sentAt: "31 May 2026 09:00", status: "Sent", linkedEvent: "Ready for Carriage", errorMsg: "", retryCount: 0, parsedFields: "Ready for Carriage confirmed, customs cleared", rawPreview: "RCT/4\n157-90811223KHI\n...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 09:00", oldStatus: "-", newStatus: "Sent", remarks: "RCT sent to QR upon customs release" }] },
  { id: "MSG-2026-00109", awb: "999-11223344", type: "TFD", direction: "Outbound", airline: "Pakistan International", reference: "PK-TFD-1123", sentAt: "31 May 2026 08:00", status: "Acknowledged", linkedEvent: "Transfer to Domestic", errorMsg: "", retryCount: 0, parsedFields: "Transfer to: Domestic warehouse, Route: KHI-LHE", rawPreview: "TFD/5\n999-11223344KHI\nLHE...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 08:00", oldStatus: "-", newStatus: "Sent", remarks: "Transfer request initiated" }, { action: "Acknowledged", user: "PIA", timestamp: "31 May 2026 08:01", oldStatus: "Sent", newStatus: "Acknowledged", remarks: "Transfer confirmed" }] },
  { id: "MSG-2026-00110", awb: "111-55667788", type: "AWD", direction: "Inbound", airline: "Turkish Cargo", reference: "TK-AWD-4456", sentAt: "31 May 2026 10:30", status: "Received", linkedEvent: "AWB Data", errorMsg: "", retryCount: 0, parsedFields: "AWD: AWB issued, Shipper: Istanbul Textile, Consignee: Al Noor Traders", rawPreview: "AWD/6\n111-55667788KHI\n...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 10:30", oldStatus: "-", newStatus: "Received", remarks: "AWD data from Turkish Cargo" }] },
  { id: "MSG-2026-00111", awb: "222-33445566", type: "DEP", direction: "Outbound", airline: "Emirates", reference: "EK-DEP-7788", sentAt: "31 May 2026 05:00", status: "Sent", linkedEvent: "Departed", errorMsg: "", retryCount: 0, parsedFields: "Flight: EK602, Departure: DXB 04:30, Arrival: KHI 09:30", rawPreview: "DEP/4\nEK602/31May/DXB/KHI\n...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 05:00", oldStatus: "-", newStatus: "Sent", remarks: "Departure message to ground handlers" }] },
  { id: "MSG-2026-00112", awb: "444-22334455", type: "TGC", direction: "Outbound", airline: "Qatar Airways", reference: "QR-TGC-2234", sentAt: "31 May 2026 11:00", status: "Pending", linkedEvent: "Transfer to Customs", errorMsg: "", retryCount: 0, parsedFields: "Transfer to WeBOC: GD-KHI-2026-00098", rawPreview: "TGC/5\n444-22334455KHI\nGD-KHI-2026-00098...", audit: [{ action: "Queued", user: "System", timestamp: "31 May 2026 11:00", oldStatus: "-", newStatus: "Pending", remarks: "Awaiting customs system availability" }] },
  { id: "MSG-2026-00113", awb: "666-00998877", type: "FIW", direction: "Inbound", airline: "Pakistan International", reference: "PK-FIW-6677", sentAt: "31 May 2026 07:45", status: "Received", linkedEvent: "First Wire", errorMsg: "", retryCount: 0, parsedFields: "Wire: First advice, Origin: ISB, AWB: 666-00998877", rawPreview: "FIW/4\n666-00998877KHI\nISB...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 07:45", oldStatus: "-", newStatus: "Received", remarks: "First wire from Islamabad" }] },
  { id: "MSG-2026-00114", awb: "888-11224433", type: "DLV", direction: "Outbound", airline: "Turkish Cargo", reference: "TK-DLV-9900", sentAt: "31 May 2026 12:00", status: "Retrying", linkedEvent: "Delivered", errorMsg: "WeBOC API rate limit exceeded", retryCount: 2, parsedFields: "Delivery: Consignee collected, Pieces: 16, Weight: 680kg", rawPreview: "DLV/6\n888-11224433KHI\n...", audit: [{ action: "Sent", user: "System", timestamp: "31 May 2026 12:00", oldStatus: "-", newStatus: "Sent", remarks: "Delivery message queued" }, { action: "Retrying", user: "System", timestamp: "31 May 2026 12:01", oldStatus: "Sent", newStatus: "Retrying", remarks: "Rate limit hit, retry 2 of 5" }] },
  { id: "MSG-2026-00115", awb: "777-44556677", type: "ARR", direction: "Inbound", airline: "Qatar Airways", reference: "QR-ARR-3344", sentAt: "31 May 2026 09:45", status: "Received", linkedEvent: "Arrival", errorMsg: "", retryCount: 0, parsedFields: "Flight: QR614, Arrived: 09:45, Origin: DOH", rawPreview: "ARR/4\nQR614/31May/DOH/KHI\n...", audit: [{ action: "Received", user: "System", timestamp: "31 May 2026 09:45", oldStatus: "-", newStatus: "Received", remarks: "Arrival confirmation from Qatar" }] },
];

export default function CustomsMessagingPage() {
  const [isLoading, setIsLoading] = useState(true);
  const [showError, setShowError] = useState(false);
  const [showEmpty, setShowEmpty] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filters, setFilters] = useState<Record<string, string>>({ type: "All", direction: "All", status: "All", airline: "All" });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<typeof allMessages[0] | null>(null);
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

  const filteredMessages = useMemo(() => {
    let data = [...allMessages];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      data = data.filter(
        (m) =>
          m.awb.toLowerCase().includes(q) ||
          m.id.toLowerCase().includes(q) ||
          m.reference.toLowerCase().includes(q) ||
          m.airline.toLowerCase().includes(q)
      );
    }
    if (filters.type !== "All") data = data.filter((m) => m.type === filters.type);
    if (filters.direction !== "All") data = data.filter((m) => m.direction === filters.direction);
    if (filters.status !== "All") data = data.filter((m) => m.status === filters.status);
    if (filters.airline !== "All") data = data.filter((m) => m.airline === filters.airline);
    return data;
  }, [searchQuery, filters]);

  const handleViewMessage = (msg: typeof allMessages[0]) => {
    setSelectedMessage(msg);
    setDrawerOpen(true);
  };

  const handleRetryMessage = (msg: typeof allMessages[0]) => {
    addToast(`Message retry queued for ${msg.id}`, "success");
  };

  const handleDownloadRaw = (msg: typeof allMessages[0]) => {
    addToast(`Raw message downloaded for ${msg.id}`, "success");
  };

  const handleLinkToAWB = (msg: typeof allMessages[0]) => {
    addToast(`Navigating to AWB ${msg.awb}`, "success");
  };

  const handleMarkReviewed = (msg: typeof allMessages[0]) => {
    addToast(`Message ${msg.id} marked as reviewed`, "success");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumb + Title */}
      <div className="flex flex-col gap-3">
        <Breadcrumb
          items={[
            { label: "Messaging" },
            { label: "Customs Messaging Console" },
          ]}
        />
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                M07
              </span>
              <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
                FC-05 · carrier feed troubleshooting
              </span>
            </div>
            <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-[32px] lg:leading-[40px]">
              Customs Messaging Console
            </h1>
            <p className="text-[13px] text-[#64748B]">
              Every message on the wire, per airline and per carrier reference — with the retry
              count, the gateway error and the raw payload behind it.
            </p>
          </div>
          <div className="flex items-center gap-2">
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
          title="Message feed unavailable"
          message="IATA message broker could not be reached. Last successful sync: 10:45 AM."
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

      {/* Filter Bar */}
      {!isLoading && !showError && (
        <FilterBar onSearch={setSearchQuery} onFilterChange={setFilters} />
      )}

      {/* Main Content */}
      {showEmpty ? (
        <EmptyState
          title="No messages found for selected filters"
          description="Try adjusting your filters or search criteria. New IATA messages will appear automatically from the message broker."
          actionLabel="Clear Filters"
          onAction={() => {
            setShowEmpty(false);
            setSearchQuery("");
            setFilters({ type: "All", direction: "All", status: "All", airline: "All" });
          }}
        />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Table */}
          <div className="lg:col-span-3">
            {isLoading ? (
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="h-5 w-40 bg-[#F1F5F9] rounded animate-pulse mb-5" />
                <LoadingSkeleton rows={6} columns={9} />
              </div>
            ) : (
              <MessageTable
                messages={filteredMessages}
                onView={handleViewMessage}
                onRetry={handleRetryMessage}
                onDownload={handleDownloadRaw}
                onLinkAWB={handleLinkToAWB}
                onMarkReviewed={handleMarkReviewed}
              />
            )}
          </div>

          {/* Sidebar Cards */}
          <div className="flex flex-col gap-6">
            {isLoading ? (
              <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
                <div className="h-5 w-32 bg-[#F1F5F9] rounded animate-pulse mb-4" />
                <div className="space-y-3">
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                  <div className="h-4 w-full bg-[#F1F5F9] rounded animate-pulse" />
                </div>
              </div>
            ) : (
              <MessageTypeSummary messages={allMessages} />
            )}
          </div>
        </div>
      )}

      {/* Detail Drawer */}
      <DetailDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        message={selectedMessage}
        onRetry={handleRetryMessage}
        onDownload={handleDownloadRaw}
        onLinkAWB={handleLinkToAWB}
        onMarkReviewed={handleMarkReviewed}
      />

      {/*
        Drill-back references, not onward steps. The flight-level view of the
        same spine lives on the IATA console; the customer-facing half lives on
        the notification engine.
      */}
      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/messaging/iata"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          IATA Cargo-IMP console — pre-arrival completeness per flight <ArrowUpRight size={12} />
        </Link>
        <Link
          href="/messaging/notifications"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          Notification engine <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
