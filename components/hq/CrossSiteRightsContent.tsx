"use client";

/**
 * Cross-site Rights — FC-12 §04, and what it feeds into §06.
 *
 * §04 is "portal separation — admin / warehouse / lifter / customs / finance /
 * customer / agent, one sidebar". Drawn as a layout fact it is already true:
 * the rail renders three portals. The AUTHORITY question that follows from it
 * is the one nothing answers — **which portals may a site-tier delegation grant
 * into?** RolesContent's 17 × 78 matrix is one node's grant surface and says
 * nothing about the boundary around it, because a per-site screen has no
 * standing to define its own limit.
 *
 * THIS IS EMPHATICALLY NOT A SECOND ROLE MATRIX. The temptation is to rebuild
 * the 17 × 78 grid with a site picker on top, and that would be the exact
 * failure this portal exists to avoid — it would work identically inside one
 * site, so it would belong in the Warehouse portal. What is here instead is the
 * three rules the site tier cannot write for itself:
 *
 *   1. the portal ceiling — where a site administrator may grant, and how deep;
 *   2. the reserved surfaces — the screens a site administrator may operate but
 *      not widen its own authority over;
 *   3. the cross-site grants themselves — the delegations whose scope is "HQ",
 *      in force at every node at once.
 *
 * Ticking "Warehouse Manager — Putaway / Update" for KHI is the site's job, and
 * it stays at /admin/roles. This screen sets the box that job happens inside.
 *
 * WHERE IT LANDS: FC-12 §06, the RBAC snapshot at /auditor/rbac-snapshot, is
 * "who could see what, as at a date". These rules are the upstream half of that
 * answer, which is why the two sit in the same portal.
 */

import Link from "next/link";
import {
  ArrowUpRight,
  Globe2,
  Layers,
  Lock,
  ShieldQuestion,
} from "lucide-react";
import { HqCard, SeverityPill } from "@/components/hq/HqUi";
import { useDelegations } from "@/components/hq/DelegationStore";
import {
  DEPTH_LABEL,
  PORTAL_GRANT_CEILING,
  SITE_ADMIN_SURFACES,
  crossSiteDelegations,
  effectiveRights,
} from "@/lib/domain/access";
import { SITES, formatDateTime } from "@/lib/domain";

export default function CrossSiteRightsContent() {
  const { delegations } = useDelegations();
  const reserved = SITE_ADMIN_SURFACES.filter((s) => s.hqReserved);
  const crossSite = crossSiteDelegations(false, delegations);

  return (
    <div className="flex flex-col gap-6">
      <HqCard
        title="Portal ceiling — where a site administrator may grant"
        icon={Layers}
        source="PORTAL_GRANT_CEILING · lib/domain/access.ts"
        intro="FC-12 §04 draws the portals as separate surfaces. This is the authority rule that follows from the separation, and it is the one rule a per-site screen cannot write, because no node has standing to define its own limit."
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {["Portal", "Grantable by a site administrator", "Ceiling", "Why"].map((h) => (
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
              {PORTAL_GRANT_CEILING.map((p) => (
                <tr key={p.portal} className="border-b border-[#F1F5F9] last:border-b-0">
                  <td className="px-2 py-3">
                    <p className="text-[13px] font-semibold text-[#0F172A]">{p.label}</p>
                    <p className="font-mono text-[10px] text-[#94A3B8]">{p.portal}</p>
                  </td>
                  <td className="px-2 py-3">
                    <SeverityPill
                      severity={p.grantableBySiteAdmin ? "good" : "serious"}
                      label={p.grantableBySiteAdmin ? "Yes" : "No — HQ only"}
                    />
                  </td>
                  <td className="px-2 py-3 text-[12px] font-semibold text-[#0F172A]">
                    {p.ceiling ? DEPTH_LABEL[p.ceiling] : "—"}
                  </td>
                  <td className="px-2 py-3 text-[11px] leading-relaxed text-[#64748B]">
                    {p.reason}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </HqCard>

      <HqCard
        title="Reserved surfaces"
        icon={Lock}
        source="SITE_ADMIN_SURFACES filtered on hqReserved · effectiveRights()"
        intro="Screens a site administrator may operate for its own node, but may not widen its own authority over. The cap is applied when a delegation is read, not when it is written, so an existing grant shows both what it asked for and what survives."
      >
        {reserved.length === 0 ? (
          <p className="text-[12px] text-[#64748B]">No surface is reserved.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {reserved.map((s) => (
              <li key={s.key} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-[12px] font-semibold text-[#0F172A]">{s.label}</p>
                  <span className="font-mono text-[10px] text-[#94A3B8]">
                    {s.href} · {s.flowRef}
                  </span>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-[#64748B]">{s.note}</p>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
          Everything not listed here is the node&apos;s own to administer at whatever depth its
          delegation carries — including{" "}
          <Link
            href="/admin/users"
            className="font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            Admin — Users
          </Link>
          , which is deliberately unreserved. Managing a node&apos;s people is the half of the split
          HQ does not do.
        </p>
      </HqCard>

      <HqCard
        title="Cross-site grants"
        icon={Globe2}
        source="crossSiteDelegations() · lib/domain/access.ts"
        intro={`Delegations whose scope is "HQ" — in force at all ${SITES.length} nodes at once. There is no key triple on these, because "all sites" has no single address; that absence is the grant.`}
        action={{ label: "Delegation register", href: "/hq/site-admins" }}
      >
        {crossSite.length === 0 ? (
          <p className="text-[12px] text-[#64748B]">No cross-site grant is in force.</p>
        ) : (
          <div className="flex flex-col gap-3">
            {crossSite.map((d) => {
              const rights = effectiveRights(d).filter((r) => r.requested !== null);
              return (
                <div
                  key={d.delegationId}
                  className="rounded-[12px] border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[13px] font-bold text-[#0F172A]">
                        {d.name}{" "}
                        <span className="font-mono text-[11px] font-normal text-[#475569]">
                          {d.username}
                        </span>
                      </p>
                      <p className="font-mono text-[10px] text-[#64748B]">
                        {d.delegationId} · {d.roles.join(", ")}
                      </p>
                    </div>
                    <SeverityPill
                      severity={d.IsActive ? "good" : "neutral"}
                      label={d.IsActive ? "Active at every node" : "Revoked"}
                    />
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-[#475569]">
                    {d.justification}
                  </p>
                  <p className="mt-2 text-[11px] text-[#64748B]">
                    {rights.length} of {SITE_ADMIN_SURFACES.length} surfaces ·{" "}
                    {rights.filter((r) => r.effective === "delegate").length} at delegate depth ·
                    granted by {d.CreatedBy} on {formatDateTime(d.CreatedDate)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </HqCard>

      <HqCard
        title="What this screen is not"
        icon={ShieldQuestion}
        source="no data — a scoping statement"
        intro="The failure mode for an HQ portal is a second copy of the site's administration with a site picker on top. Named here so it stays named."
      >
        <ul className="flex flex-col gap-2">
          {[
            [
              "Not a second role matrix.",
              "The 17 roles × 78 modules grid at /admin/roles is one node's grant surface, and it stays there. HQ decides which portals a site administrator may grant into; it does not tick individual module rows.",
            ],
            [
              "Not a second user directory.",
              "/admin/users lists people at one node. This portal holds delegations — a different entity with a different lifecycle.",
            ],
            [
              "Not a second settings or master-data editor.",
              "Those stores have no site column. An HQ copy would edit the same rows while implying a per-node override that does not exist.",
            ],
            [
              "Not a second audit trail.",
              "The node's own trail and event log are FC-12 §14 / §15 and belong to the node. The cross-site read is /auditor/*, already in this portal.",
            ],
            [
              "Not a second site switcher.",
              "The header owns scope and persists it. A picker here would be a second source of truth for one setting.",
            ],
          ].map(([title, body]) => (
            <li key={title} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-semibold text-[#0F172A]">{title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{body}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
          These rules are the upstream half of FC-12 §06 —{" "}
          <Link
            href="/auditor/rbac-snapshot"
            className="font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            the RBAC snapshot <ArrowUpRight size={11} className="inline" />
          </Link>{" "}
          asks who could see what as at a date, and a ceiling is what makes that answer bounded.
        </p>
      </HqCard>
    </div>
  );
}
