# TODO - Production E2E exploratory testing + fix internal server error

## Step 1: Reproduce production issues (manual E2E)
- [ ] As end-user on https://krishnaailinks.com, attempt:
  - [ ] Director registration flow -> capture UI error + HTTP status + network response body
  - [ ] AI audit report generation -> capture UI error + HTTP status + network response body
  - [ ] Repeat with wrong access code vs correct access code (if known)

## Step 2: Add/extend automation coverage
- [ ] Create Selenium E2E spec(s) mirroring the manual flows
- [ ] Add API assertions for:
  - [ ] Director registration happy path returns 201
  - [ ] Wrong access code returns 403 (not 500)
  - [ ] AI audit report returns 200 with non-empty markdown (or returns 4xx/5xx with actionable message)

## Step 3: Code hardening (prevent confusing 500s)
- [x] Update src/app/api/auth/register/route.ts to return 503 (Service Unavailable) with actionable message when DIRECTOR_REGISTRATION_CODE missing; preserve 403 for invalid code.
- [x] Update src/app/api/audit/generate-report/route.ts to return 503 (Service Unavailable) with actionable message when GEMINI_API_KEY missing; handle Gemini non-OK with 502 including upstream status.
- [ ] Ensure jsonError() maps Supabase config/auth errors to non-generic actionable status codes where safe.

## Step 4: Re-test locally (CI level)
- [ ] Run existing test suites (Jest/Playwright)
- [ ] Run newly added Selenium tests

## Step 5: Deploy changes + production re-test
- [ ] Deploy to production
- [ ] Re-run manual E2E on krishnaailinks.com and confirm both flows no longer show Internal Server Error.

