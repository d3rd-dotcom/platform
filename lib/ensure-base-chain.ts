import { getChainConfig } from './chain-config';

export const BASE_CHAIN_ID = 8453;

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

function getProviderErrorCode(err: unknown): number | string | null {
  if (typeof err !== 'object' || err === null) return null;
  const code = (err as { code?: number | string }).code;
  return code ?? null;
}

/**
 * Switch the wallet to the active chain (Base, or Base Sepolia when the
 * testnet flag is on), adding the chain if it is unknown.
 */
export async function ensureBaseChain(eip1193: Eip1193Provider): Promise<void> {
  const cfg = getChainConfig();
  const targetHex = cfg.chainIdHex.toLowerCase();

  const current = await eip1193.request({ method: 'eth_chainId' }).catch(() => null);
  if (typeof current === 'string' && current.toLowerCase() === targetHex) return;

  try {
    await eip1193.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: cfg.chainIdHex }],
    });
  } catch (err) {
    const code = getProviderErrorCode(err);
    if (code !== 4902 && code !== '4902') throw err;
    await eip1193.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: cfg.chainIdHex,
        chainName: cfg.chainName,
        nativeCurrency: cfg.nativeCurrency,
        rpcUrls: [cfg.rpcUrl],
        blockExplorerUrls: [cfg.explorerUrl],
      }],
    });
  }

  const after = await eip1193.request({ method: 'eth_chainId' });
  if (typeof after !== 'string' || after.toLowerCase() !== targetHex) {
    throw new Error(`Switch your wallet to ${cfg.chainName} to continue.`);
  }
}
