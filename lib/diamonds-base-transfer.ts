import { Contract, providers, utils } from 'ethers';
import { getChainConfig, BURN_ADDRESS } from './chain-config';
import type { Eip1193Provider } from './usdc-base-transfer';

/**
 * Client-side $BLUE transfers from the user's connected wallet. Unlike
 * sendUsdcOnBase (mainnet-pinned for membership sales), Diamonds flows follow
 * chain-config — in testnet mode these run on Base Sepolia.
 */

const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address) view returns (uint256)',
];

function getProviderErrorCode(err: unknown): number | string | undefined {
  if (err && typeof err === 'object') {
    const e = err as { code?: number | string; data?: { originalError?: { code?: number | string } } };
    return e.code ?? e.data?.originalError?.code;
  }
  return undefined;
}

async function ensureDiamondsChain(eip1193: Eip1193Provider): Promise<void> {
  const cfg = getChainConfig();
  const current = await eip1193.request({ method: 'eth_chainId' }).catch(() => null);
  if (typeof current === 'string' && current.toLowerCase() === cfg.chainIdHex) return;

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
  if (typeof after !== 'string' || after.toLowerCase() !== cfg.chainIdHex) {
    throw new Error(`Switch your wallet to ${cfg.chainName} to spend diamonds.`);
  }
}

/** The connected wallet's whole-diamond $BLUE balance on the active chain. */
export async function readDiamondsBalance(walletAddress: string): Promise<number> {
  const cfg = getChainConfig();
  const provider = new providers.StaticJsonRpcProvider(cfg.rpcUrl, cfg.chainId);
  const token = new Contract(cfg.diamondsTokenAddress, ERC20_ABI, provider);
  const balance = await token.balanceOf(walletAddress);
  return Number(utils.formatUnits(balance, 18));
}

/**
 * Transfers `wholeDiamonds` $BLUE to `to` on the active Diamonds chain.
 * Throws if the user rejects or the wallet cannot reach the right network.
 * Returns the tx hash immediately — the server waits for confirmation.
 */
export async function sendDiamonds(
  eip1193: Eip1193Provider,
  to: string,
  wholeDiamonds: number,
): Promise<string> {
  await ensureDiamondsChain(eip1193);
  const web3Provider = new providers.Web3Provider(eip1193 as providers.ExternalProvider);
  const signer = web3Provider.getSigner();
  const cfg = getChainConfig();
  const token = new Contract(cfg.diamondsTokenAddress, ERC20_ABI, signer);
  const tx = await token.transfer(to, utils.parseUnits(String(wholeDiamonds), 18));
  return tx.hash as string;
}

/** Burns `wholeDiamonds` $BLUE from the user's wallet (transfer to 0xdEaD). */
export async function sendDiamondsBurn(
  eip1193: Eip1193Provider,
  wholeDiamonds: number,
): Promise<string> {
  return sendDiamonds(eip1193, BURN_ADDRESS, wholeDiamonds);
}
