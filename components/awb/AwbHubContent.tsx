"use client";

/**
 * P0-3 · AWB hub shell.
 *
 * Summary + FC-01 lifecycle bar + cross-module action rail + tabs.
 * FC-12 draws M03 as the hub feeding eight modules; the action rail is
 * that wiring made clickable.
 */

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  FileText,
  Receipt,
  ScanLine,
  ShieldAlert,
  Truck,
  Warehouse,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import LifecycleBar from "@/components/awb-detail/LifecycleBar";
import StatusBadge from "@/components/StatusBadge";
import { AgingBadge } from "@/components/primitives";
import {
  AuditPanel,
  ChargesPanel,
  CustomsPanel,
  DispatchPanel,
  ExceptionsPanel,
  IntakePanel,
  MessagingPanel,
  OverviewPanel,
  PiecesPanel,
  StoragePanel,
} from "./AwbTabs";
import {
  BRANCH_LABEL,
  LIFECYCLE_FC01_STEPS,
  LIFECYCLE_LABEL,
  LIFECYCLE_ORDER,
  formatKg,
  formatPkr,
  type AwbBundle,
} from "@/lib/domain";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "intake", label: "Intake (OCR)" },
  { key: "pieces", label: "Pieces" },
  { key: "storage", label: "Storage" },
  { key: "customs", label: "Customs" },
  { key: "charges", label: "Charges" },
  { key: "dispatch", label: "Dispatch" },
  { key: "messaging", label: "Messaging" },
  { key: "exceptions", label: "Exceptions" },
  { key: "audit", label: "Audit" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function AwbHubContent({ bundle }: { bundle: AwbBundle }) {
  const params = useSearchParams();
  const initial = (params.get("tab") as TabKey) ?? "overview";
  const [tab, setTab] = useState<TabKey>(
    TABS.some((t) => t.key === initial) ? initial : "overview",
  );

  const { awb, cargoClass, dwell } = bundle;

  const exceptionCount =
    bundle.cdrs.length +
    bundle.mishandled.length +
    bundle.reExport.length +
    bundle.longStay.length +
    bundle.holds.filter((h) => !h.Release).length;

  // FC-01 lifecycle, rendered with the flow's own step numbers.
  const steps = LIFECYCLE_ORDER.map((s) => `${LIFECYCLE_FC01_STEPS[s]} ${LIFECYCLE_LABEL[s]}`);
  const current = `${LIFECYCLE_FC01_STEPS[awb.stage]} ${LIFECYCLE_LABEL[awb.stage]}`;

  const summary: Array<{ label: string; value: React.ReactNode }> = [
    { label: "AWB", value: <span className="font-mono">{awb.AWBNO}</span> },
    { label: "IGM", value: <span className="font-mono text-[12px]">{awb.IGMNO}</span> },
    { label: "Flight", value: awb.FLIGHT },
    { label: "Class", value: `${cargoClass.ABBREVATION}` },
    { label: "Pieces", value: awb.TOTALPCS },
    { label: "Chargeable", value: formatKg(awb.TOTALCHRGWEIGHT) },
    {
      label: "Stage",
      value: <StatusBadge status={awb.stage === "stored" ? "Stored" : LIFECYCLE_LABEL[awb.stage]} />,
    },
    {
      label: "Total",
      value: bundle.charges ? formatPkr(bundle.charges.total) : "—",
    },
  ];

  // FC-12: M03 hub → the CANONICAL Operational Flow screens. This rail was
  // re-pointed off the persona-portal duplicates onto the process-module canon
  // so the AWB hub, the sidebar and the FC-02 flow walkthrough all resolve the
  // same screen per step. Those duplicates have since been deleted outright, so
  // the rail is now the only wiring there is rather than one of two.
  // Only "Storage" and "Gate entry" still name a persona route, and they do so
  // deliberately: /storage/master and /dispatch/gate-pass are the process
  // screens, and the persona boards under /warehouse-manager and /gate-entry
  // remain live surfaces of their own rather than retired twins.
  const rail = [
    { icon: ScanLine, label: "Intake", href: `/awb/${awb.AWBId}?tab=intake`, onClick: () => setTab("intake") },
    { icon: Warehouse, label: "Storage", href: "/storage/master" },
    { icon: ShieldAlert, label: "Customs", href: "/customs/gateway" },
    { icon: Receipt, label: "Charges", href: "/billing/calculator" },
    { icon: Truck, label: "Dispatch", href: "/dispatch/gate-pass" },
    { icon: AlertTriangle, label: "Exceptions", href: "/exceptions/queue" },
    { icon: FileText, label: "Reports", href: "/reports" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "AWB", href: "/warehouse-manager" }, { label: awb.AWBNO }]} />
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Link
              href="/warehouse-manager"
              className="w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors no-underline"
            >
              <ArrowLeft size={18} />
            </Link>
            <div>
              <h1 className="text-[24px] lg:text-[30px] font-bold text-[#0F172A] leading-tight font-mono">
                {awb.AWBNO}
              </h1>
              <p className="text-[13px] text-[#64748B] mt-0.5">
                {awb.CONSIGNEE1} · {awb.ORIGIN} → {awb.DESTINATION} · {awb.site}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {awb.branch && (
              <span className="h-7 px-3 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[12px] font-semibold inline-flex items-center">
                {BRANCH_LABEL[awb.branch]}
              </span>
            )}
            {awb.HOLDINGSTATUS && (
              <span className="h-7 px-3 rounded-full bg-[#FEF3C7] text-[#D97706] text-[12px] font-semibold inline-flex items-center">
                On hold
              </span>
            )}
            {awb.Lock && (
              <span className="h-7 px-3 rounded-full bg-[#F1F5F9] text-[#64748B] text-[12px] font-semibold inline-flex items-center">
                Locked — closed
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-x-6 gap-y-4">
          {summary.map((s) => (
            <div key={s.label} className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
                {s.label}
              </span>
              <span className="text-[14px] font-semibold text-[#0F172A]">{s.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lifecycle — FC-01's 27 steps */}
      <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
          <div>
            <h2 className="text-[16px] font-semibold text-[#0F172A]">AWB lifecycle</h2>
            <p className="text-[12px] text-[#64748B] mt-0.5">
              FC-01 master flow — currently at step {LIFECYCLE_FC01_STEPS[awb.stage]}
            </p>
          </div>
          <AgingBadge totalDays={dwell.totalDays} freeDays={dwell.freeDays} section82Days={dwell.section82Days} compact />
        </div>
        <LifecycleBar steps={steps} current={current} />
      </div>

      {/* Cross-module action rail */}
      <div className="flex items-center gap-2 flex-wrap">
        {rail.map((r) =>
          r.onClick ? (
            <button
              key={r.label}
              onClick={r.onClick}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] font-medium text-[#0F172A] cursor-pointer transition-colors"
            >
              <r.icon size={15} className="text-[#64748B]" />
              {r.label}
            </button>
          ) : (
            <Link
              key={r.label}
              href={r.href}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg border border-[#E2E8F0] bg-white hover:bg-[#F8FAFC] text-[13px] font-medium text-[#0F172A] no-underline transition-colors"
            >
              <r.icon size={15} className="text-[#64748B]" />
              {r.label}
            </Link>
          ),
        )}
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-0">
        <div className="flex items-center gap-0 border-b border-[#E2E8F0] overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="relative h-10 px-4 text-[13px] font-medium whitespace-nowrap cursor-pointer transition-colors"
              style={{
                color: tab === t.key ? "#0B2545" : "#64748B",
                borderBottom: tab === t.key ? "2px solid #0B2545" : "2px solid transparent",
                marginBottom: -1,
              }}
            >
              {t.label}
              {t.key === "exceptions" && exceptionCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold">
                  {exceptionCount}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="rounded-b-[16px] border border-t-0 border-[#E2E8F0] bg-[#F8FAFC] p-5">
          {tab === "overview" && <OverviewPanel b={bundle} />}
          {tab === "intake" && <IntakePanel b={bundle} />}
          {tab === "pieces" && <PiecesPanel b={bundle} />}
          {tab === "storage" && <StoragePanel b={bundle} />}
          {tab === "customs" && <CustomsPanel b={bundle} />}
          {tab === "charges" && <ChargesPanel b={bundle} />}
          {tab === "dispatch" && <DispatchPanel b={bundle} />}
          {tab === "messaging" && <MessagingPanel b={bundle} />}
          {tab === "exceptions" && <ExceptionsPanel b={bundle} />}
          {tab === "audit" && <AuditPanel b={bundle} />}
        </div>
      </div>
    </div>
  );
}
