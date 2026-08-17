/**
 * AirVault domain — site-administration delegations (the HQ write side).
 *
 * WHY THIS FILE EXISTS. There is no users/roles/permissions model anywhere else
 * in `lib/domain`. Four disjoint vocabularies hold identity today, each inside
 * the component that renders it:
 *
 *   components/admin/users/UsersContent.tsx        12 users, site hinted only by
 *                                                  a free-text `groups` string
 *   components/auditor/rbac-snapshot/…             7 different users, no site
 *   components/admin/roles/RolesContent.tsx        17 role slugs × 78 modules
 *   components/admin/roles/requestedRoles.ts       4 requestable role names
 *
 * None of them shares a key with any other, so "who administers PEW" is a
 * question the demo cannot answer. FC-12 §02 gives that question to HQ, and
 * `masters.ts` states the division in as many words: "HQ creates sites +
 * site-admins; each site-admin manages its own users." Note carefully that this
 * is a CODE COMMENT, not an FC-12 step — no step draws site-admin creation. So
 * this module is an **AirVault addition on §02**, labelled the way `settings.ts`
 * and `airmail.ts` label theirs, not a claim about the flow document.
 *
 * WHAT HQ ACTUALLY CREATES — A DELEGATION, NOT A PERSON.
 * HQ does not create people at sites; the site's own /admin/users does that.
 * HQ creates the record that says *this principal may administer that node, to
 * this depth* — and, uniquely, the cross-site grant, which is the one grant
 * app/(admin)/layout.tsx says the site tier may not issue. That is why the
 * delegation, not the user, is the entity here.
 *
 * NAMING. Two column families are reused verbatim rather than re-spelled:
 * `SiteKeys` (CityId / Comp_Code / Off_Code — what a per-site write is actually
 * keyed on) and `AuditColumns` (the six on ~60 CMTS tables, which is what makes
 * a delegation REVOCABLE via IsActive: false rather than deleted). Everything
 * else is camelCase because it is an AirVault addition.
 *
 * NO INVENTED CMTS COLUMNS. There is no CMTS identity table in evidence —
 * `CEmployee` / `SHIFT` are HR establishment (gap G10), not identity — so
 * nothing here is spelled in the uppercase legacy style. `settings.ts` set the
 * precedent by explicitly refusing to invent `LOOKUPKEY` / `SETTINGVALUE`, and
 * an uppercase name that no table owns is worse than a camelCase one that
 * claims nothing.
 *
 * DELIBERATELY NOT EXPORTED FROM ./index. Screens import it as
 * `@/lib/domain/access`. The barrel re-exports the modules the whole product
 * reads; this one is read by the HQ portal and, when /admin/users is pointed at
 * `delegationsForSite()`, by exactly one site screen.
 */

import type { AuditColumns, SiteCode, SiteKeys, SiteScope } from "./common";
import { DEMO_NOW } from "./common";
import { SITES } from "./masters";

/* ================================================================== *
 * Vocabulary 1 — role slugs
 *
 * The seventeen slugs an administrator GRANTS, quoted from
 * components/admin/roles/RolesContent.tsx in its own order. They are
 * re-declared here rather than imported because that file holds them in a
 * component-local `const` with no export; when /admin/roles is rewired to
 * read the domain it should import THIS and delete its copy, not the other
 * way round. Do not mint a fifth vocabulary — the four public-facing names
 * in components/admin/roles/requestedRoles.ts are what a person ASKS for and
 * stay on the request side, which is /admin/users, not here.
 * ================================================================== */

export type RoleSlug =
  | "warehouse_manager"
  | "gate_entry"
  | "lifter_operator"
  | "excise_compliance"
  | "finance_manager"
  | "planner"
  | "ops_supervisor"
  | "fa_admin"
  | "fa_user"
  | "cha_admin"
  | "cha_user"
  | "consignee"
  | "gse_manager"
  | "hr_admin"
  | "hr_user"
  | "sys_admin"
  | "auditor";

export const ROLE_SLUGS: RoleSlug[] = [
  "warehouse_manager",
  "gate_entry",
  "lifter_operator",
  "excise_compliance",
  "finance_manager",
  "planner",
  "ops_supervisor",
  "fa_admin",
  "fa_user",
  "cha_admin",
  "cha_user",
  "consignee",
  "gse_manager",
  "hr_admin",
  "hr_user",
  "sys_admin",
  "auditor",
];

/* ================================================================== *
 * Vocabulary 2 — the site-administration surfaces a delegation covers
 *
 * Labels are RolesContent's own "Admin — …" matrix rows, verbatim, so an
 * approver reading a delegation can find the exact rows to tick in the
 * matrix. Eight rows cover the nine /admin/* routes: the lookup registry is
 * a sub-screen of System Settings and the matrix has never given it a row of
 * its own, which is a fact about the matrix, not an omission here.
 * ================================================================== */

export type SiteAdminSurface =
  | "admin-dashboard"
  | "admin-users"
  | "admin-roles"
  | "admin-master-data"
  | "admin-integrations"
  | "admin-settings"
  | "admin-audit-trail"
  | "admin-event-log";

export interface SiteAdminSurfaceSpec {
  key: SiteAdminSurface;
  /** RolesContent matrix row label, verbatim. */
  label: string;
  href: string;
  /** The FC-12 step this surface serves. Checked against lib/architecture.ts. */
  flowRef: string;
  /**
   * True where the grant itself is HQ's to make. A site administrator may
   * operate these screens; it may not widen its own authority over them.
   */
  hqReserved: boolean;
  note: string;
}

export const SITE_ADMIN_SURFACES: SiteAdminSurfaceSpec[] = [
  {
    key: "admin-dashboard",
    label: "Admin — Dashboard",
    href: "/admin",
    flowRef: "FC-12 §01",
    hqReserved: false,
    note: "The node's own administration home.",
  },
  {
    key: "admin-users",
    label: "Admin — Users",
    href: "/admin/users",
    flowRef: "FC-12 §05",
    hqReserved: false,
    note: "People at this site. The site tier owns this outright — it is the half of the split HQ does not do.",
  },
  {
    key: "admin-roles",
    label: "Admin — Roles & Permissions",
    href: "/admin/roles",
    flowRef: "FC-12 §04",
    hqReserved: true,
    note: "A site admin grants roles inside its own node; which PORTALS it may grant into is set at HQ — see PORTAL_GRANT_CEILING.",
  },
  {
    key: "admin-master-data",
    label: "Admin — Master Data Editor",
    href: "/admin/master-data",
    flowRef: "FC-12 §07",
    hqReserved: false,
    note: "Estate-wide store with no site column — see ESTATE_WIDE_STORES.",
  },
  {
    key: "admin-integrations",
    label: "Admin — Integration Console",
    href: "/admin/integrations",
    flowRef: "FC-12 §13",
    hqReserved: false,
    note: "Connector register for this node.",
  },
  {
    key: "admin-settings",
    label: "Admin — System Settings",
    href: "/admin/settings",
    flowRef: "FC-12 §01",
    hqReserved: false,
    note: "Includes the lookup registry at /admin/settings/lookup-registry, which the matrix folds into this row.",
  },
  {
    key: "admin-audit-trail",
    label: "Admin — Audit Trail",
    href: "/admin/audit-trail",
    flowRef: "FC-12 §14",
    hqReserved: false,
    note: "The node's own trail. The cross-site read is /auditor/* (§16 / §17).",
  },
  {
    key: "admin-event-log",
    label: "Admin — Session & Event Log",
    href: "/admin/event-log",
    flowRef: "FC-12 §15",
    hqReserved: false,
    note: "The node's own sessions.",
  },
];

/* ================================================================== *
 * Depth
 * ================================================================== */

/**
 * How far a delegation reaches on a surface.
 *
 *   read       may open the screen, may not change it
 *   administer may operate the screen for its own node
 *   delegate   may additionally grant this surface onward to another
 *              principal at the same node — the recursive one, and the reason
 *              a ceiling exists at all
 */
export type DelegationDepth = "read" | "administer" | "delegate";

export const DEPTH_ORDER: DelegationDepth[] = ["read", "administer", "delegate"];

export const DEPTH_LABEL: Record<DelegationDepth, string> = {
  read: "Read",
  administer: "Administer",
  delegate: "Administer + delegate",
};

export function depthRank(d: DelegationDepth | null): number {
  return d === null ? -1 : DEPTH_ORDER.indexOf(d);
}

/* ================================================================== *
 * The delegation
 * ================================================================== */

export interface SiteAdminDelegation extends AuditColumns {
  /** AirVault addition — no CMTS ancestor, so the ref is not a legacy sequence. */
  delegationId: string;

  /* Identity — the five fields components/admin/users/UserDrawer already
     captures, spelled identically so a third identity shape is not born. */
  userId: string;
  username: string;
  name: string;
  email: string;
  mobile: string;

  /**
   * The node this delegation administers, or "HQ" for the cross-site grant.
   * `SiteScope` is the same primitive every domain query already takes.
   */
  scope: SiteScope;
  /**
   * The CMTS keys a per-site write lands on. Null when scope is "HQ", because
   * "all sites" has no single key triple — the same reason
   * app/(admin)/layout.tsx swaps to a notice in that scope.
   */
  keys: SiteKeys | null;

  /** Granted role slugs, from ROLE_SLUGS. */
  roles: RoleSlug[];
  /** Depth per surface. A surface absent from the map is not granted. */
  surfaces: Partial<Record<SiteAdminSurface, DelegationDepth>>;

  /** Free-text reason the grant exists — what an approver reads. */
  justification: string;
  /** Set when IsActive is false: why authority was withdrawn. */
  revokedReason: string | null;
}

/* ================================================================== *
 * Fixtures
 *
 * Deterministic and deliberately ASYMMETRIC, in the same spirit as the
 * `SITES` sync state above it: KHI is healthy, LHE is thin, and **PEW has no
 * active administrator at all** — its one delegation was withdrawn when the
 * node dropped off sync. PEW is already the stale node (17 pending, last sync
 * 11:04) and already owns the only cross-site consignment whose bond
 * continuity is unverified. Three independent facts about one node, each
 * readable only from the HQ tier, is the thing this portal is for.
 *
 * Identity for the two KHI principals is lifted from
 * components/admin/users/UsersContent.tsx unchanged (USR-002, USR-007) and
 * the revoked LHE grant belongs to its USR-008, whose directory status there
 * is already "Disabled" — the two stores agree rather than contradict.
 * ================================================================== */

const KEYS: Record<SiteCode, SiteKeys> = SITES.reduce(
  (acc, s) => {
    acc[s.code] = { CityId: s.CityId, Comp_Code: s.Comp_Code, Off_Code: s.Off_Code };
    return acc;
  },
  {} as Record<SiteCode, SiteKeys>,
);

/** Every surface at one depth — the shape a full site administrator holds. */
function allSurfaces(depth: DelegationDepth): Partial<Record<SiteAdminSurface, DelegationDepth>> {
  return Object.fromEntries(SITE_ADMIN_SURFACES.map((s) => [s.key, depth])) as Partial<
    Record<SiteAdminSurface, DelegationDepth>
  >;
}

export const SITE_ADMIN_DELEGATIONS: SiteAdminDelegation[] = [
  {
    delegationId: "DLG-HQ-0001",
    userId: "USR-100",
    username: "hq.oversight",
    name: "Imran Baig",
    email: "imran.baig@shaheen-airport.com",
    mobile: "+92 300 4410092",
    scope: "HQ",
    keys: null,
    roles: ["sys_admin", "auditor"],
    surfaces: { ...allSurfaces("delegate") },
    justification:
      "The root cross-site grant, issued at cutover. This is the principal recorded as hqApprovedBy on the inter-station handoff in lib/domain/transhipment.ts — the register is where that name stops being an unexplained string.",
    revokedReason: null,
    CreatedBy: "system.migration",
    UpdatedBy: null,
    CreatedDate: "2026-01-04T09:00:00+05:00",
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
  },
  {
    delegationId: "DLG-KHI-0002",
    userId: "USR-002",
    username: "fatima.rizvi",
    name: "Fatima Rizvi",
    email: "fatima@shaheen-airport.com",
    mobile: "+92 321 9876543",
    scope: "KHI",
    keys: KEYS.KHI,
    roles: ["sys_admin", "ops_supervisor"],
    surfaces: {
      ...allSurfaces("administer"),
      "admin-users": "delegate",
      // Asks for delegate depth on an HQ-reserved surface. Kept as written
      // rather than trimmed to what the ceiling allows, because requested and
      // effective are different facts and flattening them loses the audit: a
      // reviewer needs to see that KHI asked to hand the role matrix onward and
      // that PORTAL_GRANT_CEILING is what stopped it. effectiveRights() applies
      // the cap on read.
      "admin-roles": "delegate",
    },
    justification:
      "Site administrator for Karachi. Delegates user administration onward to shift leads, and asked for the same on the role matrix — that half is capped, because widening the grant surface is HQ's.",
    revokedReason: null,
    CreatedBy: "hq.oversight",
    UpdatedBy: null,
    CreatedDate: "2026-01-11T10:20:00+05:00",
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
  },
  {
    delegationId: "DLG-KHI-0003",
    userId: "USR-007",
    username: "kamran.malik",
    name: "Kamran Malik",
    email: "kamran@shaheen-airport.com",
    mobile: "+92 334 9988776",
    scope: "KHI",
    keys: KEYS.KHI,
    roles: ["ops_supervisor"],
    surfaces: {
      "admin-dashboard": "read",
      "admin-users": "administer",
      "admin-audit-trail": "read",
      "admin-event-log": "read",
    },
    justification: "Deputy cover for KHI. Users only — no settings, no master data, no roles.",
    revokedReason: null,
    CreatedBy: "hq.oversight",
    UpdatedBy: null,
    CreatedDate: "2026-03-02T11:45:00+05:00",
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
  },
  {
    delegationId: "DLG-LHE-0004",
    userId: "USR-013",
    username: "saira.mahmud",
    name: "Saira Mahmud",
    email: "saira@shaheen-airport.com",
    mobile: "+92 300 7781204",
    scope: "LHE",
    keys: KEYS.LHE,
    roles: ["sys_admin"],
    surfaces: {
      ...allSurfaces("administer"),
      "admin-roles": "read",
    },
    justification:
      "Sole site administrator for Lahore. Roles are read-only pending a second approver at the node — a single principal holding both users and roles has no separation of duties.",
    revokedReason: null,
    CreatedBy: "hq.oversight",
    UpdatedBy: null,
    CreatedDate: "2026-02-17T09:30:00+05:00",
    UpdatedDate: null,
    IsActive: true,
    IsDeleted: false,
  },
  {
    delegationId: "DLG-LHE-0005",
    userId: "USR-008",
    username: "azeem.qureshi",
    name: "Azeem Qureshi",
    email: "azeem@shaheen-airport.com",
    mobile: "+92 311 2233445",
    scope: "LHE",
    keys: KEYS.LHE,
    roles: ["fa_user"],
    surfaces: { "admin-dashboard": "read", "admin-users": "read" },
    justification: "Temporary read cover during the Lahore handover.",
    revokedReason: "Cover ended; the directory entry at /admin/users is Disabled and the delegation follows it.",
    CreatedBy: "hq.oversight",
    UpdatedBy: "hq.oversight",
    CreatedDate: "2026-04-08T14:00:00+05:00",
    UpdatedDate: "2026-06-30T16:10:00+05:00",
    IsActive: false,
    IsDeleted: false,
  },
  {
    delegationId: "DLG-PEW-0006",
    userId: "USR-014",
    username: "imran.durrani",
    name: "Imran Durrani",
    email: "imran.durrani@shaheen-airport.com",
    mobile: "+92 345 6620118",
    scope: "PEW",
    keys: KEYS.PEW,
    roles: ["sys_admin"],
    surfaces: { ...allSurfaces("administer") },
    justification: "Site administrator for Peshawar.",
    revokedReason:
      "Withdrawn while the node was off sync. Nothing has replaced it — PEW currently has no active administrator.",
    CreatedBy: "hq.oversight",
    UpdatedBy: "hq.oversight",
    CreatedDate: "2026-02-01T10:00:00+05:00",
    UpdatedDate: "2026-07-21T12:40:00+05:00",
    IsActive: false,
    IsDeleted: false,
  },
];

/* ================================================================== *
 * Queries
 * ================================================================== */

/**
 * Scoped exactly like every other domain query, with one difference worth
 * stating: a delegation whose scope is "HQ" is IN FORCE at every site, so
 * asking for KHI returns KHI's own grants plus the cross-site ones. `inScope`
 * in ./index filters on a `site` column and would drop them, which is why
 * this module does its own filtering rather than borrowing that helper.
 */
/**
 * Every query here takes the row set as an optional last argument, defaulting
 * to the fixture. That is what lets the HQ portal hold session-created
 * delegations in one place (components/hq/DelegationStore.tsx) and still ask
 * the domain the questions — rather than each screen re-implementing "active
 * grants at this node" over its own copy and the console and the register
 * disagreeing about whether PEW has an administrator.
 */
export function listDelegations(
  scope: SiteScope = "HQ",
  activeOnly = false,
  from: SiteAdminDelegation[] = SITE_ADMIN_DELEGATIONS,
): SiteAdminDelegation[] {
  const rows =
    scope === "HQ" ? from : from.filter((d) => d.scope === scope || d.scope === "HQ");
  return activeOnly ? rows.filter((d) => d.IsActive) : rows;
}

/** Grants issued FOR one node — excludes the cross-site ones. */
export function delegationsForSite(
  site: SiteCode,
  activeOnly = false,
  from: SiteAdminDelegation[] = SITE_ADMIN_DELEGATIONS,
): SiteAdminDelegation[] {
  const rows = from.filter((d) => d.scope === site);
  return activeOnly ? rows.filter((d) => d.IsActive) : rows;
}

/** The grants that cross nodes — the ones only HQ can issue. */
export function crossSiteDelegations(
  activeOnly = false,
  from: SiteAdminDelegation[] = SITE_ADMIN_DELEGATIONS,
): SiteAdminDelegation[] {
  const rows = from.filter((d) => d.scope === "HQ");
  return activeOnly ? rows.filter((d) => d.IsActive) : rows;
}

export interface SiteAdminCoverage {
  site: SiteCode;
  active: number;
  revoked: number;
  /** True when nobody holds an active delegation for this node. */
  unadministered: boolean;
  /** Active delegations reaching "delegate" depth on Admin — Users. */
  canDelegateUsers: number;
}

/**
 * Per-node administrator coverage.
 *
 * This is the tile no site screen can render: /admin/users at PEW can only
 * list PEW's own directory, and a node with nobody administering it looks
 * exactly like a node whose administrator is simply not logged in. Only the
 * tier that ISSUES the delegations can see the zero.
 */
export function siteAdminCoverage(
  from: SiteAdminDelegation[] = SITE_ADMIN_DELEGATIONS,
): SiteAdminCoverage[] {
  return SITES.map((s) => {
    const rows = delegationsForSite(s.code, false, from);
    const active = rows.filter((d) => d.IsActive);
    return {
      site: s.code,
      active: active.length,
      revoked: rows.filter((d) => !d.IsActive).length,
      unadministered: active.length === 0,
      canDelegateUsers: active.filter((d) => d.surfaces["admin-users"] === "delegate").length,
    };
  });
}

/* ================================================================== *
 * The ceiling — FC-12 §04, portal separation expressed as authority
 *
 * §04 draws the portals as separate surfaces. The authority question that
 * follows from it is the one no site screen can answer: which portals may a
 * SITE-tier delegation grant into? RolesContent's 17 × 78 matrix is one
 * node's grant surface and says nothing about the boundary around it.
 * ================================================================== */

export interface PortalGrantRule {
  portal: "warehouse" | "consignee" | "superadmin";
  label: string;
  /** May a site-tier delegation issue grants into this portal? */
  grantableBySiteAdmin: boolean;
  /** The maximum depth a site-tier delegation may reach in this portal. */
  ceiling: DelegationDepth | null;
  reason: string;
}

export const PORTAL_GRANT_CEILING: PortalGrantRule[] = [
  {
    portal: "warehouse",
    label: "Warehouse Portal",
    grantableBySiteAdmin: true,
    ceiling: "delegate",
    reason:
      "The per-site portal, including its own Administration block. This is precisely the authority a site administrator exists to hold.",
  },
  {
    portal: "consignee",
    label: "Consignee Portal",
    grantableBySiteAdmin: true,
    ceiling: "administer",
    reason:
      "External counterparties collecting at this node. Grantable, but not onward-delegable: a customer account that can mint further customer accounts has no owner at the terminal.",
  },
  {
    portal: "superadmin",
    label: "Superadmin Portal",
    grantableBySiteAdmin: false,
    ceiling: null,
    reason:
      "The HQ tier reads every node. A site administrator granting into it would be granting sight of the other two sites — the cross-site grant app/(admin)/layout.tsx already declines to issue.",
  },
];

/**
 * What a delegation can actually do, once the ceiling is applied.
 *
 * `requested` is what the grant records; `effective` is what survives. They
 * differ only where a surface is HQ-reserved and the delegation is a
 * site-tier one asking for delegate depth.
 */
export interface EffectiveSurfaceRight {
  surface: SiteAdminSurfaceSpec;
  requested: DelegationDepth | null;
  effective: DelegationDepth | null;
  cappedBy: string | null;
}

export function effectiveRights(d: SiteAdminDelegation): EffectiveSurfaceRight[] {
  const isHq = d.scope === "HQ";
  return SITE_ADMIN_SURFACES.map((surface) => {
    const requested = d.surfaces[surface.key] ?? null;
    if (requested === null) return { surface, requested, effective: null, cappedBy: null };
    if (!isHq && surface.hqReserved && requested === "delegate") {
      return {
        surface,
        requested,
        effective: "administer" as DelegationDepth,
        cappedBy: "HQ-reserved surface — a site-tier grant may operate it but not widen it",
      };
    }
    return { surface, requested, effective: requested, cappedBy: null };
  });
}

/* ================================================================== *
 * Site provisioning requests — the honest half of "create a site"
 *
 * `SITES` is a const. A "Create Site" button that pushes into React state and
 * evaporates on reload is a lie if it is presented as provisioning, so it is
 * not presented that way: promoting a station on the network footprint to a
 * terminal node is a REQUEST, and the request is the artefact.
 *
 * The wider footprint is not invented here either — it is the station list
 * components/admin/users/AccessRequestPanel.tsx already carries, with its own
 * reasoning: "ISB, MUX and UET are on the network footprint but not on the
 * terminal estate." Those three are exactly the promotable set.
 * ================================================================== */

export type ProvisioningStatus = "requested" | "under-review" | "approved" | "declined";

export const PROVISIONING_STATUS_LABEL: Record<ProvisioningStatus, string> = {
  requested: "Requested",
  "under-review": "Under review at HQ",
  approved: "Approved — awaiting node build",
  declined: "Declined",
};

export interface SiteProvisioningRequest {
  requestId: string;
  /** Station code from the network footprint — deliberately NOT a SiteCode. */
  station: string;
  stationName: string;
  status: ProvisioningStatus;
  requestedBy: string;
  requestedAt: string;
  decidedBy: string | null;
  decidedAt: string | null;
  note: string;
}

export const SITE_PROVISIONING_REQUESTS: SiteProvisioningRequest[] = [
  {
    requestId: "PRV-2026-0001",
    station: "ISB",
    stationName: "Islamabad — Islamabad International",
    status: "under-review",
    requestedBy: "hq.oversight",
    requestedAt: "2026-07-14T10:15:00+05:00",
    decidedBy: null,
    decidedAt: null,
    note: "HQ already sits in Islamabad as an oversight tier. Promoting it to a terminal node is a different act and needs its own storage master before a CityId is issued.",
  },
  {
    requestId: "PRV-2026-0002",
    station: "MUX",
    stationName: "Multan — Multan International",
    status: "requested",
    requestedBy: "hq.oversight",
    requestedAt: "2026-07-28T15:40:00+05:00",
    decidedBy: null,
    decidedAt: null,
    note: "Raised off access requests naming MUX as their station. No terminal, no delegations, no cargo data.",
  },
  {
    requestId: "PRV-2026-0003",
    station: "UET",
    stationName: "Quetta — Quetta International",
    status: "declined",
    requestedBy: "hq.oversight",
    requestedAt: "2026-05-06T11:05:00+05:00",
    decidedBy: "hq.oversight",
    decidedAt: "2026-05-20T09:25:00+05:00",
    note: "Declined for this phase — no bonded facility, so FC-09 handoffs could not terminate there.",
  },
];

/* ================================================================== *
 * Stores that have no site column
 *
 * Named as data so the HQ screens can state it once and identically rather
 * than each asserting it in prose. "KHI runs 2% tolerance, LHE runs 5%" is
 * unrepresentable today — there is ONE value — so no HQ screen may imply a
 * per-site override exists.
 * ================================================================== */

export interface EstateWideStore {
  label: string;
  href: string;
  detail: string;
}

export const ESTATE_WIDE_STORES: EstateWideStore[] = [
  {
    label: "System settings",
    href: "/admin/settings",
    detail: "SettingRow (lib/domain/settings.ts) carries key / value / table / origin / unit / options and no site column. One store, read by all three nodes.",
  },
  {
    label: "Cargo classes & subclasses",
    href: "/admin/master-data",
    detail: "CARGO_CLASSES and CARGO_SUBCLASSES are estate-wide taxonomy.",
  },
  {
    label: "Charge types & tariff slabs",
    href: "/admin/master-data",
    detail: "CHARGE_TYPES and TARIFF_SLABS derive from lib/domain/tariff.ts — one rate card, deliberately, so a screen and an invoice cannot disagree.",
  },
  {
    label: "Lookup registry",
    href: "/admin/settings/lookup-registry",
    detail: "One registry behind all three nodes.",
  },
];

/**
 * The one master that genuinely IS per-site. Stated alongside the list above
 * so "configuration is estate-wide" does not read as "nothing differs".
 */
export const PER_SITE_STORE: EstateWideStore = {
  label: "Storage locations",
  href: "/storage/master",
  detail:
    "STORAGE_LOCATIONS is keyed on site — 20 zones per node with their own occupancy. It is the only master data in the demo where KHI and LHE hold different rows.",
};

/* ================================================================== *
 * What a delegation is NOT
 *
 * Held as data because every HQ screen that writes a delegation has to say
 * it, and three screens paraphrasing the same limitation is how a demo comes
 * to over-claim by accident.
 * ================================================================== */

export interface DelegationLimit {
  title: string;
  detail: string;
}

export const DELEGATION_LIMITS: DelegationLimit[] = [
  {
    title: "A grant is a record, not a gate",
    detail:
      "AuthGuard redirects to /auth/permission-denied, but nothing consults a permission table. Nothing in this demo is enforced by the rows below.",
  },
  {
    title: "No credentials are issued",
    detail:
      "There is no password, no reset and no SSO here. UserDrawer already carries a dead tempPassword field; a second one would not make either of them real.",
  },
  {
    title: "No session effect",
    detail:
      "Revoking a delegation cannot invalidate a session or force re-authentication — there is no session store to revoke against.",
  },
  {
    title: "No cross-site username uniqueness",
    detail:
      "Nothing prevents the same username being delegated at two nodes. Uniqueness is a backend constraint, and there is no backend.",
  },
  {
    title: "Not yet propagated to the site tier",
    detail:
      "/admin/users still holds its directory in a component-local array, so a delegation created here does not appear there yet. Pointing that screen at delegationsForSite() is the single edit that closes the loop.",
  },
];

/* ================================================================== *
 * Staleness — shared by the console and the site register
 * ================================================================== */

export interface NodeSyncState {
  site: SiteCode;
  name: string;
  lastSyncAt: string;
  pendingOutbox: number;
  offlineCapable: boolean;
  /** Whole minutes between lastSyncAt and DEMO_NOW. */
  minutesStale: number;
  severity: "in-sync" | "lagging" | "stale";
}

/**
 * Thresholds are stated here rather than inside a component so the console
 * and the register cannot colour the same node differently. They are demo
 * conventions, not a flow requirement — FC-12 §02 names CDC / outbox sync but
 * sets no interval.
 */
export const SYNC_LAG_MINUTES = { lagging: 15, stale: 60 };

export function nodeSyncStates(nowIso: string = DEMO_NOW): NodeSyncState[] {
  const now = Date.parse(nowIso);
  return SITES.map((s) => {
    const minutesStale = Math.max(0, Math.floor((now - Date.parse(s.lastSyncAt)) / 60000));
    const severity: NodeSyncState["severity"] =
      minutesStale >= SYNC_LAG_MINUTES.stale
        ? "stale"
        : minutesStale >= SYNC_LAG_MINUTES.lagging || s.pendingOutbox > 0
          ? "lagging"
          : "in-sync";
    return {
      site: s.code,
      name: s.name,
      lastSyncAt: s.lastSyncAt,
      pendingOutbox: s.pendingOutbox,
      offlineCapable: s.offlineCapable,
      minutesStale,
      severity,
    };
  });
}

export function formatLag(minutes: number): string {
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}h ago` : `${h}h ${m}m ago`;
}
