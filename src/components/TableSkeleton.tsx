"use client";

import React from "react";
import { motion } from "framer-motion";
import { Skeleton } from "./Skeleton";

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
}

const COLUMN_WIDTHS = ["w-1/6", "w-2/6", "w-2/6", "w-1/6"];

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 4,
}) => {
  const widths =
    columns <= COLUMN_WIDTHS.length
      ? COLUMN_WIDTHS.slice(0, columns)
      : Array(columns).fill("w-1/4");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm"
    >
      {/* Header Row */}
      <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
        {widths.map((_, i) => (
          <div key={i} className={widths[i]}>
            <Skeleton variant="text" width="80%" height={12} />
          </div>
        ))}
      </div>

      {/* Body Rows */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800/50">
        {[...Array(rows)].map((_, i) => (
          <div
            key={i}
            className={`grid grid-cols-12 gap-4 px-6 py-4 items-center ${
              i % 2 === 1 ? "bg-slate-50/50 dark:bg-slate-950/20" : ""
            }`}
          >
            {widths.map((_, j) => (
              <div key={j} className={widths[j]}>
                <Skeleton
                  variant="text"
                  width={j === 0 ? "60%" : j === 1 ? "90%" : "75%"}
                  height={j === 0 ? 14 : 10}
                />
              </div>
            ))}
          </div>
        ))}
      </div>

      {/* Footer / Pagination */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/50">
        <Skeleton variant="text" width={120} height={10} />
        <div className="flex items-center gap-2">
          <Skeleton variant="text" width={32} height={32} className="rounded-lg" />
          <Skeleton variant="text" width={32} height={32} className="rounded-lg" />
          <Skeleton variant="text" width={32} height={32} className="rounded-lg" />
          <Skeleton variant="text" width={32} height={32} className="rounded-lg" />
        </div>
      </div>
    </motion.div>
  );
};
