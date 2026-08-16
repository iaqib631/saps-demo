"use client";

interface ChannelTabsProps {
  active: string;
  onChange: (channel: string) => void;
  counts: Record<string, number>;
}

const channels = [
  { key: "All", label: "All" },
  { key: "Green", label: "Green" },
  { key: "Yellow", label: "Yellow" },
  { key: "Red", label: "Red" },
];

const channelColors: Record<string, string> = {
  Green: "#16A34A",
  Yellow: "#D97706",
  Red: "#DC2626",
  All: "#64748B",
};

export default function ChannelTabs({ active, onChange, counts }: ChannelTabsProps) {
  return (
    <div className="flex items-center gap-2">
      {channels.map((ch) => {
        const isActive = active === ch.key;
        const color = channelColors[ch.key];
        return (
          <button
            key={ch.key}
            onClick={() => onChange(ch.key)}
            className="flex items-center gap-2 h-9 px-4 rounded-full text-[13px] font-semibold cursor-pointer transition-all border whitespace-nowrap"
            style={{
              backgroundColor: isActive ? color : "white",
              color: isActive ? "white" : color,
              borderColor: color,
            }}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: isActive ? "white" : color }}
            />
            {ch.label}
            <span
              className="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 rounded-full text-[11px] font-bold"
              style={{
                backgroundColor: isActive ? "white" : color + "15",
                color: isActive ? color : color,
              }}
            >
              {counts[ch.key] || 0}
            </span>
          </button>
        );
      })}
    </div>
  );
}