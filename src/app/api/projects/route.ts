import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector, writeAuditLog, validateBody } from '@/lib/server/auth';
import { projectCreateSchema } from '@/lib/validation';
import { parsePagination } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb, role } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 20, 100);

    // Clients only see active projects (no internal/completed project details).
    let query = adminDb
      .from('projects')
      .select('*, tasks(count)', { count: 'exact' });

    if (role === 'client') {
      query = query.eq('status', 'Active').select('id, name, description, status, start_date, end_date, created_at');
    }

    const { data: projects, error, count } = await query.range(from, to);

    if (error) throw error;

    return NextResponse.json({ projects, total: count ?? projects?.length ?? 0 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    const { adminDb, userId } = await requireDirector(req);
    const rawBody = await req.json();
    const validation = validateBody(projectCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const validated = validation.data!;
    const { data, error } = await adminDb
      .from('projects')
      .insert([{
        name: validated.name,
        description: validated.description,
        status: validated.status,
        start_date: validated.start_date,
        end_date: validated.end_date,
        created_by: userId,
      }])
      .select()
      .single();

    if (error) throw error;

    await writeAuditLog(adminDb, 'project', `Project ${data.id} created`, userId, 'low');

    return NextResponse.json({ project: data });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
