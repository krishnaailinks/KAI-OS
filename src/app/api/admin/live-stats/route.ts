import { NextResponse } from 'next/server';
import { jsonError, requireDirector } from '@/lib/server/auth';
import { checkRateLimit, getClientIp, getLocalDate, rateLimitResponse } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const rl = await checkRateLimit(`live-stats:${getClientIp(req)}`, 30, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    const { adminDb } = await requireDirector(req);
    const { searchParams } = new URL(req.url);
    const tz = searchParams.get('tz');

    const today = getLocalDate(tz ?? undefined);
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

    return NextResponse.json({ stats }, {
      headers: {
        // Cache at CDN/reverse proxy for 30 seconds to reduce DB load on frequent dashboard polls.
        'Cache-Control': 'private, max-age=30',
      },
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
