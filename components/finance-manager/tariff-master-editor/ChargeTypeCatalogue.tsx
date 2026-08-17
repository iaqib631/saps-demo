"use client";

/**
 * CMTS `CHARGETYPE`, split by the Q7 decision.
 *
 * Q7 (CMTS_SCOPE_DECISIONS.md, ticket 86eyn3nmq) decided that `Nonuseabel`
 * means RETIRED, and that the implementation must fail safe in that direction.
 * This panel is where that decision becomes visible, and it has to show BOTH
 * halves of the rule or it shows neither:
 *
 *   • the retired headings are absent from the catalogue a new calculation
 *     draws on — the left column is `activeChargeTypes()`, and there is no
 *     control anywhere on this screen that puts a retired heading back;
 *   • the retired headings are still rendered, and the historical vouchers
 *     billed under them are listed underneath with the amounts they charged.
 *
 * The second half is the one that is easy to skip and expensive to skip. A
 * heading withdrawn in 2025 does not un-bill the money it charged in 2024. If
 * the catalogue simply dropped the row, the 500 on that voucher would become an
 * unattributed number — the consignee asks what it was for and the system
 * cannot say. Retiring a heading has to stop future billing without erasing
 * past billing, and those are two different behaviours over one flag.
 *
 * The raw `Nonuseabel` string is shown verbatim next to every retired row. The
 * decision is a reading of an undecoded varchar, and a reader who disagrees
 * with the reading needs to see what the column actually holds.
 */

import {
  CHARGE_TYPES,
  activeChargeTypes,
  chargeType,
  chargeTypeRetirementMarker,
  formatPkr,
  formatDate,
  isRetiredChargeType,
  retiredChargeTypes,
} from "@/lib/domain";
import { RETIRED_CHARGE_TYPE_USAGES, retiredUsagesFor } from "@/lib/domain/tariff";
import { CmtsCol } from "@/components/finance-manager/IllustrativeRateCardBanner";

export default function ChargeTypeCatalogue() {
  const live = activeChargeTypes();
  const retired = retiredChargeTypes();

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Charge type catalogue</h2>
          <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
            CHARGETYPE
          </span>
          <span className="h-[18px] px-1.5 rounded bg-[#F5F3FF] text-[#7C3AED] text-[10px] font-bold inline-flex items-center font-mono">
            DECISION Q7
          </span>
        </div>
        <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed max-w-3xl">
          The headings the calculator prints under. The catalogue carries no rate of its own — the
          amounts come from the rate tables above, and this only names the line each resolves into
          on a voucher. <span className="font-mono">Nonuseabel</span> means retired: excluded from
          new calculations, still rendered on the records that were billed under it.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E2E8F0]">
        {/* ------------------------ live ------------------------ */}
        <div>
          <div className="px-5 py-3 bg-[#F0FDF4] border-b border-[#BBF7D0]">
            <span className="text-[12px] font-bold text-[#15803D]">
              Available to new calculations · {live.length}
            </span>
            <span className="block text-[11px] text-[#15803D]/80 mt-0.5">
              activeChargeTypes() — the single exclusion point
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {live.map((t) => (
              <div key={t.ChTypeAbb} className="px-5 py-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-[13px] font-semibold text-[#0F172A]">{t.ChTypeName}</span>
                  <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
                    {t.ChTypeAbb}
                  </span>
                </div>
                <span className="text-[12px] text-[#64748B] block mt-0.5">{t.ChTypeDesc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ------------------------ retired ------------------------ */}
        <div>
          <div className="px-5 py-3 bg-[#F8FAFC] border-b border-[#E2E8F0]">
            <span className="text-[12px] font-bold text-[#475569]">
              Retired · {retired.length}
            </span>
            <span className="block text-[11px] text-[#64748B] mt-0.5">
              Excluded from new calculations. Still shown on historical records.
            </span>
          </div>
          <div className="divide-y divide-[#E2E8F0]">
            {retired.map((t) => {
              const usages = retiredUsagesFor(t.ChTypeAbb);
              return (
                <div key={t.ChTypeAbb} className="px-5 py-3.5">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-semibold text-[#64748B] line-through decoration-[#CBD5E1]">
                      {t.ChTypeName}
                    </span>
                    <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[10px] font-bold inline-flex items-center font-mono">
                      {t.ChTypeAbb}
                    </span>
                  </div>
                  <span className="text-[12px] text-[#94A3B8] block mt-0.5">{t.ChTypeDesc}</span>

                  {/* The marker, and the raw column value behind it. */}
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span
                      className="h-[20px] px-1.5 rounded text-[10px] font-bold inline-flex items-center font-mono"
                      style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
                      title="Q7: any non-empty Nonuseabel is treated as retirement"
                    >
                      {chargeTypeRetirementMarker(t)}
                    </span>
                    <span className="text-[11px] text-[#64748B]">
                      <CmtsCol name="Nonuseabel" tone="strong" />
                    </span>
                  </div>

                  <p className="text-[11px] text-[#64748B] mt-2 leading-relaxed">
                    {usages.length === 0
                      ? "No historical voucher on file under this heading."
                      : `${usages.length} historical voucher${usages.length === 1 ? "" : "s"} still render${usages.length === 1 ? "s" : ""} under it — listed below.`}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* --------------- the historical records themselves --------------- */}
      <div className="px-5 py-3 border-t border-b border-[#E2E8F0] bg-[#F8FAFC]">
        <span className="text-[12px] font-bold text-[#0F172A]">
          Historical records billed under a retired heading
        </span>
        <span className="text-[11px] text-[#64748B] ml-2">
          Rendered, not hidden — the money was charged and has to stay explainable
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                Voucher<CmtsCol name="VOUCHERNO" />
              </th>
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                Raised<CmtsCol name="GRDATE" />
              </th>
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                AWB<CmtsCol name="AWBNO" />
              </th>
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                Billed under<CmtsCol name="ChTypeName" />
              </th>
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                Amount
              </th>
              <th className="text-left text-[11px] font-semibold text-[#64748B] uppercase tracking-wider px-4 py-2.5 whitespace-nowrap align-bottom">
                Site
              </th>
            </tr>
          </thead>
          <tbody>
            {RETIRED_CHARGE_TYPE_USAGES.map((u) => {
              const type = chargeType(u.ChTypeAbb);
              const marker = type ? chargeTypeRetirementMarker(type) : null;
              return (
                <tr key={u.VOUCHERNO} className="border-b border-[#E2E8F0] align-top">
                  <td className="px-4 py-3 font-mono text-[12px] font-semibold text-[#0B2545] whitespace-nowrap">
                    {u.VOUCHERNO}
                  </td>
                  <td className="px-4 py-3 text-[13px] text-[#475569] whitespace-nowrap">
                    {formatDate(u.GRDATE)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#475569] whitespace-nowrap">
                    {u.AWBNO}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[13px] text-[#0F172A]">{u.ChTypeName}</span>
                      <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#94A3B8] text-[10px] font-bold inline-flex items-center font-mono">
                        {u.ChTypeAbb}
                      </span>
                      {marker && (
                        <span
                          className="h-[18px] px-1.5 rounded text-[10px] font-bold inline-flex items-center font-mono"
                          style={{ backgroundColor: "#FEF3C7", color: "#B45309" }}
                        >
                          {marker}
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-[#64748B] mt-1 leading-relaxed max-w-xl whitespace-normal">
                      {u.why}
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono text-[13px] font-semibold text-[#0F172A] whitespace-nowrap">
                    {formatPkr(u.AMOUNT)}
                  </td>
                  <td className="px-4 py-3 font-mono text-[12px] text-[#475569]">{u.site}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="px-5 py-3.5 border-t border-[#E2E8F0] bg-[#F8FAFC]">
        <p className="text-[11px] text-[#64748B] leading-relaxed max-w-4xl">
          <span className="font-semibold text-[#475569]">Why retired and not live.</span> The two
          wrong answers are not equally wrong. Guess retired when the heading was really live and it
          goes missing from the next calculation — visible immediately, one flag to flip. Guess live
          when it was really retired and migrated rates quietly re-activate billing SAPS stopped
          doing — wrong invoices, found by a customer. So{" "}
          <span className="font-mono">isRetiredChargeType()</span> treats ANY non-empty{" "}
          <span className="font-mono">Nonuseabel</span> as retirement, including a value nobody has
          decoded. {CHARGE_TYPES.filter(isRetiredChargeType).length} of {CHARGE_TYPES.length}{" "}
          headings are affected.
        </p>
      </div>
    </div>
  );
}
