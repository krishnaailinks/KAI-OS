import { z } from "zod";

const isStrongPassword = (password: string) =>
  password.length >= 8
  && /[A-Z]/.test(password)
  && /[0-9]/.test(password)
  && /[^A-Za-z0-9]/.test(password);

export const registerSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  email: z.string().trim().email("Invalid email").max(320),
  password: z.string().refine(isStrongPassword, {
    message: "Password must be at least 8 characters and include uppercase, number, and symbol",
  }),
  accountType: z.enum(["employee", "director"]),
  accessCode: z.string().optional(),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Invalid email"),
  password: z.string().min(1, "Password is required"),
});

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(500),
  description: z.string().trim().max(5000).default(""),
  priority: z.enum(["LOW", "STANDARD", "ELEVATED", "CRITICAL"]).default("STANDARD"),
  progress: z.number().int().min(0).max(100).default(0),
  column_id: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]).default("TODO"),
  project_id: z.string().uuid().optional().nullable(),
  budget: z.number().min(0).max(999999999.99).default(0),
  tool_stack: z.array(z.string().max(100)).default([]),
  status: z.string().optional(),
  task_type: z.enum(["feature", "bug", "task"]).optional(),
  git_branch: z.string().max(500).optional(),
  git_commit: z.string().max(500).optional(),
  git_pr: z.string().max(500).optional(),
  bug_severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  bug_environment: z.enum(["development", "staging", "production"]).optional(),
  bug_steps: z.string().max(5000).optional(),
  bug_expected: z.string().max(2000).optional(),
  bug_actual: z.string().max(2000).optional(),
  logged_hours: z.number().min(0).max(10000).optional(),
});

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(5000).optional(),
  priority: z.enum(["LOW", "STANDARD", "ELEVATED", "CRITICAL"]).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  column_id: z.enum(["TODO", "IN_PROGRESS", "IN_REVIEW", "COMPLETED"]).optional(),
  budget: z.number().min(0).max(999999999.99).optional(),
  status: z.string().optional(),
  tool_stack: z.array(z.string().max(100)).optional(),
  task_type: z.enum(["feature", "bug", "task"]).optional(),
  git_branch: z.string().max(500).optional(),
  git_commit: z.string().max(500).optional(),
  git_pr: z.string().max(500).optional(),
  bug_severity: z.enum(["low", "medium", "high", "critical"]).optional(),
  bug_environment: z.enum(["development", "staging", "production"]).optional(),
  bug_steps: z.string().max(5000).optional(),
  bug_expected: z.string().max(2000).optional(),
  bug_actual: z.string().max(2000).optional(),
  logged_hours: z.number().min(0).max(10000).optional(),
});

export const attendanceActionSchema = z.object({
  action: z.enum(["check_in", "check_out"]),
  tz: z.string().optional(),
});

export const dailyReportSchema = z.object({
  report_text: z.string().trim().min(1, "Report text is required").max(10000),
  tz: z.string().optional(),
});

export const messageSchema = z.object({
  channel_id: z.string().max(100).optional(),
  body: z.string().trim().min(1, "Message body is required").max(4000),
});

export const auditLogCreateSchema = z.object({
  event_type: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  triggered_by: z.string().optional(),
  severity: z.enum(["low", "medium", "high", "critical"]).optional(),
});

export const projectCreateSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(500),
  description: z.string().trim().max(5000).optional(),
  status: z.enum(["Planning", "Active", "On Hold", "Completed"]).default("Planning"),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
});

export const profileUpdateSchema = z.object({
  full_name: z.string().trim().min(1).max(200).optional(),
  job_title: z.string().max(200).optional(),
  salary_amount: z.number().min(0).max(999999999.99).optional(),
  phone_number: z.string().max(50).optional(),
  address: z.string().max(500).optional(),
  avatar_url: z.string().url().max(2000).optional(),
});

export const channelCreateSchema = z.object({
  name: z.string().trim().min(1, 'Channel name is required').max(50),
  type: z.enum(['text', 'announcement']).default('text'),
  description: z.string().trim().max(500).optional(),
});

export const voiceRoomCreateSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(100),
  max_participants: z.number().int().min(2).max(100).default(20),
});
