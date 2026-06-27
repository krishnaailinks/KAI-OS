import { defineConfig, devices } from '@playwright/test';
import path from 'path';
import { config } from 'dotenv';

// Load .env.local so Supabase credentials are available in setup scripts
// and tests that call Supabase directly.
config({ path: path.resolve(__dirname, '.env.local') });

/**
 * KAI-OS Comprehensive E2E Test Suite
 *
 * Test files are numbered to communicate intent; Playwright runs them
 * in alphabetical / parallel order unless `fullyParallel` is false.
 *
 *   01  Auth                – registration, login, role routing
 *   02  API Contracts       – every endpoint, every role, every error code
 *   03  Tasks               – full kanban lifecycle + invoice trigger
 *   04  Messaging           – channels, messages, announcement rules
 *   05  Voice Rooms         – create / join / leave / end / capacity
 *   06  Permissions         – allow_video, allow_audit, system_lockout
 *   07  Attendance & Reports– check-in/out, daily reports, timesheets
 *   08  Finance & Payroll   – invoices, payroll execution, idempotency
 *   09  Audit & Admin       – logs, AI report, live stats, health
 *   10  Projects            – CRUD, document generation
 *   11  UI Workflows        – full browser journeys per role
 *   multiuser               – cross-context real-time scenarios
 */
export default defineConfig({
  testDir: './tests/e2e',

  // Run all spec files in parallel; within a file, tests run sequentially
  // to preserve state (e.g. a task created in one test used in the next).
  fullyParallel: false,

  forbidOnly: !!process.env.CI,

  // Retry on CI so flaky network/realtime tests get a second chance.
  retries: process.env.CI ? 2 : 0,

  // One worker on CI to avoid DB race conditions; 3 locally for speed.
  workers: process.env.CI ? 1 : 3,

  reporter: [
    ['html', { open: 'never', outputFolder: 'playwright-report' }],
    ['list'],
    // Uncomment for JUnit output in CI:
    // ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  // Global test timeout: 90 s covers slow AI / realtime assertions.
  timeout: 90_000,

  // Create / clean up test accounts once per full run.
  globalSetup:    './tests/e2e/setup/global-setup.ts',
  globalTeardown: './tests/e2e/setup/global-teardown.ts',

  use: {
    baseURL: 'http://localhost:3000',

    // Capture a screenshot on every failure for post-mortem debugging.
    screenshot: 'only-on-failure',

    // Record a trace on first retry so failures in CI are debuggable.
    trace: 'on-first-retry',

    // Record video on first retry to see what the user actually saw.
    video: 'on-first-retry',

    // Per-action timeout: generous for Realtime events.
    actionTimeout: 20_000,

    // Per-navigation timeout: generous for Next.js dev compilation on first hit.
    navigationTimeout: 60_000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to add cross-browser coverage once the suite is stable:
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit',  use: { ...devices['Desktop Safari'] }  },
  ],

  webServer: {
    // Use `npm run dev` locally so tests always run against the current
    // source without requiring a manual `npm run build`.
    // On CI, set USE_PROD_SERVER=1 to test the production build instead.
    command: process.env.USE_PROD_SERVER ? 'npm run start' : 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
