"use client";

export default function KPIStrip() {
  const kpis = [
    { title: "Messages Today", value: "147", subtitle: "All IATA messages", trend: "up", trendValue: "+12 today" },
    { title: "Sent", value: "89", subtitle: "Outbound to carriers", trend: "up", trendValue: "+8 today" },
    { title: "Received", value: "58", subtitle: "Inbound from carriers", trend: "up", trendValue: "+4 today" },
    { title: "Failed", value: "3", subtitle: "Requires retry", trend: "up", trendValue: "+1 today" },
    { title: "Pending Retry", value: "5", subtitle: "In retry queue", trend: "neutral", trendValue: "No change" },
    { title: "Linked AWBs", value: "42", subtitle: "Messages with AWB link", trend: "up", trendValue: "+3 today" },
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