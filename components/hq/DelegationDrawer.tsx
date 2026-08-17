"use client";

/**
 * The delegation form — what "HQ creates a warehouse admin" actually is.
 *
 * IT DOES NOT CREATE A PERSON. The site's own /admin/users does that, and it
 * should keep doing it: FC-12 splits the two tiers and masters.ts states the
 * split — "HQ creates sites + site-admins; each site-admin manages its own
 * users". What HQ creates is the DELEGATION: this principal may administer that
 * node, to this depth. That is why the first field is a node and not a name.
 *
 * FOUR THINGS THE FORM CAPTURES, and each is here for a reason:
 *
 *   1. **The node, and its key triple.** CityId / Comp_Code / Off_Code are what
 *      a per-site write is addressed to. They are shown, not typed — a
 *      delegation cannot invent an address — and they blank out for the
 *      cross-site grant, because "all sites" has no single triple. That blanking
 *      is the same fact app/(admin)/layout.tsx renders as a warning band.
 *
 *   2. **Identity in UserDrawer's exact five fields** — userId, username, name,
 *      email, mobile. The demo already holds four disjoint identity vocabularies;
 *      a fifth shape here would make it five. Deliberately NO password field:
 *      UserDrawer already carries a dead `tempPassword`, and a second dead one
 *      does not make either real.
 *
 *   3. **Depth per surface**, over the site-administration screens the node
 *      owns. `delegate` is the recursive grant — the holder may pass the surface
 *      on — which is exactly the authority that needs a ceiling, so HQ-reserved
 *      surfaces cap a site-tier grant at `administer` and say so on the row.
 *
 *   4. **A justification.** A grant with no stated reason cannot be reviewed
 *      later, and the six audit columns below it make the grant revocable
 *      rather than deletable.
 */

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Globe2 } from "lucide-react";
import Modal from "@/components/Modal";
import type { NewDelegation } from "@/components/hq/DelegationStore";
import {
  DEPTH_LABEL,
  DEPTH_ORDER,
  ROLE_SLUGS,
  SITE_ADMIN_SURFACES,
  type DelegationDepth,
  type RoleSlug,
  type SiteAdminDelegation,
  type SiteAdminSurface,
} from "@/lib/domain/access";
import { DEMO_NOW, SITES, formatDateTime, type SiteScope } from "@/lib/domain";

/**
 * The form's shape is the store's shape — one type, not two. A second
 * structurally-identical interface here is exactly the kind of quiet
 * duplication this module's header argues against for identity vocabularies,
 * and it applies to its own code too.
 */
export type DelegationDraft = NewDelegation;

const EMPTY: DelegationDraft = {
  scope: "PEW",
  userId: "",
  username: "",
  name: "",
  email: "",
  mobile: "",
  roles: [],
  surfaces: {},
  justification: "",
};

export default function DelegationDrawer({
  isOpen,
  onClose,
  onSave,
  existing,
  nextUserId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSave: (draft: DelegationDraft) => void;
  existing: SiteAdminDelegation[];
  nextUserId: string;
}) {
  const [form, setForm] = useState<DelegationDraft>(EMPTY);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      setForm({ ...EMPTY, userId: nextUserId });
      setErrors({});
    }
  }, [isOpen, nextUserId]);

  const site = useMemo(
    () => (form.scope === "HQ" ? null : SITES.find((s) => s.code === form.scope) ?? null),
    [form.scope],
  );

  /** Same username already delegated somewhere — a fact worth showing, not a
   *  block: cross-site username uniqueness is a backend constraint and there is
   *  no backend to enforce it. */
  const duplicate = existing.find(
    (d) => form.username.trim() !== "" && d.username === form.username.trim(),
  );

  const grantedCount = Object.values(form.surfaces).filter(Boolean).length;

  const update = <K extends keyof DelegationDraft>(k: K, v: DelegationDraft[K]) => {
    setForm((prev) => ({ ...prev, [k]: v }));
    setErrors((prev) => ({ ...prev, [k as string]: "" }));
  };

  const setSurface = (key: SiteAdminSurface, depth: DelegationDepth | null) => {
    setForm((prev) => {
      const next = { ...prev.surfaces };
      if (depth === null) delete next[key];
      else next[key] = depth;
      return { ...prev, surfaces: next };
    });
    setErrors((prev) => ({ ...prev, surfaces: "" }));
  };

  const toggleRole = (r: RoleSlug) => {
    setForm((prev) => ({
      ...prev,
      roles: prev.roles.includes(r) ? prev.roles.filter((x) => x !== r) : [...prev.roles, r],
    }));
  };

  const submit = () => {
    const errs: Record<string, string> = {};
    if (!form.username.trim()) errs.username = "Username is required";
    if (!form.name.trim()) errs.name = "Name is required";
    if (!form.email.trim()) errs.email = "Email is required";
    if (!form.mobile.trim()) errs.mobile = "Mobile is required";
    if (grantedCount === 0) errs.surfaces = "A delegation that grants nothing is not a delegation";
    if (!form.justification.trim()) errs.justification = "State why this authority is being granted";
    setErrors(errs);
    if (Object.keys(errs).length === 0) onSave(form);
  };

  const inputClass = (k: string) =>
    `w-full h-10 px-3 rounded-xl border text-[13px] text-[#0F172A] outline-none transition-colors ${
      errors[k] ? "border-[#DC2626] bg-[#FEF2F2]" : "border-[#E2E8F0] bg-white focus:border-[#1B4F8B]"
    }`;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Delegate site administration"
      maxWidth={780}
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] text-[#94A3B8]">
            Records a grant. It issues no credential and gates nothing.
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="h-10 cursor-pointer rounded-xl border border-[#E2E8F0] bg-white px-4 text-[13px] font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC]"
            >
              Cancel
            </button>
            <button
              onClick={submit}
              className="h-10 cursor-pointer rounded-xl bg-[#0B2545] px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Create delegation
            </button>
          </div>
        </div>
      }
    >
      <div className="flex flex-col gap-5">
        {/* 1 — the node */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            1 · Which node
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {[...SITES.map((s) => s.code), "HQ" as const].map((code) => {
              const active = form.scope === code;
              const isHq = code === "HQ";
              return (
                <button
                  key={code}
                  onClick={() => update("scope", code as SiteScope)}
                  className="cursor-pointer rounded-xl border px-3 py-2 text-left transition-colors"
                  style={{
                    borderColor: active ? (isHq ? "#1B4F8B" : "#0B2545") : "#E2E8F0",
                    backgroundColor: active ? (isHq ? "#EBF0F7" : "#F1F5F9") : "#FFFFFF",
                  }}
                >
                  <span className="flex items-center gap-1.5 text-[13px] font-bold text-[#0F172A]">
                    {isHq && <Globe2 size={13} className="text-[#1B4F8B]" />}
                    {code}
                  </span>
                  <span className="block text-[10px] text-[#64748B]">
                    {isHq ? "All sites — cross-site grant" : SITES.find((s) => s.code === code)?.city}
                  </span>
                </button>
              );
            })}
          </div>

          {site ? (
            <p className="mt-2 font-mono text-[11px] text-[#64748B]">
              Addressed to CityId {site.CityId} · Comp_Code {site.Comp_Code} · Off_Code{" "}
              {site.Off_Code}
            </p>
          ) : (
            <div className="mt-2 flex items-start gap-2 rounded-[10px] border border-[#C7D7EC] bg-[#EBF0F7] px-3 py-2">
              <Globe2 size={14} className="mt-0.5 flex-shrink-0 text-[#1B4F8B]" />
              <p className="text-[11px] leading-relaxed text-[#1B4F8B]">
                Cross-site grant. There is no key triple, because &quot;all sites&quot; has no
                single address — and this is the grant a site administrator may not issue. Only HQ
                can, which is the whole reason this screen is not inside the Warehouse portal.
              </p>
            </div>
          )}
        </section>

        {/* 2 — identity */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            2 · Principal
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            The same five fields the site&apos;s own user drawer captures. No password: credentials
            are not issued here, and there is no store to issue them into.
          </p>
          <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B]">userId</span>
              <input
                value={form.userId}
                onChange={(e) => update("userId", e.target.value)}
                className={inputClass("userId")}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B]">username</span>
              <input
                value={form.username}
                onChange={(e) => update("username", e.target.value)}
                placeholder="first.last"
                className={inputClass("username")}
              />
              {errors.username && (
                <span className="text-[11px] text-[#DC2626]">{errors.username}</span>
              )}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B]">name</span>
              <input
                value={form.name}
                onChange={(e) => update("name", e.target.value)}
                className={inputClass("name")}
              />
              {errors.name && <span className="text-[11px] text-[#DC2626]">{errors.name}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B]">email</span>
              <input
                value={form.email}
                onChange={(e) => update("email", e.target.value)}
                className={inputClass("email")}
              />
              {errors.email && <span className="text-[11px] text-[#DC2626]">{errors.email}</span>}
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[11px] font-semibold text-[#64748B]">mobile</span>
              <input
                value={form.mobile}
                onChange={(e) => update("mobile", e.target.value)}
                placeholder="+92 300 0000000"
                className={inputClass("mobile")}
              />
              {errors.mobile && <span className="text-[11px] text-[#DC2626]">{errors.mobile}</span>}
            </label>
          </div>
          {duplicate && (
            <div className="mt-2 flex items-start gap-2 rounded-[10px] border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2">
              <AlertTriangle size={14} className="mt-0.5 flex-shrink-0 text-[#D97706]" />
              <p className="text-[11px] leading-relaxed text-[#92400E]">
                <span className="font-semibold">{duplicate.username}</span> already holds{" "}
                {duplicate.delegationId} at {duplicate.scope}. Shown, not blocked — cross-site
                username uniqueness is a backend constraint, and there is no backend to enforce it.
              </p>
            </div>
          )}
        </section>

        {/* 3 — roles */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            3 · Role slugs
          </p>
          <p className="mt-1 text-[11px] text-[#64748B]">
            The seventeen slugs an administrator grants, quoted from the site&apos;s own RBAC
            matrix. Not a new vocabulary — the four public-facing names people REQUEST stay on the
            request side, at /admin/users.
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ROLE_SLUGS.map((r) => {
              const on = form.roles.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => toggleRole(r)}
                  className="cursor-pointer rounded-lg border px-2.5 py-1 font-mono text-[11px] transition-colors"
                  style={{
                    borderColor: on ? "#0B2545" : "#E2E8F0",
                    backgroundColor: on ? "#0B2545" : "#FFFFFF",
                    color: on ? "#FFFFFF" : "#475569",
                  }}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </section>

        {/* 4 — depth */}
        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
              4 · Depth per surface
            </p>
            <p className="text-[11px] text-[#64748B]">
              {grantedCount} of {SITE_ADMIN_SURFACES.length} granted
            </p>
          </div>
          {errors.surfaces && (
            <p className="mt-1 text-[11px] text-[#DC2626]">{errors.surfaces}</p>
          )}
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <tbody>
                {SITE_ADMIN_SURFACES.map((s) => {
                  const picked = form.surfaces[s.key] ?? null;
                  const capped = form.scope !== "HQ" && s.hqReserved && picked === "delegate";
                  return (
                    <tr key={s.key} className="border-b border-[#F1F5F9] last:border-b-0">
                      <td className="py-2 pr-3">
                        <p className="text-[12px] font-semibold text-[#0F172A]">{s.label}</p>
                        <p className="font-mono text-[10px] text-[#94A3B8]">
                          {s.href} · {s.flowRef}
                          {s.hqReserved ? " · HQ-reserved" : ""}
                        </p>
                        {capped && (
                          <p className="text-[10px] text-[#D97706]">
                            Capped at Administer — a site-tier grant may operate this surface but
                            not widen it.
                          </p>
                        )}
                      </td>
                      <td className="py-2">
                        <div className="flex flex-wrap justify-end gap-1">
                          {[null, ...DEPTH_ORDER].map((d) => {
                            const on = picked === d;
                            return (
                              <button
                                key={String(d)}
                                onClick={() => setSurface(s.key, d)}
                                className="cursor-pointer rounded-lg border px-2 py-1 text-[11px] font-semibold transition-colors"
                                style={{
                                  borderColor: on ? "#0B2545" : "#E2E8F0",
                                  backgroundColor: on ? "#0B2545" : "#FFFFFF",
                                  color: on ? "#FFFFFF" : "#64748B",
                                }}
                              >
                                {d === null ? "No access" : DEPTH_LABEL[d]}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* 5 — justification + audit preview */}
        <section>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#94A3B8]">
            5 · Justification and audit
          </p>
          <textarea
            value={form.justification}
            onChange={(e) => update("justification", e.target.value)}
            rows={2}
            placeholder="Why this principal holds this authority — what a reviewer reads six months from now."
            className={`mt-2 w-full rounded-xl border p-3 text-[13px] text-[#0F172A] outline-none transition-colors ${
              errors.justification
                ? "border-[#DC2626] bg-[#FEF2F2]"
                : "border-[#E2E8F0] bg-white focus:border-[#1B4F8B]"
            }`}
          />
          {errors.justification && (
            <p className="mt-1 text-[11px] text-[#DC2626]">{errors.justification}</p>
          )}
          <div className="mt-2 rounded-[10px] border border-[#E2E8F0] bg-[#F8FAFC] px-3 py-2">
            <p className="font-mono text-[10px] leading-relaxed text-[#64748B]">
              CreatedBy hq.oversight · CreatedDate {formatDateTime(DEMO_NOW)} · UpdatedBy null ·
              IsActive true · IsDeleted false
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#94A3B8]">
              The six audit columns ~60 CMTS tables carry. They are why a delegation is revoked by
              setting IsActive false rather than deleted — a withdrawn authority that leaves no row
              behind cannot be audited.
            </p>
          </div>
        </section>
      </div>
    </Modal>
  );
}
