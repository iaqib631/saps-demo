"use client";

/**
 * P3-6 · Case file — the action panel and the documents tab.
 *
 * The canonical screen previews the disposition field set and says so plainly:
 * it persists nothing and offers no verb. That is honest about the backend and
 * wrong about the screen — FC-10-C is a sequence of six things a compliance
 * officer *does*, and a register with no verbs cannot show any of them.
 *
 * Two of the six are wired rather than logged, because they change what the
 * rest of the screen says:
 *
 *   Record customs decision  → drives the `customsDecision` field, which is
 *                              what lets the case say "customs ruled, the
 *                              disposition is still outstanding".
 *   Record final disposition → drives the §C6 field-set preview the canonical
 *                              screen already renders.
 *
 * The other four append to a session log. There is no backend, so a log that
 * says what was pressed is the honest ceiling — quieter than a toast that
 * implies something was written, and it survives long enough to be read.
 *
 * The documents tab is derived, not authored: a notice that has been served
 * has a served copy, an escalated case has an escalation form, an auctioned or
 * disposed case has its lot sheet or certificate. Listing documents the case
 * cannot have produced would be worse than listing none.
 */

import { useState } from "react";
import {
  ArrowUpRight,
  Bell,
  CheckCircle,
  Eye,
  FileDown,
  FileText,
  Gavel,
  Paperclip,
} from "lucide-react";
import { DISPOSITION_LABEL, formatDate, type Disposition } from "@/lib/domain";
import {
  CUSTOMS_DECISIONS,
  CUSTOMS_DECISION_LABEL,
  type CustomsDecision,
  type LongStayCaseFile,
} from "./caseFile";

type Tab = "actions" | "documents";

interface CaseDocument {
  name: string;
  detail: string;
  tone: { bg: string; fg: string };
  Icon: typeof FileText;
}

/**
 * Every artefact this case has actually produced, in the order the flow
 * produces them.
 */
function documentsFor(c: LongStayCaseFile): CaseDocument[] {
  const docs: CaseDocument[] = [];

  c.notices.forEach((n, i) => {
    const isFinal = n.dueOffsetDays === 0;
    if (n.sentAt) {
      docs.push({
        name: `${n.noticeNo}.pdf`,
        detail: `${isFinal ? "Final notice" : `Notice ${i + 1}`} — served ${formatDate(n.sentAt)} to ${n.recipients.join(", ")}`,
        tone: isFinal ? { bg: "#FEE2E2", fg: "#DC2626" } : { bg: "#DBEAFE", fg: "#1B4F8B" },
        Icon: FileText,
      });
    } else {
      docs.push({
        name: `${n.noticeNo} — not generated`,
        detail: `${isFinal ? "Final notice" : `Notice ${i + 1}`} was due ${formatDate(n.dueAt)} · ${n.status}`,
        tone: { bg: "#FEF3C7", fg: "#D97706" },
        Icon: Paperclip,
      });
    }
  });

  if (c.escalatedToCustomsAt) {
    docs.push({
      name: `escalation-${c.caseNo}.pdf`,
      detail: `Escalation to customs — ${formatDate(c.escalatedToCustomsAt)}${c.DCNumber ? ` · DC ${c.DCNumber}` : ""}`,
      tone: { bg: "#F3E8FF", fg: "#7C3AED" },
      Icon: FileText,
    });
  }
  if (c.auctionLotNo) {
    docs.push({
      name: `auction-lot-${c.auctionLotNo}.pdf`,
      detail: `Auction lot sheet${c.auctionDate ? ` — ${formatDate(c.auctionDate)}` : ""}`,
      tone: { bg: "#FFEDD5", fg: "#C2410C" },
      Icon: FileText,
    });
  }
  if (c.disposalCertificateNo) {
    docs.push({
      name: `${c.disposalCertificateNo}.pdf`,
      detail: `Disposal certificate${c.disposalAuthorisedBy ? ` — authorised by ${c.disposalAuthorisedBy}` : ""}`,
      tone: { bg: "#FEE2E2", fg: "#DC2626" },
      Icon: FileText,
    });
  }

  return docs;
}

function ActionButton({
  Icon,
  iconBg,
  iconFg,
  title,
  detail,
  active,
  onClick,
}: {
  Icon: typeof Bell;
  iconBg: string;
  iconFg: string;
  title: string;
  detail: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 min-h-[52px] px-4 py-2.5 rounded-xl border text-left cursor-pointer transition-colors hover:bg-[#F8FAFC]"
      style={{ borderColor: active ? "#1B4F8B" : "#E2E8F0", backgroundColor: active ? "#EBF0F7" : "#FFFFFF" }}
    >
      <span
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ backgroundColor: iconBg }}
      >
        <Icon size={16} style={{ color: iconFg }} />
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-semibold text-[#0F172A]">{title}</span>
        <span className="block text-[11px] text-[#64748B] leading-snug">{detail}</span>
      </span>
    </button>
  );
}

export default function CaseFileCard({
  caseFile,
  customsDecision,
  onRecordDecision,
  disposition,
  onRecordDisposition,
  log,
  onAction,
}: {
  caseFile: LongStayCaseFile;
  customsDecision: CustomsDecision;
  onRecordDecision: (d: CustomsDecision) => void;
  disposition: Disposition | null;
  onRecordDisposition: (d: Disposition) => void;
  log: string[];
  onAction: (label: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("actions");
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [dispositionOpen, setDispositionOpen] = useState(false);

  const docs = documentsFor(caseFile);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white overflow-hidden">
      <div className="px-5 pt-4 border-b border-[#E2E8F0]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0F172A]">Case file</h3>
            <p className="text-[11px] text-[#94A3B8] mt-0.5">
              {caseFile.caseNo} · owned by the {caseFile.owner} queue
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1 mt-3">
          {(
            [
              ["actions", "Actions"],
              ["documents", `Documents (${docs.length})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setTab(key)}
              className="h-9 px-4 rounded-t-lg text-[13px] font-semibold cursor-pointer transition-colors whitespace-nowrap border-b-2"
              style={{
                color: tab === key ? "#0B2545" : "#64748B",
                borderBottomColor: tab === key ? "#0B2545" : "transparent",
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        {tab === "actions" ? (
          <div className="flex flex-col gap-2.5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              <ActionButton
                Icon={Bell}
                iconBg="#FEF3C7"
                iconFg="#D97706"
                title="Generate notice"
                detail="Draft the next scheduled statutory notice"
                onClick={() => onAction("Generate notice")}
              />
              <ActionButton
                Icon={CheckCircle}
                iconBg="#DCFCE7"
                iconFg="#16A34A"
                title="Mark notified"
                detail="Record service on consignee / CHA / airline"
                onClick={() => onAction("Mark notified")}
              />
              <ActionButton
                Icon={ArrowUpRight}
                iconBg="#DBEAFE"
                iconFg="#1B4F8B"
                title="Escalate to customs"
                detail="Hand the case to customs — §C4"
                onClick={() => onAction("Escalate to customs")}
              />
              <ActionButton
                Icon={Gavel}
                iconBg="#F3E8FF"
                iconFg="#7C3AED"
                title="Record customs decision"
                detail={`Currently ${CUSTOMS_DECISION_LABEL[customsDecision].toLowerCase()}`}
                active={decisionOpen}
                onClick={() => {
                  setDecisionOpen((v) => !v);
                  setDispositionOpen(false);
                }}
              />
              <ActionButton
                Icon={CheckCircle}
                iconBg="#DCFCE7"
                iconFg="#16A34A"
                title="Record final disposition"
                detail={
                  disposition ? DISPOSITION_LABEL[disposition] : "Release, auction or disposal — §C6"
                }
                active={dispositionOpen}
                onClick={() => {
                  setDispositionOpen((v) => !v);
                  setDecisionOpen(false);
                }}
              />
              <ActionButton
                Icon={FileDown}
                iconBg="#F1F5F9"
                iconFg="#64748B"
                title="Export case PDF"
                detail="Notice trail, escalation and disposition in one file"
                onClick={() => onAction("Export case PDF")}
              />
            </div>

            {decisionOpen && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">
                  What did customs decide?
                </p>
                <div className="flex flex-wrap gap-2">
                  {CUSTOMS_DECISIONS.map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onRecordDecision(d)}
                      className="h-8 px-3.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors border"
                      style={{
                        backgroundColor: customsDecision === d ? "#EBF0F7" : "#FFFFFF",
                        color: customsDecision === d ? "#0B2545" : "#64748B",
                        borderColor: customsDecision === d ? "#0B2545" : "#E2E8F0",
                      }}
                    >
                      {CUSTOMS_DECISION_LABEL[d]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-2.5">
                  A decision is not a disposition. Recording one here leaves the case awaiting §C6
                  until the outcome is actually recorded below.
                </p>
              </div>
            )}

            {dispositionOpen && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2.5">
                  Final disposition — §C6
                </p>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(DISPOSITION_LABEL) as Disposition[]).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => onRecordDisposition(d)}
                      className="h-8 px-3.5 rounded-lg text-[12px] font-semibold cursor-pointer transition-colors border"
                      style={{
                        backgroundColor: disposition === d ? "#EBF0F7" : "#FFFFFF",
                        color: disposition === d ? "#0B2545" : "#64748B",
                        borderColor: disposition === d ? "#0B2545" : "#E2E8F0",
                      }}
                    >
                      {DISPOSITION_LABEL[d]}
                    </button>
                  ))}
                </div>
                <p className="text-[11px] text-[#94A3B8] mt-2.5">
                  Selecting reveals the required field set on the §C6 card below.
                </p>
              </div>
            )}

            {log.length > 0 && (
              <div className="rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] p-4">
                <p className="text-[11px] font-semibold text-[#64748B] uppercase tracking-wider mb-2">
                  This session
                </p>
                <ol className="flex flex-col gap-1">
                  {log.map((entry, i) => (
                    <li key={`${entry}-${i}`} className="text-[12px] text-[#0F172A]">
                      <span className="font-mono text-[10px] text-[#94A3B8] mr-2">
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      {entry}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-[11px] text-[#D97706] pt-1">
              The demo has no backend. These verbs move the screen, not a record — which is the
              point of showing them: the canonical register had no way to express that any of them
              exist.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {docs.length === 0 ? (
              <p className="text-[12px] text-[#94A3B8]">
                No documents yet — this case has served no notice and has not been escalated.
              </p>
            ) : (
              docs.map((d) => (
                <div
                  key={d.name}
                  className="p-4 rounded-xl border border-[#E2E8F0] flex items-center gap-3"
                >
                  <span
                    className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: d.tone.bg }}
                  >
                    <d.Icon size={18} style={{ color: d.tone.fg }} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[#0F172A] break-words">{d.name}</p>
                    <p className="text-[11px] text-[#64748B]">{d.detail}</p>
                  </div>
                  <span className="w-8 h-8 flex items-center justify-center rounded-lg text-[#CBD5E1] flex-shrink-0">
                    <Eye size={14} />
                  </span>
                </div>
              ))
            )}
            <p className="text-[11px] text-[#94A3B8] pt-1">
              Derived from the case, not authored: a notice that has not been served has no served
              copy, and the row says so rather than showing a file that does not exist.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
