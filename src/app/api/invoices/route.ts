import { NextResponse } from 'next/server';
import { jsonError, requireDirector } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb } = await requireDirector(req);

    const { data: invoices, error } = await adminDb
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
      `)
      .order('generated_at', { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({ invoices });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
