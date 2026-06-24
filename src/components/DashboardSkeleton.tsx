"use client";

import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "./Skeleton";

export const DashboardSkeleton: React.FC = () => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="h-screen bg-slate-50 dark:bg-slate-950 relative text-slate-900 dark:text-slate-100 flex flex-col overflow-hidden"
    >
      <div className="flex-1 flex max-w-[1600px] w-full mx-auto overflow-hidden">
        {/* Sidebar Skeleton */}
        <aside className="w-64 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hidden md:flex flex-col shrink-0">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-4">
            <Skeleton variant="text" width={80} height={12} className="mb-4" />
            {[...Array(6)].map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2.5">
                <Skeleton variant="text" width={18} height={18} className="rounded-lg" />
                <Skeleton variant="text" width={100} height={14} />
              </div>
            ))}
          </div>
          <div className="mt-auto p-4 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800">
              <Skeleton variant="circular" width={40} height={40} />
              <div className="space-y-1.5">
                <Skeleton variant="text" width={90} height={12} />
                <Skeleton variant="text" width={60} height={10} />
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-auto flex flex-col">
          {/* Top Navbar */}
          <div className="h-16 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 md:px-6 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-4">
              <Skeleton variant="text" width={32} height={32} className="rounded-lg" />
              <div className="space-y-1">
                <Skeleton variant="text" width={120} height={14} />
                <Skeleton variant="text" width={90} height={10} />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton variant="text" width={100} height={28} className="rounded-md" />
              <Skeleton variant="circular" width={32} height={32} />
              <Skeleton variant="circular" width={32} height={32} />
            </div>
          </div>

          {/* Dashboard Content */}
          <div className="p-6 flex flex-col gap-6">
            {/* Stats Grid */}
            <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} variant="card" height={100} />
              ))}
            </section>

            {/* Main Content Area: Kanban */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
              {/* Kanban Header */}
              <div className="h-14 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between bg-slate-50 dark:bg-slate-950/50">
                <div className="flex items-center gap-3">
                  <Skeleton variant="circular" width={8} height={8} />
                  <Skeleton variant="text" width={200} height={14} />
                </div>
                <div className="flex items-center gap-3">
                  <Skeleton variant="text" width={100} height={28} className="rounded-lg" />
                  <Skeleton variant="text" width={120} height={28} className="rounded-lg" />
                  <Skeleton variant="text" width={100} height={28} className="rounded-lg" />
                </div>
              </div>

              {/* Kanban Columns */}
              <div className="p-6 overflow-x-auto">
                <div className="flex gap-6 min-w-max">
                  {["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"].map((col) => (
                    <div key={col} className="w-80 flex flex-col">
                      {/* Column Header */}
                      <div className="px-4 py-3 border rounded-t-xl bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                        <div className="flex justify-between items-center mb-0.5">
                          <Skeleton variant="text" width={120} height={14} />
                          <Skeleton variant="text" width={24} height={18} className="rounded-full" />
                        </div>
                        <Skeleton variant="text" width={80} height={10} className="mt-1" />
                      </div>
                      {/* Column Body with Cards */}
                      <div className="flex-1 p-3 border-x border-b rounded-b-xl bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 space-y-3">
                        {[...Array(3)].map((_, j) => (
                          <div key={j} className="p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-3">
                            <div className="flex justify-between items-start">
                              <Skeleton variant="text" width={60} height={12} className="rounded-md" />
                              <Skeleton variant="text" width={70} height={12} className="rounded-full" />
                            </div>
                            <Skeleton variant="text" width="80%" height={14} />
                            <Skeleton variant="text" width="100%" height={10} />
                            <Skeleton variant="text" width="60%" height={10} />
                            {col === "IN_PROGRESS" && (
                              <div className="space-y-1.5">
                                <div className="flex justify-between">
                                  <Skeleton variant="text" width={60} height={10} />
                                  <Skeleton variant="text" width={30} height={10} />
                                </div>
                                <Skeleton variant="text" width="100%" height={6} className="rounded-full" />
                              </div>
                            )}
                            <div className="flex justify-between items-center pt-3 border-t border-slate-100 dark:border-slate-800/50">
                              <div className="flex -space-x-1">
                                {[...Array(3)].map((_, k) => (
                                  <Skeleton key={k} variant="circular" width={24} height={24} className="border-2 border-white dark:border-slate-900" />
                                ))}
                              </div>
                              <Skeleton variant="text" width={50} height={12} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
