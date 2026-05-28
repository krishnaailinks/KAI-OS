import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);

    const { data: profiles, error } = await adminDb
      .from('employee_profiles')
      .select('*')
      .order('full_name', { ascending: true });

    if (error) {
      throw error;
    }

    return NextResponse.json({ profiles });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
