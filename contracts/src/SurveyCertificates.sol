// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SurveyCertificates
 * @notice Soulbound ERC-1155 certificates for MWA attachment style survey completion.
 *         Blue mints to each member's wallet after the server confirms survey completion.
 *         Tokens are non-transferable (soulbound) — they can only be minted or burned.
 *
 * Token IDs:
 *   1 = Secure
 *   2 = Anxious
 *   3 = Avoidant
 *   4 = Fearful-Avoidant
 *
 * Deploy:
 *   forge script script/DeploySurveyCertificates.s.sol --rpc-url base_sepolia --broadcast --verify
 *   forge script script/DeploySurveyCertificates.s.sol --rpc-url base        --broadcast --verify
 */
contract SurveyCertificates is ERC1155, Ownable {
    // ─── Constants ───────────────────────────────────────────────────────
    uint256 public constant SECURE           = 1;
    uint256 public constant ANXIOUS          = 2;
    uint256 public constant AVOIDANT         = 3;
    uint256 public constant FEARFUL_AVOIDANT = 4;

    // ─── State ───────────────────────────────────────────────────────────
    address public minter;

    /// @notice Highest valid token ID. Owner can raise this to add new certificate types.
    uint256 public maxTokenId = 4;

    /// @notice Per-token IPFS metadata URIs (set after IPFS upload, before minting).
    mapping(uint256 => string) private _tokenURIs;

    /// @notice Prevents a wallet from claiming the same certificate twice.
    mapping(address => mapping(uint256 => bool)) public hasMinted;

    // ─── Events ──────────────────────────────────────────────────────────
    event CertificateMinted(address indexed to, uint256 indexed tokenId, string tokenURI);
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);
    event TokenURISet(uint256 indexed tokenId, string uri);

    // ─── Errors ──────────────────────────────────────────────────────────
    error NotMinter();
    error AlreadyMinted();
    error InvalidTokenId();
    error SoulboundTransferForbidden();

    // ─── Constructor ─────────────────────────────────────────────────────
    constructor(address _minter) ERC1155("") Ownable(msg.sender) {
        minter = _minter;
    }

    // ─── Minter actions ──────────────────────────────────────────────────

    /**
     * @notice Mint one certificate to a recipient. Callable only by the minter.
     * @param to        Recipient wallet address.
     * @param tokenId   Certificate type (1–4).
     */
    function mint(address to, uint256 tokenId) external {
        if (msg.sender != minter) revert NotMinter();
        if (tokenId == 0 || tokenId > maxTokenId) revert InvalidTokenId();
        if (hasMinted[to][tokenId]) revert AlreadyMinted();

        hasMinted[to][tokenId] = true;
        _mint(to, tokenId, 1, "");

        emit CertificateMinted(to, tokenId, _tokenURIs[tokenId]);
    }

    // ─── Owner actions ───────────────────────────────────────────────────

    function setMinter(address _minter) external onlyOwner {
        emit MinterUpdated(minter, _minter);
        minter = _minter;
    }

    function setTokenURI(uint256 tokenId, string calldata tokenUri) external onlyOwner {
        if (tokenId == 0 || tokenId > maxTokenId) revert InvalidTokenId();
        _tokenURIs[tokenId] = tokenUri;
        emit TokenURISet(tokenId, tokenUri);
    }

    /// @notice Extend the collection to support new certificate types (can only increase).
    function setMaxTokenId(uint256 newMax) external onlyOwner {
        if (newMax <= maxTokenId) revert InvalidTokenId();
        maxTokenId = newMax;
    }

    // ─── Metadata ────────────────────────────────────────────────────────

    function uri(uint256 tokenId) public view override returns (string memory) {
        return _tokenURIs[tokenId];
    }

    // ─── Soulbound enforcement ───────────────────────────────────────────

    function _update(
        address from,
        address to,
        uint256[] memory ids,
        uint256[] memory values
    ) internal override {
        // Allow mint (from == 0) and burn (to == 0); block all other transfers.
        if (from != address(0) && to != address(0)) revert SoulboundTransferForbidden();
        super._update(from, to, ids, values);
    }
}
