"use client";

import Link from "next/link";
import { ArrowRight, KeyRound } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import SettingsContent from "@/components/admin/settings/SettingsContent";
import { SEEDED_SETTINGS } from "@/lib/domain/settings";

/**
 * System Settings holds the small set of fields that genuinely ARE known —
 * company identity, branding, localisation, tax registrations. A fixed form is
 * the right shape for those: the keys are not in doubt.
 *
 * CMTS `Lookup` / `Setting` are the opposite case. Their keys are unknowable
 * from a schema-only restore (decision Q6), so they get a key-agnostic
 * registry rather than another fixed form. The card below is the seam between
 * the two, stated on screen so nobody extends this page with a guessed field.
 */
export default function AdminSettingsPage() {
  // Every row in the seed is demo-seeded by construction, so the count is the
  // length. `settingStats` would re-derive it at O(n squared) for no gain here.
  const seededCount = SEEDED_SETTINGS.length;

  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "System Settings" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">System Settings</h1>
      </div>

      <Link
        href="/admin/settings/lookup-registry"
        className="block rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm hover:border-[#1B4F8B] transition-colors"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#DBEAFE] flex items-center justify-center flex-shrink-0">
            <KeyRound size={20} className="text-[#1B4F8B]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-[16px] font-bold text-[#0F172A]">Lookup &amp; Setting Registry</h2>
              <span className="inline-flex items-center h-5 px-2 rounded-full text-[10px] font-bold bg-[#FEF3C7] text-[#B45309]">
                {seededCount} DEMO-SEEDED KEYS
              </span>
            </div>
            <p className="text-[12px] text-[#64748B] mt-1 leading-[18px] max-w-[760px]">
              The fields on this page are the ones whose keys are known. Everything CMTS tunes at
              runtime lives in <span className="font-mono text-[#1B4F8B]">Lookup</span> and{" "}
              <span className="font-mono text-[#1B4F8B]">Setting</span>, whose keys a schema-only
              restore cannot show us — so those get a key-agnostic editor that renders whatever keys
              exist, groups them by prefix, infers each control from the value shape, and accepts
              unknown keys on import instead of rejecting them.
            </p>
          </div>
          <ArrowRight size={18} className="text-[#94A3B8] flex-shrink-0 mt-2" />
        </div>
      </Link>

      <SettingsContent />
    </div>
  );
}
