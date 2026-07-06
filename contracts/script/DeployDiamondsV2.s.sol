// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/DiamondsV2.sol";

/**
 * @title DeployDiamondsV2
 * @notice Deploys Diamonds ($BLUE) v2 + its ReflectionVault. Blue is deployer
 *         and owner; her wallet receives the 200M stash in the constructor.
 *
 * Full op-order: docs/tokenomics/blue-v2-redeploy-mission-brief.md. This script
 * is Phase C. Do not broadcast until Phases A-B are green.
 *
 * Dry run (fork, no broadcast):
 *   forge script script/DeployDiamondsV2.s.sol:DeployDiamondsV2 --rpc-url $BASE_RPC_URL
 *
 * Broadcast to Base mainnet — gas pinned, never let the RPC pick the tip
 * (the 2026-07-02 incident: default 1.5 gwei tip = ~200x Base's going rate):
 *   forge script script/DeployDiamondsV2.s.sol:DeployDiamondsV2 \
 *     --rpc-url $BASE_RPC_URL --broadcast \
 *     --priority-gas-price 1000000 --with-gas-price 100000000
 *
 * Immediately after broadcast (both contracts, then GoPlus scan per brief):
 *   forge verify-contract <token> src/DiamondsV2.sol:DiamondsV2 --chain base \
 *     --constructor-args $(cast abi-encode "constructor(address,address)" <blue> <cbBTC>)
 *   forge verify-contract <vault> src/ReflectionVault.sol:ReflectionVault --chain base \
 *     --constructor-args $(cast abi-encode "constructor(address,address,address)" <token> <cbBTC> <blue>)
 *
 * After deploy: swap DIAMONDS_TOKEN_ADDRESS / NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS,
 * add NEXT_PUBLIC_REFLECTION_VAULT_ADDRESS + DIAMONDS_V1_TOKEN_ADDRESS
 * (.env.local + Vercel). The CDP server wallet is granted minter at runtime by
 * lib/diamonds-onchain.ts on the first claim — the mint ABI is unchanged.
 */
contract DeployDiamondsV2 is Script {
    /// @notice cbBTC on Base mainnet (Coinbase Wrapped BTC, 8 decimals).
    address public constant CBBTC = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;

    function run() external {
        // Blue signs the deploy. Prefer BLUE_PRIVATE_KEY, fall back to the
        // legacy AZURA_PRIVATE_KEY (where Blue's key is actually stored).
        uint256 deployerPrivateKey;
        try vm.envUint("BLUE_PRIVATE_KEY") returns (uint256 k) {
            deployerPrivateKey = k;
        } catch {
            deployerPrivateKey = vm.envUint("AZURA_PRIVATE_KEY");
        }

        address blue = vm.addr(deployerPrivateKey);
        console.log("Deployer / Blue / owner:", blue);

        vm.startBroadcast(deployerPrivateKey);
        DiamondsV2 diamonds = new DiamondsV2(blue, CBBTC);
        vm.stopBroadcast();

        console.log("DiamondsV2 ($BLUE):", address(diamonds));
        console.log("ReflectionVault:   ", address(diamonds.vault()));
        console.log("Blue stash:", diamonds.balanceOf(blue) / 1e18, "BLUE");
        console.log("Fee bps:", diamonds.feeBps(), "(cap 200, dormant until a pair is flagged)");
    }
}
