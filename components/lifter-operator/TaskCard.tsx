"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";

interface Task {
  id: string;
  type: string;
  priority: string;
  awb: string;
  pieceId: string;
  rfid: string;
  fromLocation: string;
  toLocation: string;
  cargoClass: string;
  weight: string;
  handlingCode: string;
  timeAssigned: string;
  slaRemaining: string;
  assignedBy: string;
  status: string;
}

interface TaskCardProps {
  task: Task;
  onStartTask: (id: string) => void;
  onReportIssue: (id: string) => void;
}

const priorityConfig: Record<string, { bg: string; text: string; border: string }> = {
  Urgent: { bg: "#FEF2F2", text: "#DC2626", border: "#FECACA" },
  High: { bg: "#FFF7ED", text: "#D97706", border: "#FED7AA" },
  Normal: { bg: "#F1F5F9", text: "#64748B", border: "#E2E8F0" },
};

const typeConfig: Record<string, { bg: string; text: string }> = {
  Putaway: { bg: "#DBEAFE", text: "#1B4F8B" },
  Pick: { bg: "#F3E8FF", text: "#7C3AED" },
  Move: { bg: "#FEF3C7", text: "#D97706" },
  Charge: { bg: "#DCFCE7", text: "#16A34A" },
};

export default function TaskCard({ task, onStartTask, onReportIssue }: TaskCardProps) {
  const [expanded, setExpanded] = useState(false);

  const pc = priorityConfig[task.priority] || priorityConfig.Normal;
  const tc = typeConfig[task.type] || { bg: "#F1F5F9", text: "#64748B" };

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      {/* Card header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="inline-flex items-center h-8 px-3 rounded-lg text-[12px] font-bold"
              style={{ backgroundColor: tc.bg, color: tc.text }}
            >
              {task.type}
            </span>
            <span
              className="inline-flex items-center h-8 px-3 rounded-lg text-[12px] font-bold border"
              style={{ backgroundColor: pc.bg, color: pc.text, borderColor: pc.border }}
            >
              {task.priority === "Urgent" && (
                <AlertTriangle size={14} className="mr-1.5" />
              )}
              {task.priority}
            </span>
          </div>
          {/*
            The drill-in. Same gesture as the AWB# in the warehouse queue:
            click the record's own number to open the record. The row keeps
            its inline "Detail" expander for a glance; this opens the task's
            own URL, /lifter-operator/task-detail/<id>.
          */}
          <Link
            href={`/lifter-operator/task-detail/${task.id}`}
            className="text-[12px] font-mono font-semibold text-[#1B4F8B] whitespace-nowrap no-underline hover:text-[#0B2545] hover:underline transition-colors"
          >
            {task.id}
          </Link>
        </div>

        {/* AWB & RFID */}
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
              AWB
            </span>
            <span className="text-[15px] font-bold text-[#0F172A] font-mono">
              {task.awb}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-semibold text-[#64748B] uppercase tracking-wide">
              RFID
            </span>
            <span className="text-[13px] font-medium text-[#0F172A] font-mono">
              {task.rfid}
            </span>
          </div>
        </div>

        {/* Location bar */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
              From
            </p>
            <p className="text-[13px] font-semibold text-[#0F172A] truncate">
              {task.fromLocation}
            </p>
          </div>
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#EBF0F7] flex items-center justify-center">
            <ArrowRight size={16} className="text-[#0B2545]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
              To
            </p>
            <p className="text-[13px] font-semibold text-[#0F172A] truncate">
              {task.toLocation}
            </p>
          </div>
        </div>

        {/* Quick info row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Piece</p>
            <p className="text-[13px] font-medium text-[#0F172A] font-mono truncate">{task.pieceId}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Class</p>
            <p className="text-[13px] font-medium text-[#0F172A]">{task.cargoClass}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">Weight</p>
            <p className="text-[13px] font-medium text-[#0F172A]">{task.weight}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide">SLA</p>
            <p className={`text-[13px] font-bold ${task.priority === "Urgent" ? "text-[#DC2626]" : task.priority === "High" ? "text-[#D97706]" : "text-[#16A34A]"}`}>
              {task.slaRemaining}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onStartTask(task.id)}
            className="flex-1 h-14 rounded-xl text-[15px] font-bold text-white cursor-pointer transition-colors hover:opacity-90 active:scale-[0.98]"
            style={{ backgroundColor: "#0B2545" }}
          >
            Start
          </button>
          <button
            onClick={() => setExpanded(!expanded)}
            className="h-14 px-4 rounded-xl text-[14px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors active:scale-[0.98]"
          >
            {expanded ? "Hide" : "Detail"}
          </button>
          <button
            onClick={() => onReportIssue(task.id)}
            className="h-14 px-4 rounded-xl text-[14px] font-semibold border border-[#F59E0B]/30 text-[#D97706] hover:bg-[#FEF3C7] cursor-pointer transition-colors active:scale-[0.98]"
          >
            Issue
          </button>
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-[#E2E8F0] bg-[#F8FAFC] p-4">
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
                Handling Code
              </p>
              <p className="text-[13px] font-medium text-[#0F172A]">{task.handlingCode}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
                Status
              </p>
              <p className="text-[13px] font-medium text-[#0F172A]">{task.status}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
                Assigned By
              </p>
              <p className="text-[13px] font-medium text-[#0F172A]">{task.assignedBy}</p>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wide mb-0.5">
                Time Assigned
              </p>
              <p className="text-[13px] font-medium text-[#0F172A]">{task.timeAssigned}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-[12px] text-[#64748B] flex-wrap">
            <span className="font-semibold">Status:</span>
            <span className="inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full text-[11px] font-semibold bg-[#DBEAFE] text-[#1B4F8B]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#2E75B6]" />
              {task.status}
            </span>
            <Link
              href={`/lifter-operator/task-detail/${task.id}`}
              className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
            >
              Open task <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}