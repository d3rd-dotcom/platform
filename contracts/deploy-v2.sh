#!/usr/bin/env bash
# Phase 1+2 launch: deploy BlueCreditSystem (MWG), migrate holders, deploy
# BlueKillStreak + BlueMarketTrader. Signed by Blue's key from ../.env.local.
# Run from the contracts/ directory:  bash deploy-v2.sh
set -euo pipefail

set -a; . ../.env.local; set +a
RPC="${BASE_RPC_URL:-https://mainnet.base.org}"

echo "Deploying to $RPC (Blue signs, spends real ETH)..."
forge script script/DeployV2.s.sol:DeployV2 \
  --rpc-url "$RPC" \
  --broadcast \
  --use 0.8.24
