import { NextResponse } from 'next/server';
import { requireDirector, jsonError } from '@/lib/server/auth';
import { getServiceSupabase } from '@/lib/server/supabase';
import { checkRateLimit, getClientIp, isValidDateParam, rateLimitResponse } from '@/lib/security';

const MAX_LOG_CHARS = 800_000;
const DB_FETCH_LIMIT = 50_000;
const GEMINI_MODEL = 'gemini-2.0-flash';

export async function POST(req: Request) {
  try {
    const rl = await checkRateLimit(`audit-report:${getClientIp(req)}`, 5, 60_000);
    if (!rl.allowed) return rateLimitResponse(rl.resetAt);

    await requireDirector(req);
    const { startDate, endDate } = await req.json().catch(() => ({}));

    if (startDate && !isValidDateParam(startDate)) {
      return NextResponse.json({ error: 'Invalid startDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }
    if (endDate && !isValidDateParam(endDate)) {
      return NextResponse.json({ error: 'Invalid endDate format. Use YYYY-MM-DD.' }, { status: 400 });
    }

    const adminDb = getServiceSupabase();

    let countQuery = adminDb
      .from('system_audit_logs')
      .select('*', { count: 'exact', head: true });

    if (startDate) countQuery = countQuery.gte('timestamp', startDate);
    if (endDate) countQuery = countQuery.lte('timestamp', endDate);

    const { count: totalLogs, error: countError } = await countQuery;
    if (countError) throw countError;

    let query = adminDb
      .from('system_audit_logs')
      .select('timestamp, event_type, severity, triggered_by, message')
      .order('timestamp', { ascending: false });

    if (startDate) query = query.gte('timestamp', startDate);
    if (endDate) query = query.lte('timestamp', endDate);

    const { data: logs, error } = await query.limit(DB_FETCH_LIMIT);
    if (error) throw error;

    const googleKey = process.env.GEMINI_API_KEY;
    if (!googleKey) {
      return NextResponse.json(
        {
          error: 'Gemini API key not configured',
          hint: 'GEMINI_API_KEY is missing on the production environment.',
        },
        { status: 503 }
      );
    }

    // Redact PII (email addresses) before sending to third-party AI.
    const redactEmail = (text: string) =>
      text.replace(/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[REDACTED_EMAIL]');

    const logLines = (logs || []).map(l =>
      `[${l.timestamp}] TYPE:${l.event_type} SEVERITY:${l.severity} USER:${redactEmail(l.triggered_by || '')} MSG:${redactEmail(l.message || '')}`
    );

    let truncated = false;
    let chars = 0;
    let sliceIndex = logLines.length;
    for (let i = 0; i < logLines.length; i++) {
      chars += logLines[i].length + 1;
      if (chars > MAX_LOG_CHARS) {
        sliceIndex = i;
        truncated = true;
        break;
      }
    }

    const logSummary = logLines.slice(0, sliceIndex).join('\n');
    const fedCount = sliceIndex;

    const systemPrompt = `You are a professional CA (Chartered Accountant) audit report generator for Krishna AI Links Pvt. Ltd. Generate a detailed, well-structured, professional audit report in MARKDOWN format based on the following system audit logs.

Report must include:
1. **Executive Summary** — overview of all activities in the period
2. **User Activity Analysis** — breakdown by user roles and actions
3. **Security Events** — any security-related events (failed logins, permission changes)
4. **Financial Transactions** — payroll, invoice related activities
5. **System Changes** — task/project creation, updates, deletions
6. **Timeline of Key Events** — chronological list of important events
7. **Risk Assessment** — LOW / MEDIUM / HIGH / CRITICAL risks identified
8. **Recommendations** — actionable recommendations for compliance
9. **Statistics** — total events, unique users, event types breakdown

Format as a professional audit report suitable for CA review. Use tables where appropriate. Be objective and data-driven.`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${googleKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `${systemPrompt}\n\nAUDIT LOGS (${totalLogs ?? 0} total, ${fedCount} included):\n${logSummary}\n\nGenerate the professional audit report in markdown:`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`[Gemini Error] HTTP ${response.status}:`, text);
      return NextResponse.json(
        { 
          error: `AI Service Unavailable (HTTP ${response.status})`,
          hint: 'The upstream AI provider is currently failing. Please try again later.'
        },
        { status: 502 }
      );
    }

    const aiResult = await response.json();
    const report = aiResult?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!report) {
      return NextResponse.json(
        { error: "AI returned empty response. Check Gemini API key and quota." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      report,
      logsCount: logs?.length || 0,
      totalLogs: totalLogs ?? 0,
      truncated,
      note: truncated
        ? `Report based on ${fedCount} of ${totalLogs} log entries (${(totalLogs ?? 0) - fedCount} excluded due to context window limits). Narrow the date range for full coverage.`
        : undefined,
    });
  } catch (err: unknown) {
    return jsonError(err);
  }
}
