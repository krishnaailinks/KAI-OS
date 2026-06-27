import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { checkRateLimit, getClientIp, rateLimitResponse, parsePagination } from '@/lib/security';
import { taskCreateSchema } from '@/lib/validation';

export async function GET(req: Request) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 100, 500);

    let query = adminDb
      .from('tasks')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // Clients can only see tasks assigned to them.
    if (role === 'client') {
      query = query.eq('assignee_id', userId);
    }

    const { data, error, count } = await query.range(from, to);

    if (error) throw error;

    const tasksRecord: Record<string, unknown> = {};
    if (data && data.length > 0) {
      data.forEach(task => {
        tasksRecord[task.id] = task;
      });
      return NextResponse.json({ tasks: tasksRecord, total: count ?? data.length });
    }

    return NextResponse.json({ tasks: {}, total: 0 });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`tasks:${getClientIp(req)}`, 30, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, userId, role } = await authenticateRequest(req);
    if (role !== 'director') {
      return NextResponse.json({ error: 'Director clearance required' }, { status: 403 });
    }

    const rawBody = await req.json();
    const validation = validateBody(taskCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const validated = validation.data!;
    const taskId = `TASK-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const { data, error } = await adminDb
      .from('tasks')
      .insert([{
        id: taskId,
        title: validated.title,
        description: validated.description,
        priority: validated.priority,
        progress: validated.progress,
        column_id: validated.column_id,
        budget: validated.budget,
        tool_stack: validated.tool_stack,
        status: 'approved',
        ...(validated.project_id ? { project_id: validated.project_id } : {}),
        ...(validated.task_type ? { task_type: validated.task_type } : {}),
        ...(validated.git_branch ? { git_branch: validated.git_branch } : {}),
        ...(validated.git_commit ? { git_commit: validated.git_commit } : {}),
        ...(validated.git_pr ? { git_pr: validated.git_pr } : {}),
        ...(validated.bug_severity ? { bug_severity: validated.bug_severity } : {}),
        ...(validated.bug_environment ? { bug_environment: validated.bug_environment } : {}),
        ...(validated.bug_steps ? { bug_steps: validated.bug_steps } : {}),
        ...(validated.bug_expected ? { bug_expected: validated.bug_expected } : {}),
        ...(validated.bug_actual ? { bug_actual: validated.bug_actual } : {}),
        ...(validated.logged_hours !== undefined ? { logged_hours: validated.logged_hours } : {}),
      }])
      .select()
      .single();

    if (error) throw error;

    await adminDb.from('task_history').insert([{
      task_id: data.id,
      agent_id: userId,
      action: 'CREATED',
      status: data.status,
    }]);

    await writeAuditLog(adminDb, 'task', `Task ${data.id} created`, userId, 'low');

    return NextResponse.json({ task: data }, { status: 201 });
  } catch (err) {
    return jsonError(err);
  }
}
