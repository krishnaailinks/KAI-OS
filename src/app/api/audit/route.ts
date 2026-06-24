import { NextResponse } from 'next/server';
import { getUserPermissions, HttpError, jsonError, requireDirector, validateBody } from '@/lib/server/auth';
import { auditLogCreateSchema } from '@/lib/validation';
import { parsePagination } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb, userId } = await requireDirector(req);

    // system_lockout is already enforced globally in authenticateRequest().
    const perms = await getUserPermissions(adminDb, userId);
    if (!perms.allow_audit) {
      throw new HttpError(403, 'Audit log access has not been granted for your account.');
    }

    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 50, 200);

    const { data, error, count } = await adminDb
      .from('system_audit_logs')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(from, to);

    if (error) throw error;

    return NextResponse.json({ logs: data, total: count ?? data?.length ?? 0 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    // Only directors may create audit log entries via the API.
    // Internal server-side code uses writeAuditLog() directly.
    const { adminDb, userId } = await requireDirector(req);
    const rawBody = await req.json();
    const validation = validateBody(auditLogCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const validated = validation.data!;
    const { data, error } = await adminDb
      .from('system_audit_logs')
      .insert([{
        event_type: validated.event_type,
        message: validated.message,
        // Always use the authenticated user's ID — never trust client-supplied triggered_by.
        triggered_by: userId,
        severity: validated.severity || 'low',
      }])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: unknown) {
    return jsonError(err);
  }
}
