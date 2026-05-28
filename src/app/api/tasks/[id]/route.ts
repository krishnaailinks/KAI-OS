import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);
    const resolvedParams = await params;
    const id = resolvedParams.id;
    const body = await req.json();
    const { action, ...updates } = body;

    let dbUpdates: Record<string, unknown> = {};
    let historyAction = 'UPDATED';

    if (role === 'employee') {
      dbUpdates = {
        column_id: updates.column_id,
        progress: updates.progress,
        status: 'pending_review',
        pending_updates: updates
      };
      historyAction = 'PENDING_REVIEW';
    } else {
      // Director merges immediately
      dbUpdates = { ...updates };
      
      if (action === 'approve') {
        historyAction = 'APPROVED';
        dbUpdates.status = 'approved';
        dbUpdates.pending_updates = null;
      } else if (action === 'reject') {
        historyAction = 'REJECTED';
        // Revert to old status or just clear pending updates
        dbUpdates.status = 'approved'; // Usually reverts to previous good state
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

    // Log History
    await adminDb.from('task_history').insert([{
      task_id: id,
      agent_id: userId,
      action: historyAction,
      status: data.status
    }]);

    // FMS AUTOMATION INTERCEPTOR
    // If task moved to COMPLETED and has a budget, auto-generate invoice
    if (data.column_id === 'COMPLETED' && data.budget > 0) {
      const { data: existingInvoice } = await adminDb
        .from('invoices')
        .select('id')
        .eq('task_id', id)
        .maybeSingle();
        
      if (!existingInvoice) {
        // Fetch default client for demo purposes
        const { data: defaultClient } = await adminDb
          .from('clients')
          .select('id')
          .limit(1)
          .maybeSingle();
          
        if (defaultClient) {
          const invoiceNumber = `INV-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
          await adminDb.from('invoices').insert([{
            invoice_number: invoiceNumber,
            task_id: id,
            client_id: defaultClient.id,
            amount: data.budget,
            status: 'unpaid'
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
    }

    return NextResponse.json(data);
  } catch (err: unknown) {
    return jsonError(err);
  }
}
