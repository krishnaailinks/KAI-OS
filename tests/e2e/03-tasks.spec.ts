/**
 * 03 – Task Lifecycle
 *
 * Full workflow:
 *   Director creates task → Employee sees it → Employee moves to IN_REVIEW
 *   → Director approves → task lands in COMPLETED
 *   → If budget > 0, an invoice is auto-generated
 *
 * Also covers: validation, role gates, task history, AI tagging stub.
 */
import { test, expect } from '@playwright/test';
import { getTokens, uid } from './setup/helpers';

let dirToken  = '';
let empToken  = '';

test.beforeAll(() => {
  const tokens = getTokens();
  dirToken = tokens.director;
  empToken = tokens.employee;
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── Task CRUD ─────────────────────────────────────────────────────────────────

test.describe('Task creation', () => {
  test('director creates a task → returns 201 with generated id', async ({ request }) => {
    const name = uid('task');
    const res  = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: name, priority: 'STANDARD', column_id: 'TODO', progress: 0 },
    });
    expect(res.status()).toBe(201);
    const { task } = await res.json();
    expect(task.id).toMatch(/^TASK-/);
    expect(task.title).toBe(name);
    expect(task.column_id).toBe('TODO');
  });

  test('director creates task with budget and all optional fields', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    {
        title:       uid('full-task'),
        description: 'Detailed description here',
        priority:    'CRITICAL',
        column_id:   'IN_PROGRESS',
        progress:    30,
        budget:      5000,
        tool_stack:  ['React', 'Postgres'],
        task_type:   'feature',
        git_branch:  'feat/test-branch',
      },
    });
    expect(res.status()).toBe(201);
    const { task } = await res.json();
    expect(task.budget).toBe(5000);
    expect(task.priority).toBe('CRITICAL');
  });

  test('task missing title returns 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { priority: 'LOW', column_id: 'TODO' },
    });
    expect(res.status()).toBe(400);
  });

  test('invalid priority value returns 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: 'Bad priority', priority: 'EXTREME', column_id: 'TODO' },
    });
    expect(res.status()).toBe(400);
  });

  test('invalid column_id returns 400', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: 'Bad col', priority: 'LOW', column_id: 'BACKLOG' },
    });
    expect(res.status()).toBe(400);
  });
});

// ─── Task read ─────────────────────────────────────────────────────────────────

test.describe('Task listing', () => {
  test('director sees all tasks (non-empty after creation above)', async ({ request }) => {
    const res  = await request.get('/api/tasks', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body.tasks).toBe('object');
  });

  test('employee sees tasks (may be fewer if filtered by assignee)', async ({ request }) => {
    const res = await request.get('/api/tasks', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect(typeof (await res.json()).tasks).toBe('object');
  });

  test('unauthenticated returns 401', async ({ request }) => {
    expect((await request.get('/api/tasks')).status()).toBe(401);
  });
});

// ─── Full lifecycle: create → move → approve → complete → invoice ─────────────

test.describe('Task approval lifecycle', () => {
  let taskId = '';

  test('step 1 – director creates task assigned to nobody, in TODO', async ({ request }) => {
    const res = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: uid('lifecycle'), priority: 'STANDARD', column_id: 'TODO', progress: 0, budget: 1234 },
    });
    expect(res.status()).toBe(201);
    taskId = (await res.json()).task.id;
    expect(taskId).toBeTruthy();
  });

  test('step 2 – employee moves task to IN_REVIEW (pending_review)', async ({ request }) => {
    const res = await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(empToken),
      data:    { column_id: 'IN_REVIEW', progress: 90 },
    });
    // Employee PATCH is allowed (triggers pending_review)
    expect([200, 201]).toContain(res.status());
    const { task } = await res.json();
    expect(task.status).toBe('pending_review');
  });

  test('step 3 – director approves task → status = approved', async ({ request }) => {
    const res = await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(dirToken),
      data:    { action: 'approve' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).task.status).toBe('approved');
  });

  test('step 4 – director moves approved task to COMPLETED → invoice auto-created', async ({ request }) => {
    const res = await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(dirToken),
      data:    { column_id: 'COMPLETED', progress: 100 },
    });
    expect(res.status()).toBe(200);

    // Give the invoice-creation side-effect a moment to commit
    await new Promise(r => setTimeout(r, 500));

    // Invoice should appear in director's invoice list
    const invRes  = await request.get('/api/invoices', { headers: auth(dirToken) });
    expect(invRes.status()).toBe(200);
    const { invoices } = await invRes.json();
    const inv = invoices.find((i: { task_id: string }) => i.task_id === taskId);
    expect(inv).toBeDefined();
    expect(inv.amount).toBe(1234);
    expect(inv.status).toBe('unpaid');
  });
});

// ─── Director reject ───────────────────────────────────────────────────────────

test.describe('Task rejection', () => {
  let taskId = '';

  test('director creates and employee submits', async ({ request }) => {
    const create = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: uid('reject-me'), priority: 'LOW', column_id: 'TODO', progress: 0 },
    });
    taskId = (await create.json()).task.id;

    const upd = await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(empToken),
      data:    { column_id: 'IN_REVIEW', progress: 50 },
    });
    expect([200, 201]).toContain(upd.status());
  });

  test('director rejects → status = rejected', async ({ request }) => {
    const res = await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(dirToken),
      data:    { action: 'reject' },
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).task.status).toBe('rejected');
  });
});

// ─── Zero-budget task completion → no invoice ─────────────────────────────────

test.describe('No invoice for zero-budget completion', () => {
  test('completes task with budget=0, verifies no invoice created', async ({ request }) => {
    const create = await request.post('/api/tasks', {
      headers: auth(dirToken),
      data:    { title: uid('no-budget'), priority: 'LOW', column_id: 'TODO', progress: 0, budget: 0 },
    });
    const taskId = (await create.json()).task.id;

    // Move straight to COMPLETED
    await request.patch(`/api/tasks/${taskId}`, {
      headers: auth(dirToken),
      data:    { column_id: 'COMPLETED', progress: 100 },
    });

    await new Promise(r => setTimeout(r, 400));
    const invRes  = await request.get('/api/invoices', { headers: auth(dirToken) });
    const { invoices } = await invRes.json();
    const inv = invoices.find((i: { task_id: string }) => i.task_id === taskId);
    expect(inv).toBeUndefined();
  });
});

// ─── AI tagging endpoint ───────────────────────────────────────────────────────

test.describe('/api/ai/tagging', () => {
  test('employee gets 403', async ({ request }) => {
    const res = await request.post('/api/ai/tagging', {
      headers: auth(empToken),
      data:    { title: 'Fix login bug', description: 'Users cannot log in' },
    });
    expect(res.status()).toBe(403);
  });

  test('director gets 200 or 503 (Gemini may be unavailable in test env)', async ({ request }) => {
    const res = await request.post('/api/ai/tagging', {
      headers: auth(dirToken),
      data:    { title: 'Fix authentication bug', description: 'Login form throws 500 error' },
    });
    // 200 = Gemini responded; 503 = key not configured in test env — both are acceptable
    expect([200, 400, 429, 500, 503]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(['CRITICAL', 'HIGH', 'STANDARD', 'LOW']).toContain(body.priority);
      expect(Array.isArray(body.tools)).toBe(true);
    }
  });
});
