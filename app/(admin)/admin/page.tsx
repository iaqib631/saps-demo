"use client";

import Breadcrumb from "@/components/Breadcrumb";
import AdminDashboardContent from "@/components/admin/dashboard/AdminDashboardContent";

export default function AdminDashboardPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Dashboard" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Admin Dashboard</h1>
      </div>
      <AdminDashboardContent />
    </div>
  );
}