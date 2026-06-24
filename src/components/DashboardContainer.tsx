"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { apiFetch } from "@/lib/api";
import { 
  Compass,
  LayoutDashboard,
  MessageSquare,
  Video,
  Shield,
  LogOut,
  Moon,
  Sun,
  ShieldCheck,
  Search,
  Lock as LockIcon,
  Unlock,
  Menu,
  DollarSign,
  Users,
  FolderKanban,
  Activity,
  Database,
  Plus,
} from "lucide-react";
import { KanbanBoard } from "./KanbanBoard";
import { TeamMessaging } from "./TeamMessaging";
import { LiveMeeting, type ActiveMeeting } from "./LiveMeeting";
import { AuditLogs } from "./AuditLogs";
import { DirectorModePanel } from "./DirectorModePanel";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { FinancePanel } from "./FinancePanel";
import { CompanyDirectory } from "./CompanyDirectory";
import { ExecutiveAuditCenter } from "./ExecutiveAuditCenter";
import { AdminSuperPanel } from "./AdminSuperPanel";
import { ProjectManager } from "./ProjectManager";
import SectionErrorBoundary from "./SectionErrorBoundary";
import { TabId, SystemPermissions, DashboardState, Task, ColumnId, Column } from "../types/dashboard";

const INITIAL_TASKS: Record<string, Task> = {};

const INITIAL_COLUMNS: Record<ColumnId, Column> = {
  "TODO": { id: "TODO", title: "Backlog", subtitle: "Queued", color: "bg-slate-500", taskIds: [] },
  "IN_PROGRESS": { id: "IN_PROGRESS", title: "Active Workload", subtitle: "Running", color: "bg-blue-500", taskIds: [] },
  "IN_REVIEW": { id: "IN_REVIEW", title: "Awaiting Clearance", subtitle: "Review", color: "bg-amber-500", taskIds: [] },
  "COMPLETED": { id: "COMPLETED", title: "Completed", subtitle: "Done", color: "bg-green-500", taskIds: [] }
};

interface DashboardContainerProps {
  role: "director" | "employee" | "client";
}

export const DashboardContainer: React.FC<DashboardContainerProps> = ({ role }) => {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  
  const [logs, setLogs] = useState<{message: string, timestamp: string}[]>([]);

  const [activeTab, setActiveTab] = useState<TabId>(role === "client" ? "CLIENT_PORTAL" : "DASHBOARD");
  const [isDirectorModeOpen, setIsDirectorModeOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [roleVerified, setRoleVerified] = useState(false);
  const [permissions, setPermissions] = useState<SystemPermissions>({
    allowVideo: true,
    allowAudit: true,
    systemLockout: false
  });

  const [isLocked, setIsLocked] = useState(false);
  const [lockPassword, setLockPassword] = useState("");
  const [lockError, setLockError] = useState("");
  const [lockLoading, setLockLoading] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [activeMeeting, setActiveMeeting] = useState<ActiveMeeting | null>(null);

  const verifyLockPassword = async () => {
    if (!lockPassword) return;
    setLockLoading(true);
    setLockError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: (await supabase.auth.getSession()).data.session?.user?.email || "",
        password: lockPassword,
      });
      if (error) {
        setLockError("Invalid password. Access denied.");
        setLockLoading(false);
        return;
      }
      setIsLocked(false);
      setLockPassword("");
    } catch {
      setLockError("Verification failed.");
    }
    setLockLoading(false);
  };
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSearchTask, setActiveSearchTask] = useState<Task | null>(null);

  const [projects, setProjects] = useState<ProjectSummary[]>([]);

  // LIFETIME BOARD STATE
  const [boardState, setBoardState] = useState<DashboardState>({
    tasks: INITIAL_TASKS,
    columns: INITIAL_COLUMNS,
    columnOrder: ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"],
    archivedTaskIds: []
  });

  useEffect(() => {
    const verifyRole = async () => {
      const res = await apiFetch('/api/me');
      if (!res.ok) {
        await supabase.auth.signOut();
        router.replace('/login');
        return;
      }

      const data = await res.json();
      const actualRole = data.profile?.role;

      if (actualRole !== role) {
        if (actualRole === 'director') router.replace('/dashboard/director');
        else if (actualRole === 'client') router.replace('/dashboard/client');
        else router.replace('/dashboard/employee');
        return;
      }

      setRoleVerified(true);
    };

    verifyRole();
  }, [role, router]);

  // Fetch live projects
  useEffect(() => {
    if (!roleVerified) return;
    apiFetch("/api/projects")
      .then(res => res.json())
      .then(data => setProjects(data.projects || []))
      .catch(console.error);
  }, [roleVerified]);

  // Fetch live data from API on mount and connect WebSockets
  useEffect(() => {
    if (!roleVerified) return;

    const fetchTasks = async () => {
      try {
        const res = await apiFetch('/api/tasks');
        if (res.ok) {
          const data = await res.json();
          if (data.tasks && Object.keys(data.tasks).length > 0) {
            setBoardState(prev => {
              const newColumns = {
                TODO: { ...prev.columns.TODO, taskIds: [] as string[] },
                IN_PROGRESS: { ...prev.columns.IN_PROGRESS, taskIds: [] as string[] },
                IN_REVIEW: { ...prev.columns.IN_REVIEW, taskIds: [] as string[] },
                COMPLETED: { ...prev.columns.COMPLETED, taskIds: [] as string[] }
              };
              
              Object.values(data.tasks).forEach((task) => {
                const typedTask = task as Task;
                const colId = typedTask.column_id || "TODO";
                if (newColumns[colId as ColumnId]) {
                  newColumns[colId as ColumnId].taskIds.push(typedTask.id);
                }
              });

              return { ...prev, tasks: data.tasks, columns: newColumns };
            });
          } else {
            setBoardState(prev => ({
              ...prev,
              tasks: {},
              columns: {
                TODO: { ...prev.columns.TODO, taskIds: [] },
                IN_PROGRESS: { ...prev.columns.IN_PROGRESS, taskIds: [] },
                IN_REVIEW: { ...prev.columns.IN_REVIEW, taskIds: [] },
                COMPLETED: { ...prev.columns.COMPLETED, taskIds: [] }
              }
            }));
          }
        }
      } catch (e) {
        console.error(e);
      }
    };

    fetchTasks();

    // Set up Realtime WebSockets
    const channel = supabase
      .channel('public:tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => {
        fetchTasks();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roleVerified]);

  // Fetch and sync permissions
  useEffect(() => {
    if (!roleVerified) return;
    let currentUserId = "";
    
    const fetchUserPermissions = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        currentUserId = session.user.id;
        try {
          const res = await apiFetch('/api/permissions');
          if (res.ok) {
            const data = await res.json();
            if (data.permissions) {
              setPermissions({
                allowVideo: data.permissions.allow_video ?? false,
                allowAudit: data.permissions.allow_audit ?? false,
                systemLockout: data.permissions.system_lockout ?? false
              });
            }
          }
        } catch (err) {
          console.error("Failed to fetch permissions", err);
        }
      }
    };
    fetchUserPermissions();

    // Listen for realtime permission updates
    const permChannel = supabase
      .channel('public:personnel_permissions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'personnel_permissions' }, payload => {
        const updatedPermissions = payload.new as {
          user_id?: string;
          allow_video?: boolean;
          allow_audit?: boolean;
          system_lockout?: boolean;
        };

        if (payload.eventType !== 'DELETE' && currentUserId && updatedPermissions.user_id === currentUserId) {
          setPermissions({
            allowVideo: updatedPermissions.allow_video ?? false,
            allowAudit: updatedPermissions.allow_audit ?? false,
            systemLockout: updatedPermissions.system_lockout ?? false
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(permChannel);
    };
  }, [roleVerified]);

  const [toast, setToast] = useState<{message: string, type: 'success'|'error'|'info'} | null>(null);

  const showToast = (message: string, type: 'success'|'error'|'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleUpdateTask = async (updatedTask: Task, action?: "approve" | "reject" | "save" | "archive") => {
    if (action === "archive") {
      const newCompletedTaskIds = boardState.columns["COMPLETED"].taskIds.filter(id => id !== updatedTask.id);
      
      setBoardState({
        ...boardState,
        archivedTaskIds: [...(boardState.archivedTaskIds || []), updatedTask.id],
        columns: {
          ...boardState.columns,
          COMPLETED: { ...boardState.columns["COMPLETED"], taskIds: newCompletedTaskIds }
        }
      });
      showToast(`Task ${updatedTask.id} has been archived to deep storage.`, 'success');
      addLog(`[ARCHIVE] Unit ${updatedTask.id} archived by Director.`);
      return;
    }

    // Optimistic UI Update
    setBoardState(prev => ({
      ...prev,
      tasks: {
        ...prev.tasks,
        [updatedTask.id]: updatedTask
      }
    }));

    // API Sync
    try {
      const dbUpdatePayload: Partial<Task> = { ...updatedTask };
      delete dbUpdatePayload.history_payload;
      
      await apiFetch(`/api/tasks/${updatedTask.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action, ...dbUpdatePayload })
      });
    } catch (e) {
      console.error("Failed to sync task update to server", e);
    }

    if (action === "approve") {
      showToast(`Task ${updatedTask.id} approved.`, 'success');
      addLog(`[APPROVAL] Unit ${updatedTask.id} changes explicitly APPROVED by Director.`);
    } else if (action === "reject") {
      showToast(`Task ${updatedTask.id} updates rejected.`, 'error');
      addLog(`[DENIAL] Unit ${updatedTask.id} changes explicitly DENIED by Director.`);
    } else {
      showToast(`Task ${updatedTask.id} updated.`, 'info');
      addLog(`[UPDATE] Unit ${updatedTask.id} data modified by personnel.`);
    }
  };

  const resetBoard = () => {
    setBoardState({
      tasks: INITIAL_TASKS,
      columns: INITIAL_COLUMNS,
      columnOrder: ["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"],
      archivedTaskIds: []
    });
    addLog("[SYSTEM] Board state reset to default configuration by Director.");
  };

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    
    // Command Palette Listener
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowCommandPalette(true);
      }
      if (e.key === 'Escape') {
        setShowCommandPalette(false);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    if (isLocked || showCommandPalette || activeSearchTask) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isLocked, showCommandPalette, activeSearchTask]);

  useEffect(() => {
    if (permissions.systemLockout) {
      setIsLocked(true);
    }
  }, [permissions.systemLockout]);

  const addLog = useCallback((message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { message, timestamp }].slice(-50));
    
    // Sync audit log to DB asynchronously
    apiFetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'SYSTEM', message })
    }).catch(() => {});
  }, []);

  const handleLogout = () => {
    supabase.auth.signOut();
    router.push("/login");
  };

  const handleUpdatePermissions = (newPerms: Partial<SystemPermissions>) => {
    if (role === "director") {
      setPermissions(prev => ({ ...prev, ...newPerms }));
    }
  };

  const renderTabs = () => {
    return (
      <>
        <div className={`w-full h-full ${activeTab === "DASHBOARD" ? "block" : "hidden"}`}>
          <div className="flex flex-col gap-6 w-full h-full">
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold tracking-wide mb-2">
                  <span className="flex items-center gap-1.5 uppercase">
                    <FolderKanban className="w-3.5 h-3.5 text-blue-500" />
                    Total Tasks
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {Object.keys(boardState.tasks).length}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold tracking-wide mb-2">
                  <span className="flex items-center gap-1.5 uppercase">
                    <Activity className="w-3.5 h-3.5 text-sky-500" />
                    In Progress
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {boardState.columns["IN_PROGRESS"]?.taskIds.length || 0}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold tracking-wide mb-2">
                  <span className="flex items-center gap-1.5 uppercase">
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-500" />
                    In Review
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {boardState.columns["IN_REVIEW"]?.taskIds.length || 0}
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm relative overflow-hidden">
                <div className="flex items-center justify-between text-[11px] text-slate-500 font-bold tracking-wide mb-2">
                  <span className="flex items-center gap-1.5 uppercase">
                    <LayoutDashboard className="w-3.5 h-3.5 text-emerald-500" />
                    Completed
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
                    {boardState.columns["COMPLETED"]?.taskIds.length || 0}
                  </span>
                </div>
              </div>
            </section>
          </div>
        </div>

        <div className={`w-full h-full ${activeTab === "TEAM_CHAT" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Team Hub">
            <TeamMessaging
              permissions={permissions}
              role={role as "director" | "employee" | "client"}
              onJoinMeeting={(roomCode, roomName, roomId) => {
                setActiveMeeting({ roomCode, roomName, roomId });
                setActiveTab("LIVE_MEETING");
              }}
            />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full ${activeTab === "LIVE_MEETING" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Live Meeting">
            <LiveMeeting
              permissions={permissions}
              role={role as "employee" | "director"}
              activeMeeting={activeMeeting}
              onLeaveMeeting={() => setActiveMeeting(null)}
            />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full ${activeTab === "AUDIT_LOGS" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Audit Logs">
            <AuditLogs permissions={permissions} role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full overflow-hidden ${activeTab === "FINANCE" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Finance">
            <FinancePanel role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full overflow-hidden ${activeTab === "DIRECTORY" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Directory">
            <CompanyDirectory role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full overflow-hidden ${activeTab === "AUDIT_CENTER" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Audit Center">
            <ExecutiveAuditCenter role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full overflow-hidden ${activeTab === "ADMIN_SUPER" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Admin Panel">
            <AdminSuperPanel role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>

        <div className={`w-full h-full overflow-hidden ${activeTab === "PROJECT_MANAGER" ? "block" : "hidden"}`}>
          <SectionErrorBoundary title="Project Manager">
            <ProjectManager role={role as "employee" | "director"} />
          </SectionErrorBoundary>
        </div>
      </>
    );
  };

  return (
    <div className="h-screen bg-slate-50 dark:bg-slate-950 relative text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden font-sans transition-colors">
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto overflow-hidden">
        <aside className={`w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 ${focusMode ? "hidden" : "hidden md:flex"} flex-col shadow-sm z-10`}>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            {role === "client" ? (
              <>
                <h3 className="text-xs font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-4 uppercase">Client Portal</h3>
                <nav className="space-y-1.5">
                  <button 
                    onClick={() => setActiveTab("CLIENT_PORTAL")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "CLIENT_PORTAL" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" /> Service Desk
                  </button>
                </nav>
              </>
            ) : (
              <>
                <h3 className="text-xs font-bold tracking-wider text-slate-400 dark:text-slate-500 mb-4 uppercase">Workspaces</h3>
                <nav className="space-y-1.5">
                  <button 
                    onClick={() => setActiveTab("DASHBOARD")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "DASHBOARD" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4" /> Dashboard
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab("TEAM_CHAT")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "TEAM_CHAT" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <MessageSquare className="w-4 h-4" /> Team Hub
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab("LIVE_MEETING")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "LIVE_MEETING" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Video className="w-4 h-4" /> Live Meeting
                    {!permissions.allowVideo && <Shield className="w-3 h-3 text-red-500 ml-auto" />}
                  </button>
                  
                  <button 
                    onClick={() => setActiveTab("AUDIT_LOGS")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "AUDIT_LOGS" ? "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Database className="w-4 h-4" /> Audit Logs
                    {(!permissions.allowAudit || role !== "director") && <Shield className="w-3 h-3 text-red-500 ml-auto" />}
                  </button>

                  <button 
                    onClick={() => setActiveTab("FINANCE")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "FINANCE" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <DollarSign className="w-4 h-4" /> Finance (FMS)
                    {role !== "director" && <Shield className="w-3 h-3 text-red-500 ml-auto" />}
                  </button>

                  <button 
                    onClick={() => setActiveTab("DIRECTORY")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "DIRECTORY" ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <Users className="w-4 h-4" /> HR Directory
                  </button>

                  {role === 'director' && (
                    <button 
                      onClick={() => setActiveTab("AUDIT_CENTER")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === "AUDIT_CENTER" ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" /> Executive Audit
                    </button>
                  )}

                  <button 
                    onClick={() => setActiveTab("PROJECT_MANAGER")}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                      activeTab === "PROJECT_MANAGER" ? "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    }`}
                  >
                    <FolderKanban className="w-4 h-4" /> Projects & ERP
                  </button>

                  {role === 'director' && (
                    <button 
                      onClick={() => setActiveTab("ADMIN_SUPER")}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-semibold rounded-lg transition-all ${
                        activeTab === "ADMIN_SUPER" ? "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 shadow-sm" : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                      }`}
                    >
                      <Activity className="w-4 h-4" /> Live Admin
                    </button>
                  )}
                </nav>
              </>
            )}
          </div>
          
          <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
             <div className="flex items-center gap-3 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl shadow-sm">
               <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800">
                 <Compass className="w-5 h-5 text-blue-500" />
               </div>
               <div>
                 <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate max-w-[120px]">{role.toUpperCase()}</div>
                 <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1.5 mt-0.5">
                   <span className="w-1.5 h-1.5 rounded-full bg-sky-500"></span> Online
                 </div>
               </div>
             </div>
          </div>
        </aside>

        <div className="flex-1 overflow-auto bg-slate-50/50 dark:bg-slate-950/50 relative flex flex-col">
          {/* Top Navbar */}
          <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shadow-sm z-10 shrink-0">
            <div className="flex items-center gap-4">
              <div className="md:hidden">
                <button className="p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Menu className="w-5 h-5" />
                </button>
              </div>
              
              <div className="hidden sm:flex items-center gap-2">
                <img src="/icon.png" alt="KAI-OS" className="w-8 h-8 object-contain" />
                <div className="mr-4">
                  <h1 className="font-bold text-slate-800 dark:text-white leading-tight tracking-tight text-sm">KAI-OS</h1>
                  <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Krishna AI Links Pvt. Ltd.</p>
                </div>
                <div className={`px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${
                  role === 'director' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                  role === 'client' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' :
                  'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                }`}>
                  {role} CLIENT PORTAL
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {role === 'director' && (
                <button 
                  onClick={() => {
                    const logData = logs.map(l => `[${l.timestamp}] ${l.message}`).join("\n");
                    const blob = new Blob([logData], { type: "text/plain" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `KAI-OS-Audit-Log-${new Date().toISOString()}.txt`;
                    a.click();
                    URL.revokeObjectURL(url);
                    addLog("[SYSTEM] Immutable Audit Log Exported by Director.");
                  }}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-500 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all shadow-sm"
                  title="Export Audit Logs"
                >
                  <Database className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase hidden lg:block">Export Logs</span>
                </button>
              )}
              
              {role === "director" && (
                <button
                  onClick={() => setIsDirectorModeOpen(true)}
                  className="flex items-center gap-1.5 px-4 py-2 border border-blue-600 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-md font-sans tracking-wide font-bold"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>DIRECTOR PANEL</span>
                </button>
              )}

              <div className="w-px h-6 bg-slate-200 dark:border-slate-800 hidden md:block"></div>

              {role !== "client" && (
                <button
                  onClick={() => setShowCommandPalette(true)}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 border border-slate-200 dark:border-slate-800 text-slate-400 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all shadow-sm group"
                >
                  <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-500 transition-colors" />
                  <span className="text-xs font-semibold">Search globally...</span>
                  <span className="ml-4 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 text-[9px] rounded font-bold text-slate-500">Ctrl+K</span>
                </button>
              )}

              {role !== "client" && (
                <button
                  onClick={() => setIsLocked(true)}
                  className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-amber-50 hover:text-amber-600 dark:hover:bg-amber-900/20 dark:hover:text-amber-400 rounded-lg transition-all shadow-sm"
                  title="Lock Session"
                >
                  <LockIcon className="w-4 h-4" />
                </button>
              )}

              <button
                onClick={() => setFocusMode(!focusMode)}
                className={`p-2 border rounded-lg transition-all shadow-sm ${
                  focusMode
                    ? "bg-blue-600 border-blue-700 text-white"
                    : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
                title={focusMode ? "Exit Focus Mode" : "Enter Focus Mode"}
              >
                <LayoutDashboard className="w-4 h-4" />
              </button>

              <button
                onClick={() => mounted && setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-all shadow-sm"
              >
                {mounted && theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>

              <button
                onClick={handleLogout}
                className="p-2 border border-red-200 dark:border-red-900/50 text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all shadow-sm"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-auto">
            {role === "client" ? (
              activeTab === "CLIENT_PORTAL" && (
                <div className="p-6">
                  <SectionErrorBoundary title="Client Portal">
                  <ClientPortal 
                    boardState={boardState}
                    projects={projects}
                    onAddTask={(newTask) => {
                      // Insert client ticket into todo backlog
                      setBoardState(prev => {
                        const todoTaskIds = [...prev.columns.TODO.taskIds, newTask.id];
                        return {
                          ...prev,
                          tasks: { ...prev.tasks, [newTask.id]: newTask },
                          columns: {
                            ...prev.columns,
                            TODO: { ...prev.columns.TODO, taskIds: todoTaskIds }
                          }
                        };
                      });
                      
                      // API POST
                      apiFetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(newTask)
                      }).then(() => {
                        addLog(`[TICKET] Client submitted support ticket ${newTask.id}`);
                        showToast(`Service ticket ${newTask.id} filed successfully!`, 'success');
                      }).catch(console.error);
                    }}
                    onClickTask={(task) => {
                      setActiveSearchTask(task);
                    }}
                  />
                  </SectionErrorBoundary>
                </div>
              )
            ) : (
              <>
                <div className={`h-full p-6 ${activeTab === 'DASHBOARD' ? 'block' : 'hidden'}`}>
                  <SectionErrorBoundary title="Kanban Board">
                    <KanbanBoard 
                    role={role as "employee" | "director"} 
                    onLogEvent={addLog} 
                    boardState={boardState} 
                    setBoardState={setBoardState} 
                    handleUpdateTask={handleUpdateTask}
                    resetBoard={resetBoard}
                    toast={toast}
                  />
                  </SectionErrorBoundary>
                </div>
                <div className={`h-full p-6 ${activeTab !== 'DASHBOARD' ? 'block' : 'hidden'}`}>
                  {renderTabs()}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {role !== "client" && (
        <DirectorModePanel 
          isOpen={isDirectorModeOpen} 
          onClose={() => setIsDirectorModeOpen(false)} 
          permissions={permissions}
          onUpdatePermissions={handleUpdatePermissions}
          boardState={boardState}
          handleUpdateTask={handleUpdateTask}
        />
      )}

      {/* OS Lock Screen Overlay */}
      {isLocked && (
        <div className="fixed inset-0 z-[5000] bg-slate-900/90 backdrop-blur-xl flex flex-col items-center justify-center text-white">
          <div className="w-24 h-24 bg-blue-600/20 rounded-full flex items-center justify-center mb-8 border border-blue-500/30">
            <LockIcon className="w-10 h-10 text-blue-400" />
          </div>
          <h2 className="text-3xl font-bold tracking-tight mb-2">Session Locked</h2>
          <p className="text-slate-400 mb-8 font-mono text-sm">Re-enter your password to resume.</p>

          {lockError && (
            <div className="mb-4 px-4 py-2 bg-red-500/20 border border-red-500/40 rounded-lg text-red-300 text-sm font-bold">
              {lockError}
            </div>
          )}

          <div className="w-full max-w-sm flex gap-3">
            <input
              type="password"
              placeholder="••••••••"
              value={lockPassword}
              onChange={(e) => setLockPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && lockPassword && !lockLoading) {
                  verifyLockPassword();
                }
              }}
              disabled={lockLoading}
              className="flex-1 bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono tracking-widest text-center disabled:opacity-50"
            />
            <button
              onClick={verifyLockPassword}
              disabled={!lockPassword || lockLoading}
              className="px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 rounded-xl font-bold transition-colors shadow-lg shadow-blue-900/50 flex items-center justify-center disabled:cursor-not-allowed"
            >
              {lockLoading ? (
                <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <Unlock className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Global Command Palette */}
      {showCommandPalette && (
        <div className="fixed inset-0 z-[4000] bg-slate-900/60 backdrop-blur-sm flex items-start justify-center pt-[15vh]">
           <div className="w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
             <div className="flex items-center px-4 border-b border-slate-200 dark:border-slate-800">
               <Search className="w-5 h-5 text-slate-400" />
               <input 
                 autoFocus
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="Search KAI-OS globally... (Tasks, Logs, Personnel)" 
                 className="flex-1 bg-transparent border-none py-4 px-3 text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-0 placeholder:text-slate-400 font-medium"
               />
               <button onClick={() => {setShowCommandPalette(false); setSearchQuery("");}} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-[10px] font-bold text-slate-500 rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">ESC</button>
             </div>
             <div className="p-2 max-h-96 overflow-y-auto">
                {searchQuery.trim() === "" ? (
                  <>
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Suggestions</div>
                    <button onClick={() => { setActiveTab("DASHBOARD"); setShowCommandPalette(false); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left rounded-lg transition-colors group">
                      <LayoutDashboard className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Go to Dashboard</span>
                    </button>
                    <button onClick={() => { setActiveTab("LIVE_MEETING"); setShowCommandPalette(false); }} className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left rounded-lg transition-colors group">
                      <Video className="w-4 h-4 text-slate-400 group-hover:text-blue-500" />
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400">Join Active Meeting</span>
                    </button>
                  </>
                ) : (
                  <>
                    <div className="px-3 py-2 text-xs font-bold text-slate-500 uppercase tracking-wider">Search Results</div>
                    {Object.values(boardState.tasks)
                      .filter(t => t.title.toLowerCase().includes(searchQuery.toLowerCase()) || t.id.toLowerCase().includes(searchQuery.toLowerCase()))
                      .map(task => (
                        <button 
                          key={task.id}
                          onClick={() => {
                            setActiveSearchTask(task);
                            setShowCommandPalette(false);
                            setSearchQuery("");
                          }} 
                          className="w-full flex items-center gap-3 px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 text-left rounded-lg transition-colors group"
                        >
                          <span className="text-xs font-mono font-bold px-2 py-0.5 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 rounded group-hover:bg-blue-200 dark:group-hover:bg-blue-800 transition-colors">
                            {task.id}
                          </span>
                          <span className="text-sm font-medium text-slate-700 dark:text-slate-300 group-hover:text-blue-700 dark:group-hover:text-blue-400 truncate">
                            {task.title}
                          </span>
                          <span className="text-[10px] ml-auto font-bold text-slate-400 uppercase">{task.status}</span>
                        </button>
                      ))}
                  </>
                )}
             </div>
           </div>
           <div className="absolute inset-0 -z-10" onClick={() => setShowCommandPalette(false)} />
        </div>
      )}

      {/* Global Task Modal */}
      {activeSearchTask && (
        <TaskDetailsModal
          isOpen={true}
          task={activeSearchTask}
          onClose={() => setActiveSearchTask(null)}
          onUpdateTask={handleUpdateTask}
          role={role}
        />
      )}
    </div>
  );
};

/* ==========================================================
   PHASE 11: CLIENT SERVICE DESK PORTAL COMPONENT
   ========================================================== */

interface ProjectSummary {
  id: string;
  name: string;
  description?: string;
  status: string;
  tasks?: { count: number }[];
}

interface ClientPortalProps {
  boardState: DashboardState;
  projects: ProjectSummary[];
  onAddTask: (task: Task) => void;
  onClickTask: (task: Task) => void;
}

const ClientPortal: React.FC<ClientPortalProps> = ({ boardState, projects, onAddTask, onClickTask }) => {
  const [ticketTitle, setTicketTitle] = useState("");
  const [ticketDesc, setTicketDesc] = useState("");
  const [ticketPriority, setTicketPriority] = useState<"LOW" | "STANDARD" | "ELEVATED" | "CRITICAL">("STANDARD");
  const [ticketType, setTicketType] = useState<"bug" | "feature">("bug");
  const [associatedProj, setAssociatedProj] = useState("");

  const tasksList = Object.values(boardState.tasks);

  // Stats calculation
  const totalTickets = tasksList.length;
  const inProgressTickets = tasksList.filter(t => t.column_id === "IN_PROGRESS" || t.column_id === "IN_REVIEW").length;
  const completedTickets = tasksList.filter(t => t.column_id === "COMPLETED").length;
  const avgProgress = totalTickets > 0 ? Math.round(tasksList.reduce((acc, t) => acc + (t.progress || 0), 0) / totalTickets) : 0;

  const handleSubmitTicket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketTitle.trim() || !ticketDesc.trim()) return;

    const ticketId = Math.floor(1000 + Math.random() * 9000);
    const newTask: Task = {
      id: `TICKET-${ticketId}`,
      title: ticketTitle,
      description: ticketDesc,
      priority: ticketPriority,
      progress: 0,
      tool_stack: ["Client Subm."],
      task_type: ticketType,
      project_id: associatedProj || undefined,
      status: "approved", // auto approved directly into TODO board for dev review
      column_id: "TODO",
      bug_severity: ticketType === "bug" ? "medium" : undefined,
      bug_environment: ticketType === "bug" ? "staging" : undefined,
      git_branch: "",
      git_commit: "",
      git_pr: "",
      logged_hours: 0,
      history_payload: {
        agent_id: "CLIENT",
        timestamp: new Date().toISOString(),
        status: "success",
        triggered_by: "CLIENT"
      }
    };

    onAddTask(newTask);
    setTicketTitle("");
    setTicketDesc("");
    setTicketPriority("STANDARD");
    setTicketType("bug");
    setAssociatedProj("");
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Welcome & Stats Row */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 relative overflow-hidden shadow-2xl">
        <div className="absolute top-[-20%] right-[-10%] w-64 h-64 bg-blue-500/10 blur-[100px] rounded-full pointer-events-none" />
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 z-10 relative">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white mb-1">Welcome to your Service Desk</h2>
            <p className="text-xs text-slate-400 max-w-md leading-relaxed">
              Track project milestones in real-time, inspect ticket delivery statuses, and request urgent support directives.
            </p>
          </div>
          <div className="bg-slate-950/80 border border-slate-800/80 px-4 py-3 rounded-2xl flex items-center gap-3 shadow-inner">
            <ShieldCheck className="w-8 h-8 text-blue-500 animate-pulse" />
            <div>
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">Security Encryption</div>
              <span className="text-xs font-mono font-bold text-slate-300">SSL v3.5 Secure Node</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-8 pt-6 border-t border-slate-800">
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Total tickets filed</div>
            <span className="text-xl font-bold text-white font-mono">{totalTickets}</span>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">In Active Pipeline</div>
            <span className="text-xl font-bold text-blue-400 font-mono">{inProgressTickets}</span>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Completed Delivery</div>
            <span className="text-xl font-bold text-green-400 font-mono">{completedTickets}</span>
          </div>
          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800">
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5">Average Progress</div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-purple-400 font-mono">{avgProgress}%</span>
              <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden max-w-[60px]">
                <div className="h-full bg-purple-500" style={{ width: `${avgProgress}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Active Support Tickets */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FolderKanban className="w-5 h-5 text-blue-500" />
              Active Project Milestones
            </h3>
            {projects.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-xs">
                No active projects assigned to your corporate node.
              </div>
            ) : (
              <div className="space-y-4">
                {projects.map((proj) => {
                  const projTasks = tasksList.filter(t => t.project_id === proj.id);
                  const progress = projTasks.length > 0 ? Math.round(projTasks.reduce((acc, t) => acc + (t.progress || 0), 0) / projTasks.length) : 0;
                  return (
                    <div key={proj.id} className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl flex flex-col gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-bold text-slate-800 dark:text-slate-200">{proj.name}</span>
                        <span className="text-xs font-mono font-bold text-blue-600 dark:text-blue-400">{progress}% Completed</span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                        <div className="h-full bg-blue-500" style={{ width: `${progress}%` }}></div>
                      </div>
                      <p className="text-[11px] text-slate-500 line-clamp-1">{proj.description}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-5 h-5 text-blue-500" />
              Active Tickets Tracker
            </h3>
            {tasksList.length === 0 ? (
              <div className="text-center py-10 text-slate-400 dark:text-slate-600 text-xs">
                No tickets submitted yet. Use the Service Form to request support.
              </div>
            ) : (
              <div className="space-y-3 max-h-[400px] overflow-y-auto custom-scroll pr-1">
                {tasksList.map((task) => (
                  <div 
                    key={task.id} 
                    onClick={() => onClickTask(task)}
                    className="p-4 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-sm cursor-pointer transition-all flex items-center justify-between gap-4"
                  >
                    <div className="flex flex-col gap-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="text-[9px] font-bold text-slate-500 px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded-md">{task.id}</span>
                        <span className={`text-[8px] font-extrabold uppercase px-1.5 rounded border flex items-center gap-0.5 ${
                          task.task_type === "bug" 
                            ? "bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border-red-200 dark:border-red-800/30" 
                            : "bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-200 dark:border-purple-800/30"
                        }`}>
                          {task.task_type}
                        </span>
                      </div>
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200 truncate">{task.title}</span>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold border uppercase ${
                          task.column_id === "COMPLETED" ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:border-green-800" :
                          task.column_id === "IN_REVIEW" ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-800" :
                          task.column_id === "IN_PROGRESS" ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-800" :
                          "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
                        }`}>
                          {task.column_id === "COMPLETED" ? "Completed" :
                           task.column_id === "IN_REVIEW" ? "Under Review" :
                           task.column_id === "IN_PROGRESS" ? "In Progress" : "Queued"}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">{task.progress}%</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Submit Ticket Form */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            File Service Ticket
          </h3>
          <form onSubmit={handleSubmitTicket} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ticket Title</label>
              <input
                type="text"
                required
                value={ticketTitle}
                onChange={(e) => setTicketTitle(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                placeholder="e.g. SSL Cert Renewal Fail"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Associated Project</label>
              <select
                required
                value={associatedProj}
                onChange={(e) => setAssociatedProj(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">Select Project...</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ticket Type</label>
                <select
                  value={ticketType}
                  onChange={(e) => setTicketType(e.target.value as "bug" | "feature")}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="bug">Bug / Defect</option>
                  <option value="feature">Feature Req.</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Priority</label>
                <select
                  value={ticketPriority}
                  onChange={(e) => setTicketPriority(e.target.value as "LOW" | "STANDARD" | "ELEVATED" | "CRITICAL")}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="LOW">Low</option>
                  <option value="STANDARD">Standard</option>
                  <option value="ELEVATED">Elevated</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Ticket Details</label>
              <textarea
                required
                rows={4}
                value={ticketDesc}
                onChange={(e) => setTicketDesc(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl px-3 py-2 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500/50 resize-none"
                placeholder="Include error codes, steps, or requirements..."
              />
            </div>

            <button
              type="submit"
              disabled={!ticketTitle || !ticketDesc || !associatedProj}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm rounded-xl transition-all shadow-md disabled:opacity-50"
            >
              Submit Ticket Directive
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};
