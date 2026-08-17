"use client";

import Breadcrumb from "@/components/Breadcrumb";
import AccessRequestPanel from "@/components/admin/users/AccessRequestPanel";
import UsersContent from "@/components/admin/users/UsersContent";

/**
 * Users — the identity screen, and now the place access is asked for.
 *
 * The access-request half arrives from the retired
 * /uld-message-builder/register screen. It sits above the directory rather than
 * below it because a request is upstream of a user: the queue is what fills the
 * table underneath. It is collapsed by default so the directory stays the first
 * thing an administrator sees on an ordinary day, and the pending count on the
 * header is what pulls them into it on the days it matters.
 */
export default function AdminUsersPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Users" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Users</h1>
      </div>
      <AccessRequestPanel />
      <UsersContent />
    </div>
  );
}
