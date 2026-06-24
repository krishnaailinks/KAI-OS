import { NextResponse } from 'next/server';
import { authenticateRequest, HttpError, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { adminDb, userId, role } = await authenticateRequest(req);
    const { id } = await params;

    const { data: room, error: fetchErr } = await adminDb
      .from('voice_rooms')
      .select('id, name, created_by, is_active')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!room) return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: 'Meeting has already ended' }, { status: 410 });

    if (room.created_by !== userId && role !== 'director') {
      throw new HttpError(403, 'Only the room creator or a director can end this meeting');
    }

    const { error } = await adminDb
      .from('voice_rooms')
      .update({ is_active: false, ended_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;

    await writeAuditLog(
      adminDb,
      'communication',
      `Meeting room "${room.name}" ended`,
      userId,
      'low',
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
