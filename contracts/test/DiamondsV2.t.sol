// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/DiamondsV2.sol";
import "../src/ReflectionVault.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev cbBTC stand-in: 8 decimals like the real thing.
contract MockCbBTC is ERC20 {
    constructor() ERC20("Coinbase Wrapped BTC", "cbBTC") {}

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract DiamondsV2Test is Test {
    DiamondsV2 public token;
    ReflectionVault public vault;
    MockCbBTC public cbbtc;

    uint256 constant BLUE_PK = 0xB1_0E;
    uint256 constant USER_PK = 0xA11CE;
    address public blue;
    address public user;
    address public user2;
    address public cdp;
    address public relayer;
    address public pair;
    address public treasury;

    bytes32 constant PERMIT_TYPEHASH = keccak256(
        "Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"
    );

    function setUp() public {
        blue = vm.addr(BLUE_PK);
        user = vm.addr(USER_PK);
        user2 = makeAddr("user2");
        cdp = makeAddr("cdp");
        relayer = makeAddr("relayer");
        pair = makeAddr("pair");
        treasury = makeAddr("treasury");

        cbbtc = new MockCbBTC();
        // Mirror production: Blue deploys, so Blue is owner.
        vm.prank(blue);
        token = new DiamondsV2(blue, address(cbbtc));
        vault = token.vault();
    }

    // ------------------------------------------------------------- deploy

    function test_ConstructorState() public view {
        assertEq(token.owner(), blue);
        assertEq(token.balanceOf(blue), 200_000_000e18);
        assertEq(token.totalSupply(), 200_000_000e18);
        assertEq(token.feeBps(), 100);
        assertEq(token.feeRecipient(), blue);
        assertTrue(token.feeExempt(blue));
        // Blue is excluded from reflections — the house never earns them.
        assertTrue(vault.excluded(blue));
        assertEq(vault.shares(blue), 0);
        assertEq(vault.totalShares(), 0);
        assertEq(address(vault.rewardToken()), address(cbbtc));
        assertEq(vault.token(), address(token));
    }

    // ------------------------------------------------------------- minting

    function test_MintGating() public {
        vm.prank(user);
        vm.expectRevert(DiamondsV2.NotMinter.selector);
        token.mint(user, 1e18);

        vm.prank(blue);
        token.mint(user, 5e18);
        assertEq(token.balanceOf(user), 5e18);

        vm.prank(blue);
        token.setMinter(cdp, true);
        vm.prank(cdp);
        token.mint(user, 5e18);
        assertEq(token.balanceOf(user), 10e18);
    }

    function test_RenounceBricksMintingForEveryone() public {
        vm.prank(blue);
        token.setMinter(cdp, true);

        vm.prank(blue);
        token.renounceOwnership();
        assertEq(token.owner(), address(0));

        // Owner path dead.
        vm.prank(blue);
        vm.expectRevert(DiamondsV2.MintingFinalized.selector);
        token.mint(user, 1e18);

        // Previously granted minters dead too — full supply finalization.
        vm.prank(cdp);
        vm.expectRevert(DiamondsV2.MintingFinalized.selector);
        token.mint(user, 1e18);

        // Burns, transfers, and reflections survive renounce.
        vm.prank(blue);
        token.transfer(user, 2_000e18);
        vm.prank(user);
        token.burn(500e18);
        assertEq(token.balanceOf(user), 1_500e18);
    }

    // ------------------------------------------------------------- burning

    function test_BurnAndBurnFrom() public {
        vm.prank(blue);
        token.mint(user, 1_000e18);
        uint256 supply = token.totalSupply();

        vm.prank(user);
        token.burn(400e18);
        assertEq(token.totalSupply(), supply - 400e18);

        vm.prank(user);
        token.approve(relayer, 400e18);
        vm.prank(relayer);
        token.burnFrom(user, 400e18);
        assertEq(token.totalSupply(), supply - 800e18);
        assertEq(token.balanceOf(user), 200e18);
    }

    /// @dev The gasless-burn path: user signs a permit (free), relayer submits
    ///      permit + burnFrom in one sponsored transaction.
    function test_PermitThenBurnFrom_GaslessBurnPath() public {
        vm.prank(blue);
        token.mint(user, 1_000e18);

        uint256 amount = 400e18;
        uint256 deadline = block.timestamp + 10 minutes;
        bytes32 structHash = keccak256(
            abi.encode(PERMIT_TYPEHASH, user, relayer, amount, token.nonces(user), deadline)
        );
        bytes32 digest = keccak256(
            abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), structHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(USER_PK, digest);

        uint256 supply = token.totalSupply();
        // Relayer submits both calls; user never sends a transaction.
        vm.startPrank(relayer);
        token.permit(user, relayer, amount, deadline, v, r, s);
        token.burnFrom(user, amount);
        vm.stopPrank();

        assertEq(token.totalSupply(), supply - amount);
        assertEq(token.balanceOf(user), 600e18);
        assertEq(token.allowance(user, relayer), 0);
    }

    // ------------------------------------------------------------------ fees

    function test_NoFeeOnWalletToWallet() public {
        vm.prank(blue);
        token.mint(user, 1_000e18);
        vm.prank(user);
        token.transfer(user2, 1_000e18);
        assertEq(token.balanceOf(user2), 1_000e18);
    }

    function test_FeeOnPairTradesOnly() public {
        vm.startPrank(blue);
        token.setAmmPair(pair, true);
        token.mint(user, 10_000e18);
        token.mint(pair, 10_000e18);
        vm.stopPrank();
        uint256 blueBefore = token.balanceOf(blue);

        // Sell: user -> pair, 1% to the treasury (feeRecipient).
        vm.prank(user);
        token.transfer(pair, 1_000e18);
        assertEq(token.balanceOf(pair), 10_000e18 + 990e18);
        assertEq(token.balanceOf(blue), blueBefore + 10e18);

        // Buy: pair -> user2, 1%.
        vm.prank(pair);
        token.transfer(user2, 1_000e18);
        assertEq(token.balanceOf(user2), 990e18);
        assertEq(token.balanceOf(blue), blueBefore + 20e18);

        // Exempt side pays nothing.
        vm.prank(blue);
        token.setFeeExempt(user, true);
        vm.prank(user);
        token.transfer(pair, 1_000e18);
        assertEq(token.balanceOf(blue), blueBefore + 20e18);
    }

    function test_FeeCapIsHard() public {
        vm.prank(blue);
        vm.expectRevert(DiamondsV2.FeeTooHigh.selector);
        token.setFeeBps(201);

        vm.startPrank(blue);
        token.setFeeBps(0);
        token.setAmmPair(pair, true);
        token.mint(user, 1_000e18);
        vm.stopPrank();
        vm.prank(user);
        token.transfer(pair, 1_000e18);
        assertEq(token.balanceOf(pair), 1_000e18); // zero fee when disabled
    }

    function test_OnlyOwnerAdmin() public {
        vm.startPrank(user);
        vm.expectRevert();
        token.setFeeBps(50);
        vm.expectRevert();
        token.setAmmPair(pair, true);
        vm.expectRevert();
        token.setMinter(user, true);
        vm.expectRevert();
        token.setFeeRecipient(user);
        vm.stopPrank();
    }

    // ----------------------------------------------------------- reflections

    function _fundAndDeposit(uint256 cbbtcAmount) internal {
        cbbtc.mint(treasury, cbbtcAmount);
        vm.startPrank(treasury);
        cbbtc.approve(address(vault), cbbtcAmount);
        vault.depositReflections(cbbtcAmount);
        vm.stopPrank();
    }

    function test_ReflectionsProportionalAndClaimable() public {
        vm.startPrank(blue);
        token.mint(user, 3_000e18);
        token.mint(user2, 1_000e18);
        vm.stopPrank();
        assertEq(vault.totalShares(), 4_000e18);

        _fundAndDeposit(1e8); // 1 cbBTC

        assertApproxEqAbs(vault.pendingRewards(user), 0.75e8, 1);
        assertApproxEqAbs(vault.pendingRewards(user2), 0.25e8, 1);
        assertEq(vault.pendingRewards(blue), 0); // excluded despite 200M

        vm.prank(user);
        vault.claim();
        assertApproxEqAbs(cbbtc.balanceOf(user), 0.75e8, 1);
        assertEq(vault.pendingRewards(user), 0);

        // Second deposit stacks on the unclaimed side.
        _fundAndDeposit(1e8);
        assertApproxEqAbs(vault.pendingRewards(user), 0.75e8, 1);
        assertApproxEqAbs(vault.pendingRewards(user2), 0.5e8, 1);
    }

    function test_MinShareBalanceGate() public {
        vm.startPrank(blue);
        token.mint(user, 999e18); // below the 1,000 BLUE floor
        token.mint(user2, 1_000e18);
        vm.stopPrank();

        assertEq(vault.shares(user), 0);
        assertEq(vault.totalShares(), 1_000e18);

        _fundAndDeposit(1e8);
        assertEq(vault.pendingRewards(user), 0);
        assertApproxEqAbs(vault.pendingRewards(user2), 1e8, 1);

        // Crossing the floor starts earning from then on.
        vm.prank(blue);
        token.mint(user, 1e18);
        assertEq(vault.shares(user), 1_000e18);
    }

    function test_ProcessAutoPaysQueue() public {
        address[3] memory hs = [makeAddr("h1"), makeAddr("h2"), makeAddr("h3")];
        vm.startPrank(blue);
        for (uint256 i = 0; i < 3; i++) token.mint(hs[i], 1_000e18);
        vm.stopPrank();

        _fundAndDeposit(3e8);

        (uint256 iterations, uint256 claims) = vault.process(300_000);
        assertEq(iterations, 3);
        assertEq(claims, 3);
        for (uint256 i = 0; i < 3; i++) {
            assertApproxEqAbs(cbbtc.balanceOf(hs[i]), 1e8, 1);
        }
        assertApproxEqAbs(vault.totalDistributed(), 3e8, 3);
    }

    function test_DepositRevertsWithNoEligibleHolders() public {
        // Only Blue holds BLUE and she's excluded: nobody to reflect to.
        cbbtc.mint(treasury, 1e8);
        vm.startPrank(treasury);
        cbbtc.approve(address(vault), 1e8);
        vm.expectRevert(ReflectionVault.NoShares.selector);
        vault.depositReflections(1e8);
        vm.stopPrank();
    }

    function test_PairsExcludedFromReflections() public {
        vm.startPrank(blue);
        token.setAmmPair(pair, true);
        token.mint(pair, 10_000e18);
        token.mint(user, 1_000e18);
        vm.stopPrank();

        _fundAndDeposit(1e8);
        assertEq(vault.pendingRewards(pair), 0);
        assertApproxEqAbs(vault.pendingRewards(user), 1e8, 1);
    }

    function test_SpendingReducesShare() public {
        vm.prank(blue);
        token.mint(user, 2_000e18);
        assertEq(vault.shares(user), 2_000e18);

        vm.prank(user);
        token.burn(1_500e18);
        assertEq(vault.shares(user), 0); // 500 left, under the floor
        assertEq(vault.totalShares(), 0);
        assertEq(vault.holderCount(), 0);
    }

    /// @dev The try/catch guarantee: a broken vault can never block transfers.
    function test_VaultRevertNeverBlocksTransfers() public {
        vm.prank(blue);
        token.mint(user, 1_000e18);

        vm.mockCallRevert(
            address(vault),
            abi.encodeWithSelector(ReflectionVault.setShare.selector),
            "vault down"
        );

        vm.prank(user);
        token.transfer(user2, 400e18);
        assertEq(token.balanceOf(user2), 400e18);

        vm.prank(user);
        token.burn(100e18);
        assertEq(token.balanceOf(user), 500e18);

        vm.prank(blue);
        token.mint(user2, 50e18);
        assertEq(token.balanceOf(user2), 450e18);
    }

    function test_VaultAdminFollowsTokenOwner() public {
        vm.prank(user);
        vm.expectRevert(ReflectionVault.OnlyTokenOwner.selector);
        vault.setMinShareBalance(1e18);

        vm.prank(blue);
        vault.setMinShareBalance(500e18);
        assertEq(vault.minShareBalance(), 500e18);

        // After renounce, vault config freezes with the token's.
        vm.prank(blue);
        token.renounceOwnership();
        vm.prank(blue);
        vm.expectRevert(ReflectionVault.OnlyTokenOwner.selector);
        vault.setMinShareBalance(1e18);
    }

    function test_FuzzReflectionMathNeverLosesFunds(uint96 a, uint96 b, uint64 deposit) public {
        uint256 balA = uint256(a) % 1_000_000e18 + 1_000e18;
        uint256 balB = uint256(b) % 1_000_000e18 + 1_000e18;
        uint256 dep = uint256(deposit) % 10e8 + 1;

        vm.startPrank(blue);
        token.mint(user, balA);
        token.mint(user2, balB);
        vm.stopPrank();

        _fundAndDeposit(dep);

        uint256 pA = vault.pendingRewards(user);
        uint256 pB = vault.pendingRewards(user2);
        // Payouts never exceed the deposit, and rounding dust stays in the vault.
        assertLe(pA + pB, dep);
        assertGe(pA + pB + 2, dep); // at most 1 wei dust per holder

        vm.prank(user);
        vault.claim();
        vm.prank(user2);
        vault.claim();
        assertEq(cbbtc.balanceOf(user), pA);
        assertEq(cbbtc.balanceOf(user2), pB);
    }
}
