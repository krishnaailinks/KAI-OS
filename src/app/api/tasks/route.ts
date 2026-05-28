import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);

    const { data, error } = await adminDb
      .from('tasks')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    const tasksRecord: Record<string, unknown> = {};
    if (data && data.length > 0) {
      data.forEach(task => {
        tasksRecord[task.id] = task;
      });
      return NextResponse.json({ tasks: tasksRecord });
    }

    // Fallback if empty
    return NextResponse.json({ tasks: {} });
  } catch (err) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);
    if (role !== 'director') {
      return NextResponse.json({ error: 'Director clearance required' }, { status: 403 });
    }

    const body = await req.json();
    
    const { data, error } = await adminDb
      .from('tasks')
      .insert([body])
      .select()
      .single();

    if (error) {
      throw error;
    }

    await adminDb.from('task_history').insert([{
      task_id: data.id,
      agent_id: userId,
      action: 'CREATED',
      status: data.status
    }]);

    await writeAuditLog(adminDb, 'task', `Task ${data.id} created`, userId, 'low');

    return NextResponse.json(data);
  } catch (err) {
    return jsonError(err);
  }
}
