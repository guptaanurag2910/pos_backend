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

list_count() {
  local file="$1"
  jq -r 'if type=="array" then length else ((.results // []) | length) end' "$file"
}

list_has_id() {
  local file="$1"
  local id="$2"
  jq -e --arg id "$id" '((if type=="array" then . else (.results // []) end) | map((.id|tostring)) | index($id)) != null' "$file" >/dev/null 2>&1
}

is_forbidden_or_not_found() {
  local status="$1"
  [[ "$status" == "403" || "$status" == "404" ]]
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

if [[ -n "$ADMIN_A_TOKEN" ]]; then record_pass "M8-SETUP-01" "Admin A login"; else record_fail "M8-SETUP-01" "Admin A login failed"; fi
if [[ -n "$ADMIN_B_TOKEN" ]]; then record_pass "M8-SETUP-02" "Admin B login"; else record_fail "M8-SETUP-02" "Admin B login failed"; fi
if [[ -n "$MANAGER_TOKEN" ]]; then record_pass "M8-SETUP-03" "Manager A login"; else record_fail "M8-SETUP-03" "Manager A login failed"; fi
if [[ -n "$CASHIER_TOKEN" ]]; then record_pass "M8-SETUP-04" "Cashier A login"; else record_fail "M8-SETUP-04" "Cashier A login failed"; fi

if [[ -z "$ADMIN_A_TOKEN" || -z "$ADMIN_B_TOKEN" || -z "$MANAGER_TOKEN" || -z "$CASHIER_TOKEN" ]]; then
  echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
  exit 1
fi

STORE_A_ID="$(jq -r '.store_id // empty' "$MANAGER_LOGIN_JSON")"
STORE_B_ID="$(jq -r '.store_id // empty' "$ADMIN_B_LOGIN_JSON")"
[[ -z "$STORE_A_ID" ]] && STORE_A_ID="11"
[[ -z "$STORE_B_ID" ]] && STORE_B_ID="12"
TS4="${TS: -4}"

# --------------------
# Module 8 test cases
# --------------------

# M8-001 manager store list scoped
M8001_OUT="$TMP_DIR/m8001_manager_list.json"
M8001_STATUS="$(api_call GET "$BASE_URL/stores/" "$MANAGER_TOKEN" "" "$M8001_OUT")"
M8001_COUNT="$(list_count "$M8001_OUT")"
if [[ "$M8001_STATUS" == "200" && "$M8001_COUNT" == "1" ]] && list_has_id "$M8001_OUT" "$STORE_A_ID" && ! list_has_id "$M8001_OUT" "$STORE_B_ID"; then
  record_pass "M8-001" "Manager list scoped to store A"
else
  record_fail "M8-001" "Manager list scoping failed status=$M8001_STATUS count=$M8001_COUNT"
fi

# M8-002 cashier store list scoped
M8002_OUT="$TMP_DIR/m8002_cashier_list.json"
M8002_STATUS="$(api_call GET "$BASE_URL/stores/" "$CASHIER_TOKEN" "" "$M8002_OUT")"
M8002_COUNT="$(list_count "$M8002_OUT")"
if [[ "$M8002_STATUS" == "200" && "$M8002_COUNT" == "1" ]] && list_has_id "$M8002_OUT" "$STORE_A_ID" && ! list_has_id "$M8002_OUT" "$STORE_B_ID"; then
  record_pass "M8-002" "Cashier list scoped to own store"
else
  record_fail "M8-002" "Cashier list scoping failed status=$M8002_STATUS count=$M8002_COUNT"
fi

# M8-003 store-bound admin B should be scoped
M8003_OUT="$TMP_DIR/m8003_adminb_list.json"
M8003_STATUS="$(api_call GET "$BASE_URL/stores/" "$ADMIN_B_TOKEN" "" "$M8003_OUT")"
M8003_COUNT="$(list_count "$M8003_OUT")"
if [[ "$M8003_STATUS" == "200" && "$M8003_COUNT" == "1" ]] && list_has_id "$M8003_OUT" "$STORE_B_ID" && ! list_has_id "$M8003_OUT" "$STORE_A_ID"; then
  record_pass "M8-003" "Admin B list scoped to store B"
else
  record_fail "M8-003" "Admin B scoping failed status=$M8003_STATUS count=$M8003_COUNT"
fi

# M8-004 manager cannot get store B
M8004_OUT="$TMP_DIR/m8004_manager_get_storeb.json"
M8004_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_B_ID/" "$MANAGER_TOKEN" "" "$M8004_OUT")"
if is_forbidden_or_not_found "$M8004_STATUS"; then
  record_pass "M8-004" "Manager cannot retrieve store B"
else
  record_fail "M8-004" "Manager cross-store retrieve leak status=$M8004_STATUS"
fi

# M8-005 cashier cannot get store B
M8005_OUT="$TMP_DIR/m8005_cashier_get_storeb.json"
M8005_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_B_ID/" "$CASHIER_TOKEN" "" "$M8005_OUT")"
if is_forbidden_or_not_found "$M8005_STATUS"; then
  record_pass "M8-005" "Cashier cannot retrieve store B"
else
  record_fail "M8-005" "Cashier cross-store retrieve leak status=$M8005_STATUS"
fi

# M8-006 admin B cannot get store A
M8006_OUT="$TMP_DIR/m8006_adminb_get_storea.json"
M8006_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/" "$ADMIN_B_TOKEN" "" "$M8006_OUT")"
if is_forbidden_or_not_found "$M8006_STATUS"; then
  record_pass "M8-006" "Admin B cannot retrieve store A"
else
  record_fail "M8-006" "Admin B cross-store retrieve leak status=$M8006_STATUS"
fi

# M8-007 active endpoint manager scoped
M8007_OUT="$TMP_DIR/m8007_manager_active.json"
M8007_STATUS="$(api_call GET "$BASE_URL/stores/active/" "$MANAGER_TOKEN" "" "$M8007_OUT")"
M8007_COUNT="$(list_count "$M8007_OUT")"
if [[ "$M8007_STATUS" == "200" && "$M8007_COUNT" == "1" ]] && list_has_id "$M8007_OUT" "$STORE_A_ID"; then
  record_pass "M8-007" "Manager active endpoint scoped"
else
  record_fail "M8-007" "Manager active scope failed status=$M8007_STATUS count=$M8007_COUNT"
fi

# M8-008 admin B active endpoint scoped
M8008_STORE_OUT="$TMP_DIR/m8008_adminb_store_detail.json"
M8008_STORE_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_B_ID/" "$ADMIN_B_TOKEN" "" "$M8008_STORE_OUT")"
M8008_STORE_ACTIVE="$(jq -r '.is_active // false' "$M8008_STORE_OUT" 2>/dev/null || echo false)"
M8008_OUT="$TMP_DIR/m8008_adminb_active.json"
M8008_STATUS="$(api_call GET "$BASE_URL/stores/active/" "$ADMIN_B_TOKEN" "" "$M8008_OUT")"
M8008_COUNT="$(list_count "$M8008_OUT")"
M8008_EXPECTED_COUNT="0"
if [[ "$M8008_STORE_STATUS" == "200" && "$M8008_STORE_ACTIVE" == "true" ]]; then
  M8008_EXPECTED_COUNT="1"
fi
if [[ "$M8008_STATUS" == "200" && "$M8008_COUNT" == "$M8008_EXPECTED_COUNT" ]] && ! list_has_id "$M8008_OUT" "$STORE_A_ID" && { [[ "$M8008_EXPECTED_COUNT" == "0" ]] || list_has_id "$M8008_OUT" "$STORE_B_ID"; }; then
  record_pass "M8-008" "Admin B active endpoint scoped"
else
  record_fail "M8-008" "Admin B active scope failed status=$M8008_STATUS count=$M8008_COUNT expected=$M8008_EXPECTED_COUNT store_active=$M8008_STORE_ACTIVE"
fi

# M8-009 manager get own settings
M8009_OUT="$TMP_DIR/m8009_manager_get_settings.json"
M8009_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/settings/" "$MANAGER_TOKEN" "" "$M8009_OUT")"
M8009_OK="$(jq -r 'if (.invoice_prefix != null and .currency_symbol != null and .points_conversion_rate != null) then "yes" else "no" end' "$M8009_OUT")"
if [[ "$M8009_STATUS" == "200" && "$M8009_OK" == "yes" ]]; then
  record_pass "M8-009" "Manager can read store settings"
else
  record_fail "M8-009" "Settings read failed status=$M8009_STATUS keys=$M8009_OK"
fi

# M8-010 cashier get own settings allowed (read-only)
M8010_OUT="$TMP_DIR/m8010_cashier_get_settings.json"
M8010_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/settings/" "$CASHIER_TOKEN" "" "$M8010_OUT")"
if [[ "$M8010_STATUS" == "200" ]]; then
  record_pass "M8-010" "Cashier can read own store settings"
else
  record_fail "M8-010" "Cashier settings read expected 200 got $M8010_STATUS"
fi

# M8-011 admin B cannot get store A settings
M8011_OUT="$TMP_DIR/m8011_adminb_get_storea_settings.json"
M8011_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/settings/" "$ADMIN_B_TOKEN" "" "$M8011_OUT")"
if is_forbidden_or_not_found "$M8011_STATUS"; then
  record_pass "M8-011" "Admin B cannot read store A settings"
else
  record_fail "M8-011" "Admin B cross-store settings read leak status=$M8011_STATUS"
fi

# M8-012 manager patch own settings
NEW_PREFIX_A="M8A$TS4"
M8012_OUT="$TMP_DIR/m8012_manager_patch_settings.json"
M8012_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/settings/" "$MANAGER_TOKEN" "{\"invoice_prefix\":\"$NEW_PREFIX_A\",\"enable_customer_points\":true}" "$M8012_OUT")"
M8012_PREFIX="$(jq -r '.invoice_prefix // empty' "$M8012_OUT")"
if [[ "$M8012_STATUS" == "200" && "$M8012_PREFIX" == "$NEW_PREFIX_A" ]]; then
  record_pass "M8-012" "Manager can patch own store settings"
else
  record_fail "M8-012" "Manager settings patch failed status=$M8012_STATUS prefix=$M8012_PREFIX"
fi

# M8-013 cashier patch denied
M8013_OUT="$TMP_DIR/m8013_cashier_patch_settings.json"
M8013_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/settings/" "$CASHIER_TOKEN" "{\"invoice_prefix\":\"M8C$TS\"}" "$M8013_OUT")"
if [[ "$M8013_STATUS" == "403" ]]; then
  record_pass "M8-013" "Cashier cannot patch settings"
else
  record_fail "M8-013" "Cashier settings patch expected 403 got $M8013_STATUS"
fi

# M8-014 admin B patch own settings allowed
NEW_PREFIX_B="M8B$TS4"
M8014_OUT="$TMP_DIR/m8014_adminb_patch_own_settings.json"
M8014_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_B_ID/settings/" "$ADMIN_B_TOKEN" "{\"invoice_prefix\":\"$NEW_PREFIX_B\"}" "$M8014_OUT")"
M8014_PREFIX="$(jq -r '.invoice_prefix // empty' "$M8014_OUT")"
if [[ "$M8014_STATUS" == "200" && "$M8014_PREFIX" == "$NEW_PREFIX_B" ]]; then
  record_pass "M8-014" "Admin B can patch own store settings"
else
  record_fail "M8-014" "Admin B own settings patch failed status=$M8014_STATUS prefix=$M8014_PREFIX"
fi

# M8-015 admin B cannot patch store A settings
M8015_OUT="$TMP_DIR/m8015_adminb_patch_storea_settings.json"
M8015_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/settings/" "$ADMIN_B_TOKEN" "{\"invoice_prefix\":\"LEAK$TS\"}" "$M8015_OUT")"
if is_forbidden_or_not_found "$M8015_STATUS"; then
  record_pass "M8-015" "Admin B cannot patch store A settings"
else
  record_fail "M8-015" "Admin B cross-store settings patch leak status=$M8015_STATUS"
fi

# M8-016 invalid setting datatype rejected
M8016_OUT="$TMP_DIR/m8016_invalid_setting.json"
M8016_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/settings/" "$MANAGER_TOKEN" "{\"points_conversion_rate\":\"abc\"}" "$M8016_OUT")"
if [[ "$M8016_STATUS" == "400" ]]; then
  record_pass "M8-016" "Invalid settings payload rejected"
else
  record_fail "M8-016" "Invalid settings expected 400 got $M8016_STATUS"
fi

# M8-017 manager cannot patch store resource
M8017_OUT="$TMP_DIR/m8017_manager_patch_store.json"
M8017_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/" "$MANAGER_TOKEN" "{\"phone\":\"7000000000\"}" "$M8017_OUT")"
if [[ "$M8017_STATUS" == "403" ]]; then
  record_pass "M8-017" "Manager cannot patch store master details"
else
  record_fail "M8-017" "Manager store patch expected 403 got $M8017_STATUS"
fi

# M8-018 cashier cannot patch store resource
M8018_OUT="$TMP_DIR/m8018_cashier_patch_store.json"
M8018_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_A_ID/" "$CASHIER_TOKEN" "{\"phone\":\"7000000001\"}" "$M8018_OUT")"
if [[ "$M8018_STATUS" == "403" ]]; then
  record_pass "M8-018" "Cashier cannot patch store master details"
else
  record_fail "M8-018" "Cashier store patch expected 403 got $M8018_STATUS"
fi

# M8-019 admin B cannot patch store master details (global only)
M8019_OUT="$TMP_DIR/m8019_adminb_patch_store.json"
M8019_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_B_ID/" "$ADMIN_B_TOKEN" "{\"phone\":\"7000000002\"}" "$M8019_OUT")"
if [[ "$M8019_STATUS" == "403" ]]; then
  record_pass "M8-019" "Store-bound admin cannot patch store master details"
else
  record_fail "M8-019" "Store-bound admin store patch expected 403 got $M8019_STATUS"
fi

# M8-020 manager cannot create store
M8020_OUT="$TMP_DIR/m8020_manager_create_store.json"
M8020_PAYLOAD=$(cat <<JSON
{"name":"M8 Store Mgr $TS","code":"M8M$TS","address":"Addr","city":"City","state":"State","pincode":"400001","phone":"9111111111","recovery_email":"m8mgr$TS@example.com"}
JSON
)
M8020_STATUS="$(api_call POST "$BASE_URL/stores/" "$MANAGER_TOKEN" "$M8020_PAYLOAD" "$M8020_OUT")"
if [[ "$M8020_STATUS" == "403" ]]; then
  record_pass "M8-020" "Manager cannot create store"
else
  record_fail "M8-020" "Manager create store expected 403 got $M8020_STATUS"
fi

# M8-021 cashier cannot create store
M8021_OUT="$TMP_DIR/m8021_cashier_create_store.json"
M8021_STATUS="$(api_call POST "$BASE_URL/stores/" "$CASHIER_TOKEN" "$M8020_PAYLOAD" "$M8021_OUT")"
if [[ "$M8021_STATUS" == "403" ]]; then
  record_pass "M8-021" "Cashier cannot create store"
else
  record_fail "M8-021" "Cashier create store expected 403 got $M8021_STATUS"
fi

# M8-022 store-bound admin cannot create store
M8022_OUT="$TMP_DIR/m8022_adminb_create_store.json"
M8022_STATUS="$(api_call POST "$BASE_URL/stores/" "$ADMIN_B_TOKEN" "$M8020_PAYLOAD" "$M8022_OUT")"
if [[ "$M8022_STATUS" == "403" ]]; then
  record_pass "M8-022" "Store-bound admin cannot create store"
else
  record_fail "M8-022" "Store-bound admin create store expected 403 got $M8022_STATUS"
fi

# M8-023 store-bound admin cannot activate own store (global only)
M8023_OUT="$TMP_DIR/m8023_adminb_activate.json"
M8023_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_B_ID/activate/" "$ADMIN_B_TOKEN" "{}" "$M8023_OUT")"
if [[ "$M8023_STATUS" == "403" ]]; then
  record_pass "M8-023" "Store-bound admin cannot activate store"
else
  record_fail "M8-023" "Store-bound admin activate expected 403 got $M8023_STATUS"
fi

# M8-024 store-bound admin cannot deactivate own store (global only)
M8024_OUT="$TMP_DIR/m8024_adminb_deactivate.json"
M8024_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_B_ID/deactivate/" "$ADMIN_B_TOKEN" "{}" "$M8024_OUT")"
if [[ "$M8024_STATUS" == "403" ]]; then
  record_pass "M8-024" "Store-bound admin cannot deactivate store"
else
  record_fail "M8-024" "Store-bound admin deactivate expected 403 got $M8024_STATUS"
fi

# M8-025 store-bound admin cannot set_main
M8025_OUT="$TMP_DIR/m8025_adminb_set_main.json"
M8025_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_B_ID/set_main/" "$ADMIN_B_TOKEN" "{}" "$M8025_OUT")"
if [[ "$M8025_STATUS" == "403" ]]; then
  record_pass "M8-025" "Store-bound admin cannot set main store"
else
  record_fail "M8-025" "Store-bound admin set_main expected 403 got $M8025_STATUS"
fi

# M8-026 manager cannot activate store
M8026_OUT="$TMP_DIR/m8026_manager_activate.json"
M8026_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_A_ID/activate/" "$MANAGER_TOKEN" "{}" "$M8026_OUT")"
if [[ "$M8026_STATUS" == "403" ]]; then
  record_pass "M8-026" "Manager cannot activate store"
else
  record_fail "M8-026" "Manager activate expected 403 got $M8026_STATUS"
fi

# M8-027 manager cannot set_main
M8027_OUT="$TMP_DIR/m8027_manager_set_main.json"
M8027_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_A_ID/set_main/" "$MANAGER_TOKEN" "{}" "$M8027_OUT")"
if [[ "$M8027_STATUS" == "403" ]]; then
  record_pass "M8-027" "Manager cannot set main store"
else
  record_fail "M8-027" "Manager set_main expected 403 got $M8027_STATUS"
fi

# M8-028 bootstrap-import manager denied
M8028_OUT="$TMP_DIR/m8028_manager_bootstrap_import.json"
M8028_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_A_ID/bootstrap-import/" "$MANAGER_TOKEN" "{}" "$M8028_OUT")"
if [[ "$M8028_STATUS" == "403" ]]; then
  record_pass "M8-028" "Manager denied bootstrap import"
else
  record_fail "M8-028" "Manager bootstrap-import expected 403 got $M8028_STATUS"
fi

# M8-029 bootstrap-import store-bound admin denied
M8029_OUT="$TMP_DIR/m8029_adminb_bootstrap_import.json"
M8029_STATUS="$(api_call POST "$BASE_URL/stores/$STORE_B_ID/bootstrap-import/" "$ADMIN_B_TOKEN" "{}" "$M8029_OUT")"
if [[ "$M8029_STATUS" == "403" ]]; then
  record_pass "M8-029" "Store-bound admin denied bootstrap import"
else
  record_fail "M8-029" "Store-bound admin bootstrap-import expected 403 got $M8029_STATUS"
fi

# M8-030 cashier cannot patch settings cross-store
M8030_OUT="$TMP_DIR/m8030_cashier_patch_cross_store_settings.json"
M8030_STATUS="$(api_call PATCH "$BASE_URL/stores/$STORE_B_ID/settings/" "$CASHIER_TOKEN" "{\"invoice_prefix\":\"X\"}" "$M8030_OUT")"
if is_forbidden_or_not_found "$M8030_STATUS"; then
  record_pass "M8-030" "Cashier cannot patch cross-store settings"
else
  record_fail "M8-030" "Cashier cross-store settings patch leak status=$M8030_STATUS"
fi

# M8-031 cashier can get own store detail
M8031_OUT="$TMP_DIR/m8031_cashier_get_own_store.json"
M8031_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/" "$CASHIER_TOKEN" "" "$M8031_OUT")"
if [[ "$M8031_STATUS" == "200" ]]; then
  record_pass "M8-031" "Cashier can read own store detail"
else
  record_fail "M8-031" "Cashier own store detail expected 200 got $M8031_STATUS"
fi

# M8-032 manager can get own store detail
M8032_OUT="$TMP_DIR/m8032_manager_get_own_store.json"
M8032_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/" "$MANAGER_TOKEN" "" "$M8032_OUT")"
if [[ "$M8032_STATUS" == "200" ]]; then
  record_pass "M8-032" "Manager can read own store detail"
else
  record_fail "M8-032" "Manager own store detail expected 200 got $M8032_STATUS"
fi

# M8-033 admin B can get own store settings
M8033_OUT="$TMP_DIR/m8033_adminb_get_own_settings.json"
M8033_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_B_ID/settings/" "$ADMIN_B_TOKEN" "" "$M8033_OUT")"
if [[ "$M8033_STATUS" == "200" ]]; then
  record_pass "M8-033" "Admin B can read own store settings"
else
  record_fail "M8-033" "Admin B own settings expected 200 got $M8033_STATUS"
fi

# M8-034 settings patch persists
M8034_OUT="$TMP_DIR/m8034_verify_settings_persist.json"
M8034_STATUS="$(api_call GET "$BASE_URL/stores/$STORE_A_ID/settings/" "$MANAGER_TOKEN" "" "$M8034_OUT")"
M8034_PREFIX="$(jq -r '.invoice_prefix // empty' "$M8034_OUT")"
if [[ "$M8034_STATUS" == "200" && "$M8034_PREFIX" == "$NEW_PREFIX_A" ]]; then
  record_pass "M8-034" "Settings patch persisted"
else
  record_fail "M8-034" "Settings persistence failed status=$M8034_STATUS prefix=$M8034_PREFIX"
fi

# M8-035 store list includes settings blob
M8035_OUT="$TMP_DIR/m8035_manager_list_with_settings.json"
M8035_STATUS="$(api_call GET "$BASE_URL/stores/" "$MANAGER_TOKEN" "" "$M8035_OUT")"
M8035_HAS_SETTINGS="$(jq -r 'if ((.results[0].settings // null) != null) then "yes" else "no" end' "$M8035_OUT" 2>/dev/null)"
if [[ "$M8035_STATUS" == "200" && "$M8035_HAS_SETTINGS" == "yes" ]]; then
  record_pass "M8-035" "Store list includes settings object"
else
  record_fail "M8-035" "Store list settings object missing status=$M8035_STATUS has_settings=$M8035_HAS_SETTINGS"
fi

# M8-036 settings put with required fields works
M8036_OUT="$TMP_DIR/m8036_settings_put.json"
M8036_PAYLOAD=$(cat <<JSON
{
  "currency_symbol":"₹",
  "decimal_places":2,
  "date_format":"DD/MM/YYYY",
  "theme":"light",
  "invoice_prefix":"$NEW_PREFIX_A",
  "invoice_start_number":1,
  "show_tax_in_invoice":true,
  "enable_invoice_email":false,
  "allow_partial_payments":true,
  "enable_discount":true,
  "default_tax_rate":"0.00",
  "enable_round_off":true,
  "printer_type":"80mm",
  "enable_auto_print":true,
  "enable_low_stock_alert":true,
  "low_stock_threshold":10,
  "enable_customer_points":true,
  "points_conversion_rate":"1.00"
}
JSON
)
M8036_STATUS="$(api_call PUT "$BASE_URL/stores/$STORE_A_ID/settings/" "$MANAGER_TOKEN" "$M8036_PAYLOAD" "$M8036_OUT")"
if [[ "$M8036_STATUS" == "200" ]]; then
  record_pass "M8-036" "Settings PUT works for manager"
else
  record_fail "M8-036" "Settings PUT expected 200 got $M8036_STATUS"
fi

echo "TOTAL=$TOTAL PASS=$PASS FAIL=$FAIL TMP_DIR=$TMP_DIR" | tee -a "$RESULTS_FILE"
echo "$TMP_DIR"
