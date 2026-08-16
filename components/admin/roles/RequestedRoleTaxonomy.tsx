"use client";

import Link from "next/link";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { REQUESTED_ROLES } from "./requestedRoles";

/**
 * The requested-role taxonomy card.
 *
 * The RBAC matrix below answers "what can warehouse_manager do?". It never
 * answered "what does somebody ask for when they have no account yet?" — that
 * question only lived on the retired /uld-message-builder/register screen, and
 * deleting that screen would have taken the four public-facing role names with
 * it.
 *
 * It sits above the matrix rather than below it because it is the shorter,
 * outward-facing half: an approver reads the request first and only then goes
 * looking for the rows to tick.
 */
export default function RequestedRoleTaxonomy() {
  return (
    <div className="rounded-xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: "#EBF0F7" }}>
            <ShieldCheck size={18} className="text-[#1B4F8B]" />
          </div>
          <div>
            <h2 className="text-[15px] font-bold text-[#0F172A]">Requested-role taxonomy</h2>
            <p className="text-[12px] text-[#64748B] leading-relaxed mt-0.5 max-w-[760px]">
              The four roles a person can ask for when they have no account yet. They are not RBAC roles — they
              are provisioning intents, and each resolves to a set of rows in the matrix below. The access-request
              form offers exactly this list and nothing else.
            </p>
          </div>
        </div>
        <Link
          href="/admin/users"
          className="flex items-center gap-1.5 h-9 px-3 rounded-xl text-[12px] font-semibold text-[#1B4F8B] border border-[#1B4F8B]/30 bg-white hover:bg-[#DBEAFE] cursor-pointer transition-colors whitespace-nowrap self-start"
        >
          Access requests <ArrowUpRight size={14} />
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4">
        {REQUESTED_ROLES.map((spec, idx) => (
          <div
            key={spec.role}
            className="p-5 border-b border-[#E2E8F0] lg:border-b-0 last:border-b-0"
            style={{
              // A hairline between columns, not a box around each — the four are
              // one list read left to right, not four unrelated cards.
              borderRight: idx < REQUESTED_ROLES.length - 1 ? "1px solid #E2E8F0" : undefined,
            }}
          >
            <p className="text-[13px] font-bold text-[#0F172A]">{spec.role}</p>
            <p className="text-[12px] text-[#64748B] leading-relaxed mt-1.5 mb-3">{spec.summary}</p>

            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Actions</p>
            <div className="flex flex-wrap gap-1 mb-3">
              {spec.actions.map((a) => (
                <span
                  key={a}
                  className="inline-flex items-center h-5 px-2 rounded-md text-[10px] font-semibold whitespace-nowrap"
                  style={{ backgroundColor: "#DCFCE7", color: "#16A34A" }}
                >
                  {a}
                </span>
              ))}
            </div>

            <p className="text-[10px] font-bold uppercase tracking-wider text-[#94A3B8] mb-1.5">Matrix rows</p>
            <ul className="flex flex-col gap-1">
              {spec.modules.map((m) => (
                <li key={m} className="text-[11px] text-[#475569] leading-snug">
                  {m}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
