import { NextResponse } from 'next/server';
import { jsonError, requireDirector } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireDirector(req);

    const today = new Date().toISOString().split('T')[0];
    const [
      profilesResult,
      activeProjectsResult,
      completedTasksResult,
      invoicesResult,
      payrollResult,
      securityResult,
    ] = await Promise.all([
      adminDb.from('profiles').select('id', { count: 'exact', head: true }),
      adminDb.from('projects').select('id', { count: 'exact', head: true }).eq('status', 'Active'),
      adminDb.from('tasks').select('id', { count: 'exact', head: true }).eq('column_id', 'COMPLETED').gte('updated_at', `${today}T00:00:00.000Z`),
      adminDb.from('invoices').select('amount,status').neq('status', 'paid'),
      adminDb.from('payroll').select('calculated_salary,status').neq('status', 'Paid'),
      adminDb.from('system_audit_logs').select('id', { count: 'exact', head: true }).in('severity', ['high', 'critical']),
    ]);

    const openInvoices = (invoicesResult.data || []).reduce(
      (total, invoice) => total + Number(invoice.amount || 0),
      0,
    );

    const totalPayroll = (payrollResult.data || []).reduce(
      (total, row) => total + Number(row.calculated_salary || 0),
      0,
    );

    const stats = {
      totalEmployees: profilesResult.count || 0,
      activeProjects: activeProjectsResult.count || 0,
      tasksCompletedToday: completedTasksResult.count || 0,
      openInvoices,
      totalPayroll,
      serverStatus: 'Healthy',
      securityIncidents: securityResult.count || 0
    };

    return NextResponse.json({ stats });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
