import { Circle, CheckCircle, Clock, FileText, Search, Shield, Truck, Check } from "lucide-react";

interface TimelineEvent {
  label: string;
  time: string;
  status: "completed" | "current" | "pending";
  actor?: string;
}

interface TimelineCardProps {
  status: string;
}

export default function TimelineCard({ status }: TimelineCardProps) {
  const events: TimelineEvent[] = [
    { label: "Filed", time: "31 May 2026 09:00", status: "completed", actor: "Al-Huda Clearing" },
    { label: "Channel Assigned", time: "31 May 2026 09:15", status: "completed", actor: "Customs System" },
    { label: "Query Raised", time: "31 May 2026 10:30", status: status === "Query" ? "current" : "completed", actor: "Inspector Raza" },
    { label: "Documents Submitted", time: "31 May 2026 10:45", status: "completed", actor: "Al-Huda Clearing" },
    { label: "Exam Scheduled", time: "—", status: "pending" },
    { label: "Examined", time: "—", status: "pending" },
    { label: "OOC Issued", time: "—", status: "pending" },
    { label: "Released", time: "—", status: "pending" },
  ];

  const currentIndex = events.findIndex((e) => e.status === "current");
  const displayEvents = events.map((e, i) => {
    if (currentIndex === -1 && i === 0) return e;
    return e;
  });

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-[#E2E8F0]">
        <h2 className="text-[15px] font-bold text-[#0F172A]">Customs Timeline</h2>
      </div>

      <div className="p-5">
        <div className="relative">
          <div className="absolute left-[19px] top-3 bottom-3 w-[2px] bg-[#E2E8F0]" />
          <div className="space-y-4">
            {displayEvents.map((event, index) => {
              const isCompleted = event.status === "completed";
              const isCurrent = event.status === "current";
              const isPending = event.status === "pending";

              return (
                <div key={event.label} className="flex items-start gap-4 relative">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 z-10 border-2"
                    style={{
                      backgroundColor: isCompleted ? "#16A34A" : isCurrent ? "#D97706" : "white",
                      borderColor: isCompleted ? "#16A34A" : isCurrent ? "#D97706" : "#E2E8F0",
                    }}
                  >
                    {isCompleted && <CheckCircle size={18} className="text-white" />}
                    {isCurrent && <Clock size={18} className="text-[#D97706]" />}
                    {isPending && <Circle size={18} className="text-[#CBD5E1]" />}
                  </div>
                  <div className="flex-1 pt-1">
                    <div className="flex items-center gap-2">
                      <span
                        className="text-[13px] font-bold"
                        style={{
                          color: isCompleted ? "#0F172A" : isCurrent ? "#D97706" : "#94A3B8",
                        }}
                      >
                        {event.label}
                      </span>
                      {isCurrent && (
                        <span className="text-[10px] font-bold text-[#D97706] bg-[#FEF3C7] px-2 py-0.5 rounded-full">
                          CURRENT
                        </span>
                      )}
                    </div>
                    <p className="text-[12px] text-[#64748B] mt-0.5">
                      {isPending ? "Pending" : event.time}
                    </p>
                    {event.actor && !isPending && (
                      <p className="text-[11px] text-[#94A3B8] mt-0.5">by {event.actor}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}