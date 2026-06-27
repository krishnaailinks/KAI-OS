import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { dailyReportSchema } from '@/lib/validation';
import { getLocalDate, isValidDateParam, parsePagination } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);

    if (role === 'client') {
      return NextResponse.json({ error: 'Client accounts do not submit daily reports' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get('all') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tz = searchParams.get('tz');
    const { from, to } = parsePagination(searchParams, 50, 200);

    let query = adminDb.from('daily_reports').select('*', { count: 'exact' });
    
    if (fetchAll) {
      if (role !== 'director') {
        return NextResponse.json({ error: 'Director clearance required' }, { status: 403 });
      }
      if (startDate && endDate) {
        if (!isValidDateParam(startDate) || !isValidDateParam(endDate)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
        }
        query = query.gte('date', startDate).lte('date', endDate);
      }
    } else {
      const today = getLocalDate(tz ?? undefined);
      query = query.eq('user_id', userId).eq('date', today);
    }

    const { data: reports, error, count } = await query.order('date', { ascending: false }).range(from, to);

    if (error) throw error;

    if (fetchAll) {
      return NextResponse.json({ reports: reports || [], total: count ?? reports?.length ?? 0 });
    }
    return NextResponse.json({ report: reports?.[0] ?? null });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);

    if (role === 'client') {
      return NextResponse.json({ error: 'Client accounts do not submit daily reports' }, { status: 403 });
    }

    const rawBody = await req.json();
    const validation = validateBody(dailyReportSchema, rawBody);
    if (validation.error) return validation.error;
    const { report_text, tz } = validation.data!;

    const today = getLocalDate(tz ?? undefined);

    const { data: existing } = await adminDb
      .from('daily_reports')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await adminDb
        .from('daily_reports')
        .update({ report_text, updated_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await adminDb
        .from('daily_reports')
        .insert([{ user_id: userId, date: today, report_text }])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    await writeAuditLog(adminDb, 'hrms', `User ${userId} submitted a daily work report.`, userId, 'low');

    return NextResponse.json({ report: result });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
