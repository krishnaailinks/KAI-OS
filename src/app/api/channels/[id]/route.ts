import { NextResponse } from 'next/server';
import { jsonError, requireDirector, writeAuditLog } from '@/lib/server/auth';

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { adminDb, userId } = await requireDirector(req);
    const { id } = await params;

    const { data: channel, error: fetchErr } = await adminDb
      .from('channels')
      .select('id, slug, name')
      .eq('id', id)
      .eq('is_archived', false)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!channel) return NextResponse.json({ error: 'Channel not found' }, { status: 404 });
    if (channel.slug === 'general') {
      return NextResponse.json({ error: 'The general channel cannot be deleted' }, { status: 400 });
    }

    // Soft-delete so message history is preserved
    const { error } = await adminDb
      .from('channels')
      .update({ is_archived: true })
      .eq('id', id);

    if (error) throw error;

    await writeAuditLog(
      adminDb,
      'communication',
      `Director archived channel #${channel.slug}`,
      userId,
      'medium',
    );

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
