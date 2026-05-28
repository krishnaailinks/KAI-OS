import { NextResponse } from 'next/server';
import { jsonError, requireDirector, writeAuditLog } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireDirector(req);
    const { data: payroll, error } = await adminDb
      .from('payroll')
      .select('*, profiles(full_name)');

    if (error) throw error;

    const formattedPayroll = payroll.map(p => ({
      ...p,
      name: p.profiles?.full_name || 'Unknown User'
    }));

    return NextResponse.json({ payroll: formattedPayroll });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId } = await requireDirector(req);
    const { data: payroll, error } = await adminDb
      .from('payroll')
      .select('*, profiles(full_name)')
      .in('status', ['Pending', 'Approved']);

    if (error) throw error;

    const now = new Date().toISOString();
    const payrollIds = (payroll || []).map(row => row.id);

    if (payrollIds.length > 0) {
      const { error: updateError } = await adminDb
        .from('payroll')
        .update({ status: 'Paid', updated_at: now })
        .in('id', payrollIds);

      if (updateError) throw updateError;
    }

    const totalDisbursed = (payroll || []).reduce(
      (total, row) => total + Number(row.calculated_salary || 0),
      0,
    );

    await writeAuditLog(adminDb, 'finance', `Payroll cycle executed for ${payrollIds.length} records.`, userId, 'high');

    const receiptContent = [
      '# KAI-OS Payroll Execution Receipt',
      '',
      `Executed At: ${now}`,
      `Executed By: ${userId}`,
      `Records Paid: ${payrollIds.length}`,
      `Total Disbursed: $${totalDisbursed.toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
      '',
      '## Personnel',
      ...(payroll || []).map(row => `- ${row.profiles?.full_name || row.user_id}: $${Number(row.calculated_salary || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`),
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
