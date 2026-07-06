// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "./ReflectionVault.sol";

/**
 * @title Diamonds ($BLUE) v2
 * @notice Mental Wealth Academy's currency on Base. Earned in the Academy
 *         (course missions, tasks, field notes, quests), spent on things that
 *         are fun — and spending burns real supply.
 *
 * What v2 adds over v1 (0x4A25…2B3f):
 *      - ERC20Burnable: `burn` / `burnFrom` — sinks reduce supply instead of
 *        parking tokens at the dead address.
 *      - ERC20Permit (EIP-2612): a free typed-data signature lets Blue's
 *        sponsored relayer pull a burn, so users never hold ETH.
 *      - Supply finalization: `mint` reverts permanently — for the owner AND
 *        all granted minters — once ownership is renounced. One-way switch.
 *      - cbBTC reflections: every balance change syncs the ReflectionVault,
 *        which pays holders their share of treasury Bitcoin deposits.
 *
 * Deliberately absent, because each is a known scanner flag or trust hole:
 * no trading-enable gate, no blacklist, no max wallet/tx, no owner burn of
 * other people's balances, no mutable fee ceiling (MAX_FEE_BPS is a constant),
 * and no swap-in-transfer machinery — the AMM fee (dormant until a pair is
 * flagged) moves plain BLUE to the treasury, nothing else.
 */
contract DiamondsV2 is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    /// @notice Reference total supply the allocations are sized against.
    uint256 public constant DESIGN_SUPPLY = 1_000_000_000e18;

    /// @notice Blue's stash, minted at deploy: 20% of the design supply.
    uint256 public constant BLUE_ALLOCATION = 200_000_000e18;

    /// @notice Hard ceiling on the AMM fee — 2%, compile-time constant.
    uint16 public constant MAX_FEE_BPS = 200;

    /// @notice Pays cbBTC reflections to holders. Deployed by this constructor.
    ReflectionVault public immutable vault;

    /// @notice Fee on DEX pair trades only, in basis points. Launch: 1%.
    uint16 public feeBps = 100;

    /// @notice Where AMM fees land (the treasury), as plain BLUE.
    address public feeRecipient;

    /// @notice Addresses allowed to mint claim rewards (Blue's CDP wallet).
    mapping(address => bool) public minters;

    /// @notice DEX pairs; transfers touching one pay `feeBps` unless exempt.
    mapping(address => bool) public ammPairs;

    /// @notice Exempt from the AMM fee (treasury, game contracts).
    mapping(address => bool) public feeExempt;

    event MinterSet(address indexed minter, bool allowed);
    event RewardMinted(address indexed to, uint256 amount, address indexed minter);
    event AmmPairSet(address indexed pair, bool isPair);
    event FeeBpsSet(uint16 feeBps);
    event FeeExemptSet(address indexed account, bool isExempt);
    event FeeRecipientSet(address indexed recipient);
    event FeeTaken(address indexed from, address indexed to, uint256 amount);

    error NotMinter();
    error ZeroAddress();
    error MintingFinalized();
    error FeeTooHigh();

    /**
     * @param blue        Blue's wallet — receives the 200M stash, collects AMM
     *                    fees, and is excluded from reflections (holders get
     *                    them, not the house).
     * @param rewardToken cbBTC on Base: 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf
     */
    constructor(address blue, address rewardToken)
        ERC20("Diamonds", "BLUE")
        ERC20Permit("Diamonds")
        Ownable(msg.sender)
    {
        if (blue == address(0) || rewardToken == address(0)) revert ZeroAddress();

        vault = new ReflectionVault(address(this), rewardToken, blue);

        feeRecipient = blue;
        feeExempt[blue] = true;
        feeExempt[address(this)] = true;

        _mint(blue, BLUE_ALLOCATION);
    }

    // ---------------------------------------------------------------- minting

    /**
     * @notice Mint claim rewards. Callable by authorized minters and the owner,
     *         until ownership is renounced — then it reverts forever, for
     *         everyone. Renouncing is the supply-finalization switch.
     */
    function mint(address to, uint256 amount) external {
        if (owner() == address(0)) revert MintingFinalized();
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter();
        _mint(to, amount);
        emit RewardMinted(to, amount, msg.sender);
    }

    /// @notice Allow or revoke a claim minter (Blue's CDP server wallet).
    function setMinter(address minter, bool allowed) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    // -------------------------------------------------------------- fee admin

    /// @notice Flag a DEX pair. Pairs are also excluded from reflections.
    function setAmmPair(address pair, bool isPair) external onlyOwner {
        if (pair == address(0)) revert ZeroAddress();
        ammPairs[pair] = isPair;
        if (isPair) vault.setExcluded(pair, true);
        emit AmmPairSet(pair, isPair);
    }

    /// @notice Set the AMM fee. Hard-capped at MAX_FEE_BPS (2%) forever.
    function setFeeBps(uint16 newFeeBps) external onlyOwner {
        if (newFeeBps > MAX_FEE_BPS) revert FeeTooHigh();
        feeBps = newFeeBps;
        emit FeeBpsSet(newFeeBps);
    }

    function setFeeExempt(address account, bool isExempt) external onlyOwner {
        feeExempt[account] = isExempt;
        emit FeeExemptSet(account, isExempt);
    }

    function setFeeRecipient(address recipient) external onlyOwner {
        if (recipient == address(0)) revert ZeroAddress();
        feeRecipient = recipient;
        feeExempt[recipient] = true;
        emit FeeRecipientSet(recipient);
    }

    // ------------------------------------------------------------- transfers

    /**
     * @dev All mints, burns, and transfers pass through here. Takes the AMM fee
     *      when a flagged pair is party and neither side is exempt, then syncs
     *      reflection shares. Vault syncs are try/catch — a vault fault can
     *      never block a transfer.
     */
    function _update(address from, address to, uint256 value) internal override {
        uint256 fee;
        if (
            feeBps > 0 &&
            from != address(0) &&
            to != address(0) &&
            (ammPairs[from] || ammPairs[to]) &&
            !feeExempt[from] &&
            !feeExempt[to]
        ) {
            fee = (value * feeBps) / 10_000;
        }

        if (fee > 0) {
            super._update(from, feeRecipient, fee);
            emit FeeTaken(from, to, fee);
        }
        super._update(from, to, value - fee);

        _syncShare(from);
        _syncShare(to);
        if (fee > 0) _syncShare(feeRecipient);
    }

    function _syncShare(address account) private {
        if (account == address(0)) return;
        try vault.setShare(account, balanceOf(account)) {} catch {}
    }
}
