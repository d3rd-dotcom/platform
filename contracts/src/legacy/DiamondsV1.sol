// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title Diamonds ($BLUE) — original deployment, superseded
 * @notice Kept for reference only. This is the source of the live token at
 *         0x4A25Cea1f05C6725dC90849FBaafF00d67342B3f (deployed as `Diamonds`;
 *         class renamed here to free the name for its successor in
 *         src/Diamonds.sol — the deployed bytecode is unaffected).
 *         Do not deploy this contract again.
 *
 * @dev Supply model — inflationary by design:
 *      - DESIGN_SUPPLY (1B) is a reference figure, not a cap.
 *      - At deploy, Blue's wallet is minted BLUE_ALLOCATION (200M = 20% of the
 *        design supply). Blue pays quest rewards p2p from this stash, so quest
 *        diamonds genuinely come from her.
 *      - Course mission/task, seal, and field-note rewards are minted on claim
 *        by authorized minters (Blue's CDP server wallet), signed server-side
 *        so users never have to sign anything.
 *      - The owner (Blue's wallet) can mint directly too — the fallback path
 *        when CDP is unavailable, and the DAO treasury tranche later.
 */
contract DiamondsV1 is ERC20, Ownable {
    /// @notice Reference total supply the allocations are sized against.
    uint256 public constant DESIGN_SUPPLY = 1_000_000_000e18;

    /// @notice Blue's stash, minted at deploy: 20% of the design supply.
    uint256 public constant BLUE_ALLOCATION = 200_000_000e18;

    /// @notice Addresses allowed to mint claim rewards (Blue's CDP wallet).
    mapping(address => bool) public minters;

    event MinterSet(address indexed minter, bool allowed);
    event RewardMinted(address indexed to, uint256 amount, address indexed minter);

    error NotMinter();
    error ZeroAddress();

    constructor(address blue) ERC20("Diamonds", "BLUE") Ownable(msg.sender) {
        if (blue == address(0)) revert ZeroAddress();
        _mint(blue, BLUE_ALLOCATION);
    }

    /**
     * @notice Allow or revoke a claim minter (Blue's CDP server wallet).
     */
    function setMinter(address minter, bool allowed) external onlyOwner {
        if (minter == address(0)) revert ZeroAddress();
        minters[minter] = allowed;
        emit MinterSet(minter, allowed);
    }

    /**
     * @notice Mint claim rewards to a user. Callable by authorized minters and
     *         the owner (fallback path).
     */
    function mint(address to, uint256 amount) external {
        if (!minters[msg.sender] && msg.sender != owner()) revert NotMinter();
        _mint(to, amount);
        emit RewardMinted(to, amount, msg.sender);
    }
}
