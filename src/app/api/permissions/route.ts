import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { adminDb, role, userId } = await authenticateRequest(req);

    if (role === 'director') {
      const { data, error } = await adminDb
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          role,
          status,
          personnel_permissions (
            allow_video,
            allow_audit,
            system_lockout
          )
        `);

      if (error) throw error;
      return NextResponse.json({ profiles: data });
    }

    const { data, error } = await adminDb
      .from('personnel_permissions')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
      
    if (error) {
      throw error;
    }
    
    return NextResponse.json({ 
      permissions: data || { allow_video: false, allow_audit: false, system_lockout: false }
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
