"use client";

import React, { useEffect, useState } from "react";
import { ShieldAlert, Server, Lock, Fingerprint, DollarSign, Users, Activity, RefreshCw } from "lucide-react";
import { SystemPermissions } from "../types/dashboard";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";

interface AuditLogsProps {
  permissions: SystemPermissions;
  role?: "director" | "employee";
}

interface AuditLog {
  id: string;
  timestamp: string;
  event_type: string;
  message: string;
  triggered_by: string;
  severity: string;
}

export const AuditLogs: React.FC<AuditLogsProps> = ({ permissions, role = "employee" }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      const res = await apiFetch('/api/audit');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
      }
    } catch (e) {
      console.error("Failed to fetch system logs", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!permissions.allowAudit || role !== "director") return;

    fetchLogs();

    // Subscribe to system audit log updates for live synchronization
    const channel = supabase
      .channel('realtime_audit_logs')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'system_audit_logs' },
        (payload) => {
          setLogs((prev) => [payload.new as AuditLog, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permissions.allowAudit, role]);

  if (!permissions.allowAudit || role !== "director") {
    return (
      <div className="h-[calc(100vh-140px)] flex items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
        <div className="text-center max-w-md p-8 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm">
          <div className="w-16 h-16 bg-slate-200 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-300 dark:border-slate-700">
            <Lock className="w-8 h-8 text-slate-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 dark:text-slate-200 mb-2">Audit Logs Restricted</h2>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {role !== "director" 
              ? "You do not have administrative clearance to view system audit trails." 
              : "Director Mode has restricted this data panel."}
          </p>
        </div>
      </div>
    );
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case 'auth': return Fingerprint;
      case 'task': return Activity;
      case 'finance': return DollarSign;
      case 'hrms': return Users;
      case 'security': return Lock;
      default: return Server;
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-140px)] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
      <div className="h-16 flex items-center px-6 bg-slate-50 dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 justify-between">
        <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 tracking-wide flex items-center gap-2 uppercase">
          <ShieldAlert className="w-5 h-5 text-blue-600 dark:text-blue-500" />
          Immutable Audit Trail
        </h2>
        <div className="flex items-center gap-4">
          <button 
            onClick={fetchLogs}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg text-slate-500 hover:text-slate-850 dark:text-slate-400 dark:hover:text-slate-100 transition-all"
            title="Refresh Logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 text-xs font-mono font-bold text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
            STATUS: <span className="text-blue-600 dark:text-blue-500 animate-pulse">LIVE CONNECTED</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-6 bg-white dark:bg-slate-900">
        {loading ? (
          <div className="text-slate-500 text-xs font-mono">Loading core audit logs...</div>
        ) : (
          <div className="w-full text-left border-collapse">
            <div className="grid grid-cols-12 gap-4 pb-3 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold tracking-wider text-slate-500 uppercase mb-4">
              <div className="col-span-3">Timestamp</div>
              <div className="col-span-2">System</div>
              <div className="col-span-5">Audit Log Message</div>
              <div className="col-span-2 text-right">Triggered By</div>
            </div>
            
            <div className="space-y-2">
              {logs.map((log) => {
                const Icon = getEventIcon(log.event_type);
                let severityColor = "text-slate-500 dark:text-slate-400";
                let bg = "bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800";
                if (log.severity === "medium") {
                  severityColor = "text-yellow-600 dark:text-yellow-400";
                  bg = "bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-100 dark:border-yellow-900/20";
                }
                if (log.severity === "high") {
                  severityColor = "text-orange-600 dark:text-orange-400";
                  bg = "bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50";
                }
                if (log.severity === "critical") {
                  severityColor = "text-red-600 dark:text-red-400";
                  bg = "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50";
                }

                return (
                  <div key={log.id} className={`grid grid-cols-12 gap-4 py-3.5 px-4 items-center rounded-xl text-xs font-mono transition-colors hover:shadow-sm ${bg}`}>
                    <div className="col-span-3 text-slate-550">{new Date(log.timestamp).toLocaleString()}</div>
                    <div className="col-span-2 font-bold text-slate-700 dark:text-slate-300 uppercase">{log.event_type}</div>
                    <div className="col-span-5 flex items-center gap-3 font-sans font-semibold text-slate-800 dark:text-slate-200">
                      <Icon className={`w-4 h-4 ${severityColor}`} />
                      {log.message}
                    </div>
                    <div className="col-span-2 text-right text-slate-500 truncate" title={log.triggered_by}>
                      {log.triggered_by}
                    </div>
                  </div>
                );
              })}
              {logs.length === 0 && (
                <div className="text-center py-8 text-slate-500 font-bold font-sans">
                  No system logs recorded yet.
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
