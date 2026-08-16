import { redirect } from "next/navigation";

/**
 * `/lifter-operator/task-detail` with no task in the URL.
 *
 * The screen shows one work order, so with no id there is nothing to show —
 * which is exactly what the old empty state said: "No task selected. Select a
 * task from My Tasks to view details here", with a button that pushed to
 * `/lifter-operator/tasks`. The list is the picker, so the bare route now
 * performs that push itself instead of rendering a dead end.
 *
 * It is kept rather than deleted because inbound links to the bare path still
 * exist outside this route's ownership — `lib/architecture.ts` alone points
 * FC-15 §04 and §06–09 at it. Those must land somewhere real, not on a 404.
 */
export default function TaskDetailIndexPage() {
  redirect("/lifter-operator/tasks");
}
