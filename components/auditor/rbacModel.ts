/**
 * The RBAC snapshot — FC-12 §06, "who could see what, as at a date".
 *
 * WHAT WAS HERE BEFORE. Fifteen rows of a component-local array naming seven
 * people who exist in no fixture, against six boolean permissions (view /
 * create / update / delete / approve / export) per screen, with a
 * `lastChangedBy` of "sys_admin" and a snapshot-date picker that filtered
 * nothing. lib/domain/access.ts names that array explicitly as one of the four
 * disjoint identity vocabularies in this demo — "7 different users, no site
 * column" — and it was the only one an auditor was being shown.
 *
 * WHAT FEEDS IT NOW. `SiteAdminDelegation` is a real, site-keyed, revocable
 * record with the six CMTS audit columns on it, and `effectiveRights()` already
 * computes requested-versus-effective depth per surface against
 * PORTAL_GRANT_CEILING. So the grid below is the same grid — one row per
 * principal per surface — with the six invented booleans replaced by the depth
 * model the domain actually has, and `lastChangedBy` replaced by CreatedBy /
 * UpdatedBy read off the row.
 *
 * "AS AT A DATE" IS REAL, AND PARTIALLY SO — which is the interesting part.
 * A delegation carries CreatedDate and, when withdrawn, UpdatedDate. That is
 * genuinely enough to answer §06's question about EXISTENCE: DLG-KHI-0003 was
 * issued on 02 Mar 2026 and cannot appear in a snapshot taken in February, and
 * DLG-PEW-0006 was in force until 21 Jul 2026 and must appear in a snapshot
 * taken in June even though it is revoked today. The date picker therefore does
 * something, and the PEW node — which has no administrator now — had one three
 * months ago, which is exactly the kind of finding this screen exists to
 * produce.
 *
 * WHAT "AS AT" CANNOT DO, and the screen says so rather than implying
 * otherwise: the surfaces and roles ON a delegation are not versioned. There is
 * one `surfaces` map per row and no history of it, so a snapshot taken in March
 * shows March's PRINCIPALS with TODAY'S depths. Rolling depth back would need a
 * change log that does not exist, and inventing one would put a false grant
 * history in front of an auditor — the worst possible thing for this particular
 * screen to be wrong about.
 */

import { DEMO_NOW } from "@/lib/domain";
import {
  SITE_ADMIN_SURFACES,
  effectiveRights,
  listDelegations,
  type DelegationDepth,
  type RoleSlug,
  type SiteAdminDelegation,
  type SiteAdminSurfaceSpec,
} from "@/lib/domain/access";
import type { SiteScope } from "@/lib/domain";

export interface RbacRow {
  key: string;
  delegationId: string;
  name: string;
  username: string;
  email: string;
  scope: SiteScope;
  roles: RoleSlug[];
  surface: SiteAdminSurfaceSpec;
  requested: DelegationDepth;
  effective: DelegationDepth;
  /** Set where PORTAL_GRANT_CEILING trimmed what the grant asked for. */
  cappedBy: string | null;
  /** In force at the snapshot instant — not the same as in force today. */
  inForce: boolean;
  grantedBy: string;
  grantedAt: string;
  changedBy: string | null;
  changedAt: string | null;
  revokedReason: string | null;
}

export interface RbacSnapshot {
  asAt: string;
  rows: RbacRow[];
  /** Distinct principals that existed at the snapshot instant. */
  principals: number;
  inForce: number;
  /** Existed then, withdrawn on or before the snapshot instant. */
  withdrawnByThen: number;
  /** Delegations issued AFTER the snapshot instant — correctly absent. */
  notYetIssued: number;
  /** Rows where the requested depth did not survive the ceiling. */
  capped: number;
  /** Rows whose withdrawal carries no UpdatedDate, so cannot be placed in time. */
  undatable: number;
}

/** Was this grant in force at `asAt`? Three states, no guessing between them. */
function statusAt(
  d: SiteAdminDelegation,
  asAt: number,
): "not-yet-issued" | "in-force" | "withdrawn" | "undatable" {
  if (Date.parse(d.CreatedDate) > asAt) return "not-yet-issued";
  if (d.IsActive) return "in-force";
  if (!d.UpdatedDate) return "undatable";
  return Date.parse(d.UpdatedDate) > asAt ? "in-force" : "withdrawn";
}

export function rbacSnapshot(
  asAtIso: string = DEMO_NOW,
  scope: SiteScope = "HQ",
  from?: SiteAdminDelegation[],
): RbacSnapshot {
  const asAt = Date.parse(asAtIso);
  const all = from ? listDelegations(scope, false, from) : listDelegations(scope, false);

  const rows: RbacRow[] = [];
  let principals = 0;
  let inForceCount = 0;
  let withdrawnByThen = 0;
  let notYetIssued = 0;
  let undatable = 0;
  let capped = 0;

  for (const d of all) {
    const status = statusAt(d, asAt);
    if (status === "not-yet-issued") {
      notYetIssued += 1;
      continue;
    }
    principals += 1;
    if (status === "in-force") inForceCount += 1;
    if (status === "withdrawn") withdrawnByThen += 1;
    if (status === "undatable") undatable += 1;

    for (const right of effectiveRights(d)) {
      if (right.requested === null || right.effective === null) continue;
      if (right.cappedBy) capped += 1;
      rows.push({
        key: `${d.delegationId}-${right.surface.key}`,
        delegationId: d.delegationId,
        name: d.name,
        username: d.username,
        email: d.email,
        scope: d.scope,
        roles: d.roles,
        surface: right.surface,
        requested: right.requested,
        effective: right.effective,
        cappedBy: right.cappedBy,
        inForce: status === "in-force",
        grantedBy: d.CreatedBy,
        grantedAt: d.CreatedDate,
        changedBy: d.UpdatedBy,
        changedAt: d.UpdatedDate,
        revokedReason: d.revokedReason,
      });
    }
  }

  /* Stable order: principal, then the surface order SITE_ADMIN_SURFACES
     declares, so the grid reads the way the role matrix at /admin/roles does
     rather than the way the fixture happens to be written. */
  const surfaceOrder = new Map(SITE_ADMIN_SURFACES.map((s, i) => [s.key, i]));
  rows.sort(
    (a, b) =>
      a.username.localeCompare(b.username) ||
      (surfaceOrder.get(a.surface.key) ?? 0) - (surfaceOrder.get(b.surface.key) ?? 0),
  );

  return {
    asAt: asAtIso,
    rows,
    principals,
    inForce: inForceCount,
    withdrawnByThen,
    notYetIssued,
    capped,
    undatable,
  };
}

/**
 * The dates on which the snapshot actually changes — every CreatedDate and
 * every UpdatedDate in the register. Offered beside the date picker so a
 * reviewer can jump to an instant where something is different, rather than
 * hunting for one; a picker whose every value returns the same grid looks
 * broken even when it is correct.
 */
export function snapshotBoundaries(from?: SiteAdminDelegation[]): Array<{
  date: string;
  label: string;
}> {
  const rows = from ? listDelegations("HQ", false, from) : listDelegations("HQ", false);
  const marks = new Map<string, string>();
  for (const d of rows) {
    marks.set(d.CreatedDate.slice(0, 10), `${d.delegationId} issued to ${d.username}`);
    if (d.UpdatedDate) {
      marks.set(
        d.UpdatedDate.slice(0, 10),
        d.IsActive
          ? `${d.delegationId} amended`
          : `${d.delegationId} withdrawn from ${d.username}`,
      );
    }
  }
  marks.set(DEMO_NOW.slice(0, 10), "Today — the state every other screen shows");
  return [...marks.entries()]
    .map(([date, label]) => ({ date, label }))
    .sort((a, b) => a.date.localeCompare(b.date));
}
