"use client";

import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "./Skeleton";

const COLUMNS = [
  { id: "TODO", title: "Backlog", subtitle: "Queued" },
  { id: "IN_PROGRESS", title: "Active Workload", subtitle: "Running" },
  { id: "IN_REVIEW", title: "Awaiting Clearance", subtitle: "Review" },
  { id: "COMPLETED", title: "Completed", subtitle: "Done" },
];

const CARD_COUNTS: Record<string, number> = {
  TODO: 4,
  IN_PROGRESS: 3,
  IN_REVIEW: 3,
  COMPLETED: 4,
};

export const KanbanSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col h-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm"
    >
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
        <div className="flex items-center gap-3">
          <Skeleton variant="circular" width={8} height={8} />
          <Skeleton variant="text" width={200} height={14} />
        </div>
        <div className="flex items-center gap-3">
          <Skeleton variant="text" width={100} height={28} className="rounded-lg" />
          <Skeleton variant="text" width={120} height={28} className="rounded-lg" />
        </div>
      </div>

      {/* Columns */}
      <div className="flex-1 overflow-x-auto p-6 bg-slate-50/50 dark:bg-slate-950/20">
        <div className="flex gap-6 h-full min-w-max items-start">
          {COLUMNS.map((column) => {
            const cardCount = CARD_COUNTS[column.id];
            return (
              <div key={column.id} className="w-80 flex flex-col h-full max-h-full">
                {/* Column Header */}
                <div className="px-4 py-3 border-t-2 rounded-t-xl border-x bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-700 border-t-slate-400 dark:border-t-slate-500">
                  <div className="flex justify-between items-center mb-0.5">
                    <Skeleton variant="text" width={140} height={15} />
                    <Skeleton variant="text" width={24} height={20} className="rounded-full" />
                  </div>
                  <Skeleton variant="text" width={80} height={10} />
                </div>

                {/* Cards */}
                <div className="flex-1 p-3 border-x border-b rounded-b-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3 overflow-y-auto">
                  {[...Array(cardCount)].map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm"
                    >
                      {/* Top row: ID badge + priority */}
                      <div className="flex justify-between items-start mb-3">
                        <Skeleton variant="text" width={50} height={16} className="rounded-md" />
                        <Skeleton variant="text" width={70} height={16} className="rounded-full" />
                      </div>

                      {/* Title */}
                      <Skeleton variant="text" width="85%" height={14} className="mb-2" />

                      {/* Badge row */}
                      <div className="flex flex-wrap gap-1.5 mb-3">
                        <Skeleton variant="text" width={60} height={14} className="rounded" />
                        <Skeleton variant="text" width={80} height={14} className="rounded" />
                      </div>

                      {/* Description */}
                      <Skeleton variant="text" width="100%" height={10} className="mb-1" />
                      <Skeleton variant="text" width="65%" height={10} className="mb-4" />

                      {/* Progress bar */}
                      <div className="mb-4">
                        <div className="flex justify-between mb-1.5">
                          <Skeleton variant="text" width={60} height={10} />
                          <Skeleton variant="text" width={30} height={10} />
                        </div>
                        <Skeleton variant="text" width="100%" height={6} className="rounded-full" />
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-800/50">
                        <div className="flex -space-x-1">
                          {[...Array(3)].map((_, j) => (
                            <Skeleton
                              key={j}
                              variant="circular"
                              width={24}
                              height={24}
                              className="border-2 border-white dark:border-slate-900"
                            />
                          ))}
                        </div>
                        <Skeleton variant="text" width={50} height={12} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </motion.div>
  );
};
