import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const fetchAll = searchParams.get('all') === 'true';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    const today = new Date().toISOString().split('T')[0];

    if (fetchAll && role === 'director') {
      let query = adminDb.from('attendance_logs').select('*');
      
      if (startDate && endDate) {
        query = query.gte('date', startDate).lte('date', endDate);
      }
      
      const { data: allAttendance, error: allErr } = await query.order('date', { ascending: false });
      if (allErr) throw allErr;
      return NextResponse.json({ attendance: allAttendance || [] });
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
    const { adminDb, userId } = await authenticateRequest(req);

    const { action } = await req.json(); // 'check_in' or 'check_out'
    const today = new Date().toISOString().split('T')[0];
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
