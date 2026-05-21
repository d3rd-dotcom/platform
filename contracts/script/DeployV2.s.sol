// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/BlueCreditSystem.sol";
import "../src/BlueKillStreak.sol";
import "../src/BlueMarketTrader.sol";
import "../migration/MwgHolders.sol";

/**
 * @title DeployV2
 * @notice Phase 1 + 2 of the redeploy: deploy the ERC20Votes MWG
 *         (BlueCreditSystem), migrate prior holder balances, then deploy
 *         BlueKillStreak (governance) and BlueMarketTrader (treasury).
 *
 * Does NOT do Phase 3 (ownership -> Safe) or Phase 4 (forwarder/workflow wiring).
 * Ownership stays with the deployer so those steps can follow.
 *
 * Dry run (fork, no broadcast):
 *   forge script script/DeployV2.s.sol:DeployV2 --rpc-url $BASE_RPC_URL
 *
 * Broadcast to Base mainnet (spends real ETH — review first):
 *   forge script script/DeployV2.s.sol:DeployV2 --rpc-url $BASE_RPC_URL --broadcast --verify
 *
 * Requires env: PRIVATE_KEY (deployer), BLUE_AGENT_ADDRESS (Blue's wallet).
 */
contract DeployV2 is Script {
    address constant USDC_MAINNET = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    address constant USDC_SEPOLIA = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address blueAgent = vm.envAddress("BLUE_AGENT_ADDRESS");

        address usdc;
        if (block.chainid == 8453) usdc = USDC_MAINNET;
        else if (block.chainid == 84532) usdc = USDC_SEPOLIA;
        else revert("Unsupported network");

        (address[] memory holders, uint256[] memory amounts) = MwgHolders.load();

        vm.startBroadcast(deployerPrivateKey);

        // 1. New ERC20Votes governance token.
        BlueCreditSystem token = new BlueCreditSystem();
        console.log("BlueCreditSystem (MWG, ERC20Votes):", address(token));

        // 2. Migrate prior holder balances 1:1, then lock minting.
        token.batchMint(holders, amounts);
        token.renounceMinting();
        console.log("Migrated holders:", holders.length, "total:", token.totalSupply());
        require(token.totalSupply() == MwgHolders.TOTAL, "supply mismatch vs snapshot");

        // 3. Governance contract, sized to the real migrated supply.
        BlueKillStreak governance = new BlueKillStreak(
            address(token),
            usdc,
            blueAgent,
            token.totalSupply()
        );
        console.log("BlueKillStreak:", address(governance));

        // 4. Treasury trader.
        BlueMarketTrader trader = new BlueMarketTrader(usdc);
        console.log("BlueMarketTrader:", address(trader));

        vm.stopBroadcast();

        console.log("\n=== DeployV2 complete (Phases 1-2) ===");
        console.log("Token:", address(token));
        console.log("Governance:", address(governance));
        console.log("Trader:", address(trader));
        console.log("USDC:", usdc);
        console.log("Blue agent:", blueAgent);
        console.log("\nNEXT (not done here):");
        console.log("- Phase 3: transferOwnership of governance + trader to the Safe; move Blue signer to CDP.");
        console.log("- Phase 4: setKeystoneForwarder + setAllowedWorkflow; redeploy CRE; update env addresses.");
        console.log("- Holders must delegate(self) to activate voting power.");
    }
}
