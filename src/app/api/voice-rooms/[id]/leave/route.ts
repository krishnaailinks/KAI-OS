import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { adminDb, userId } = await authenticateRequest(req);
    const { id } = await params;

    const { error } = await adminDb
      .from('voice_room_participants')
      .update({ left_at: new Date().toISOString() })
      .eq('room_id', id)
      .eq('user_id', userId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
