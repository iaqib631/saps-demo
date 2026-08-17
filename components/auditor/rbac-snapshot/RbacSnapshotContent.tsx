"use client";

/**
 * /auditor/rbac-snapshot — FC-12 §06, "who could see what, as at a date".
 *
 * WHAT THIS SCREEN WAS. Fifteen rows of a component-local array naming seven
 * people who exist nowhere else, against six invented booleans per screen
 * (view / create / update / delete / approve / export), every row stamped
 * `lastChangedBy: sys_admin`, under a snapshot-date picker that filtered
 * nothing and a "Compare Snapshots" button that did nothing. lib/domain/access.ts
 * cites this exact array as one of the four disjoint identity vocabularies in
 * the demo — and it was the one an AUDITOR was being shown.
 *
 * WHAT IT IS NOW. `SiteAdminDelegation` is a real, site-keyed, revocable record
 * carrying the six CMTS audit columns, and `effectiveRights()` computes
 * requested-versus-effective depth per surface against PORTAL_GRANT_CEILING. So
 * the grid is the same grid with a model behind it — and it shows something the
 * old one structurally could not: where a site tried to grant more than the HQ
 * ceiling allows, and what survived.
 *
 * AND THE DATE PICKER NOW WORKS. Existence is dated — CreatedDate on every
 * grant, UpdatedDate on every withdrawal — so a snapshot taken in June shows
 * PEW with an administrator and today's shows it with none. What is NOT dated
 * is the CONTENT of a grant: there is one `surfaces` map per row and no history
 * of it. The screen states that limit beside the picker rather than letting a
 * reviewer assume the depths roll back too, because a false grant history is
 * the worst thing this particular screen could be wrong about.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download, KeyRound, Scale, Search, ShieldQuestion } from "lucide-react";
import DataTable from "@/components/DataTable";
import EmptyState from "@/components/EmptyState";
import { HqCard, NotAvailable, SeverityPill } from "@/components/hq/HqUi";
import { DEMO_NOW, SITES, formatDate, formatDateTime, type SiteScope } from "@/lib/domain";
import {
  DELEGATION_LIMITS,
  DEPTH_LABEL,
  PORTAL_GRANT_CEILING,
  ROLE_SLUGS,
  type RoleSlug,
} from "@/lib/domain/access";
import { AuditorStat } from "../AuditorUi";
import { rbacSnapshot, snapshotBoundaries } from "../rbacModel";

const SCOPE_OPTIONS: Array<{ value: SiteScope; label: string }> = [
  { value: "HQ", label: "All nodes" },
  ...SITES.map((s) => ({ value: s.code as SiteScope, label: s.code })),
];

export default function RbacSnapshotContent() {
  const boundaries = useMemo(() => snapshotBoundaries(), []);

  const [asAt, setAsAt] = useState(DEMO_NOW.slice(0, 10));
  const [scope, setScope] = useState<SiteScope>("HQ");
  const [role, setRole] = useState<RoleSlug | "All">("All");
  const [q, setQ] = useState("");
  const [showExport, setShowExport] = useState(false);
  /* §06 asks who COULD see what at the instant, so the grid answers that by
     default. Grants already withdrawn by then are one toggle away rather than
     absent, because "this principal held it until 30 Jun" is a finding too. */
  const [includeWithdrawn, setIncludeWithdrawn] = useState(false);

  /* The picker gives a date; the snapshot is taken at the end of that day, so
     a grant issued at 10:20 on the chosen date is in it. */
  const snapshot = useMemo(() => rbacSnapshot(`${asAt}T23:59:59+05:00`, scope), [asAt, scope]);

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return snapshot.rows.filter((r) => {
      if (!includeWithdrawn && !r.inForce) return false;
      if (role !== "All" && !r.roles.includes(role)) return false;
      if (!needle) return true;
      return (
        r.name.toLowerCase().includes(needle) ||
        r.username.toLowerCase().includes(needle) ||
        r.email.toLowerCase().includes(needle) ||
        r.surface.label.toLowerCase().includes(needle)
      );
    });
  }, [snapshot.rows, role, q, includeWithdrawn]);

  /* Only the nodes actually in scope — selecting KHI must not report LHE and
     PEW as uncovered when they have simply been filtered out. */
  const nodesInScope = scope === "HQ" ? SITES.map((s) => s.code) : [scope];
  const uncovered = nodesInScope.filter(
    (code) => !snapshot.rows.some((r) => r.scope === code && r.inForce),
  );

  const isToday = asAt === DEMO_NOW.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* ---- Controls -------------------------------------------------- */}
      <div className="rounded-[14px] border border-[#E2E8F0] bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[12px] font-medium text-[#64748B]">Snapshot as at</span>
            <input
              type="date"
              value={asAt}
              onChange={(e) => setAsAt(e.target.value)}
              className="h-9 rounded-lg border border-[#E2E8F0] px-3 text-[12px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as SiteScope)}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[12px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            {SCOPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleSlug | "All")}
            className="h-9 rounded-lg border border-[#E2E8F0] bg-white pl-3 pr-8 text-[12px] text-[#0F172A] outline-none focus:border-[#2E75B6]"
          >
            <option value="All">All roles</option>
            {ROLE_SLUGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Principal or surface…"
              className="h-9 w-[200px] rounded-lg border border-[#E2E8F0] pl-9 pr-3 text-[12px] text-[#0F172A] outline-none placeholder:text-[#94A3B8] focus:border-[#2E75B6]"
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[12px] text-[#64748B]">
            <input
              type="checkbox"
              checked={includeWithdrawn}
              onChange={(e) => setIncludeWithdrawn(e.target.checked)}
              className="h-3.5 w-3.5 cursor-pointer accent-[#0B2545]"
            />
            Include grants withdrawn by this date
          </label>
          <button
            onClick={() => setShowExport((v) => !v)}
            className="flex h-9 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-4 text-[12px] font-semibold text-white transition-colors hover:opacity-90"
            style={{ backgroundColor: "#0B2545" }}
          >
            <Download size={14} />
            {showExport ? "Hide export manifest" : "Export snapshot"}
          </button>
        </div>

        {/* The dates on which this snapshot actually changes. A picker whose
            every value returns the same grid reads as broken even when it is
            correct, so the boundaries are offered rather than hunted for. */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#94A3B8]">
            Changes on
          </span>
          {boundaries.map((b) => (
            <button
              key={b.date}
              onClick={() => setAsAt(b.date)}
              title={b.label}
              className="h-7 cursor-pointer rounded-lg border px-2.5 font-mono text-[11px] transition-colors"
              style={{
                borderColor: asAt === b.date ? "#1B4F8B" : "#E2E8F0",
                color: asAt === b.date ? "#1B4F8B" : "#64748B",
                backgroundColor: asAt === b.date ? "#EBF0F7" : "white",
              }}
            >
              {b.date}
            </button>
          ))}
        </div>

        <p className="mt-3 max-w-[92ch] text-[11px] leading-relaxed text-[#64748B]">
          <span className="font-semibold text-[#475569]">What &quot;as at&quot; means here: </span>
          a grant appears if it had been issued by this date and had not yet been withdrawn.
          Existence is dated; the surfaces and roles ON a grant are not versioned, so an earlier
          snapshot shows that date&apos;s principals at today&apos;s depths. Selecting a node
          returns that node&apos;s own grants plus the cross-site grant, which is in force at every
          node by construction.
          {!isToday && (
            <span className="font-semibold text-[#B45309]">
              {" "}
              You are looking at {formatDate(`${asAt}T12:00:00+05:00`)}, not today.
            </span>
          )}
        </p>

        {showExport && (
          <div className="mt-4 rounded-[12px] border border-dashed border-[#CBD5E1] bg-[#F8FAFC] px-4 py-3">
            <p className="text-[12px] font-semibold text-[#0F172A]">
              Export manifest — computed, not written
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
              {rows.length} grant rows across {snapshot.principals} principals, as at{" "}
              {formatDate(`${asAt}T12:00:00+05:00`)}, scope {scope}. Columns: principal, username,
              email, node, roles, surface, requested depth, effective depth, capping rule, in
              force, granted by, granted at, changed by, changed at.
            </p>
            <p className="mt-1.5 text-[11px] leading-relaxed text-[#94A3B8]">
              No file is produced. There is no document or file writer anywhere in this build, so a
              button that reported a successful download would be reporting something that did not
              happen — which is precisely what the previous version of this screen did.
            </p>
          </div>
        )}
      </div>

      {/* ---- Figures ---------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AuditorStat
          label="Grants in force at this instant"
          value={`${snapshot.inForce}`}
          detail={`${snapshot.principals} existed by then · ${snapshot.withdrawnByThen} had already been withdrawn · ${snapshot.notYetIssued} not yet issued`}
          source="rbacSnapshot(asAt, scope) · components/auditor/rbacModel.ts"
          severity={snapshot.inForce === 0 ? "critical" : "neutral"}
        />
        <AuditorStat
          label="Grant rows in force"
          value={`${snapshot.rows.filter((r) => r.inForce).length}`}
          detail={`One row per principal per granted surface. ${snapshot.rows.length - snapshot.rows.filter((r) => r.inForce).length} further rows belong to grants already withdrawn by this date — shown only when the box above is ticked.`}
          source="effectiveRights(delegation) · lib/domain/access.ts"
        />
        <AuditorStat
          label="Capped by the HQ ceiling"
          value={`${snapshot.capped}`}
          detail="Rows where a site-tier grant asked for delegate depth on an HQ-reserved surface and got administer instead. Requested and effective are both kept — flattening them loses the audit."
          source="EffectiveSurfaceRight.cappedBy · lib/domain/access.ts"
          severity={snapshot.capped > 0 ? "warning" : "neutral"}
          status={snapshot.capped > 0 ? "trimmed" : undefined}
        />
        <AuditorStat
          label="Nodes with no grant of their own"
          value={`${uncovered.length}`}
          detail={
            uncovered.length === 0
              ? `Every node in scope holds at least one grant of its own as at this date.`
              : `${uncovered.join(", ")} — reachable only through the cross-site grant, which is a different thing from being administered locally.`
          }
          source="rbacSnapshot(asAt, scope).rows · SiteAdminDelegation.scope"
          severity={uncovered.length > 0 ? "critical" : "good"}
          href="/hq/site-admins"
        />
      </div>

      {/* ---- Grid -------------------------------------------------------- */}
      {rows.length === 0 ? (
        <EmptyState
          title="No grant matches"
          description="No delegation had been issued for this scope by the selected date, or the filters exclude every row. The register is small and deliberately asymmetric — that is a finding, not an empty screen."
        />
      ) : (
        <DataTable
          /* Re-key on the filters so DataTable's own page index resets — a
             snapshot narrowed from 38 rows to four must not open on page four. */
          key={`${asAt}-${scope}-${role}-${q}-${includeWithdrawn}`}
          columns={[
            { key: "principal", header: "Principal", width: "150px" },
            { key: "username", header: "Username", width: "130px" },
            { key: "node", header: "Node", width: "80px" },
            { key: "roles", header: "Roles granted", width: "180px" },
            { key: "surface", header: "Surface", width: "200px" },
            { key: "requested", header: "Requested", width: "120px" },
            { key: "effective", header: "Effective", width: "120px" },
            { key: "capped", header: "Capped by", width: "220px" },
            { key: "force", header: "In force", width: "100px" },
            { key: "granted", header: "Granted", width: "170px" },
            { key: "changed", header: "Last change", width: "170px" },
          ]}
          rows={rows.map((r) => ({
            principal: <span className="text-[12px] font-medium text-[#0F172A]">{r.name}</span>,
            username: (
              <span className="text-[12px] font-medium text-[#1B4F8B]">{r.username}</span>
            ),
            node: (
              <span className="inline-flex h-6 items-center rounded-full bg-[#F1F5F9] px-2 text-[11px] font-semibold text-[#334155]">
                {r.scope}
              </span>
            ),
            roles: <span className="text-[11px] text-[#64748B]">{r.roles.join(", ")}</span>,
            surface: (
              <Link
                href={r.surface.href}
                className="text-[12px] text-[#334155] no-underline hover:underline"
              >
                {r.surface.label}
              </Link>
            ),
            requested: (
              <span className="text-[12px] text-[#334155]">{DEPTH_LABEL[r.requested]}</span>
            ),
            effective: (
              <span
                className="text-[12px] font-semibold"
                style={{ color: r.cappedBy ? "#D97706" : "#0F172A" }}
              >
                {DEPTH_LABEL[r.effective]}
              </span>
            ),
            capped: r.cappedBy ? (
              <span className="text-[11px] text-[#B45309]">{r.cappedBy}</span>
            ) : (
              <span className="text-[11px] text-[#CBD5E1]">—</span>
            ),
            force: (
              <SeverityPill
                severity={r.inForce ? "good" : "neutral"}
                label={r.inForce ? "In force" : "Withdrawn"}
              />
            ),
            granted: (
              <span className="text-[11px] text-[#64748B]">
                {r.grantedBy}
                <br />
                <span className="font-mono">{formatDate(r.grantedAt)}</span>
              </span>
            ),
            changed: r.changedAt ? (
              <span className="text-[11px] text-[#64748B]">
                {r.changedBy ?? "—"}
                <br />
                <span className="font-mono">{formatDate(r.changedAt)}</span>
              </span>
            ) : (
              <span className="text-[11px] text-[#CBD5E1]">never amended</span>
            ),
          }))}
          headerStyle="navy"
        />
      )}

      {/* ---- The ceiling ------------------------------------------------- */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <HqCard
          title="What a site-tier grant may reach"
          icon={Scale}
          source="PORTAL_GRANT_CEILING · lib/domain/access.ts"
          intro="FC-12 §04 draws the portals as separate surfaces; this is the authority question that follows from it, and it is the one no site screen can answer about itself."
        >
          <div className="flex flex-col gap-3">
            {PORTAL_GRANT_CEILING.map((p) => (
              <div key={p.portal} className="rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13px] font-semibold text-[#0F172A]">{p.label}</span>
                  <SeverityPill
                    severity={p.grantableBySiteAdmin ? "good" : "critical"}
                    label={
                      p.grantableBySiteAdmin
                        ? `Up to ${DEPTH_LABEL[p.ceiling ?? "read"]}`
                        : "Not grantable by a site admin"
                    }
                  />
                </div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">{p.reason}</p>
              </div>
            ))}
          </div>
        </HqCard>

        <HqCard
          title="What a grant is not"
          icon={KeyRound}
          source="DELEGATION_LIMITS · lib/domain/access.ts"
          intro="Held as data in the domain so every screen that reads or writes a delegation states the same limits, rather than three screens paraphrasing them and the demo over-claiming by accident."
        >
          <ul className="flex flex-col gap-2.5">
            {DELEGATION_LIMITS.map((l) => (
              <li key={l.title}>
                <p className="text-[12px] font-semibold text-[#0F172A]">{l.title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{l.detail}</p>
              </li>
            ))}
          </ul>
        </HqCard>
      </div>

      {/* ---- Gaps --------------------------------------------------------- */}
      <HqCard
        title="Not shown on this snapshot, and why"
        icon={ShieldQuestion}
        source="no fixture — stated rather than estimated"
        intro="Three things the previous version of this screen displayed. None of them has a record behind it."
      >
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <NotAvailable
            title="Compare two snapshots"
            reason="Only the EXISTENCE of a grant is dated. There is one `surfaces` map and one `roles` array per delegation with no change log, so a diff between two dates could show principals appearing and disappearing but would show every depth as identical — which reads as 'nothing changed' rather than 'nothing is recorded'. The button is gone; the date picker, which does work, is not."
            nearest="The boundary dates above: every instant on which this register actually changes, with what changed on each."
          />
          <NotAvailable
            title="View / create / update / delete / approve / export per screen"
            reason="Those six booleans exist in no model. A delegation grants a DEPTH on a surface — read, administer, or administer-and-delegate — and depth is the thing the HQ ceiling caps. The 17 × 78 permission matrix the six booleans came from lives in a component-local array on /admin/roles with no export and no site column, so it cannot be joined to a principal here."
            nearest={`The depth model itself: ${Object.values(DEPTH_LABEL).join(", ")} — with requested and effective shown separately.`}
          />
          <NotAvailable
            title="Every user in the estate"
            reason="This register holds ADMINISTRATION grants — who may administer which node — not the full directory. /admin/users still keeps its twelve people in a component-local array whose only site hint is a free-text group string, so the two cannot be joined yet. Showing them side by side would imply a relationship that no key supports."
            nearest="The delegation register, which is complete for what it covers and is the only identity store in the demo with a site key on it."
          />
        </div>

        <div className="mt-4 rounded-[12px] border border-[#E2E8F0] bg-[#F8FAFC] px-4 py-3">
          <p className="text-[12px] font-semibold text-[#0F172A]">
            The snapshot instant, and the one thing every other screen shows
          </p>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[#64748B]">
            Every fixture in this demo is a single snapshot at {formatDateTime(DEMO_NOW)}. The
            delegation register is the one store with enough dated history to answer &quot;as at&quot;
            at all, and it answers it for existence only. Nothing on this screen carries a trend,
            and there is no second period to trend against.
          </p>
        </div>
      </HqCard>
    </div>
  );
}
