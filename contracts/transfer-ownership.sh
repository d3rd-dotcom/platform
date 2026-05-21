#!/usr/bin/env bash
# Phase 3: hand the new token + governance + trader to the 2-of-3 Safe.
# Signed by Blue (current owner). Reads the Safe address from
# migration/safe.json. Run from the contracts/ directory AFTER create-safe.js:
#   bash transfer-ownership.sh
set -euo pipefail

set -a; . ../.env.local; set +a
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"

SAFE_ADDRESS="$(node -e "console.log(require('./migration/safe.json').safeAddress)")"
export SAFE_ADDRESS
export MWG_TOKEN_ADDRESS=0x0Eb5956b043A3Cd95C0f050a86faff48B7aA28E7
export BLUE_KILLSTREAK_ADDRESS=0x09a4FEfEe8245B644713546FDF28b4160218f7Fc
export BLUE_MARKET_TRADER_ADDRESS=0xAFa5382c8c634021f55Cc680D45209a203bBfd92

echo "Transferring ownership of:"
echo "  token      $MWG_TOKEN_ADDRESS"
echo "  governance $BLUE_KILLSTREAK_ADDRESS"
echo "  trader     $BLUE_MARKET_TRADER_ADDRESS"
echo "to Safe: $SAFE_ADDRESS"

forge script script/TransferOwnership.s.sol:TransferOwnership \
  --rpc-url "$RPC" \
  --broadcast \
  --use 0.8.24
