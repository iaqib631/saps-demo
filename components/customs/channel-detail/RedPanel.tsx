"use client";

import { useState } from "react";
import { useToast } from "@/components/ToastContext";
import { Calendar, Clock, MapPin, User, Beaker, Camera, CheckCircle, ArrowRight, FileText } from "lucide-react";

interface RedPanelProps {
  awb: string;
}

export default function RedPanel({ awb }: RedPanelProps) {
  const { addToast } = useToast();
  const [examRequired, setExamRequired] = useState(true);
  const [examDate, setExamDate] = useState("01 Jun 2026");
  const [examTime, setExamTime] = useState("10:00 AM");
  const [examLocation, setExamLocation] = useState("Customs Exam Bay A");
  const [customsOfficer, setCustomsOfficer] = useState("Inspector Tariq Ahmed");
  const [sampleRequired, setSampleRequired] = useState(true);
  const [sampleType, setSampleType] = useState("Chemical / Lab test");
  const [sampleTime, setSampleTime] = useState("01 Jun 2026 11:30");
  const [examRemarks, setExamRemarks] = useState("");
  const [examResult, setExamResult] = useState("pending");
  const [photosUploaded, setPhotosUploaded] = useState(false);

  return (
    <div className="rounded-[16px] border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#E2E8F0]">
        <div className="flex items-center gap-2.5">
          <h2 className="text-[15px] font-bold text-[#0F172A]">Red Channel Panel</h2>
        </div>
        <span
          className="inline-flex items-center h-7 px-3 rounded-lg text-[12px] font-semibold"
          style={{
            backgroundColor: examResult === "cleared" ? "#DCFCE7" : examResult === "rejected" ? "#FEE2E2" : "#FEF3C7",
            color: examResult === "cleared" ? "#16A34A" : examResult === "rejected" ? "#DC2626" : "#D97706",
          }}
        >
          {examResult === "pending" ? "Exam Pending" : examResult === "cleared" ? "Exam Cleared" : "Exam Rejected"}
        </span>
      </div>

      <div className="p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={examRequired}
                onChange={() => setExamRequired(!examRequired)}
                className="w-4 h-4 cursor-pointer accent-[#DC2626]"
              />
              <span className="text-[13px] font-semibold text-[#0F172A]">Exam Required</span>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC]">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sampleRequired}
                onChange={() => setSampleRequired(!sampleRequired)}
                className="w-4 h-4 cursor-pointer accent-[#DC2626]"
              />
              <span className="text-[13px] font-semibold text-[#0F172A]">Sample Required</span>
            </div>
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <Calendar size={14} className="text-[#DC2626]" />
              Exam Scheduled Date
            </label>
            <input
              type="text"
              value={examDate}
              onChange={(e) => setExamDate(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <Clock size={14} className="text-[#DC2626]" />
              Exam Scheduled Time
            </label>
            <input
              type="text"
              value={examTime}
              onChange={(e) => setExamTime(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <MapPin size={14} className="text-[#DC2626]" />
              Exam Location
            </label>
            <input
              type="text"
              value={examLocation}
              onChange={(e) => setExamLocation(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <User size={14} className="text-[#DC2626]" />
              Customs Officer
            </label>
            <input
              type="text"
              value={customsOfficer}
              onChange={(e) => setCustomsOfficer(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
            />
          </div>

          {sampleRequired && (
            <>
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
                  <Beaker size={14} className="text-[#DC2626]" />
                  Sample Type
                </label>
                <input
                  type="text"
                  value={sampleType}
                  onChange={(e) => setSampleType(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
                  <Clock size={14} className="text-[#DC2626]" />
                  Sample Collection Time
                </label>
                <input
                  type="text"
                  value={sampleTime}
                  onChange={(e) => setSampleTime(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors"
                />
              </div>
            </>
          )}

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <FileText size={14} className="text-[#DC2626]" />
              Physical Exam Remarks
            </label>
            <textarea
              value={examRemarks}
              onChange={(e) => setExamRemarks(e.target.value)}
              placeholder="Enter physical examination remarks"
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-[#E2E8F0] text-[13px] text-[#0F172A] outline-none focus:border-[#DC2626] transition-colors resize-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <CheckCircle size={14} className="text-[#DC2626]" />
              Exam Result
            </label>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setExamResult("pending")}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold border cursor-pointer transition-colors"
                style={{
                  borderColor: examResult === "pending" ? "#D97706" : "#E2E8F0",
                  color: examResult === "pending" ? "#D97706" : "#64748B",
                  backgroundColor: examResult === "pending" ? "#FEF3C7" : "white",
                }}
              >
                <span className="w-2 h-2 rounded-full bg-[#D97706]" />
                Pending
              </button>
              <button
                onClick={() => setExamResult("cleared")}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold border cursor-pointer transition-colors"
                style={{
                  borderColor: examResult === "cleared" ? "#16A34A" : "#E2E8F0",
                  color: examResult === "cleared" ? "#16A34A" : "#64748B",
                  backgroundColor: examResult === "cleared" ? "#DCFCE7" : "white",
                }}
              >
                <span className="w-2 h-2 rounded-full bg-[#16A34A]" />
                Cleared
              </button>
              <button
                onClick={() => setExamResult("rejected")}
                className="flex items-center gap-2 h-9 px-4 rounded-lg text-[13px] font-semibold border cursor-pointer transition-colors"
                style={{
                  borderColor: examResult === "rejected" ? "#DC2626" : "#E2E8F0",
                  color: examResult === "rejected" ? "#DC2626" : "#64748B",
                  backgroundColor: examResult === "rejected" ? "#FEE2E2" : "white",
                }}
              >
                <span className="w-2 h-2 rounded-full bg-[#DC2626]" />
                Rejected
              </button>
            </div>
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-2 text-[12px] font-semibold text-[#64748B] mb-1.5">
              <Camera size={14} className="text-[#DC2626]" />
              Supporting Photos / Evidence
            </label>
            <button
              onClick={() => {
                setPhotosUploaded(!photosUploaded);
                addToast(photosUploaded ? "Photos removed" : "Photos uploaded", "success");
              }}
              className="flex items-center gap-2 h-10 px-4 rounded-lg border border-dashed border-[#CBD5E1] text-[13px] text-[#64748B] cursor-pointer hover:border-[#DC2626] hover:text-[#DC2626] transition-colors"
            >
              <Camera size={16} />
              {photosUploaded ? "3 photos uploaded" : "Upload photos / evidence"}
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-4 border-t border-[#E2E8F0]">
          <button
            onClick={() => addToast("Exam scheduled", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold text-white cursor-pointer transition-colors hover:opacity-90"
            style={{ backgroundColor: "#DC2626" }}
          >
            <Calendar size={14} />
            Schedule Exam
          </button>
          <button
            onClick={() => {
              setExamResult("cleared");
              addToast("Exam marked completed", "success");
            }}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border cursor-pointer transition-colors hover:bg-[#F8FAFC]"
            style={{ borderColor: "#DC2626", color: "#DC2626" }}
          >
            <CheckCircle size={14} />
            Mark Exam Completed
          </button>
          <button
            onClick={() => addToast("Remarks recorded", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <FileText size={14} />
            Record Remarks
          </button>
          <button
            onClick={() => addToast("Moved to OOC capture", "success")}
            className="flex items-center gap-2 h-9 px-4 rounded-xl text-[13px] font-semibold border border-[#E2E8F0] text-[#64748B] cursor-pointer transition-colors hover:bg-[#F8FAFC]"
          >
            <ArrowRight size={14} />
            Move to OOC Capture
          </button>
        </div>
      </div>
    </div>
  );
}