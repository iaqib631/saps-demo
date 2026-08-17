"use client";

/**
 * The /admin KPI row — what a site-tier administration screen can honestly say.
 *
 * This replaces six hard-coded tiles. Five figures survived the test "is there
 * a real function over real fixtures, scoped to THIS node, behind it?"; the
 * four that failed it are stated as gaps in NotShownOnDashboard.tsx rather than
 * quietly dropped. The mapping, tile for tile:
 *
 *   was "Active Users 184 / +12"         → Administrators in force (real)
 *                                          + the sessions gap, stated
 *   was "Locked Users 9 / -3"            → Authority withdrawn (real)
 *                                          + the locked-accounts gap, stated
 *   was "Roles Configured 17"            → Roles granted here / 17 (real; the
 *                                          17 turned out to be right, the
 *                                          "6 system, 11 custom" did not)
 *   was "Integration Health 87% / -2"    → cannot be fed per node, stated
 *   was "Failed Events 23 / +5"          → Failed integration events (real)
 *   was "Audit Events Today 1,247"       → cannot be fed, stated; open
 *                                          exceptions is the real register
 *
 * NOT ONE STRING LITERAL IN THIS FILE IS A FIGURE. Every number is computed at
 * render from siteAdminMetrics(scope), so a fixture change moves the row with
 * it, and switching KHI → LHE → PEW in the header switcher moves all five —
 * which is the point, since the tiles used to read identically at all three.
 */

import { useMemo } from "react";
import { useSite } from "@/components/site/SiteContext";
import { SiteStat } from "./SiteKpiUi";
import { daysAgoLabel, siteAdminMetrics } from "./siteAdminMetrics";

export default function SiteAdminKpis() {
  const { scope } = useSite();
  const m = useMemo(() => siteAdminMetrics(scope), [scope]);

  const here = scope === "HQ" ? "across all three nodes" : `at ${scope}`;

  /* Administrators — the node's own grants and the HQ cross-site one are
     counted apart. PEW reads 1 in force and 0 of its own: the only authority
     over that node is issued from Islamabad, which a bare headcount would
     hide. */
  const ownAdmins = m.administrators.ownSite;
  const adminSeverity =
    m.administrators.unadministered.length > 0 ? "critical" : ownAdmins === 1 ? "warning" : "good";
  const adminStatus =
    m.administrators.unadministered.length > 0
      ? scope === "HQ"
        ? `${m.administrators.unadministered.join(", ")} uncovered`
        : "No local admin"
      : ownAdmins === 1
        ? "Single point"
        : "Covered";

  const failed = m.failedEvents;

  /* Land on whichever register actually holds these failures — at KHI they are
     all notification dispatches, at PEW the single one is a Cargo-IMP message.
     A fixed link would send the client to an empty screen at one of the two. */
  const failedHref = failed.iata >= failed.notification ? "/messaging/iata" : "/messaging/notifications";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
      <SiteStat
        label="Administrators in force"
        value={String(m.administrators.inForce)}
        severity={adminSeverity}
        status={adminStatus}
        detail={
          `${ownAdmins} delegated ${ownAdmins === 1 ? "grant" : "grants"} ${here}` +
          (m.administrators.crossSite > 0
            ? ` · ${m.administrators.crossSite} HQ cross-site ${m.administrators.crossSite === 1 ? "grant" : "grants"}, in force at every node`
            : "") +
          (m.administrators.unadministered.length > 0
            ? ` · nobody holds a local grant${scope === "HQ" ? ` at ${m.administrators.unadministered.join(", ")}` : ""}`
            : "")
        }
        // No link: the delegation register is not mirrored onto /admin/users
        // yet (lib/domain/access.ts, DELEGATION_LIMITS), so an "Open" here
        // would promise a screen that does not show these rows.
        source="listDelegations(scope, true) · lib/domain/access.ts"
      />

      <SiteStat
        label="Authority withdrawn"
        value={String(m.revoked.count)}
        severity={m.revoked.count > 0 ? "warning" : "neutral"}
        detail={
          m.revoked.count === 0
            ? `No delegation issued ${here} has been revoked.`
            : // The reason is the record. A revoked grant with no stated cause
              // is the thing an auditor asks about, so the first one renders
              // verbatim rather than being summarised into a status word.
              m.revoked.reasons[0] +
              (m.revoked.count > 1 ? ` · and ${m.revoked.count - 1} more.` : "")
        }
        source="delegationsForSite(site) where IsActive is false · lib/domain/access.ts"
      />

      <SiteStat
        label="Roles granted here"
        value={`${m.roles.grantedHere.length} / ${m.roles.vocabulary}`}
        detail={
          `${m.roles.vocabulary} role slugs exist estate-wide — one vocabulary behind all three nodes, so that half is not per-site. ` +
          (m.roles.grantedHere.length === 0
            ? "None is granted by any delegation in force here."
            : `Granted ${here}: ${m.roles.grantedHere.join(", ")}.`)
        }
        source="ROLE_SLUGS ∩ roles on delegations in force · lib/domain/access.ts"
        href="/admin/roles"
      />

      <SiteStat
        label="Failed integration events"
        value={String(failed.total)}
        severity={failed.total === 0 ? "good" : "warning"}
        detail={
          failed.total === 0
            ? `No failed Cargo-IMP message or notification dispatch ${here}.`
            : `${failed.iata} Cargo-IMP · ${failed.notification} notification dispatch. ` +
              // Not "last 24 hours" — the old subtitle claimed a window these
              // fixtures do not have. The real span is printed instead.
              (failed.oldestDaysAgo === failed.newestDaysAgo
                ? `Recorded ${daysAgoLabel(failed.newestDaysAgo ?? 0)}.`
                : `Newest ${daysAgoLabel(failed.newestDaysAgo ?? 0)}, oldest ${daysAgoLabel(failed.oldestDaysAgo ?? 0)} — not a rolling window.`)
        }
        source="listIataMessages(scope) + listNotifications(scope), status failed · lib/domain"
        href={failed.total > 0 ? failedHref : undefined}
      />

      <SiteStat
        label="Open exceptions"
        value={String(m.exceptions.open)}
        severity={
          m.exceptions.overThreshold > 0 ? "critical" : m.exceptions.open > 0 ? "warning" : "good"
        }
        status={m.exceptions.overThreshold > 0 ? "Past threshold" : undefined}
        detail={
          m.exceptions.open === 0
            ? `Nothing open on the exception register ${here}.`
            : `${m.exceptions.overThreshold} of ${m.exceptions.open} past the escalation threshold for their kind.`
        }
        source="listExceptionQueue(scope) · lib/domain/exceptions.ts"
        href={m.exceptions.open > 0 ? "/exceptions/queue" : undefined}
      />
    </div>
  );
}
