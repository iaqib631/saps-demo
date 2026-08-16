interface ChannelSwitcherProps {
  activeTab: string;
  onChange: (tab: string) => void;
}

const tabs = [
  { key: "green", label: "Green Channel", color: "#16A34A", bg: "#DCFCE7" },
  { key: "yellow", label: "Yellow Channel", color: "#D97706", bg: "#FEF3C7" },
  { key: "red", label: "Red Channel", color: "#DC2626", bg: "#FEE2E2" },
];

export default function ChannelSwitcher({ activeTab, onChange }: ChannelSwitcherProps) {
  return (
    <div className="flex items-center gap-2">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            className="flex items-center gap-2 h-10 px-4 rounded-xl text-[13px] font-semibold cursor-pointer transition-all whitespace-nowrap"
            style={{
              backgroundColor: isActive ? tab.bg : "white",
              color: isActive ? tab.color : "#64748B",
              border: isActive ? `1.5px solid ${tab.color}` : "1.5px solid #E2E8F0",
              boxShadow: isActive ? `0 0 0 3px ${tab.bg}` : "none",
            }}
          >
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{
                backgroundColor: isActive ? tab.color : "#CBD5E1",
              }}
            />
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}