# QA End-to-End Detailed Run Report (2026-03-22)

## Scope Covered
- Module 1: Auth + Roles + Store Scoping
- Module 2: Inventory
- Module 3: Billing / Sales
- Module 4: Return & Refund
- Module 5: Dashboard & Reports
- Module 6: Purchase Management
- Module 7: Customers & Loyalty
- Module 8: Stores & Settings
- Frontend browser E2E (Billing + Returns flows)

## Execution Summary

| Suite | Total | Pass | Fail | Status |
|---|---:|---:|---:|---|
| M1 + M2 targeted E2E | 19 | 19 | 0 | PASS |
| M3 Sales API E2E | 7 | 6 | 1 | BLOCKED (environment precondition) |
| M4 Return API E2E | 8 | 7 | 1 | BLOCKED (environment precondition) |
| M5 Reports API E2E | 7 | 6 | 1 | BLOCKED (environment precondition) |
| M6 Purchase API E2E | 9 | 8 | 1 | BLOCKED (environment precondition) |
| M7 Customers API E2E | 10 | 9 | 1 | BLOCKED (environment precondition) |
| M8 Stores/Settings API E2E | 40 | 40 | 0 | PASS |
| FE Playwright (Billing + Returns) | 6 | 0 | 6 | FAIL |

## Key Findings

### 1) Fixed during this run
- **Inventory cross-store product visibility leak** was found and fixed.
- Symptom: a store-bound admin could read product details from another store by product ID.
- Fix applied in `ProductViewSet.get_queryset()` to enforce store filter before annotate.
- File: `pos_be/pos_backend/inventory/views.py` (around lines 159-173).
- Retest evidence: `M2-010` changed from FAIL to PASS in M1+M2 rerun.

### 2) Environment blocker affecting M3-M7 scripts
- Common failing setup step: create Store B product.
- API response: `{"store":"Assigned store is invalid or inactive"}`.
- Impact: scripts for M3-M7 stop early, so full downstream scenarios in these scripts were not executed in this run.

### 3) Frontend Playwright failures (all 6)
- Billing and Returns specs fail on route/visibility assertions.
- Observed patterns:
  - `page.goto('/billing')` / `page.goto('/returns')` does not land on expected page heading.
  - Some runs also remain/redirect on login or dashboard in setup checks.
- This indicates frontend E2E path/login bootstrap synchronization and/or locator assumptions need alignment with current UI/runtime behavior.

## Evidence Files
- `doc/module1_2_auth_inventory_e2e_results_2026-03-22.txt`
- `doc/module3_sales_e2e_results_2026-03-22_run3.txt`
- `doc/module4_return_e2e_results_2026-03-22_run3.txt`
- `doc/module5_reports_e2e_results_2026-03-22_run3.txt`
- `doc/module6_purchase_e2e_results_2026-03-22_run3.txt`
- `doc/module7_customers_e2e_results_2026-03-22_run3.txt`
- `doc/module8_stores_settings_e2e_results_2026-03-22_run3.txt`
- `doc/module_fe_playwright_e2e_results_2026-03-22.txt`

## Overall Assessment
- Backend module testing is strong for M1/M2 and M8.
- M3-M7 are **partially blocked** by inactive Store B setup data, not by immediate business-flow assertion failures.
- One real backend defect (inventory scoping) was identified and fixed with passing retest.
