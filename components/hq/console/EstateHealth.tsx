"use client";

/**
 * T1 · Node sync health, and T1b · administrator coverage.
 *
 * FC-12 §02 is "Islamabad HQ tier — scope HQ means all sites; CDC / outbox
 * sync". The second clause has never had a screen. `SITES` carries
 * `lastSyncAt`, `pendingOutbox` and `offlineCapable` on every node and the only
 * place any of it renders today is a 6px coloured dot inside the header
 * dropdown (components/site/SiteSwitcher.tsx). This card is that clause.
 *
 * The fixture is asymmetric on purpose — masters.ts:82 says so in a comment,
 * "Deliberately stale — gives the HQ console something real to surface" — so
 * PEW reads hours behind with a queue of unsent outbox rows while KHI reads
 * clean. Nothing here is authored for the tile: the thresholds live in
 * lib/domain/access.ts (SYNC_LAG_MINUTES) so this card and /hq/sites cannot
 * colour the same node differently.
 *
 * The coverage half is the one a site screen provably cannot render. /admin/users
 * at PEW lists PEW's directory; a node with NO active delegation looks exactly
 * like a node whose administrator happens to be logged out. Only the tier that
 * issues the delegations can see a zero, which is why the user's "create a
 * warehouse admin" ask surfaces here as a finding rather than as a button.
 */

import Link from "next/link";
import { RadioTower, ShieldCheck } from "lucide-react";
import { HqCard, HqStat, SeverityPill, type Severity } from "@/components/hq/HqUi";
import { useDelegations } from "@/components/hq/DelegationStore";
import { formatDateTime } from "@/lib/domain";
import { formatLag, nodeSyncStates, type NodeSyncState } from "@/lib/domain/access";

const SYNC_SEVERITY: Record<NodeSyncState["severity"], { severity: Severity; label: string }> = {
  "in-sync": { severity: "good", label: "In sync" },
  lagging: { severity: "warning", label: "Lagging" },
  stale: { severity: "critical", label: "Stale" },
};

export function NodeSyncHealth() {
  const nodes = nodeSyncStates();
  const worst = nodes.reduce((a, b) => (b.minutesStale > a.minutesStale ? b : a));
  const queued = nodes.reduce((n, s) => n + s.pendingOutbox, 0);

  return (
    <HqCard
      title="Node sync health"
      icon={RadioTower}
      source="nodeSyncStates() over SITES · lib/domain/access.ts, lib/domain/masters.ts"
      intro="FC-12 §02, second clause. Each node runs offline-capable and pushes through the CDC/outbox to HQ; a node that stops pushing is still serving cargo locally, so nothing at the site itself looks wrong."
      action={{ label: "Site register", href: "/hq/sites" }}
    >
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <HqStat
          label="Nodes in sync"
          value={`${nodes.filter((n) => n.severity === "in-sync").length} / ${nodes.length}`}
          detail="Clean means no queued outbox rows and a recent push."
          severity={nodes.every((n) => n.severity === "in-sync") ? "good" : "warning"}
        />
        <HqStat
          label="Rows queued estate-wide"
          value={String(queued)}
          detail="Writes that have happened at a node and are not yet at HQ."
          severity={queued > 0 ? "warning" : "good"}
        />
        <HqStat
          label="Furthest behind"
          value={worst.minutesStale === 0 ? "—" : `${worst.site} · ${formatLag(worst.minutesStale)}`}
          detail={`Last push ${formatDateTime(worst.lastSyncAt)}.`}
          severity={SYNC_SEVERITY[worst.severity].severity}
        />
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse">
          <thead>
            <tr className="border-b border-[#E2E8F0]">
              {["Node", "State", "Last push", "Behind", "Queued", "Mode"].map((h) => (
                <th
                  key={h}
                  className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {nodes.map((n) => {
              const s = SYNC_SEVERITY[n.severity];
              return (
                <tr key={n.site} className="border-b border-[#F1F5F9] last:border-b-0">
                  <td className="px-2 py-2.5">
                    <span className="text-[13px] font-bold text-[#0F172A]">{n.site}</span>
                    <span className="ml-2 text-[11px] text-[#94A3B8]">{n.name}</span>
                  </td>
                  <td className="px-2 py-2.5">
                    <SeverityPill severity={s.severity} label={s.label} />
                  </td>
                  <td className="px-2 py-2.5 text-[12px] text-[#475569]">
                    {formatDateTime(n.lastSyncAt)}
                  </td>
                  <td className="px-2 py-2.5 text-[12px] font-medium text-[#0F172A]">
                    {formatLag(n.minutesStale)}
                  </td>
                  <td className="px-2 py-2.5 text-[12px] font-medium text-[#0F172A]">
                    {n.pendingOutbox}
                  </td>
                  <td className="px-2 py-2.5 text-[11px] text-[#64748B]">
                    {n.offlineCapable ? "offline-capable" : "online only"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </HqCard>
  );
}

export function AdministratorCoverage() {
  // Reads the HQ portal's store rather than the fixture directly, so a
  // delegation created on /hq/site-admins closes the gap this card reports.
  // The finding and its fix have to be the same fact.
  const { coverage } = useDelegations();
  const gaps = coverage.filter((c) => c.unadministered);

  return (
    <HqCard
      title="Administrator coverage"
      icon={ShieldCheck}
      source="siteAdminCoverage() over SITE_ADMIN_DELEGATIONS + session grants · lib/domain/access.ts"
      intro="Who holds an active delegation to administer each node. A site's own Users screen cannot answer this — it lists that site's people, and an empty answer there is indistinguishable from nobody being logged in."
      action={{ label: "Site administrators", href: "/hq/site-admins" }}
    >
      {gaps.length > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-[12px] border border-[#FCA5A5] bg-[#FEF2F2] px-4 py-3">
          <div className="min-w-0">
            <p className="text-[13px] font-semibold text-[#DC2626]">
              {gaps.map((g) => g.site).join(", ")} {gaps.length === 1 ? "has" : "have"} no active
              administrator
            </p>
            <p className="mt-1 text-[12px] leading-relaxed text-[#991B1B]">
              Every delegation for {gaps.length === 1 ? "that node" : "those nodes"} has been
              revoked and nothing replaced it. Nobody can add a user, change a setting or open the
              audit trail there.{" "}
              <Link href="/hq/site-admins" className="font-semibold text-[#991B1B] underline">
                Delegate an administrator
              </Link>
              .
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {coverage.map((c) => (
          <div
            key={c.site}
            className="rounded-[12px] border px-4 py-3"
            style={{
              borderColor: c.unadministered ? "#FCA5A5" : "#E2E8F0",
              backgroundColor: c.unadministered ? "#FEF2F2" : "#F8FAFC",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-bold text-[#0F172A]">{c.site}</span>
              <SeverityPill
                severity={c.unadministered ? "critical" : c.active === 1 ? "warning" : "good"}
                label={
                  c.unadministered
                    ? "Unadministered"
                    : c.active === 1
                      ? "Single point"
                      : "Covered"
                }
              />
            </div>
            <p
              className="mt-1.5 text-[24px] font-bold leading-none"
              style={{ color: c.unadministered ? "#DC2626" : "#0F172A" }}
            >
              {c.active}
            </p>
            <p className="mt-1.5 text-[11px] leading-snug text-[#64748B]">
              active {c.active === 1 ? "delegation" : "delegations"}
              {c.revoked > 0 ? ` · ${c.revoked} revoked` : ""}
              {c.canDelegateUsers > 0
                ? ` · ${c.canDelegateUsers} may delegate users onward`
                : ""}
            </p>
          </div>
        ))}
      </div>
    </HqCard>
  );
}
