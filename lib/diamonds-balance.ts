import { Contract, providers, utils } from 'ethers';
import { getDiamondsTokenAddress, getRpcUrl } from './chain-config';

const BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];

/**
 * Read the wallet's live $BLUE balance from Base, in whole diamonds.
 * Returns null when the token isn't configured or the RPC read fails —
 * callers fall back to the in-app credit mirror.
 */
export async function fetchDiamondBalance(address: string): Promise<number | null> {
  const tokenAddress = getDiamondsTokenAddress();
  if (!tokenAddress || !address) return null;
  try {
    const provider = new providers.JsonRpcProvider(getRpcUrl());
    const token = new Contract(tokenAddress, BALANCE_ABI, provider);
    const raw = await token.balanceOf(address);
    return Math.floor(Number(utils.formatUnits(raw, 18)));
  } catch {
    return null;
  }
}
