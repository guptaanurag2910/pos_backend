#!/usr/bin/env bash
set -u

BASE_URL="${BASE_URL:-http://localhost:8000/api}"

ADMIN_A_EMAIL="${ADMIN_A_EMAIL:-inv_a_1774120903647@example.com}"
ADMIN_B_EMAIL="${ADMIN_B_EMAIL:-inv_b_1774120903647@example.com}"
MANAGER_A_EMAIL="${MANAGER_A_EMAIL:-inv_mgr_1774120903647@example.com}"
CASHIER_A_EMAIL="${CASHIER_A_EMAIL:-inv_cash_1774120903647@example.com}"

ADMIN_PASSWORD="${ADMIN_PASSWORD:-Pass@12345}"
MANAGER_PASSWORD="${MANAGER_PASSWORD:-Manager@123}"
CASHIER_PASSWORD="${CASHIER_PASSWORD:-Cashier@123}"

TS="$(date +%s)"
TODAY="$(date +%F)"
TMP_DIR="$(mktemp -d)"
RESULTS_FILE="$TMP_DIR/results.txt"

TOTAL=0
PASS=0
FAIL=0

record_pass() {
  TOTAL=$((TOTAL + 1))
  PASS=$((PASS + 1))
  echo "PASS|$1|$2" | tee -a "$RESULTS_FILE"
}

record_fail() {
  TOTAL=$((TOTAL + 1))
  FAIL=$((FAIL + 1))
  echo "FAIL|$1|$2" | tee -a "$RESULTS_FILE"
}

api_call() {
  local method="$1"
  local url="$2"
  local token="$3"
  local data="$4"
  local outfile="$5"

  if [[ -n "$data" ]]; then
    curl -sS -o "$outfile" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -sS -o "$outfile" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token"
  fi
}

api_call_with_headers() {
  local method="$1"
  local url="$2"
  local token="$3"
  local data="$4"
  local header_file="$5"
  local body_file="$6"

  if [[ -n "$data" ]]; then
    curl -sS -D "$header_file" -o "$body_file" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token" \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -sS -D "$header_file" -o "$body_file" -w "%{http_code}" \
      -X "$method" "$url" \
      -H "Authorization: Bearer $token"
  fi
}

login_and_get_token() {
  local email="$1"
  local password="$2"
  local out="$3"
  curl -sS -o "$out" -X POST "$BASE_URL/auth/token/" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" >/dev/null
  jq -r '.access // empty' "$out"
}

# ----------------
# Setup and login
# ----------------
ADMIN_A_LOGIN_JSON="$TMP_DIR/admin_a_login.json"
ADMIN_B_LOGIN_JSON="$TMP_DIR/admin_b_login.json"
MANAGER_LOGIN_JSON="$TMP_DIR/manager_login.json"
CASHIER_LOGIN_JSON="$TMP_DIR/cashier_login.json"

ADMIN_A_TOKEN="$(login_and_get_token "$ADMIN_A_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_A_LOGIN_JSON")"
ADMIN_B_TOKEN="$(login_and_get_token "$ADMIN_B_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_B_LOGIN_JSON")"
MANAGER_TOKEN="$(login_and_get_token "$MANAGER_A_EMAIL" "$MANAGER_PASSWORD" "$MANAGER_LOGIN_JSON")"
CASHIER_TOKEN="$(login_and_get_token "$CASHIER_A_EMAIL" "$CASHIER_PASSWORD" "$CASHIER_LOGIN_JSON")"

if [[ -n "$ADMIN_A_TOKEN" ]]; then record_pass "M5-SETUP-01" "Admin A login"; else record_fail "M5-SETUP-01" "Admin A login failed"; fi
if [[ -n "$ADMIN_B_TOKEN" ]]; then record_pass "M5-SETUP-02" "Admin B login"; else record_fail "M5-SETUP-02" "Admin B login failed"; fi
if [[ -n "$MANAGER_TOKEN" ]]; then record_pass "M5-SETUP-03" "Manager A login"; else record_fail "M5-SETUP-03" "Manager A login failed"; fi
if [[ -n "$CASHIER_TOKEN" ]]; then record_pass "M5-SETUP-04" "Cashier A login"; else record_fail "M5-SETUP-04" "Cashier A login failed"; fi

if [[ -z "$ADMIN_A_TOKEN" || -z "$ADMIN_B_TOKEN" || -z "$MANAGER_TOKEN" || -z "$CASHIER_TOKEN" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

STORE_A_ID="$(jq -r '.store_id // empty' "$MANAGER_LOGIN_JSON")"
STORE_B_ID="$(jq -r '.store_id // empty' "$ADMIN_B_LOGIN_JSON")"
STORE_A_CODE="IVA647"
STORE_B_CODE="IVB647"
[[ -z "$STORE_A_ID" ]] && STORE_A_ID="11"
[[ -z "$STORE_B_ID" ]] && STORE_B_ID="12"

# ----------------------------------
# Create deterministic report data
# ----------------------------------
CATEGORY_OUT="$TMP_DIR/category_create.json"
CATEGORY_NAME="ReportsCat-$TS"
CATEGORY_STATUS="$(api_call POST "$BASE_URL/inventory/categories/" "$MANAGER_TOKEN" "{\"name\":\"$CATEGORY_NAME\"}" "$CATEGORY_OUT")"
CATEGORY_ID="$(jq -r '.id // empty' "$CATEGORY_OUT")"
if [[ "$CATEGORY_STATUS" == "201" && -n "$CATEGORY_ID" ]]; then
  record_pass "M5-SETUP-05" "Create category for reports seed"
else
  CATEGORY_ID="35"
  record_fail "M5-SETUP-05" "Create category for reports seed (status=$CATEGORY_STATUS)"
fi

create_product() {
  local token="$1"
  local store_id="$2"
  local name="$3"
  local barcode="$4"
  local qty="$5"
  local out="$6"
  local payload
  payload=$(cat <<JSON
{
  "name":"$name",
  "barcode":"$barcode",
  "category":$CATEGORY_ID,
  "price":"150.00",
  "cost_price":"100.00",
  "tax":5,
  "unit":"piece",
  "quantity":"$qty",
  "min_stock":"1.00",
  "store":$store_id
}
JSON
)
  api_call POST "$BASE_URL/inventory/products/" "$token" "$payload" "$out"
}

PROD_A_OUT="$TMP_DIR/prod_a_create.json"
PROD_B_OUT="$TMP_DIR/prod_b_create.json"
PROD_A_STATUS="$(create_product "$MANAGER_TOKEN" "$STORE_A_ID" "M5 Product A $TS" "M5A$TS" "8.00" "$PROD_A_OUT")"
PROD_B_STATUS="$(create_product "$ADMIN_B_TOKEN" "$STORE_B_ID" "M5 Product B $TS" "M5B$TS" "8.00" "$PROD_B_OUT")"
PROD_A_ID="$(jq -r '.id // empty' "$PROD_A_OUT")"
PROD_B_ID="$(jq -r '.id // empty' "$PROD_B_OUT")"

if [[ "$PROD_A_STATUS" == "201" && -n "$PROD_A_ID" ]]; then record_pass "M5-SETUP-06" "Create store A report seed product"; else record_fail "M5-SETUP-06" "Create store A product failed status=$PROD_A_STATUS"; fi
if [[ "$PROD_B_STATUS" == "201" && -n "$PROD_B_ID" ]]; then record_pass "M5-SETUP-07" "Create store B report seed product"; else record_fail "M5-SETUP-07" "Create store B product failed status=$PROD_B_STATUS"; fi

if [[ -z "$PROD_A_ID" || -z "$PROD_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

create_bill() {
  local token="$1"
  local product_id="$2"
  local out="$3"
  local payload
  payload=$(cat <<JSON
{"items":[{"product_id":$product_id,"quantity":"1.00","rate":"150.00"}]}
JSON
)
  api_call POST "$BASE_URL/sales/bills/" "$token" "$payload" "$out"
}

complete_bill() {
  local token="$1"
  local bill_id="$2"
  local pay_method="$3"
  local out="$4"
  api_call POST "$BASE_URL/sales/bills/$bill_id/complete/" "$token" "{\"payment_method\":\"$pay_method\"}" "$out"
}

BILL_A_CREATE_OUT="$TMP_DIR/bill_a_create.json"
BILL_B_CREATE_OUT="$TMP_DIR/bill_b_create.json"

BILL_A_CREATE_STATUS="$(create_bill "$MANAGER_TOKEN" "$PROD_A_ID" "$BILL_A_CREATE_OUT")"
BILL_B_CREATE_STATUS="$(create_bill "$ADMIN_B_TOKEN" "$PROD_B_ID" "$BILL_B_CREATE_OUT")"

BILL_A_ID="$(jq -r '.id // empty' "$BILL_A_CREATE_OUT")"
BILL_B_ID="$(jq -r '.id // empty' "$BILL_B_CREATE_OUT")"
BILL_A_NUMBER="$(jq -r '.bill_number // empty' "$BILL_A_CREATE_OUT")"
BILL_B_NUMBER="$(jq -r '.bill_number // empty' "$BILL_B_CREATE_OUT")"

if [[ "$BILL_A_CREATE_STATUS" == "201" && -n "$BILL_A_ID" ]]; then record_pass "M5-SETUP-08" "Create store A seed bill"; else record_fail "M5-SETUP-08" "Create store A seed bill failed status=$BILL_A_CREATE_STATUS"; fi
if [[ "$BILL_B_CREATE_STATUS" == "201" && -n "$BILL_B_ID" ]]; then record_pass "M5-SETUP-09" "Create store B seed bill"; else record_fail "M5-SETUP-09" "Create store B seed bill failed status=$BILL_B_CREATE_STATUS"; fi

if [[ -z "$BILL_A_ID" || -z "$BILL_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

BILL_A_COMPLETE_OUT="$TMP_DIR/bill_a_complete.json"
BILL_B_COMPLETE_OUT="$TMP_DIR/bill_b_complete.json"
BILL_A_COMPLETE_STATUS="$(complete_bill "$MANAGER_TOKEN" "$BILL_A_ID" "cash" "$BILL_A_COMPLETE_OUT")"
BILL_B_COMPLETE_STATUS="$(complete_bill "$ADMIN_B_TOKEN" "$BILL_B_ID" "card" "$BILL_B_COMPLETE_OUT")"

if [[ "$BILL_A_COMPLETE_STATUS" == "200" ]]; then record_pass "M5-SETUP-10" "Complete store A seed bill"; else record_fail "M5-SETUP-10" "Complete store A seed bill failed status=$BILL_A_COMPLETE_STATUS"; fi
if [[ "$BILL_B_COMPLETE_STATUS" == "200" ]]; then record_pass "M5-SETUP-11" "Complete store B seed bill"; else record_fail "M5-SETUP-11" "Complete store B seed bill failed status=$BILL_B_COMPLETE_STATUS"; fi

# --------------------
# Module 5 test cases
# --------------------

# M5-001 Dashboard basic
M5001_OUT="$TMP_DIR/m5001_dashboard.json"
M5001_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/" "$MANAGER_TOKEN" "" "$M5001_OUT")"
M5001_KEYS_OK="$(jq -r 'if (.salesSummary and .inventorySummary and .returnsSummary and .recentSales and .meta) then "yes" else "no" end' "$M5001_OUT" 2>/dev/null)"
if [[ "$M5001_STATUS" == "200" && "$M5001_KEYS_OK" == "yes" ]]; then
  record_pass "M5-001" "Dashboard endpoint returns expected sections"
else
  record_fail "M5-001" "Dashboard expected 200 + keys got status=$M5001_STATUS keys=$M5001_KEYS_OK"
fi

# M5-002 Dashboard analytics alias
M5002_OUT="$TMP_DIR/m5002_dashboard_analytics.json"
M5002_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/analytics/" "$MANAGER_TOKEN" "" "$M5002_OUT")"
if [[ "$M5002_STATUS" == "200" ]]; then
  record_pass "M5-002" "Dashboard analytics alias works"
else
  record_fail "M5-002" "Dashboard analytics expected 200 got $M5002_STATUS"
fi

# M5-003 dashboard invalid date format
M5003_OUT="$TMP_DIR/m5003_dashboard_bad_date.json"
M5003_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?start_date=2026-99-99&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5003_OUT")"
if [[ "$M5003_STATUS" == "400" ]]; then
  record_pass "M5-003" "Dashboard invalid date rejected"
else
  record_fail "M5-003" "Dashboard invalid date expected 400 got $M5003_STATUS"
fi

# M5-004 dashboard start > end rejected
M5004_OUT="$TMP_DIR/m5004_dashboard_bad_range.json"
M5004_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?start_date=$TODAY&end_date=2020-01-01" "$MANAGER_TOKEN" "" "$M5004_OUT")"
if [[ "$M5004_STATUS" == "400" ]]; then
  record_pass "M5-004" "Dashboard start_date after end_date rejected"
else
  record_fail "M5-004" "Dashboard bad range expected 400 got $M5004_STATUS"
fi

# M5-005 dashboard all_time flag
M5005_OUT="$TMP_DIR/m5005_dashboard_all_time.json"
M5005_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?all_time=true" "$MANAGER_TOKEN" "" "$M5005_OUT")"
M5005_ALLTIME="$(jq -r '.meta.allTime // "null"' "$M5005_OUT" 2>/dev/null)"
if [[ "$M5005_STATUS" == "200" && "$M5005_ALLTIME" == "true" ]]; then
  record_pass "M5-005" "Dashboard all_time works"
else
  record_fail "M5-005" "Dashboard all_time expected meta.allTime=true got status=$M5005_STATUS allTime=$M5005_ALLTIME"
fi

# M5-006 dashboard store scope (manager should not see store B bill)
M5006_OUT="$TMP_DIR/m5006_dashboard_scope_manager.json"
M5006_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5006_OUT")"
M5006_HAS_BILL_B="$(jq -r --arg bill "$BILL_B_NUMBER" '[.recentSales[] | select(.billNumber==$bill)] | length' "$M5006_OUT" 2>/dev/null)"
if [[ "$M5006_STATUS" == "200" && "$M5006_HAS_BILL_B" == "0" ]]; then
  record_pass "M5-006" "Manager dashboard is store-scoped"
else
  record_fail "M5-006" "Manager dashboard scope leak detected status=$M5006_STATUS billBHits=$M5006_HAS_BILL_B"
fi

# M5-007 dashboard store param ignored for store-bound admin
M5007_OUT="$TMP_DIR/m5007_dashboard_scope_admina_store_param.json"
M5007_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?store=$STORE_B_ID&start_date=$TODAY&end_date=$TODAY" "$ADMIN_A_TOKEN" "" "$M5007_OUT")"
M5007_HAS_BILL_B="$(jq -r --arg bill "$BILL_B_NUMBER" '[.recentSales[] | select(.billNumber==$bill)] | length' "$M5007_OUT" 2>/dev/null)"
if [[ "$M5007_STATUS" == "200" && "$M5007_HAS_BILL_B" == "0" ]]; then
  record_pass "M5-007" "Store-bound admin cannot override report scope with store param"
else
  record_fail "M5-007" "Store-bound admin scope leak status=$M5007_STATUS billBHits=$M5007_HAS_BILL_B"
fi

# M5-008 dashboard for admin B should include its own seed bill
M5008_OUT="$TMP_DIR/m5008_dashboard_adminb.json"
M5008_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/?start_date=$TODAY&end_date=$TODAY" "$ADMIN_B_TOKEN" "" "$M5008_OUT")"
M5008_HAS_BILL_B="$(jq -r --arg bill "$BILL_B_NUMBER" '[.recentSales[] | select(.billNumber==$bill)] | length' "$M5008_OUT" 2>/dev/null)"
if [[ "$M5008_STATUS" == "200" && "$M5008_HAS_BILL_B" -ge 1 ]]; then
  record_pass "M5-008" "Admin B dashboard sees own store bill"
else
  record_fail "M5-008" "Admin B dashboard missing own bill status=$M5008_STATUS billBHits=$M5008_HAS_BILL_B"
fi

# Sales report groupings
M5009_OUT="$TMP_DIR/m5009_sales_day.json"
M5009_STATUS="$(api_call GET "$BASE_URL/reports/sales/?group_by=day&start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5009_OUT")"
if [[ "$M5009_STATUS" == "200" ]]; then record_pass "M5-009" "Sales report day grouping works"; else record_fail "M5-009" "Sales day expected 200 got $M5009_STATUS"; fi

M5010_OUT="$TMP_DIR/m5010_sales_week.json"
M5010_STATUS="$(api_call GET "$BASE_URL/reports/sales/?group_by=week&start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5010_OUT")"
if [[ "$M5010_STATUS" == "200" ]]; then record_pass "M5-010" "Sales report week grouping works"; else record_fail "M5-010" "Sales week expected 200 got $M5010_STATUS"; fi

M5011_OUT="$TMP_DIR/m5011_sales_month.json"
M5011_STATUS="$(api_call GET "$BASE_URL/reports/sales/?group_by=month&start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5011_OUT")"
if [[ "$M5011_STATUS" == "200" ]]; then record_pass "M5-011" "Sales report month grouping works"; else record_fail "M5-011" "Sales month expected 200 got $M5011_STATUS"; fi

M5012_OUT="$TMP_DIR/m5012_sales_bad_group.json"
M5012_STATUS="$(api_call GET "$BASE_URL/reports/sales/?group_by=hour&start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5012_OUT")"
if [[ "$M5012_STATUS" == "400" ]]; then record_pass "M5-012" "Sales report invalid group rejected"; else record_fail "M5-012" "Sales bad group expected 400 got $M5012_STATUS"; fi

M5013_OUT="$TMP_DIR/m5013_sales_bad_date.json"
M5013_STATUS="$(api_call GET "$BASE_URL/reports/sales/?start_date=2026-13-01&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5013_OUT")"
if [[ "$M5013_STATUS" == "400" ]]; then record_pass "M5-013" "Sales report invalid date rejected"; else record_fail "M5-013" "Sales bad date expected 400 got $M5013_STATUS"; fi

# Sales export CSV
M5014_HEADERS="$TMP_DIR/m5014_sales_export_headers.txt"
M5014_BODY="$TMP_DIR/m5014_sales_export_body.csv"
M5014_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/sales/?group_by=day&start_date=$TODAY&end_date=$TODAY&export=true" "$MANAGER_TOKEN" "" "$M5014_HEADERS" "$M5014_BODY")"
M5014_CT="$(grep -i '^Content-Type:' "$M5014_HEADERS" | tr -d '\r' | head -n1)"
M5014_CD="$(grep -i '^Content-Disposition:' "$M5014_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5014_STATUS" == "200" && "$M5014_CT" == *"text/csv"* && "$M5014_CD" == *"sales_report_"* ]]; then
  record_pass "M5-014" "Sales report CSV export works"
else
  record_fail "M5-014" "Sales export expected csv attachment got status=$M5014_STATUS ct='$M5014_CT' cd='$M5014_CD'"
fi

# Inventory report tests
M5015_OUT="$TMP_DIR/m5015_inventory.json"
M5015_STATUS="$(api_call GET "$BASE_URL/reports/inventory/?start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5015_OUT")"
M5015_SUMMARY_OK="$(jq -r 'if (.summary and .inventory) then "yes" else "no" end' "$M5015_OUT" 2>/dev/null)"
if [[ "$M5015_STATUS" == "200" && "$M5015_SUMMARY_OK" == "yes" ]]; then
  record_pass "M5-015" "Inventory report returns summary and rows"
else
  record_fail "M5-015" "Inventory report expected 200 + summary got status=$M5015_STATUS summary=$M5015_SUMMARY_OK"
fi

M5016_OUT="$TMP_DIR/m5016_inventory_low_stock.json"
M5016_STATUS="$(api_call GET "$BASE_URL/reports/inventory/?start_date=$TODAY&end_date=$TODAY&low_stock=true" "$MANAGER_TOKEN" "" "$M5016_OUT")"
if [[ "$M5016_STATUS" == "200" ]]; then
  record_pass "M5-016" "Inventory low_stock filter works"
else
  record_fail "M5-016" "Inventory low_stock expected 200 got $M5016_STATUS"
fi

M5017_OUT="$TMP_DIR/m5017_inventory_bad_date.json"
M5017_STATUS="$(api_call GET "$BASE_URL/reports/inventory/?start_date=2026-01-01&end_date=2025-01-01" "$MANAGER_TOKEN" "" "$M5017_OUT")"
if [[ "$M5017_STATUS" == "400" ]]; then
  record_pass "M5-017" "Inventory invalid date range rejected"
else
  record_fail "M5-017" "Inventory bad date range expected 400 got $M5017_STATUS"
fi

M5018_HEADERS="$TMP_DIR/m5018_inventory_export_headers.txt"
M5018_BODY="$TMP_DIR/m5018_inventory_export.csv"
M5018_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/inventory/?start_date=$TODAY&end_date=$TODAY&export=true" "$MANAGER_TOKEN" "" "$M5018_HEADERS" "$M5018_BODY")"
M5018_CT="$(grep -i '^Content-Type:' "$M5018_HEADERS" | tr -d '\r' | head -n1)"
M5018_CD="$(grep -i '^Content-Disposition:' "$M5018_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5018_STATUS" == "200" && "$M5018_CT" == *"text/csv"* && "$M5018_CD" == *"inventory_report.csv"* ]]; then
  record_pass "M5-018" "Inventory CSV export works"
else
  record_fail "M5-018" "Inventory export expected csv attachment got status=$M5018_STATUS ct='$M5018_CT' cd='$M5018_CD'"
fi

# Customer report tests
M5019_OUT="$TMP_DIR/m5019_customers.json"
M5019_STATUS="$(api_call GET "$BASE_URL/reports/customers/?start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5019_OUT")"
M5019_SUMMARY_OK="$(jq -r 'if (.summary and .purchase_data and .loyalty) then "yes" else "no" end' "$M5019_OUT" 2>/dev/null)"
if [[ "$M5019_STATUS" == "200" && "$M5019_SUMMARY_OK" == "yes" ]]; then
  record_pass "M5-019" "Customer report returns expected sections"
else
  record_fail "M5-019" "Customer report expected 200 + sections got status=$M5019_STATUS sections=$M5019_SUMMARY_OK"
fi

M5020_OUT="$TMP_DIR/m5020_customers_bad_date.json"
M5020_STATUS="$(api_call GET "$BASE_URL/reports/customers/?start_date=invalid&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5020_OUT")"
if [[ "$M5020_STATUS" == "400" ]]; then
  record_pass "M5-020" "Customer report invalid date rejected"
else
  record_fail "M5-020" "Customer bad date expected 400 got $M5020_STATUS"
fi

M5021_HEADERS="$TMP_DIR/m5021_customers_export_headers.txt"
M5021_BODY="$TMP_DIR/m5021_customers_export.csv"
M5021_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/customers/?start_date=$TODAY&end_date=$TODAY&export=true" "$MANAGER_TOKEN" "" "$M5021_HEADERS" "$M5021_BODY")"
M5021_CT="$(grep -i '^Content-Type:' "$M5021_HEADERS" | tr -d '\r' | head -n1)"
M5021_CD="$(grep -i '^Content-Disposition:' "$M5021_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5021_STATUS" == "200" && "$M5021_CT" == *"text/csv"* && "$M5021_CD" == *"customer_report_"* ]]; then
  record_pass "M5-021" "Customer CSV export works"
else
  record_fail "M5-021" "Customer export expected csv attachment got status=$M5021_STATUS ct='$M5021_CT' cd='$M5021_CD'"
fi

# Tax report tests
M5022_OUT="$TMP_DIR/m5022_tax.json"
M5022_STATUS="$(api_call GET "$BASE_URL/reports/tax/?start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5022_OUT")"
M5022_SUMMARY_OK="$(jq -r 'if (.summary and .tax_rates and .period) then "yes" else "no" end' "$M5022_OUT" 2>/dev/null)"
if [[ "$M5022_STATUS" == "200" && "$M5022_SUMMARY_OK" == "yes" ]]; then
  record_pass "M5-022" "Tax report returns expected sections"
else
  record_fail "M5-022" "Tax report expected 200 + sections got status=$M5022_STATUS sections=$M5022_SUMMARY_OK"
fi

M5023_OUT="$TMP_DIR/m5023_tax_bad_date.json"
M5023_STATUS="$(api_call GET "$BASE_URL/reports/tax/?start_date=$TODAY&end_date=2020-01-01" "$MANAGER_TOKEN" "" "$M5023_OUT")"
if [[ "$M5023_STATUS" == "400" ]]; then
  record_pass "M5-023" "Tax report invalid date range rejected"
else
  record_fail "M5-023" "Tax bad date range expected 400 got $M5023_STATUS"
fi

M5024_HEADERS="$TMP_DIR/m5024_tax_export_headers.txt"
M5024_BODY="$TMP_DIR/m5024_tax_export.csv"
M5024_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/tax/?start_date=$TODAY&end_date=$TODAY&export=true" "$MANAGER_TOKEN" "" "$M5024_HEADERS" "$M5024_BODY")"
M5024_CT="$(grep -i '^Content-Type:' "$M5024_HEADERS" | tr -d '\r' | head -n1)"
M5024_CD="$(grep -i '^Content-Disposition:' "$M5024_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5024_STATUS" == "200" && "$M5024_CT" == *"text/csv"* && "$M5024_CD" == *"tax_report_"* ]]; then
  record_pass "M5-024" "Tax CSV export works"
else
  record_fail "M5-024" "Tax export expected csv attachment got status=$M5024_STATUS ct='$M5024_CT' cd='$M5024_CD'"
fi

# Bootstrap export tests
M5025_HEADERS="$TMP_DIR/m5025_bootstrap_mgr_headers.txt"
M5025_BODY="$TMP_DIR/m5025_bootstrap_mgr.xlsx"
M5025_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/dashboard/export-bootstrap/" "$MANAGER_TOKEN" "" "$M5025_HEADERS" "$M5025_BODY")"
M5025_CT="$(grep -i '^Content-Type:' "$M5025_HEADERS" | tr -d '\r' | head -n1)"
M5025_CD="$(grep -i '^Content-Disposition:' "$M5025_HEADERS" | tr -d '\r' | head -n1)"
M5025_SIZE="$(wc -c < "$M5025_BODY" | tr -d ' ')"
if [[ "$M5025_STATUS" == "200" && "$M5025_CT" == *"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"* && "$M5025_CD" == *"store_bootstrap_live_"* && "$M5025_SIZE" -gt 1000 ]]; then
  record_pass "M5-025" "Bootstrap export returns xlsx for manager"
else
  record_fail "M5-025" "Bootstrap export manager expected xlsx got status=$M5025_STATUS ct='$M5025_CT' cd='$M5025_CD' size=$M5025_SIZE"
fi

M5026_HEADERS="$TMP_DIR/m5026_bootstrap_admina_storeparam_headers.txt"
M5026_BODY="$TMP_DIR/m5026_bootstrap_admina_storeparam.xlsx"
M5026_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/dashboard/export-bootstrap/?store=$STORE_B_ID" "$ADMIN_A_TOKEN" "" "$M5026_HEADERS" "$M5026_BODY")"
M5026_CD="$(grep -i '^Content-Disposition:' "$M5026_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5026_STATUS" == "200" && "$M5026_CD" == *"$STORE_A_CODE"* ]]; then
  record_pass "M5-026" "Store-bound admin cannot override bootstrap export store"
else
  record_fail "M5-026" "Bootstrap store override leak status=$M5026_STATUS cd='$M5026_CD'"
fi

M5027_HEADERS="$TMP_DIR/m5027_bootstrap_adminb_headers.txt"
M5027_BODY="$TMP_DIR/m5027_bootstrap_adminb.xlsx"
M5027_STATUS="$(api_call_with_headers GET "$BASE_URL/reports/dashboard/export-bootstrap/" "$ADMIN_B_TOKEN" "" "$M5027_HEADERS" "$M5027_BODY")"
M5027_CD="$(grep -i '^Content-Disposition:' "$M5027_HEADERS" | tr -d '\r' | head -n1)"
if [[ "$M5027_STATUS" == "200" && "$M5027_CD" == *"$STORE_B_CODE"* ]]; then
  record_pass "M5-027" "Admin B bootstrap export scoped to store B"
else
  record_fail "M5-027" "Admin B bootstrap export expected store B filename got status=$M5027_STATUS cd='$M5027_CD'"
fi

# Cashier can access read-only reports
M5028_OUT="$TMP_DIR/m5028_cashier_dashboard.json"
M5028_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/" "$CASHIER_TOKEN" "" "$M5028_OUT")"
if [[ "$M5028_STATUS" == "200" ]]; then
  record_pass "M5-028" "Cashier can access dashboard reports"
else
  record_fail "M5-028" "Cashier dashboard expected 200 got $M5028_STATUS"
fi

M5029_OUT="$TMP_DIR/m5029_cashier_sales.json"
M5029_STATUS="$(api_call GET "$BASE_URL/reports/sales/?group_by=day&start_date=$TODAY&end_date=$TODAY" "$CASHIER_TOKEN" "" "$M5029_OUT")"
if [[ "$M5029_STATUS" == "200" ]]; then
  record_pass "M5-029" "Cashier can access sales report"
else
  record_fail "M5-029" "Cashier sales report expected 200 got $M5029_STATUS"
fi

M5030_OUT="$TMP_DIR/m5030_dashboard_analytics_shape.json"
M5030_STATUS="$(api_call GET "$BASE_URL/reports/dashboard/analytics/?start_date=$TODAY&end_date=$TODAY" "$MANAGER_TOKEN" "" "$M5030_OUT")"
M5030_RETURNS_SUMMARY="$(jq -r 'if .returnsSummary then "yes" else "no" end' "$M5030_OUT" 2>/dev/null)"
if [[ "$M5030_STATUS" == "200" && "$M5030_RETURNS_SUMMARY" == "yes" ]]; then
  record_pass "M5-030" "Dashboard analytics includes returns summary"
else
  record_fail "M5-030" "Dashboard analytics shape mismatch status=$M5030_STATUS returnsSummary=$M5030_RETURNS_SUMMARY"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
