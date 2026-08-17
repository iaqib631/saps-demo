"use client";

/**
 * The figures this dashboard used to carry that nothing can feed, and why.
 *
 * This card holds no numbers and is the load-bearing one on the screen — the
 * same role components/hq/console/NotFed.tsx plays for the HQ console and
 * components/admin/dashboard/NotShownOnDashboard.tsx for the site tier. The
 * failure mode for an auditor's home is not a missing tile, it is a PLAUSIBLE
 * one, and this screen had six: "2,847 transactions +8.2%", "31 waivers -12% vs
 * prev", "156 holds +5.4%", "89 OOC ±0%", "412 invoices +11.8%", "24 user access
 * changes -3 vs prev". Every tile in the rows above now prints the lib/domain
 * function behind it; this card names what has no function, which is what makes
 * the rest of the page worth trusting.
 *
 * The reasons are the AUDITOR's, not a copy of the other two cards'. The HQ
 * console's question was "can this be split per node?"; the site tier's was
 * "can this node answer it at all?"; this one's is "is this an audit trail, or
 * a list of records that happen to be dated?" — which is the distinction the
 * whole portal turns on.
 */

import { useMemo } from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { HqCard, NotAvailable } from "@/components/hq/HqUi";
import { DEMO_NOW, formatDateTime } from "@/lib/domain";
import { listDelegations } from "@/lib/domain/access";
import { TRAIL_REGISTERS } from "../auditorMetrics";

export default function NotShownOnAuditorHome() {
  /* Counted rather than written into the prose — a card that argues for
     honesty and then hard-codes its own two numbers would be the joke. */
  const grants = useMemo(() => {
    const all = listDelegations("HQ");
    return { inForce: all.filter((d) => d.IsActive).length, withdrawn: all.filter((d) => !d.IsActive).length };
  }, []);

  return (
    <HqCard
      title="Not shown on this dashboard, and why"
      icon={EyeOff}
      source="no fixture — stated rather than estimated"
      intro="Four things an audit console is normally expected to carry. None has data behind it, so none is drawn — and the period selector that used to sit at the top of this screen is the fourth of them."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <NotAvailable
          title="Reads — who VIEWED or EXPORTED which record"
          reason="There is no audit-event store anywhere in lib/domain, and a read leaves no row behind in any of the registers that do exist. The ten rows that used to sit under this dashboard claimed exactly this — 'ahmed.shaikh · Finance · INV-2026-0042 · Viewed · inv_42_detail.pdf' — with invented people, invented references and invented filenames. It is the one thing an audit trail is most expected to hold and the one thing nothing here records."
          nearest={`The record trail above: every WRITE that carries both a timestamp and an actor column, from the ${TRAIL_REGISTERS.length} registers that have both, each row printing the fixture field its actor came from.`}
        />

        <NotAvailable
          title="Logins, sessions, failed authentication and access denials"
          reason="No session or authentication store exists at any tier. lib/domain/access.ts states the consequence in as many words: revoking a delegation cannot invalidate a session, because there is no session store to revoke against. The old 'Security / Access Activity' card asserted '8 new users, 3 SSO links, 0 failed logins flagged' against none of those things existing — and '0 failed logins' is the most misleading of the three, because it reads as a clean result rather than an absent instrument."
          nearest={`Authority granted and withdrawn, which IS a record: ${grants.inForce} delegations in force and ${grants.withdrawn} revoked, each revocation carrying its reason on the row.`}
        />

        <NotAvailable
          title="Per-portal and per-module activity"
          reason="Nothing in the domain carries a portal or a module column. The old export filters offered seven portals and seven modules to slice by, and the audit table showed a Module for every row — Finance, ULD Builder, CHA, Gate Entry, Compliance — but those were properties of the invented rows, not of anything queryable. A record knows its register and its node; it does not know which screen touched it."
          nearest="The register a record came from, which is a real column and is the filter the trail above actually uses."
        />

        <NotAvailable
          title="Trends, deltas and any rolling period"
          reason={`Every fixture in this demo is a single snapshot at ${formatDateTime(DEMO_NOW)}. There is no yesterday and no previous month, so the six arrows this screen carried — +8.2%, -12% vs prev, +5.4%, ±0%, +11.8%, -3 vs prev — had nothing to be measured against, and "Last 30 days" under all six was a window over data that has no windows. The Today / 7 Days / 30 Days / Custom selector filtered nothing and is gone with them; AuditorStat has no trend prop and must not grow one.`}
          nearest="Ages measured against DEMO_NOW, which one snapshot can support: the record trail states how far back it reaches, and the financial trace states how many days old each invoice is."
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#0F172A]">
          Estate-wide, and deliberately not following the site switcher
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
          FC-12 §16, §17, §17a and §06 are cross-site reads — that is what puts them in the HQ tier
          rather than in the per-site node at §01. Every query on this portal passes &quot;HQ&quot;
          explicitly and shows the per-node split inside the figure, so an auditor sees all three
          nodes whatever the shell&apos;s scope is set to. The per-site administration home is a
          different screen with a different rule:{" "}
          <Link
            href="/admin"
            className="font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            /admin
          </Link>{" "}
          takes the switcher, because it configures one node.
        </p>
      </div>
    </HqCard>
  );
}
