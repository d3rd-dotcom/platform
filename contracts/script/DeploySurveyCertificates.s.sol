// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/SurveyCertificates.sol";

/**
 * @title DeploySurveyCertificates
 *
 * Base Sepolia (test):
 *   forge script script/DeploySurveyCertificates.s.sol --rpc-url base_sepolia --broadcast --verify
 *
 * Base Mainnet:
 *   forge script script/DeploySurveyCertificates.s.sol --rpc-url base --broadcast --verify
 *
 * Required env vars:
 *   AZURA_PRIVATE_KEY   — Blue's deployer key (becomes owner + minter)
 *   BASESCAN_API_KEY    — for --verify
 */
contract DeploySurveyCertificates is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("AZURA_PRIVATE_KEY");
        address deployer    = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        // Deployer is both owner and minter; transfer ownership to multisig after deploy.
        SurveyCertificates cert = new SurveyCertificates(deployer);

        vm.stopBroadcast();

        console.log("==============================================");
        console.log("SURVEY CERTIFICATES DEPLOYED");
        console.log("==============================================");
        console.log("Network :", block.chainid == 84532 ? "Base Sepolia" : "Base Mainnet");
        console.log("Contract:", address(cert));
        console.log("Owner   :", cert.owner());
        console.log("Minter  :", cert.minter());
        console.log("==============================================");
        console.log("TOKEN IDs");
        console.log("  1 = Secure");
        console.log("  2 = Anxious");
        console.log("  3 = Avoidant");
        console.log("  4 = Fearful-Avoidant");
        console.log("==============================================");
        console.log("NEXT STEPS");
        console.log("1. Add to .env:");
        console.log("   SURVEY_CERTIFICATES_ADDRESS=", address(cert));
        console.log("   NEXT_PUBLIC_SURVEY_CERTIFICATES_ADDRESS=", address(cert));
        console.log("2. Upload certificate images + metadata to IPFS via lib/ipfs-upload.ts");
        console.log("3. Call setTokenURI(1..4, ipfs://...) for each certificate");
        console.log("4. Transfer ownership to the multisig Safe when ready");
        console.log("==============================================");
    }
}
