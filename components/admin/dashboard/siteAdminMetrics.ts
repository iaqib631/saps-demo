/**
 * Every figure the /admin dashboard is allowed to print, derived in one place.
 *
 * WHY THIS FILE EXISTS. The six tiles above this dashboard were string
 * literals — "184" active users, "9" locked, "87%" integration health, "1,247"
 * audit events, each with an invented arrow beside it. Nothing fed any of
 * them. The HQ console (components/hq/**) was built the other way round, under
 * the rule that a tile either names the lib/domain function it came from or is
 * not drawn, and its own "not shown, and why" card cites these exact six
 * numbers as the failure mode it refuses. The counter-exemplar was the one on
 * the more-travelled path: /admin is what a client reaches from the landing
 * page, and a dashboard that looks authoritative and is invented is the worst
 * outcome available.
 *
 * So this module is the answer to "what CAN a site-tier administration screen
 * honestly say?". It is deliberately small. Five figures survived; four of the
 * six original tiles could not be fed at all and are stated as gaps on the
 * screen rather than deleted (components/admin/dashboard/NotShownOnDashboard.tsx).
 *
 * SITE-SCOPED, NOT ESTATE-WIDE. This is the Warehouse portal's per-site
 * administration home — FC-12 §01, "per-site node — KHI / LHE / PEW, each
 * owning its cargo, storage and finance data". Every query below takes the
 * active `SiteScope` from components/site/SiteContext.tsx. The cross-site read
 * is a different tier (§02) and lives on /hq. Where a store genuinely has no
 * site column — the gateway board is the one that matters here — nothing is
 * split three ways to fake a per-node number; the screen says so instead.
 *
 * NO TRENDS, BY CONSTRUCTION. Nothing in this file returns a delta and nothing
 * should. A delta needs two points in time and every fixture in this repo is a
 * single snapshot at DEMO_NOW. `failedEvents` carries the AGE of the oldest and
 * newest failure precisely because that is the honest replacement for the
 * "Last 24 hours · +5" the tile used to claim: at KHI the failures span 32
 * days, so the old subtitle was not merely unfed, it was wrong.
 */

import {
  DEMO_NOW,
  SITES,
  daysBetween,
  listExceptionQueue,
  listIataMessages,
  listNotifications,
  type SiteCode,
  type SiteScope,
} from "@/lib/domain";
import {
  ROLE_SLUGS,
  delegationsForSite,
  listDelegations,
  type RoleSlug,
} from "@/lib/domain/access";

export interface SiteAdminMetrics {
  scope: SiteScope;
  /** "KHI" at a node, "all three nodes" in HQ scope. Used in tile detail text. */
  scopeLabel: string;
  /** The nodes this scope covers — one, or all three in HQ scope. */
  siteCodes: SiteCode[];

  administrators: {
    /** Active delegations whose authority reaches this scope. */
    inForce: number;
    /** Of those, the ones issued FOR this node. */
    ownSite: number;
    /** Of those, HQ cross-site grants — in force at every node (FC-12 §02). */
    crossSite: number;
    names: string[];
    /** Nodes in scope with no active delegation of their own. */
    unadministered: SiteCode[];
  };

  revoked: {
    count: number;
    /** `revokedReason` verbatim — the withdrawal is the record, not a status. */
    reasons: string[];
  };

  roles: {
    /** ROLE_SLUGS.length. Estate-wide vocabulary, not a per-node count. */
    vocabulary: number;
    /** The subset actually granted by the delegations in force here. */
    grantedHere: RoleSlug[];
  };

  failedEvents: {
    total: number;
    iata: number;
    notification: number;
    /** Whole days between the oldest/newest failure and DEMO_NOW. */
    oldestDaysAgo: number | null;
    newestDaysAgo: number | null;
  };

  exceptions: {
    open: number;
    overThreshold: number;
  };
}

export function siteAdminMetrics(scope: SiteScope): SiteAdminMetrics {
  const siteCodes: SiteCode[] = scope === "HQ" ? SITES.map((s) => s.code) : [scope];
  const scopeLabel = scope === "HQ" ? "all three nodes" : scope;

  /* --- Administrators (FC-12 §05) ------------------------------------
     `listDelegations` is the right query rather than `delegationsForSite`
     because a delegation whose scope is "HQ" is in force at EVERY node —
     access.ts states this — so asking for PEW must return PEW's own grants
     plus the cross-site one. The two are counted separately below, because
     "PEW is covered" and "PEW is covered only from Islamabad" are different
     facts and PEW is currently the second.

     Read from the fixture rather than from components/hq/DelegationStore.tsx:
     that provider is mounted in app/(hq)/layout.tsx only, and a site screen
     reaching into the HQ portal's session state would be a tier inversion. */
  const active = listDelegations(scope, true);
  const crossSite = active.filter((d) => d.scope === "HQ").length;

  const unadministered = siteCodes.filter(
    (code) => delegationsForSite(code, true).length === 0,
  );

  /* --- Withdrawn authority --------------------------------------------
     `IsActive: false` on the audit columns, which is what makes a grant
     revocable rather than deleted. Scoped through `delegationsForSite` so
     only grants issued for these nodes count. */
  const revokedRows = siteCodes.flatMap((code) =>
    delegationsForSite(code, false).filter((d) => !d.IsActive),
  );

  /* --- Roles (FC-12 §04) ----------------------------------------------
     ROLE_SLUGS is estate-wide — there is one vocabulary behind all three
     nodes — so only the second half of this figure is site-scoped: which of
     the seventeen any delegation in force here actually grants. */
  const grantedHere = ROLE_SLUGS.filter((slug) => active.some((d) => d.roles.includes(slug)));

  /* --- Failed integration events (FC-12 §09, §12) ----------------------
     The two message stores that carry a real `site` column. Gateway health
     itself does not (see NotShownOnDashboard), but the traffic through the
     gateways does, so "what failed at THIS node" is answerable where "how
     healthy is this node's gateway" is not. */
  const failedIata = listIataMessages(scope).filter((m) => m.status === "failed");
  const failedNotifications = listNotifications(scope).filter((n) => n.status === "failed");
  const stamps = [
    ...failedIata.map((m) => m.timestamp),
    ...failedNotifications.map((n) => n.queuedAt),
  ].map((t) => daysBetween(t, DEMO_NOW));

  /* --- Open exceptions ------------------------------------------------- */
  const queue = listExceptionQueue(scope);

  return {
    scope,
    scopeLabel,
    siteCodes,
    administrators: {
      inForce: active.length,
      ownSite: active.length - crossSite,
      crossSite,
      names: active.map((d) => d.name),
      unadministered,
    },
    revoked: {
      count: revokedRows.length,
      reasons: revokedRows.map((d) => d.revokedReason ?? "No reason recorded."),
    },
    roles: {
      vocabulary: ROLE_SLUGS.length,
      grantedHere,
    },
    failedEvents: {
      total: failedIata.length + failedNotifications.length,
      iata: failedIata.length,
      notification: failedNotifications.length,
      oldestDaysAgo: stamps.length ? Math.max(...stamps) : null,
      newestDaysAgo: stamps.length ? Math.min(...stamps) : null,
    },
    exceptions: {
      open: queue.length,
      overThreshold: queue.filter((q) => q.overThreshold).length,
    },
  };
}

/** "today", "yesterday", "3 days ago" — for an age already measured in days. */
export function daysAgoLabel(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}
