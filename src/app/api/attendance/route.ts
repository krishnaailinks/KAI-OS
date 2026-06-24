import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { attendanceActionSchema } from '@/lib/validation';
import { getLocalDate, isValidDateParam, parsePagination } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);

    if (role === 'client') {
      return NextResponse.json({ error: 'Client accounts do not use attendance tracking' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get('all') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const tz = searchParams.get('tz');

    const today = getLocalDate(tz ?? undefined);

    if (fetchAll && role === 'director') {
      let query = adminDb.from('attendance_logs').select('*', { count: 'exact' });
      
      if (startDate && endDate) {
        if (!isValidDateParam(startDate) || !isValidDateParam(endDate)) {
          return NextResponse.json({ error: 'Invalid date format. Use YYYY-MM-DD.' }, { status: 400 });
        }
        query = query.gte('date', startDate).lte('date', endDate);
      }
      
      const { from, to } = parsePagination(searchParams, 50, 200);
      const { data: allAttendance, error: allErr, count } = await query.order('date', { ascending: false }).range(from, to);
      if (allErr) throw allErr;
      return NextResponse.json({ attendance: allAttendance || [], total: count ?? allAttendance?.length ?? 0 });
    }

    // Default: Get today's attendance for the logged-in user
    const { data: attendance, error } = await adminDb
      .from('attendance_logs')
      .select('*')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ attendance });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);

    if (role === 'client') {
      return NextResponse.json({ error: 'Client accounts do not use attendance tracking' }, { status: 403 });
    }

    const rawBody = await req.json();
    const bodyValidation = validateBody(attendanceActionSchema, rawBody);
    if (bodyValidation.error) return bodyValidation.error;
    const { action, tz } = bodyValidation.data!;
    const today = getLocalDate(tz ?? undefined);
    const now = new Date().toISOString();

    const { data: existing } = await adminDb
      .from('attendance_logs')
      .select('id')
      .eq('user_id', userId)
      .eq('date', today)
      .maybeSingle();

    let result;
    if (existing) {
      if (action === 'check_out') {
        const { data, error } = await adminDb
          .from('attendance_logs')
          .update({ check_out: now })
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        result = data;
        
        await writeAuditLog(adminDb, 'hrms', `User ${userId} clocked out.`, userId, 'low');
      } else {
        return NextResponse.json({ error: "Already checked in today." }, { status: 400 });
      }
    } else {
      if (action === 'check_in') {
        const { data, error } = await adminDb
          .from('attendance_logs')
          .insert([{ user_id: userId, date: today, check_in: now, status: 'present' }])
          .select()
          .single();
        if (error) throw error;
        result = data;

        await writeAuditLog(adminDb, 'hrms', `User ${userId} clocked in.`, userId, 'low');
      } else {
        return NextResponse.json({ error: "Cannot check out before checking in." }, { status: 400 });
      }
    }

    return NextResponse.json({ attendance: result });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
