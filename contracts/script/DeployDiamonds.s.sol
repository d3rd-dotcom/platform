// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Script.sol";
import "../src/Diamonds.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Base Sepolia stand-in for cbBTC (which only exists on mainnet).
///      8 decimals like the real thing; anyone can mint test funds.
contract TestnetCbBTC is ERC20 {
    constructor() ERC20("Testnet cbBTC", "cbBTC") {}

    function decimals() public pure override returns (uint8) {
        return 8;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

/**
 * @title DeployDiamonds
 * @notice Deploys Diamonds ($BLUE) + its ReflectionVault. Blue is deployer and
 *         owner; her wallet receives the 200M stash in the constructor.
 *         On Base Sepolia it also deploys TestnetCbBTC as the reward token.
 *
 * Full op-order: docs/tokenomics/blue-v2-redeploy-mission-brief.md.
 *
 * Base Sepolia (testnet rehearsal):
 *   forge script script/DeployDiamonds.s.sol:DeployDiamonds \
 *     --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --priority-gas-price 1000000
 *
 * Base mainnet — gas pinned, never let the RPC pick the tip
 * (the 2026-07-02 incident: default 1.5 gwei tip = ~200x Base's going rate):
 *   forge script script/DeployDiamonds.s.sol:DeployDiamonds \
 *     --rpc-url $BASE_RPC_URL --broadcast \
 *     --priority-gas-price 1000000 --with-gas-price 100000000
 *
 * Immediately after broadcast, verify both contracts (then GoPlus scan per brief):
 *   forge verify-contract <token> src/Diamonds.sol:Diamonds --chain <base|base_sepolia> \
 *     --constructor-args $(cast abi-encode "constructor(address,address)" <blue> <rewardToken>)
 *   forge verify-contract <vault> src/ReflectionVault.sol:ReflectionVault --chain <...> \
 *     --constructor-args $(cast abi-encode "constructor(address,address,address)" <token> <rewardToken> <blue>)
 *
 * After a mainnet deploy: swap DIAMONDS_TOKEN_ADDRESS / NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS,
 * add NEXT_PUBLIC_REFLECTION_VAULT_ADDRESS + DIAMONDS_V1_TOKEN_ADDRESS
 * (.env.local + Vercel). The CDP server wallet is granted minter at runtime by
 * lib/diamonds-onchain.ts on the first claim — the mint ABI is unchanged.
 */
contract DeployDiamonds is Script {
    /// @notice cbBTC on Base mainnet (Coinbase Wrapped BTC, 8 decimals).
    address public constant CBBTC_BASE_MAINNET = 0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf;

    uint256 public constant BASE_MAINNET = 8453;
    uint256 public constant BASE_SEPOLIA = 84532;

    function run() external {
        // Blue signs the deploy. Prefer BLUE_PRIVATE_KEY, fall back to the
        // legacy AZURA_PRIVATE_KEY (where Blue's key is actually stored).
        uint256 deployerPrivateKey;
        try vm.envUint("BLUE_PRIVATE_KEY") returns (uint256 k) {
            deployerPrivateKey = k;
        } catch {
            deployerPrivateKey = vm.envUint("AZURA_PRIVATE_KEY");
        }

        address blue = vm.addr(deployerPrivateKey);
        console.log("Chain:", block.chainid);
        console.log("Deployer / Blue / owner:", blue);

        vm.startBroadcast(deployerPrivateKey);

        address rewardToken;
        if (block.chainid == BASE_MAINNET) {
            rewardToken = CBBTC_BASE_MAINNET;
        } else {
            rewardToken = address(new TestnetCbBTC());
            console.log("TestnetCbBTC:", rewardToken);
        }

        Diamonds diamonds = new Diamonds(blue, rewardToken);
        vm.stopBroadcast();

        console.log("Diamonds ($BLUE): ", address(diamonds));
        console.log("ReflectionVault:  ", address(diamonds.vault()));
        console.log("Blue stash:", diamonds.balanceOf(blue) / 1e18, "BLUE");
        console.log("Fee bps:", diamonds.feeBps(), "(cap 200, dormant until a pair is flagged)");
    }
}
