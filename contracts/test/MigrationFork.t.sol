// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/BlueCreditSystem.sol";
import "../migration/MwgHolders.sol";

interface IMWG {
    function balanceOf(address) external view returns (uint256);
    function totalSupply() external view returns (uint256);
}

/**
 * Fork test: proves the snapshot-based migration reproduces the live MWG
 * balances 1:1 on the new ERC20Votes token. Requires network access.
 *
 * Run: forge test --use 0.8.24 --match-contract MigrationFork
 *      (set BASE_RPC_URL for a faster/archival endpoint)
 */
contract MigrationForkTest is Test {
    address constant OLD_MWG = 0x84939fEc50EfdEDC8522917645AAfABFd5b3EA6F;

    function test_MigrationMatchesLiveBalances() public {
        string memory rpc = vm.envOr("BASE_RPC_URL", string("https://mainnet.base.org"));
        vm.createSelectFork(rpc);

        IMWG oldToken = IMWG(OLD_MWG);
        (address[] memory who, uint256[] memory amt) = MwgHolders.load();

        BlueCreditSystem token = new BlueCreditSystem();
        token.batchMint(who, amt);

        uint256 sum;
        for (uint256 i = 0; i < who.length; i++) {
            assertEq(token.balanceOf(who[i]), oldToken.balanceOf(who[i]), "holder balance mismatch");
            sum += amt[i];
        }
        assertEq(token.totalSupply(), oldToken.totalSupply(), "total supply mismatch");
        assertEq(sum, MwgHolders.TOTAL, "snapshot total mismatch");
    }
}
