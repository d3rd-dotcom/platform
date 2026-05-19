import { providers, Wallet, Contract } from 'ethers';
import { VIP_MEMBERSHIP_CARD_ADDRESS } from './soul-key';

/**
 * Blue's membership wallet — the wallet that holds the VIP Membership NFT
 * supply and signs the transfer to each buyer after payment clears.
 *
 * This uses the same signer model as the rest of the app (an ethers Wallet
 * from a private key), not the Coinbase CDP SDK. The key is read from
 * BLUE_PRIVATE_KEY, falling back to the legacy AZURA_PRIVATE_KEY name.
 */

const ERC1155_ABI = [
  'function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)',
  'function balanceOf(address account, uint256 id) view returns (uint256)',
];

function getBaseRpcUrl(): string {
  return (
    process.env.VIP_MEMBERSHIP_CARD_RPC_URL ||
    process.env.BASE_MAINNET_RPC_URL ||
    process.env.BASE_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_RPC_URL ||
    'https://mainnet.base.org'
  );
}

function getBluePrivateKey(): string {
  const key = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!key) {
    throw new Error(
      'BLUE_PRIVATE_KEY or AZURA_PRIVATE_KEY is not set — Blue cannot sign the membership transfer.',
    );
  }
  return key.startsWith('0x') ? key : `0x${key}`;
}

/** Blue's wallet as an ethers signer connected to Base. */
export function getBlueSigner(): Wallet {
  const provider = new providers.StaticJsonRpcProvider(getBaseRpcUrl(), {
    chainId: 8453,
    name: 'base',
  });
  return new Wallet(getBluePrivateKey(), provider);
}

/**
 * The address the membership supply must be held in for sales to work.
 * Derived from the configured private key — no network call.
 */
export function getBlueWalletAddress(): string {
  return new Wallet(getBluePrivateKey()).address;
}

/**
 * Transfers `amount` of the membership token from Blue's wallet to a buyer.
 * Blue's wallet needs a small Base ETH balance to cover gas.
 */
export async function transferVipMembership(
  to: string,
  tokenId: string,
  amount: number = 1,
): Promise<{ txHash: string }> {
  if (!/^0x[a-fA-F0-9]{40}$/.test(to)) {
    throw new Error(`Invalid recipient address: ${to}`);
  }

  const signer = getBlueSigner();
  const contract = new Contract(VIP_MEMBERSHIP_CARD_ADDRESS, ERC1155_ABI, signer);

  console.log(`Transferring membership token ${tokenId} (x${amount}) to ${to}`);
  const tx = await contract.safeTransferFrom(
    signer.address,
    to,
    tokenId,
    amount,
    '0x',
  );
  const receipt = await tx.wait();

  console.log(`✅ Membership transferred. TX: ${receipt.transactionHash}`);
  return { txHash: receipt.transactionHash };
}
