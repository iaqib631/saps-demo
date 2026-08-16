/**
 * The requested-role taxonomy — ported from the retired
 * /uld-message-builder/register screen.
 *
 * These four names are what a person asks FOR. The seventeen slugs in
 * RolesContent (warehouse_manager, sys_admin, …) are what an administrator
 * GRANTS. Keeping the two vocabularies apart is deliberate: a requester should
 * not have to know which internal slugs add up to "Operations Administrator",
 * and the RBAC matrix should not grow four public-facing aliases just to satisfy
 * a provisioning form.
 *
 * This file is the single place the taxonomy is declared, so the access-request
 * form on /admin/users and the taxonomy card on /admin/roles cannot drift apart
 * — which is what happened when the register screen carried its own private copy
 * of the list.
 *
 * `modules` deliberately quotes RolesContent's own module labels verbatim rather
 * than inventing a slug mapping. An approver reading a request can then find the
 * exact rows to tick in the matrix immediately below.
 */

export type RequestedRole =
  | "Message Builder User"
  | "Message Reviewer"
  | "Operations Administrator"
  | "Read-only User";

export interface RequestedRoleSpec {
  role: RequestedRole;
  /** One line an approver can act on without opening anything else. */
  summary: string;
  /** Actions the request asks for, in the RBAC matrix's own column names. */
  actions: string[];
  /** Matrix rows the request touches — labels match RolesContent exactly. */
  modules: string[];
}

export const REQUESTED_ROLES: RequestedRoleSpec[] = [
  {
    role: "Message Builder User",
    summary: "Builds and submits UCM, SCM and LUC messages for its own station.",
    actions: ["View", "Create", "Update"],
    modules: [
      "ULD Message Builder — UCM",
      "ULD Message Builder — SCM",
      "ULD Message Builder — LUC",
      "ULD Message Builder — Message Log",
    ],
  },
  {
    role: "Message Reviewer",
    summary:
      "Reviews and releases messages somebody else built. Has no build path of its own — the separation is the point of the role.",
    actions: ["View", "Approve", "Export"],
    modules: [
      "ULD Message Builder — Dashboard",
      "ULD Message Builder — Search",
      "ULD Message Builder — Message Log",
    ],
  },
  {
    role: "Operations Administrator",
    summary:
      "Full ULD authority plus user administration for its own station. This is the role that approves the other three, so it is the one that needs a second pair of eyes before it is granted.",
    actions: ["View", "Create", "Update", "Delete", "Approve", "Export"],
    modules: [
      "ULD Message Builder — Dashboard",
      "ULD Message Builder — UCM",
      "ULD Message Builder — SCM",
      "ULD Message Builder — LUC",
      "ULD Message Builder — Import ULDs",
      "ULD Message Builder — Message Log",
      "Admin — Users",
    ],
  },
  {
    role: "Read-only User",
    summary: "Sees the ULD register and the message log. No write path anywhere.",
    actions: ["View"],
    modules: [
      "ULD Message Builder — Dashboard",
      "ULD Message Builder — Search",
      "ULD Message Builder — Message Log",
    ],
  },
];

/** Just the names, for a `<select>` that has no room for the detail. */
export const REQUESTED_ROLE_NAMES: RequestedRole[] = REQUESTED_ROLES.map((r) => r.role);
