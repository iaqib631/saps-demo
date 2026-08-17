import {
  Package,
  Truck,
  QrCode,
  Shield,
  DollarSign,
  FileText,
  User,
  AlertCircle,
  Clock,
  Settings,
  CheckCircle2,
} from "lucide-react";

const activities = [
  {
    icon: Package,
    action: "Putaway",
    actor: "Lifter-03",
    entity: "AWB 117-89234501",
    time: "2 min ago",
    portal: "Warehouse Manager",
    scope: "inc" as const,
    status: "success" as const,
  },
  {
    icon: Truck,
    action: "Gate Entry",
    actor: "Gate-Officer-02",
    entity: "Vehicle KHI-7843",
    time: "5 min ago",
    portal: "Gate Entry",
    scope: "inc" as const,
    status: "success" as const,
  },
  {
    icon: QrCode,
    action: "RFID Scan",
    actor: "Forklift-07",
    entity: "Pallet PLT-4402",
    time: "7 min ago",
    portal: "Lifter Operator",
    scope: "inc" as const,
    status: "success" as const,
  },
  {
    icon: Shield,
    action: "Customs Hold",
    actor: "Excise-Officer-A",
    entity: "AWB 117-89234505",
    time: "12 min ago",
    portal: "Excise / Compliance",
    scope: "inc" as const,
    status: "warning" as const,
  },
  {
    icon: DollarSign,
    action: "Invoice Generated",
    actor: "System",
    entity: "INV-2026-051-0045",
    time: "15 min ago",
    portal: "Finance Manager",
    scope: "inc" as const,
    status: "success" as const,
  },
  {
    icon: FileText,
    action: "DO Created",
    actor: "Fwd-Agent-12",
    entity: "DO-2026-08912",
    time: "18 min ago",
    portal: "Forwarding Agent",
    scope: "exc" as const,
    status: "success" as const,
  },
  {
    icon: User,
    action: "Pickup Scheduled",
    actor: "Consignee-Portal",
    entity: "AWB 117-89234512",
    time: "22 min ago",
    portal: "Consignee",
    scope: "exc" as const,
    status: "success" as const,
  },
  {
    icon: AlertCircle,
    action: "Rack Full Alert",
    actor: "System",
    entity: "Zone C - Rack 08",
    time: "28 min ago",
    portal: "Warehouse Manager",
    scope: "inc" as const,
    status: "error" as const,
  },
  {
    icon: Clock,
    action: "Slot Reserved",
    actor: "Planner-01",
    entity: "Dock B - 11:30",
    time: "32 min ago",
    portal: "Planner",
    scope: "inc" as const,
    status: "success" as const,
  },
  {
    icon: Settings,
    action: "User Role Updated",
    actor: "Admin",
    entity: "Faisal Ahmed",
    time: "45 min ago",
    // A role granted to one named person is FC-12 §05 (/admin/users), which is
    // ONE site's configuration and lives in the Warehouse portal's Administration
    // block. It is not an HQ act: the HQ tier issues the DELEGATION saying who may
    // administer which node (/hq/site-admins), never the node's own role rows. The
    // old "Admin / Super Admin" named both tiers for an event that belongs to one,
    // which is the same conflation the landing tile carried.
    portal: "Site Administration",
    scope: "inc" as const,
    status: "success" as const,
  },
];

export default function ActivityFeed() {
  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-[18px] font-semibold text-[#0F172A] leading-[28px]">
          Recent Activity
        </h3>
      </div>
      <div className="flex flex-col gap-0">
        {activities.map((activity, index) => {
          const Icon = activity.icon;
          const statusColor =
            activity.status === "success"
              ? "#16A34A"
              : activity.status === "warning"
              ? "#D97706"
              : "#DC2626";
          return (
            <div
              key={index}
              className="flex items-start gap-3 py-3 border-b border-[#F1F5F9] last:border-0"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: `${statusColor}15` }}
              >
                <Icon size={14} style={{ color: statusColor }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[13px] font-medium text-[#0F172A]">
                    {activity.actor}
                  </span>
                  <span className="text-[13px] text-[#64748B]">
                    {activity.action}
                  </span>
                  <span className="text-[13px] font-semibold text-[#1B4F8B]">
                    {activity.entity}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <span className="text-[11px] text-[#94A3B8]">
                    {activity.time}
                  </span>
                  <span className="text-[11px] text-[#94A3B8]">·</span>
                  <span className="text-[11px] text-[#64748B] font-medium">
                    {activity.portal}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}