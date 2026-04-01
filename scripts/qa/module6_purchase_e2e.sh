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

list_count() {
  local file="$1"
  jq -r 'if type=="array" then length else ((.results // []) | length) end' "$file"
}

list_has_store() {
  local file="$1"
  local store_id="$2"
  jq -e --arg sid "$store_id" \
    '((if type=="array" then . else (.results // []) end) | map((.store // "") | tostring) | index($sid)) != null' \
    "$file" >/dev/null 2>&1
}

is_forbidden_or_not_found() {
  local status="$1"
  [[ "$status" == "403" || "$status" == "404" ]]
}

decimal_eq() {
  local a="$1"
  local b="$2"
  local eps="${3:-0.01}"
  awk -v a="$a" -v b="$b" -v e="$eps" 'BEGIN{d=a-b; if(d<0)d=-d; exit(d<=e?0:1)}'
}

decimal_sub() {
  local a="$1"
  local b="$2"
  awk -v a="$a" -v b="$b" 'BEGIN{printf "%.2f", a-b}'
}

get_stock_qty_for_product() {
  local token="$1"
  local product_id="$2"
  local out="$3"
  local status
  status="$(api_call GET "$BASE_URL/inventory/stock-levels/?product=$product_id" "$token" "" "$out")"
  if [[ "$status" != "200" ]]; then
    echo "ERR:$status"
    return
  fi
  jq -r '[((if type=="array" then . else (.results // []) end) // [])[] | ((.quantity // 0) | tonumber)] | add // 0' "$out"
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
  "price":"120.00",
  "cost_price":"80.00",
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

if [[ -n "$ADMIN_A_TOKEN" ]]; then record_pass "M6-SETUP-01" "Admin A login"; else record_fail "M6-SETUP-01" "Admin A login failed"; fi
if [[ -n "$ADMIN_B_TOKEN" ]]; then record_pass "M6-SETUP-02" "Admin B login"; else record_fail "M6-SETUP-02" "Admin B login failed"; fi
if [[ -n "$MANAGER_TOKEN" ]]; then record_pass "M6-SETUP-03" "Manager A login"; else record_fail "M6-SETUP-03" "Manager A login failed"; fi
if [[ -n "$CASHIER_TOKEN" ]]; then record_pass "M6-SETUP-04" "Cashier A login"; else record_fail "M6-SETUP-04" "Cashier A login failed"; fi

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
CATEGORY_NAME="M6Cat-$TS"
CATEGORY_STATUS="$(api_call POST "$BASE_URL/inventory/categories/" "$MANAGER_TOKEN" "{\"name\":\"$CATEGORY_NAME\"}" "$CATEGORY_OUT")"
CATEGORY_ID="$(jq -r '.id // empty' "$CATEGORY_OUT")"
if [[ "$CATEGORY_STATUS" == "201" && -n "$CATEGORY_ID" ]]; then
  record_pass "M6-SETUP-05" "Create category for purchase tests"
else
  CATEGORY_ID="35"
  record_fail "M6-SETUP-05" "Create category failed status=$CATEGORY_STATUS"
fi

PROD_A_OUT="$TMP_DIR/prod_a_create.json"
PROD_B_OUT="$TMP_DIR/prod_b_create.json"
PROD_A_STATUS="$(create_product "$MANAGER_TOKEN" "$STORE_A_ID" "M6 Product A $TS" "M6A$TS" "4.00" "$PROD_A_OUT")"
PROD_B_STATUS="$(create_product "$ADMIN_B_TOKEN" "$STORE_B_ID" "M6 Product B $TS" "M6B$TS" "4.00" "$PROD_B_OUT")"
PROD_A_ID="$(jq -r '.id // empty' "$PROD_A_OUT")"
PROD_B_ID="$(jq -r '.id // empty' "$PROD_B_OUT")"

if [[ "$PROD_A_STATUS" == "201" && -n "$PROD_A_ID" ]]; then record_pass "M6-SETUP-06" "Create store A product"; else record_fail "M6-SETUP-06" "Create store A product failed status=$PROD_A_STATUS"; fi
if [[ "$PROD_B_STATUS" == "201" && -n "$PROD_B_ID" ]]; then record_pass "M6-SETUP-07" "Create store B product"; else record_fail "M6-SETUP-07" "Create store B product failed status=$PROD_B_STATUS"; fi

SUPPLIER_A_OUT="$TMP_DIR/supplier_a_create.json"
SUPPLIER_A_PHONE="$(printf '9%09d' $((TS % 1000000000)))"
SUPPLIER_A_STATUS="$(api_call POST "$BASE_URL/suppliers/suppliers/" "$MANAGER_TOKEN" "{\"name\":\"M6 Supplier A $TS\",\"phone\":\"$SUPPLIER_A_PHONE\",\"city\":\"Pune\"}" "$SUPPLIER_A_OUT")"
SUPPLIER_A_ID="$(jq -r '.id // empty' "$SUPPLIER_A_OUT")"
if [[ "$SUPPLIER_A_STATUS" == "201" && -n "$SUPPLIER_A_ID" ]]; then
  record_pass "M6-SETUP-08" "Create supplier A"
else
  record_fail "M6-SETUP-08" "Create supplier A failed status=$SUPPLIER_A_STATUS"
fi

SUPPLIER_B_OUT="$TMP_DIR/supplier_b_create.json"
SUPPLIER_B_PHONE="$(printf '8%09d' $((TS % 1000000000)))"
SUPPLIER_B_STATUS="$(api_call POST "$BASE_URL/suppliers/suppliers/" "$ADMIN_B_TOKEN" "{\"name\":\"M6 Supplier B $TS\",\"phone\":\"$SUPPLIER_B_PHONE\",\"city\":\"Mumbai\"}" "$SUPPLIER_B_OUT")"
SUPPLIER_B_ID="$(jq -r '.id // empty' "$SUPPLIER_B_OUT")"
if [[ "$SUPPLIER_B_STATUS" == "201" && -n "$SUPPLIER_B_ID" ]]; then
  record_pass "M6-SETUP-09" "Create supplier B"
else
  record_fail "M6-SETUP-09" "Create supplier B failed status=$SUPPLIER_B_STATUS"
fi

if [[ -z "$PROD_A_ID" || -z "$PROD_B_ID" || -z "$SUPPLIER_A_ID" || -z "$SUPPLIER_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

PO_A_OUT="$TMP_DIR/po_a_create.json"
PO_A_PAYLOAD=$(cat <<JSON
{
  "supplier":$SUPPLIER_A_ID,
  "order_date":"$TODAY",
  "expected_delivery_date":"$TODAY",
  "shipping_charges":"10.00",
  "notes":"M6 PO A",
  "items":[{"product":$PROD_A_ID,"quantity_ordered":"5.00","unit_price":"80.00","tax_rate":"5.00","discount_percentage":"0"}]
}
JSON
)
PO_A_STATUS="$(api_call POST "$BASE_URL/suppliers/purchase-orders/" "$MANAGER_TOKEN" "$PO_A_PAYLOAD" "$PO_A_OUT")"
PO_A_ID="$(jq -r '.id // empty' "$PO_A_OUT")"
if [[ "$PO_A_STATUS" == "201" && -n "$PO_A_ID" ]]; then
  record_pass "M6-SETUP-10" "Create PO A (store A)"
else
  record_fail "M6-SETUP-10" "Create PO A failed status=$PO_A_STATUS"
fi

PO_B_OUT="$TMP_DIR/po_b_create.json"
PO_B_PAYLOAD=$(cat <<JSON
{
  "supplier":$SUPPLIER_B_ID,
  "order_date":"$TODAY",
  "expected_delivery_date":"$TODAY",
  "shipping_charges":"5.00",
  "notes":"M6 PO B",
  "items":[{"product":$PROD_B_ID,"quantity_ordered":"6.00","unit_price":"60.00","tax_rate":"5.00","discount_percentage":"0"}]
}
JSON
)
PO_B_STATUS="$(api_call POST "$BASE_URL/suppliers/purchase-orders/" "$ADMIN_B_TOKEN" "$PO_B_PAYLOAD" "$PO_B_OUT")"
PO_B_ID="$(jq -r '.id // empty' "$PO_B_OUT")"
if [[ "$PO_B_STATUS" == "201" && -n "$PO_B_ID" ]]; then
  record_pass "M6-SETUP-11" "Create PO B (store B)"
else
  record_fail "M6-SETUP-11" "Create PO B failed status=$PO_B_STATUS"
fi

if [[ -z "$PO_A_ID" || -z "$PO_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

PO_A_DETAIL_OUT="$TMP_DIR/po_a_detail.json"
PO_B_DETAIL_OUT="$TMP_DIR/po_b_detail.json"
PO_A_DETAIL_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_A_ID/" "$MANAGER_TOKEN" "" "$PO_A_DETAIL_OUT")"
PO_B_DETAIL_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_B_ID/" "$ADMIN_B_TOKEN" "" "$PO_B_DETAIL_OUT")"
PO_A_ITEM_ID="$(jq -r '.items[0].id // empty' "$PO_A_DETAIL_OUT")"
PO_B_ITEM_ID="$(jq -r '.items[0].id // empty' "$PO_B_DETAIL_OUT")"
if [[ "$PO_A_DETAIL_STATUS" == "200" && "$PO_B_DETAIL_STATUS" == "200" && -n "$PO_A_ITEM_ID" && -n "$PO_B_ITEM_ID" ]]; then
  record_pass "M6-SETUP-12" "Fetch PO item ids for nested tests"
else
  record_fail "M6-SETUP-12" "Fetch PO detail/items failed poA=$PO_A_DETAIL_STATUS poB=$PO_B_DETAIL_STATUS"
fi

if [[ -z "$PO_A_ITEM_ID" || -z "$PO_B_ITEM_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# --------------------
# Module 6 test cases
# --------------------

# M6-001 manager list PO only own store
M6001_OUT="$TMP_DIR/m6001_manager_po_list.json"
M6001_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/" "$MANAGER_TOKEN" "" "$M6001_OUT")"
if [[ "$M6001_STATUS" == "200" ]] && ! list_has_store "$M6001_OUT" "$STORE_B_ID"; then
  record_pass "M6-001" "Manager PO list scoped to store A"
else
  record_fail "M6-001" "Manager PO scoping failed status=$M6001_STATUS"
fi

# M6-002 admin B list PO only own store
M6002_OUT="$TMP_DIR/m6002_adminb_po_list.json"
M6002_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/" "$ADMIN_B_TOKEN" "" "$M6002_OUT")"
if [[ "$M6002_STATUS" == "200" ]] && ! list_has_store "$M6002_OUT" "$STORE_A_ID"; then
  record_pass "M6-002" "Admin B PO list scoped to store B"
else
  record_fail "M6-002" "Admin B PO scoping failed status=$M6002_STATUS"
fi

# M6-003 manager cannot retrieve store B PO
M6003_OUT="$TMP_DIR/m6003_manager_get_pob.json"
M6003_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_B_ID/" "$MANAGER_TOKEN" "" "$M6003_OUT")"
if is_forbidden_or_not_found "$M6003_STATUS"; then
  record_pass "M6-003" "Manager cannot retrieve store B PO"
else
  record_fail "M6-003" "Manager cross-store PO retrieve leak status=$M6003_STATUS"
fi

# M6-004 admin B cannot retrieve store A PO
M6004_OUT="$TMP_DIR/m6004_adminb_get_poa.json"
M6004_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_A_ID/" "$ADMIN_B_TOKEN" "" "$M6004_OUT")"
if is_forbidden_or_not_found "$M6004_STATUS"; then
  record_pass "M6-004" "Admin B cannot retrieve store A PO"
else
  record_fail "M6-004" "Admin B cross-store PO retrieve leak status=$M6004_STATUS"
fi

# M6-005 cashier denied PO list
M6005_OUT="$TMP_DIR/m6005_cashier_po_list.json"
M6005_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/" "$CASHIER_TOKEN" "" "$M6005_OUT")"
if [[ "$M6005_STATUS" == "403" ]]; then
  record_pass "M6-005" "Cashier denied PO access"
else
  record_fail "M6-005" "Cashier PO access expected 403 got $M6005_STATUS"
fi

# M6-006 manager cannot create PO with explicit store B
M6006_OUT="$TMP_DIR/m6006_manager_po_store_override.json"
M6006_PAYLOAD=$(cat <<JSON
{
  "supplier":$SUPPLIER_A_ID,
  "store":$STORE_B_ID,
  "order_date":"$TODAY",
  "items":[{"product":$PROD_A_ID,"quantity_ordered":"1.00","unit_price":"80.00","tax_rate":"5.00","discount_percentage":"0"}]
}
JSON
)
M6006_STATUS="$(api_call POST "$BASE_URL/suppliers/purchase-orders/" "$MANAGER_TOKEN" "$M6006_PAYLOAD" "$M6006_OUT")"
if [[ "$M6006_STATUS" == "400" ]]; then
  record_pass "M6-006" "Manager cannot override PO store"
else
  record_fail "M6-006" "PO store override expected 400 got $M6006_STATUS"
fi

# M6-007 PO update_status valid
M6007_OUT="$TMP_DIR/m6007_poa_status_sent.json"
M6007_STATUS="$(api_call POST "$BASE_URL/suppliers/purchase-orders/$PO_A_ID/update_status/" "$MANAGER_TOKEN" "{\"status\":\"sent\"}" "$M6007_OUT")"
M6007_CUR="$(jq -r '.status // empty' "$M6007_OUT")"
if [[ "$M6007_STATUS" == "200" && "$M6007_CUR" == "sent" ]]; then
  record_pass "M6-007" "PO status update to sent"
else
  record_fail "M6-007" "PO status sent failed status=$M6007_STATUS current=$M6007_CUR"
fi

# M6-008 PO update_status invalid
M6008_OUT="$TMP_DIR/m6008_poa_status_invalid.json"
M6008_STATUS="$(api_call POST "$BASE_URL/suppliers/purchase-orders/$PO_A_ID/update_status/" "$MANAGER_TOKEN" "{\"status\":\"unknown\"}" "$M6008_OUT")"
if [[ "$M6008_STATUS" == "400" ]]; then
  record_pass "M6-008" "PO invalid status rejected"
else
  record_fail "M6-008" "PO invalid status expected 400 got $M6008_STATUS"
fi

# M6-009 manager cannot list PO B nested items
M6009_OUT="$TMP_DIR/m6009_manager_pob_items.json"
M6009_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_B_ID/items/" "$MANAGER_TOKEN" "" "$M6009_OUT")"
M6009_COUNT="$(list_count "$M6009_OUT" 2>/dev/null || echo 999)"
if is_forbidden_or_not_found "$M6009_STATUS" || [[ "$M6009_STATUS" == "200" && "$M6009_COUNT" == "0" ]]; then
  record_pass "M6-009" "Manager cannot access PO B nested items"
else
  record_fail "M6-009" "Manager PO B nested items leak status=$M6009_STATUS count=$M6009_COUNT"
fi

# M6-010 admin B cannot list PO A nested items
M6010_OUT="$TMP_DIR/m6010_adminb_poa_items.json"
M6010_STATUS="$(api_call GET "$BASE_URL/suppliers/purchase-orders/$PO_A_ID/items/" "$ADMIN_B_TOKEN" "" "$M6010_OUT")"
M6010_COUNT="$(list_count "$M6010_OUT" 2>/dev/null || echo 999)"
if is_forbidden_or_not_found "$M6010_STATUS" || [[ "$M6010_STATUS" == "200" && "$M6010_COUNT" == "0" ]]; then
  record_pass "M6-010" "Admin B cannot access PO A nested items"
else
  record_fail "M6-010" "Admin B PO A nested items leak status=$M6010_STATUS count=$M6010_COUNT"
fi

# M6-011 manager create GRN A (pending)
M6011_STOCK_BEFORE_OUT="$TMP_DIR/m6011_stock_before.json"
STOCK_BEFORE_A="$(get_stock_qty_for_product "$MANAGER_TOKEN" "$PROD_A_ID" "$M6011_STOCK_BEFORE_OUT")"
M6011_OUT="$TMP_DIR/m6011_create_grna.json"
M6011_PAYLOAD=$(cat <<JSON
{
  "purchase_order":$PO_A_ID,
  "supplier":$SUPPLIER_A_ID,
  "receipt_date":"$TODAY",
  "invoice_number":"M6-GRN-A-$TS",
  "invoice_date":"$TODAY",
  "status":"pending",
  "items":[{"product_id":$PROD_A_ID,"received_quantity":"5.00","unit_price":"80.00","discount_percentage":"0","discount_amount":"0.00","tax_rate":"5.00","tax_amount":"20.00","total":"420.00","batch_no":"M6BA$TS"}],
  "po_items":[{"product":$PROD_A_ID}]
}
JSON
)
M6011_STATUS="$(api_call POST "$BASE_URL/suppliers/grn/" "$MANAGER_TOKEN" "$M6011_PAYLOAD" "$M6011_OUT")"
GRN_A_ID="$(jq -r '.id // empty' "$M6011_OUT")"
GRN_A_NUMBER="$(jq -r '.grn_number // empty' "$M6011_OUT")"
if [[ "$M6011_STATUS" == "201" && -n "$GRN_A_ID" ]]; then
  record_pass "M6-011" "Create GRN A pending"
else
  record_fail "M6-011" "Create GRN A failed status=$M6011_STATUS"
fi

# M6-012 admin B create GRN B (pending)
M6012_OUT="$TMP_DIR/m6012_create_grnb.json"
M6012_PAYLOAD=$(cat <<JSON
{
  "purchase_order":$PO_B_ID,
  "supplier":$SUPPLIER_B_ID,
  "receipt_date":"$TODAY",
  "invoice_number":"M6-GRN-B-$TS",
  "invoice_date":"$TODAY",
  "status":"pending",
  "items":[{"product_id":$PROD_B_ID,"received_quantity":"4.00","unit_price":"60.00","discount_percentage":"0","discount_amount":"0.00","tax_rate":"5.00","tax_amount":"12.00","total":"252.00","batch_no":"M6BB$TS"}],
  "po_items":[{"product":$PROD_B_ID}]
}
JSON
)
M6012_STATUS="$(api_call POST "$BASE_URL/suppliers/grn/" "$ADMIN_B_TOKEN" "$M6012_PAYLOAD" "$M6012_OUT")"
GRN_B_ID="$(jq -r '.id // empty' "$M6012_OUT")"
if [[ "$M6012_STATUS" == "201" && -n "$GRN_B_ID" ]]; then
  record_pass "M6-012" "Create GRN B pending"
else
  record_fail "M6-012" "Create GRN B failed status=$M6012_STATUS"
fi

if [[ -z "$GRN_A_ID" || -z "$GRN_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# M6-013 complete GRN A
M6013_OUT="$TMP_DIR/m6013_complete_grna.json"
M6013_STATUS="$(api_call POST "$BASE_URL/suppliers/grn/$GRN_A_ID/complete/" "$MANAGER_TOKEN" "{}" "$M6013_OUT")"
M6013_CUR="$(jq -r '.status // empty' "$M6013_OUT")"
if [[ "$M6013_STATUS" == "200" && "$M6013_CUR" == "completed" ]]; then
  record_pass "M6-013" "Complete GRN A"
else
  record_fail "M6-013" "GRN A complete failed status=$M6013_STATUS cur=$M6013_CUR"
fi

# M6-014 complete GRN A again idempotent
M6014_OUT="$TMP_DIR/m6014_complete_grna_again.json"
M6014_STATUS="$(api_call POST "$BASE_URL/suppliers/grn/$GRN_A_ID/complete/" "$MANAGER_TOKEN" "{}" "$M6014_OUT")"
if [[ "$M6014_STATUS" == "200" ]]; then
  record_pass "M6-014" "Complete GRN A again remains idempotent"
else
  record_fail "M6-014" "GRN complete idempotent expected 200 got $M6014_STATUS"
fi

# M6-015 stock increased by GRN qty once
M6015_STOCK_AFTER_OUT="$TMP_DIR/m6015_stock_after.json"
STOCK_AFTER_A="$(get_stock_qty_for_product "$MANAGER_TOKEN" "$PROD_A_ID" "$M6015_STOCK_AFTER_OUT")"
if [[ "$STOCK_BEFORE_A" == ERR:* || "$STOCK_AFTER_A" == ERR:* ]]; then
  record_fail "M6-015" "Stock check failed before=$STOCK_BEFORE_A after=$STOCK_AFTER_A"
else
  STOCK_DIFF="$(decimal_sub "$STOCK_AFTER_A" "$STOCK_BEFORE_A")"
  if decimal_eq "$STOCK_DIFF" "5.00" "0.01"; then
    record_pass "M6-015" "GRN completion updated stock exactly once"
  else
    record_fail "M6-015" "Expected stock +5.00 got +$STOCK_DIFF (before=$STOCK_BEFORE_A after=$STOCK_AFTER_A)"
  fi
fi

# M6-016 manager list GRN excludes store B
M6016_OUT="$TMP_DIR/m6016_manager_grn_list.json"
M6016_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/" "$MANAGER_TOKEN" "" "$M6016_OUT")"
if [[ "$M6016_STATUS" == "200" ]] && ! list_has_store "$M6016_OUT" "$STORE_B_ID"; then
  record_pass "M6-016" "Manager GRN list scoped to store A"
else
  record_fail "M6-016" "Manager GRN scope failed status=$M6016_STATUS"
fi

# M6-017 admin B list GRN excludes store A
M6017_OUT="$TMP_DIR/m6017_adminb_grn_list.json"
M6017_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/" "$ADMIN_B_TOKEN" "" "$M6017_OUT")"
if [[ "$M6017_STATUS" == "200" ]] && ! list_has_store "$M6017_OUT" "$STORE_A_ID"; then
  record_pass "M6-017" "Admin B GRN list scoped to store B"
else
  record_fail "M6-017" "Admin B GRN scope failed status=$M6017_STATUS"
fi

# M6-018 manager cannot retrieve GRN B
M6018_OUT="$TMP_DIR/m6018_manager_get_grnb.json"
M6018_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/$GRN_B_ID/" "$MANAGER_TOKEN" "" "$M6018_OUT")"
if is_forbidden_or_not_found "$M6018_STATUS"; then
  record_pass "M6-018" "Manager cannot retrieve GRN B"
else
  record_fail "M6-018" "Manager GRN B retrieve leak status=$M6018_STATUS"
fi

# M6-019 admin B cannot retrieve GRN A
M6019_OUT="$TMP_DIR/m6019_adminb_get_grna.json"
M6019_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/$GRN_A_ID/" "$ADMIN_B_TOKEN" "" "$M6019_OUT")"
if is_forbidden_or_not_found "$M6019_STATUS"; then
  record_pass "M6-019" "Admin B cannot retrieve GRN A"
else
  record_fail "M6-019" "Admin B GRN A retrieve leak status=$M6019_STATUS"
fi

# M6-020 manager cannot list GRN B nested items
M6020_OUT="$TMP_DIR/m6020_manager_grnb_items.json"
M6020_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/$GRN_B_ID/items/" "$MANAGER_TOKEN" "" "$M6020_OUT")"
M6020_COUNT="$(list_count "$M6020_OUT" 2>/dev/null || echo 999)"
if is_forbidden_or_not_found "$M6020_STATUS" || [[ "$M6020_STATUS" == "200" && "$M6020_COUNT" == "0" ]]; then
  record_pass "M6-020" "Manager cannot access GRN B nested items"
else
  record_fail "M6-020" "Manager GRN B nested items leak status=$M6020_STATUS count=$M6020_COUNT"
fi

# M6-021 cashier denied GRN list
M6021_OUT="$TMP_DIR/m6021_cashier_grn_list.json"
M6021_STATUS="$(api_call GET "$BASE_URL/suppliers/grn/" "$CASHIER_TOKEN" "" "$M6021_OUT")"
if [[ "$M6021_STATUS" == "403" ]]; then
  record_pass "M6-021" "Cashier denied GRN access"
else
  record_fail "M6-021" "Cashier GRN access expected 403 got $M6021_STATUS"
fi

# M6-022 manager create invoice A
M6022_OUT="$TMP_DIR/m6022_create_invoice_a.json"
M6022_PAYLOAD=$(cat <<JSON
{
  "supplier":$SUPPLIER_A_ID,
  "supplier_invoice_number":"M6-SINV-A-$TS",
  "purchase_order":$PO_A_ID,
  "grn":$GRN_A_ID,
  "invoice_date":"$TODAY",
  "due_date":"$TODAY",
  "status":"approved",
  "items":[{"product_ref":$PROD_A_ID,"product_code":"M6A$TS","product_name":"M6 Product A $TS","quantity":"4.00","unit_price":"80.00","discount":"0","discount_type":"percentage","tax_rate":"5.00"}]
}
JSON
)
M6022_STATUS="$(api_call POST "$BASE_URL/suppliers/supplier-invoices/" "$MANAGER_TOKEN" "$M6022_PAYLOAD" "$M6022_OUT")"
INVOICE_A_ID="$(jq -r '.id // empty' "$M6022_OUT")"
if [[ "$M6022_STATUS" == "201" && -n "$INVOICE_A_ID" ]]; then
  record_pass "M6-022" "Create supplier invoice A"
else
  record_fail "M6-022" "Create supplier invoice A failed status=$M6022_STATUS"
fi

# M6-023 admin B create invoice B
M6023_OUT="$TMP_DIR/m6023_create_invoice_b.json"
M6023_PAYLOAD=$(cat <<JSON
{
  "supplier":$SUPPLIER_B_ID,
  "supplier_invoice_number":"M6-SINV-B-$TS",
  "purchase_order":$PO_B_ID,
  "grn":$GRN_B_ID,
  "invoice_date":"$TODAY",
  "due_date":"$TODAY",
  "status":"approved",
  "items":[{"product_ref":$PROD_B_ID,"product_code":"M6B$TS","product_name":"M6 Product B $TS","quantity":"3.00","unit_price":"60.00","discount":"0","discount_type":"percentage","tax_rate":"5.00"}]
}
JSON
)
M6023_STATUS="$(api_call POST "$BASE_URL/suppliers/supplier-invoices/" "$ADMIN_B_TOKEN" "$M6023_PAYLOAD" "$M6023_OUT")"
INVOICE_B_ID="$(jq -r '.id // empty' "$M6023_OUT")"
if [[ "$M6023_STATUS" == "201" && -n "$INVOICE_B_ID" ]]; then
  record_pass "M6-023" "Create supplier invoice B"
else
  record_fail "M6-023" "Create supplier invoice B failed status=$M6023_STATUS"
fi

if [[ -z "$INVOICE_A_ID" || -z "$INVOICE_B_ID" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

# M6-024 manager list invoices excludes store B
M6024_OUT="$TMP_DIR/m6024_manager_invoice_list.json"
M6024_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/" "$MANAGER_TOKEN" "" "$M6024_OUT")"
if [[ "$M6024_STATUS" == "200" ]] && ! list_has_store "$M6024_OUT" "$STORE_B_ID"; then
  record_pass "M6-024" "Manager invoice list scoped to store A"
else
  record_fail "M6-024" "Manager invoice scope failed status=$M6024_STATUS"
fi

# M6-025 admin B list invoices excludes store A
M6025_OUT="$TMP_DIR/m6025_adminb_invoice_list.json"
M6025_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/" "$ADMIN_B_TOKEN" "" "$M6025_OUT")"
if [[ "$M6025_STATUS" == "200" ]] && ! list_has_store "$M6025_OUT" "$STORE_A_ID"; then
  record_pass "M6-025" "Admin B invoice list scoped to store B"
else
  record_fail "M6-025" "Admin B invoice scope failed status=$M6025_STATUS"
fi

# M6-026 manager cannot retrieve invoice B
M6026_OUT="$TMP_DIR/m6026_manager_get_invoiceb.json"
M6026_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/$INVOICE_B_ID/" "$MANAGER_TOKEN" "" "$M6026_OUT")"
if is_forbidden_or_not_found "$M6026_STATUS"; then
  record_pass "M6-026" "Manager cannot retrieve invoice B"
else
  record_fail "M6-026" "Manager invoice B retrieve leak status=$M6026_STATUS"
fi

# M6-027 admin B cannot retrieve invoice A
M6027_OUT="$TMP_DIR/m6027_adminb_get_invoicea.json"
M6027_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/$INVOICE_A_ID/" "$ADMIN_B_TOKEN" "" "$M6027_OUT")"
if is_forbidden_or_not_found "$M6027_STATUS"; then
  record_pass "M6-027" "Admin B cannot retrieve invoice A"
else
  record_fail "M6-027" "Admin B invoice A retrieve leak status=$M6027_STATUS"
fi

# M6-028 manager cannot list invoice B nested items
M6028_OUT="$TMP_DIR/m6028_manager_invoiceb_items.json"
M6028_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/$INVOICE_B_ID/items/" "$MANAGER_TOKEN" "" "$M6028_OUT")"
M6028_COUNT="$(list_count "$M6028_OUT" 2>/dev/null || echo 999)"
if is_forbidden_or_not_found "$M6028_STATUS" || [[ "$M6028_STATUS" == "200" && "$M6028_COUNT" == "0" ]]; then
  record_pass "M6-028" "Manager cannot access invoice B nested items"
else
  record_fail "M6-028" "Manager invoice B nested items leak status=$M6028_STATUS count=$M6028_COUNT"
fi

# M6-029 cashier denied invoice list
M6029_OUT="$TMP_DIR/m6029_cashier_invoice_list.json"
M6029_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/" "$CASHIER_TOKEN" "" "$M6029_OUT")"
if [[ "$M6029_STATUS" == "403" ]]; then
  record_pass "M6-029" "Cashier denied invoice access"
else
  record_fail "M6-029" "Cashier invoice access expected 403 got $M6029_STATUS"
fi

# M6-030 create partial payment for invoice A
INVOICE_A_GRAND="$(jq -r '.grand_total // "0"' "$M6022_OUT")"
PARTIAL_PAY="$(awk -v g="$INVOICE_A_GRAND" 'BEGIN{p=g/2; if (p<=0) p=1; if (p>=g && g>1) p=g-1; printf "%.2f", p}')"
M6030_OUT="$TMP_DIR/m6030_create_payment_partial.json"
M6030_PAYLOAD="{\"supplier\":$SUPPLIER_A_ID,\"purchase_order\":$PO_A_ID,\"supplier_invoice\":$INVOICE_A_ID,\"amount\":\"$PARTIAL_PAY\",\"payment_method\":\"cash\",\"status\":\"completed\",\"reference_number\":\"M6PAY1-$TS\"}"
M6030_STATUS="$(api_call POST "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "$M6030_PAYLOAD" "$M6030_OUT")"
PAYMENT_A1_ID="$(jq -r '.id // empty' "$M6030_OUT")"
if [[ "$M6030_STATUS" == "201" && -n "$PAYMENT_A1_ID" ]]; then
  record_pass "M6-030" "Create partial payment for invoice A"
else
  record_fail "M6-030" "Create partial payment failed status=$M6030_STATUS"
fi

# M6-031 invoice A becomes partially paid
M6031_OUT="$TMP_DIR/m6031_invoicea_after_pay1.json"
M6031_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/$INVOICE_A_ID/" "$MANAGER_TOKEN" "" "$M6031_OUT")"
M6031_ST="$(jq -r '.status // empty' "$M6031_OUT")"
M6031_PAID="$(jq -r '.amount_paid // "0"' "$M6031_OUT")"
if [[ "$M6031_STATUS" == "200" && "$M6031_ST" == "partially_paid" ]] && decimal_eq "$M6031_PAID" "$PARTIAL_PAY" "0.01"; then
  record_pass "M6-031" "Invoice A moved to partially_paid with correct paid amount"
else
  record_fail "M6-031" "Invoice A partial status mismatch status=$M6031_STATUS st=$M6031_ST paid=$M6031_PAID expected=$PARTIAL_PAY"
fi

# M6-032 overpayment rejected
INVOICE_A_DUE1="$(jq -r '.due_amount // "0"' "$M6031_OUT")"
OVERPAY="$(awk -v d="$INVOICE_A_DUE1" 'BEGIN{printf "%.2f", d+10}')"
M6032_OUT="$TMP_DIR/m6032_overpayment.json"
M6032_PAYLOAD="{\"supplier\":$SUPPLIER_A_ID,\"purchase_order\":$PO_A_ID,\"supplier_invoice\":$INVOICE_A_ID,\"amount\":\"$OVERPAY\",\"payment_method\":\"upi\",\"status\":\"completed\",\"reference_number\":\"M6PAYOV-$TS\"}"
M6032_STATUS="$(api_call POST "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "$M6032_PAYLOAD" "$M6032_OUT")"
if [[ "$M6032_STATUS" == "400" ]]; then
  record_pass "M6-032" "Overpayment on invoice rejected"
else
  record_fail "M6-032" "Overpayment expected 400 got $M6032_STATUS"
fi

# M6-033 create remaining payment and mark paid
M6033_OUT="$TMP_DIR/m6033_create_payment_remaining.json"
M6033_PAYLOAD="{\"supplier\":$SUPPLIER_A_ID,\"purchase_order\":$PO_A_ID,\"supplier_invoice\":$INVOICE_A_ID,\"amount\":\"$INVOICE_A_DUE1\",\"payment_method\":\"bank_transfer\",\"status\":\"completed\",\"reference_number\":\"M6PAY2-$TS\"}"
M6033_STATUS="$(api_call POST "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "$M6033_PAYLOAD" "$M6033_OUT")"
PAYMENT_A2_ID="$(jq -r '.id // empty' "$M6033_OUT")"
if [[ "$M6033_STATUS" == "201" && -n "$PAYMENT_A2_ID" ]]; then
  record_pass "M6-033" "Create remaining payment for invoice A"
else
  record_fail "M6-033" "Create remaining payment failed status=$M6033_STATUS"
fi

M6033B_OUT="$TMP_DIR/m6033b_invoicea_after_pay2.json"
M6033B_STATUS="$(api_call GET "$BASE_URL/suppliers/supplier-invoices/$INVOICE_A_ID/" "$MANAGER_TOKEN" "" "$M6033B_OUT")"
M6033B_ST="$(jq -r '.status // empty' "$M6033B_OUT")"
M6033B_DUE="$(jq -r '.due_amount // "9999"' "$M6033B_OUT")"
if [[ "$M6033B_STATUS" == "200" && "$M6033B_ST" == "paid" ]] && decimal_eq "$M6033B_DUE" "0" "0.01"; then
  record_pass "M6-034" "Invoice A fully paid with zero due"
else
  record_fail "M6-034" "Invoice A paid mismatch status=$M6033B_STATUS st=$M6033B_ST due=$M6033B_DUE"
fi

# create payment in store B for scope checks
INVOICE_B_GRAND="$(jq -r '.grand_total // "0"' "$M6023_OUT")"
PAY_B_AMT="$(awk -v g="$INVOICE_B_GRAND" 'BEGIN{p=g/2; if(p<=0)p=1; printf "%.2f", p}')"
M6035_SETUP_OUT="$TMP_DIR/m6035_setup_payment_b.json"
M6035_SETUP_PAYLOAD="{\"supplier\":$SUPPLIER_B_ID,\"purchase_order\":$PO_B_ID,\"supplier_invoice\":$INVOICE_B_ID,\"amount\":\"$PAY_B_AMT\",\"payment_method\":\"cash\",\"status\":\"completed\",\"reference_number\":\"M6PAYB-$TS\"}"
M6035_SETUP_STATUS="$(api_call POST "$BASE_URL/suppliers/payments/" "$ADMIN_B_TOKEN" "$M6035_SETUP_PAYLOAD" "$M6035_SETUP_OUT")"
PAYMENT_B1_ID="$(jq -r '.id // empty' "$M6035_SETUP_OUT")"
if [[ "$M6035_SETUP_STATUS" == "201" && -n "$PAYMENT_B1_ID" ]]; then
  record_pass "M6-035" "Create store B payment for scope tests"
else
  record_fail "M6-035" "Create store B payment failed status=$M6035_SETUP_STATUS"
fi

# M6-036 manager cannot create payment for store B invoice
M6036_OUT="$TMP_DIR/m6036_manager_cross_store_payment.json"
M6036_PAYLOAD="{\"supplier\":$SUPPLIER_B_ID,\"purchase_order\":$PO_B_ID,\"supplier_invoice\":$INVOICE_B_ID,\"amount\":\"1.00\",\"payment_method\":\"cash\",\"status\":\"completed\",\"reference_number\":\"M6LEAK-$TS\"}"
M6036_STATUS="$(api_call POST "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "$M6036_PAYLOAD" "$M6036_OUT")"
if [[ "$M6036_STATUS" == "400" || "$M6036_STATUS" == "403" || "$M6036_STATUS" == "404" ]]; then
  record_pass "M6-036" "Manager cross-store payment create blocked"
else
  record_fail "M6-036" "Manager cross-store payment create leak status=$M6036_STATUS"
fi

# M6-037 manager list payments excludes store B
M6037_OUT="$TMP_DIR/m6037_manager_payment_list.json"
M6037_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "" "$M6037_OUT")"
if [[ "$M6037_STATUS" == "200" ]] && ! list_has_store "$M6037_OUT" "$STORE_B_ID"; then
  record_pass "M6-037" "Manager payment list scoped to store A"
else
  record_fail "M6-037" "Manager payment scope failed status=$M6037_STATUS"
fi

# M6-038 admin B list payments excludes store A
M6038_OUT="$TMP_DIR/m6038_adminb_payment_list.json"
M6038_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/" "$ADMIN_B_TOKEN" "" "$M6038_OUT")"
if [[ "$M6038_STATUS" == "200" ]] && ! list_has_store "$M6038_OUT" "$STORE_A_ID"; then
  record_pass "M6-038" "Admin B payment list scoped to store B"
else
  record_fail "M6-038" "Admin B payment scope failed status=$M6038_STATUS"
fi

# M6-039 manager cannot retrieve payment B
M6039_OUT="$TMP_DIR/m6039_manager_get_paymentb.json"
M6039_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/$PAYMENT_B1_ID/" "$MANAGER_TOKEN" "" "$M6039_OUT")"
if is_forbidden_or_not_found "$M6039_STATUS"; then
  record_pass "M6-039" "Manager cannot retrieve payment B"
else
  record_fail "M6-039" "Manager payment B retrieve leak status=$M6039_STATUS"
fi

# M6-040 admin B cannot retrieve payment A
M6040_OUT="$TMP_DIR/m6040_adminb_get_paymenta.json"
M6040_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/$PAYMENT_A1_ID/" "$ADMIN_B_TOKEN" "" "$M6040_OUT")"
if is_forbidden_or_not_found "$M6040_STATUS"; then
  record_pass "M6-040" "Admin B cannot retrieve payment A"
else
  record_fail "M6-040" "Admin B payment A retrieve leak status=$M6040_STATUS"
fi

# M6-041 cashier denied payment list
M6041_OUT="$TMP_DIR/m6041_cashier_payment_list.json"
M6041_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/" "$CASHIER_TOKEN" "" "$M6041_OUT")"
if [[ "$M6041_STATUS" == "403" ]]; then
  record_pass "M6-041" "Cashier denied payment access"
else
  record_fail "M6-041" "Cashier payment access expected 403 got $M6041_STATUS"
fi

# M6-042 soft delete payment and verify visibility toggles
M6042_DEL_OUT="$TMP_DIR/m6042_delete_payment.json"
M6042_DEL_STATUS="$(api_call DELETE "$BASE_URL/suppliers/payments/$PAYMENT_A2_ID/" "$MANAGER_TOKEN" "" "$M6042_DEL_OUT")"
M6042_LIST_DEF_OUT="$TMP_DIR/m6042_payment_list_default.json"
M6042_LIST_DEF_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/" "$MANAGER_TOKEN" "" "$M6042_LIST_DEF_OUT")"
M6042_LIST_INC_OUT="$TMP_DIR/m6042_payment_list_inactive.json"
M6042_LIST_INC_STATUS="$(api_call GET "$BASE_URL/suppliers/payments/?include_inactive=true" "$MANAGER_TOKEN" "" "$M6042_LIST_INC_OUT")"
M6042_DEF_HAS="$(jq -e --arg pid "$PAYMENT_A2_ID" '((if type=="array" then . else (.results // []) end) | map((.id|tostring)) | index($pid)) != null' "$M6042_LIST_DEF_OUT" >/dev/null 2>&1; echo $?)"
M6042_INC_HAS="$(jq -e --arg pid "$PAYMENT_A2_ID" '((if type=="array" then . else (.results // []) end) | map((.id|tostring)) | index($pid)) != null' "$M6042_LIST_INC_OUT" >/dev/null 2>&1; echo $?)"
if [[ "$M6042_DEL_STATUS" == "204" && "$M6042_LIST_DEF_STATUS" == "200" && "$M6042_LIST_INC_STATUS" == "200" && "$M6042_DEF_HAS" == "1" && "$M6042_INC_HAS" == "0" ]]; then
  record_pass "M6-042" "Soft-deleted payment hidden by default and visible with include_inactive"
else
  record_fail "M6-042" "Payment soft-delete visibility check failed del=$M6042_DEL_STATUS def=$M6042_LIST_DEF_STATUS inc=$M6042_LIST_INC_STATUS defHas=$M6042_DEF_HAS incHas=$M6042_INC_HAS"
fi

# M6-043 supplier purchase history endpoint
M6043_OUT="$TMP_DIR/m6043_supplier_purchase_history.json"
M6043_STATUS="$(api_call GET "$BASE_URL/suppliers/suppliers/$SUPPLIER_A_ID/purchase_history/" "$MANAGER_TOKEN" "" "$M6043_OUT")"
M6043_COUNT="$(list_count "$M6043_OUT" 2>/dev/null || echo 0)"
if [[ "$M6043_STATUS" == "200" && "$M6043_COUNT" -ge 1 ]]; then
  record_pass "M6-043" "Supplier purchase history returns orders"
else
  record_fail "M6-043" "Supplier purchase history expected >=1 got status=$M6043_STATUS count=$M6043_COUNT"
fi

# M6-044 supplier payment history endpoint
M6044_OUT="$TMP_DIR/m6044_supplier_payment_history.json"
M6044_STATUS="$(api_call GET "$BASE_URL/suppliers/suppliers/$SUPPLIER_A_ID/payment_history/" "$MANAGER_TOKEN" "" "$M6044_OUT")"
M6044_COUNT="$(list_count "$M6044_OUT" 2>/dev/null || echo 0)"
if [[ "$M6044_STATUS" == "200" && "$M6044_COUNT" -ge 1 ]]; then
  record_pass "M6-044" "Supplier payment history returns payments"
else
  record_fail "M6-044" "Supplier payment history expected >=1 got status=$M6044_STATUS count=$M6044_COUNT"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
