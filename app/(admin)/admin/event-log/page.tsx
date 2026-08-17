"use client";

import Breadcrumb from "@/components/Breadcrumb";
import EventLogContent from "@/components/admin/event-log/EventLogContent";

export default function AdminEventLogPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Session & Event Log" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Session &amp; Event Log</h1>
      </div>
      <EventLogContent />
    </div>
  );
}