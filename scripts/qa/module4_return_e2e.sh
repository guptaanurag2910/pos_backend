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

to2() {
  awk -v x="$1" 'BEGIN{printf "%.2f", x}'
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

if [[ -n "$ADMIN_A_TOKEN" ]]; then record_pass "M4-SETUP-01" "Admin A login"; else record_fail "M4-SETUP-01" "Admin A login failed"; fi
if [[ -n "$ADMIN_B_TOKEN" ]]; then record_pass "M4-SETUP-02" "Admin B login"; else record_fail "M4-SETUP-02" "Admin B login failed"; fi
if [[ -n "$MANAGER_TOKEN" ]]; then record_pass "M4-SETUP-03" "Manager A login"; else record_fail "M4-SETUP-03" "Manager A login failed"; fi
if [[ -n "$CASHIER_TOKEN" ]]; then record_pass "M4-SETUP-04" "Cashier A login"; else record_fail "M4-SETUP-04" "Cashier A login failed"; fi

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
CATEGORY_NAME="ReturnCat-$TS"
CATEGORY_STATUS="$(api_call POST "$BASE_URL/inventory/categories/" "$MANAGER_TOKEN" "{\"name\":\"$CATEGORY_NAME\"}" "$CATEGORY_OUT")"
CATEGORY_ID="$(jq -r '.id // empty' "$CATEGORY_OUT")"
if [[ "$CATEGORY_STATUS" == "201" && -n "$CATEGORY_ID" ]]; then
  record_pass "M4-SETUP-05" "Create category for return tests"
else
  CATEGORY_ID="35"
  record_fail "M4-SETUP-05" "Create category for return tests (status=$CATEGORY_STATUS)"
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
  "price":"120.00",
  "cost_price":"90.00",
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
PROD_C_OUT="$TMP_DIR/prod_c_create.json"

PROD_A_STATUS="$(create_product "$MANAGER_TOKEN" "$STORE_A_ID" "M4 Product A $TS" "M4A$TS" "15.00" "$PROD_A_OUT")"
PROD_B_STATUS="$(create_product "$ADMIN_B_TOKEN" "$STORE_B_ID" "M4 Product B $TS" "M4B$TS" "10.00" "$PROD_B_OUT")"
PROD_C_STATUS="$(create_product "$MANAGER_TOKEN" "$STORE_A_ID" "M4 Product C $TS" "M4C$TS" "6.00" "$PROD_C_OUT")"

PROD_A_ID="$(jq -r '.id // empty' "$PROD_A_OUT")"
PROD_B_ID="$(jq -r '.id // empty' "$PROD_B_OUT")"
PROD_C_ID="$(jq -r '.id // empty' "$PROD_C_OUT")"

if [[ "$PROD_A_STATUS" == "201" && -n "$PROD_A_ID" ]]; then record_pass "M4-SETUP-06" "Create store A product A"; else record_fail "M4-SETUP-06" "Create store A product A (status=$PROD_A_STATUS)"; fi
if [[ "$PROD_B_STATUS" == "201" && -n "$PROD_B_ID" ]]; then record_pass "M4-SETUP-07" "Create store B product B"; else record_fail "M4-SETUP-07" "Create store B product B (status=$PROD_B_STATUS)"; fi
if [[ "$PROD_C_STATUS" == "201" && -n "$PROD_C_ID" ]]; then record_pass "M4-SETUP-08" "Create store A product C"; else record_fail "M4-SETUP-08" "Create store A product C (status=$PROD_C_STATUS)"; fi

if [[ -z "$PROD_A_ID" || -z "$PROD_B_ID" || -z "$PROD_C_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

create_bill() {
  local token="$1"
  local product_id="$2"
  local qty="$3"
  local out="$4"
  local payload
  payload=$(cat <<JSON
{"items":[{"product_id":$product_id,"quantity":"$qty","rate":"120.00"}]}
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

# Bill A (Store A) - completed
BILL_A_CREATE_OUT="$TMP_DIR/bill_a_create.json"
BILL_A_CREATE_STATUS="$(create_bill "$MANAGER_TOKEN" "$PROD_A_ID" "3.00" "$BILL_A_CREATE_OUT")"
BILL_A_ID="$(jq -r '.id // empty' "$BILL_A_CREATE_OUT")"
BILL_A_ITEM_ID="$(jq -r '.items[0].id // empty' "$BILL_A_CREATE_OUT")"
BILL_A_TOTAL="$(jq -r '.total // "0"' "$BILL_A_CREATE_OUT")"
if [[ "$BILL_A_CREATE_STATUS" == "201" && -n "$BILL_A_ID" && -n "$BILL_A_ITEM_ID" ]]; then
  record_pass "M4-SETUP-09" "Create bill A draft"
else
  record_fail "M4-SETUP-09" "Create bill A draft (status=$BILL_A_CREATE_STATUS)"
fi

BILL_A_COMPLETE_OUT="$TMP_DIR/bill_a_complete.json"
BILL_A_COMPLETE_STATUS="000"
if [[ -n "$BILL_A_ID" ]]; then
  BILL_A_COMPLETE_STATUS="$(complete_bill "$MANAGER_TOKEN" "$BILL_A_ID" "cash" "$BILL_A_COMPLETE_OUT")"
fi
if [[ "$BILL_A_COMPLETE_STATUS" == "200" ]]; then
  record_pass "M4-SETUP-10" "Complete bill A"
else
  record_fail "M4-SETUP-10" "Complete bill A (status=$BILL_A_COMPLETE_STATUS)"
fi

# Bill Draft D (Store A) - stays draft
BILL_D_CREATE_OUT="$TMP_DIR/bill_d_create.json"
BILL_D_CREATE_STATUS="$(create_bill "$MANAGER_TOKEN" "$PROD_A_ID" "1.00" "$BILL_D_CREATE_OUT")"
BILL_D_ID="$(jq -r '.id // empty' "$BILL_D_CREATE_OUT")"
BILL_D_ITEM_ID="$(jq -r '.items[0].id // empty' "$BILL_D_CREATE_OUT")"
if [[ "$BILL_D_CREATE_STATUS" == "201" && -n "$BILL_D_ID" ]]; then
  record_pass "M4-SETUP-11" "Create draft-only bill D"
else
  record_fail "M4-SETUP-11" "Create draft-only bill D (status=$BILL_D_CREATE_STATUS)"
fi

# Bill B (Store B) - completed
BILL_B_CREATE_OUT="$TMP_DIR/bill_b_create.json"
BILL_B_CREATE_STATUS="$(create_bill "$ADMIN_B_TOKEN" "$PROD_B_ID" "2.00" "$BILL_B_CREATE_OUT")"
BILL_B_ID="$(jq -r '.id // empty' "$BILL_B_CREATE_OUT")"
BILL_B_ITEM_ID="$(jq -r '.items[0].id // empty' "$BILL_B_CREATE_OUT")"
if [[ "$BILL_B_CREATE_STATUS" == "201" && -n "$BILL_B_ID" ]]; then
  record_pass "M4-SETUP-12" "Create bill B draft (store B)"
else
  record_fail "M4-SETUP-12" "Create bill B draft (status=$BILL_B_CREATE_STATUS)"
fi

BILL_B_COMPLETE_OUT="$TMP_DIR/bill_b_complete.json"
BILL_B_COMPLETE_STATUS="000"
if [[ -n "$BILL_B_ID" ]]; then
  BILL_B_COMPLETE_STATUS="$(complete_bill "$ADMIN_B_TOKEN" "$BILL_B_ID" "card" "$BILL_B_COMPLETE_OUT")"
fi
if [[ "$BILL_B_COMPLETE_STATUS" == "200" ]]; then
  record_pass "M4-SETUP-13" "Complete bill B (store B)"
else
  record_fail "M4-SETUP-13" "Complete bill B (status=$BILL_B_COMPLETE_STATUS)"
fi

# Bill C (Store A) - completed for net paid test
BILL_C_CREATE_OUT="$TMP_DIR/bill_c_create.json"
BILL_C_CREATE_STATUS="$(create_bill "$MANAGER_TOKEN" "$PROD_C_ID" "1.00" "$BILL_C_CREATE_OUT")"
BILL_C_ID="$(jq -r '.id // empty' "$BILL_C_CREATE_OUT")"
BILL_C_ITEM_ID="$(jq -r '.items[0].id // empty' "$BILL_C_CREATE_OUT")"
if [[ "$BILL_C_CREATE_STATUS" == "201" && -n "$BILL_C_ID" ]]; then
  record_pass "M4-SETUP-14" "Create bill C draft"
else
  record_fail "M4-SETUP-14" "Create bill C draft (status=$BILL_C_CREATE_STATUS)"
fi

BILL_C_COMPLETE_OUT="$TMP_DIR/bill_c_complete.json"
BILL_C_COMPLETE_STATUS="000"
if [[ -n "$BILL_C_ID" ]]; then
  BILL_C_COMPLETE_STATUS="$(complete_bill "$MANAGER_TOKEN" "$BILL_C_ID" "cash" "$BILL_C_COMPLETE_OUT")"
fi
if [[ "$BILL_C_COMPLETE_STATUS" == "200" ]]; then
  record_pass "M4-SETUP-15" "Complete bill C"
else
  record_fail "M4-SETUP-15" "Complete bill C (status=$BILL_C_COMPLETE_STATUS)"
fi

if [[ -z "$BILL_A_ID" || -z "$BILL_A_ITEM_ID" || -z "$BILL_D_ID" || -z "$BILL_D_ITEM_ID" || -z "$BILL_B_ID" || -z "$BILL_B_ITEM_ID" || -z "$BILL_C_ID" || -z "$BILL_C_ITEM_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# ---------------------------
# Module 4 tests begin
# ---------------------------
RETURN_A_VALID_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "Damaged item",
  "subtotal": "40.00",
  "tax_total": "0.00",
  "refund_amount": "40.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "1.00",
      "unit_price": "40.00",
      "tax": "5.00",
      "reason": "Damaged",
      "condition": "damaged",
      "refund_amount": "40.00"
    }
  ]
}
JSON
)

RETURN_C_VALID_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_C_ID,
  "return_type": "partial",
  "reason": "Customer change",
  "subtotal": "20.00",
  "tax_total": "0.00",
  "refund_amount": "20.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_C_ITEM_ID,
      "product": $PROD_C_ID,
      "original_quantity": "1.00",
      "return_quantity": "1.00",
      "unit_price": "20.00",
      "tax": "5.00",
      "reason": "Customer return",
      "condition": "good",
      "refund_amount": "20.00"
    }
  ]
}
JSON
)

# M4-001 cashier cannot create return
M4001_OUT="$TMP_DIR/m4001_cashier_create.json"
M4001_STATUS="$(api_call POST "$BASE_URL/return/" "$CASHIER_TOKEN" "$RETURN_A_VALID_PAYLOAD" "$M4001_OUT")"
if [[ "$M4001_STATUS" == "403" ]]; then
  record_pass "M4-001" "Cashier cannot create return"
else
  record_fail "M4-001" "Cashier create return expected 403 got $M4001_STATUS"
fi

# M4-002 return for draft bill rejected
M4002_OUT="$TMP_DIR/m4002_draft_bill_return.json"
M4002_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_D_ID,
  "return_type": "partial",
  "reason": "Draft should fail",
  "subtotal": "10.00",
  "tax_total": "0.00",
  "refund_amount": "10.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_D_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "1.00",
      "return_quantity": "1.00",
      "unit_price": "10.00",
      "tax": "5.00",
      "reason": "test",
      "condition": "good",
      "refund_amount": "10.00"
    }
  ]
}
JSON
)
M4002_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4002_PAYLOAD" "$M4002_OUT")"
if [[ "$M4002_STATUS" == "400" ]]; then
  record_pass "M4-002" "Return for draft bill rejected"
else
  record_fail "M4-002" "Draft bill return expected 400 got $M4002_STATUS"
fi

# M4-003 return with no items rejected
M4003_OUT="$TMP_DIR/m4003_no_items.json"
M4003_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "No items",
  "subtotal": "0.00",
  "tax_total": "0.00",
  "refund_amount": "0.00",
  "refund_method": "cash",
  "items": []
}
JSON
)
M4003_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4003_PAYLOAD" "$M4003_OUT")"
if [[ "$M4003_STATUS" == "400" ]]; then
  record_pass "M4-003" "Return create without items rejected"
else
  record_fail "M4-003" "Return without items expected 400 got $M4003_STATUS"
fi

# M4-004 refund mismatch rejected
M4004_OUT="$TMP_DIR/m4004_mismatch.json"
M4004_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "Mismatch",
  "subtotal": "20.00",
  "tax_total": "0.00",
  "refund_amount": "10.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "1.00",
      "unit_price": "20.00",
      "tax": "5.00",
      "reason": "test",
      "condition": "good",
      "refund_amount": "20.00"
    }
  ]
}
JSON
)
M4004_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4004_PAYLOAD" "$M4004_OUT")"
if [[ "$M4004_STATUS" == "400" ]]; then
  record_pass "M4-004" "Return amount mismatch rejected"
else
  record_fail "M4-004" "Return mismatch expected 400 got $M4004_STATUS"
fi

# M4-005 valid return create
M4005_OUT="$TMP_DIR/m4005_return1_create.json"
M4005_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$RETURN_A_VALID_PAYLOAD" "$M4005_OUT")"
RET1_ID="$(jq -r '.id // empty' "$M4005_OUT")"
if [[ "$M4005_STATUS" == "201" && -n "$RET1_ID" ]]; then
  record_pass "M4-005" "Valid return created in pending"
else
  record_fail "M4-005" "Valid return create expected 201 got $M4005_STATUS"
fi

if [[ -z "$RET1_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# M4-006 complete pending blocked
M4006_OUT="$TMP_DIR/m4006_complete_pending.json"
M4006_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/complete/" "$MANAGER_TOKEN" '{}' "$M4006_OUT")"
if [[ "$M4006_STATUS" == "400" ]]; then
  record_pass "M4-006" "Complete pending return blocked"
else
  record_fail "M4-006" "Complete pending expected 400 got $M4006_STATUS"
fi

# M4-007 update pending allowed
M4007_OUT="$TMP_DIR/m4007_patch_pending.json"
M4007_STATUS="$(api_call PATCH "$BASE_URL/return/$RET1_ID/" "$MANAGER_TOKEN" '{"notes":"updated while pending"}' "$M4007_OUT")"
if [[ "$M4007_STATUS" == "200" ]]; then
  record_pass "M4-007" "Update pending return allowed"
else
  record_fail "M4-007" "Update pending expected 200 got $M4007_STATUS"
fi

# M4-008 approve pending
M4008_OUT="$TMP_DIR/m4008_approve.json"
M4008_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/approve/" "$MANAGER_TOKEN" '{}' "$M4008_OUT")"
M4008_RET_STATUS="$(jq -r '.status // empty' "$M4008_OUT")"
if [[ "$M4008_STATUS" == "200" && "$M4008_RET_STATUS" == "approved" ]]; then
  record_pass "M4-008" "Approve pending return"
else
  record_fail "M4-008" "Approve expected 200/approved got $M4008_STATUS/$M4008_RET_STATUS"
fi

# M4-009 approve already approved blocked
M4009_OUT="$TMP_DIR/m4009_reapprove.json"
M4009_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/approve/" "$MANAGER_TOKEN" '{}' "$M4009_OUT")"
if [[ "$M4009_STATUS" == "400" ]]; then
  record_pass "M4-009" "Approve already approved return blocked"
else
  record_fail "M4-009" "Re-approve expected 400 got $M4009_STATUS"
fi

# M4-010 update approved blocked
M4010_OUT="$TMP_DIR/m4010_patch_approved.json"
M4010_STATUS="$(api_call PATCH "$BASE_URL/return/$RET1_ID/" "$MANAGER_TOKEN" '{"notes":"should fail"}' "$M4010_OUT")"
if [[ "$M4010_STATUS" == "400" ]]; then
  record_pass "M4-010" "Update approved return blocked"
else
  record_fail "M4-010" "Update approved expected 400 got $M4010_STATUS"
fi

# M4-011 reject approved blocked
M4011_OUT="$TMP_DIR/m4011_reject_approved.json"
M4011_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/reject/" "$MANAGER_TOKEN" '{"reason":"late"}' "$M4011_OUT")"
if [[ "$M4011_STATUS" == "400" ]]; then
  record_pass "M4-011" "Reject approved return blocked"
else
  record_fail "M4-011" "Reject approved expected 400 got $M4011_STATUS"
fi

STOCK_BEFORE_COMPLETE_OUT="$TMP_DIR/m4_stock_before_complete.json"
STOCK_BEFORE_COMPLETE_STATUS="$(api_call GET "$BASE_URL/inventory/products/$PROD_A_ID/" "$MANAGER_TOKEN" "" "$STOCK_BEFORE_COMPLETE_OUT")"
STOCK_BEFORE_COMPLETE="$(jq -r '.current_stock // 0' "$STOCK_BEFORE_COMPLETE_OUT")"

# M4-012 complete approved
M4012_OUT="$TMP_DIR/m4012_complete_approved.json"
M4012_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/complete/" "$MANAGER_TOKEN" '{}' "$M4012_OUT")"
M4012_RET_STATUS="$(jq -r '.status // empty' "$M4012_OUT")"
if [[ "$M4012_STATUS" == "200" && "$M4012_RET_STATUS" == "completed" ]]; then
  record_pass "M4-012" "Complete approved return"
else
  record_fail "M4-012" "Complete approved expected 200/completed got $M4012_STATUS/$M4012_RET_STATUS"
fi

# M4-013 complete already completed blocked
M4013_OUT="$TMP_DIR/m4013_recomplete.json"
M4013_STATUS="$(api_call POST "$BASE_URL/return/$RET1_ID/complete/" "$MANAGER_TOKEN" '{}' "$M4013_OUT")"
if [[ "$M4013_STATUS" == "400" ]]; then
  record_pass "M4-013" "Complete already completed return blocked"
else
  record_fail "M4-013" "Re-complete expected 400 got $M4013_STATUS"
fi

# M4-014 stock restored
STOCK_AFTER_COMPLETE_OUT="$TMP_DIR/m4_stock_after_complete.json"
STOCK_AFTER_COMPLETE_STATUS="$(api_call GET "$BASE_URL/inventory/products/$PROD_A_ID/" "$MANAGER_TOKEN" "" "$STOCK_AFTER_COMPLETE_OUT")"
STOCK_AFTER_COMPLETE="$(jq -r '.current_stock // 0' "$STOCK_AFTER_COMPLETE_OUT")"
if [[ "$STOCK_BEFORE_COMPLETE_STATUS" == "200" && "$STOCK_AFTER_COMPLETE_STATUS" == "200" ]]; then
  EXPECTED="$(to2 "$(awk -v b="$STOCK_BEFORE_COMPLETE" 'BEGIN{print b+1.0}')")"
  ACTUAL="$(to2 "$STOCK_AFTER_COMPLETE")"
  if [[ "$ACTUAL" == "$EXPECTED" ]]; then
    record_pass "M4-014" "Stock increased by return quantity"
  else
    record_fail "M4-014" "Stock restore mismatch expected=$EXPECTED actual=$ACTUAL"
  fi
else
  record_fail "M4-014" "Unable to verify stock restore"
fi

# M4-015 refund negative payment exists
M4015_PAY_OUT="$TMP_DIR/m4015_bill_a_payments.json"
M4015_PAY_STATUS="$(api_call GET "$BASE_URL/sales/payments/?bill=$BILL_A_ID&page_size=200" "$MANAGER_TOKEN" "" "$M4015_PAY_OUT")"
NEG_COUNT="$(jq '[.results[] | select((.amount|tonumber) < 0)] | length' "$M4015_PAY_OUT" 2>/dev/null)"
if [[ "$M4015_PAY_STATUS" == "200" && "$NEG_COUNT" -ge 1 ]]; then
  record_pass "M4-015" "Refund posting created negative payment"
else
  record_fail "M4-015" "Expected negative payment after return complete"
fi

# M4-016 over-return rejected after completed return qty
M4016_OUT="$TMP_DIR/m4016_overreturn.json"
M4016_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "Over return",
  "subtotal": "120.00",
  "tax_total": "0.00",
  "refund_amount": "120.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "3.00",
      "unit_price": "40.00",
      "tax": "5.00",
      "reason": "over",
      "condition": "good",
      "refund_amount": "120.00"
    }
  ]
}
JSON
)
M4016_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4016_PAYLOAD" "$M4016_OUT")"
if [[ "$M4016_STATUS" == "400" ]]; then
  record_pass "M4-016" "Over-return quantity rejected"
else
  record_fail "M4-016" "Over-return expected 400 got $M4016_STATUS"
fi

# M4-017 create second pending return
M4017_OUT="$TMP_DIR/m4017_return2_create.json"
M4017_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "Second pending",
  "subtotal": "30.00",
  "tax_total": "0.00",
  "refund_amount": "30.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "1.00",
      "unit_price": "30.00",
      "tax": "5.00",
      "reason": "second",
      "condition": "good",
      "refund_amount": "30.00"
    }
  ]
}
JSON
)
M4017_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4017_PAYLOAD" "$M4017_OUT")"
RET2_ID="$(jq -r '.id // empty' "$M4017_OUT")"
if [[ "$M4017_STATUS" == "201" && -n "$RET2_ID" ]]; then
  record_pass "M4-017" "Second pending return created"
else
  record_fail "M4-017" "Second pending return expected 201 got $M4017_STATUS"
fi

# M4-018 reject pending return works
M4018_OUT="$TMP_DIR/m4018_reject_ret2.json"
M4018_STATUS="000"
if [[ -n "$RET2_ID" ]]; then
  M4018_STATUS="$(api_call POST "$BASE_URL/return/$RET2_ID/reject/" "$MANAGER_TOKEN" '{"reason":"policy"}' "$M4018_OUT")"
fi
M4018_RET_STATUS="$(jq -r '.status // empty' "$M4018_OUT" 2>/dev/null)"
if [[ "$M4018_STATUS" == "200" && "$M4018_RET_STATUS" == "rejected" ]]; then
  record_pass "M4-018" "Reject pending return works"
else
  record_fail "M4-018" "Reject pending expected 200/rejected got $M4018_STATUS/$M4018_RET_STATUS"
fi

# M4-019 complete rejected blocked
M4019_OUT="$TMP_DIR/m4019_complete_rejected.json"
M4019_STATUS="000"
if [[ -n "$RET2_ID" ]]; then
  M4019_STATUS="$(api_call POST "$BASE_URL/return/$RET2_ID/complete/" "$MANAGER_TOKEN" '{}' "$M4019_OUT")"
fi
if [[ "$M4019_STATUS" == "400" ]]; then
  record_pass "M4-019" "Complete rejected return blocked"
else
  record_fail "M4-019" "Complete rejected expected 400 got $M4019_STATUS"
fi

# M4-020 create temp pending return for soft delete
M4020_OUT="$TMP_DIR/m4020_return3_create.json"
M4020_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "Temp delete",
  "subtotal": "20.00",
  "tax_total": "0.00",
  "refund_amount": "20.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "1.00",
      "unit_price": "20.00",
      "tax": "5.00",
      "reason": "temp",
      "condition": "good",
      "refund_amount": "20.00"
    }
  ]
}
JSON
)
M4020_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4020_PAYLOAD" "$M4020_OUT")"
RET3_ID="$(jq -r '.id // empty' "$M4020_OUT")"
if [[ "$M4020_STATUS" == "201" && -n "$RET3_ID" ]]; then
  record_pass "M4-020" "Create temp pending return"
else
  record_fail "M4-020" "Create temp pending return expected 201 got $M4020_STATUS"
fi

# M4-021 soft delete return
M4021_OUT="$TMP_DIR/m4021_delete_ret3.json"
M4021_STATUS="000"
if [[ -n "$RET3_ID" ]]; then
  M4021_STATUS="$(api_call DELETE "$BASE_URL/return/$RET3_ID/" "$MANAGER_TOKEN" "" "$M4021_OUT")"
fi
if [[ "$M4021_STATUS" == "204" ]]; then
  record_pass "M4-021" "Soft delete return endpoint returns 204"
else
  record_fail "M4-021" "Soft delete expected 204 got $M4021_STATUS"
fi

# M4-022 deleted return hidden in default list
M4022_OUT="$TMP_DIR/m4022_list_default.json"
M4022_STATUS="$(api_call GET "$BASE_URL/return/?page_size=200" "$MANAGER_TOKEN" "" "$M4022_OUT")"
RET3_IN_DEFAULT="$(jq --argjson rid "${RET3_ID:-0}" '[.results[] | select(.id == $rid)] | length' "$M4022_OUT" 2>/dev/null)"
if [[ "$M4022_STATUS" == "200" && "$RET3_IN_DEFAULT" == "0" ]]; then
  record_pass "M4-022" "Soft-deleted return hidden by default"
else
  record_fail "M4-022" "Soft-deleted return should be hidden in default list"
fi

# M4-023 deleted return visible with include_inactive=true
M4023_OUT="$TMP_DIR/m4023_list_inactive.json"
M4023_STATUS="$(api_call GET "$BASE_URL/return/?include_inactive=true&page_size=200" "$MANAGER_TOKEN" "" "$M4023_OUT")"
RET3_IN_INACTIVE="$(jq --argjson rid "${RET3_ID:-0}" '[.results[] | select(.id == $rid)] | length' "$M4023_OUT" 2>/dev/null)"
if [[ "$M4023_STATUS" == "200" && "$RET3_IN_INACTIVE" -ge 1 ]]; then
  record_pass "M4-023" "Soft-deleted return visible with include_inactive"
else
  record_fail "M4-023" "Soft-deleted return should appear with include_inactive=true"
fi

# M4-024 create return for store B bill
M4024_OUT="$TMP_DIR/m4024_storeb_return_create.json"
M4024_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_B_ID,
  "return_type": "partial",
  "reason": "Store B return",
  "subtotal": "20.00",
  "tax_total": "0.00",
  "refund_amount": "20.00",
  "refund_method": "card",
  "items": [
    {
      "bill_item": $BILL_B_ITEM_ID,
      "product": $PROD_B_ID,
      "original_quantity": "2.00",
      "return_quantity": "1.00",
      "unit_price": "20.00",
      "tax": "5.00",
      "reason": "store b test",
      "condition": "good",
      "refund_amount": "20.00"
    }
  ]
}
JSON
)
M4024_STATUS="$(api_call POST "$BASE_URL/return/" "$ADMIN_B_TOKEN" "$M4024_PAYLOAD" "$M4024_OUT")"
RET_B_ID="$(jq -r '.id // empty' "$M4024_OUT")"
if [[ "$M4024_STATUS" == "201" && -n "$RET_B_ID" ]]; then
  record_pass "M4-024" "Store B return create works"
else
  record_fail "M4-024" "Store B return create expected 201 got $M4024_STATUS"
fi

# M4-025 admin A cannot access store B return detail
M4025_OUT="$TMP_DIR/m4025_admina_get_storeb_return.json"
M4025_STATUS="000"
if [[ -n "$RET_B_ID" ]]; then
  M4025_STATUS="$(api_call GET "$BASE_URL/return/$RET_B_ID/" "$ADMIN_A_TOKEN" "" "$M4025_OUT")"
fi
if [[ "$M4025_STATUS" == "404" ]]; then
  record_pass "M4-025" "Store A admin cannot access Store B return"
else
  record_fail "M4-025" "Store A admin scope expected 404 got $M4025_STATUS"
fi

# M4-026 manager A cannot access store B return detail
M4026_OUT="$TMP_DIR/m4026_manager_get_storeb_return.json"
M4026_STATUS="000"
if [[ -n "$RET_B_ID" ]]; then
  M4026_STATUS="$(api_call GET "$BASE_URL/return/$RET_B_ID/" "$MANAGER_TOKEN" "" "$M4026_OUT")"
fi
if [[ "$M4026_STATUS" == "404" ]]; then
  record_pass "M4-026" "Manager A cannot access Store B return"
else
  record_fail "M4-026" "Manager A scope expected 404 got $M4026_STATUS"
fi

# M4-027 list for admin A excludes store B return
M4027_OUT="$TMP_DIR/m4027_admina_list_returns.json"
M4027_STATUS="$(api_call GET "$BASE_URL/return/?page_size=200" "$ADMIN_A_TOKEN" "" "$M4027_OUT")"
RET_B_IN_LIST="$(jq --argjson rid "${RET_B_ID:-0}" '[.results[] | select(.id == $rid)] | length' "$M4027_OUT" 2>/dev/null)"
if [[ "$M4027_STATUS" == "200" && "$RET_B_IN_LIST" == "0" ]]; then
  record_pass "M4-027" "Store A return list excludes Store B returns"
else
  record_fail "M4-027" "Store A list scope leak detected for Store B return"
fi

# M4-028 store A admin cannot create return for store B bill (expected blocked)
M4028_OUT="$TMP_DIR/m4028_admina_cross_store_create.json"
M4028_STATUS="$(api_call POST "$BASE_URL/return/" "$ADMIN_A_TOKEN" "$M4024_PAYLOAD" "$M4028_OUT")"
if [[ "$M4028_STATUS" == "400" || "$M4028_STATUS" == "403" || "$M4028_STATUS" == "404" ]]; then
  record_pass "M4-028" "Store A admin cross-store return create blocked"
else
  record_fail "M4-028" "Cross-store return create should be blocked, got $M4028_STATUS"
fi

# M4-029 cashier cannot approve return
M4029_OUT="$TMP_DIR/m4029_cashier_approve.json"
M4029_STATUS="000"
if [[ -n "$RET_B_ID" ]]; then
  M4029_STATUS="$(api_call POST "$BASE_URL/return/$RET_B_ID/approve/" "$CASHIER_TOKEN" '{}' "$M4029_OUT")"
fi
if [[ "$M4029_STATUS" == "403" ]]; then
  record_pass "M4-029" "Cashier cannot approve return"
else
  record_fail "M4-029" "Cashier approve should be 403 got $M4029_STATUS"
fi

# M4-030 refund bill C original payment
M4030_PAYLIST_OUT="$TMP_DIR/m4030_billc_paylist.json"
M4030_PAYLIST_STATUS="$(api_call GET "$BASE_URL/sales/payments/?bill=$BILL_C_ID&page_size=200" "$MANAGER_TOKEN" "" "$M4030_PAYLIST_OUT")"
PAY_C_ID="$(jq -r '.results[] | select(.status=="completed" and (.amount|tonumber) > 0) | .id' "$M4030_PAYLIST_OUT" | head -n1)"
M4030_REFUND_OUT="$TMP_DIR/m4030_billc_refund.json"
M4030_REFUND_STATUS="000"
if [[ -n "$PAY_C_ID" ]]; then
  M4030_REFUND_STATUS="$(api_call POST "$BASE_URL/sales/payments/$PAY_C_ID/refund/" "$MANAGER_TOKEN" '{}' "$M4030_REFUND_OUT")"
fi
if [[ "$M4030_PAYLIST_STATUS" == "200" && -n "$PAY_C_ID" && "$M4030_REFUND_STATUS" == "200" ]]; then
  record_pass "M4-030" "Refund bill C payment for net-paid check"
else
  record_fail "M4-030" "Bill C payment refund setup failed"
fi

# M4-031 create return C
M4031_OUT="$TMP_DIR/m4031_returnc_create.json"
M4031_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$RETURN_C_VALID_PAYLOAD" "$M4031_OUT")"
RET_C_ID="$(jq -r '.id // empty' "$M4031_OUT")"
if [[ "$M4031_STATUS" == "201" && -n "$RET_C_ID" ]]; then
  record_pass "M4-031" "Create return C"
else
  record_fail "M4-031" "Create return C expected 201 got $M4031_STATUS"
fi

# M4-032 approve return C
M4032_OUT="$TMP_DIR/m4032_returnc_approve.json"
M4032_STATUS="000"
if [[ -n "$RET_C_ID" ]]; then
  M4032_STATUS="$(api_call POST "$BASE_URL/return/$RET_C_ID/approve/" "$MANAGER_TOKEN" '{}' "$M4032_OUT")"
fi
if [[ "$M4032_STATUS" == "200" ]]; then
  record_pass "M4-032" "Approve return C"
else
  record_fail "M4-032" "Approve return C expected 200 got $M4032_STATUS"
fi

# M4-033 complete return C blocked when refund > net paid
M4033_OUT="$TMP_DIR/m4033_returnc_complete.json"
M4033_STATUS="000"
if [[ -n "$RET_C_ID" ]]; then
  M4033_STATUS="$(api_call POST "$BASE_URL/return/$RET_C_ID/complete/" "$MANAGER_TOKEN" '{}' "$M4033_OUT")"
fi
if [[ "$M4033_STATUS" == "400" ]]; then
  record_pass "M4-033" "Complete return blocked when refund exceeds net paid"
else
  record_fail "M4-033" "Expected refund>net_paid block (400) got $M4033_STATUS"
fi

# M4-034 refund amount cannot exceed bill total (validation)
M4034_OUT="$TMP_DIR/m4034_refund_gt_total.json"
M4034_PAYLOAD=$(cat <<JSON
{
  "bill": $BILL_A_ID,
  "return_type": "partial",
  "reason": "too high",
  "subtotal": "999.00",
  "tax_total": "0.00",
  "refund_amount": "999.00",
  "refund_method": "cash",
  "items": [
    {
      "bill_item": $BILL_A_ITEM_ID,
      "product": $PROD_A_ID,
      "original_quantity": "3.00",
      "return_quantity": "1.00",
      "unit_price": "999.00",
      "tax": "5.00",
      "reason": "too high",
      "condition": "good",
      "refund_amount": "999.00"
    }
  ]
}
JSON
)
M4034_STATUS="$(api_call POST "$BASE_URL/return/" "$MANAGER_TOKEN" "$M4034_PAYLOAD" "$M4034_OUT")"
if [[ "$M4034_STATUS" == "400" ]]; then
  record_pass "M4-034" "Return refund amount greater than bill total rejected"
else
  record_fail "M4-034" "Refund > bill total expected 400 got $M4034_STATUS"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
