"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  X, 
  Terminal, 
  User, 
  History, 
  AlertCircle, 
  CheckCircle, 
  Archive, 
  Sparkles,
  GitBranch,
  Bug,
  Clock,
  Calendar,
  Check
} from "lucide-react";
import { Task } from "../types/dashboard";
import { apiFetch } from "@/lib/api";

interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdateTask: (updatedTask: Task, action?: "approve" | "reject" | "save" | "archive") => void;
  role?: "director" | "employee" | "client";
}

export const TaskDetailsModal: React.FC<TaskDetailsModalProps> = ({
  task,
  isOpen,
  onClose,
  onUpdateTask,
  role = "employee",
}) => {
  // Navigation tab
  const [activeSubTab, setActiveSubTab] = useState<"general" | "git" | "bug" | "timesheet">("general");

  // Core task state
  const [progress, setProgress] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [assignee, setAssignee] = useState("System Agent");
  const [toolStack, setToolStack] = useState<string[]>([]);
  const [newTool, setNewTool] = useState("");
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);

  // Phase 11 IT specific states
  const [taskType, setTaskType] = useState<"task" | "feature" | "bug">("task");
  const [gitBranch, setGitBranch] = useState("");
  const [gitCommit, setGitCommit] = useState("");
  const [gitPr, setGitPr] = useState("");
  
  const [bugSeverity, setBugSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [bugEnvironment, setBugEnvironment] = useState<"development" | "staging" | "production">("staging");
  const [bugSteps, setBugSteps] = useState("");
  const [bugExpected, setBugExpected] = useState("");
  const [bugActual, setBugActual] = useState("");

  const [loggedHours, setLoggedHours] = useState(0);
  const [hoursToAdd, setHoursToAdd] = useState("");
  const [hoursDescription, setHoursDescription] = useState("");
  const [timesheetHistory, setTimesheetHistory] = useState<{ hours: number; desc: string; date: string }[]>([]);

  const MOCK_USERS = ["System Agent", "Alice L.", "Nishant", "QA Team", "DevOps Node"];

  const handleAIGenerateTags = async () => {
    if (!title || !description) return;
    setIsGeneratingAI(true);
    try {
      const res = await apiFetch("/api/ai/tagging", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.tools) {
          setToolStack(prev => Array.from(new Set([...prev, ...data.tools])));
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  useEffect(() => {
    if (task) {
      const timer = setTimeout(() => {
        setProgress(task.pending_updates?.progress ?? task.progress);
        setTitle(task.pending_updates?.title ?? task.title);
        setDescription(task.pending_updates?.description ?? task.description);
        setAssignee(task.history_payload?.agent_id || "System Agent");
        setToolStack(task.tool_stack || []);

        // Load phase 11 fields
        setTaskType(task.pending_updates?.task_type ?? task.task_type ?? "task");
        setGitBranch(task.pending_updates?.git_branch ?? task.git_branch ?? "");
        setGitCommit(task.pending_updates?.git_commit ?? task.git_commit ?? "");
        setGitPr(task.pending_updates?.git_pr ?? task.git_pr ?? "");
        setBugSeverity(task.pending_updates?.bug_severity ?? task.bug_severity ?? "medium");
        setBugEnvironment(task.pending_updates?.bug_environment ?? task.bug_environment ?? "staging");
        setBugSteps(task.pending_updates?.bug_steps ?? task.bug_steps ?? "");
        setBugExpected(task.pending_updates?.bug_expected ?? task.bug_expected ?? "");
        setBugActual(task.pending_updates?.bug_actual ?? task.bug_actual ?? "");
        setLoggedHours(task.pending_updates?.logged_hours ?? task.logged_hours ?? 0);

        // Load timesheet logs from quantum_signature metadata
        if (task.history_payload?.quantum_signature) {
          try {
            const parsed = JSON.parse(task.history_payload.quantum_signature);
            if (Array.isArray(parsed)) {
              setTimesheetHistory(parsed);
            } else {
              setTimesheetHistory([]);
            }
          } catch {
            setTimesheetHistory([]);
          }
        } else {
          setTimesheetHistory([]);
        }
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [task]);

  if (!task) return null;

  const isPendingReview = task.status === "pending_review";
  const isDirector = role === "director";
  const isClient = role === "client";
  const isCompleted = task.progress === 100 && !isPendingReview;

  const handleLogHours = () => {
    const hoursNum = parseFloat(hoursToAdd);
    if (isNaN(hoursNum) || hoursNum <= 0) return;
    
    const newEntry = {
      hours: hoursNum,
      desc: hoursDescription || "Worked on task",
      date: new Date().toLocaleDateString()
    };
    const updatedHistory = [...timesheetHistory, newEntry];
    setTimesheetHistory(updatedHistory);
    setLoggedHours(prev => prev + hoursNum);
    setHoursToAdd("");
    setHoursDescription("");
  };

  const handleSave = () => {
    const finalHistory = {
      ...task.history_payload,
      agent_id: assignee,
      status: "success" as const,
      timestamp: new Date().toISOString(),
      quantum_signature: JSON.stringify(timesheetHistory)
    };

    const finalFields = {
      title,
      description,
      progress,
      task_type: taskType,
      git_branch: gitBranch,
      git_commit: gitCommit,
      git_pr: gitPr,
      bug_severity: bugSeverity,
      bug_environment: bugEnvironment,
      bug_steps: bugSteps,
      bug_expected: bugExpected,
      bug_actual: bugActual,
      logged_hours: loggedHours
    };

    if (isDirector) {
      onUpdateTask({
        ...task,
        ...finalFields,
        tool_stack: toolStack,
        history_payload: finalHistory
      }, "approve");
    } else {
      onUpdateTask({ 
        ...task, 
        status: "pending_review",
        tool_stack: toolStack,
        history_payload: finalHistory,
        pending_updates: finalFields 
      }, "save");
    }
    onClose();
  };

  const handleApprove = () => {
    onUpdateTask({
      ...task,
      status: "approved",
      title,
      description,
      progress,
      tool_stack: toolStack,
      task_type: taskType,
      git_branch: gitBranch,
      git_commit: gitCommit,
      git_pr: gitPr,
      bug_severity: bugSeverity,
      bug_environment: bugEnvironment,
      bug_steps: bugSteps,
      bug_expected: bugExpected,
      bug_actual: bugActual,
      logged_hours: loggedHours,
      pending_updates: undefined,
      history_payload: {
        ...task.history_payload,
        agent_id: assignee,
        status: "success",
        timestamp: new Date().toISOString(),
        quantum_signature: JSON.stringify(timesheetHistory)
      }
    }, "approve");
    onClose();
  };

  const handleReject = () => {
    onUpdateTask({
      ...task,
      status: "rejected",
      pending_updates: undefined,
      history_payload: {
        ...task.history_payload,
        status: "failure",
        timestamp: new Date().toISOString()
      }
    }, "reject");
    onClose();
  };

  const handleArchive = () => {
    onUpdateTask(task, "archive");
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={onClose}
          />

          <motion.div
            initial={{ scale: 0.95, y: 10, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.95, y: 10, opacity: 0 }}
            className="relative w-full max-w-2xl mx-2 sm:mx-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden z-10 max-h-[90vh] flex flex-col"
          >
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-xs font-mono font-bold rounded-md border border-slate-200 dark:border-slate-700">
                  {task.id}
                </span>
                <span className={`px-2 py-1 text-[10px] font-bold rounded-md border ${
                  task.priority === "CRITICAL" ? "border-red-200 text-red-600 bg-red-50 dark:border-red-800 dark:text-red-400 dark:bg-red-900/20" :
                  task.priority === "ELEVATED" ? "border-orange-200 text-orange-600 bg-orange-50 dark:border-orange-800 dark:text-orange-400 dark:bg-orange-900/20" :
                  task.priority === "LOW" ? "border-slate-200 text-slate-600 bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:bg-slate-800" :
                  "border-blue-200 text-blue-600 bg-blue-50 dark:border-blue-800 dark:text-blue-400 dark:bg-blue-900/20"
                }`}>
                  {task.priority}
                </span>
                <span className={`px-2.5 py-0.5 rounded text-[10px] font-extrabold uppercase border flex items-center gap-1 ${
                  taskType === "bug" 
                    ? "bg-red-100 dark:bg-red-950/30 text-red-600 border-red-200 dark:border-red-800/40" 
                    : taskType === "feature"
                      ? "bg-purple-100 dark:bg-purple-950/30 text-purple-600 border-purple-200 dark:border-purple-800/40"
                      : "bg-blue-100 dark:bg-blue-950/30 text-blue-600 border-blue-200 dark:border-blue-800/40"
                }`}>
                  {taskType === "bug" && <Bug className="w-3 h-3" />}
                  {taskType === "feature" && <GitBranch className="w-3 h-3" />}
                  {taskType}
                </span>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Custom Tab Selector */}
            <div className="flex border-b border-slate-200 dark:border-slate-800 gap-1 mb-4 text-xs font-bold text-slate-500">
              <button
                type="button"
                onClick={() => setActiveSubTab("general")}
                className={`px-3 py-2 border-b-2 -mb-px transition-all ${
                  activeSubTab === "general" 
                    ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                    : "border-transparent hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                General Details
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("git")}
                className={`px-3 py-2 border-b-2 -mb-px transition-all flex items-center gap-1 ${
                  activeSubTab === "git" 
                    ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                    : "border-transparent hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <GitBranch className="w-3.5 h-3.5" />
                Git Integration
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("bug")}
                className={`px-3 py-2 border-b-2 -mb-px transition-all flex items-center gap-1 ${
                  activeSubTab === "bug" 
                    ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                    : "border-transparent hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Bug className="w-3.5 h-3.5" />
                Bug specifics
              </button>
              <button
                type="button"
                onClick={() => setActiveSubTab("timesheet")}
                className={`px-3 py-2 border-b-2 -mb-px transition-all flex items-center gap-1 ${
                  activeSubTab === "timesheet" 
                    ? "border-blue-500 text-blue-600 dark:text-blue-400" 
                    : "border-transparent hover:text-slate-800 dark:hover:text-slate-200"
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                Timesheet Logs
              </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pr-2 custom-scroll">
              {isPendingReview && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4 rounded-xl flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-amber-800 dark:text-amber-400 mb-1">
                      {isDirector ? "Director Review Required" : "Pending Director Approval"}
                    </h4>
                    <p className="text-xs text-amber-700 dark:text-amber-500/80">
                      {isDirector 
                        ? "An employee has proposed updates to this task. Please approve or reject the changes below." 
                        : "Your updates have been submitted and are currently awaiting Director approval."}
                    </p>
                  </div>
                </div>
              )}

              {/* TAB 1: GENERAL DETAILS */}
              {activeSubTab === "general" && (
                <div className="space-y-5">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Task Title</label>
                    <input 
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      disabled={(isDirector && isPendingReview) || isClient}
                      className="w-full text-lg font-bold text-slate-900 dark:text-slate-100 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2 mb-2 placeholder:text-slate-400"
                      placeholder="Task Title"
                    />
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1">Task Description</label>
                    <textarea 
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      disabled={(isDirector && isPendingReview) || isClient}
                      rows={4}
                      className="w-full text-sm text-slate-600 dark:text-slate-400 leading-relaxed bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-blue-500 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 rounded-xl px-3 py-2 resize-none custom-scroll"
                      placeholder="Task Description"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Task Type</h4>
                      <select
                        value={taskType}
                        onChange={(e) => setTaskType(e.target.value as "task" | "feature" | "bug")}
                        disabled={(isDirector && isPendingReview) || isClient}
                        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                      >
                        <option value="task">Standard Task</option>
                        <option value="feature">Feature Development</option>
                        <option value="bug">Bug Report</option>
                      </select>
                    </div>

                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Assignment</h4>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                          <User className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        </div>
                        <select
                          value={assignee}
                          onChange={(e) => setAssignee(e.target.value)}
                          disabled={(isDirector && isPendingReview) || isClient}
                          className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                        >
                          {MOCK_USERS.map(user => (
                            <option key={user} value={user}>{user}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl">
                    <div className="flex justify-between items-center text-xs font-bold text-slate-500 dark:text-slate-400 mb-2 uppercase tracking-wider">
                      <span>Task Progress</span>
                      {isDirector && isPendingReview ? (
                        <div className="flex items-center gap-2">
                           <span className="text-slate-400 line-through">{task.progress}%</span>
                           <span className="text-blue-600 dark:text-blue-400 font-bold">{progress}%</span>
                        </div>
                      ) : (
                        <span className="text-blue-600 dark:text-blue-400">{progress}%</span>
                      )}
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={progress}
                      onChange={(e) => setProgress(Number(e.target.value))}
                      disabled={(isDirector && isPendingReview) || isClient}
                      className={`w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none accent-blue-600 ${((isDirector && isPendingReview) || isClient) ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">Tool Stack</h4>
                      {!isClient && (
                        <button 
                          onClick={handleAIGenerateTags}
                          disabled={isGeneratingAI || !title}
                          className="flex items-center gap-1 text-[10px] bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 border border-indigo-200 dark:border-indigo-800 px-2 py-0.5 rounded font-bold transition-colors disabled:opacity-50"
                        >
                          <Sparkles className="w-3 h-3" />
                          {isGeneratingAI ? "THINKING..." : "AI AUTO-TAG"}
                        </button>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mb-2">
                      {toolStack.map(tool => (
                        <span key={tool} className="flex items-center gap-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold rounded uppercase tracking-wider border border-blue-200 dark:border-blue-800">
                          {tool}
                          {!isClient && (
                            <button 
                              onClick={() => setToolStack(toolStack.filter(t => t !== tool))}
                              className="hover:text-red-500 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                    {!isClient && (
                      <input
                        type="text"
                        value={newTool}
                        onChange={(e) => setNewTool(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newTool.trim()) {
                            e.preventDefault();
                            if (!toolStack.includes(newTool.trim())) {
                              setToolStack([...toolStack, newTool.trim()]);
                            }
                            setNewTool("");
                          }
                        }}
                        placeholder="Type tool & press Enter..."
                        className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 placeholder:text-slate-400"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: GIT SOURCE CONTROL */}
              {activeSubTab === "git" && (
                <div className="space-y-4">
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-start gap-3">
                    <GitBranch className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <h4 className="text-xs font-bold text-slate-800 dark:text-slate-300">Git branch & Commit tracking</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Link your code modifications with this task to maintain full traceablity for audit reviews. Pasting these values will allow quick reference within the deployment pipelines.
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Git Branch Name</label>
                    <input 
                      type="text"
                      value={gitBranch}
                      onChange={(e) => setGitBranch(e.target.value)}
                      disabled={isClient}
                      className="w-full text-sm font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2 placeholder:text-slate-500"
                      placeholder="e.g. feature/TASK-7482-auth-bypass"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Git Commit Hash</label>
                    <input 
                      type="text"
                      value={gitCommit}
                      onChange={(e) => setGitCommit(e.target.value)}
                      disabled={isClient}
                      className="w-full text-sm font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2 placeholder:text-slate-500"
                      placeholder="e.g. 7f4ab9e5c46e2786a34cd8f29e12"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Pull Request URL</label>
                    <input 
                      type="text"
                      value={gitPr}
                      onChange={(e) => setGitPr(e.target.value)}
                      disabled={isClient}
                      className="w-full text-sm font-mono text-slate-800 dark:text-slate-200 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2 placeholder:text-slate-500"
                      placeholder="e.g. https://github.com/company/krishna-os/pull/184"
                    />
                  </div>
                </div>
              )}

              {/* TAB 3: BUG SPECIFICS */}
              {activeSubTab === "bug" && (
                <div className="space-y-4">
                  {taskType !== "bug" ? (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-6 rounded-xl text-center space-y-3">
                      <Bug className="w-10 h-10 text-slate-400 dark:text-slate-600 mx-auto" />
                      <h4 className="text-sm font-bold text-slate-700 dark:text-slate-300">Not Marked as a Bug</h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                        To unlock specific Bug parameters (Severity, Environment, Steps to reproduce), please change the **Task Type** to **Bug Report** in the General Details tab.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Severity Level</label>
                          <select
                            value={bugSeverity}
                            onChange={(e) => setBugSeverity(e.target.value as "low" | "medium" | "high" | "critical")}
                            disabled={isClient}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                          >
                            <option value="low">Low Severity</option>
                            <option value="medium">Medium Severity</option>
                            <option value="high">High Severity</option>
                            <option value="critical">CRITICAL Block-out</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Test Environment</label>
                          <select
                            value={bugEnvironment}
                            onChange={(e) => setBugEnvironment(e.target.value as "development" | "staging" | "production")}
                            disabled={isClient}
                            className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm font-bold text-slate-800 dark:text-slate-200 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500/50 w-full"
                          >
                            <option value="development">Development (Local Node)</option>
                            <option value="staging">Staging Sandbox</option>
                            <option value="production">Production Server</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Steps to Reproduce</label>
                        <textarea 
                          value={bugSteps}
                          onChange={(e) => setBugSteps(e.target.value)}
                          disabled={isClient}
                          rows={3}
                          className="w-full text-xs font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2"
                          placeholder="1. Navigate to dashboard&#10;2. Press payroll run&#10;3. View exception log"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Expected Behavior</label>
                        <textarea 
                          value={bugExpected}
                          onChange={(e) => setBugExpected(e.target.value)}
                          disabled={isClient}
                          rows={2}
                          className="w-full text-xs text-slate-750 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2"
                          placeholder="Invoice generated successfully under finance database ledger"
                        />
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest block mb-1.5">Actual Behavior</label>
                        <textarea 
                          value={bugActual}
                          onChange={(e) => setBugActual(e.target.value)}
                          disabled={isClient}
                          rows={2}
                          className="w-full text-xs text-slate-750 dark:text-slate-350 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2"
                          placeholder="Supabase response returns error code 403 on API trigger endpoint"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB 4: TIMESHEET HOUR LOGS */}
              {activeSubTab === "timesheet" && (
                <div className="space-y-5">
                  <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-500/10 rounded-xl border border-blue-500/20 flex items-center justify-center">
                        <Clock className="w-5 h-5 text-blue-500" />
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total logged hours</h4>
                        <span className="text-xl font-bold font-mono text-slate-800 dark:text-slate-200">{loggedHours.toFixed(2)} Hrs</span>
                      </div>
                    </div>
                  </div>

                  {!isClient && (
                    <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-3">
                      <h4 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Log Hours Spent</h4>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          step="0.25"
                          value={hoursToAdd}
                          onChange={(e) => setHoursToAdd(e.target.value)}
                          placeholder="1.50"
                          className="w-24 text-sm font-mono text-center font-bold text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2"
                        />
                        <input
                          type="text"
                          value={hoursDescription}
                          onChange={(e) => setHoursDescription(e.target.value)}
                          placeholder="What did you work on? (e.g., debug session, API build)"
                          className="flex-1 text-sm text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50 rounded-xl px-3 py-2 placeholder:text-slate-400"
                        />
                        <button
                          type="button"
                          onClick={handleLogHours}
                          disabled={!hoursToAdd}
                          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors flex items-center gap-1.5 disabled:opacity-50"
                        >
                          <Check className="w-4 h-4" />
                          Log
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-2">Logged Hours History</h4>
                    {timesheetHistory.length === 0 ? (
                      <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-600 text-xs rounded-xl">
                        No time records found for this task yet.
                      </div>
                    ) : (
                      <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scroll pr-1">
                        {timesheetHistory.map((item, idx) => (
                          <div key={idx} className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-lg flex items-center justify-between text-xs">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-slate-800 dark:text-slate-200">{item.desc}</span>
                              <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {item.date}
                              </span>
                            </div>
                            <span className="font-bold font-mono text-blue-600 dark:text-blue-400 shrink-0">+{item.hours.toFixed(2)} hrs</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* History Section (Generic) */}
              {activeSubTab === "general" && (
                <div>
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                    <History className="w-4 h-4" /> History & Audit Trail
                  </h4>
                  <div className="space-y-4 relative before:absolute before:inset-0 before:ml-[11px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 dark:before:via-slate-800 before:to-transparent">
                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                      <div className="flex items-center justify-center w-6 h-6 rounded-full border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                        <Terminal className="w-3 h-3 text-blue-500" />
                      </div>
                      <div className="w-[calc(100%-2rem)] md:w-[calc(50%-1.5rem)] p-3 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50 shadow-sm">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-bold text-slate-800 dark:text-slate-200 text-xs">Status Update</span>
                          <span className="text-[10px] font-mono text-slate-500">Just now</span>
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-400 font-medium">
                          {(task.history_payload?.triggered_by || task.history_payload?.agent_id || "System Agent")} modified task state to: <span className="text-blue-600 dark:text-blue-400 font-bold">{task.history_payload?.status || task.status}</span>.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800 mt-4">
              {isDirector && isCompleted && (
                 <button
                   onClick={handleArchive}
                   className="mr-auto px-4 py-2 text-sm font-bold bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 rounded-lg transition-all shadow-sm flex items-center gap-2"
                 >
                   <Archive className="w-4 h-4" /> Archive Task
                 </button>
              )}

              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-bold border border-slate-300 dark:border-slate-700 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-all shadow-sm"
              >
                Close
              </button>
              
              {!isPendingReview && !isClient && (
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md flex items-center gap-2"
                >
                  {isDirector ? "Save Changes" : "Submit for Review"}
                </button>
              )}

              {isClient && (
                <button
                  onClick={handleSave}
                  className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all shadow-md flex items-center gap-2"
                >
                  Save Ticket
                </button>
              )}

              {isDirector && isPendingReview && (
                <>
                  <button
                    onClick={handleReject}
                    className="px-5 py-2 text-sm font-bold bg-white dark:bg-slate-900 border border-red-200 dark:border-red-800/50 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-all shadow-sm flex items-center gap-2"
                  >
                    <X className="w-4 h-4" /> Reject
                  </button>
                  <button
                    onClick={handleApprove}
                    className="px-5 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-all shadow-md flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve Update
                  </button>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
