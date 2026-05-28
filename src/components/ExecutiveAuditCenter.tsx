"use client";

import React, { useState } from "react";
import { ShieldCheck, Calendar, FileText, ArrowRight, Download, BarChart3, Users, DollarSign, Activity } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface ExecutiveAuditCenterProps {
  role: "director" | "employee";
}

interface AuditTask {
  id: string;
  title: string;
  status?: string;
  priority?: string;
  budget?: number | string | null;
}

interface AuditInvoice {
  id: string;
  invoice_number: string;
  amount: number | string;
  status?: string;
}

interface AuditAttendance {
  id: string;
  user_id: string;
  date: string;
  check_in?: string | null;
  check_out?: string | null;
}

interface AuditReport {
  id: string;
  user_id: string;
  date: string;
  report_text: string;
}

interface AuditProfile {
  id: string;
  user_id: string;
  full_name?: string | null;
  job_title?: string | null;
}

interface AuditLog {
  id: string;
  timestamp: string;
  event_type?: string;
  severity?: string;
  message: string;
}

const todayISODate = new Date().toISOString().split('T')[0];
const defaultStartISODate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

export const ExecutiveAuditCenter: React.FC<ExecutiveAuditCenterProps> = ({ role }) => {
  const [startDate, setStartDate] = useState(defaultStartISODate);
  const [endDate, setEndDate] = useState(todayISODate);
  
  const [loading, setLoading] = useState(false);
  const [compiled, setCompiled] = useState(false);

  // Data states
  const [tasks, setTasks] = useState<AuditTask[]>([]);
  const [invoices, setInvoices] = useState<AuditInvoice[]>([]);
  const [attendance, setAttendance] = useState<AuditAttendance[]>([]);
  const [reports, setReports] = useState<AuditReport[]>([]);
  const [profiles, setProfiles] = useState<AuditProfile[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Aggregated Metrics
  const [metrics, setMetrics] = useState({
    totalTasks: 0,
    completedTasks: 0,
    totalBudgetAllocated: 0,
    totalInvoicesAmount: 0,
    paidInvoicesAmount: 0,
    outstandingInvoicesAmount: 0,
    totalCheckIns: 0,
    totalReportsSubmitted: 0,
    securityEvents: 0
  });

  const compileAuditData = async () => {
    if (role !== "director") return;
    setLoading(true);
    setCompiled(false);

    try {
      // 1. Fetch Tasks
      const tRes = await apiFetch('/api/tasks');
      const tData = tRes.ok ? await tRes.json() : { tasks: {} };
      const tasksList = Object.values(tData.tasks || {}) as AuditTask[];

      // 2. Fetch Invoices
      const iRes = await apiFetch('/api/invoices');
      const iData = iRes.ok ? await iRes.json() : { invoices: [] };
      const invoicesList = (iData.invoices || []) as AuditInvoice[];

      // 3. Fetch Profiles
      const pRes = await apiFetch('/api/profiles');
      const pData = pRes.ok ? await pRes.json() : { profiles: [] };
      const profilesList = (pData.profiles || []) as AuditProfile[];

      // 4. Fetch Attendance (filtered by date range)
      const aRes = await apiFetch(`/api/attendance?all=true&startDate=${startDate}&endDate=${endDate}`);
      const aData = aRes.ok ? await aRes.json() : { attendance: [] };
      const attendanceList = (aData.attendance || []) as AuditAttendance[];

      // 5. Fetch Daily Reports (filtered by date range)
      const rRes = await apiFetch(`/api/daily-reports?all=true&startDate=${startDate}&endDate=${endDate}`);
      const rData = rRes.ok ? await rRes.json() : { reports: [] };
      const reportsList = (rData.reports || []) as AuditReport[];

      // 6. Fetch Audit Logs
      const lRes = await apiFetch('/api/audit');
      const lData = lRes.ok ? await lRes.json() : { logs: [] };
      const logsList = (lData.logs || []) as AuditLog[];

      // Save list states
      setTasks(tasksList);
      setInvoices(invoicesList);
      setProfiles(profilesList);
      setAttendance(attendanceList);
      setReports(reportsList);
      setAuditLogs(logsList);

      // Calculate Metrics within date ranges
      const completed = tasksList.filter((t) => t.status === "completed" || t.status === "approved");
      const totalBudget = tasksList.reduce((acc, curr) => acc + Number(curr.budget || 0), 0);
      
      const totalInvoices = invoicesList.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const paidInvoices = invoicesList.filter((i) => i.status === 'paid').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
      const outstandingInvoices = totalInvoices - paidInvoices;

      const securityCount = logsList.filter((l) => l.severity === 'high' || l.severity === 'critical').length;

      setMetrics({
        totalTasks: tasksList.length,
        completedTasks: completed.length,
        totalBudgetAllocated: totalBudget,
        totalInvoicesAmount: totalInvoices,
        paidInvoicesAmount: paidInvoices,
        outstandingInvoicesAmount: outstandingInvoices,
        totalCheckIns: attendanceList.length,
        totalReportsSubmitted: reportsList.length,
        securityEvents: securityCount
      });

      setCompiled(true);
    } catch (e) {
      console.error("Compilation error", e);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadReport = () => {
    if (!compiled) return;

    const reportContent = `# KAI-OS EXECUTIVE AUDIT REPORT
Generated on: ${new Date().toLocaleString()}
Audit Range: ${startDate} to ${endDate}
Krishna AI Links Pvt. Ltd. Confidential

============================================================
1. EXECUTIVE SUMMARY
============================================================
The core subsystems of Krishna AI Links Pvt. Ltd. have been audited for the period from ${startDate} to ${endDate}. Below is an aggregated operational matrix representing PMS, FMS, HRMS, and IT Infrastructure.

* Core Status: SYSTEM STABLE
* Operational Efficiency: ${metrics.totalTasks > 0 ? ((metrics.completedTasks / metrics.totalTasks) * 100).toFixed(1) : 0}%
* Total Budget Allocated: $${metrics.totalBudgetAllocated.toLocaleString()}
* Total Invoice Receivables: $${metrics.totalInvoicesAmount.toLocaleString()}
* Outstanding Balances: $${metrics.outstandingInvoicesAmount.toLocaleString()}
* Total Employee Clock-ins: ${metrics.totalCheckIns}
* Total Daily Reports Submitted: ${metrics.totalReportsSubmitted}
* High-Priority Security Events: ${metrics.securityEvents}

============================================================
2. PROJECT MANAGEMENT PILLAR (PMS)
============================================================
Total Tasks Managed: ${metrics.totalTasks}
- Completed: ${metrics.completedTasks}
- Backlog/In-Progress: ${metrics.totalTasks - metrics.completedTasks}
- Completion Rate: ${metrics.totalTasks > 0 ? ((metrics.completedTasks / metrics.totalTasks) * 100).toFixed(1) : 0}%

--- Active / Managed Tasks Detail ---
${tasks.map(t => `- [${t.status?.toUpperCase() || 'UNKNOWN'}] ${t.title} (Priority: ${t.priority}, Budget: $${Number(t.budget || 0).toLocaleString()})`).join('\n')}

============================================================
3. FINANCIAL MANAGEMENT PILLAR (FMS)
============================================================
Total Revenue Value Generated: $${metrics.totalInvoicesAmount.toLocaleString()}
- Collected Revenue: $${metrics.paidInvoicesAmount.toLocaleString()}
- Outstanding Receivables: $${metrics.outstandingInvoicesAmount.toLocaleString()}

--- Invoice Registry Details ---
${invoices.map(i => `- INV #${i.invoice_number} (Amount: $${Number(i.amount).toLocaleString()}, Status: ${i.status?.toUpperCase() || 'UNKNOWN'})`).join('\n')}

============================================================
4. HR & TIMESHEETS PILLAR (HRMS)
============================================================
Total Active Remote Employees: ${profiles.length}
Total Checked-In Days (Total Volume): ${metrics.totalCheckIns}
Total Work Logs Captured: ${metrics.totalReportsSubmitted}

--- Historical Attendance Registry ---
${attendance.map(a => {
  const prof = profiles.find(p => p.user_id === a.user_id);
  const name = prof?.full_name || "Unregistered User";
  return `- ${a.date}: ${name} | Clocked In: ${a.check_in ? new Date(a.check_in).toLocaleTimeString() : "-"} | Clocked Out: ${a.check_out ? new Date(a.check_out).toLocaleTimeString() : "-"}`;
}).join('\n')}

============================================================
5. EMPLOYEE DAILY WORK REPORT TRANSCRIPTS
============================================================
Below is the full, unredacted text of all Remote Work Reports submitted by employees during this audit period for complete management transparency:

${reports.map(r => {
  const prof = profiles.find(p => p.user_id === r.user_id);
  const name = prof?.full_name || "Unregistered Employee";
  return `------------------------------------------------------------
Date: ${r.date} | Personnel: ${name} (${prof?.job_title || "Operative"})
------------------------------------------------------------
${r.report_text}
`;
}).join('\n')}

============================================================
6. IT SECURITY & IMMUTABLE SYSTEM AUDIT TRAIL
============================================================
High/Critical Severity Security Logs recorded during this range:

${auditLogs.map(l => `[${new Date(l.timestamp).toLocaleString()}] [${l.event_type?.toUpperCase() || 'EVENT'}] [${l.severity?.toUpperCase() || 'INFO'}] ${l.message}`).join('\n')}

============================================================
END OF REPORT
============================================================
`;

    // Download Logic
    const blob = new Blob([reportContent], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `KAI_OS_Audit_Report_${startDate}_to_${endDate}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  if (role !== "director") {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="text-center max-w-md p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Audit Restrictions In Place</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Only designated Directors/Administrators can initiate global company audits.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50 dark:bg-slate-950/50 p-6 overflow-y-auto">
      <div className="flex items-center justify-between mb-8 border-b border-slate-200 dark:border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 dark:text-slate-100 flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-emerald-500" />
            Krishna OS Executive Audit Center
          </h1>
          <p className="text-xs text-slate-500 font-mono mt-1">REAL-TIME DATA AUDITING & PERFORMANCE EXPORTER</p>
        </div>
      </div>

      {/* Date Selectors Card */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm mb-8">
        <div className="flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2 mb-1">
              <Calendar className="w-5 h-5 text-indigo-500" /> Specify Audit Interval
            </h3>
            <p className="text-xs text-slate-500">Choose start and end dates to compile all operational metrics.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold w-full sm:w-auto"
            />
            <ArrowRight className="w-4 h-4 text-slate-400 hidden sm:block" />
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 px-3 py-2 rounded-xl text-xs font-bold w-full sm:w-auto"
            />
            <button
              onClick={compileAuditData}
              disabled={loading}
              className="w-full sm:w-auto px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold disabled:opacity-50 transition-all shadow-lg shadow-indigo-600/20"
            >
              {loading ? "Compiling Dossier..." : "Compile Company Audit"}
            </button>
          </div>
        </div>
      </div>

      {/* Compiled Results */}
      {compiled ? (
        <div className="space-y-8 animate-fadeIn">
          
          {/* Main Download CTA */}
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 rounded-2xl text-white shadow-xl shadow-emerald-500/20 flex flex-col md:flex-row items-center justify-between gap-4">
            <div>
              <h4 className="text-lg font-bold">Operational Dossier Compiled successfully!</h4>
              <p className="text-xs text-emerald-100 mt-1">Every task, invoice, check-in, and employee daily report has been mapped between {startDate} and {endDate}.</p>
            </div>
            <button
              onClick={handleDownloadReport}
              className="px-6 py-3 bg-white hover:bg-emerald-50 text-emerald-700 rounded-xl font-bold flex items-center gap-2 shadow-md transition-all text-sm w-full md:w-auto justify-center"
            >
              <Download className="w-4 h-4" /> Download Executive Audit (.md)
            </button>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* PMS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project Subsystem</span>
                <BarChart3 className="w-5 h-5 text-blue-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.completedTasks}/{metrics.totalTasks}</h3>
              <p className="text-xs text-slate-500 mt-1">Tasks Completed</p>
              <div className="text-[10px] font-bold text-blue-500 mt-3 font-mono">
                Allocated: ${metrics.totalBudgetAllocated.toLocaleString()}
              </div>
            </div>

            {/* FMS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Financial Subsystem</span>
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">${metrics.paidInvoicesAmount.toLocaleString()}</h3>
              <p className="text-xs text-slate-500 mt-1">Total Revenue Collected</p>
              <div className="text-[10px] font-bold text-rose-500 mt-3 font-mono">
                Outstanding: ${metrics.outstandingInvoicesAmount.toLocaleString()}
              </div>
            </div>

            {/* HRMS */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HR Subsystem</span>
                <Users className="w-5 h-5 text-indigo-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.totalCheckIns}</h3>
              <p className="text-xs text-slate-500 mt-1">Clock-Ins (Logs volume)</p>
              <div className="text-[10px] font-bold text-indigo-500 mt-3 font-mono">
                Reports Logged: {metrics.totalReportsSubmitted}
              </div>
            </div>

            {/* Security */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Security & IT</span>
                <ShieldCheck className="w-5 h-5 text-purple-500" />
              </div>
              <h3 className="text-3xl font-black text-slate-800 dark:text-slate-100">{metrics.securityEvents}</h3>
              <p className="text-xs text-slate-500 mt-1">Critical Events</p>
              <div className="text-[10px] font-bold text-purple-500 mt-3 font-mono">
                Connection: stable
              </div>
            </div>

          </div>

          {/* Employee Daily Reports Quick View (Accordion list) */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-800 dark:text-slate-100 mb-4 flex items-center gap-2">
              <FileText className="w-5 h-5 text-indigo-500" /> Consolidated Remote Work Reports ({reports.length})
            </h3>
            <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2">
              {reports.map((r) => {
                const prof = profiles.find((p) => p.user_id === r.user_id);
                return (
                  <div key={r.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                        {prof?.full_name || "Unregistered Employee"} ({prof?.job_title || "Operative"})
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">{r.date}</span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono whitespace-pre-line leading-relaxed">
                      {r.report_text}
                    </p>
                  </div>
                );
              })}
              {reports.length === 0 && (
                <div className="text-center py-6 text-slate-500 font-bold">No daily work reports submitted during this range.</div>
              )}
            </div>
          </div>

        </div>
      ) : (
        <div className="h-64 border-2 border-dashed border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center p-6 text-center">
          <Activity className="w-10 h-10 text-slate-400 mb-3 animate-pulse" />
          <h4 className="font-bold text-slate-700 dark:text-slate-300">Ready to audit Krishna AI Links Subsystems</h4>
          <p className="text-xs text-slate-500 max-w-sm mt-1 leading-relaxed">Specify a date interval above to fetch and compile operational metrics across all 4 core pillars.</p>
        </div>
      )}
    </div>
  );
};
