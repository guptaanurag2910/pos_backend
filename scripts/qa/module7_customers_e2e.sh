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

login_and_get_token() {
  local email="$1"
  local password="$2"
  local out="$3"
  curl -sS -o "$out" -X POST "$BASE_URL/auth/token/" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$email\",\"password\":\"$password\"}" >/dev/null
  jq -r '.access // empty' "$out"
}

list_has_id() {
  local file="$1"
  local target_id="$2"
  jq -e --arg tid "$target_id" \
    '((if type=="array" then . else (.results // []) end) | map((.id|tostring)) | index($tid)) != null' \
    "$file" >/dev/null 2>&1
}

decimal_eq() {
  local a="$1"
  local b="$2"
  local eps="${3:-0.01}"
  awk -v a="$a" -v b="$b" -v e="$eps" 'BEGIN{d=a-b; if(d<0)d=-d; exit(d<=e?0:1)}'
}

is_forbidden_or_not_found() {
  local status="$1"
  [[ "$status" == "403" || "$status" == "404" ]]
}

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
  "price":"200.00",
  "cost_price":"150.00",
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

create_customer() {
  local token="$1"
  local name="$2"
  local phone="$3"
  local out="$4"
  api_call POST "$BASE_URL/customers/" "$token" "{\"name\":\"$name\",\"phone\":\"$phone\"}" "$out"
}

create_bill() {
  local token="$1"
  local customer_id="$2"
  local product_id="$3"
  local qty="$4"
  local points_to_redeem="${5:-0}"
  local out="$6"
  local payload
  payload=$(cat <<JSON
{
  "customer_id":$customer_id,
  "points_to_redeem":$points_to_redeem,
  "items":[{"product_id":$product_id,"quantity":"$qty","rate":"200.00"}]
}
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

if [[ -n "$ADMIN_A_TOKEN" ]]; then record_pass "M7-SETUP-01" "Admin A login"; else record_fail "M7-SETUP-01" "Admin A login failed"; fi
if [[ -n "$ADMIN_B_TOKEN" ]]; then record_pass "M7-SETUP-02" "Admin B login"; else record_fail "M7-SETUP-02" "Admin B login failed"; fi
if [[ -n "$MANAGER_TOKEN" ]]; then record_pass "M7-SETUP-03" "Manager A login"; else record_fail "M7-SETUP-03" "Manager A login failed"; fi
if [[ -n "$CASHIER_TOKEN" ]]; then record_pass "M7-SETUP-04" "Cashier A login"; else record_fail "M7-SETUP-04" "Cashier A login failed"; fi

if [[ -z "$ADMIN_A_TOKEN" || -z "$ADMIN_B_TOKEN" || -z "$MANAGER_TOKEN" || -z "$CASHIER_TOKEN" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

STORE_A_ID="$(jq -r '.store_id // empty' "$MANAGER_LOGIN_JSON")"
STORE_B_ID="$(jq -r '.store_id // empty' "$ADMIN_B_LOGIN_JSON")"
[[ -z "$STORE_A_ID" ]] && STORE_A_ID="11"
[[ -z "$STORE_B_ID" ]] && STORE_B_ID="12"

# -----------------------
# Test data preparation
# -----------------------
CATEGORY_OUT="$TMP_DIR/category_create.json"
CATEGORY_STATUS="$(api_call POST "$BASE_URL/inventory/categories/" "$MANAGER_TOKEN" "{\"name\":\"M7Cat-$TS\"}" "$CATEGORY_OUT")"
CATEGORY_ID="$(jq -r '.id // empty' "$CATEGORY_OUT")"
if [[ "$CATEGORY_STATUS" == "201" && -n "$CATEGORY_ID" ]]; then
  record_pass "M7-SETUP-05" "Create category for customer/loyalty tests"
else
  CATEGORY_ID="35"
  record_fail "M7-SETUP-05" "Create category failed status=$CATEGORY_STATUS"
fi

PROD_A_OUT="$TMP_DIR/product_a_create.json"
PROD_B_OUT="$TMP_DIR/product_b_create.json"
PROD_A_STATUS="$(create_product "$MANAGER_TOKEN" "$STORE_A_ID" "M7 Product A $TS" "M7A$TS" "15.00" "$PROD_A_OUT")"
PROD_B_STATUS="$(create_product "$ADMIN_B_TOKEN" "$STORE_B_ID" "M7 Product B $TS" "M7B$TS" "15.00" "$PROD_B_OUT")"
PROD_A_ID="$(jq -r '.id // empty' "$PROD_A_OUT")"
PROD_B_ID="$(jq -r '.id // empty' "$PROD_B_OUT")"
if [[ "$PROD_A_STATUS" == "201" && -n "$PROD_A_ID" ]]; then record_pass "M7-SETUP-06" "Create store A product for customer billing"; else record_fail "M7-SETUP-06" "Create store A product failed status=$PROD_A_STATUS"; fi
if [[ "$PROD_B_STATUS" == "201" && -n "$PROD_B_ID" ]]; then record_pass "M7-SETUP-07" "Create store B product for customer billing"; else record_fail "M7-SETUP-07" "Create store B product failed status=$PROD_B_STATUS"; fi

PH_A="$(printf '7%09d' $((TS % 1000000000)))"
PH_DUP="$(printf '6%09d' $((TS % 1000000000)))"
PH_B="$(printf '8%09d' $((TS % 1000000000)))"
PH_BAD="12"

CUST_A_OUT="$TMP_DIR/customer_a_create.json"
CUST_DUP_OUT="$TMP_DIR/customer_dup_create.json"
CUST_B_OUT="$TMP_DIR/customer_b_create.json"

CUST_A_STATUS="$(create_customer "$MANAGER_TOKEN" "M7 Customer A $TS" "$PH_A" "$CUST_A_OUT")"
CUST_DUP_STATUS="$(create_customer "$MANAGER_TOKEN" "M7 Customer Dup $TS" "$PH_DUP" "$CUST_DUP_OUT")"
CUST_B_STATUS="$(create_customer "$ADMIN_B_TOKEN" "M7 Customer B $TS" "$PH_B" "$CUST_B_OUT")"

CUST_A_ID="$(jq -r '.id // empty' "$CUST_A_OUT")"
CUST_DUP_ID="$(jq -r '.id // empty' "$CUST_DUP_OUT")"
CUST_B_ID="$(jq -r '.id // empty' "$CUST_B_OUT")"

if [[ "$CUST_A_STATUS" == "201" && -n "$CUST_A_ID" ]]; then record_pass "M7-SETUP-08" "Create customer A (store A)"; else record_fail "M7-SETUP-08" "Create customer A failed status=$CUST_A_STATUS"; fi
if [[ "$CUST_DUP_STATUS" == "201" && -n "$CUST_DUP_ID" ]]; then record_pass "M7-SETUP-09" "Create duplicate candidate customer"; else record_fail "M7-SETUP-09" "Create duplicate candidate failed status=$CUST_DUP_STATUS"; fi
if [[ "$CUST_B_STATUS" == "201" && -n "$CUST_B_ID" ]]; then record_pass "M7-SETUP-10" "Create customer B (store B)"; else record_fail "M7-SETUP-10" "Create customer B failed status=$CUST_B_STATUS"; fi

if [[ -z "$PROD_A_ID" || -z "$PROD_B_ID" || -z "$CUST_A_ID" || -z "$CUST_DUP_ID" || -z "$CUST_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

BILL_A_CREATE_OUT="$TMP_DIR/bill_a_create.json"
BILL_A_CREATE_STATUS="$(create_bill "$MANAGER_TOKEN" "$CUST_A_ID" "$PROD_A_ID" "2.00" "0" "$BILL_A_CREATE_OUT")"
BILL_A_ID="$(jq -r '.id // empty' "$BILL_A_CREATE_OUT")"
if [[ "$BILL_A_CREATE_STATUS" == "201" && -n "$BILL_A_ID" ]]; then
  record_pass "M7-SETUP-11" "Create bill A for customer loyalty baseline"
else
  record_fail "M7-SETUP-11" "Create bill A failed status=$BILL_A_CREATE_STATUS"
fi

BILL_A_COMPLETE_OUT="$TMP_DIR/bill_a_complete.json"
BILL_A_COMPLETE_STATUS="000"
if [[ -n "$BILL_A_ID" ]]; then
  BILL_A_COMPLETE_STATUS="$(complete_bill "$MANAGER_TOKEN" "$BILL_A_ID" "cash" "$BILL_A_COMPLETE_OUT")"
fi
if [[ "$BILL_A_COMPLETE_STATUS" == "200" ]]; then
  record_pass "M7-SETUP-12" "Complete bill A"
else
  record_fail "M7-SETUP-12" "Complete bill A failed status=$BILL_A_COMPLETE_STATUS"
fi

CUST_A_AFTER_BILL_OUT="$TMP_DIR/customer_a_after_bill.json"
CUST_A_AFTER_BILL_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_A_ID/" "$MANAGER_TOKEN" "" "$CUST_A_AFTER_BILL_OUT")"
CUST_A_POINTS_AFTER_BILL="$(jq -r '.loyalty_points // 0' "$CUST_A_AFTER_BILL_OUT")"
if [[ "$CUST_A_AFTER_BILL_STATUS" == "200" && "$CUST_A_POINTS_AFTER_BILL" -ge 1 ]]; then
  record_pass "M7-SETUP-13" "Customer A points increased after completed bill"
else
  record_fail "M7-SETUP-13" "Customer points after bill expected >=1 status=$CUST_A_AFTER_BILL_STATUS points=$CUST_A_POINTS_AFTER_BILL"
fi

# --------------------
# Module 7 test cases
# --------------------

# M7-001 manager list is scoped to store A
M7001_OUT="$TMP_DIR/m7001_manager_customer_list.json"
M7001_STATUS="$(api_call GET "$BASE_URL/customers/" "$MANAGER_TOKEN" "" "$M7001_OUT")"
if [[ "$M7001_STATUS" == "200" ]] && list_has_id "$M7001_OUT" "$CUST_A_ID" && ! list_has_id "$M7001_OUT" "$CUST_B_ID"; then
  record_pass "M7-001" "Manager customer list scoped to store A"
else
  record_fail "M7-001" "Manager customer scope failed status=$M7001_STATUS"
fi

# M7-002 admin B list is scoped to store B
M7002_OUT="$TMP_DIR/m7002_adminb_customer_list.json"
M7002_STATUS="$(api_call GET "$BASE_URL/customers/" "$ADMIN_B_TOKEN" "" "$M7002_OUT")"
if [[ "$M7002_STATUS" == "200" ]] && list_has_id "$M7002_OUT" "$CUST_B_ID" && ! list_has_id "$M7002_OUT" "$CUST_A_ID"; then
  record_pass "M7-002" "Admin B customer list scoped to store B"
else
  record_fail "M7-002" "Admin B customer scope failed status=$M7002_STATUS"
fi

# M7-003 manager cannot retrieve store B customer
M7003_OUT="$TMP_DIR/m7003_manager_get_customerb.json"
M7003_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_B_ID/" "$MANAGER_TOKEN" "" "$M7003_OUT")"
if is_forbidden_or_not_found "$M7003_STATUS"; then
  record_pass "M7-003" "Manager cannot retrieve store B customer"
else
  record_fail "M7-003" "Manager cross-store customer retrieve leak status=$M7003_STATUS"
fi

# M7-004 admin B cannot retrieve store A customer
M7004_OUT="$TMP_DIR/m7004_adminb_get_customera.json"
M7004_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_A_ID/" "$ADMIN_B_TOKEN" "" "$M7004_OUT")"
if is_forbidden_or_not_found "$M7004_STATUS"; then
  record_pass "M7-004" "Admin B cannot retrieve store A customer"
else
  record_fail "M7-004" "Admin B cross-store customer retrieve leak status=$M7004_STATUS"
fi

# M7-005 cashier denied customer create
M7005_OUT="$TMP_DIR/m7005_cashier_create_customer.json"
M7005_STATUS="$(create_customer "$CASHIER_TOKEN" "M7 Cashier Create $TS" "5111111111" "$M7005_OUT")"
if [[ "$M7005_STATUS" == "403" ]]; then
  record_pass "M7-005" "Cashier denied customer create"
else
  record_fail "M7-005" "Cashier create expected 403 got $M7005_STATUS"
fi

# M7-006 invalid phone rejected
M7006_OUT="$TMP_DIR/m7006_invalid_phone.json"
M7006_STATUS="$(create_customer "$MANAGER_TOKEN" "M7 Invalid Phone" "$PH_BAD" "$M7006_OUT")"
if [[ "$M7006_STATUS" == "400" ]]; then
  record_pass "M7-006" "Invalid phone validation works"
else
  record_fail "M7-006" "Invalid phone expected 400 got $M7006_STATUS"
fi

# M7-007 manager add_points positive
M7007_OUT="$TMP_DIR/m7007_add_points_positive.json"
M7007_STATUS="$(api_call POST "$BASE_URL/customers/$CUST_A_ID/add_points/" "$MANAGER_TOKEN" "{\"points\":5,\"reason\":\"test\"}" "$M7007_OUT")"
M7007_POINTS="$(jq -r '.loyalty_points // 0' "$M7007_OUT")"
if [[ "$M7007_STATUS" == "200" && "$M7007_POINTS" -ge 5 ]]; then
  record_pass "M7-007" "Manager can add loyalty points"
else
  record_fail "M7-007" "Manager add_points failed status=$M7007_STATUS points=$M7007_POINTS"
fi

# M7-008 add_points zero rejected
M7008_OUT="$TMP_DIR/m7008_add_points_zero.json"
M7008_STATUS="$(api_call POST "$BASE_URL/customers/$CUST_A_ID/add_points/" "$MANAGER_TOKEN" "{\"points\":0}" "$M7008_OUT")"
if [[ "$M7008_STATUS" == "400" ]]; then
  record_pass "M7-008" "Zero points rejected"
else
  record_fail "M7-008" "Zero points expected 400 got $M7008_STATUS"
fi

# M7-009 over deduction rejected
M7009_OUT="$TMP_DIR/m7009_add_points_overdeduct.json"
M7009_STATUS="$(api_call POST "$BASE_URL/customers/$CUST_A_ID/add_points/" "$MANAGER_TOKEN" "{\"points\":-999999}" "$M7009_OUT")"
if [[ "$M7009_STATUS" == "400" ]]; then
  record_pass "M7-009" "Over-deduction of points rejected"
else
  record_fail "M7-009" "Over-deduction expected 400 got $M7009_STATUS"
fi

# M7-010 cashier denied add_points
M7010_OUT="$TMP_DIR/m7010_cashier_add_points.json"
M7010_STATUS="$(api_call POST "$BASE_URL/customers/$CUST_A_ID/add_points/" "$CASHIER_TOKEN" "{\"points\":5}" "$M7010_OUT")"
if [[ "$M7010_STATUS" == "403" ]]; then
  record_pass "M7-010" "Cashier denied add_points"
else
  record_fail "M7-010" "Cashier add_points expected 403 got $M7010_STATUS"
fi

# M7-011 purchase history has completed bill
M7011_OUT="$TMP_DIR/m7011_purchase_history.json"
M7011_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_A_ID/purchase_history/" "$MANAGER_TOKEN" "" "$M7011_OUT")"
M7011_COUNT="$(jq -r 'if type=="array" then length else ((.results // []) | length) end' "$M7011_OUT")"
if [[ "$M7011_STATUS" == "200" && "$M7011_COUNT" -ge 1 ]]; then
  record_pass "M7-011" "Customer purchase history returns bills"
else
  record_fail "M7-011" "Purchase history expected >=1 bill status=$M7011_STATUS count=$M7011_COUNT"
fi

# M7-012 manager cannot access purchase history for store B customer
M7012_OUT="$TMP_DIR/m7012_cross_store_purchase_history.json"
M7012_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_B_ID/purchase_history/" "$MANAGER_TOKEN" "" "$M7012_OUT")"
if is_forbidden_or_not_found "$M7012_STATUS"; then
  record_pass "M7-012" "Manager cannot access store B purchase history"
else
  record_fail "M7-012" "Cross-store purchase history leak status=$M7012_STATUS"
fi

# M7-013 soft delete duplicate customer
M7013_OUT="$TMP_DIR/m7013_soft_delete_dup.json"
M7013_STATUS="$(api_call DELETE "$BASE_URL/customers/$CUST_DUP_ID/" "$MANAGER_TOKEN" "" "$M7013_OUT")"
if [[ "$M7013_STATUS" == "204" ]]; then
  record_pass "M7-013" "Customer soft delete works"
else
  record_fail "M7-013" "Soft delete expected 204 got $M7013_STATUS"
fi

# M7-014 deleted customer hidden by default but visible include_inactive
M7014_DEF_OUT="$TMP_DIR/m7014_default_list_after_delete.json"
M7014_DEF_STATUS="$(api_call GET "$BASE_URL/customers/" "$MANAGER_TOKEN" "" "$M7014_DEF_OUT")"
M7014_INC_OUT="$TMP_DIR/m7014_include_inactive_after_delete.json"
M7014_INC_STATUS="$(api_call GET "$BASE_URL/customers/?include_inactive=true" "$MANAGER_TOKEN" "" "$M7014_INC_OUT")"
if [[ "$M7014_DEF_STATUS" == "200" && "$M7014_INC_STATUS" == "200" ]] && ! list_has_id "$M7014_DEF_OUT" "$CUST_DUP_ID" && list_has_id "$M7014_INC_OUT" "$CUST_DUP_ID"; then
  record_pass "M7-014" "Deleted customer visibility flags work"
else
  record_fail "M7-014" "Customer include_inactive behavior mismatch"
fi

# recreate duplicate for merge tests
CUST_DUP2_OUT="$TMP_DIR/customer_dup2_create.json"
CUST_DUP2_PHONE="$(printf '5%09d' $(((TS+1) % 1000000000)))"
CUST_DUP2_STATUS="$(create_customer "$MANAGER_TOKEN" "M7 Customer Dup2 $TS" "$CUST_DUP2_PHONE" "$CUST_DUP2_OUT")"
CUST_DUP2_ID="$(jq -r '.id // empty' "$CUST_DUP2_OUT")"
if [[ "$CUST_DUP2_STATUS" == "201" && -n "$CUST_DUP2_ID" ]]; then
  record_pass "M7-SETUP-14" "Create second duplicate customer for merge"
else
  record_fail "M7-SETUP-14" "Create second duplicate failed status=$CUST_DUP2_STATUS"
fi

if [[ -z "$CUST_DUP2_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# M7-015 merge invalid payload rejected
M7015_OUT="$TMP_DIR/m7015_merge_invalid_payload.json"
M7015_STATUS="$(api_call POST "$BASE_URL/customers/merge/" "$MANAGER_TOKEN" "{\"primary_customer_id\":$CUST_A_ID}" "$M7015_OUT")"
if [[ "$M7015_STATUS" == "400" ]]; then
  record_pass "M7-015" "Merge invalid payload rejected"
else
  record_fail "M7-015" "Merge invalid payload expected 400 got $M7015_STATUS"
fi

# M7-016 merge primary in duplicates rejected
M7016_OUT="$TMP_DIR/m7016_merge_primary_in_duplicates.json"
M7016_STATUS="$(api_call POST "$BASE_URL/customers/merge/" "$MANAGER_TOKEN" "{\"primary_customer_id\":$CUST_A_ID,\"duplicate_customer_ids\":[$CUST_A_ID,$CUST_DUP2_ID]}" "$M7016_OUT")"
if [[ "$M7016_STATUS" == "400" ]]; then
  record_pass "M7-016" "Merge primary in duplicates rejected"
else
  record_fail "M7-016" "Merge primary in duplicates expected 400 got $M7016_STATUS"
fi

# M7-017 merge duplicates success
M7017_OUT="$TMP_DIR/m7017_merge_success.json"
M7017_STATUS="$(api_call POST "$BASE_URL/customers/merge/" "$MANAGER_TOKEN" "{\"primary_customer_id\":$CUST_A_ID,\"duplicate_customer_ids\":[$CUST_DUP2_ID]}" "$M7017_OUT")"
if [[ "$M7017_STATUS" == "200" ]]; then
  record_pass "M7-017" "Customer merge success"
else
  record_fail "M7-017" "Customer merge expected 200 got $M7017_STATUS"
fi

M7017B_OUT="$TMP_DIR/m7017b_dup_after_merge.json"
M7017B_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_DUP2_ID/?include_inactive=true" "$MANAGER_TOKEN" "" "$M7017B_OUT")"
M7017B_ACTIVE="$(jq -r 'if has("is_active") then .is_active else true end' "$M7017B_OUT")"
if [[ "$M7017B_STATUS" == "404" || "$M7017B_ACTIVE" == "false" ]]; then
  record_pass "M7-018" "Merged duplicate is inactive/non-visible"
else
  record_fail "M7-018" "Merged duplicate should be inactive; status=$M7017B_STATUS active=$M7017B_ACTIVE"
fi

# M7-019 stats endpoint manager
M7019_OUT="$TMP_DIR/m7019_manager_stats.json"
M7019_STATUS="$(api_call GET "$BASE_URL/customers/stats/" "$MANAGER_TOKEN" "" "$M7019_OUT")"
M7019_KEYS="$(jq -r 'if (.total_customers != null and .active_customers != null and .top_by_points != null) then "yes" else "no" end' "$M7019_OUT")"
if [[ "$M7019_STATUS" == "200" && "$M7019_KEYS" == "yes" ]]; then
  record_pass "M7-019" "Manager stats endpoint works"
else
  record_fail "M7-019" "Manager stats expected keys got status=$M7019_STATUS keys=$M7019_KEYS"
fi

# M7-020 stats endpoint cashier read-only access
M7020_OUT="$TMP_DIR/m7020_cashier_stats.json"
M7020_STATUS="$(api_call GET "$BASE_URL/customers/stats/" "$CASHIER_TOKEN" "" "$M7020_OUT")"
if [[ "$M7020_STATUS" == "200" ]]; then
  record_pass "M7-020" "Cashier can access customer stats"
else
  record_fail "M7-020" "Cashier stats expected 200 got $M7020_STATUS"
fi

# M7-021 create customer group endpoint
M7021_OUT="$TMP_DIR/m7021_create_group_a.json"
M7021_STATUS="$(api_call POST "$BASE_URL/customers/groups/" "$MANAGER_TOKEN" "{\"name\":\"M7 Group A $TS\"}" "$M7021_OUT")"
GROUP_A_ID="$(jq -r '.id // empty' "$M7021_OUT")"
if [[ "$M7021_STATUS" == "201" && -n "$GROUP_A_ID" ]]; then
  record_pass "M7-021" "Create customer group"
else
  record_fail "M7-021" "Create group expected 201 got $M7021_STATUS"
fi

# M7-022 add same-store customer to group
M7022_OUT="$TMP_DIR/m7022_group_add_same_store.json"
M7022_STATUS="000"
if [[ -n "$GROUP_A_ID" ]]; then
  M7022_STATUS="$(api_call POST "$BASE_URL/customers/groups/$GROUP_A_ID/add_customers/" "$MANAGER_TOKEN" "{\"customer_ids\":[$CUST_A_ID]}" "$M7022_OUT")"
fi
M7022_COUNT="$(jq -r '.customer_count // 0' "$M7022_OUT" 2>/dev/null || echo 0)"
if [[ "$M7022_STATUS" == "200" && "$M7022_COUNT" -ge 1 ]]; then
  record_pass "M7-022" "Add same-store customer to group"
else
  record_fail "M7-022" "Add same-store customer expected 200 got $M7022_STATUS count=$M7022_COUNT"
fi

# M7-023 remove same-store customer from group
M7023_OUT="$TMP_DIR/m7023_group_remove_same_store.json"
M7023_STATUS="000"
if [[ -n "$GROUP_A_ID" ]]; then
  M7023_STATUS="$(api_call POST "$BASE_URL/customers/groups/$GROUP_A_ID/remove_customers/" "$MANAGER_TOKEN" "{\"customer_ids\":[$CUST_A_ID]}" "$M7023_OUT")"
fi
M7023_COUNT="$(jq -r '.customer_count // 999' "$M7023_OUT" 2>/dev/null || echo 999)"
if [[ "$M7023_STATUS" == "200" && "$M7023_COUNT" == "0" ]]; then
  record_pass "M7-023" "Remove same-store customer from group"
else
  record_fail "M7-023" "Remove same-store expected 200 got $M7023_STATUS count=$M7023_COUNT"
fi

# M7-024 manager cannot add cross-store customer to group
M7024_OUT="$TMP_DIR/m7024_group_add_cross_store.json"
M7024_STATUS="000"
if [[ -n "$GROUP_A_ID" ]]; then
  M7024_STATUS="$(api_call POST "$BASE_URL/customers/groups/$GROUP_A_ID/add_customers/" "$MANAGER_TOKEN" "{\"customer_ids\":[$CUST_B_ID]}" "$M7024_OUT")"
fi
if [[ "$M7024_STATUS" == "400" || "$M7024_STATUS" == "403" || "$M7024_STATUS" == "404" ]]; then
  record_pass "M7-024" "Cross-store group add blocked"
else
  record_fail "M7-024" "Cross-store group add expected denial got $M7024_STATUS"
fi

# M7-025 manager cannot remove cross-store customer from group
M7025_OUT="$TMP_DIR/m7025_group_remove_cross_store.json"
M7025_STATUS="000"
if [[ -n "$GROUP_A_ID" ]]; then
  M7025_STATUS="$(api_call POST "$BASE_URL/customers/groups/$GROUP_A_ID/remove_customers/" "$MANAGER_TOKEN" "{\"customer_ids\":[$CUST_B_ID]}" "$M7025_OUT")"
fi
if [[ "$M7025_STATUS" == "400" || "$M7025_STATUS" == "403" || "$M7025_STATUS" == "404" ]]; then
  record_pass "M7-025" "Cross-store group remove blocked"
else
  record_fail "M7-025" "Cross-store group remove expected denial got $M7025_STATUS"
fi

# create group B for scope check
M7026_SETUP_OUT="$TMP_DIR/m7026_setup_group_b.json"
M7026_SETUP_STATUS="$(api_call POST "$BASE_URL/customers/groups/" "$ADMIN_B_TOKEN" "{\"name\":\"M7 Group B $TS\"}" "$M7026_SETUP_OUT")"
GROUP_B_ID="$(jq -r '.id // empty' "$M7026_SETUP_OUT")"
if [[ "$M7026_SETUP_STATUS" == "201" && -n "$GROUP_B_ID" ]]; then
  record_pass "M7-SETUP-15" "Create group B for scope checks"
else
  record_fail "M7-SETUP-15" "Create group B failed status=$M7026_SETUP_STATUS"
fi

# M7-026 manager group list should not expose group B
M7026_OUT="$TMP_DIR/m7026_manager_group_list.json"
M7026_STATUS="$(api_call GET "$BASE_URL/customers/groups/" "$MANAGER_TOKEN" "" "$M7026_OUT")"
if [[ "$M7026_STATUS" == "200" ]] && ! list_has_id "$M7026_OUT" "$GROUP_B_ID"; then
  record_pass "M7-026" "Manager group list scoped"
else
  record_fail "M7-026" "Manager group list scope failed status=$M7026_STATUS"
fi

# M7-027 admin B group list should not expose group A
M7027_OUT="$TMP_DIR/m7027_adminb_group_list.json"
M7027_STATUS="$(api_call GET "$BASE_URL/customers/groups/" "$ADMIN_B_TOKEN" "" "$M7027_OUT")"
if [[ "$M7027_STATUS" == "200" ]] && ! list_has_id "$M7027_OUT" "$GROUP_A_ID"; then
  record_pass "M7-027" "Admin B group list scoped"
else
  record_fail "M7-027" "Admin B group list scope failed status=$M7027_STATUS"
fi

# M7-028 valid points redemption reflected on draft bill
M7028_CUST_OUT="$TMP_DIR/m7028_customer_before_redeem.json"
M7028_CUST_STATUS="$(api_call GET "$BASE_URL/customers/$CUST_A_ID/" "$MANAGER_TOKEN" "" "$M7028_CUST_OUT")"
M7028_POINTS_BEFORE="$(jq -r '.loyalty_points // 0' "$M7028_CUST_OUT")"
REDEEM_POINTS=0
if [[ "$M7028_POINTS_BEFORE" -gt 0 ]]; then
  REDEEM_POINTS=1
fi
M7028_OUT="$TMP_DIR/m7028_bill_with_redeem.json"
M7028_STATUS="$(create_bill "$MANAGER_TOKEN" "$CUST_A_ID" "$PROD_A_ID" "1.00" "$REDEEM_POINTS" "$M7028_OUT")"
M7028_BILL_ID="$(jq -r '.id // empty' "$M7028_OUT")"
M7028_REDEEMED="$(jq -r '.points_redeemed // 0' "$M7028_OUT")"
if [[ "$M7028_STATUS" == "201" && -n "$M7028_BILL_ID" && "$M7028_REDEEMED" == "$REDEEM_POINTS" ]]; then
  record_pass "M7-028" "Draft bill captures points redemption"
else
  record_fail "M7-028" "Points redemption bill expected 201 + redeemed=$REDEEM_POINTS got status=$M7028_STATUS redeemed=$M7028_REDEEMED"
fi

# M7-029 cross-store merge blocked
M7029_OUT="$TMP_DIR/m7029_merge_cross_store.json"
M7029_STATUS="$(api_call POST "$BASE_URL/customers/merge/" "$MANAGER_TOKEN" "{\"primary_customer_id\":$CUST_A_ID,\"duplicate_customer_ids\":[$CUST_B_ID]}" "$M7029_OUT")"
if [[ "$M7029_STATUS" == "400" || "$M7029_STATUS" == "404" ]]; then
  record_pass "M7-029" "Cross-store customer merge blocked"
else
  record_fail "M7-029" "Cross-store merge expected denial got $M7029_STATUS"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
