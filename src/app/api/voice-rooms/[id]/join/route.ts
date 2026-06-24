import { NextResponse } from 'next/server';
import { authenticateRequest, getUserPermissions, HttpError, jsonError, writeAuditLog } from '@/lib/server/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { adminDb, userId, role, profile } = await authenticateRequest(req);

    // allow_video gates meeting join (directors always allowed)
    if (role !== 'director') {
      const perms = await getUserPermissions(adminDb, userId);
      if (!perms.allow_video) {
        throw new HttpError(403, 'Video meeting access has not been granted for your account.');
      }
    }

    const { id } = await params;

    const { data: room, error: fetchErr } = await adminDb
      .from('voice_rooms')
      .select('id, name, room_code, is_active, max_participants')
      .eq('id', id)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!room) return NextResponse.json({ error: 'Meeting room not found' }, { status: 404 });
    if (!room.is_active) return NextResponse.json({ error: 'This meeting has already ended' }, { status: 410 });

    // Check capacity
    const { count } = await adminDb
      .from('voice_room_participants')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', id)
      .is('left_at', null);

    if ((count ?? 0) >= room.max_participants) {
      return NextResponse.json({ error: 'Meeting room is full' }, { status: 409 });
    }

    // Upsert: handles the re-join case (left_at already set from a previous session)
    const { error } = await adminDb
      .from('voice_room_participants')
      .upsert(
        [{
          room_id: id,
          user_id: userId,
          display_name: profile.full_name || profile.email,
          joined_at: new Date().toISOString(),
          left_at: null,
        }],
        { onConflict: 'room_id,user_id' },
      );

    if (error) throw error;

    await writeAuditLog(
      adminDb,
      'communication',
      `${profile.full_name || userId} joined meeting "${room.name}"`,
      userId,
      'low',
    );

    return NextResponse.json({ room_code: room.room_code, room_name: room.name, room_id: id });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
