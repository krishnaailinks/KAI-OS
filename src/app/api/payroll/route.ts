import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector, writeAuditLog, validateBody } from '@/lib/server/auth';
import { checkRateLimit, getClientIp, rateLimitResponse, parsePagination } from '@/lib/security';
import { z } from 'zod';

const payrollExecuteSchema = z.object({
  confirm: z.literal(true, { message: 'You must explicitly confirm payroll execution' }),
  maxTotal: z.number().positive().optional(),
});

export async function GET(req: Request) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 20, 100);

    // Directors see all payroll records; employees and clients see only their own.
    let query = adminDb
      .from('payroll')
      .select('*, profiles(full_name)', { count: 'exact' });

    if (role !== 'director') {
      query = query.eq('user_id', userId);
    }

    const { data: payroll, error, count } = await query.range(from, to);

    if (error) throw error;

    const formattedPayroll = (payroll || []).map(p => ({
      ...p,
      name: p.profiles?.full_name || 'Unknown User',
    }));

    return NextResponse.json({ payroll: formattedPayroll, total: count ?? formattedPayroll.length });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`payroll:${getClientIp(req)}`, 5, 60000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb, userId } = await requireDirector(req);

    const rawBody = await req.json().catch(() => ({}));
    const validation = validateBody(payrollExecuteSchema, rawBody);
    if (validation.error) return validation.error;

    const { data: payroll, error } = await adminDb
      .from('payroll')
      .select('*, profiles(full_name)')
      .in('status', ['Pending', 'Approved']);

    if (error) throw error;

    if (!payroll || payroll.length === 0) {
      return NextResponse.json({ error: 'No pending payroll records to process' }, { status: 400 });
    }

    // Idempotency: check for records already paid in the same month_year values present in this batch.
    const monthYears = [...new Set(payroll.map(r => r.month_year))];
    const { data: alreadyPaid } = await adminDb
      .from('payroll')
      .select('id, month_year')
      .in('month_year', monthYears)
      .eq('status', 'Paid')
      .limit(1);

    if (alreadyPaid && alreadyPaid.length > 0) {
      return NextResponse.json({
        error: `Payroll for ${alreadyPaid[0].month_year} has already been executed. Re-execution blocked to prevent double payment.`,
      }, { status: 409 });
    }

    const totalDisbursed = payroll.reduce(
      (total, row) => total + Number(row.calculated_salary || 0),
      0,
    );

    if (validation.data!.maxTotal && totalDisbursed > validation.data!.maxTotal) {
      return NextResponse.json({
        error: `Total disbursement $${totalDisbursed.toFixed(2)} exceeds max allowed $${validation.data!.maxTotal.toFixed(2)}`,
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const payrollIds = payroll.map(row => row.id);

    // Conditional UPDATE: only touch rows still in Pending/Approved.
    // If a concurrent request already executed payroll, those rows are already
    // 'Paid' and this UPDATE will match 0 rows — detected below.
    const { data: updatedRows, error: updateError } = await adminDb
      .from('payroll')
      .update({ status: 'Paid', updated_at: now })
      .in('id', payrollIds)
      .in('status', ['Pending', 'Approved'])
      .select('id');

    if (updateError) throw updateError;

    if (!updatedRows || updatedRows.length === 0) {
      return NextResponse.json(
        { error: 'Payroll was already executed by a concurrent request. No records updated.' },
        { status: 409 },
      );
    }

    await writeAuditLog(
      adminDb,
      'finance',
      `Payroll cycle executed for ${payrollIds.length} records totaling $${totalDisbursed.toFixed(2)}`,
      userId,
      'high',
    );

    const receiptContent = [
      '# KAI-OS Payroll Execution Receipt',
      '',
      `Executed At: ${now}`,
      `Executed By: ${userId}`,
      `Records Paid: ${payrollIds.length}`,
      `Total Disbursed: $${totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      '',
      '## Personnel',
      ...payroll.map(row => `- ${row.profiles?.full_name || row.user_id}: $${Number(row.calculated_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`),
      '',
    ].join('\n');

    return NextResponse.json({
      paid_count: payrollIds.length,
      total_disbursed: totalDisbursed,
      receipt_content: receiptContent,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
