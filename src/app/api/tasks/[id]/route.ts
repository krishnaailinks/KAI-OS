import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { taskUpdateSchema } from '@/lib/validation';
import { checkRateLimit, getClientIp, rateLimitResponse } from '@/lib/security';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const rl = await checkRateLimit(`tasks-patch:${getClientIp(req)}`, 60, 60_000);
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

    // History insert is non-critical: a failure here must not roll back the task update.
    // Errors are logged server-side for ops visibility without surfacing to the user.
    const { error: historyError } = await adminDb.from('task_history').insert([{
      task_id: id,
      agent_id: userId,
      action: historyAction,
      status: data.status,
    }]);
    if (historyError) console.error('[task_history] insert failed for task', id, historyError.message);

    if (data.column_id === 'COMPLETED' && data.budget > 0) {
      const { data: defaultClient } = await adminDb
        .from('clients')
        .select('id')
        .limit(1)
        .maybeSingle();

      const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const { error: invoiceError } = await adminDb.from('invoices').insert([{
        invoice_number: invoiceNumber,
        task_id: id,
        client_id: defaultClient?.id ?? null,
        amount: data.budget,
        status: 'unpaid',
      }]);

      // 23505 = unique_violation: a concurrent request already created the invoice.
      // This is expected under concurrent completion — treat as a no-op.
      if (invoiceError && invoiceError.code !== '23505') throw invoiceError;

      if (!invoiceError) {
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
