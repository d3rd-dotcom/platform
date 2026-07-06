// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

interface IOwnable {
    function owner() external view returns (address);
}

/**
 * @title ReflectionVault
 * @notice Pays cbBTC ("Bitcoin on Base") reflections to Diamonds ($BLUE) holders,
 *         proportional to their holdings. Magnified-dividends-per-share accounting.
 *
 * @dev Funding is deposit-based: anyone (in practice the MWA treasury) calls
 *      `depositReflections` with cbBTC. There is no swap machinery in here and no
 *      hook into DEX trades — the token routes its AMM fee to the treasury as
 *      plain BLUE, and the treasury converts and deposits. Reflections therefore
 *      work from day one with no liquidity pool, and nothing in this contract can
 *      ever make a token transfer fail: the token calls `setShare` inside
 *      try/catch, and payouts are pull-based (`claim`) or batch-pushed with a gas
 *      budget (`process`).
 *
 *      Admin (exclusions, minimum share) follows the token's owner dynamically —
 *      when Blue renounces token ownership, vault config freezes with it.
 */
contract ReflectionVault {
    using SafeERC20 for IERC20;

    uint256 private constant MAGNITUDE = 2 ** 128;
    address private constant DEAD = 0x000000000000000000000000000000000000dEaD;

    /// @notice The Diamonds ($BLUE) token this vault serves.
    address public immutable token;

    /// @notice The reward token (cbBTC on Base, 8 decimals).
    IERC20 public immutable rewardToken;

    /// @notice Minimum BLUE balance to earn reflections (dust guard).
    uint256 public minShareBalance;

    uint256 public totalShares;
    uint256 public totalDistributed;
    uint256 public magnifiedRewardPerShare;

    mapping(address => uint256) public shares;
    mapping(address => int256) private magnifiedCorrections;
    mapping(address => uint256) public withdrawnRewards;
    mapping(address => bool) public excluded;

    /// @dev Auto-pay queue. holderIndex is 1-based; 0 means absent.
    address[] private holders;
    mapping(address => uint256) private holderIndex;
    uint256 public processIndex;

    event ReflectionsDeposited(address indexed from, uint256 amount);
    event RewardClaimed(address indexed holder, uint256 amount);
    event ExcludedSet(address indexed account, bool isExcluded);
    event MinShareBalanceSet(uint256 minShareBalance);

    error OnlyToken();
    error OnlyTokenOwner();
    error NoShares();
    error ZeroAmount();

    modifier onlyToken() {
        if (msg.sender != token) revert OnlyToken();
        _;
    }

    /// @dev Token contract or the token's current owner. Ownership renounce
    ///      freezes vault admin along with the token's.
    modifier onlyTokenAuthority() {
        if (msg.sender != token && msg.sender != IOwnable(token).owner()) {
            revert OnlyTokenOwner();
        }
        _;
    }

    constructor(address token_, address rewardToken_, address initialExcluded) {
        token = token_;
        rewardToken = IERC20(rewardToken_);
        minShareBalance = 1_000e18;

        // Never pay reflections to plumbing addresses.
        excluded[token_] = true;
        excluded[address(this)] = true;
        excluded[DEAD] = true;
        if (initialExcluded != address(0)) excluded[initialExcluded] = true;
    }

    // ---------------------------------------------------------------- shares

    /**
     * @notice Sync a holder's share to their BLUE balance. Called by the token
     *         on every balance change, wrapped in try/catch on the token side.
     */
    function setShare(address holder, uint256 balance) external onlyToken {
        _setShare(holder, balance);
    }

    function _setShare(address holder, uint256 balance) internal {
        uint256 newShare = (excluded[holder] || balance < minShareBalance) ? 0 : balance;
        uint256 oldShare = shares[holder];
        if (newShare == oldShare) return;

        if (newShare > oldShare) {
            uint256 added = newShare - oldShare;
            magnifiedCorrections[holder] -= int256(magnifiedRewardPerShare * added);
            totalShares += added;
            if (holderIndex[holder] == 0) {
                holders.push(holder);
                holderIndex[holder] = holders.length;
            }
        } else {
            uint256 removed = oldShare - newShare;
            magnifiedCorrections[holder] += int256(magnifiedRewardPerShare * removed);
            totalShares -= removed;
            if (newShare == 0 && holderIndex[holder] != 0) {
                uint256 idx = holderIndex[holder] - 1;
                address last = holders[holders.length - 1];
                holders[idx] = last;
                holderIndex[last] = idx + 1;
                holders.pop();
                holderIndex[holder] = 0;
            }
        }
        shares[holder] = newShare;
    }

    // ---------------------------------------------------------------- config

    function setExcluded(address account, bool isExcluded) external onlyTokenAuthority {
        excluded[account] = isExcluded;
        if (isExcluded) _setShare(account, 0);
        // Un-excluding takes effect on the holder's next balance change.
        emit ExcludedSet(account, isExcluded);
    }

    function setMinShareBalance(uint256 newMin) external onlyTokenAuthority {
        minShareBalance = newMin;
        // Takes effect per holder on their next balance change.
        emit MinShareBalanceSet(newMin);
    }

    // -------------------------------------------------------------- deposits

    /**
     * @notice Fund reflections with cbBTC. Open to anyone; requires approval.
     */
    function depositReflections(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (totalShares == 0) revert NoShares();
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        magnifiedRewardPerShare += (amount * MAGNITUDE) / totalShares;
        emit ReflectionsDeposited(msg.sender, amount);
    }

    // --------------------------------------------------------------- rewards

    function accumulativeRewards(address holder) public view returns (uint256) {
        return uint256(
            int256(magnifiedRewardPerShare * shares[holder]) + magnifiedCorrections[holder]
        ) / MAGNITUDE;
    }

    function pendingRewards(address holder) public view returns (uint256) {
        return accumulativeRewards(holder) - withdrawnRewards[holder];
    }

    /// @notice Pull your pending cbBTC.
    function claim() external {
        _pay(msg.sender);
    }

    /**
     * @notice Walk the holder queue auto-paying pending rewards until the gas
     *         budget is spent. Callable by anyone; never reverts on payouts.
     */
    function process(uint256 gasBudget) external returns (uint256 iterations, uint256 claims) {
        uint256 count = holders.length;
        if (count == 0) return (0, 0);

        uint256 gasUsed;
        uint256 gasLeft = gasleft();
        uint256 idx = processIndex;

        while (gasUsed < gasBudget && iterations < count) {
            if (idx >= holders.length) idx = 0;
            if (_pay(holders[idx]) > 0) claims++;
            idx++;
            iterations++;
            gasUsed += gasLeft - gasleft();
            gasLeft = gasleft();
        }
        processIndex = idx;
    }

    function _pay(address holder) internal returns (uint256 amount) {
        amount = pendingRewards(holder);
        if (amount == 0) return 0;
        withdrawnRewards[holder] += amount;
        totalDistributed += amount;
        rewardToken.safeTransfer(holder, amount);
        emit RewardClaimed(holder, amount);
    }

    // ----------------------------------------------------------------- views

    function holderCount() external view returns (uint256) {
        return holders.length;
    }
}
