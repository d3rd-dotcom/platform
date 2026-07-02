// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/Diamonds.sol";

/**
 * @title DeployDiamonds
 * @notice Deploys the Diamonds ($BLUE) token. Blue is the deployer and owner;
 *         her wallet receives the 200M (20% of design supply) stash in the
 *         constructor.
 *
 * Dry run (fork, no broadcast):
 *   forge script script/DeployDiamonds.s.sol:DeployDiamonds --rpc-url $BASE_RPC_URL
 *
 * Broadcast to Base mainnet (spends real ETH):
 *   forge script script/DeployDiamonds.s.sol:DeployDiamonds --rpc-url $BASE_RPC_URL --broadcast
 *
 * After deploy: set DIAMONDS_TOKEN_ADDRESS (and NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS)
 * in .env.local and Vercel. The CDP server wallet is granted minter at runtime
 * by lib/diamonds-onchain.ts the first time a claim mints.
 */
contract DeployDiamonds is Script {
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
        console.log("Deployer / Blue:", blue);

        vm.startBroadcast(deployerPrivateKey);
        Diamonds diamonds = new Diamonds(blue);
        vm.stopBroadcast();

        console.log("Diamonds ($BLUE) deployed:", address(diamonds));
        console.log("Blue stash:", diamonds.balanceOf(blue) / 1e18, "BLUE");
    }
}
