"use client";

import Breadcrumb from "@/components/Breadcrumb";
import RequestedRoleTaxonomy from "@/components/admin/roles/RequestedRoleTaxonomy";
import RolesContent from "@/components/admin/roles/RolesContent";

/**
 * Roles & Permissions — two vocabularies on one screen.
 *
 * The matrix below is the granted side: seventeen internal role slugs against
 * every module. The taxonomy card above is the requested side — the four names
 * a person without an account can ask for, ported from the retired
 * /uld-message-builder/register screen, which was the only place they existed.
 *
 * They are stacked in that order because that is the order the work happens in:
 * a request names a role, and the approver then goes to the matrix to grant it.
 */
export default function AdminRolesPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Roles & Permissions" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Roles &amp; Permissions</h1>
      </div>
      <RequestedRoleTaxonomy />
      <RolesContent />
    </div>
  );
}
