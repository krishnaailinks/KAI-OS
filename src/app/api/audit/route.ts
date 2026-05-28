import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireDirector(req);

    const { data, error } = await adminDb
      .from('system_audit_logs')
      .select('*')
      .order('timestamp', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ logs: data });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId } = await authenticateRequest(req);
    const body = await req.json();
    const { event_type, message, triggered_by } = body;
    
    const { data, error } = await adminDb
      .from('system_audit_logs')
      .insert([{ event_type, message, triggered_by: triggered_by || userId }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    return jsonError(err);
  }
}
