import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get('all') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    let query = adminDb.from('daily_reports').select('*');
    
    if (fetchAll && role === 'director') {
      if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate);
      }
    } else {
      const today = new Date().toISOString().split('T')[0];
      query = query.eq('user_id', userId).eq('date', today);
    }

    const { data: reports, error } = await query.order('date', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ reports: reports || [] });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId } = await authenticateRequest(req);

    const { report_text } = await req.json();
    if (!report_text) return NextResponse.json({ error: "Report text is required" }, { status: 400 });

    const today = new Date().toISOString().split('T')[0];

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
