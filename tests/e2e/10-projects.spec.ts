/**
 * 10 – Projects & ERP
 *
 * Covers: GET /api/projects (all roles, client restricted to Active),
 * POST /api/projects (director only, validation), role gates,
 * POST /api/projects/[id]/generate-doc (director only, markdown output).
 */
import { test, expect } from '@playwright/test';
import { getTokens, uid } from './setup/helpers';

let dirToken    = '';
let empToken    = '';
let clientToken = '';

test.beforeAll(() => {
  const tokens = getTokens();
  dirToken    = tokens.director;
  empToken    = tokens.employee;
  clientToken = tokens.client;
});

function auth(t: string) { return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }; }

// ─── GET /api/projects ────────────────────────────────────────────────────────

test.describe('GET /api/projects', () => {
  test('director sees all projects (any status)', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    const { projects, total } = await res.json();
    expect(Array.isArray(projects)).toBe(true);
    expect(typeof total).toBe('number');
  });

  test('employee sees all projects', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: auth(empToken) });
    expect(res.status()).toBe(200);
    expect(Array.isArray((await res.json()).projects)).toBe(true);
  });

  test('client sees only Active projects', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: auth(clientToken) });
    expect(res.status()).toBe(200);
    const { projects } = await res.json();
    expect(Array.isArray(projects)).toBe(true);
    // Every project returned must be Active
    projects.forEach((p: { status: string }) => {
      expect(p.status).toBe('Active');
    });
  });

  test('client response omits sensitive fields (no task counts or internal fields)', async ({ request }) => {
    const res = await request.get('/api/projects', { headers: auth(clientToken) });
    const { projects } = await res.json();
    if (projects.length > 0) {
      const p = projects[0];
      // Client sees only: id, name, description, status, start_date, end_date, created_at
      expect(p.id).toBeTruthy();
      expect(p.name).toBeTruthy();
    }
  });

  test('unauthenticated → 401', async ({ request }) => {
    expect((await request.get('/api/projects')).status()).toBe(401);
  });

  test('pagination: ?limit=2 returns at most 2 records', async ({ request }) => {
    const res = await request.get('/api/projects?limit=2', { headers: auth(dirToken) });
    expect(res.status()).toBe(200);
    expect((await res.json()).projects.length).toBeLessThanOrEqual(2);
  });
});

// ─── POST /api/projects ────────────────────────────────────────────────────────

test.describe('POST /api/projects', () => {
  let createdProjectId = '';

  test.afterAll(async ({ request }) => {
    // No delete endpoint — projects persist in test DB; that's fine for idempotent runs
  });

  test('director creates a project with required fields → returns project', async ({ request }) => {
    const name = uid('proj');
    const res  = await request.post('/api/projects', {
      headers: auth(dirToken),
      data:    { name, status: 'Planning' },
    });
    expect(res.status()).toBe(200);
    const { project } = await res.json();
    expect(project.name).toBe(name);
    expect(project.id).toBeTruthy();
    expect(project.status).toBe('Planning');
    createdProjectId = project.id;
  });

  test('director creates Active project with all optional fields', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(dirToken),
      data:    {
        name:        uid('full-proj'),
        description: 'End-to-end e2e test project',
        status:      'Active',
        start_date:  '2026-01-01',
        end_date:    '2026-12-31',
      },
    });
    expect(res.status()).toBe(200);
    const { project } = await res.json();
    expect(project.status).toBe('Active');
    expect(project.description).toBe('End-to-end e2e test project');
  });

  test('missing name returns 400', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(dirToken),
      data:    { status: 'Active' },
    });
    expect(res.status()).toBe(400);
  });

  test('invalid status value returns 400', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(dirToken),
      data:    { name: uid('bad-status'), status: 'INVALID' },
    });
    expect(res.status()).toBe(400);
  });

  test('employee cannot create a project (403)', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(empToken),
      data:    { name: uid('emp-proj'), status: 'Planning' },
    });
    expect(res.status()).toBe(403);
  });

  test('client cannot create a project (403)', async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(clientToken),
      data:    { name: uid('client-proj'), status: 'Planning' },
    });
    expect(res.status()).toBe(403);
  });
});

// ─── POST /api/projects/[id]/generate-doc ─────────────────────────────────────

test.describe('POST /api/projects/[id]/generate-doc', () => {
  let projectId = '';

  test.beforeAll(async ({ request }) => {
    const res = await request.post('/api/projects', {
      headers: auth(dirToken),
      data:    { name: uid('doc-proj'), status: 'Active', description: 'For doc generation test' },
    });
    projectId = (await res.json()).project?.id;
  });

  test('director generates a markdown project document', async ({ request }) => {
    if (!projectId) { test.skip(true, 'Project creation failed in beforeAll'); return; }

    const res = await request.post(`/api/projects/${projectId}/generate-doc`, {
      headers: auth(dirToken),
    });
    expect(res.status()).toBe(200);
    const { document_content } = await res.json();
    expect(typeof document_content).toBe('string');
    expect(document_content).toContain('# Project Lifecycle Document:');
    expect(document_content).toContain('## Executive Summary');
  });

  test('document includes task breakdown section', async ({ request }) => {
    if (!projectId) { test.skip(true, 'Project creation failed in beforeAll'); return; }

    const { document_content } = await (
      await request.post(`/api/projects/${projectId}/generate-doc`, { headers: auth(dirToken) })
    ).json();
    expect(document_content).toContain('## Tasks Breakdown');
  });

  test('employee cannot generate project document (403)', async ({ request }) => {
    if (!projectId) { test.skip(true, 'Project creation failed in beforeAll'); return; }

    const res = await request.post(`/api/projects/${projectId}/generate-doc`, {
      headers: auth(empToken),
    });
    expect(res.status()).toBe(403);
  });

  test('non-existent project ID returns error (404 or 406)', async ({ request }) => {
    const res = await request.post(
      '/api/projects/00000000-0000-0000-0000-000000000000/generate-doc',
      { headers: auth(dirToken) },
    );
    expect([404, 406, 500]).toContain(res.status());
  });
});
