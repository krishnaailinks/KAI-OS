import { NextResponse } from 'next/server';
import { requireDirector, jsonError } from '@/lib/server/auth';

export const dynamic = 'force-dynamic';

// Public health check — minimal info only. Used by load balancers.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  // ?detail=true returns extended metrics for directors; falls through to public response if unauthorized.
  if (searchParams.get('detail') === 'true') {
    try {
      await requireDirector(req);
      const uptime = process.uptime();
      const mem = process.memoryUsage();
      return NextResponse.json({
        status: 'healthy',
        uptime: Math.floor(uptime),
        uptimeFormatted: `${Math.floor(uptime / 86400)}d ${Math.floor((uptime % 86400) / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        memory: {
          heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)} MB`,
          heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)} MB`,
          rss: `${(mem.rss / 1024 / 1024).toFixed(1)} MB`,
        },
        timestamp: new Date().toISOString(),
      });
    } catch {
      // Not authorized — fall through to public-only response below
    }
  }

  return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
}
