"use client";

/**
 * Handoff Approvals — FC-12 §03 ("Inter-station ownership handoff via HQ, bond
 * continuity preserved (FC-09)"), the HQ half of that step.
 *
 * §03 hrefs /transhipment/handoff, which is the two sites' view. The approval
 * act it names — "via HQ" — had no screen; the content component explains what
 * was already modelled and where it was dangling.
 */

import Breadcrumb from "@/components/Breadcrumb";
import { HqScreenHeader } from "@/components/hq/HqUi";
import HandoffApprovalsContent from "@/components/hq/HandoffApprovalsContent";

export default function HqHandoffsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Headquarters" }, { label: "Handoff Approvals" }]} />
        <HqScreenHeader
          module="M15"
          flow="FC-12 §03 · FC-09"
          title="Handoff Approvals"
          lede="Origin proposes, HQ approves, cargo travels, receiving node accepts. This is the approval step — the one act in the chain that belongs to neither end, because ownership of bonded cargo is moving between two nodes and neither can grant itself the move."
        />
      </div>

      <HandoffApprovalsContent />
    </div>
  );
}
