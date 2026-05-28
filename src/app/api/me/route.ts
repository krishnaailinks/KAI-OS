import { NextResponse } from 'next/server';
import { authenticateRequest, jsonError } from '@/lib/server/auth';

export async function GET(req: Request) {
  try {
    const { profile } = await authenticateRequest(req);
    return NextResponse.json({ profile });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
