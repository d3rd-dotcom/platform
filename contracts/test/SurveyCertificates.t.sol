// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/SurveyCertificates.sol";

contract SurveyCertificatesTest is Test {
    SurveyCertificates public cert;

    address public owner;
    address public minter;
    address public alice;
    address public bob;

    // Local constants — mirror the contract so we never call cert.SECURE() inside a pranked scope.
    uint256 constant SECURE           = 1;
    uint256 constant ANXIOUS          = 2;
    uint256 constant AVOIDANT         = 3;
    uint256 constant FEARFUL_AVOIDANT = 4;

    function setUp() public {
        owner  = address(this);
        minter = makeAddr("minter");
        alice  = makeAddr("alice");
        bob    = makeAddr("bob");

        cert = new SurveyCertificates(minter);
    }

    // ─── mint ─────────────────────────────────────────────────────────────

    function test_mint_secure() public {
        vm.prank(minter);
        cert.mint(alice, SECURE);

        assertEq(cert.balanceOf(alice, SECURE), 1);
        assertTrue(cert.hasMinted(alice, SECURE));
    }

    function test_mint_allFourTypes() public {
        vm.startPrank(minter);
        cert.mint(alice, SECURE);
        cert.mint(alice, ANXIOUS);
        cert.mint(alice, AVOIDANT);
        cert.mint(alice, FEARFUL_AVOIDANT);
        vm.stopPrank();

        assertEq(cert.balanceOf(alice, SECURE),           1);
        assertEq(cert.balanceOf(alice, ANXIOUS),          1);
        assertEq(cert.balanceOf(alice, AVOIDANT),         1);
        assertEq(cert.balanceOf(alice, FEARFUL_AVOIDANT), 1);
    }

    function test_mint_emitsEvent() public {
        cert.setTokenURI(SECURE, "ipfs://QmSecure");

        vm.expectEmit(true, true, false, true);
        emit SurveyCertificates.CertificateMinted(alice, SECURE, "ipfs://QmSecure");

        vm.prank(minter);
        cert.mint(alice, SECURE);
    }

    function test_mint_differentWalletsSameToken() public {
        vm.startPrank(minter);
        cert.mint(alice, SECURE);
        cert.mint(bob,   SECURE);
        vm.stopPrank();

        assertEq(cert.balanceOf(alice, SECURE), 1);
        assertEq(cert.balanceOf(bob,   SECURE), 1);
    }

    // ─── mint: access control ─────────────────────────────────────────────

    function test_mint_revertsIfNotMinter() public {
        vm.prank(alice);
        vm.expectRevert(SurveyCertificates.NotMinter.selector);
        cert.mint(alice, SECURE);
    }

    function test_mint_revertsIfOwnerCallsDirectly() public {
        vm.expectRevert(SurveyCertificates.NotMinter.selector);
        cert.mint(alice, SECURE);
    }

    // ─── mint: one-per-wallet guard ───────────────────────────────────────

    function test_mint_revertsOnDoubleMint() public {
        vm.startPrank(minter);
        cert.mint(alice, SECURE);
        vm.expectRevert(SurveyCertificates.AlreadyMinted.selector);
        cert.mint(alice, SECURE);
        vm.stopPrank();
    }

    function test_mint_allowsDifferentTokenForSameWallet() public {
        vm.startPrank(minter);
        cert.mint(alice, SECURE);
        cert.mint(alice, ANXIOUS);
        vm.stopPrank();

        assertEq(cert.balanceOf(alice, SECURE),  1);
        assertEq(cert.balanceOf(alice, ANXIOUS), 1);
    }

    // ─── mint: invalid token id ───────────────────────────────────────────

    function test_mint_revertsOnTokenIdZero() public {
        vm.prank(minter);
        vm.expectRevert(SurveyCertificates.InvalidTokenId.selector);
        cert.mint(alice, 0);
    }

    function test_mint_revertsOnTokenIdTooHigh() public {
        vm.prank(minter);
        vm.expectRevert(SurveyCertificates.InvalidTokenId.selector);
        cert.mint(alice, 5);
    }

    // ─── soulbound transfers ──────────────────────────────────────────────

    function test_transfer_reverts() public {
        vm.prank(minter);
        cert.mint(alice, SECURE);

        vm.prank(alice);
        vm.expectRevert(SurveyCertificates.SoulboundTransferForbidden.selector);
        cert.safeTransferFrom(alice, bob, SECURE, 1, "");
    }

    function test_batchTransfer_reverts() public {
        vm.prank(minter);
        cert.mint(alice, SECURE);

        uint256[] memory ids     = new uint256[](1);
        uint256[] memory amounts = new uint256[](1);
        ids[0]     = SECURE;
        amounts[0] = 1;

        vm.prank(alice);
        vm.expectRevert(SurveyCertificates.SoulboundTransferForbidden.selector);
        cert.safeBatchTransferFrom(alice, bob, ids, amounts, "");
    }

    // ─── setMinter ────────────────────────────────────────────────────────

    function test_setMinter_ownerCanChange() public {
        address newMinter = makeAddr("newMinter");
        cert.setMinter(newMinter);
        assertEq(cert.minter(), newMinter);
    }

    function test_setMinter_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        cert.setMinter(alice);
    }

    function test_setMinter_emitsEvent() public {
        address newMinter = makeAddr("newMinter");
        vm.expectEmit(true, true, false, false);
        emit SurveyCertificates.MinterUpdated(minter, newMinter);
        cert.setMinter(newMinter);
    }

    function test_setMinter_newMinterCanMint() public {
        address newMinter = makeAddr("newMinter");
        cert.setMinter(newMinter);

        vm.prank(newMinter);
        cert.mint(alice, SECURE);
        assertEq(cert.balanceOf(alice, SECURE), 1);
    }

    function test_setMinter_oldMinterCanNoLongerMint() public {
        address newMinter = makeAddr("newMinter");
        cert.setMinter(newMinter);

        vm.prank(minter);
        vm.expectRevert(SurveyCertificates.NotMinter.selector);
        cert.mint(alice, SECURE);
    }

    // ─── setTokenURI ──────────────────────────────────────────────────────

    function test_setTokenURI_ownerCanSet() public {
        cert.setTokenURI(SECURE, "ipfs://QmTest");
        assertEq(cert.uri(SECURE), "ipfs://QmTest");
    }

    function test_setTokenURI_revertsIfNotOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        cert.setTokenURI(SECURE, "ipfs://QmTest");
    }

    function test_setTokenURI_revertsOnInvalidId() public {
        vm.expectRevert(SurveyCertificates.InvalidTokenId.selector);
        cert.setTokenURI(0, "ipfs://QmTest");

        vm.expectRevert(SurveyCertificates.InvalidTokenId.selector);
        cert.setTokenURI(5, "ipfs://QmTest");
    }
}
