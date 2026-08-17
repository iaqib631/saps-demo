"use client";

/**
 * The client half of `/lifter-operator/task-detail/[taskId]`.
 *
 * Same shape as `AwbHubContent` behind `/awb/[awbId]`: the server route does
 * the slug → fixture lookup, this component does the interaction. Every value
 * it renders comes from the `task` prop — nothing is keyed off a hard-coded
 * task id any more, including the RFID match below.
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Breadcrumb from "@/components/Breadcrumb";
import { useToast } from "@/components/ToastContext";
import TaskRoute from "@/components/lifter-operator/task-detail/TaskRoute";
import PieceDetails from "@/components/lifter-operator/task-detail/PieceDetails";
import ScanConfirmation from "@/components/lifter-operator/task-detail/ScanConfirmation";
import StepChecklist from "@/components/lifter-operator/task-detail/StepChecklist";
import Actions from "@/components/lifter-operator/task-detail/Actions";
import LoadingState from "@/components/lifter-operator/task-detail/LoadingState";
import ErrorState from "@/components/ErrorState";
import type { LifterTask } from "../../tasks/taskData";

export default function TaskDetailContent({ task }: { task: LifterTask }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [scanStatus, setScanStatus] = useState("waiting");
  const [scanInput, setScanInput] = useState("");
  // A task already in progress has arrived and is at the scan step; an
  // assigned one has not started, which is what surfaces "Start Task".
  const [currentStep, setCurrentStep] = useState(task.status === "In Progress" ? 2 : 0);
  const [taskStatus, setTaskStatus] = useState(task.status);
  const { addToast } = useToast();
  const router = useRouter();

  /** The AWB digits, which is what a partial tag read gives you. */
  const awbDigits = task.awb.replace(/\D/g, "");

  const handleScan = () => {
    if (!scanInput.trim()) {
      addToast("Please scan or enter an RFID", "error");
      return;
    }
    if (scanInput === task.rfid || scanInput.includes(awbDigits)) {
      setScanStatus("matched");
      setCurrentStep(3);
      addToast("Correct piece scanned", "success");
    } else if (scanInput === "duplicate") {
      setScanStatus("duplicate");
      addToast("Duplicate scan detected", "error");
    } else {
      setScanStatus("mismatch");
      addToast("Scanned RFID does not match assigned piece", "error");
    }
  };

  const handleStartTask = () => {
    setTaskStatus("In Progress");
    setCurrentStep(1);
    addToast("Task started", "success");
  };

  const handleConfirmPickup = () => {
    setCurrentStep(4);
    addToast("Pickup confirmed", "success");
  };

  const handleConfirmDropoff = () => {
    setCurrentStep(5);
    addToast("Drop-off confirmed", "success");
  };

  const handleCompleteTask = () => {
    setCurrentStep(6);
    setTaskStatus("Completed");
    addToast("Task completed successfully", "success");
  };

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Lifter Operator", href: "/lifter-operator" },
          { label: "My Tasks", href: "/lifter-operator/tasks" },
          { label: task.id },
        ]}
      />

      <div className="flex items-center gap-3 flex-wrap">
        <h1 className="text-[22px] font-bold text-[#0F172A]">Task Detail</h1>
        <span className="font-mono text-[13px] font-semibold text-[#64748B]">{task.id}</span>
        <Link
          href="/lifter-operator/tasks"
          className="text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline ml-auto"
        >
          All tasks
        </Link>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => setLoading((p) => !p)}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          {loading ? "Stop Loading" : "Simulate Loading"}
        </button>
        <button
          onClick={() => setError((p) => !p)}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          {error ? "Clear Error" : "Simulate Error"}
        </button>
      </div>

      {loading && <LoadingState />}

      {error && (
        <ErrorState
          title="Failed to load task"
          message="Could not retrieve task details from the server. Please retry."
          onRetry={() => window.location.reload()}
        />
      )}

      {!loading && !error && (
        <>
          <TaskRoute task={task} taskStatus={taskStatus} slaRemaining={task.slaRemaining} />

          <PieceDetails task={task} />

          <ScanConfirmation
            scanInput={scanInput}
            setScanInput={setScanInput}
            scanStatus={scanStatus}
            onScan={handleScan}
            expectedRfid={task.rfid}
          />

          <StepChecklist currentStep={currentStep} taskType={task.type} />

          <Actions
            taskStatus={taskStatus}
            currentStep={currentStep}
            onStartTask={handleStartTask}
            onConfirmPickup={handleConfirmPickup}
            onConfirmDropoff={handleConfirmDropoff}
            onCompleteTask={handleCompleteTask}
            onBackToTasks={() => router.push("/lifter-operator/tasks")}
            addToast={addToast}
          />
        </>
      )}
    </div>
  );
}
