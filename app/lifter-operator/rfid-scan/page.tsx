"use client";

import { useState } from "react";
import { Home, ChevronRight, ScanLine } from "lucide-react";
import Link from "next/link";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import ErrorState from "@/components/ErrorState";
import ScannerCard from "@/components/lifter-operator/rfid-scan/ScannerCard";
import PieceDetailCard from "@/components/lifter-operator/rfid-scan/PieceDetailCard";
import RecentScansTable from "@/components/lifter-operator/rfid-scan/RecentScansTable";
import DeviceStatus from "@/components/lifter-operator/rfid-scan/DeviceStatus";
import ScanLoading from "@/components/lifter-operator/rfid-scan/ScanLoading";
import { TASKS, taskById } from "../tasks/taskData";

export default function RfidScanPage() {
  const [scanState, setScanState] = useState("waiting");
  const [scannedData, setScannedData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isError, setIsError] = useState(false);
  const [isEmpty, setIsEmpty] = useState(false);

  /**
   * The quick action used to point at the bare `/lifter-operator/task-detail`,
   * which showed one hard-coded task whatever had just been scanned. A scanned
   * piece names its own task, so link to that task's URL — resolved through
   * the fixture so an unrecognised tag cannot produce a 404 link.
   */
  const scannedTask = taskById(scannedData?.assignedTask ?? "");
  const taskDetailHref = `/lifter-operator/task-detail/${scannedTask?.id ?? TASKS[0].id}`;

  const breadcrumbItems = [
    { label: "Home", href: "/", icon: Home },
    { label: "Lifter Operator", href: "/lifter-operator" },
    { label: "RFID Scan", href: "#" },
  ];

  return (
    <div className="space-y-5">
      <Breadcrumb items={breadcrumbItems} />

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-[#0B2545] flex items-center justify-center">
          <ScanLine size={20} className="text-white" />
        </div>
        <div>
          <h1 className="text-[22px] font-bold text-[#0F172A] tracking-tight">
            RFID Handheld Scan
          </h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => { setIsLoading(false); setIsError(false); setIsEmpty(false); }}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          Normal
        </button>
        <button
          onClick={() => { setIsLoading(true); setIsError(false); setIsEmpty(false); }}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          Loading
        </button>
        <button
          onClick={() => { setIsLoading(false); setIsError(true); setIsEmpty(false); }}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          Error
        </button>
        <button
          onClick={() => { setIsLoading(false); setIsError(false); setIsEmpty(true); }}
          className="h-7 px-3 rounded-lg text-[11px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          Empty
        </button>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <ScanLoading />
            <ScanLoading />
          </div>
          <div className="space-y-5">
            <ScanLoading />
          </div>
        </div>
      )}

      {isError && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <ErrorState
              title="RFID Handheld Disconnected"
              message="The RFID handheld reader is not responding. Check Bluetooth pairing, ensure the device is powered on, and verify the reader is within range."
              onRetry={() => setIsError(false)}
            />
            <ScannerCard
              scanState={scanState}
              setScanState={setScanState}
              scannedData={scannedData}
              setScannedData={setScannedData}
            />
            <PieceDetailCard scanState={scanState} scannedData={scannedData} />
          </div>
          <div className="space-y-5">
            <DeviceStatus isError={true} setIsError={setIsError} />
          </div>
        </div>
      )}

      {isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <EmptyState
              title="No scan history yet"
              description="Scan an RFID tag to begin piece verification. The scan results will appear here."
              icon={<ScanLine size={28} className="text-[#94A3B8]" />}
              actionLabel="Simulate Scan"
              onAction={() => {
                setIsEmpty(false);
                setScanState("matched");
                setScannedData({
                  rfid: "EPC-3008-21445678901-0007",
                  pieceId: "P-21445678901-07",
                  awb: "214-45678901",
                  hawb: "HBL-2091",
                  cargoClass: "AFU",
                  weight: "52 kg",
                  handlingCode: "AFU",
                  currentState: "Awaiting Putaway",
                  lastMovement: "Receiving Bay 02 — 11:42",
                  assignedTask: "T-2026-0041",
                  storageLocation: "AFU-R02-L1-B04",
                  currentLocation: "Receiving Bay 02",
                  expectedLocation: "AFU-R02-L1-B04",
                });
              }}
            />
          </div>
          <div className="space-y-5">
            <DeviceStatus isError={false} setIsError={setIsError} />
          </div>
        </div>
      )}

      {!isLoading && !isError && !isEmpty && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <ScannerCard
              scanState={scanState}
              setScanState={setScanState}
              scannedData={scannedData}
              setScannedData={setScannedData}
            />
            <PieceDetailCard scanState={scanState} scannedData={scannedData} />
            <RecentScansTable />
          </div>
          <div className="space-y-5">
            <DeviceStatus isError={false} setIsError={setIsError} />
            <div className="bg-white rounded-xl border border-[#E2E8F0] overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E2E8F0]">
                <h2 className="text-[16px] font-bold text-[#0F172A]">Quick Actions</h2>
              </div>
              <div className="p-5 space-y-2">
                <Link
                  href="/lifter-operator/tasks"
                  className="flex items-center gap-3 h-12 px-4 rounded-xl border border-[#E2E8F0] text-[14px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors no-underline"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#EBF0F7] flex items-center justify-center">
                    <ScanLine size={16} className="text-[#0B2545]" />
                  </span>
                  Back to My Tasks
                </Link>
                <Link
                  href={taskDetailHref}
                  className="flex items-center gap-3 h-12 px-4 rounded-xl border border-[#E2E8F0] text-[14px] font-semibold text-[#0F172A] hover:bg-[#F8FAFC] cursor-pointer transition-colors no-underline"
                >
                  <span className="w-8 h-8 rounded-lg bg-[#EBF0F7] flex items-center justify-center">
                    <ScanLine size={16} className="text-[#0B2545]" />
                  </span>
                  {scannedTask ? `Task ${scannedTask.id}` : "Task Detail"}
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}