#!/bin/bash
# =============================================================================
# Omnia Vault — Phase 3 Integration Test Suite
# Tests the full stub/restore lifecycle against the live Rust daemon (port 4000)
# =============================================================================
set -euo pipefail

RUST_API="http://127.0.0.1:4000"
NODE_API="http://127.0.0.1:3001"
VAULT_DIR="/Users/sa/Documents/timelabs-npo/omnia-vault/VaultData"
DB_PATH="/Users/sa/Documents/timelabs-npo/omnia-vault/supervisor/vault_state.db"
TEST_DIR="/tmp/omnia_vault_test_$$"
PASS=0
FAIL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

pass() { ((PASS++)); echo -e "  ${GREEN}✓ PASS${NC}: $1"; }
fail() { ((FAIL++)); echo -e "  ${RED}✗ FAIL${NC}: $1"; }

echo ""
echo "======================================================================"
echo "  Omnia Vault — Phase 3 Automated Integration Tests"
echo "  $(date '+%Y-%m-%d %H:%M:%S')"
echo "======================================================================"

# ── Prerequisite checks ────────────────────────────────────────────────
echo ""
echo "${YELLOW}▸ Prerequisite Checks${NC}"

# 1. Rust daemon alive?
if curl -sf "${RUST_API}/health" > /dev/null 2>&1; then
  pass "Rust supervisor reachable at ${RUST_API}"
else
  fail "Rust supervisor NOT reachable at ${RUST_API}"
  echo "  ↳ Cannot continue. Start the daemon with: cd supervisor && cargo run"
  exit 1
fi

# 2. Health response structure
HEALTH=$(curl -sf "${RUST_API}/health")
if echo "$HEALTH" | python3 -c "import sys,json; d=json.load(sys.stdin); assert d['status']=='ok'" 2>/dev/null; then
  pass "GET /health returns {status: 'ok'}"
else
  fail "GET /health unexpected response: ${HEALTH}"
fi

# 3. Metrics endpoint
METRICS=$(curl -sf "${RUST_API}/metrics")
if echo "$METRICS" | python3 -c "import sys,json; d=json.load(sys.stdin); assert 'total_memory' in d and d['total_memory'] > 0" 2>/dev/null; then
  pass "GET /metrics returns valid system memory data"
else
  fail "GET /metrics unexpected response: ${METRICS}"
fi

# 4. SQLite DB exists
if [ -f "$DB_PATH" ]; then
  pass "vault_state.db exists at expected path"
else
  fail "vault_state.db NOT found at ${DB_PATH}"
fi

# 5. VaultData directory exists
if [ -d "$VAULT_DIR" ]; then
  pass "VaultData directory exists"
else
  fail "VaultData directory NOT found"
fi

# ── Stub/Restore lifecycle ─────────────────────────────────────────────
echo ""
echo "${YELLOW}▸ Stub/Restore Lifecycle Test${NC}"

# Create a test file
mkdir -p "$TEST_DIR"
TEST_FILE="${TEST_DIR}/test_large_file.bin"
dd if=/dev/urandom of="$TEST_FILE" bs=1024 count=64 2>/dev/null
ORIGINAL_SHA=$(shasum -a 256 "$TEST_FILE" | awk '{print $1}')
ORIGINAL_SIZE=$(stat -f%z "$TEST_FILE")
echo "  Created test file: ${TEST_FILE} (${ORIGINAL_SIZE} bytes, sha256: ${ORIGINAL_SHA:0:16}…)"

# 6. Stub the file
STUB_RESP=$(curl -sf -X POST "${RUST_API}/cloud/stub" \
  -H "Content-Type: application/json" \
  -d "{\"file_path\": \"${TEST_FILE}\"}")

STUB_STATUS=$(echo "$STUB_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "error")
if [ "$STUB_STATUS" = "success" ]; then
  pass "POST /cloud/stub returned status=success"
else
  fail "POST /cloud/stub returned: ${STUB_RESP}"
fi

# 7. Original path is now a symlink
if [ -L "$TEST_FILE" ]; then
  pass "Original path is now a symlink"
else
  fail "Original path is NOT a symlink after stub"
fi

# 8. Symlink points into VaultData
LINK_TARGET=$(readlink "$TEST_FILE" 2>/dev/null || echo "")
if echo "$LINK_TARGET" | grep -q "VaultData"; then
  pass "Symlink target is inside VaultData: $(basename "$LINK_TARGET")"
else
  fail "Symlink target is NOT inside VaultData: ${LINK_TARGET}"
fi

# 9. Vault file exists and content matches
if [ -f "$LINK_TARGET" ]; then
  VAULT_SHA=$(shasum -a 256 "$LINK_TARGET" | awk '{print $1}')
  if [ "$VAULT_SHA" = "$ORIGINAL_SHA" ]; then
    pass "Vault file SHA-256 matches original (data integrity OK)"
  else
    fail "Vault file SHA-256 mismatch! Expected ${ORIGINAL_SHA:0:16}… got ${VAULT_SHA:0:16}…"
  fi
else
  fail "Vault file does not exist at ${LINK_TARGET}"
fi

# 10. SQLite has a record
DB_COUNT=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM stubbed_files WHERE original_path='${TEST_FILE}';")
if [ "$DB_COUNT" = "1" ]; then
  pass "SQLite has exactly 1 record for the stubbed file"
else
  fail "SQLite record count for test file: ${DB_COUNT} (expected 1)"
fi

# 11. SQLite record fields are sane
DB_ROW=$(sqlite3 "$DB_PATH" "SELECT vault_path, size, stubbed_at FROM stubbed_files WHERE original_path='${TEST_FILE}';")
DB_VAULT_PATH=$(echo "$DB_ROW" | cut -d'|' -f1)
DB_SIZE=$(echo "$DB_ROW" | cut -d'|' -f2)
DB_TIMESTAMP=$(echo "$DB_ROW" | cut -d'|' -f3)

if [ "$DB_VAULT_PATH" = "$LINK_TARGET" ]; then
  pass "SQLite vault_path matches actual symlink target"
else
  fail "SQLite vault_path mismatch: DB='${DB_VAULT_PATH}' vs Link='${LINK_TARGET}'"
fi

if [ "$DB_SIZE" = "$ORIGINAL_SIZE" ]; then
  pass "SQLite size matches original file size (${DB_SIZE} bytes)"
else
  fail "SQLite size mismatch: DB=${DB_SIZE} vs Original=${ORIGINAL_SIZE}"
fi

if [ "$DB_TIMESTAMP" -gt 0 ] 2>/dev/null; then
  pass "SQLite stubbed_at timestamp is valid (${DB_TIMESTAMP})"
else
  fail "SQLite stubbed_at timestamp invalid: ${DB_TIMESTAMP}"
fi

# 12. Double-stub should fail gracefully
DOUBLE_STUB=$(curl -sf -X POST "${RUST_API}/cloud/stub" \
  -H "Content-Type: application/json" \
  -d "{\"file_path\": \"${TEST_FILE}\"}")
DOUBLE_STATUS=$(echo "$DOUBLE_STUB" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "")
if [ "$DOUBLE_STATUS" = "error" ]; then
  pass "Double-stub correctly rejected (already a symlink)"
else
  fail "Double-stub was NOT rejected: ${DOUBLE_STUB}"
fi

# ── Restore ────────────────────────────────────────────────────────────
echo ""
echo "${YELLOW}▸ Restore Lifecycle Test${NC}"

# 13. Restore the file
RESTORE_RESP=$(curl -sf -X POST "${RUST_API}/cloud/restore" \
  -H "Content-Type: application/json" \
  -d "{\"file_path\": \"${TEST_FILE}\"}")

RESTORE_STATUS=$(echo "$RESTORE_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "error")
if [ "$RESTORE_STATUS" = "success" ]; then
  pass "POST /cloud/restore returned status=success"
else
  fail "POST /cloud/restore returned: ${RESTORE_RESP}"
fi

# 14. Original path is now a real file again (not a symlink)
if [ -f "$TEST_FILE" ] && [ ! -L "$TEST_FILE" ]; then
  pass "Original path is a real file again (not a symlink)"
else
  fail "Original path is still a symlink or missing after restore"
fi

# 15. Content integrity after round-trip
RESTORED_SHA=$(shasum -a 256 "$TEST_FILE" | awk '{print $1}')
if [ "$RESTORED_SHA" = "$ORIGINAL_SHA" ]; then
  pass "Restored file SHA-256 matches original (round-trip integrity OK)"
else
  fail "Restored file SHA-256 mismatch! Expected ${ORIGINAL_SHA:0:16}… got ${RESTORED_SHA:0:16}…"
fi

# 16. Vault file is cleaned up
if [ ! -f "$LINK_TARGET" ]; then
  pass "Vault payload removed from VaultData after restore"
else
  fail "Vault payload still exists at ${LINK_TARGET} after restore"
fi

# 17. SQLite record is cleaned up
DB_COUNT_AFTER=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM stubbed_files WHERE original_path='${TEST_FILE}';")
if [ "$DB_COUNT_AFTER" = "0" ]; then
  pass "SQLite record deleted after restore"
else
  fail "SQLite record still exists after restore (count: ${DB_COUNT_AFTER})"
fi

# 18. Double-restore should fail gracefully
DOUBLE_RESTORE=$(curl -sf -X POST "${RUST_API}/cloud/restore" \
  -H "Content-Type: application/json" \
  -d "{\"file_path\": \"${TEST_FILE}\"}")
DOUBLE_RESTORE_STATUS=$(echo "$DOUBLE_RESTORE" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "")
if [ "$DOUBLE_RESTORE_STATUS" = "error" ]; then
  pass "Double-restore correctly rejected (not a symlink)"
else
  fail "Double-restore was NOT rejected: ${DOUBLE_RESTORE}"
fi

# ── Edge cases ─────────────────────────────────────────────────────────
echo ""
echo "${YELLOW}▸ Edge Case Tests${NC}"

# 19. Stub non-existent file
GHOST_RESP=$(curl -sf -X POST "${RUST_API}/cloud/stub" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/tmp/this_file_does_not_exist_12345"}')
GHOST_STATUS=$(echo "$GHOST_RESP" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "")
if [ "$GHOST_STATUS" = "error" ]; then
  pass "Stub non-existent file correctly returns error"
else
  fail "Stub non-existent file did NOT return error: ${GHOST_RESP}"
fi

# 20. Restore non-existent file
GHOST_RESTORE=$(curl -sf -X POST "${RUST_API}/cloud/restore" \
  -H "Content-Type: application/json" \
  -d '{"file_path": "/tmp/this_file_does_not_exist_12345"}')
GHOST_RESTORE_STATUS=$(echo "$GHOST_RESTORE" | python3 -c "import sys,json; print(json.load(sys.stdin)['status'])" 2>/dev/null || echo "")
if [ "$GHOST_RESTORE_STATUS" = "error" ]; then
  pass "Restore non-existent file correctly returns error"
else
  fail "Restore non-existent file did NOT return error: ${GHOST_RESTORE}"
fi

# ── Node proxy integration ─────────────────────────────────────────────
echo ""
echo "${YELLOW}▸ Node.js Proxy Integration${NC}"

if curl -sf "${NODE_API}/api/status" > /dev/null 2>&1; then
  pass "Node.js proxy reachable at ${NODE_API}"
  
  # Test /api/files
  FILES_RESP=$(curl -sf "${NODE_API}/api/files")
  if echo "$FILES_RESP" | python3 -c "import sys,json; d=json.load(sys.stdin); assert isinstance(d, list)" 2>/dev/null; then
    pass "GET /api/files returns a valid JSON array"
  else
    fail "GET /api/files unexpected response"
  fi
else
  echo -e "  ${YELLOW}⊘ SKIP${NC}: Node.js proxy not running on ${NODE_API}"
fi

# ── Cleanup ────────────────────────────────────────────────────────────
rm -rf "$TEST_DIR"

# ── Summary ────────────────────────────────────────────────────────────
echo ""
echo "======================================================================"
TOTAL=$((PASS + FAIL))
if [ "$FAIL" -eq 0 ]; then
  echo -e "  ${GREEN}ALL ${TOTAL} TESTS PASSED${NC}"
else
  echo -e "  ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC} out of ${TOTAL} tests"
fi
echo "======================================================================"
echo ""

exit "$FAIL"
