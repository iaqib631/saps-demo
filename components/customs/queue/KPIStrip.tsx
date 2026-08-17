"use client";

export default function KPIStrip() {
  const kpis = [
    { title: "Green Channel AWBs", value: "42", subtitle: "Fast-track clearance", trend: "up" as const, trendValue: "+3 today" },
    { title: "Yellow Channel AWBs", value: "28", subtitle: "Document review", trend: "down" as const, trendValue: "-2 today" },
    { title: "Red Channel AWBs", value: "7", subtitle: "Physical exam required", trend: "up" as const, trendValue: "+1 today" },
    { title: "OOC Pending", value: "15", subtitle: "Awaiting customs release", trend: "neutral" as const, trendValue: "No change" },
    { title: "Holds Active", value: "9", subtitle: "Under customs hold", trend: "up" as const, trendValue: "+2 today" },
    { title: "Average Clearance Age", value: "4h 20m", subtitle: "From filing to release", trend: "down" as const, trendValue: "-12 min" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3">
      {kpis.map((kpi) => {
        const trendColor =
          kpi.trend === "up" ? "#16A34A" : kpi.trend === "down" ? "#DC2626" : "#64748B";
        return (
          <div
            key={kpi.title}
            className="rounded-[16px] border border-[#E2E8F0] bg-white p-5 shadow-sm"
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[12px] font-semibold text-[#64748B] leading-tight">
                {kpi.title}
              </h3>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-bold text-[#0F172A]">{kpi.value}</span>
              <span className="text-[11px] font-medium" style={{ color: trendColor }}>
                {kpi.trendValue}
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] mt-1">{kpi.subtitle}</p>
          </div>
        );
      })}
    </div>
  );
}