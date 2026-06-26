import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';
import { parsePagination, rateLimit, rateLimitResponse } from '@/lib/security';

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
    // 1. Robust Proxy-Aware IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    // Protect administrative/personnel lookups from burst scraping or script spam
    const rl = rateLimit(`permissions:get:${clientIp}`, 30, 60_000); 
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Strict Authentication Context Gate Check
    const { adminDb, role, userId } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 3. Director Path: Access Paginated Personnel Directory
    if (role === 'director') {
      const { searchParams } = new URL(req.url);
      const { from, to } = parsePagination(searchParams, 50, 200);
      
      // PRODUCTION OPTIMIZATION: Switched to 'planned' count estimation block. 
      // This forces PostgreSQL to instantly read internal table statistics metadata
      // instead of executing a sequential table scan on every page load.
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
        `, { count: 'planned' })
        .range(from, to) as { data: ProfileWithPermissions[] | null; error: unknown; count: number | null };

      if (error) throw error;
      
      return NextResponse.json({ 
        profiles: data || [], 
        total: count ?? data?.length ?? 0 
      });
    }

    // 4. Employee/Client Path: Restricted Non-Director Self-Lookup Matrix
    // Explicit projection ensures we only retrieve minimal targeted column parameters over the wire
    const { data, error } = await adminDb
      .from('personnel_permissions')
      .select('user_id, allow_video, allow_audit, system_lockout')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) throw error;

    // Return current user state or standard secure fallback permissions object
    return NextResponse.json({
      permissions: (data as PermissionRow | null) || { 
        user_id: userId,
        allow_video: false, 
        allow_audit: false, 
        system_lockout: false 
      }
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
