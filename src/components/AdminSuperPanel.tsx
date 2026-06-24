"use client";

import React, { useState, useEffect } from "react";
import { Activity, Users, FolderKanban, CheckCircle, FileText, Download } from "lucide-react";
import { apiFetch } from "@/lib/api";

interface AdminSuperPanelProps {
  role: "director" | "employee";
}

interface LiveStats {
  totalEmployees: number;
  activeProjects: number;
  tasksCompletedToday: number;
  openInvoices: number;
  totalPayroll: number;
  serverStatus: string;
  securityIncidents: number;
}

export const AdminSuperPanel: React.FC<AdminSuperPanelProps> = ({ role }) => {
  const [stats, setStats] = useState<LiveStats | null>(null);
  const [executingPayroll, setExecutingPayroll] = useState(false);
  const [payrollSuccess, setPayrollSuccess] = useState(false);

  useEffect(() => {
    if (role !== "director") return;
    const fetchStats = async () => {
      try {
        const res = await apiFetch("/api/admin/live-stats");
        if (res.ok) {
          const data = await res.json();
          setStats(data.stats);
        }
      } catch (err) {
        console.error("Failed to fetch live stats", err);
      }
    };
    fetchStats();
    const interval = setInterval(fetchStats, 5000);
    return () => clearInterval(interval);
  }, [role]);

  if (role !== "director") {
    return (
      <div className="flex items-center justify-center h-full text-red-500 font-bold">
        ACCESS DENIED. DIRECTOR CLEARANCE REQUIRED.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Admin Super Panel</h2>
          <p className="text-sm text-slate-500 mt-1">Live Global Company Analysis & Control</p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-xs font-bold uppercase tracking-wider">
          <Activity className="w-3.5 h-3.5" /> Live Sync Active
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {/* Stat Cards */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-slate-500 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Total Personnel</span>
          </div>
          <div className="text-3xl font-bold">{stats?.totalEmployees || 0}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-blue-500 mb-2">
            <FolderKanban className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Active Projects</span>
          </div>
          <div className="text-3xl font-bold">{stats?.activeProjects || 0}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-emerald-500 mb-2">
            <CheckCircle className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Tasks Completed Today</span>
          </div>
          <div className="text-3xl font-bold">{stats?.tasksCompletedToday || 0}</div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
          <div className="flex items-center gap-2 text-red-500 mb-2">
            <FileText className="w-4 h-4" />
            <span className="text-xs font-bold uppercase">Open Invoices</span>
          </div>
          <div className="text-3xl font-bold">${stats?.openInvoices?.toLocaleString() || 0}</div>
        </div>
      </div>
      
      {/* Payroll Quick Actions */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm flex-1">
        <h3 className="text-lg font-bold mb-4">Payroll Overview (Live)</h3>
        <p className="text-slate-500 mb-6 text-sm">Total company payroll outstanding for current cycle: <strong className="text-slate-900 dark:text-white">${stats?.totalPayroll?.toLocaleString() || 0}</strong></p>
        
        {payrollSuccess && (
           <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-lg text-sm font-bold flex items-center gap-2">
             <CheckCircle className="w-4 h-4" />
             Payroll cycle executed successfully! Receipt downloaded.
           </div>
        )}

        <button 
          onClick={async () => {
            const totalAmount = stats?.totalPayroll || 0;
            if (!window.confirm(`Execute payroll for all pending records?\n\nTotal to disburse: $${totalAmount.toLocaleString()}\n\nThis action cannot be undone.`)) {
              return;
            }
            setExecutingPayroll(true);
            try {
              const res = await apiFetch("/api/payroll", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  confirm: true,
                  maxTotal: totalAmount * 1.1,
                }),
              });
              if (res.ok) {
                const data = await res.json();
                const blob = new Blob([data.receipt_content || "# Payroll Executed Successfully\n\nTotal disbursed: $" + totalAmount], { type: "text/markdown" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `Payroll_Receipt_${new Date().toISOString().split('T')[0]}.md`;
                a.click();
                URL.revokeObjectURL(url);
                setPayrollSuccess(true);
                setTimeout(() => setPayrollSuccess(false), 5000);
              } else {
                const errData = await res.json();
                alert(`Payroll execution failed: ${errData.error || 'Unknown error'}`);
              }
            } catch(e) {
              console.error(e);
              alert("Payroll execution failed. Check console for details.");
            } finally {
              setExecutingPayroll(false);
            }
          }}
          disabled={executingPayroll}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
        >
          <Download className="w-4 h-4" /> 
          {executingPayroll ? "Executing..." : "Execute Payroll Cycle"}
        </button>
      </div>
    </div>
  );
};
