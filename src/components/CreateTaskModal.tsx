"use client";

import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Cpu, Terminal } from "lucide-react";
import { Task, TaskPriority, ColumnId } from "../types/dashboard";
import { apiFetch } from "@/lib/api";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddTask: (task: Task, columnId: ColumnId) => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({ isOpen, onClose, onAddTask }) => {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("STANDARD");
  const [projectId, setProjectId] = useState<string>("");
  const [taskType, setTaskType] = useState<"task" | "feature" | "bug">("task");
  const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);

  React.useEffect(() => {
    if (isOpen) {
      apiFetch("/api/projects")
        .then(res => res.json())
        .then(data => setProjects(data.projects || []))
        .catch(console.error);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setBudget("");
    setPriority("STANDARD");
    setProjectId("");
    setTaskType("task");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;

    const idNum = `${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;
    const task: Task = {
      id: `TASK-${idNum}`,
      title,
      description,
      priority,
      budget: budget ? parseFloat(budget) : undefined,
      project_id: projectId || undefined,
      progress: 0,
      tool_stack: ["Pending"],
      task_type: taskType,
      git_branch: "",
      git_commit: "",
      git_pr: "",
      bug_severity: taskType === "bug" ? "medium" : undefined,
      bug_environment: taskType === "bug" ? "staging" : undefined,
      bug_steps: "",
      bug_expected: "",
      bug_actual: "",
      logged_hours: 0,
      history_payload: {
        logs_path: `C:\\sys\\temp\\task_${idNum}.log`,
        execution_ms: 0,
        agent_id: "UNASSIGNED",
        timestamp: new Date().toISOString(),
        status: "running",
        triggered_by: "DIRECTOR",
      },
    };

    onAddTask(task, "TODO");
    resetForm();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={handleClose}
          />
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 10 }}
            className="relative w-full max-w-lg mx-2 sm:mx-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-10"
          >
            <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
              <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                <Terminal className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                NEW TASK DIRECTIVE
              </h2>
              <button
                onClick={handleClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto custom-scroll">
              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Task Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  placeholder="e.g. Initialize Subroutine Alpha"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Description
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none h-20"
                  placeholder="Detailed task parameters..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Task Type
                  </label>
                  <select
                    value={taskType}
                    onChange={(e) => setTaskType(e.target.value as "task" | "feature" | "bug")}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="task">Standard Task</option>
                    <option value="feature">Feature Development</option>
                    <option value="bug">Bug Report</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                    Project Assignment
                  </label>
                  <select
                    value={projectId}
                    onChange={(e) => setProjectId(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                  >
                    <option value="">Standalone Task</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Project Budget (Revenue)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-slate-400 font-bold">$</span>
                  <input
                    type="number"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                    className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-lg pl-8 pr-4 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    placeholder="e.g. 1500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Priority Level
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {(["LOW", "STANDARD", "ELEVATED", "CRITICAL"] as TaskPriority[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={`py-2 text-[10px] font-bold rounded-lg border transition-all ${
                        priority === p
                          ? p === "CRITICAL" ? "bg-red-500 text-white border-red-600"
                          : p === "ELEVATED" ? "bg-orange-500 text-white border-orange-600"
                          : p === "STANDARD" ? "bg-blue-600 text-white border-blue-700"
                          : "bg-slate-600 text-white border-slate-700"
                          : "bg-slate-50 dark:bg-slate-950 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-slate-200 dark:border-slate-800 mt-6">
                <button
                  type="button"
                  onClick={handleClose}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!title.trim() || !description.trim()}
                  className="px-5 py-2 text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm flex items-center gap-2"
                >
                  <Cpu className="w-4 h-4" />
                  Issue Directive
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
