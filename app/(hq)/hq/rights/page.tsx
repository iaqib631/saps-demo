"use client";

/**
 * Cross-site Rights — FC-12 §04, feeding §06.
 */

import Breadcrumb from "@/components/Breadcrumb";
import { HqScreenHeader } from "@/components/hq/HqUi";
import CrossSiteRightsContent from "@/components/hq/CrossSiteRightsContent";

export default function HqRightsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Headquarters" }, { label: "Cross-site Rights" }]} />
        <HqScreenHeader
          module="M20"
          flow="FC-12 §04 · feeds §06"
          title="Cross-site Rights"
          lede="Portal separation as an authority rule rather than a layout: where a site administrator may grant, how deep, and which surfaces stay HQ's to widen. The node's own role matrix is untouched — this sets the box it works inside."
        />
      </div>

      <CrossSiteRightsContent />
    </div>
  );
}
