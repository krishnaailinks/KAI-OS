"use client";

import React from "react";
import { motion } from "framer-motion";

type SkeletonVariant = "text" | "circular" | "rectangular" | "card";

interface SkeletonProps {
  variant?: SkeletonVariant;
  width?: string | number;
  height?: string | number;
  className?: string;
}

const variantClasses: Record<SkeletonVariant, string> = {
  text: "rounded-md",
  circular: "rounded-full",
  rectangular: "rounded-xl",
  card: "rounded-xl border border-slate-200 dark:border-slate-800",
};

export const Skeleton: React.FC<SkeletonProps> = ({
  variant = "text",
  width = "100%",
  height = variant === "circular" ? 40 : 20,
  className = "",
}) => {
  const isCard = variant === "card";

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className={`${isCard ? "bg-white dark:bg-slate-900 p-4" : "bg-slate-200 dark:bg-slate-800"} ${variantClasses[variant]} ${className}`}
      style={{ width, height }}
    >
      {isCard && (
        <div className="space-y-3">
          <div className="h-4 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-md animate-shimmer" />
          <div className="h-3 w-full bg-slate-200 dark:bg-slate-800 rounded-md animate-shimmer" />
          <div className="h-3 w-2/3 bg-slate-200 dark:bg-slate-800 rounded-md animate-shimmer" />
        </div>
      )}
      {!isCard && <div className="w-full h-full animate-shimmer" />}
    </motion.div>
  );
};
