// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title BlueMarketTrader
 * @notice Separate treasury contract for executing prediction market trades.
 *         Receives USDC independently from governance and trades on binary-outcome markets.
 *         Trades can be triggered by the owner or via Chainlink CRE (KeystoneForwarder).
 */
contract BlueMarketTrader is Ownable, ReentrancyGuard {
    // ============================================================================
    // STATE VARIABLES
    // ============================================================================

    /// @notice USDC token used for trading
    IERC20 public immutable usdcToken;

    /// @notice Prediction market contract
    address public predictionMarket;

    /// @notice Chainlink CRE KeystoneForwarder address
    address public keystoneForwarder;

    /// @notice Workflow owner whose DON reports this contract accepts.
    ///         Zero = uninitialized = onReport disabled.
    address public allowedWorkflowOwner;

    /// @notice Workflow name (bytes10) the contract accepts. KeystoneForwarder
    ///         is multi-tenant — without (owner, name) pinning, any workflow
    ///         on the same forwarder could trigger trades.
    bytes10 public allowedWorkflowName;

    /// @notice Trade counter
    uint256 public tradeCount;

    // ============================================================================
    // STRUCTS
    // ============================================================================

    struct Trade {
        uint256 id;
        uint256 marketId;
        bool isYes;
        uint256 usdcAmount;
        uint256 executedAt;
    }

    // ============================================================================
    // STORAGE
    // ============================================================================

    /// @notice Mapping of trade ID to Trade
    mapping(uint256 => Trade) public trades;

    // ============================================================================
    // EVENTS
    // ============================================================================

    event TradeExecuted(
        uint256 indexed tradeId,
        uint256 indexed marketId,
        bool isYes,
        uint256 usdcAmount
    );

    event KeystoneForwarderUpdated(address indexed oldForwarder, address indexed newForwarder);
    event PredictionMarketUpdated(address indexed oldMarket, address indexed newMarket);
    event AllowedWorkflowUpdated(address indexed workflowOwner, bytes10 workflowName);

    // ============================================================================
    // ERRORS
    // ============================================================================

    error Unauthorized();
    error InvalidAmount();
    error InvalidMarket();
    error TransferFailed();
    error InsufficientBalance();
    error WorkflowNotConfigured();
    error WorkflowNotAllowed();
    error InvalidMetadata();

    // ============================================================================
    // CONSTRUCTOR
    // ============================================================================

    /**
     * @notice Initialize the market trader contract
     * @param _usdcToken Address of USDC token
     */
    constructor(address _usdcToken) Ownable(msg.sender) {
        if (_usdcToken == address(0)) revert InvalidAmount();
        usdcToken = IERC20(_usdcToken);
    }

    // ============================================================================
    // MODIFIERS
    // ============================================================================

    modifier onlyForwarder() {
        if (msg.sender != keystoneForwarder) revert Unauthorized();
        _;
    }

    // ============================================================================
    // TRADE EXECUTION
    // ============================================================================

    /**
     * @notice Execute a prediction market trade (owner only)
     * @param _marketId  Market ID on the prediction market contract
     * @param _isYes     true = buy YES outcome, false = buy NO outcome
     * @param _amount    USDC amount to trade (6 decimals)
     * @return tradeId   The ID of the executed trade
     */
    function executeTrade(uint256 _marketId, bool _isYes, uint256 _amount) external onlyOwner nonReentrant returns (uint256) {
        return _executeTrade(_marketId, _isYes, _amount);
    }

    /**
     * @notice Receive DON-signed reports from Chainlink CRE via KeystoneForwarder
     * @dev Validates the metadata is from the pinned workflow before acting.
     * @param metadata CRE workflow context (validated, not optional)
     * @param report   ABI-encoded payload: (uint256 marketId, bool isYes, uint256 amount)
     */
    function onReport(bytes calldata metadata, bytes calldata report) external onlyForwarder nonReentrant {
        _validateWorkflowMetadata(metadata);
        (uint256 marketId, bool isYes, uint256 amount) = abi.decode(report, (uint256, bool, uint256));
        _executeTrade(marketId, isYes, amount);
    }

    /**
     * @notice Pin the workflow owner + name whose DON reports this contract
     *         accepts. MUST be called post-deploy before onReport is functional.
     */
    function setAllowedWorkflow(address _workflowOwner, bytes10 _workflowName) external onlyOwner {
        if (_workflowOwner == address(0)) revert WorkflowNotConfigured();
        allowedWorkflowOwner = _workflowOwner;
        allowedWorkflowName = _workflowName;
        emit AllowedWorkflowUpdated(_workflowOwner, _workflowName);
    }

    /**
     * @notice Validate Keystone forwarder metadata pins this report to the
     *         allowed (owner, name) workflow. Layout matches the standard
     *         Keystone forwarder metadata (workflowOwner at [76:96],
     *         workflowName at [96:106]).
     */
    function _validateWorkflowMetadata(bytes calldata metadata) internal view {
        if (allowedWorkflowOwner == address(0)) revert WorkflowNotConfigured();
        if (metadata.length < 106) revert InvalidMetadata();
        address workflowOwner = address(bytes20(metadata[76:96]));
        bytes10 workflowName = bytes10(metadata[96:106]);
        if (workflowOwner != allowedWorkflowOwner) revert WorkflowNotAllowed();
        if (workflowName != allowedWorkflowName) revert WorkflowNotAllowed();
    }

    /**
     * @notice Internal trade execution
     * @param _marketId Market ID on the prediction market contract
     * @param _isYes    true = buy YES, false = buy NO
     * @param _amount   USDC amount (6 decimals)
     * @return tradeId  The ID of the executed trade
     */
    function _executeTrade(uint256 _marketId, bool _isYes, uint256 _amount) internal returns (uint256) {
        if (_amount == 0) revert InvalidAmount();
        if (predictionMarket == address(0)) revert InvalidMarket();
        if (usdcToken.balanceOf(address(this)) < _amount) revert InsufficientBalance();

        tradeCount++;
        uint256 tradeId = tradeCount;

        trades[tradeId] = Trade({
            id: tradeId,
            marketId: _marketId,
            isYes: _isYes,
            usdcAmount: _amount,
            executedAt: block.timestamp
        });

        // Approve prediction market to pull USDC, then call buyOutcome
        usdcToken.approve(predictionMarket, _amount);

        (bool ok,) = predictionMarket.call(
            abi.encodeWithSignature(
                "buyOutcome(uint256,bool,uint256)",
                _marketId,
                _isYes,
                _amount
            )
        );
        if (!ok) revert TransferFailed();

        // Clear any residual allowance so the market cannot pull more later.
        usdcToken.approve(predictionMarket, 0);

        emit TradeExecuted(tradeId, _marketId, _isYes, _amount);
        return tradeId;
    }

    // ============================================================================
    // ADMIN FUNCTIONS
    // ============================================================================

    /**
     * @notice Set the prediction market contract address
     * @param _market Address of the prediction market contract
     */
    function setPredictionMarket(address _market) external onlyOwner {
        // A non-zero market must be a contract — a low-level call to an EOA
        // returns success without moving funds, which would record phantom
        // trades. address(0) is allowed to unset the market.
        if (_market != address(0) && _market.code.length == 0) revert InvalidMarket();
        address oldMarket = predictionMarket;
        if (predictionMarket != address(0)) {
            usdcToken.approve(predictionMarket, 0);
        }
        predictionMarket = _market;
        emit PredictionMarketUpdated(oldMarket, _market);
    }

    /**
     * @notice Set the Chainlink CRE KeystoneForwarder address
     * @param _forwarder Address of the KeystoneForwarder
     */
    function setKeystoneForwarder(address _forwarder) external onlyOwner {
        require(_forwarder != address(0), "Invalid forwarder address");
        address oldForwarder = keystoneForwarder;
        keystoneForwarder = _forwarder;
        emit KeystoneForwarderUpdated(oldForwarder, _forwarder);
    }

    /**
     * @notice Deposit USDC into the trading treasury
     * @param _amount Amount of USDC to deposit (must have approved this contract)
     */
    function deposit(uint256 _amount) external {
        if (_amount == 0) revert InvalidAmount();
        bool ok = usdcToken.transferFrom(msg.sender, address(this), _amount);
        if (!ok) revert TransferFailed();
    }

    /**
     * @notice Recover principal from an unresolved prediction market position.
     *         Calls refundUnresolved on the configured prediction market —
     *         USDC returns to this contract and can then be withdrawn.
     * @param _marketId Market to refund from
     */
    function refundFromMarket(uint256 _marketId) external onlyOwner nonReentrant {
        if (predictionMarket == address(0)) revert InvalidMarket();
        (bool ok,) = predictionMarket.call(
            abi.encodeWithSignature("refundUnresolved(uint256)", _marketId)
        );
        if (!ok) revert TransferFailed();
    }

    /**
     * @notice Claim winnings from a resolved prediction market.
     * @param _marketId Resolved market to claim from
     */
    function claimFromMarket(uint256 _marketId) external onlyOwner nonReentrant {
        if (predictionMarket == address(0)) revert InvalidMarket();
        (bool ok,) = predictionMarket.call(
            abi.encodeWithSignature("claim(uint256)", _marketId)
        );
        if (!ok) revert TransferFailed();
    }

    /**
     * @notice Withdraw USDC from the trading treasury (owner only)
     * @param _amount Amount to withdraw
     */
    function withdraw(uint256 _amount) external onlyOwner {
        if (_amount == 0) revert InvalidAmount();
        if (usdcToken.balanceOf(address(this)) < _amount) revert InsufficientBalance();
        bool ok = usdcToken.transfer(owner(), _amount);
        if (!ok) revert TransferFailed();
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /**
     * @notice Get trade details
     * @param _tradeId ID of the trade
     * @return Trade struct
     */
    function getTrade(uint256 _tradeId) external view returns (Trade memory) {
        return trades[_tradeId];
    }

    /**
     * @notice Get the current USDC balance of the trading treasury
     * @return USDC balance
     */
    function treasuryBalance() external view returns (uint256) {
        return usdcToken.balanceOf(address(this));
    }
}
