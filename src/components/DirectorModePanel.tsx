"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Video, Database, X, ShieldCheck, Users, CheckCircle, Clock, Check, BarChart3 } from "lucide-react";
import { SystemPermissions, DashboardState, Task } from "../types/dashboard";
import { AnalyticsDashboard } from "./AnalyticsDashboard";
import { apiFetch } from "@/lib/api";

interface DirectorModePanelProps {
  isOpen: boolean;
  onClose: () => void;
  permissions: SystemPermissions;
  onUpdatePermissions: (newPermissions: Partial<SystemPermissions>) => void;
  boardState: DashboardState;
  handleUpdateTask: (task: Task, action: "approve" | "reject") => void;
}

type PanelTab = "SYSTEM" | "PERSONNEL" | "APPROVALS" | "ANALYTICS";

interface PersonnelPermissionsRecord {
  allow_video?: boolean;
  allow_audit?: boolean;
  system_lockout?: boolean;
}

interface PersonnelRecord {
  id: string;
  full_name: string | null;
  email: string;
  role: "director" | "employee";
  status?: string | null;
  personnel_permissions?: PersonnelPermissionsRecord | PersonnelPermissionsRecord[] | null;
}

const getPermissionsRecord = (
  permissions?: PersonnelPermissionsRecord | PersonnelPermissionsRecord[] | null,
): PersonnelPermissionsRecord => {
  if (Array.isArray(permissions)) return permissions[0] || {};
  return permissions || {};
};

export const DirectorModePanel: React.FC<DirectorModePanelProps> = ({
  isOpen,
  onClose,
  permissions,
  onUpdatePermissions,
  boardState,
  handleUpdateTask
}) => {
  const [activeTab, setActiveTab] = useState<PanelTab>("SYSTEM");
  const [personnel, setPersonnel] = useState<PersonnelRecord[]>([]);
  const [loading, setLoading] = useState(false);
  
  // The person currently being edited in the Personnel tab
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [tempPermissions, setTempPermissions] = useState<PersonnelPermissionsRecord | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLoading(true);
      apiFetch('/api/permissions')
        .then(res => res.json())
        .then(data => {
          if (data.profiles) setPersonnel(data.profiles);
        })
        .finally(() => setLoading(false));
    }
  }, [isOpen]);

  const handleUpdatePersonnel = async (userId: string) => {
    try {
      await apiFetch(`/api/permissions/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tempPermissions)
      });
      // Update local state
      setPersonnel(prev => prev.map(p => p.id === userId ? { 
        ...p, 
        personnel_permissions: { ...getPermissionsRecord(p.personnel_permissions), ...tempPermissions } 
      } : p));
      setEditingPersonId(null);
    } catch (e) {
      console.error("Failed to update permissions", e);
    }
  };

  const pendingApprovals = Object.values(boardState.tasks).filter(t => t.status === "pending_review");

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed top-0 right-0 h-full w-full max-w-xl bg-slate-50 dark:bg-slate-950 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-50 flex flex-col"
          >
            {/* Header */}
            <div className="shrink-0 h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shadow-lg shadow-blue-600/20">
                  <ShieldCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-800 dark:text-slate-100 tracking-wider">DIRECTOR COMMAND CENTER</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Global Override Active</p>
                </div>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Tabs */}
            <div className="shrink-0 flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 overflow-x-auto">
              <button
                onClick={() => setActiveTab("SYSTEM")}
                className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeTab === "SYSTEM" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                <Database className="w-4 h-4" /> System Core
              </button>
              <button
                onClick={() => setActiveTab("PERSONNEL")}
                className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeTab === "PERSONNEL" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                <Users className="w-4 h-4" /> Personnel
              </button>
              <button
                onClick={() => setActiveTab("APPROVALS")}
                className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeTab === "APPROVALS" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                <CheckCircle className="w-4 h-4" /> Approvals
              </button>
              <button
                onClick={() => setActiveTab("ANALYTICS")}
                className={`px-4 py-3 text-xs font-bold tracking-wider uppercase border-b-2 transition-colors flex items-center gap-2 ${activeTab === "ANALYTICS" ? "border-blue-600 text-blue-600 dark:text-blue-400" : "border-transparent text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"}`}
              >
                <BarChart3 className="w-4 h-4" /> Analytics
              </button>
            </div>

            <div className="flex-1 p-6 overflow-y-auto">
              
              {activeTab === "ANALYTICS" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <AnalyticsDashboard tasks={boardState.tasks} />
                </motion.div>
              )}

              {activeTab === "SYSTEM" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-relaxed p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 rounded-lg">
                    Adjusting these parameters forces global UI state updates for all connected agents and personnel.
                  </p>

                  <div className="space-y-4">
                    {/* Toggle 1: Video */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Video className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Live Meeting Module</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={permissions.allowVideo}
                            onChange={(e) => onUpdatePermissions({ allowVideo: e.target.checked })}
                          />
                          <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">Toggles access to the global Live Meeting Space.</p>
                    </div>

                    {/* Toggle 2: Audit Logs */}
                    <div className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Database className="w-4 h-4 text-slate-500" />
                          <span className="text-sm font-bold text-slate-800 dark:text-slate-200">Audit Trace Access</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={permissions.allowAudit}
                            onChange={(e) => onUpdatePermissions({ allowAudit: e.target.checked })}
                          />
                          <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600 dark:peer-checked:bg-blue-500"></div>
                        </label>
                      </div>
                      <p className="text-[10px] font-medium text-slate-500">Grants visibility to the Immutable Audit panel.</p>
                    </div>

                    {/* Toggle 3: System Lockout */}
                    <div className="p-4 bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 rounded-xl shadow-sm flex flex-col gap-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-red-600 dark:text-red-500" />
                          <span className="text-sm font-bold text-red-700 dark:text-red-400">DEFCON 1 Lockout</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input 
                            type="checkbox" 
                            className="sr-only peer" 
                            checked={permissions.systemLockout}
                            onChange={(e) => onUpdatePermissions({ systemLockout: e.target.checked })}
                          />
                          <div className="w-10 h-5 bg-slate-200 dark:bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-red-600 dark:peer-checked:bg-red-500"></div>
                        </label>
                      </div>
                      <p className="text-[10px] font-medium text-red-600/70 dark:text-red-400/70">Executes lockdown on Team Messaging and critical inputs.</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {activeTab === "PERSONNEL" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {loading ? (
                    <div className="text-center py-10 text-slate-500 font-medium">Fetching Personnel Records...</div>
                  ) : editingPersonId ? (
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-5 rounded-xl shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200 dark:border-slate-800">
                        <h3 className="font-bold text-slate-800 dark:text-slate-100">
                          Editing Rights: {personnel.find(p => p.id === editingPersonId)?.full_name}
                        </h3>
                        <button onClick={() => setEditingPersonId(null)} className="text-slate-500 hover:text-slate-700">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="space-y-4">
                        <label className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Allow Live Video</span>
                          <input 
                            type="checkbox" 
                            className="rounded text-blue-600" 
                            checked={tempPermissions?.allow_video || false}
                            onChange={(e) => setTempPermissions({...tempPermissions, allow_video: e.target.checked})}
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Allow Audit Logs</span>
                          <input 
                            type="checkbox" 
                            className="rounded text-blue-600" 
                            checked={tempPermissions?.allow_audit || false}
                            onChange={(e) => setTempPermissions({...tempPermissions, allow_audit: e.target.checked})}
                          />
                        </label>
                        <label className="flex items-center justify-between">
                          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-red-600">System Lockout</span>
                          <input 
                            type="checkbox" 
                            className="rounded text-red-600 focus:ring-red-500" 
                            checked={tempPermissions?.system_lockout || false}
                            onChange={(e) => setTempPermissions({...tempPermissions, system_lockout: e.target.checked})}
                          />
                        </label>
                        <button 
                          onClick={() => handleUpdatePersonnel(editingPersonId)} 
                          className="w-full mt-4 py-2 bg-blue-600 hover:bg-blue-700 transition-colors text-white rounded-lg text-sm font-bold"
                        >
                          Save Configuration
                        </button>
                      </div>
                    </div>
                  ) : (
                    personnel.map((person) => (
                      <div key={person.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between hover:border-blue-300 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center font-bold text-slate-500">
                              {person.full_name?.substring(0,2).toUpperCase() || '??'}
                            </div>
                            <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-slate-900 ${
                              person.status === "Online" ? "bg-green-500" : person.status === "Away" ? "bg-amber-500" : "bg-slate-400"
                            }`} />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-800 dark:text-slate-200 text-sm">{person.full_name}</h4>
                            <p className="text-xs text-slate-500 uppercase">{person.role} • {person.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {getPermissionsRecord(person.personnel_permissions).system_lockout && (
                            <span className="px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-[10px] font-bold rounded uppercase">LOCKED</span>
                          )}
                          <button 
                            onClick={() => {
                              setTempPermissions({
                                allow_video: false,
                                allow_audit: false,
                                system_lockout: false,
                                ...getPermissionsRecord(person.personnel_permissions),
                              });
                              setEditingPersonId(person.id);
                            }} 
                            className="px-3 py-1.5 text-xs font-bold border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-blue-50 hover:text-blue-600 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors"
                          >
                            Edit Rights
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

              {activeTab === "APPROVALS" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl mb-4">
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      Centralized view of all pending unit changes globally. Approve or deny directly.
                    </p>
                  </div>
                  
                  {pendingApprovals.length === 0 ? (
                    <div className="text-center py-12 text-slate-500 font-medium">
                      <CheckCircle className="w-12 h-12 mx-auto mb-3 text-slate-300 dark:text-slate-700" />
                      All queues clear. No pending approvals.
                    </div>
                  ) : (
                    pendingApprovals.map((task) => (
                      <div key={task.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm hover:border-blue-400 dark:hover:border-blue-500 transition-colors group">
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 rounded">
                            {task.id}
                          </span>
                          <div className="flex items-center gap-1 text-[10px] text-slate-400 font-bold uppercase">
                            <Clock className="w-3 h-3" /> AWAITING
                          </div>
                        </div>
                        
                        <h4 className="font-bold text-slate-800 dark:text-slate-200 mb-1">{task.title}</h4>
                        <p className="text-xs text-slate-500 mb-4 line-clamp-2">{task.description}</p>
                        
                        {task.pending_updates && (
                           <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-950 rounded border border-slate-100 dark:border-slate-800 text-xs">
                             <div className="font-bold text-slate-700 dark:text-slate-300 mb-1">Requested Changes:</div>
                             {task.pending_updates.title !== task.title && <div><span className="text-slate-400">Title:</span> {task.pending_updates.title}</div>}
                             {task.pending_updates.description !== task.description && <div><span className="text-slate-400">Desc:</span> {task.pending_updates.description}</div>}
                             {task.pending_updates.progress !== task.progress && <div><span className="text-slate-400">Progress:</span> {task.progress}% ➔ {task.pending_updates.progress}%</div>}
                           </div>
                        )}

                        <div className="flex gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <button 
                            onClick={() => {
                              handleUpdateTask({
                                ...task,
                                status: "approved",
                                title: task.pending_updates?.title ?? task.title,
                                description: task.pending_updates?.description ?? task.description,
                                progress: task.pending_updates?.progress ?? task.progress,
                                pending_updates: undefined,
                                history_payload: { ...task.history_payload, status: "success", timestamp: new Date().toISOString() }
                              }, "approve");
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/40 rounded-lg text-xs font-bold transition-colors"
                          >
                            <Check className="w-4 h-4" /> APPROVE
                          </button>
                          <button 
                            onClick={() => {
                              handleUpdateTask({
                                ...task,
                                status: "approved", // reverting to approved but discarding updates
                                pending_updates: undefined,
                              }, "reject");
                            }}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 rounded-lg text-xs font-bold transition-colors"
                          >
                            <X className="w-4 h-4" /> DENY
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}

            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
