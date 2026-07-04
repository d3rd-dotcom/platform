export const BASE_CHAIN_ID = 8453;
const BASE_CHAIN_ID_HEX = '0x2105';
const BASE_CHAIN_PARAMS = {
  chainId: BASE_CHAIN_ID_HEX,
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: ['https://mainnet.base.org'],
  blockExplorerUrls: ['https://basescan.org'],
};

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getProviderErrorCode(err: unknown): number | string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: number | string }).code;
  return code ?? null;
}

/** Switch the wallet to Base, adding the chain if it is unknown. */
export async function ensureBaseChain(eip1193: Eip1193Provider): Promise<void> {
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
    throw new Error('Switch your wallet to Base to continue.');
  }
}
