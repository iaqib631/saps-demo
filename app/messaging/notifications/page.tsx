"use client";

/**
 * P7-2 / P7-3 / P7-4 · Notification engine, trigger map, and the notify
 * party — M08, FC-05.
 *
 * Four things here.
 *
 * **Templates (P7-2).** CMTS has no template table; notifications were free
 * text typed per send, which is why no two NOAs ever read the same. They are
 * versioned, because a template edit must not retroactively change what a
 * dispatch three months ago actually said — which is why saving an edit here
 * bumps the version rather than overwriting in place. The editor, the
 * activate/deactivate toggle, the preview and the draft-creation flow came
 * across from `/notifications-messaging`, which was the only screen in the
 * demo that could actually author a template; this screen could only read
 * them.
 *
 * **Trigger map (P7-3).** FC-05's board named nine operational events. BC-6
 * added five more, because a declared message type that nothing emits is a
 * gap in the spine rather than a faithful reading of it: TGC, Free Period
 * Expiry, Customs Hold and Payment Due all sat declared with no producer, and
 * NFD hung off `cargo-warehoused` — which declared the carrier "notified for
 * delivery" at the same instant the consignee was told the cargo landed,
 * before the NOA had actually gone out. Every declared notification now has a
 * trigger behind it, so the gap panel this screen used to render has been
 * inverted into the record of what closed it. The count in the heading is
 * read off TRIGGER_MAP rather than written out, so it cannot go stale again.
 *
 * **Dispatch history (P7-4a).** The log carries the failure reason and the
 * attempt count, so a failed dispatch can be read and re-queued here instead
 * of only being counted in a KPI.
 *
 * **Notify party (P7-4).** AWB 816-00034156 in the SAPS document set carries
 * TWO notify parties: Relizon Pharmaceuticals (the operating company) and
 * Meezan Bank (the financing party). FC-05 addresses the NOA to
 * "Consignee / CHA" and has no concept of either, and CMTS has no notify
 * party column at all — so on a financed import the people actually waiting
 * for the cargo are not on the notification list.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Bell,
  CheckCheck,
  Eye,
  Mail,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Users,
  X,
  Zap,
} from "lucide-react";
import Breadcrumb from "@/components/Breadcrumb";
import EmptyState from "@/components/EmptyState";
import AwbLink from "@/components/awb/AwbLink";
import { useSite } from "@/components/site/SiteContext";
import { useToast } from "@/components/ToastContext";
import {
  CHANNEL_LABEL,
  CUSTOMER_NOTIFICATION_LABEL,
  IATA_MESSAGE_LABEL,
  NOTIFICATION_TEMPLATES,
  REFERENCE_AWB_DOCUMENTS,
  TRIGGER_MAP,
  formatDateTime,
  listNotifications,
  type Channel,
  type CustomerNotification,
  type NotificationTemplate,
  type OperationalTrigger,
} from "@/lib/domain";

const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  queued: { bg: "#F1F5F9", fg: "#64748B" },
  sent: { bg: "#DBEAFE", fg: "#1B4F8B" },
  delivered: { bg: "#DCFCE7", fg: "#16A34A" },
  read: { bg: "#EBF0F7", fg: "#0B2545" },
  failed: { bg: "#FEE2E2", fg: "#DC2626" },
};

const CHANNEL_ICON: Record<Channel, typeof Mail> = {
  email: Mail,
  sms: Smartphone,
  whatsapp: MessageCircle,
};

const ALL_NOTIFICATIONS = Object.keys(CUSTOMER_NOTIFICATION_LABEL) as CustomerNotification[];
const ALL_CHANNELS: Channel[] = ["email", "sms", "whatsapp"];

/**
 * What BC-6 closed.
 *
 * This screen used to render an amber panel headed "listed on the board but
 * never wired to a trigger". That gap no longer exists, and a panel advertising
 * a gap that has been closed is worse than no panel at all — so it is inverted
 * into the record of the fix rather than deleted, because the reason each of
 * these was wired is the interesting part.
 *
 * Only the trigger id and the reason live here; the label and the fan-out are
 * read back out of TRIGGER_MAP. If a trigger is ever removed from the map its
 * row silently disappears instead of claiming a wiring that no longer exists.
 */
const BC6_CLOSED: Array<{ trigger: OperationalTrigger; note: string }> = [
  {
    trigger: "ground-custody-transferred",
    note: "TGC sat in the declared message list with nothing emitting it — the handover from flight to ground custody raised no message at all.",
  },
  {
    trigger: "free-period-expiring",
    note: "The dwell clock already knew the free period was about to run out (FC-07 §02–03); nobody told the consignee until the charge appeared.",
  },
  {
    trigger: "customs-hold-placed",
    note: "A hold on HOLDINGSTATUS stopped the cargo silently — the consignee learned of it by turning up for collection.",
  },
  {
    trigger: "invoice-issued",
    note: "Payment Due was a declared notification with no invoicing event behind it, so an issued invoice notified nobody.",
  },
  {
    trigger: "noa-issued",
    note: "A correction rather than an addition: NFD used to hang off cargo-warehoused, declaring the carrier notified for delivery before the NOA had gone out. It now fires off the NOA's own issue event, so the real order — warehoused → NOA → NFD — is what runs.",
  },
];

/**
 * Sample values for the template preview. Keyed by the variable names the
 * templates actually declare, so an unrecognised variable renders as its own
 * placeholder rather than silently vanishing from the preview.
 */
const PREVIEW_VALUES: Record<string, string> = {
  recipientName: "Relizon Pharmaceuticals",
  awbNo: "816-00034156",
  pieces: "24",
  weight: "1,240 kg",
  site: "KHI",
  arrivalDate: "12 Aug 2026",
  flight: "EK-602",
  freeExpiry: "15 Aug 2026",
  missingDocs: "Commercial invoice, packing list",
  doNo: "DO-KHI-2026-01184",
  amount: "PKR 184,500",
  deliveredAt: "16 Aug 2026 11:20",
  receiverName: "M. Adnan (CNIC 42101-*****-3)",
  rate: "PKR 12 / kg / day",
  holdDate: "13 Aug 2026",
  holdReason: "Valuation query — PSW channel Yellow",
  invoiceNo: "INV-KHI-2026-00921",
  outstanding: "PKR 184,500",
  dueDate: "20 Aug 2026",
};

function fillVariables(body: string): string {
  return body.replace(/\{\{(\w+)\}\}/g, (whole, key: string) => PREVIEW_VALUES[key] ?? whole);
}

export default function NotificationsPage() {
  const { scope, isHq } = useSite();
  const { addToast } = useToast();
  const dispatches = useMemo(() => listNotifications(scope), [scope]);

  const [tab, setTab] = useState<"triggers" | "templates" | "history" | "notify">("triggers");
  const [tplNotification, setTplNotification] = useState<CustomerNotification>("NOA");

  // Templates are seeded from the typed fixture and then edited locally — this
  // is a mock-data prototype, so there is nothing to persist to.
  const [templates, setTemplates] = useState<NotificationTemplate[]>(() =>
    NOTIFICATION_TEMPLATES.map((t) => ({ ...t })),
  );
  const [preview, setPreview] = useState<NotificationTemplate | null>(null);
  const [draft, setDraft] = useState<NotificationTemplate | null>(null);

  // Which failed dispatches the operator has re-queued this session. Keyed on
  // Id rather than mutating the fixture, so a site switch does not lose it.
  const [requeued, setRequeued] = useState<number[]>([]);

  const failed = dispatches.filter((d) => d.status === "failed");
  const read = dispatches.filter((d) => d.status === "read");

  const visibleTemplates = templates.filter(
    (t) => t.notification === tplNotification && !t.IsDeleted,
  );

  // Coverage replaces the old "unwired notifications" tile. That tile counted
  // the gap, and the gap is now zero — a permanent 0 tells the reader nothing.
  // This counts the same fact from the other end, and goes amber on its own if
  // a notification ever loses its producer again.
  const wired = new Set(TRIGGER_MAP.flatMap((t) => t.customer));
  const fullyWired = wired.size === ALL_NOTIFICATIONS.length;

  const saveDraft = () => {
    if (!draft) return;
    const clean: NotificationTemplate = {
      ...draft,
      // SMS carries no subject line, so switching a template to SMS drops it
      // rather than keeping a subject nothing will ever send.
      Subject: draft.channel === "sms" ? null : draft.Subject,
      IsHtml: draft.channel === "email",
    };
    setTemplates((prev) => {
      const exists = prev.some((t) => t.Id === clean.Id);
      if (!exists) return [...prev, clean];
      // A template edit produces a new version. Dispatches record the
      // TemplateId and version they used, so history keeps saying what it said.
      return prev.map((t) => (t.Id === clean.Id ? { ...clean, version: t.version + 1 } : t));
    });
    setDraft(null);
    addToast(`${clean.DisplayName} saved`, "success");
  };

  const toggleActive = (t: NotificationTemplate) => {
    setTemplates((prev) =>
      prev.map((x) => (x.Id === t.Id ? { ...x, IsActive: !x.IsActive } : x)),
    );
    addToast(
      t.IsActive ? `${t.DisplayName} deactivated` : `${t.DisplayName} activated`,
      "success",
    );
  };

  const createDraft = () => {
    const nextId = templates.reduce((max, t) => Math.max(max, t.Id), 0) + 1;
    const fresh: NotificationTemplate = {
      Id: nextId,
      notification: tplNotification,
      channel: "email",
      DisplayName: `${CUSTOMER_NOTIFICATION_LABEL[tplNotification]} — new draft`,
      Subject: "",
      Body: "",
      IsHtml: true,
      variables: [],
      version: 1,
      IsActive: false,
      IsDeleted: false,
    };
    setTemplates((prev) => [...prev, fresh]);
    setDraft(fresh);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Breadcrumb items={[{ label: "Messaging" }, { label: "Notification Engine" }]} />
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#0B2545] text-[10px] font-bold inline-flex items-center font-mono">
              M07 · M08
            </span>
            <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center font-mono">
              FC-05
            </span>
          </div>
          <h1 className="text-[24px] lg:text-[32px] font-bold text-[#0F172A] leading-tight mt-1.5">
            Notification Engine
          </h1>
          <p className="text-[13px] text-[#64748B] mt-1">
            What fires what, what it says, who received it — and who should have.
            {isHq ? " All sites." : ` ${scope} only.`}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Triggers wired", value: `${TRIGGER_MAP.length}`, tone: "#0F172A" },
          {
            label: "Notification coverage",
            value: `${wired.size} / ${ALL_NOTIFICATIONS.length}`,
            tone: fullyWired ? "#16A34A" : "#D97706",
          },
          { label: "Dispatches", value: String(dispatches.length), tone: "#1B4F8B" },
          { label: "Failed", value: String(failed.length), tone: "#DC2626" },
        ].map((k) => (
          <div key={k.label} className="rounded-[16px] border border-[#E2E8F0] bg-white p-5">
            <p className="text-[11px] font-semibold text-[#94A3B8] uppercase tracking-wider">
              {k.label}
            </p>
            <p className="text-[22px] font-bold mt-1" style={{ color: k.tone }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {(
          [
            ["triggers", "Trigger map"],
            ["templates", `Templates (${templates.filter((t) => !t.IsDeleted).length})`],
            ["history", `History (${dispatches.length})`],
            ["notify", "Notify party"],
          ] as const
        ).map(([v, label]) => (
          <button
            key={v}
            onClick={() => setTab(v)}
            className="h-8 px-3.5 rounded-lg text-[12px] font-semibold border transition-colors cursor-pointer"
            style={{
              backgroundColor: tab === v ? "#0B2545" : "#FFFFFF",
              color: tab === v ? "#FFFFFF" : "#475569",
              borderColor: tab === v ? "#0B2545" : "#E2E8F0",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ---------- Trigger map ---------- */}
      {tab === "triggers" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center gap-2">
              <Zap size={15} className="text-[#64748B]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#0F172A]">
                  {TRIGGER_MAP.length} operational events and their fan-out
                </h3>
                <p className="text-[11px] text-[#94A3B8] mt-0.5">
                  One event can raise both an IATA message and a customer notification.
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {TRIGGER_MAP.map((t) => (
                <div key={t.trigger} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[13px] font-semibold text-[#0F172A]">{t.label}</span>
                        <span className="h-[18px] px-1.5 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-semibold inline-flex items-center">
                          {t.source}
                        </span>
                        {!t.enabled && (
                          <span className="h-[18px] px-1.5 rounded bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center">
                            DISABLED
                          </span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] text-[#CBD5E1] mt-0.5">{t.trigger}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.iata.map((m) => (
                        <span
                          key={m}
                          title={IATA_MESSAGE_LABEL[m]}
                          className="h-[24px] px-2.5 rounded-full bg-[#EBF0F7] text-[#1B4F8B] text-[11px] font-bold font-mono inline-flex items-center gap-1"
                        >
                          <Send size={10} />
                          {m}
                        </span>
                      ))}
                      {t.customer.map((c) => (
                        <span
                          key={c}
                          className="h-[24px] px-2.5 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[11px] font-semibold inline-flex items-center gap-1"
                        >
                          <Bell size={10} />
                          {CUSTOMER_NOTIFICATION_LABEL[c]}
                        </span>
                      ))}
                      {t.iata.length === 0 && t.customer.length === 0 && (
                        <span className="text-[11px] text-[#94A3B8]">no fan-out</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* The inverted gap panel — see BC6_CLOSED. */}
          <div className="rounded-[16px] border border-[#BBF7D0] bg-[#F0FDF4] overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#BBF7D0] flex items-center gap-2">
              <ShieldCheck size={15} className="text-[#16A34A]" />
              <div>
                <h3 className="text-[14px] font-semibold text-[#16A34A]">
                  Every declared notification now has a producer
                </h3>
                <p className="text-[11px] text-[#166534] mt-0.5">
                  FC-05&rsquo;s board declared message types it then gave nothing to fire them.
                  BC-6 wired the five below — four additions and one correction.
                </p>
              </div>
            </div>
            <div className="divide-y divide-[#BBF7D0]">
              {BC6_CLOSED.map(({ trigger, note }) => {
                const t = TRIGGER_MAP.find((x) => x.trigger === trigger);
                if (!t) return null;
                return (
                  <div key={trigger} className="px-5 py-3.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="h-[22px] px-2.5 rounded-full bg-white text-[#16A34A] text-[11px] font-semibold inline-flex items-center border border-[#BBF7D0]">
                        {t.label}
                      </span>
                      <span className="text-[11px] text-[#166534]">→</span>
                      {t.iata.map((m) => (
                        <span
                          key={m}
                          title={IATA_MESSAGE_LABEL[m]}
                          className="h-[22px] px-2 rounded-full bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-bold font-mono inline-flex items-center"
                        >
                          {m}
                        </span>
                      ))}
                      {t.customer.map((c) => (
                        <span
                          key={c}
                          className="h-[22px] px-2 rounded-full bg-[#DCFCE7] text-[#16A34A] text-[10px] font-semibold inline-flex items-center"
                        >
                          {CUSTOMER_NOTIFICATION_LABEL[c]}
                        </span>
                      ))}
                      <span className="font-mono text-[10px] text-[#86EFAC]">{t.source}</span>
                    </div>
                    <p className="text-[12px] text-[#166534] mt-1">{note}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Templates ---------- */}
      {tab === "templates" && (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap gap-2">
            {ALL_NOTIFICATIONS.map((n) => (
              <button
                key={n}
                onClick={() => setTplNotification(n)}
                className="h-8 px-3 rounded-lg text-[11px] font-semibold border transition-colors cursor-pointer"
                style={{
                  backgroundColor: tplNotification === n ? "#1B4F8B" : "#FFFFFF",
                  color: tplNotification === n ? "#FFFFFF" : "#475569",
                  borderColor: tplNotification === n ? "#1B4F8B" : "#E2E8F0",
                }}
              >
                {CUSTOMER_NOTIFICATION_LABEL[n]}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {visibleTemplates.map((t) => {
              const Icon = CHANNEL_ICON[t.channel];
              return (
                <div
                  key={t.Id}
                  className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden flex flex-col"
                >
                  <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-2">
                    <h3 className="text-[13px] font-semibold text-[#0F172A] inline-flex items-center gap-1.5">
                      <Icon size={13} className="text-[#64748B]" />
                      {CHANNEL_LABEL[t.channel]}
                    </h3>
                    <div className="flex items-center gap-1.5">
                      <span
                        className="h-[20px] px-2 rounded text-[10px] font-bold inline-flex items-center"
                        style={
                          t.IsActive
                            ? { backgroundColor: "#DCFCE7", color: "#16A34A" }
                            : { backgroundColor: "#FEF3C7", color: "#D97706" }
                        }
                      >
                        {t.IsActive ? "ACTIVE" : "DRAFT"}
                      </span>
                      <span className="h-[20px] px-2 rounded bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold font-mono inline-flex items-center">
                        v{t.version}
                      </span>
                    </div>
                  </div>
                  <div className="p-5 flex-1">
                    <p className="text-[12px] font-semibold text-[#0B2545] mb-2">{t.DisplayName}</p>
                    {t.Subject && (
                      <>
                        <p className="text-[10px] font-mono text-[#CBD5E1]">SUBJECT</p>
                        <p className="text-[12px] font-semibold text-[#0F172A] mb-3">{t.Subject}</p>
                      </>
                    )}
                    <p className="text-[10px] font-mono text-[#CBD5E1]">BODY</p>
                    <pre className="text-[11px] text-[#475569] whitespace-pre-wrap font-sans mt-1 leading-relaxed">
                      {t.Body || "— empty —"}
                    </pre>
                    {t.variables.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-3 pt-3 border-t border-[#F1F5F9]">
                        {t.variables.map((v) => (
                          <span
                            key={v}
                            className="h-[18px] px-1.5 rounded bg-[#EBF0F7] text-[#1B4F8B] text-[9px] font-mono inline-flex items-center"
                          >
                            {`{{${v}}}`}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="px-5 py-3 border-t border-[#F1F5F9] flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => setPreview(t)}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                    <button
                      onClick={() => setDraft({ ...t })}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold text-[#0B2545] border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer transition-colors whitespace-nowrap"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleActive(t)}
                      className="h-7 px-2.5 rounded-lg text-[11px] font-semibold border cursor-pointer transition-colors whitespace-nowrap"
                      style={
                        t.IsActive
                          ? { color: "#DC2626", borderColor: "#FECACA" }
                          : { color: "#16A34A", borderColor: "#BBF7D0" }
                      }
                    >
                      {t.IsActive ? "Deactivate" : "Activate"}
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              onClick={createDraft}
              className="min-h-[200px] rounded-[16px] border-2 border-dashed border-[#E2E8F0] hover:border-[#2E75B6] hover:bg-[#F8FAFC] cursor-pointer transition-all flex items-center justify-center gap-1.5 text-[13px] font-semibold text-[#94A3B8]"
            >
              <Plus size={15} />
              New template
            </button>
          </div>

          <p className="text-[11px] text-[#94A3B8]">
            Templates are versioned and a dispatch records the template it used — so editing a
            template never changes what an earlier notification actually said. Saving an edit here
            raises the version rather than overwriting it. CMTS has no template table; this is an
            AirVault addition.
          </p>
        </div>
      )}

      {/* ---------- History ---------- */}
      {tab === "history" &&
        (dispatches.length === 0 ? (
          <EmptyState title="No dispatches at this site" description="Notifications fire from the trigger map." />
        ) : (
          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <CheckCheck size={15} className="text-[#64748B]" />
                <div>
                  <h3 className="text-[14px] font-semibold text-[#0F172A]">
                    Dispatch history &amp; receipts
                  </h3>
                  <p className="text-[11px] text-[#94A3B8]">
                    Delivery and read receipts — CMTS records neither
                  </p>
                </div>
              </div>
              <span className="text-[11px] text-[#64748B]">
                {read.length} read · {failed.length} failed
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1180px]">
                <thead>
                  <tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]">
                    {["Notification", "Channel", "AWB", "Recipient", "Destination", "Status", "Sent", "Read", "Error", ""].map((h, i) => (
                      <th
                        key={`${h}-${i}`}
                        className="text-left px-4 py-2.5 text-[10px] font-semibold text-[#94A3B8] uppercase tracking-wider whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dispatches.slice(0, 50).map((d) => {
                    const tone = STATUS_TONE[d.status] ?? STATUS_TONE.queued;
                    const isRequeued = requeued.includes(d.Id);
                    return (
                      <tr
                        key={d.Id}
                        className="border-b border-[#F1F5F9] last:border-0"
                        style={{ backgroundColor: d.status === "failed" ? "#FEF2F2" : undefined }}
                      >
                        <td className="px-4 py-2.5 text-[12px] text-[#0F172A] whitespace-nowrap">
                          {CUSTOMER_NOTIFICATION_LABEL[d.notification]}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-[#64748B]">
                          {CHANNEL_LABEL[d.channel]}
                        </td>
                        <td className="px-4 py-2.5">
                          {d.awbId && d.AWBNO ? <AwbLink awbNo={d.AWBNO} awbId={d.awbId} /> : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[12px] text-[#475569] max-w-[180px] truncate">
                          {d.recipientName}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-[10px] text-[#94A3B8] max-w-[160px] truncate">
                          {d.destination}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="h-[22px] px-2.5 rounded-full text-[10px] font-bold inline-flex items-center uppercase"
                            style={{ backgroundColor: tone.bg, color: tone.fg }}
                          >
                            {d.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {d.sentAt ? formatDateTime(d.sentAt) : "—"}
                        </td>
                        <td className="px-4 py-2.5 text-[11px] text-[#94A3B8] whitespace-nowrap">
                          {d.readAt ? formatDateTime(d.readAt) : "—"}
                        </td>
                        {/*
                          CMTS carried NoOfTry and nothing else — the reason a send
                          failed lived in the gateway log, not the history table, so
                          the clerk chasing it had nowhere to look.
                        */}
                        <td className="px-4 py-2.5 max-w-[220px]">
                          {d.failureReason ? (
                            <>
                              <span className="text-[11px] text-[#DC2626]">{d.failureReason}</span>
                              <span className="block font-mono text-[10px] text-[#F87171]">
                                {d.NoOfTry} attempt{d.NoOfTry === 1 ? "" : "s"}
                              </span>
                            </>
                          ) : (
                            <span className="text-[11px] text-[#CBD5E1]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          {d.status === "failed" &&
                            (isRequeued ? (
                              <span className="h-[24px] px-2 rounded-lg bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center uppercase">
                                Queued
                              </span>
                            ) : (
                              <button
                                onClick={() => {
                                  setRequeued((prev) => [...prev, d.Id]);
                                  addToast(
                                    `Dispatch ${d.Id} re-queued to ${d.destination}`,
                                    "success",
                                  );
                                }}
                                className="h-[26px] px-2.5 rounded-lg text-[11px] font-semibold text-[#DC2626] border border-[#FECACA] hover:bg-[#FEE2E2] cursor-pointer transition-colors inline-flex items-center gap-1 whitespace-nowrap"
                              >
                                <RefreshCw size={11} />
                                Retry
                              </button>
                            ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ))}

      {/* ---------- Notify party (P7-4) ---------- */}
      {tab === "notify" && (
        <div className="flex flex-col gap-5">
          <div className="rounded-[16px] border border-[#FCA5A5] bg-[#FEF2F2] px-5 py-4 flex items-start gap-3">
            <Users size={17} className="text-[#DC2626] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-[13px] font-semibold text-[#DC2626]">
                The NOA has no notify party at all
              </p>
              <p className="text-[12px] text-[#991B1B] mt-1">
FC-05 addresses the arrival notice to &ldquo;Consignee / CHA&rdquo;. Real
                AWBs carry <strong>notify parties</strong> as well — often two: the operating
                company and its financing bank. Neither is a consignee and neither is a CHA, so
                neither is notified. CMTS has no notify party column, so today there is nowhere to
                record them even if the flow asked.
              </p>
            </div>
          </div>

          <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-[#E2E8F0]">
              <h3 className="text-[14px] font-semibold text-[#0F172A]">
                Evidence — from the SAPS document set
              </h3>
              <p className="text-[11px] text-[#94A3B8] mt-0.5">
                Transcribed verbatim from the four scanned documents supplied for review.
              </p>
            </div>
            <div className="divide-y divide-[#F1F5F9]">
              {REFERENCE_AWB_DOCUMENTS.map((doc) => {
                const parties = [doc.notifyParty1, doc.notifyParty2].filter(
                  (x): x is string => !!x,
                );
                const sameAsConsignee = parties.some((p) => /same as consignee/i.test(p));
                const distinct = parties.filter((p) => !/same as consignee/i.test(p));
                return (
                  <div
                    key={doc.AWBNO}
                    className="px-5 py-4"
                    style={{ backgroundColor: distinct.length > 0 ? "#FFFBEB" : undefined }}
                  >
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="font-mono text-[12px] font-semibold text-[#0F172A]">
                        {doc.AWBNO}
                      </span>
                      {distinct.length > 0 ? (
                        <span className="h-[20px] px-2 rounded-full bg-[#FEE2E2] text-[#DC2626] text-[10px] font-bold inline-flex items-center">
                          {distinct.length} NOTIFY PARTY{distinct.length > 1 ? "S" : ""} — NOT NOTIFIED
                        </span>
                      ) : (
                        <span className="h-[20px] px-2 rounded-full bg-[#F1F5F9] text-[#64748B] text-[10px] font-bold inline-flex items-center">
                          {sameAsConsignee ? "SAME AS CONSIGNEE" : "NONE DECLARED"}
                        </span>
                      )}
                    </div>
                    {parties.length === 0 ? (
                      <p className="text-[12px] text-[#94A3B8]">
                        No notify party on this air waybill.
                      </p>
                    ) : (
                      <div className="flex flex-col gap-2">
                        {parties.map((pty, pi) => (
                          <div key={pi}>
                            <p className="text-[10px] font-mono text-[#CBD5E1]">
                              NOTIFY PARTY {pi + 1}
                            </p>
                            <p
                              className="text-[12px] mt-0.5"
                              style={{
                                color: /same as consignee/i.test(pty) ? "#64748B" : "#991B1B",
                              }}
                            >
                              {pty}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="px-5 py-3 bg-[#F8FAFC] border-t border-[#E2E8F0]">
              <p className="text-[11px] text-[#64748B]">
                Proposed FC-05 amendment: the NOA recipient set becomes{" "}
                <strong>consignee + CHA + every declared notify party</strong>. On 816-00034156
                that is Relizon Pharmaceuticals (the operating company) and Meezan Bank (the
                financing party) — two organisations that today receive nothing. Requires a
                notify-party field on the AWB, an AirVault addition since CMTS has none.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Preview modal ---------- */}
      {preview && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setPreview(null)}
        >
          <div
            className="w-full max-w-[560px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#E2E8F0] sticky top-0 bg-white">
              <h3 className="text-[15px] font-bold text-[#0F172A]">
                Preview — {preview.DisplayName}
              </h3>
              <button
                onClick={() => setPreview(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div>
                <p className="text-[10px] font-mono text-[#CBD5E1] uppercase">Channel</p>
                <p className="text-[13px] font-semibold text-[#0F172A] mt-0.5">
                  {CHANNEL_LABEL[preview.channel]} · v{preview.version} ·{" "}
                  {preview.IsActive ? "Active" : "Draft"}
                </p>
              </div>
              {preview.Subject && (
                <div>
                  <p className="text-[10px] font-mono text-[#CBD5E1] uppercase">Subject</p>
                  <p className="text-[13px] font-semibold text-[#0F172A] mt-0.5">
                    {fillVariables(preview.Subject)}
                  </p>
                </div>
              )}
              <div>
                <p className="text-[10px] font-mono text-[#CBD5E1] uppercase">Raw template</p>
                <pre className="mt-1 p-4 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] text-[12px] text-[#475569] whitespace-pre-wrap font-sans leading-relaxed">
                  {preview.Body || "— empty —"}
                </pre>
              </div>
              {/*
                Rendered against sample values — the point of a preview is to
                catch a variable that will not resolve, which a raw template
                view cannot show you.
              */}
              <div>
                <p className="text-[10px] font-mono text-[#CBD5E1] uppercase">
                  Rendered with sample data
                </p>
                <pre className="mt-1 p-4 bg-white rounded-xl border border-[#E2E8F0] text-[12px] text-[#0F172A] whitespace-pre-wrap font-sans leading-relaxed">
                  {fillVariables(preview.Body) || "— empty —"}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Edit modal ---------- */}
      {draft && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
          onClick={() => setDraft(null)}
        >
          <div
            className="w-full max-w-[640px] max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 h-[56px] border-b border-[#E2E8F0] sticky top-0 bg-white">
              <h3 className="text-[15px] font-bold text-[#0F172A]">Edit template</h3>
              <button
                onClick={() => setDraft(null)}
                className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#F8FAFC] text-[#64748B] cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                    Template name
                  </label>
                  <input
                    type="text"
                    value={draft.DisplayName}
                    onChange={(e) => setDraft({ ...draft, DisplayName: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A]"
                  />
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                    Notification type
                  </label>
                  <select
                    value={draft.notification}
                    onChange={(e) =>
                      setDraft({ ...draft, notification: e.target.value as CustomerNotification })
                    }
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white cursor-pointer"
                  >
                    {ALL_NOTIFICATIONS.map((n) => (
                      <option key={n} value={n}>
                        {CUSTOMER_NOTIFICATION_LABEL[n]}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                    Channel
                  </label>
                  <select
                    value={draft.channel}
                    onChange={(e) => setDraft({ ...draft, channel: e.target.value as Channel })}
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white cursor-pointer"
                  >
                    {ALL_CHANNELS.map((c) => (
                      <option key={c} value={c}>
                        {CHANNEL_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                    Status
                  </label>
                  <select
                    value={draft.IsActive ? "active" : "draft"}
                    onChange={(e) => setDraft({ ...draft, IsActive: e.target.value === "active" })}
                    className="w-full h-9 px-3 pr-8 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] bg-white cursor-pointer"
                  >
                    <option value="active">Active</option>
                    <option value="draft">Draft</option>
                  </select>
                </div>
              </div>

              {/* SMS has no subject line, so the field is not offered for it. */}
              {draft.channel !== "sms" && (
                <div>
                  <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                    Subject
                  </label>
                  <input
                    type="text"
                    value={draft.Subject ?? ""}
                    onChange={(e) => setDraft({ ...draft, Subject: e.target.value })}
                    className="w-full h-9 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A]"
                  />
                </div>
              )}

              <div>
                <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                  Message body
                </label>
                <textarea
                  value={draft.Body}
                  rows={7}
                  onChange={(e) => setDraft({ ...draft, Body: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] resize-y font-mono leading-relaxed"
                />
              </div>

              {/*
                Clicking a variable appends it to the body. The palette is the
                whole reason a template table beats free text: the author can
                only reference fields the engine will actually resolve.
              */}
              <div>
                <label className="block text-[12px] font-semibold text-[#0F172A] mb-1">
                  Available variables
                </label>
                <div className="flex flex-wrap gap-1">
                  {Object.keys(PREVIEW_VALUES).map((v) => (
                    <button
                      key={v}
                      onClick={() =>
                        setDraft({
                          ...draft,
                          Body: `${draft.Body}{{${v}}}`,
                          variables: draft.variables.includes(v)
                            ? draft.variables
                            : [...draft.variables, v],
                        })
                      }
                      className="h-6 px-2 rounded-full bg-[#EBF0F7] text-[#1B4F8B] text-[10px] font-mono inline-flex items-center hover:bg-[#DBEAFE] cursor-pointer transition-colors"
                    >
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-6 py-4 border-t border-[#E2E8F0] flex items-center justify-between gap-2 flex-wrap sticky bottom-0 bg-white">
              <p className="text-[11px] text-[#94A3B8]">
                Saving raises this template to v{draft.version + 1}.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setDraft(null)}
                  className="h-8 px-4 rounded-lg text-[12px] font-semibold text-[#64748B] border border-[#E2E8F0] hover:bg-[#F8FAFC] cursor-pointer whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  onClick={saveDraft}
                  className="h-8 px-4 rounded-lg text-[12px] font-semibold text-white cursor-pointer hover:opacity-90 whitespace-nowrap"
                  style={{ backgroundColor: "#0B2545" }}
                >
                  Save template
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href="/messaging/iata"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          IATA Cargo-IMP console <ArrowUpRight size={12} />
        </Link>
        <Link
          href="/messaging/customs"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          Carrier message troubleshooting <ArrowUpRight size={12} />
        </Link>
        <Link
          href="/import/arrival-advice"
          className="inline-flex items-center gap-1 text-[12px] font-semibold text-[#1B4F8B] no-underline hover:underline"
        >
          Arrival advice / NOA <ArrowUpRight size={12} />
        </Link>
      </div>
    </div>
  );
}
