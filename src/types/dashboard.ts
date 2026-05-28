export interface HistoryPayload {
  logs_path?: string;       // e.g., "C:\Users\zeega\.gemini\antigravity\brain\ae54...\logs\transcript.jsonl"
  execution_ms?: number;    // e.g., 2450
  agent_id?: string;        // e.g., "ANTIGRAVITY_v3.5"
  timestamp: string;       // e.g., "2026-05-24T01:16:42Z"
  status: "success" | "failure" | "running" | "pending" | "review";
  triggered_by?: string;    // e.g., "SYSTEM_DAEMON" or "USER"
  quantum_signature?: string; // e.g., "0x7F4A...B9E"
}

export type TaskPriority = "CRITICAL" | "ELEVATED" | "STANDARD" | "LOW";

export interface Task {
  id: string;              // e.g., "TASK-7482"
  title: string;           // e.g., "Bypass Neural Grid Firewall"
  description: string;     // e.g., "Sub-grid analysis for decrypting company core."
  priority: TaskPriority;
  progress: number;        // 0 to 100
  budget?: number;         // For automated invoicing
  tool_stack: string[];    // e.g., ["supabase", "framer", "dnd", "nextjs"]
  history_payload: HistoryPayload;
  status?: "pending_review" | "approved" | "rejected";
  pending_updates?: Partial<Task>; // Updates waiting for director
  column_id?: string;
  project_id?: string;
  
  // Phase 11 additions
  task_type?: "feature" | "bug" | "task";
  git_branch?: string;
  git_commit?: string;
  git_pr?: string;
  bug_severity?: "low" | "medium" | "high" | "critical";
  bug_environment?: "development" | "staging" | "production";
  bug_steps?: string;
  bug_expected?: string;
  bug_actual?: string;
  logged_hours?: number;
}

export type ColumnId = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "COMPLETED";

export interface Column {
  id: ColumnId;
  title: string;
  subtitle: string;
  color: string; // Tailwind color class, e.g. "zinc", "blue", "indigo", "emerald"
  taskIds: string[];
}

export interface DashboardState {
  tasks: Record<string, Task>;
  columns: Record<ColumnId, Column>;
  columnOrder: ColumnId[];
  archivedTaskIds: string[];
}

export type TabId = "DASHBOARD" | "TEAM_CHAT" | "LIVE_MEETING" | "AUDIT_LOGS" | "FINANCE" | "DIRECTORY" | "AUDIT_CENTER" | "ADMIN_SUPER" | "PROJECT_MANAGER" | "CLIENT_PORTAL";

export interface SystemPermissions {
  allowVideo: boolean;
  allowAudit: boolean;
  systemLockout: boolean;
}

