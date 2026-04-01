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

# -------------
# Setup / login
# -------------
ADMIN_A_LOGIN_JSON="$TMP_DIR/admin_a_login.json"
ADMIN_B_LOGIN_JSON="$TMP_DIR/admin_b_login.json"
MANAGER_LOGIN_JSON="$TMP_DIR/manager_login.json"
CASHIER_LOGIN_JSON="$TMP_DIR/cashier_login.json"

ADMIN_A_TOKEN="$(login_and_get_token "$ADMIN_A_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_A_LOGIN_JSON")"
ADMIN_B_TOKEN="$(login_and_get_token "$ADMIN_B_EMAIL" "$ADMIN_PASSWORD" "$ADMIN_B_LOGIN_JSON")"
MANAGER_TOKEN="$(login_and_get_token "$MANAGER_A_EMAIL" "$MANAGER_PASSWORD" "$MANAGER_LOGIN_JSON")"
CASHIER_TOKEN="$(login_and_get_token "$CASHIER_A_EMAIL" "$CASHIER_PASSWORD" "$CASHIER_LOGIN_JSON")"

if [[ -n "$ADMIN_A_TOKEN" ]]; then
  record_pass "M3-SETUP-01" "Admin A login"
else
  record_fail "M3-SETUP-01" "Admin A login failed"
fi

if [[ -n "$ADMIN_B_TOKEN" ]]; then
  record_pass "M3-SETUP-02" "Admin B login"
else
  record_fail "M3-SETUP-02" "Admin B login failed"
fi

if [[ -n "$MANAGER_TOKEN" ]]; then
  record_pass "M3-SETUP-03" "Manager A login"
else
  record_fail "M3-SETUP-03" "Manager A login failed"
fi

if [[ -n "$CASHIER_TOKEN" ]]; then
  record_pass "M3-SETUP-04" "Cashier A login"
else
  record_fail "M3-SETUP-04" "Cashier A login failed"
fi

if [[ -z "$ADMIN_A_TOKEN" || -z "$ADMIN_B_TOKEN" || -z "$MANAGER_TOKEN" || -z "$CASHIER_TOKEN" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR"
  exit 1
fi

STORE_A_ID="$(jq -r '.store_id // empty' "$MANAGER_LOGIN_JSON")"
STORE_B_ID="$(jq -r '.store_id // empty' "$ADMIN_B_LOGIN_JSON")"
[[ -z "$STORE_A_ID" ]] && STORE_A_ID="11"
[[ -z "$STORE_B_ID" ]] && STORE_B_ID="12"

# -------------------------
# Create products for tests
# -------------------------
CATEGORY_CREATE_OUT="$TMP_DIR/category_create.json"
CATEGORY_NAME="SalesCat-$TS"
CATEGORY_STATUS="$(api_call POST "$BASE_URL/inventory/categories/" "$MANAGER_TOKEN" "{\"name\":\"$CATEGORY_NAME\"}" "$CATEGORY_CREATE_OUT")"
if [[ "$CATEGORY_STATUS" == "201" ]]; then
  CATEGORY_ID="$(jq -r '.id' "$CATEGORY_CREATE_OUT")"
  record_pass "M3-SETUP-05" "Create sales category"
else
  CATEGORY_ID="35"
  record_fail "M3-SETUP-05" "Create sales category (status=$CATEGORY_STATUS)"
fi

PRODUCT_A_OUT="$TMP_DIR/product_a_create.json"
BARCODE_A="M3A$TS"
PRODUCT_A_PAYLOAD=$(cat <<JSON
{
  "name":"M3 Product A $TS",
  "barcode":"$BARCODE_A",
  "category":$CATEGORY_ID,
  "price":"120.00",
  "cost_price":"90.00",
  "tax":5,
  "unit":"piece",
  "quantity":"12.00",
  "min_stock":"1.00",
  "store":$STORE_A_ID
}
JSON
)
PRODUCT_A_STATUS="$(api_call POST "$BASE_URL/inventory/products/" "$MANAGER_TOKEN" "$PRODUCT_A_PAYLOAD" "$PRODUCT_A_OUT")"
PRODUCT_A_ID="$(jq -r '.id // empty' "$PRODUCT_A_OUT")"

if [[ "$PRODUCT_A_STATUS" == "201" && -n "$PRODUCT_A_ID" ]]; then
  record_pass "M3-SETUP-06" "Create Store A product"
else
  record_fail "M3-SETUP-06" "Create Store A product (status=$PRODUCT_A_STATUS)"
fi

PRODUCT_B_OUT="$TMP_DIR/product_b_create.json"
BARCODE_B="M3B$TS"
PRODUCT_B_PAYLOAD=$(cat <<JSON
{
  "name":"M3 Product B $TS",
  "barcode":"$BARCODE_B",
  "price":"95.00",
  "cost_price":"70.00",
  "tax":5,
  "unit":"piece",
  "quantity":"10.00",
  "min_stock":"1.00",
  "store":$STORE_B_ID
}
JSON
)
PRODUCT_B_STATUS="$(api_call POST "$BASE_URL/inventory/products/" "$ADMIN_B_TOKEN" "$PRODUCT_B_PAYLOAD" "$PRODUCT_B_OUT")"
PRODUCT_B_ID="$(jq -r '.id // empty' "$PRODUCT_B_OUT")"
if [[ "$PRODUCT_B_STATUS" == "201" && -n "$PRODUCT_B_ID" ]]; then
  record_pass "M3-SETUP-07" "Create Store B product"
else
  record_fail "M3-SETUP-07" "Create Store B product (status=$PRODUCT_B_STATUS)"
fi

if [[ -z "$PRODUCT_A_ID" || -z "$PRODUCT_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR"
  exit 1
fi

# -------------------------
# Module 3 Billing/Sales
# -------------------------
STOCK_BEFORE_OUT="$TMP_DIR/stock_before.json"
STOCK_BEFORE_STATUS="$(api_call GET "$BASE_URL/inventory/products/$PRODUCT_A_ID/" "$MANAGER_TOKEN" "" "$STOCK_BEFORE_OUT")"
STOCK_BEFORE="$(jq -r '.current_stock // 0' "$STOCK_BEFORE_OUT")"
if [[ "$STOCK_BEFORE_STATUS" == "200" ]]; then
  record_pass "M3-001" "Read initial stock for product A"
else
  record_fail "M3-001" "Read initial stock for product A (status=$STOCK_BEFORE_STATUS)"
fi

BILL_EMPTY_OUT="$TMP_DIR/bill_empty.json"
BILL_EMPTY_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$MANAGER_TOKEN" '{"items":[]}' "$BILL_EMPTY_OUT")"
if [[ "$BILL_EMPTY_STATUS" == "400" ]]; then
  record_pass "M3-002" "Create bill with empty items rejected"
else
  record_fail "M3-002" "Create bill with empty items expected 400 got $BILL_EMPTY_STATUS"
fi

BILL_OVER_OUT="$TMP_DIR/bill_overstock.json"
BILL_OVER_PAYLOAD=$(cat <<JSON
{
  "items":[{"product_id":$PRODUCT_A_ID,"quantity":"999.00","rate":"120.00"}]
}
JSON
)
BILL_OVER_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$MANAGER_TOKEN" "$BILL_OVER_PAYLOAD" "$BILL_OVER_OUT")"
if [[ "$BILL_OVER_STATUS" == "400" ]]; then
  record_pass "M3-003" "Create bill with overstock quantity rejected"
else
  record_fail "M3-003" "Create bill with overstock expected 400 got $BILL_OVER_STATUS"
fi

BILL1_CREATE_OUT="$TMP_DIR/bill1_create.json"
BILL1_PAYLOAD=$(cat <<JSON
{
  "notes":"M3 E2E bill",
  "items":[
    {"product_id":$PRODUCT_A_ID,"quantity":"2.00","rate":"120.00","discount_rate":"0"}
  ]
}
JSON
)
BILL1_CREATE_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$MANAGER_TOKEN" "$BILL1_PAYLOAD" "$BILL1_CREATE_OUT")"
BILL1_ID="$(jq -r '.id // empty' "$BILL1_CREATE_OUT")"
BILL1_TOTAL="$(jq -r '.total // empty' "$BILL1_CREATE_OUT")"
if [[ "$BILL1_CREATE_STATUS" == "201" && -n "$BILL1_ID" ]]; then
  record_pass "M3-004" "Create draft bill with valid items"
else
  record_fail "M3-004" "Create draft bill expected 201 got $BILL1_CREATE_STATUS"
fi

if [[ -z "$BILL1_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR"
  exit 1
fi

SPLIT_BAD_OUT="$TMP_DIR/split_bad.json"
SPLIT_BAD_PAYLOAD='{"payments":[{"payment_method":"cash","amount":"1.00"}]}'
SPLIT_BAD_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/validate_payment_split/" "$MANAGER_TOKEN" "$SPLIT_BAD_PAYLOAD" "$SPLIT_BAD_OUT")"
SPLIT_BAD_VALID="$(jq -r 'if has("valid") then (.valid|tostring) else "null" end' "$SPLIT_BAD_OUT")"
if [[ "$SPLIT_BAD_STATUS" == "200" && "$SPLIT_BAD_VALID" == "false" ]]; then
  record_pass "M3-005" "Invalid payment split detected"
else
  record_fail "M3-005" "Invalid split expected valid=false got status=$SPLIT_BAD_STATUS valid=$SPLIT_BAD_VALID"
fi

SPLIT_GOOD_OUT="$TMP_DIR/split_good.json"
SPLIT_GOOD_PAYLOAD=$(cat <<JSON
{"payments":[{"payment_method":"upi","amount":"$BILL1_TOTAL"}]}
JSON
)
SPLIT_GOOD_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/validate_payment_split/" "$MANAGER_TOKEN" "$SPLIT_GOOD_PAYLOAD" "$SPLIT_GOOD_OUT")"
SPLIT_GOOD_VALID="$(jq -r 'if has("valid") then (.valid|tostring) else "null" end' "$SPLIT_GOOD_OUT")"
if [[ "$SPLIT_GOOD_STATUS" == "200" && "$SPLIT_GOOD_VALID" == "true" ]]; then
  record_pass "M3-006" "Valid payment split accepted"
else
  record_fail "M3-006" "Valid split expected valid=true got status=$SPLIT_GOOD_STATUS valid=$SPLIT_GOOD_VALID"
fi

HOLD_OUT="$TMP_DIR/bill_hold.json"
HOLD_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/hold/" "$MANAGER_TOKEN" '{}' "$HOLD_OUT")"
HOLD_BILL_STATUS="$(jq -r '.status // empty' "$HOLD_OUT")"
if [[ "$HOLD_STATUS" == "200" && "$HOLD_BILL_STATUS" == "on_hold" ]]; then
  record_pass "M3-007" "Bill hold works"
else
  record_fail "M3-007" "Bill hold expected on_hold got status=$HOLD_STATUS bill_status=$HOLD_BILL_STATUS"
fi

RESUME_OUT="$TMP_DIR/bill_resume.json"
RESUME_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/resume/" "$MANAGER_TOKEN" '{}' "$RESUME_OUT")"
RESUME_BILL_STATUS="$(jq -r '.status // empty' "$RESUME_OUT")"
if [[ "$RESUME_STATUS" == "200" && "$RESUME_BILL_STATUS" == "draft" ]]; then
  record_pass "M3-008" "Bill resume works"
else
  record_fail "M3-008" "Bill resume expected draft got status=$RESUME_STATUS bill_status=$RESUME_BILL_STATUS"
fi

COMPLETE_NO_PAY_OUT="$TMP_DIR/complete_no_payment_method.json"
COMPLETE_NO_PAY_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/complete/" "$MANAGER_TOKEN" '{}' "$COMPLETE_NO_PAY_OUT")"
if [[ "$COMPLETE_NO_PAY_STATUS" == "400" ]]; then
  record_pass "M3-009" "Complete without payment_method and unpaid rejected"
else
  record_fail "M3-009" "Complete unpaid without payment_method expected 400 got $COMPLETE_NO_PAY_STATUS"
fi

PARTIAL_PAYMENT_OUT="$TMP_DIR/partial_payment.json"
PARTIAL_PAYMENT_STATUS="$(api_call POST "$BASE_URL/sales/payments/" "$MANAGER_TOKEN" "{\"bill\":$BILL1_ID,\"amount\":\"1.00\",\"payment_method\":\"cash\"}" "$PARTIAL_PAYMENT_OUT")"
if [[ "$PARTIAL_PAYMENT_STATUS" == "201" ]]; then
  record_pass "M3-010" "Create partial payment"
else
  record_fail "M3-010" "Create partial payment expected 201 got $PARTIAL_PAYMENT_STATUS"
fi

COMPLETE_OUT="$TMP_DIR/bill_complete.json"
COMPLETE_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/complete/" "$MANAGER_TOKEN" '{"payment_method":"upi"}' "$COMPLETE_OUT")"
COMPLETE_BILL_STATUS="$(jq -r '.status // empty' "$COMPLETE_OUT")"
COMPLETE_INVOICE="$(jq -r '.invoice_number // empty' "$COMPLETE_OUT")"
if [[ "$COMPLETE_STATUS" == "200" && "$COMPLETE_BILL_STATUS" == "completed" && -n "$COMPLETE_INVOICE" && "$COMPLETE_INVOICE" != "null" ]]; then
  record_pass "M3-011" "Complete bill generates invoice and completes"
else
  record_fail "M3-011" "Complete bill expected completed+invoice got status=$COMPLETE_STATUS bill_status=$COMPLETE_BILL_STATUS invoice=$COMPLETE_INVOICE"
fi

RECEIPT_GET_OUT="$TMP_DIR/receipt_get.json"
RECEIPT_GET_STATUS="$(api_call GET "$BASE_URL/sales/bills/$BILL1_ID/receipt/" "$MANAGER_TOKEN" "" "$RECEIPT_GET_OUT")"
RECEIPT_PRINT_TYPE="$(jq -r '.meta.print_type // empty' "$RECEIPT_GET_OUT")"
if [[ "$RECEIPT_GET_STATUS" == "200" && "$RECEIPT_PRINT_TYPE" == "original_view" ]]; then
  record_pass "M3-012" "Receipt GET works for completed bill"
else
  record_fail "M3-012" "Receipt GET expected original_view got status=$RECEIPT_GET_STATUS type=$RECEIPT_PRINT_TYPE"
fi

RECEIPT_POST_OUT="$TMP_DIR/receipt_post.json"
RECEIPT_POST_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/receipt/" "$MANAGER_TOKEN" '{}' "$RECEIPT_POST_OUT")"
RECEIPT_POST_TYPE="$(jq -r '.meta.print_type // empty' "$RECEIPT_POST_OUT")"
if [[ "$RECEIPT_POST_STATUS" == "200" && "$RECEIPT_POST_TYPE" == "reprint" ]]; then
  record_pass "M3-013" "Receipt reprint POST works"
else
  record_fail "M3-013" "Receipt POST expected reprint got status=$RECEIPT_POST_STATUS type=$RECEIPT_POST_TYPE"
fi

CANCEL_COMPLETED_OUT="$TMP_DIR/cancel_completed.json"
CANCEL_COMPLETED_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/cancel/" "$MANAGER_TOKEN" '{}' "$CANCEL_COMPLETED_OUT")"
if [[ "$CANCEL_COMPLETED_STATUS" == "400" ]]; then
  record_pass "M3-014" "Cancel completed bill blocked"
else
  record_fail "M3-014" "Cancel completed expected 400 got $CANCEL_COMPLETED_STATUS"
fi

ADD_ITEM_COMPLETED_OUT="$TMP_DIR/add_item_completed.json"
ADD_ITEM_COMPLETED_PAYLOAD=$(cat <<JSON
{"product":$PRODUCT_A_ID,"quantity":"1.00","price":"120.00","discount_rate":"0","tax_rate":"5"}
JSON
)
ADD_ITEM_COMPLETED_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL1_ID/items/" "$MANAGER_TOKEN" "$ADD_ITEM_COMPLETED_PAYLOAD" "$ADD_ITEM_COMPLETED_OUT")"
if [[ "$ADD_ITEM_COMPLETED_STATUS" == "400" ]]; then
  record_pass "M3-015" "Cannot add items to completed bill"
else
  record_fail "M3-015" "Add item to completed expected 400 got $ADD_ITEM_COMPLETED_STATUS"
fi

STOCK_AFTER_OUT="$TMP_DIR/stock_after.json"
STOCK_AFTER_STATUS="$(api_call GET "$BASE_URL/inventory/products/$PRODUCT_A_ID/" "$MANAGER_TOKEN" "" "$STOCK_AFTER_OUT")"
STOCK_AFTER="$(jq -r '.current_stock // 0' "$STOCK_AFTER_OUT")"
EXPECTED_STOCK="$(awk -v b="$STOCK_BEFORE" 'BEGIN{printf "%.2f", b-2.00}')"
if [[ "$STOCK_AFTER_STATUS" == "200" ]]; then
  STOCK_AFTER_FMT="$(awk -v a="$STOCK_AFTER" 'BEGIN{printf "%.2f", a}')"
  if [[ "$STOCK_AFTER_FMT" == "$EXPECTED_STOCK" ]]; then
    record_pass "M3-016" "Stock reduced correctly after bill completion"
  else
    record_fail "M3-016" "Stock mismatch expected=$EXPECTED_STOCK actual=$STOCK_AFTER_FMT"
  fi
else
  record_fail "M3-016" "Could not read stock after bill completion status=$STOCK_AFTER_STATUS"
fi

BILL1_PAYMENTS_OUT="$TMP_DIR/bill1_payments.json"
BILL1_PAYMENTS_STATUS="$(api_call GET "$BASE_URL/sales/payments/?bill=$BILL1_ID" "$MANAGER_TOKEN" "" "$BILL1_PAYMENTS_OUT")"
PAYMENT1_ID="$(jq -r '.results[0].id // empty' "$BILL1_PAYMENTS_OUT")"
if [[ "$BILL1_PAYMENTS_STATUS" == "200" && -n "$PAYMENT1_ID" ]]; then
  record_pass "M3-017" "Payment list for bill available"
else
  record_fail "M3-017" "Payment list for bill failed status=$BILL1_PAYMENTS_STATUS"
fi

if [[ -n "$PAYMENT1_ID" ]]; then
  REFUND_OUT="$TMP_DIR/payment_refund.json"
  REFUND_STATUS="$(api_call POST "$BASE_URL/sales/payments/$PAYMENT1_ID/refund/" "$MANAGER_TOKEN" '{}' "$REFUND_OUT")"
  REFUND_PAYMENT_STATUS="$(jq -r '.status // empty' "$REFUND_OUT")"
  if [[ "$REFUND_STATUS" == "200" && "$REFUND_PAYMENT_STATUS" == "refunded" ]]; then
    record_pass "M3-018" "Payment refund endpoint works"
  else
    record_fail "M3-018" "Payment refund expected 200/refunded got status=$REFUND_STATUS payment_status=$REFUND_PAYMENT_STATUS"
  fi
else
  record_fail "M3-018" "Skipped refund because payment id missing"
fi

BILL2_CREATE_OUT="$TMP_DIR/bill2_create.json"
BILL2_PAYLOAD=$(cat <<JSON
{"items":[{"product_id":$PRODUCT_A_ID,"quantity":"1.00","rate":"120.00"}]}
JSON
)
BILL2_CREATE_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$MANAGER_TOKEN" "$BILL2_PAYLOAD" "$BILL2_CREATE_OUT")"
BILL2_ID="$(jq -r '.id // empty' "$BILL2_CREATE_OUT")"
if [[ "$BILL2_CREATE_STATUS" == "201" && -n "$BILL2_ID" ]]; then
  record_pass "M3-019" "Create second draft bill"
else
  record_fail "M3-019" "Create second draft bill failed status=$BILL2_CREATE_STATUS"
fi

if [[ -n "$BILL2_ID" ]]; then
  BILL2_CANCEL_OUT="$TMP_DIR/bill2_cancel.json"
  BILL2_CANCEL_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL2_ID/cancel/" "$MANAGER_TOKEN" '{}' "$BILL2_CANCEL_OUT")"
  BILL2_CANCEL_STATE="$(jq -r '.status // empty' "$BILL2_CANCEL_OUT")"
  if [[ "$BILL2_CANCEL_STATUS" == "200" && "$BILL2_CANCEL_STATE" == "cancelled" ]]; then
    record_pass "M3-020" "Cancel draft bill works"
  else
    record_fail "M3-020" "Cancel draft bill expected cancelled got status=$BILL2_CANCEL_STATUS state=$BILL2_CANCEL_STATE"
  fi

  BILL2_COMPLETE_OUT="$TMP_DIR/bill2_complete.json"
  BILL2_COMPLETE_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL2_ID/complete/" "$MANAGER_TOKEN" '{"payment_method":"cash"}' "$BILL2_COMPLETE_OUT")"
  if [[ "$BILL2_COMPLETE_STATUS" == "400" ]]; then
    record_pass "M3-021" "Complete cancelled bill blocked"
  else
    record_fail "M3-021" "Complete cancelled expected 400 got $BILL2_COMPLETE_STATUS"
  fi
else
  record_fail "M3-020" "Skipped bill2 cancel because bill2 missing"
  record_fail "M3-021" "Skipped complete-cancelled because bill2 missing"
fi

# Cashier flow
BILL_CASHIER_OUT="$TMP_DIR/bill_cashier_create.json"
BILL_CASHIER_PAYLOAD=$(cat <<JSON
{"items":[{"product_id":$PRODUCT_A_ID,"quantity":"1.00","rate":"120.00"}]}
JSON
)
BILL_CASHIER_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$CASHIER_TOKEN" "$BILL_CASHIER_PAYLOAD" "$BILL_CASHIER_OUT")"
BILL_CASHIER_ID="$(jq -r '.id // empty' "$BILL_CASHIER_OUT")"
if [[ "$BILL_CASHIER_STATUS" == "201" && -n "$BILL_CASHIER_ID" ]]; then
  record_pass "M3-022" "Cashier can create bill"
else
  record_fail "M3-022" "Cashier create bill failed status=$BILL_CASHIER_STATUS"
fi

if [[ -n "$BILL_CASHIER_ID" ]]; then
  BILL_CASHIER_COMPLETE_OUT="$TMP_DIR/bill_cashier_complete.json"
  BILL_CASHIER_COMPLETE_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL_CASHIER_ID/complete/" "$CASHIER_TOKEN" '{"payment_method":"cash"}' "$BILL_CASHIER_COMPLETE_OUT")"
  if [[ "$BILL_CASHIER_COMPLETE_STATUS" == "200" ]]; then
    record_pass "M3-023" "Cashier can complete bill"
  else
    record_fail "M3-023" "Cashier complete bill expected 200 got $BILL_CASHIER_COMPLETE_STATUS"
  fi
else
  record_fail "M3-023" "Skipped cashier complete due to missing bill"
fi

PAYMENT_ZERO_OUT="$TMP_DIR/payment_zero.json"
PAYMENT_ZERO_STATUS="$(api_call POST "$BASE_URL/sales/payments/" "$MANAGER_TOKEN" "{\"bill\":$BILL1_ID,\"amount\":\"0.00\",\"payment_method\":\"upi\"}" "$PAYMENT_ZERO_OUT")"
if [[ "$PAYMENT_ZERO_STATUS" == "400" ]]; then
  record_pass "M3-024" "Zero payment amount rejected"
else
  record_fail "M3-024" "Zero payment expected 400 got $PAYMENT_ZERO_STATUS"
fi

# Store B bill + scope checks
BILL_B_CREATE_OUT="$TMP_DIR/bill_b_create.json"
BILL_B_PAYLOAD=$(cat <<JSON
{"items":[{"product_id":$PRODUCT_B_ID,"quantity":"1.00","rate":"95.00"}]}
JSON
)
BILL_B_CREATE_STATUS="$(api_call POST "$BASE_URL/sales/bills/" "$ADMIN_B_TOKEN" "$BILL_B_PAYLOAD" "$BILL_B_CREATE_OUT")"
BILL_B_ID="$(jq -r '.id // empty' "$BILL_B_CREATE_OUT")"
if [[ "$BILL_B_CREATE_STATUS" == "201" && -n "$BILL_B_ID" ]]; then
  record_pass "M3-025" "Store B bill create"
else
  record_fail "M3-025" "Store B bill create failed status=$BILL_B_CREATE_STATUS"
fi

PAYMENT_B_ID=""
if [[ -n "$BILL_B_ID" ]]; then
  BILL_B_COMPLETE_OUT="$TMP_DIR/bill_b_complete.json"
  BILL_B_COMPLETE_STATUS="$(api_call POST "$BASE_URL/sales/bills/$BILL_B_ID/complete/" "$ADMIN_B_TOKEN" '{"payment_method":"card"}' "$BILL_B_COMPLETE_OUT")"
  if [[ "$BILL_B_COMPLETE_STATUS" == "200" ]]; then
    record_pass "M3-026" "Store B bill complete"
  else
    record_fail "M3-026" "Store B bill complete failed status=$BILL_B_COMPLETE_STATUS"
  fi

  BILL_B_PAYMENTS_OUT="$TMP_DIR/bill_b_payments.json"
  BILL_B_PAYMENTS_STATUS="$(api_call GET "$BASE_URL/sales/payments/?bill=$BILL_B_ID" "$ADMIN_B_TOKEN" "" "$BILL_B_PAYMENTS_OUT")"
  PAYMENT_B_ID="$(jq -r '.results[0].id // empty' "$BILL_B_PAYMENTS_OUT")"
  if [[ "$BILL_B_PAYMENTS_STATUS" == "200" && -n "$PAYMENT_B_ID" ]]; then
    record_pass "M3-027" "Store B payment exists"
  else
    record_fail "M3-027" "Store B payment fetch failed status=$BILL_B_PAYMENTS_STATUS"
  fi
else
  record_fail "M3-026" "Skipped Store B complete due to missing bill"
  record_fail "M3-027" "Skipped Store B payment check due to missing bill"
fi

if [[ -n "$BILL_B_ID" ]]; then
  ADMIN_A_GET_BILL_B_OUT="$TMP_DIR/admin_a_get_bill_b.json"
  ADMIN_A_GET_BILL_B_STATUS="$(api_call GET "$BASE_URL/sales/bills/$BILL_B_ID/" "$ADMIN_A_TOKEN" "" "$ADMIN_A_GET_BILL_B_OUT")"
  if [[ "$ADMIN_A_GET_BILL_B_STATUS" == "404" ]]; then
    record_pass "M3-028" "Store A admin cannot access Store B bill"
  else
    record_fail "M3-028" "Store A admin bill scope expected 404 got $ADMIN_A_GET_BILL_B_STATUS"
  fi

  MANAGER_GET_BILL_B_OUT="$TMP_DIR/manager_get_bill_b.json"
  MANAGER_GET_BILL_B_STATUS="$(api_call GET "$BASE_URL/sales/bills/$BILL_B_ID/" "$MANAGER_TOKEN" "" "$MANAGER_GET_BILL_B_OUT")"
  if [[ "$MANAGER_GET_BILL_B_STATUS" == "404" ]]; then
    record_pass "M3-029" "Manager A cannot access Store B bill"
  else
    record_fail "M3-029" "Manager A bill scope expected 404 got $MANAGER_GET_BILL_B_STATUS"
  fi
else
  record_fail "M3-028" "Skipped store scope bill check (bill B missing)"
  record_fail "M3-029" "Skipped manager store scope bill check (bill B missing)"
fi

if [[ -n "$PAYMENT_B_ID" ]]; then
  ADMIN_A_GET_PAY_B_OUT="$TMP_DIR/admin_a_get_payment_b.json"
  ADMIN_A_GET_PAY_B_STATUS="$(api_call GET "$BASE_URL/sales/payments/$PAYMENT_B_ID/" "$ADMIN_A_TOKEN" "" "$ADMIN_A_GET_PAY_B_OUT")"
  if [[ "$ADMIN_A_GET_PAY_B_STATUS" == "404" ]]; then
    record_pass "M3-030" "Store A admin cannot access Store B payment"
  else
    record_fail "M3-030" "Store A admin payment scope expected 404 got $ADMIN_A_GET_PAY_B_STATUS"
  fi
else
  record_fail "M3-030" "Skipped payment scope check (payment B missing)"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
