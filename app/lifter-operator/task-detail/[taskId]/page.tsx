import { notFound } from "next/navigation";
import { TASKS, taskById } from "../../tasks/taskData";
import TaskDetailContent from "./TaskDetailContent";

/**
 * FC-15 §04 / §06–09 · Task detail — a drill-in, not a destination.
 *
 * The screen shows exactly one work order, so the work order belongs in the
 * URL. Before this route existed the task was a module-level const inside the
 * page: every route into the screen showed T-2026-0041 no matter which row
 * the operator had tapped, and the "No task selected" empty state was the
 * only acknowledgement that a selection was ever meant to happen.
 *
 * Slug is `taskId` because the task id (`T-2026-0041`) is what the fixture
 * keys on, what the list prints on every card and what `onStartTask` /
 * `onReportIssue` already pass around. Shaped after `/awb/[awbId]`: a server
 * page that resolves the slug against the fixture and hands one record to a
 * client component, with `generateStaticParams` so every task prerenders.
 */

export function generateStaticParams() {
  return TASKS.map((t) => ({ taskId: t.id }));
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  const task = taskById(taskId);
  if (!task) notFound();

  return <TaskDetailContent task={task} />;
}
