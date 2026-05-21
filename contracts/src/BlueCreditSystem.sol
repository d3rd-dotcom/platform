// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Votes.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BlueCreditSystem
 * @notice The Mental Wealth Governance (MWG) token, re-issued as an ERC20Votes
 *         token so BlueKillStreak can read voting power via getPastVotes. The
 *         prior MWG was a plain ERC20 and reverted on getVotes, freezing
 *         community voting.
 *
 * @dev Migration model: the owner mints balances to the snapshot of prior MWG
 *      holders (mint / batchMint), then renounces minting (renounceMinting)
 *      and hands ownership to the multisig. Votes use the default block-number
 *      clock, matching BlueKillStreak's snapshotBlock = block.number.
 *
 *      Holders must self-delegate (delegate(self)) for their balance to count
 *      as voting power — standard ERC20Votes behavior.
 */
contract BlueCreditSystem is ERC20, ERC20Permit, ERC20Votes, Ownable {
    /// @notice Once true, no more tokens can ever be minted.
    bool public mintingFinished;

    event Minted(address indexed to, uint256 amount);
    event MintingFinished();

    error MintingIsFinished();
    error LengthMismatch();

    constructor()
        ERC20("Mental Wealth Governance", "MWG")
        ERC20Permit("Mental Wealth Governance")
        Ownable(msg.sender)
    {}

    /**
     * @notice Mint tokens to a single holder (migration use).
     */
    function mint(address to, uint256 amount) external onlyOwner {
        if (mintingFinished) revert MintingIsFinished();
        _mint(to, amount);
        emit Minted(to, amount);
    }

    /**
     * @notice Mint tokens to many holders at once (migration use).
     * @param recipients Holder addresses
     * @param amounts    Matching balances (same length as recipients)
     */
    function batchMint(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        if (mintingFinished) revert MintingIsFinished();
        if (recipients.length != amounts.length) revert LengthMismatch();
        for (uint256 i = 0; i < recipients.length; i++) {
            _mint(recipients[i], amounts[i]);
            emit Minted(recipients[i], amounts[i]);
        }
    }

    /**
     * @notice Permanently disable minting once the migration is complete.
     */
    function renounceMinting() external onlyOwner {
        mintingFinished = true;
        emit MintingFinished();
    }

    // ── Required overrides (OZ v5) ──────────────────────────────────────────

    function _update(address from, address to, uint256 value)
        internal
        override(ERC20, ERC20Votes)
    {
        super._update(from, to, value);
    }

    function nonces(address owner)
        public
        view
        override(ERC20Permit, Nonces)
        returns (uint256)
    {
        return super.nonces(owner);
    }
}
