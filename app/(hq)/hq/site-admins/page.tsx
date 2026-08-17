"use client";

/**
 * Site Administrators — an AirVault addition on FC-12 §02.
 *
 * NOT §05. §05 is "User & role administration" and it hrefs /admin/users, the
 * site tier's own screen, which keeps managing that node's people. The only
 * written source for HQ creating site administrators is a code comment in
 * lib/domain/masters.ts, so the badge says addition rather than borrowing a
 * step number that does not cover it.
 */

import Breadcrumb from "@/components/Breadcrumb";
import { HqScreenHeader } from "@/components/hq/HqUi";
import SiteAdminsContent from "@/components/hq/SiteAdminsContent";

export default function HqSiteAdminsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Headquarters" }, { label: "Site Administrators" }]} />
        <HqScreenHeader
          module="M20"
          flow="AirVault addition on FC-12 §02"
          title="Site Administrators"
          lede="HQ does not create people at a node — the node's own Users screen does that. HQ creates the delegation that says who may administer which node, to what depth, and issues the one grant that spans all of them."
        />
      </div>

      <SiteAdminsContent />
    </div>
  );
}
