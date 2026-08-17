"use client";

import Link from "next/link";
import { ArrowRight, Info } from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import MasterDataContent from "@/components/admin/master-data/MasterDataContent";

/**
 * Master Data vs. the Lookup & Setting Registry — the division, stated once.
 *
 * These two screens look adjacent and are not the same thing:
 *
 *   Master Data (here)  — coded REFERENCE DATA. Airlines, airports, cargo
 *                         classes, charge types, banks. Each is a row with its
 *                         own columns, a code, a name and an active/retired
 *                         lifecycle, backed by a real CMTS table per entity
 *                         (AIRLINE, CARGOCLASS, CHARGETYPE, …). The key set is
 *                         known because the tables are known.
 *
 *   Lookup / Setting    — CONFIGURATION. Tolerances, thresholds, day counts,
 *                         percentages: single values keyed by string in two
 *                         generic key/value tables whose keys are NOT
 *                         recoverable from a schema-only restore (decision Q6).
 *
 * The existing reference-data editor below already covers its side well —
 * thirteen entity groups with add / edit / disable / audit — so it is left
 * alone. The note is the only addition: without it the two screens read as
 * duplicates and somebody eventually adds a threshold to this list, where it
 * would sit as a code/name pair that cannot express a numeric value.
 */
export default function AdminMasterDataPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: "Master Data Editor" }]} />
      <div className="flex items-center gap-3">
        <h1 className="text-[24px] font-bold text-[#0F172A]">Master Data Editor</h1>
      </div>

      <div className="rounded-[16px] border border-[#E2E8F0] bg-[#F8FAFC] p-4">
        <div className="flex items-start gap-3">
          <Info size={16} className="text-[#1B4F8B] mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#64748B] leading-[18px] max-w-[820px]">
              <strong className="text-[#0F172A]">Reference data lives here</strong> — coded entities
              with a code, a name and an active/retired lifecycle, each backed by its own CMTS table.{" "}
              <strong className="text-[#0F172A]">Configuration does not</strong>: tolerances,
              thresholds, day counts and percentages are single keyed values in CMTS{" "}
              <span className="font-mono text-[#1B4F8B]">Lookup</span> /{" "}
              <span className="font-mono text-[#1B4F8B]">Setting</span>, and are edited in the
              registry rather than added to a list below as a code/name pair that cannot hold a
              number.
            </p>
            <Link
              href="/admin/settings/lookup-registry"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[#1B4F8B] hover:underline mt-2"
            >
              Lookup &amp; Setting Registry <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </div>

      <MasterDataContent />
    </div>
  );
}
