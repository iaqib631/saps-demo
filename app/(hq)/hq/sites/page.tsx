"use client";

/**
 * Site Register — FC-12 §02, reading §01's per-site nodes from the tier above.
 */

import Breadcrumb from "@/components/Breadcrumb";
import { HqScreenHeader } from "@/components/hq/HqUi";
import SiteRegisterContent from "@/components/hq/SiteRegisterContent";

export default function HqSitesPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Headquarters" }, { label: "Site Register" }]} />
        <HqScreenHeader
          module="M20"
          flow="FC-12 §02 · §01 read at HQ tier"
          title="Site Register"
          lede="The three terminal nodes as HQ holds them — key triple, sync state, administrator coverage and load, all three side by side. Below them, the stations on the network footprint that are not nodes yet, and the decision that would promote one."
        />
      </div>

      <SiteRegisterContent />
    </div>
  );
}
