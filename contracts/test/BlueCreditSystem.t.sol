// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/BlueCreditSystem.sol";

contract BlueCreditSystemTest is Test {
    BlueCreditSystem public token;
    address public owner;
    address public alice;
    address public bob;

    function setUp() public {
        owner = address(this);
        alice = makeAddr("alice");
        bob = makeAddr("bob");
        token = new BlueCreditSystem();
    }

    function test_Metadata() public view {
        assertEq(token.name(), "Mental Wealth Governance");
        assertEq(token.symbol(), "MWG");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
    }

    function test_IsERC20Votes() public {
        // getVotes / getPastVotes must not revert (the old MWG bug).
        assertEq(token.getVotes(alice), 0);
        vm.roll(block.number + 1);
        assertEq(token.getPastVotes(alice, block.number - 1), 0);
    }

    function test_MintAndDelegateGivesVotingPower() public {
        token.mint(alice, 1000e18);
        assertEq(token.balanceOf(alice), 1000e18);
        // Balance alone is not voting power until delegated.
        assertEq(token.getVotes(alice), 0);
        vm.prank(alice);
        token.delegate(alice);
        assertEq(token.getVotes(alice), 1000e18);
    }

    function test_BatchMintMatchesSnapshot() public {
        address[] memory who = new address[](2);
        uint256[] memory amt = new uint256[](2);
        who[0] = alice; who[1] = bob;
        amt[0] = 40_000e18; amt[1] = 10_000e18;
        token.batchMint(who, amt);
        assertEq(token.balanceOf(alice), 40_000e18);
        assertEq(token.balanceOf(bob), 10_000e18);
        assertEq(token.totalSupply(), 50_000e18);
    }

    function test_RevertWhen_BatchMintLengthMismatch() public {
        address[] memory who = new address[](2);
        uint256[] memory amt = new uint256[](1);
        vm.expectRevert(BlueCreditSystem.LengthMismatch.selector);
        token.batchMint(who, amt);
    }

    function test_RevertWhen_NonOwnerMints() public {
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", alice));
        token.mint(alice, 1e18);
    }

    function test_RenounceMintingStopsMint() public {
        token.renounceMinting();
        assertTrue(token.mintingFinished());
        vm.expectRevert(BlueCreditSystem.MintingIsFinished.selector);
        token.mint(alice, 1e18);
    }

    function test_PastVotesTracksHistory() public {
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.delegate(alice);
        vm.roll(block.number + 1);
        uint256 atBlock = block.number - 1;
        token.mint(alice, 50e18); // later balance change
        vm.roll(block.number + 1);
        assertEq(token.getPastVotes(alice, atBlock), 100e18); // historical snapshot unchanged
        assertEq(token.getVotes(alice), 150e18);
    }
}
