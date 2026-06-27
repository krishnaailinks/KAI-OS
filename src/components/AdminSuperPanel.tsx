"use client";

import React, { useState, useEffect } from "react";
import { Activity, Users, FolderKanban, CheckCircle, FileText, Download, Building, Link as LinkIcon, UserPlus, Key } from "lucide-react";
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

  const [provisionClient, setProvisionClient] = useState({ name: '', email: '', password: '' });
  const [provisioning, setProvisioning] = useState(false);
  const [provisionMsg, setProvisionMsg] = useState<{type: 'error' | 'success', text: string} | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteToken, setInviteToken] = useState('');

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
        {/* Client Provisioning */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Building className="w-5 h-5 text-indigo-500" /> Provision Client</h3>
          
          <div className="space-y-3 flex-1">
            <input 
              type="text" placeholder="Company Name" 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm"
              value={provisionClient.name} onChange={e => setProvisionClient({...provisionClient, name: e.target.value})} 
            />
            <input 
              type="email" placeholder="Contact Email" 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm"
              value={provisionClient.email} onChange={e => setProvisionClient({...provisionClient, email: e.target.value})} 
            />
            <input 
              type="password" placeholder="Temporary Password" 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm"
              value={provisionClient.password} onChange={e => setProvisionClient({...provisionClient, password: e.target.value})} 
            />
            {provisionMsg && (
              <div className={`p-2 text-xs rounded border ${provisionMsg.type === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-green-50 text-green-600 border-green-200'}`}>
                {provisionMsg.text}
              </div>
            )}
          </div>
          <button 
            onClick={async () => {
              setProvisioning(true); setProvisionMsg(null);
              try {
                const res = await apiFetch('/api/admin/clients/provision', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ companyName: provisionClient.name, contactEmail: provisionClient.email, password: provisionClient.password })
                });
                const data = await res.json();
                if (res.ok) {
                  setProvisionMsg({ type: 'success', text: `Success! Client ${provisionClient.name} provisioned.` });
                  setProvisionClient({ name: '', email: '', password: '' });
                } else setProvisionMsg({ type: 'error', text: data.error || 'Failed' });
              } catch(e) { setProvisionMsg({ type: 'error', text: 'Network error' }); }
              finally { setProvisioning(false); }
            }}
            disabled={provisioning || !provisionClient.name || !provisionClient.email || !provisionClient.password}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
          >
            <UserPlus className="w-4 h-4" /> {provisioning ? "Provisioning..." : "Provision Client Account"}
          </button>
        </div>

        {/* Generate Director Invite */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-xl shadow-sm flex flex-col">
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Key className="w-5 h-5 text-amber-500" /> Director Access Invite</h3>
          <p className="text-sm text-slate-500 mb-4">Generate a secure, single-use registration link for a new director.</p>
          <div className="space-y-3 flex-1">
            <input 
              type="email" placeholder="New Director's Email" 
              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded p-2 text-sm"
              value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} 
            />
            {inviteToken && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 text-amber-900 dark:text-amber-200 border border-amber-200 dark:border-amber-800/50 rounded break-all text-xs">
                <div className="font-bold mb-1 flex items-center gap-1"><LinkIcon className="w-3 h-3"/> Invite Code Generated:</div>
                <div className="select-all font-mono bg-white dark:bg-black/20 p-2 rounded">{inviteToken}</div>
                <div className="mt-2 text-[10px] uppercase opacity-70">Send this code securely. It expires in 7 days.</div>
              </div>
            )}
          </div>
          <button 
            onClick={async () => {
              setInviting(true); setInviteToken('');
              try {
                const res = await apiFetch('/api/admin/directors/invite', {
                  method: 'POST', headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ email: inviteEmail })
                });
                const data = await res.json();
                if (res.ok) {
                  setInviteToken(data.token);
                  setInviteEmail('');
                } else alert(`Invite generation failed: ${data.error}`);
              } catch(e) { alert('Network error'); }
              finally { setInviting(false); }
            }}
            disabled={inviting || !inviteEmail}
            className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold transition-all shadow-md disabled:opacity-50"
          >
            <Key className="w-4 h-4" /> {inviting ? "Generating..." : "Generate Access Code"}
          </button>
        </div>
      </div>
    </div>
  );
};
