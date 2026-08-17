"use client";

import Breadcrumb from "@/components/Breadcrumb";
import AuditTrailContent from "@/components/admin/audit-trail/AuditTrailContent";

export default function AdminAuditTrailPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Audit Trail Browser" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Audit Trail Browser</h1>
      </div>
      <AuditTrailContent />
    </div>
  );
}