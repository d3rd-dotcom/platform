import { Contract, providers } from 'ethers';

/**
 * Client-side helper to send an ERC-20 USDC transfer on Base from the user's
 * connected wallet. Mirrors the membership crypto-checkout flow so the quest
 * "Blue holds it" escrow deposit behaves identically. Returns the tx hash.
 */

const ERC20_TRANSFER_ABI = ['function transfer(address to, uint256 amount) returns (bool)'];
const BASE_CHAIN_ID_HEX = '0x2105';
const BASE_CHAIN_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export interface Eip1193Provider {
  request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
}

function getProviderErrorCode(err: unknown): number | string | undefined {
  if (err && typeof err === 'object') {
    const e = err as { code?: number | string; data?: { originalError?: { code?: number | string } } };
    return e.code ?? e.data?.originalError?.code;
  }
  return undefined;
}

async function ensureBaseChain(eip1193: Eip1193Provider): Promise<void> {
  const current = await eip1193.request({ method: 'eth_chainId' }).catch(() => null);
  if (typeof current === 'string' && current.toLowerCase() === BASE_CHAIN_ID_HEX) return;

  try {
    await eip1193.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: BASE_CHAIN_ID_HEX }],
    });
  } catch (err) {
    const code = getProviderErrorCode(err);
    if (code !== 4902 && code !== '4902') throw err;
    await eip1193.request({
      method: 'wallet_addEthereumChain',
      params: [BASE_CHAIN_PARAMS],
    });
  }

  const after = await eip1193.request({ method: 'eth_chainId' });
  if (typeof after !== 'string' || after.toLowerCase() !== BASE_CHAIN_ID_HEX) {
    throw new Error('Switch your wallet to Base to fund the quest.');
  }
}

/**
 * Transfers `amount` (USDC base units, 6 dp string) to `to` on Base.
 * Throws if the user rejects or the wallet is on the wrong network.
 */
export async function sendUsdcOnBase(
  eip1193: Eip1193Provider,
  usdcAddress: string,
  to: string,
  amount: string,
): Promise<string> {
  await ensureBaseChain(eip1193);
  const web3Provider = new providers.Web3Provider(eip1193 as providers.ExternalProvider);
  const signer = web3Provider.getSigner();
  const usdc = new Contract(usdcAddress, ERC20_TRANSFER_ABI, signer);
  const tx = await usdc.transfer(to, amount);
  return tx.hash as string;
}
