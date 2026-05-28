import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector, writeAuditLog } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await authenticateRequest(req);
    const { data: projects, error } = await adminDb
      .from('projects')
      .select('*, tasks(count)');

    if (error) {
      throw error;
    }

    return NextResponse.json({ projects });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId } = await requireDirector(req);
    const body = await req.json();
    
    const { data, error } = await adminDb
      .from('projects')
      .insert([{ ...body, created_by: userId }])
      .select()
      .single();

    if (error) {
      throw error;
    }

    await writeAuditLog(adminDb, 'project', `Project ${data.id} created`, userId, 'low');

    return NextResponse.json({ project: data });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
