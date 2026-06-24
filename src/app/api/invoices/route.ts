import { NextResponse } from 'next/server';
import { jsonError, requireDirector } from '@/lib/server/auth';
import { parsePagination } from '@/lib/security';

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireDirector(req);
    const { searchParams } = new URL(req.url);
    const { from, to } = parsePagination(searchParams, 20, 100);

    const { data: invoices, error, count } = await adminDb
      .from('invoices')
      .select(`
        id,
        invoice_number,
        task_id,
        amount,
        status,
        generated_at,
        due_date,
        clients ( company_name, contact_email )
      `, { count: 'exact' })
      .order('generated_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    return NextResponse.json({ invoices, total: count ?? invoices?.length ?? 0 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
