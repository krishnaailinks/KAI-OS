import { NextResponse } from 'next/server';
import { jsonError, requireDirector, writeAuditLog, validateBody } from '@/lib/server/auth';
import { z } from 'zod';

const permissionUpdateSchema = z.object({
  allow_video: z.boolean().optional(),
  allow_audit: z.boolean().optional(),
  system_lockout: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { adminDb, userId: directorId } = await requireDirector(req);
    const resolvedParams = await params;
    const userId = resolvedParams.id;

    const rawBody = await req.json();
    const validation = validateBody(permissionUpdateSchema, rawBody);
    if (validation.error) return validation.error;

    const updates = validation.data!;

    const { data, error } = await adminDb
      .from('personnel_permissions')
      .upsert({
        user_id: userId,
        ...updates,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      })
      .select()
      .single();

    if (error) throw error;

    await writeAuditLog(
      adminDb,
      'security',
      `[SECURITY] Director updated permissions for user ${userId}: ${JSON.stringify(updates)}`,
      directorId,
      'medium',
    );

    return NextResponse.json(data);
  } catch (err: unknown) {
    return jsonError(err);
  }
}
