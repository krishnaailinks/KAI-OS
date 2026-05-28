"use client";

import React, { useState } from "react";
import { Draggable } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { Terminal, Cpu, Clock, User, Copy, Check, GitBranch, Bug } from "lucide-react";
import { Task } from "../types/dashboard";

interface TaskCardProps {
  task: Task;
  index: number;
  onClick: (task: Task) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, index, onClick }) => {
  const [hoveredLogs, setHoveredLogs] = useState(false);
  const [copied, setCopied] = useState(false);

  const getPriorityColors = (priority: string) => {
    switch (priority) {
      case "CRITICAL": return { bg: "bg-red-50 dark:bg-red-900/20", border: "border-red-200 dark:border-red-800", text: "text-red-700 dark:text-red-400", dot: "bg-red-500" };
      case "ELEVATED": return { bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800", text: "text-orange-700 dark:text-orange-400", dot: "bg-orange-500" };
      case "STANDARD": return { bg: "bg-blue-50 dark:bg-blue-900/20", border: "border-blue-200 dark:border-blue-800", text: "text-blue-700 dark:text-blue-400", dot: "bg-blue-500" };
      case "LOW": return { bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
      default: return { bg: "bg-slate-50 dark:bg-slate-800", border: "border-slate-200 dark:border-slate-700", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
    }
  };

  const pColors = getPriorityColors(task.priority);

  const handleCopyLogs = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(task.history_payload.logs_path || "");
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className="mb-3 outline-none select-none"
        >
          <motion.div
            onClick={() => onClick(task)}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, delay: Math.min(index * 0.05, 0.3) }}
            whileHover={{ y: -2 }}
            className={`relative p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm transition-all duration-150 cursor-pointer hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md ${
              snapshot.isDragging ? "shadow-xl border-blue-500 ring-1 ring-blue-500 z-50 rotate-2 scale-105" : ""
            }`}
          >
            <div className="flex justify-between items-start mb-3">
              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md border border-slate-200 dark:border-slate-700">
                {task.id}
              </span>
              <div className="flex items-center gap-2">
                {task.status === "pending_review" && (
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 animate-pulse">PENDING REVIEW</span>
                )}
                <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-wider uppercase border ${pColors.border} ${pColors.bg} ${pColors.text}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${pColors.dot}`}></span>
                  {task.priority}
                </div>
              </div>
            </div>

            <div className="flex items-start justify-between mb-1.5 gap-2">
              <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-snug">{task.title}</h4>
              {task.budget != null && (
                <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-md border border-emerald-200 dark:border-emerald-800/50 whitespace-nowrap flex items-center gap-1">
                  <span className="text-emerald-500">$</span>
                  {Number(task.budget).toLocaleString()}
                </div>
              )}
            </div>
            
            {/* Phase 11 badges row */}
            <div className="flex flex-wrap gap-1.5 mb-3">
              {task.task_type && task.task_type !== "task" && (
                <span className={`text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded border flex items-center gap-0.5 ${
                  task.task_type === "bug" 
                    ? "bg-red-50 dark:bg-red-950/20 text-red-650 dark:text-red-400 border-red-200 dark:border-red-800/30" 
                    : "bg-purple-50 dark:bg-purple-950/20 text-purple-650 dark:text-purple-400 border-purple-200 dark:border-purple-800/30"
                }`}>
                  {task.task_type === "bug" && <Bug className="w-2.5 h-2.5" />}
                  {task.task_type === "feature" && <GitBranch className="w-2.5 h-2.5" />}
                  {task.task_type}
                </span>
              )}
              {task.git_branch && (
                <span className="text-[8px] font-mono bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/60 text-slate-550 dark:text-slate-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <GitBranch className="w-2.5 h-2.5 text-blue-500" />
                  {task.git_branch.length > 18 ? task.git_branch.substring(0, 18) + "..." : task.git_branch}
                </span>
              )}
              {task.logged_hours && task.logged_hours > 0 ? (
                <span className="text-[8px] font-mono bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <Clock className="w-2.5 h-2.5" />
                  {task.logged_hours.toFixed(1)} hrs
                </span>
              ) : null}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 line-clamp-2 leading-relaxed">{task.description}</p>

            {/* Progress Bar */}
            <div className="mb-4">
              <div className="flex justify-between text-[10px] font-semibold text-slate-500 mb-1.5">
                <span>PROGRESS</span>
                <span className="text-blue-600 dark:text-blue-400">{task.progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${task.progress}%` }}
                />
              </div>
            </div>

            <div className="flex items-center justify-between mt-auto pt-3 border-t border-slate-100 dark:border-slate-800/50">
              <div className="flex -space-x-1">
                {task.tool_stack.slice(0, 3).map((tool) => (
                  <div key={tool} className="w-6 h-6 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[8px] font-bold text-slate-600 dark:text-slate-300 z-10" title={tool}>
                    {tool.charAt(0)}
                  </div>
                ))}
                {task.tool_stack.length > 3 && (
                  <div className="w-6 h-6 rounded-full bg-blue-50 dark:bg-blue-900/50 border-2 border-white dark:border-slate-900 flex items-center justify-center text-[9px] font-bold text-blue-600 dark:text-blue-400 z-0">
                    +{task.tool_stack.length - 3}
                  </div>
                )}
              </div>
              
              <div 
                className="relative flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-500 transition-colors"
                onMouseEnter={() => setHoveredLogs(true)}
                onMouseLeave={() => setHoveredLogs(false)}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span className="font-mono text-[10px]">LOGS</span>

                <AnimatePresence>
                  {hoveredLogs && (
                    <motion.div 
                      initial={{ opacity: 0, y: 5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 5, scale: 0.95 }}
                      className="absolute bottom-full right-0 mb-2 w-64 p-3 bg-slate-900 border border-slate-700 rounded-lg shadow-xl z-50"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-[10px] font-bold text-slate-300 tracking-wider">PAYLOAD REF</span>
                        <button 
                          onClick={handleCopyLogs}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <div className="bg-slate-950 p-2 rounded-md border border-slate-800 overflow-x-auto">
                        <code className="text-[10px] text-blue-400 whitespace-nowrap">
                          {task.history_payload.logs_path}
                        </code>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-3 text-[10px]">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500 font-semibold">AGENT</span>
                          <span className="text-slate-200 flex items-center gap-1"><Cpu className="w-3 h-3 text-sky-400"/> {task.history_payload.agent_id}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-slate-500 font-semibold">EXEC TIME</span>
                          <span className="text-slate-200 flex items-center gap-1"><Clock className="w-3 h-3 text-sky-400"/> {task.history_payload.execution_ms}ms</span>
                        </div>
                        <div className="flex flex-col gap-0.5 col-span-2 border-t border-slate-800 pt-1.5 mt-1">
                           <span className="text-slate-500 font-semibold">TRIGGERED BY</span>
                           <span className="text-slate-200 flex items-center gap-1"><User className="w-3 h-3 text-slate-400" /> {task.history_payload.triggered_by}</span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </Draggable>
  );
};
