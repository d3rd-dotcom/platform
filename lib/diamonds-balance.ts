import { Contract, providers, utils } from 'ethers';

const BALANCE_ABI = ['function balanceOf(address) view returns (uint256)'];
const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS || '';
const BASE_RPC = 'https://mainnet.base.org';

/**
 * Read the wallet's live $BLUE balance from Base, in whole diamonds.
 * Returns null when the token isn't configured or the RPC read fails —
 * callers fall back to the in-app credit mirror.
 */
export async function fetchDiamondBalance(address: string): Promise<number | null> {
  if (!TOKEN_ADDRESS || !address) return null;
  try {
    const provider = new providers.JsonRpcProvider(BASE_RPC);
    const token = new Contract(TOKEN_ADDRESS, BALANCE_ABI, provider);
    const raw = await token.balanceOf(address);
    return Math.floor(Number(utils.formatUnits(raw, 18)));
  } catch {
    return null;
  }
}
