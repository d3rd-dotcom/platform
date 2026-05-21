import { Contract, providers } from 'ethers';
import { ensureBaseNetwork } from './blue-contract';

/**
 * Helpers for the MWG governance token (ERC20Votes). The app hides the word
 * "delegate" from users — they just "activate" their tokens. Under the hood,
 * activating = delegate(self), which is what makes a balance count as votes.
 *
 * Important: ERC20Votes voting power is snapshotted per proposal at the block it
 * was created. Activating only counts for proposals created AFTER you activate —
 * so we prompt people to activate as soon as they hold tokens, not at vote time.
 */

export const GOVERNANCE_TOKEN_ADDRESS =
  process.env.NEXT_PUBLIC_GOVERNANCE_TOKEN_ADDRESS ||
  '0x0Eb5956b043A3Cd95C0f050a86faff48B7aA28E7';

const TOKEN_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function delegates(address) view returns (address)',
  'function getVotes(address) view returns (uint256)',
  'function delegate(address delegatee)',
];

const ZERO = '0x0000000000000000000000000000000000000000';
const READ_RPC = process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org';

export interface VotingStatus {
  /** Raw token balance (18 decimals). */
  balance: bigint;
  /** Whole-token balance for display. */
  balanceWhole: number;
  /** Whether tokens are "activated" (self-delegated) so they count as votes. */
  isActive: boolean;
  hasTokens: boolean;
}

/** Read a wallet's token balance + whether it has activated its votes. */
export async function readVotingStatus(address: string): Promise<VotingStatus> {
  const provider = new providers.JsonRpcProvider(READ_RPC);
  const token = new Contract(GOVERNANCE_TOKEN_ADDRESS, TOKEN_ABI, provider);
  const [balanceRaw, delegate] = await Promise.all([
    token.balanceOf(address),
    token.delegates(address),
  ]);
  const balance = BigInt(balanceRaw.toString());
  return {
    balance,
    balanceWhole: Number(balance / 10n ** 18n),
    isActive: delegate && delegate.toLowerCase() === address.toLowerCase(),
    hasTokens: balance > 0n,
  };
}

/**
 * Activate the connected wallet's votes (delegate to self). Takes the user's
 * EIP-1193 provider (from wagmi connector.getProvider()). Returns the tx hash.
 */
export async function activateVotes(eip1193Provider: any): Promise<string> {
  const web3 = new providers.Web3Provider(eip1193Provider);
  await ensureBaseNetwork(web3);
  const signer = web3.getSigner();
  const me = await signer.getAddress();
  const token = new Contract(GOVERNANCE_TOKEN_ADDRESS, TOKEN_ABI, signer);
  const tx = await token.delegate(me);
  const receipt = await tx.wait();
  return receipt?.transactionHash || tx.hash;
}
