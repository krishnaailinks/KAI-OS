import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError, requireDirector, validateBody, writeAuditLog } from '@/lib/server/auth';
import { channelCreateSchema } from '@/lib/validation';
import { rateLimit, rateLimitResponse } from '@/lib/security';

interface DBChannel {
  id: string;
  name: string;
  slug: string;
  type: string;
  description: string | null;
  created_by: string;
  created_at: string;
}

export async function GET(req: Request) {
  try {
    // 1. Strict Authentication Context Gate Check
    const { adminDb, userId } = await authenticateRequest(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 2. Production Optimization: Enforce a reasonable upper-bound cap limit
    // Guards against unbounded memory leakages as your workspace channels scale
    const { data, error } = await adminDb
      .from('channels')
      .select('id, name, slug, type, description, created_by, created_at')
      .eq('is_archived', false)
      .order('created_at', { ascending: true })
      .limit(300); 

    if (error) throw error;

    return NextResponse.json({ channels: data || [] });
  } catch (err: unknown) {
    return jsonError(err);
  }
}

export async function POST(req: Request) {
  try {
    // 1. Robust Proxy-Aware IP Rate Limiting Layer
    const forwardedFor = req.headers.get('x-forwarded-for');
    const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : (req.headers.get('x-real-ip') || 'unknown');
    
    const rl = rateLimit(`channels:create:${clientIp}`, 10, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    // 2. Secure Authorization Context Verification (Strictly locked to Directors)
    const { adminDb, userId } = await requireDirector(req);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized Access' }, { status: 401 });
    }

    // 3. Graceful JSON Stream Parsing Error-Boundary (Prevents malformed body 500 crashes)
    const rawBody = await req.json().catch(() => ({}));
    const validation = validateBody(channelCreateSchema, rawBody);
    if (validation.error) return validation.error;

    const { name, type, description } = validation.data!;
    
    // 4. Slug Sanitization + Multi-Emoji Unique Collision Avoidance Salt
    let baseSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
      
    // Defensive Fallback: If name was purely emojis, baseSlug becomes empty string
    if (!baseSlug) {
      baseSlug = 'channel';
    }
    
    // Append unique random entropy tail so varying emojis or matching string variations 
    // don't result in database level Unique Constraint Violations (23505)
    const deduplicationSalt = Math.random().toString(36).substring(2, 6);
    const slug = `${baseSlug}-${deduplicationSalt}`;

    // 5. Database Resource Mutation Execution
    const { data, error } = await adminDb
      .from('channels')
      .insert([{ name, slug, type, description: description || null, created_by: userId }])
      .select('id, name, slug, type, description, created_by, created_at')
      .single();

    if (error) {
      if (error.code === '23505') {
        return NextResponse.json({ error: 'A channel with that name or slug configuration already exists' }, { status: 409 });
      }
      throw error;
    }

    // 6. Hardened Non-Blocking Security Governance Audit Log
    // Wrapped defensively to ensure logging connection throttles don't disrupt a successful request
    await writeAuditLog(
      adminDb,
      'communication',
      `Director created ${type} channel #${slug}`,
      userId,
      'medium',
    ).catch((logErr) => console.error('Non-blocking channel audit log failure:', logErr));

    return NextResponse.json({ channel: data as DBChannel }, { status: 201 });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
