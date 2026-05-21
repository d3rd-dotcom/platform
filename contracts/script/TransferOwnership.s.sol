// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";

interface IOwnable {
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
}

/**
 * @title TransferOwnership
 * @notice Phase 3: hand ownership of the new token, governance, and trader to
 *         the 2-of-3 Safe. Signed by Blue (the current owner / deployer).
 *
 * Run after the Safe exists (scripts/create-safe.js) and after DeployV2.
 *
 * Dry run:
 *   SAFE_ADDRESS=0x.. MWG_TOKEN_ADDRESS=0x.. BLUE_KILLSTREAK_ADDRESS=0x.. \
 *   BLUE_MARKET_TRADER_ADDRESS=0x.. \
 *   forge script script/TransferOwnership.s.sol:TransferOwnership --rpc-url $BASE_RPC_URL
 *
 * Broadcast: add --broadcast
 *
 * Note: these contracts use single-step OZ Ownable, so the transfer is
 * immediate and irreversible — once done, only the Safe can call owner-only
 * functions. Verify SAFE_ADDRESS carefully before broadcasting.
 */
contract TransferOwnership is Script {
    function run() external {
        // Blue signs (current owner). Prefer BLUE_PRIVATE_KEY, fall back to AZURA.
        uint256 ownerKey;
        try vm.envUint("BLUE_PRIVATE_KEY") returns (uint256 k) { ownerKey = k; }
        catch { ownerKey = vm.envUint("AZURA_PRIVATE_KEY"); }
        address signer = vm.addr(ownerKey);

        address safe = vm.envAddress("SAFE_ADDRESS");
        require(safe.code.length > 0, "SAFE_ADDRESS has no code - deploy the Safe first");

        address[3] memory targets = [
            vm.envAddress("MWG_TOKEN_ADDRESS"),
            vm.envAddress("BLUE_KILLSTREAK_ADDRESS"),
            vm.envAddress("BLUE_MARKET_TRADER_ADDRESS")
        ];

        // Pre-checks: each target exists and is currently owned by the signer.
        for (uint256 i = 0; i < targets.length; i++) {
            require(targets[i].code.length > 0, "target has no code");
            address cur = IOwnable(targets[i]).owner();
            require(cur == signer, "signer is not the current owner of a target");
        }

        console.log("Signer (current owner):", signer);
        console.log("New owner (Safe):", safe);

        vm.startBroadcast(ownerKey);
        for (uint256 i = 0; i < targets.length; i++) {
            IOwnable(targets[i]).transferOwnership(safe);
            console.log("transferred:", targets[i]);
        }
        vm.stopBroadcast();

        // Post-checks.
        for (uint256 i = 0; i < targets.length; i++) {
            require(IOwnable(targets[i]).owner() == safe, "ownership did not transfer");
        }
        console.log("\nAll three contracts are now owned by the Safe.");
        console.log("Remaining Phase 3: move Blue's signer to CDP Server-Signer / MPC.");
    }
}
