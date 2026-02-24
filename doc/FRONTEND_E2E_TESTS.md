# Frontend E2E Tests (Playwright)

## Scope
- Billing: product search add, discount apply/remove, hold/resume, payment complete, out-of-stock guard, scanner-style input.
- Returns: open return modal, create return from completed bill, open return details.

## Files
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/pos_fe/playwright.config.ts`
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/pos_fe/tests/e2e/helpers.ts`
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/pos_fe/tests/e2e/billing.spec.ts`
- `/Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/pos_fe/tests/e2e/returns.spec.ts`

## Run
1. `cd /Users/anurag/Library/CloudStorage/OneDrive-CargillInc/Desktop/AAA_POS/pos/pos_fe`
2. `npm i -D @playwright/test`
3. `npx playwright install`
4. Start backend on `http://localhost:8000`
5. Set test user env vars if needed:
   - `export POS_E2E_EMAIL='admin@gmail.com'`
   - `export POS_E2E_PASSWORD='Admin@123'`
6. Run tests:
   - `npm run test:e2e`
   - `npm run test:e2e:headed`

## Notes
- Tests skip gracefully when seed data is missing (for example no completed bills or no out-of-stock items).
- Frontend base URL defaults to `http://127.0.0.1:4173` and is configurable with `PLAYWRIGHT_BASE_URL`.
