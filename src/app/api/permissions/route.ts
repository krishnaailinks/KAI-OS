import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';
import { parsePagination } from '@/lib/security';

interface PermissionRow {
  user_id: string;
  allow_video: boolean;
  allow_audit: boolean;
  system_lockout: boolean;
}

interface ProfileWithPermissions {
  id: string;
  full_name: string | null;
  email: string;
  role: string;
  status: string | null;
  personnel_permissions: PermissionRow | null;
}

export async function GET(req: Request) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);
    const { searchParams } = new URL(req.url);

    if (role === 'director') {
      const { from, to } = parsePagination(searchParams, 50, 200);
      const { data, error, count } = await adminDb
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          status,
          personnel_permissions (
            user_id,
            allow_video,
            allow_audit,
            system_lockout
          )
        `, { count: 'exact' })
        .range(from, to) as { data: ProfileWithPermissions[] | null; error: unknown; count: number | null };

      if (error) throw error;
      return NextResponse.json({ profiles: data, total: count ?? data?.length ?? 0 });
    }

    const { data, error } = await adminDb
      .from('personnel_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({
      permissions: (data as PermissionRow | null) || { allow_video: false, allow_audit: false, system_lockout: false }
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
