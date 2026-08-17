"use client";

/**
 * Site Administrators — the delegation register. An AirVault addition on
 * FC-12 §02.
 *
 * BE CAREFUL WITH THE FLOW REF. No FC-12 step draws site-admin creation. §05 is
 * "User & role administration" and it hrefs /admin/users — the site tier's own
 * screen, which stays exactly where it is. The nearest thing to a source for
 * this screen is a CODE COMMENT in masters.ts: "FC-12: HQ creates sites +
 * site-admins; each site-admin manages its own users." So this is labelled an
 * addition on §02, the way settings.ts and airmail.ts label theirs, rather than
 * given a step number it does not have.
 *
 * WHY IT IS NOT A SECOND USER DIRECTORY — the failure mode this whole portal
 * has to avoid. /admin/users lists PEOPLE at one node and is right to. This
 * lists DELEGATIONS, which are a different entity: a delegation names a
 * principal, a node, a depth and a reason, and it can be revoked without the
 * person going anywhere. Two facts here cannot exist on a per-site screen at
 * all — the cross-site grant, whose scope is "HQ" and which is in force at
 * every node; and the empty node, where the absence of any active grant is the
 * finding. A site screen showing nobody cannot tell you whether that means
 * "nobody" or "not this site".
 */

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Globe2,
  KeyRound,
  ShieldOff,
  UserPlus,
  Users,
} from "lucide-react";
import { useToast } from "@/components/ToastContext";
import { HqCard, SeverityPill } from "@/components/hq/HqUi";
import DelegationDrawer, { type DelegationDraft } from "@/components/hq/DelegationDrawer";
import { useDelegations } from "@/components/hq/DelegationStore";
import {
  DELEGATION_LIMITS,
  DEPTH_LABEL,
  SITE_ADMIN_SURFACES,
  crossSiteDelegations,
  effectiveRights,
  type SiteAdminDelegation,
} from "@/lib/domain/access";
import { SITES, formatDateTime, type SiteScope } from "@/lib/domain";

type Filter = SiteScope | "ALL";

export default function SiteAdminsContent() {
  // The register and the console read one store, so "PEW has no administrator"
  // and "PEW now has one" are the same fact seen from two screens.
  const { delegations, coverage, create, revoke: revokeIn, nextUserId } = useDelegations();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [revokeReason, setRevokeReason] = useState<Record<string, string>>({});
  const { addToast } = useToast();

  const visible = useMemo(
    () => (filter === "ALL" ? delegations : delegations.filter((d) => d.scope === filter)),
    [delegations, filter],
  );
  const crossSite = crossSiteDelegations(false, delegations);

  const save = (draft: DelegationDraft) => {
    const created = create({ ...draft, userId: draft.userId.trim() || nextUserId });
    setDrawerOpen(false);
    setFilter(draft.scope);
    addToast(
      `${created.delegationId} created — ${created.name} may now administer ${created.scope}. Session-local; the site portal does not read it yet.`,
      "success",
    );
  };

  const revoke = (d: SiteAdminDelegation) => {
    const reason = (revokeReason[d.delegationId] ?? "").trim();
    if (!reason) {
      addToast("A revocation needs a reason — the row survives, so the reason is the record.", "error");
      return;
    }
    revokeIn(d.delegationId, reason);
    addToast(`${d.delegationId} revoked. IsActive set false; the row is kept.`, "success");
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Coverage strip */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {coverage.map((c) => (
          <div
            key={c.site}
            className="rounded-[12px] border px-4 py-3"
            style={{
              borderColor: c.active === 0 ? "#FCA5A5" : "#E2E8F0",
              backgroundColor: c.active === 0 ? "#FEF2F2" : "#FFFFFF",
            }}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-[#0F172A]">{c.site}</span>
              <SeverityPill
                severity={c.active === 0 ? "critical" : c.active === 1 ? "warning" : "good"}
                label={c.active === 0 ? "Unadministered" : c.active === 1 ? "Single point" : "Covered"}
              />
            </div>
            <p
              className="mt-1 text-[22px] font-bold leading-none"
              style={{ color: c.active === 0 ? "#DC2626" : "#0F172A" }}
            >
              {c.active}
            </p>
            <p className="mt-1 text-[11px] text-[#64748B]">
              active · {c.revoked} revoked
            </p>
          </div>
        ))}
        <div className="rounded-[12px] border border-[#C7D7EC] bg-[#EBF0F7] px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-[12px] font-bold text-[#1B4F8B]">
              <Globe2 size={13} /> HQ
            </span>
          </div>
          <p className="mt-1 text-[22px] font-bold leading-none text-[#1B4F8B]">
            {crossSite.filter((d) => d.IsActive).length}
          </p>
          <p className="mt-1 text-[11px] text-[#1B4F8B]">
            cross-site grants — in force at every node
          </p>
        </div>
      </div>

      <HqCard
        title="Delegation register"
        icon={Users}
        source="SITE_ADMIN_DELEGATIONS + session grants, via components/hq/DelegationStore.tsx · lib/domain/access.ts"
        intro="Who may administer which node, to what depth, and on whose authority. A delegation is a record of a grant — not a person, not a credential and not a gate."
        action={{ label: "Cross-site rights", href: "/hq/rights" }}
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(["ALL", ...SITES.map((s) => s.code), "HQ"] as Filter[]).map((f) => {
              const on = filter === f;
              return (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className="cursor-pointer rounded-lg border px-2.5 py-1 text-[11px] font-semibold transition-colors"
                  style={{
                    borderColor: on ? "#0B2545" : "#E2E8F0",
                    backgroundColor: on ? "#0B2545" : "#FFFFFF",
                    color: on ? "#FFFFFF" : "#64748B",
                  }}
                >
                  {f === "ALL" ? "All nodes" : f === "HQ" ? "Cross-site" : f}
                </button>
              );
            })}
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-xl bg-[#0B2545] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
          >
            <UserPlus size={15} /> Delegate an administrator
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] border-collapse">
            <thead>
              <tr className="border-b border-[#E2E8F0]">
                {["Delegation", "Principal", "Node", "Roles", "Surfaces", "State", ""].map((h, i) => (
                  <th
                    key={i}
                    className="px-2 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visible.map((d) => {
                const granted = Object.keys(d.surfaces).length;
                const isOpen = expanded === d.delegationId;
                return (
                  <Fragment key={d.delegationId}>
                    <tr
                      className="border-b border-[#F1F5F9]"
                      style={{ backgroundColor: d.IsActive ? "transparent" : "#F8FAFC" }}
                    >
                      <td className="px-2 py-2.5 font-mono text-[11px] text-[#475569]">
                        {d.delegationId}
                      </td>
                      <td className="px-2 py-2.5">
                        <p className="text-[13px] font-semibold text-[#0F172A]">{d.name}</p>
                        <p className="font-mono text-[10px] text-[#94A3B8]">
                          {d.username} · {d.userId}
                        </p>
                      </td>
                      <td className="px-2 py-2.5">
                        {d.scope === "HQ" ? (
                          <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[#1B4F8B]">
                            <Globe2 size={12} /> All sites
                          </span>
                        ) : (
                          <>
                            <p className="text-[12px] font-bold text-[#0F172A]">{d.scope}</p>
                            <p className="font-mono text-[10px] text-[#94A3B8]">
                              {d.keys
                                ? `${d.keys.CityId}/${d.keys.Comp_Code}/${d.keys.Off_Code}`
                                : "—"}
                            </p>
                          </>
                        )}
                      </td>
                      <td className="px-2 py-2.5 font-mono text-[11px] text-[#475569]">
                        {d.roles.join(", ") || "—"}
                      </td>
                      <td className="px-2 py-2.5 text-[12px] text-[#475569]">
                        {granted} of {SITE_ADMIN_SURFACES.length}
                      </td>
                      <td className="px-2 py-2.5">
                        <SeverityPill
                          severity={d.IsActive ? "good" : "neutral"}
                          label={d.IsActive ? "Active" : "Revoked"}
                        />
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          onClick={() => setExpanded(isOpen ? null : d.delegationId)}
                          className="cursor-pointer text-[11px] font-semibold text-[#1B4F8B] hover:underline"
                        >
                          {isOpen ? "Hide" : "Rights"}
                        </button>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="border-b border-[#F1F5F9]">
                        <td colSpan={7} className="bg-[#F8FAFC] px-4 py-4">
                          <p className="text-[12px] leading-relaxed text-[#475569]">
                            <span className="font-semibold">Justification: </span>
                            {d.justification}
                          </p>
                          {!d.IsActive && d.revokedReason && (
                            <p className="mt-1 text-[12px] leading-relaxed text-[#991B1B]">
                              <span className="font-semibold">Revoked: </span>
                              {d.revokedReason}
                            </p>
                          )}

                          <div className="mt-3 overflow-x-auto">
                            <table className="w-full min-w-[520px] border-collapse">
                              <thead>
                                <tr className="border-b border-[#E2E8F0]">
                                  {["Surface", "Granted", "Effective", "Capped by"].map((h) => (
                                    <th
                                      key={h}
                                      className="px-2 py-1.5 text-left text-[10px] font-bold uppercase tracking-wider text-[#94A3B8]"
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {effectiveRights(d)
                                  .filter((r) => r.requested !== null)
                                  .map((r) => (
                                    <tr
                                      key={r.surface.key}
                                      className="border-b border-[#E2E8F0] last:border-b-0"
                                    >
                                      <td className="px-2 py-1.5">
                                        <p className="text-[12px] font-medium text-[#0F172A]">
                                          {r.surface.label}
                                        </p>
                                        <p className="font-mono text-[10px] text-[#94A3B8]">
                                          {r.surface.href} · {r.surface.flowRef}
                                        </p>
                                      </td>
                                      <td className="px-2 py-1.5 text-[12px] text-[#475569]">
                                        {r.requested ? DEPTH_LABEL[r.requested] : "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-[12px] font-semibold text-[#0F172A]">
                                        {r.effective ? DEPTH_LABEL[r.effective] : "—"}
                                      </td>
                                      <td className="px-2 py-1.5 text-[11px] text-[#D97706]">
                                        {r.cappedBy ?? ""}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-[#E2E8F0] pt-3">
                            <p className="font-mono text-[10px] text-[#94A3B8]">
                              CreatedBy {d.CreatedBy} · {formatDateTime(d.CreatedDate)}
                              {d.UpdatedBy
                                ? ` · UpdatedBy ${d.UpdatedBy} · ${formatDateTime(d.UpdatedDate ?? d.CreatedDate)}`
                                : ""}
                            </p>
                            {d.IsActive && (
                              <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
                                <input
                                  value={revokeReason[d.delegationId] ?? ""}
                                  onChange={(e) =>
                                    setRevokeReason((prev) => ({
                                      ...prev,
                                      [d.delegationId]: e.target.value,
                                    }))
                                  }
                                  placeholder="Reason for revoking"
                                  className="h-8 min-w-[200px] rounded-lg border border-[#E2E8F0] bg-white px-2.5 text-[12px] text-[#0F172A] outline-none focus:border-[#1B4F8B]"
                                />
                                <button
                                  onClick={() => revoke(d)}
                                  className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-lg border border-[#FCA5A5] bg-white px-3 text-[12px] font-semibold text-[#DC2626] transition-colors hover:bg-[#FEF2F2]"
                                >
                                  <ShieldOff size={13} /> Revoke
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {visible.length === 0 && (
          <p className="mt-3 text-[12px] text-[#64748B]">
            No delegation exists for this node. That is the finding, not an empty list — nobody can
            administer it.
          </p>
        )}
      </HqCard>

      <HqCard
        title="What a delegation is not"
        icon={KeyRound}
        source="DELEGATION_LIMITS · lib/domain/access.ts"
        intro="Held as data so every screen that writes a grant states the same limits, rather than three screens paraphrasing them differently."
      >
        <ul className="flex flex-col gap-2.5">
          {DELEGATION_LIMITS.map((l) => (
            <li key={l.title} className="rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
              <p className="text-[12px] font-semibold text-[#0F172A]">{l.title}</p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-[#64748B]">{l.detail}</p>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] leading-relaxed text-[#94A3B8]">
          The last one is the only wire still open. Once{" "}
          <Link
            href="/admin/users"
            className="font-semibold text-[#1B4F8B] no-underline hover:underline"
          >
            /admin/users <ArrowUpRight size={11} className="inline" />
          </Link>{" "}
          reads <span className="font-mono">delegationsForSite()</span> instead of its own array,
          creating an administrator here and switching the header to that node shows the person
          there — which turns two disconnected screens into one demo.
        </p>
      </HqCard>

      <DelegationDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onSave={save}
        existing={delegations}
        nextUserId={nextUserId}
      />
    </div>
  );
}
