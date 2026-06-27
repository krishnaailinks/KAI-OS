/**
 * 04 – Channels & Messages
 *
 * Covers: list channels, create text/announcement channels, slug generation,
 * send message, announcement-only enforcement, archive/delete channel,
 * message length validation, non-existent channel handling.
 */
import { test, expect } from '@playwright/test';
import { getTokens, uid } from './setup/helpers';

let dirToken = '';
let empToken = '';

test.beforeAll(() => {
  const tokens = getTokens();
  dirToken = tokens.director;
  empToken = tokens.employee;
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── Channel listing ───────────────────────────────────────────────────────────

test.describe('GET /api/channels', () => {
  test('returns array with at least the seeded default channels', async ({ request }) => {
    const res  = await request.get('/api/channels', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    const { channels } = await res.json();
    expect(Array.isArray(channels)).toBe(true);
    const slugs = channels.map((c: { slug: string }) => c.slug);
    expect(slugs).toContain('general');
    expect(slugs).toContain('alerts');
  });

  test('all returned channels have is_archived = false', async ({ request }) => {
    const { channels } = await (await request.get('/api/channels', { headers: auth(empToken) })).json();
    channels.forEach((ch: { is_archived: boolean }) => expect(ch.is_archived).toBe(false));
  });
});

// ─── Channel creation ──────────────────────────────────────────────────────────

test.describe('POST /api/channels', () => {
  test('director creates a text channel and slug is auto-generated', async ({ request }) => {
    const name = uid('Chan');        // uid may have uppercase — API lowercases it
    const res  = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name, type: 'text', description: 'Auto-slug test' },
    });
    expect(res.status()).toBe(201);
    const { channel } = await res.json();
    expect(channel.slug).toMatch(/^[a-z0-9][a-z0-9_-]*$/);
    expect(channel.type).toBe('text');
  });

  test('director creates an announcement channel', async ({ request }) => {
    const res = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name: uid('Announce'), type: 'announcement' },
    });
    expect(res.status()).toBe(201);
    expect((await res.json()).channel.type).toBe('announcement');
  });

  test('employee cannot create a channel (403)', async ({ request }) => {
    expect((await request.post('/api/channels', {
      headers: auth(empToken),
      data:    { name: uid('emp-chan'), type: 'text' },
    })).status()).toBe(403);
  });

  test('duplicate slug returns 409 or 400', async ({ request }) => {
    // Create once
    await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name: 'dup-slug-test', type: 'text' },
    });
    // Create again with same effective slug
    const res = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name: 'dup slug test', type: 'text' },
    });
    expect([400, 409]).toContain(res.status());
  });
});

// ─── Archive / delete channel ──────────────────────────────────────────────────

test.describe('DELETE /api/channels/[id]', () => {
  test('director archives a channel (soft delete)', async ({ request }) => {
    const create = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name: uid('archive-me'), type: 'text' },
    });
    const { channel } = await create.json();

    const del = await request.delete(`/api/channels/${channel.id}`, { headers: auth(dirToken) });
    expect([200, 204]).toContain(del.status());

    // Channel should no longer appear in the list
    const list = await request.get('/api/channels', { headers: auth(empToken) });
    const { channels } = await list.json();
    expect(channels.find((c: { id: string }) => c.id === channel.id)).toBeUndefined();
  });

  test('employee cannot archive a channel (403)', async ({ request }) => {
    const create = await request.post('/api/channels', {
      headers: auth(dirToken),
      data:    { name: uid('emp-cant-del'), type: 'text' },
    });
    const { channel } = await create.json();
    const res = await request.delete(`/api/channels/${channel.id}`, { headers: auth(empToken) });
    expect(res.status()).toBe(403);
  });

  test('cannot archive the "general" channel', async ({ request }) => {
    // First find general channel id
    const { channels } = await (await request.get('/api/channels', { headers: auth(dirToken) })).json();
    const general = channels.find((c: { slug: string }) => c.slug === 'general');
    if (!general) { test.skip(true, 'general channel not found'); return; }

    const res = await request.delete(`/api/channels/${general.id}`, { headers: auth(dirToken) });
    expect([400, 403, 409]).toContain(res.status());
  });
});

// ─── Message posting ───────────────────────────────────────────────────────────

test.describe('POST /api/messages', () => {
  test('employee posts to text channel (general) → 201', async ({ request }) => {
    const body = uid('msg');
    const res  = await request.post('/api/messages', {
      headers: auth(empToken),
      data:    { channel_id: 'general', body },
    });
    expect(res.status()).toBe(201);
    const { message } = await res.json();
    expect(message.body).toBe(body);
    expect(message.channel_id).toBe('general');
  });

  test('director posts to text channel → 201', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(dirToken),
      data:    { channel_id: 'general', body: uid('dir-msg') },
    });
    expect(res.status()).toBe(201);
  });

  test('employee cannot post to announcement channel (403)', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(empToken),
      data:    { channel_id: 'alerts', body: 'Employee alert attempt' },
    });
    // 403 = forbidden by role; 423 = system_lockout test runs in parallel
    expect([403, 423]).toContain(res.status());
  });

  test('director can post to announcement channel', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(dirToken),
      data:    { channel_id: 'alerts', body: uid('dir-alert') },
    });
    expect(res.status()).toBe(201);
  });

  test('empty body returns 400', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(dirToken),
      data:    { channel_id: 'general', body: '' },
    });
    expect(res.status()).toBe(400);
  });

  test('body exceeding 4000 chars returns 400', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(empToken),
      data:    { channel_id: 'general', body: 'x'.repeat(4001) },
    });
    expect(res.status()).toBe(400);
  });

  test('non-existent channel returns 404', async ({ request }) => {
    const res = await request.post('/api/messages', {
      headers: auth(empToken),
      data:    { channel_id: 'absolutely-does-not-exist', body: 'hello' },
    });
    expect(res.status()).toBe(404);
  });
});

// ─── Message retrieval ─────────────────────────────────────────────────────────

test.describe('GET /api/messages', () => {
  test('returns messages from general channel (ordered ascending)', async ({ request }) => {
    // Use dirToken — system_lockout test (02-api-contracts:427) runs in parallel and can lock empToken
    const res  = await request.get('/api/messages?channel=general', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { messages } = await res.json();
    expect(Array.isArray(messages)).toBe(true);

    // Messages should be sorted by created_at ascending
    if (messages.length >= 2) {
      const times = messages.map((m: { created_at: string }) => new Date(m.created_at).getTime());
      for (let i = 1; i < times.length; i++) {
        expect(times[i]).toBeGreaterThanOrEqual(times[i - 1]);
      }
    }
  });

  test('returns at most 100 messages', async ({ request }) => {
    // Use dirToken — system_lockout test (02-api-contracts:427) runs in parallel and can lock empToken
    const { messages } = await (
      await request.get('/api/messages?channel=general', { headers: auth(dirToken) })
    ).json();
    expect(messages.length).toBeLessThanOrEqual(100);
  });

  test('message sent earlier appears in GET response', async ({ request }) => {
    const body = uid('verify-read');
    await request.post('/api/messages', {
      headers: auth(dirToken),
      data:    { channel_id: 'general', body },
    });
    // Use dirToken so system_lockout parallel test (02-api-contracts:427) cannot race here
    const { messages } = await (
      await request.get('/api/messages?channel=general', { headers: auth(dirToken) })
    ).json();
    expect(messages.some((m: { body: string }) => m.body === body)).toBe(true);
  });

  test('non-existent channel returns 404', async ({ request }) => {
    // Use dirToken — directors are never system_locked by parallel tests
    expect((await request.get('/api/messages?channel=no-such-chan', { headers: auth(dirToken) })).status()).toBe(404);
  });

  test('invalid slug characters return 401 or 400 (auth first, then validation)', async ({ request }) => {
    expect([400, 401]).toContain(
      (await request.get('/api/messages?channel=INVALID%20SLUG!')).status()
    );
  });
});
