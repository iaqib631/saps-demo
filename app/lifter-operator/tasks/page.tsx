"use client";

/**
 * FC-15 · My Tasks — the lifter operator's work list.
 *
 * This is the picker for `/lifter-operator/task-detail/[taskId]`: every row
 * carries its own task id in the URL now, so the detail screen no longer has
 * to guess which task is "the" task. The rows come from `./taskData`, which
 * the detail route reads too.
 */

import { useState } from "react";
import Breadcrumb from "@/components/Breadcrumb";
import { useToast } from "@/components/ToastContext";
import KPIStrip from "@/components/lifter-operator/KPIStrip";
import TaskFilters from "@/components/lifter-operator/TaskFilters";
import TaskList from "@/components/lifter-operator/TaskList";
import TodaySummary from "@/components/lifter-operator/TodaySummary";
import { TASKS } from "./taskData";

export default function LifterTasksPage() {
  const [activeFilter, setActiveFilter] = useState("All");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [empty, setEmpty] = useState(false);
  const { addToast } = useToast();

  const filteredTasks =
    activeFilter === "All"
      ? TASKS
      : activeFilter === "Completed"
      ? TASKS.filter((t) => t.status === "Completed")
      : activeFilter === "Urgent"
      ? TASKS.filter((t) => t.priority === "Urgent")
      : TASKS.filter((t) => t.type === activeFilter);

  const handleStartTask = (taskId: string) => {
    addToast(`Task ${taskId} started`, "success");
  };

  const handleReportIssue = (taskId: string) => {
    addToast(`Issue reported for ${taskId}`, "success");
  };

  return (
    <div className="space-y-5">
      <Breadcrumb
        items={[
          { label: "Home", href: "/" },
          { label: "Lifter Operator", href: "/lifter-operator" },
          { label: "My Tasks" },
        ]}
      />

      <div className="flex items-center gap-3">
        <h1 className="text-[22px] font-bold text-[#0F172A]">My Tasks</h1>
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
        <button
          onClick={() => setEmpty((p) => !p)}
          className="h-8 px-3 rounded-lg text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] cursor-pointer transition-colors"
        >
          {empty ? "Show Data" : "Simulate Empty"}
        </button>
      </div>

      <KPIStrip />

      <TaskFilters activeFilter={activeFilter} onFilterChange={setActiveFilter} />

      <TaskList
        tasks={filteredTasks}
        loading={loading}
        error={error}
        empty={empty}
        onStartTask={handleStartTask}
        onReportIssue={handleReportIssue}
      />

      <TodaySummary />
    </div>
  );
}
