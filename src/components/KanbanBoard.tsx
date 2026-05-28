"use client";

import React, { useState, useEffect } from "react";
import { DragDropContext, Droppable, DropResult } from "@hello-pangea/dnd";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, RotateCcw, AlertTriangle, Check, Terminal, X } from "lucide-react";
import { Task, ColumnId, DashboardState } from "../types/dashboard";
import { TaskCard } from "./TaskCard";
import { CreateTaskModal } from "./CreateTaskModal";
import { TaskDetailsModal } from "./TaskDetailsModal";
import { apiFetch } from "@/lib/api";

interface KanbanBoardProps {
  role: "employee" | "director";
  onLogEvent: (msg: string) => void;
  boardState: DashboardState;
  setBoardState: (state: DashboardState) => void;
  handleUpdateTask: (updatedTask: Task, action?: "approve" | "reject" | "save" | "archive") => void;
  resetBoard: () => void;
  toast: {message: string, type: 'success'|'error'|'info'} | null;
}
export const KanbanBoard: React.FC<KanbanBoardProps> = ({ 
  role, 
  onLogEvent,
  boardState: state,
  setBoardState: setState,
  handleUpdateTask,
  resetBoard,
  toast
}) => {
  const [mounted, setMounted] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showArchives, setShowArchives] = useState(false);
  const [activeTask, setActiveTask] = useState<Task | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;

    const startColumn = state.columns[source.droppableId as ColumnId];
    const finishColumn = state.columns[destination.droppableId as ColumnId];

    if (startColumn === finishColumn) {
      const newTaskIds = Array.from(startColumn.taskIds);
      newTaskIds.splice(source.index, 1);
      newTaskIds.splice(destination.index, 0, draggableId);

      const newColumn = { ...startColumn, taskIds: newTaskIds };
      setState({
        ...state,
        columns: { ...state.columns, [newColumn.id]: newColumn }
      });
      return;
    }

    const startTaskIds = Array.from(startColumn.taskIds);
    startTaskIds.splice(source.index, 1);
    const newStartColumn = { ...startColumn, taskIds: startTaskIds };

    const finishTaskIds = Array.from(finishColumn.taskIds);
    finishTaskIds.splice(destination.index, 0, draggableId);
    const newFinishColumn = { ...finishColumn, taskIds: finishTaskIds };

    const targetTask = state.tasks[draggableId];
    let updatedTask = { ...targetTask };

    if (finishColumn.id === "COMPLETED") {
      updatedTask = {
        ...targetTask,
        progress: 100,
        history_payload: { ...targetTask.history_payload, status: "success", timestamp: new Date().toISOString() }
      };
      onLogEvent(`[SUCCESS] Task ${draggableId} marked as completed.`);
    } else if (finishColumn.id === "TODO") {
      updatedTask = {
        ...targetTask,
        progress: Math.min(targetTask.progress, 30),
        history_payload: { ...targetTask.history_payload, status: "running", timestamp: new Date().toISOString() }
      };
      onLogEvent(`[WARN] Task ${draggableId} moved back to TODO.`);
    } else {
      updatedTask = {
        ...targetTask,
        history_payload: { ...targetTask.history_payload, status: "running", timestamp: new Date().toISOString() }
      };
      onLogEvent(`[INFO] Task ${draggableId} moved to ${finishColumn.title}.`);
    }

    setState({
      ...state,
      tasks: { ...state.tasks, [draggableId]: updatedTask },
      columns: {
        ...state.columns,
        [newStartColumn.id]: newStartColumn,
        [newFinishColumn.id]: newFinishColumn
      }
    });

    // Sync to DB
    handleUpdateTask({ ...updatedTask, column_id: finishColumn.id });
  };

  const handleAddTask = async (newTask: Task, columnId: ColumnId) => {
    const taskWithColumn = { ...newTask, column_id: columnId };
    const column = state.columns[columnId];
    
    // Optimistic UI update
    setState({
      ...state,
      tasks: { ...state.tasks, [newTask.id]: taskWithColumn },
      columns: {
        ...state.columns,
        [columnId]: {
          ...column,
          taskIds: [newTask.id, ...column.taskIds]
        }
      }
    });
    onLogEvent(`[SYSTEM] New task ${newTask.id} created by ${role.toUpperCase()}.`);

    // API Sync
    try {
      const dbTaskPayload: Partial<Task> = { ...taskWithColumn };
      delete dbTaskPayload.history_payload;
      
      await apiFetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dbTaskPayload)
      });
    } catch (e) {
      console.error("Failed to create task", e);
    }
  };

  const getColumnColorClass = (color: string) => {
    switch (color) {
      case "slate": return "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200";
      case "blue": return "border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300";
      case "sky": return "border-sky-300 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/30 text-sky-800 dark:text-sky-300";
      case "blue-dark": return "border-indigo-300 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-300";
      default: return "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200";
    }
  };

  const getAccentColor = (color: string) => {
    switch (color) {
      case "slate": return "bg-slate-400 dark:bg-slate-500";
      case "blue": return "bg-blue-500";
      case "sky": return "bg-sky-500";
      case "blue-dark": return "bg-indigo-500";
      default: return "bg-slate-500";
    }
  };

  if (!mounted) return <div className="h-full w-full flex items-center justify-center text-slate-500">Initializing Workspace...</div>;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
          <h2 className="text-sm font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wide">Task Distribution Grid</h2>
        </div>
        
        <div className="flex items-center gap-3">
          <button 
            onClick={() => setShowArchives(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors border border-slate-200 dark:border-slate-700 text-xs font-bold"
          >
            Archives ({state.archivedTaskIds?.length || 0})
          </button>
          {role === "director" ? (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" /> CREATE TASK
            </button>
          ) : (
            <button 
              onClick={() => {}}
              disabled
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-400 text-xs font-bold rounded-lg cursor-not-allowed border border-slate-200 dark:border-slate-700"
              title="Only Directors can create tasks."
            >
              <AlertTriangle className="w-3.5 h-3.5" /> CREATE RESTRICTED
            </button>
          )}

          {role === "director" && (
            <button 
              onClick={resetBoard}
              className="flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-bold rounded-lg transition-colors shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" /> REBOOT BOARD
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-x-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
        <DragDropContext onDragEnd={onDragEnd}>
          <div className="flex gap-6 h-full min-w-max items-start">
            {state.columnOrder.map((columnId) => {
              const column = state.columns[columnId];
              const tasks = column.taskIds.map((taskId) => state.tasks[taskId]);
              const headerColors = getColumnColorClass(column.color);
              const accentColor = getAccentColor(column.color);

              return (
                <div key={column.id} className="w-80 flex flex-col h-full max-h-full">
                  <div className={`px-4 py-3 border-t-2 rounded-t-xl border-x ${headerColors} ${accentColor.replace('bg-', 'border-t-')}`}>
                    <div className="flex justify-between items-center mb-0.5">
                      <h3 className="font-bold text-sm tracking-tight">{column.title}</h3>
                      <span className="px-2 py-0.5 rounded-full bg-white/50 dark:bg-black/20 text-[10px] font-bold">
                        {tasks.length}
                      </span>
                    </div>
                    <p className="text-[10px] font-semibold opacity-70 uppercase tracking-wider">{column.subtitle}</p>
                  </div>

                  <Droppable droppableId={column.id}>
                    {(provided, snapshot) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className={`flex-1 p-3 border-x border-b rounded-b-xl overflow-y-auto transition-colors ${
                          snapshot.isDraggingOver 
                            ? "bg-slate-100 dark:bg-slate-800/80 border-blue-300 dark:border-blue-700 border-dashed" 
                            : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800"
                        }`}
                      >
                        {tasks.map((task, index) => (
                          <TaskCard key={task.id} task={task} index={index} onClick={setActiveTask} />
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      </div>

      <CreateTaskModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddTask={handleAddTask}
      />
      <TaskDetailsModal
        task={activeTask}
        isOpen={activeTask !== null}
        onClose={() => setActiveTask(null)}
        onUpdateTask={handleUpdateTask}
        role={role}
      />

      {/* Archives Modal */}
      <AnimatePresence>
        {showArchives && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowArchives(false)}
            />
            <motion.div
              initial={{ scale: 0.95, y: 10, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.95, y: 10, opacity: 0 }}
              className="relative w-full max-w-3xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden z-10 max-h-[90vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">Deep Storage Archives</h2>
                <button
                  onClick={() => setShowArchives(false)}
                  className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4">
                {(state.archivedTaskIds || []).length === 0 ? (
                  <div className="text-center py-10 text-slate-500 font-medium">No tasks in deep storage.</div>
                ) : (
                  (state.archivedTaskIds || []).map(taskId => {
                    const task = state.tasks[taskId];
                    return (
                      <div key={taskId} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl flex items-center justify-between opacity-70 hover:opacity-100 transition-opacity">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono font-bold px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-slate-500">{task.id}</span>
                            <h3 className="font-bold text-slate-800 dark:text-slate-200">{task.title}</h3>
                          </div>
                          <p className="text-xs text-slate-500 line-clamp-1">{task.description}</p>
                        </div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase">
                          Archived {new Date().toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Mock Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className={`absolute bottom-6 right-6 px-4 py-3 rounded-xl shadow-xl flex items-center gap-3 z-[2000] border font-medium text-sm ${
              toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-800 text-green-800 dark:text-green-300' :
              toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800 text-red-800 dark:text-red-300' :
              'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-300'
            }`}
          >
            {toast.type === 'success' && <Check className="w-5 h-5 text-green-500" />}
            {toast.type === 'error' && <AlertTriangle className="w-5 h-5 text-red-500" />}
            {toast.type === 'info' && <Terminal className="w-5 h-5 text-blue-500" />}
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
