import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, writeAuditLog, validateBody } from '@/lib/server/auth';
import { profileUpdateSchema } from '@/lib/validation';

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);
    const resolvedParams = await params;
    const id = resolvedParams.id;

    if (role !== 'director' && id !== userId) {
      return NextResponse.json({ error: 'You can only update your own profile' }, { status: 403 });
    }

    const rawBody = await req.json();
    const validation = validateBody(profileUpdateSchema, rawBody);
    if (validation.error) return validation.error;

    const updates: Record<string, unknown> = { ...validation.data!, updated_at: new Date().toISOString() };

    if (role !== 'director') {
      delete updates.salary_amount;
      delete updates.job_title;
      delete updates.role;
    }

    const { data: existing } = await adminDb.from('employee_profiles').select('id').eq('user_id', id).maybeSingle();

    let result;
    if (existing) {
      const { data, error } = await adminDb
        .from('employee_profiles')
        .update(updates)
        .eq('user_id', id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await adminDb
        .from('employee_profiles')
        .insert([{ user_id: id, ...updates }])
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    await writeAuditLog(adminDb, 'hrms', `Employee profile updated for ${id}`, userId, 'low');

    return NextResponse.json({ profile: result });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
