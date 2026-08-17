"use client";

/**
 * The four tiles that used to be here, and why none of them is drawn.
 *
 * This card carries no figures and is the load-bearing one on the screen. The
 * failure mode for an administration dashboard is not a missing tile, it is a
 * PLAUSIBLE one: "184 active users", "9 locked", "87% integration health",
 * "1,247 audit events" all rendered here as string literals with invented
 * arrows beside them, and the first thing a client does with a number is ask to
 * drill into it. Every tile in the row above now prints the lib/domain function
 * it came from; this card names the four that have no function and says what is
 * concretely missing — a column, a store, a time dimension — which is what
 * makes the five above it worth trusting.
 *
 * Deleting the four silently was the other option and it is worse: a gap that
 * is not stated reads as "we forgot", and each of these names something a site
 * administration screen genuinely SHOULD show one day. Stated this way the gap
 * is a scoping fact and the fix is costed rather than discovered in UAT.
 *
 * This is the same discipline as components/hq/console/NotFed.tsx, which cites
 * these exact numbers as the failure mode the HQ console refuses. The reasons
 * below are site-tier ones and not a copy of that card's: HQ's question was
 * "can this be split per node?", and this screen's is "can this node answer it
 * at all?".
 */

import { useMemo } from "react";
import Link from "next/link";
import { EyeOff } from "lucide-react";
import { useSite } from "@/components/site/SiteContext";
import { DEMO_NOW, formatDateTime } from "@/lib/domain";
import { SiteCard, NotFedTile } from "./SiteKpiUi";
import { siteAdminMetrics } from "./siteAdminMetrics";

export default function NotShownOnDashboard() {
  const { scope } = useSite();
  const m = useMemo(() => siteAdminMetrics(scope), [scope]);

  const node = scope === "HQ" ? "any one node" : scope;
  const failed = m.failedEvents;

  /* The old "Failed Events · Last 24 hours · +5" is the one arrow that was not
     merely unfed but demonstrably wrong, so the span is computed rather than
     asserted — at KHI it reads 32 days. */
  const spanSentence =
    failed.total === 0
      ? "The failed-event tile beside this card reads zero in this scope, which is a fact about the fixture rather than a quiet period."
      : `The failed-event tile beside this card covers failures ${failed.oldestDaysAgo} days apart, not a rolling 24 hours as the old subtitle claimed.`;

  return (
    <SiteCard
      title="Not shown on this dashboard, and why"
      icon={EyeOff}
      source="no fixture — stated rather than estimated"
      intro="Four figures an administration console is normally expected to carry. None has data behind it for a single site, so none is drawn."
    >
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <NotFedTile
          title="Active users, logins and live sessions"
          reason={`There is no session or authentication store anywhere in the demo, and identity is held several times over inside the components that render it — 12 users on /admin/users whose only site hint is a free-text group string, 10 session rows on /admin/event-log with no site column, and a different 7 on the auditor's RBAC snapshot. No shared key joins them, so a count of who is signed in ${scope === "HQ" ? "at each node" : `at ${node}`} would be assembled from lists that do not agree.`}
          nearest={
            <>
              <span className="font-semibold text-[#64748B]">Administrators in force</span> — a
              delegation is a record with a site key and an active flag, so &quot;who may administer
              this node&quot; is answerable where &quot;who is signed in&quot; is not. Those rows are
              not yet mirrored onto{" "}
              <Link
                href="/admin/users"
                className="font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                Users
              </Link>
              , which still holds its directory locally — so the tile is deliberately not linked to
              it.
            </>
          }
        />

        <NotFedTile
          title="Locked, disabled and failed-authentication accounts"
          reason="Nothing in lib/domain carries a lockout, a failed-attempt counter or a disabled flag on a person. /admin/users shows a Disabled status from its own component-local array with no site column and no lockout model beneath it, and lib/domain/access.ts states the limit in as many words: revoking a grant cannot invalidate a session, because there is no session store to revoke against."
          nearest={
            <>
              <span className="font-semibold text-[#64748B]">Authority withdrawn</span> — delegations
              carrying IsActive false with the reason recorded on the row, which is a real
              revocation rather than an inferred lock.
            </>
          }
        />

        <NotFedTile
          title="Integration health for this node"
          reason="Neither gateway register has a site column: GATEWAYS in lib/domain/messaging.ts holds six connectors estate-wide, and /admin/integrations holds nine in a component-local array whose only marker is the demo's include/exclude flag, not a station. PSW, SITA, the RFID estate and the payment gateway are single estate-wide connections, so splitting them three ways to make a per-node percentage would be invention — and the old subtitle counted 15 connectors, which is neither register."
          nearest={
            <>
              <span className="font-semibold text-[#64748B]">Failed integration events</span> — the
              traffic through those gateways does carry a site column, so what failed here is
              answerable even though how healthy the connector is, here, is not. The estate-wide
              board is FC-12 §12 at{" "}
              <Link
                href="/integration-status"
                className="font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                Integration status
              </Link>
              , deep-linked rather than copied into a site screen.
            </>
          }
        />

        <NotFedTile
          title="Audit events today, and how many were critical"
          reason="There is no audit-event store in lib/domain. The screen this tile pointed at, /admin/audit-trail (FC-12 §14), renders 12 rows from a component-local array whose timestamp is a time-of-day string with no date, no site column and no severity field — so neither today, nor critical, nor a per-node total is derivable from it. The figure it displayed was roughly a hundred times the number of rows that screen can show."
          nearest={
            <>
              <span className="font-semibold text-[#64748B]">Open exceptions</span> — the one
              register in scope that is dated, site-keyed and carries an escalation threshold per
              kind.{" "}
              <Link
                href="/admin/audit-trail"
                className="font-semibold text-[#1B4F8B] no-underline hover:underline"
              >
                Audit trail
              </Link>{" "}
              still opens; it is the count that was invented, not the screen.
            </>
          }
        />
      </div>

      <div className="mt-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
        <p className="text-[12px] font-semibold text-[#0F172A]">
          And no trend arrows — five of them were removed, not recalculated
        </p>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
          A delta needs two points in time. Every fixture in this demo is a single snapshot at{" "}
          {formatDateTime(DEMO_NOW)}, so there is no yesterday to compare against and no arrow that
          could point anywhere. {spanSentence} Nothing in the row above carries a trend, and the tile
          component has no prop for one.
        </p>
      </div>
    </SiteCard>
  );
}
