import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { taskUpdateSchema } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/security';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
    const rl = rateLimit(`tasks-patch:${clientIp}`, 60, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, role, userId } = await authenticateRequest(req);
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const rawBody = await req.json();
    const { action, ...rest } = rawBody;

    const validation = validateBody(taskUpdateSchema, rest);
    if (validation.error) return validation.error;
    const updates = validation.data!;

    // Fetch task first to enforce ownership before mutating
    const { data: existingTask, error: fetchError } = await adminDb
      .from('tasks')
      .select('id, assignee_id, column_id, budget')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!existingTask) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (role === 'client') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    let dbUpdates: Record<string, unknown> = {};
    let historyAction = 'UPDATED';

    if (role === 'employee') {
      dbUpdates = {
        column_id: updates.column_id,
        progress: updates.progress,
        status: 'pending_review',
        pending_updates: updates,
      };
      historyAction = 'PENDING_REVIEW';
    } else {
      dbUpdates = { ...updates };

      if (action === 'approve') {
        historyAction = 'APPROVED';
        dbUpdates.status = 'approved';
        dbUpdates.pending_updates = null;
      } else if (action === 'reject') {
        historyAction = 'REJECTED';
        dbUpdates.status = 'rejected';
        dbUpdates.pending_updates = null;
      }
    }

    const { data, error } = await adminDb
      .from('tasks')
      .update(dbUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    await adminDb.from('task_history').insert([{
      task_id: id,
      agent_id: userId,
      action: historyAction,
      status: data.status,
    }]);

    if (data.column_id === 'COMPLETED' && data.budget > 0) {
      const { data: existingInvoice } = await adminDb
        .from('invoices')
        .select('id')
        .eq('task_id', id)
        .maybeSingle();

      if (!existingInvoice) {
        const { data: defaultClient } = await adminDb
          .from('clients')
          .select('id')
          .limit(1)
          .maybeSingle();

        const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await adminDb.from('invoices').insert([{
          invoice_number: invoiceNumber,
          task_id: id,
          client_id: defaultClient?.id ?? null,
          amount: data.budget,
          status: 'unpaid',
        }]);

        await writeAuditLog(
          adminDb,
          'finance',
          `[FMS] Auto-generated ${invoiceNumber} ($${data.budget}) for task ${id}`,
          userId,
          'medium',
        );
      }
    }

    return NextResponse.json({ task: data });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
