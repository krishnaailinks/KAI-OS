"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Calendar, Loader2, AlertTriangle, CheckCircle, FileSpreadsheet } from "lucide-react";
import { apiFetch } from "@/lib/api";

export function AuditReportGenerator() {
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);
  const [logsCount, setLogsCount] = useState(0);
  const [totalLogs, setTotalLogs] = useState(0);
  const [truncated, setTruncated] = useState(false);
  const [note, setNote] = useState<string | undefined>();
  const [error, setError] = useState("");
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>({
    start: "",
    end: "",
  });

  const generateReport = async () => {
    setLoading(true);
    setError("");
    setReport(null);

    try {
      const res = await apiFetch("/api/audit/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          startDate: dateRange.start || undefined,
          endDate: dateRange.end || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to generate report" }));
        throw new Error(err.error || "Failed to generate report");
      }

      const data = await res.json();
      setReport(data.report);
      setLogsCount(data.logsCount);
      setTotalLogs(data.totalLogs);
      setTruncated(data.truncated);
      setNote(data.note);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Report generation failed");
    } finally {
      setLoading(false);
    }
  };

  const downloadReport = () => {
    if (!report) return;
    const blob = new Blob([report], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `KAI-OS-Audit-Report-${new Date().toISOString().split("T")[0]}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl flex items-center justify-center">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">AI Audit Report Generator</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">Generate professional CA-ready audit reports using AI</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">Start Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.start}
                onChange={e => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-2">End Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="date"
                value={dateRange.end}
                onChange={e => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="block w-full pl-10 pr-3 py-2.5 border border-slate-300 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
              />
            </div>
          </div>
        </div>

        <button
          onClick={generateReport}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 text-white font-bold rounded-xl transition-all shadow-lg shadow-emerald-600/20"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Generating Report...
            </>
          ) : (
            <>
              <FileText className="w-5 h-5" />
              Generate AI Audit Report
            </>
          )}
        </button>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-xl flex items-center gap-2 text-sm font-semibold"
        >
          <AlertTriangle className="w-5 h-5 shrink-0" />
          {error}
        </motion.div>
      )}

      {report && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              <span className="font-bold text-sm text-slate-800 dark:text-slate-200">
                Report Generated — {logsCount} events analyzed{totalLogs !== logsCount ? ` (${totalLogs} total found, ${logsCount} fed to AI)` : ""}
              </span>
            </div>
            <button
              onClick={downloadReport}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-xs font-bold text-slate-600 dark:text-slate-400 transition-all"
            >
              <Download className="w-4 h-4" />
              Download .md
            </button>
          </div>

          {truncated && note && (
            <div className="mx-6 mb-2 px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{note}</span>
            </div>
          )}

          <div className="p-6 max-h-[600px] overflow-y-auto">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              {report.split('\n').map((line, i) => {
                if (line.startsWith('# ')) return <h1 key={i} className="text-xl font-bold text-slate-900 dark:text-white mt-4 mb-2">{line.slice(2)}</h1>;
                if (line.startsWith('## ')) return <h2 key={i} className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-6 mb-2">{line.slice(3)}</h2>;
                if (line.startsWith('### ')) return <h3 key={i} className="text-base font-bold text-slate-700 dark:text-slate-300 mt-4 mb-1">{line.slice(4)}</h3>;
                if (line.startsWith('- **')) return <li key={i} className="text-sm text-slate-600 dark:text-slate-400 ml-4 list-disc">{line.slice(2)}</li>;
                if (line.startsWith('| ')) return <pre key={i} className="text-xs text-slate-600 dark:text-slate-400 font-mono whitespace-pre-wrap">{line}</pre>;
                if (line.trim() === '') return <div key={i} className="h-2" />;
                return <p key={i} className="text-sm text-slate-600 dark:text-slate-400">{line}</p>;
              })}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
