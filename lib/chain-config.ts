/**
 * Chain-aware configuration for Diamonds ($BLUE) and related contracts.
 *
 * Toggle between Base mainnet and Base Sepolia via NEXT_PUBLIC_USE_TESTNET.
 * When set to 'true' (or '1'), all Diamonds flows (balance reads, mints,
 * burns, reflections) target the Sepolia deployment.
 */

export interface ChainConfig {
  chainId: number;
  chainIdHex: string;
  chainName: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  rpcUrl: string;
  explorerUrl: string;
  diamondsTokenAddress: string;
  reflectionVaultAddress: string | null;
  cbBTcAddress: string | null;
  usdcAddress: string;
}

const MAINNET: ChainConfig = {
  chainId: 8453,
  chainIdHex: '0x2105',
  chainName: 'Base',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrl: process.env.NEXT_PUBLIC_BASE_RPC_URL || 'https://mainnet.base.org',
  explorerUrl: 'https://basescan.org',
  diamondsTokenAddress:
    process.env.DIAMONDS_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_DIAMONDS_TOKEN_ADDRESS ||
    '0x4A25Cea1f05C6725dC90849FBaafF00d67342B3f',
  reflectionVaultAddress: null,
  cbBTcAddress: null,
  usdcAddress:
    process.env.NEXT_PUBLIC_USDC_ADDRESS ||
    '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
};

const SEPOLIA: ChainConfig = {
  chainId: 84532,
  chainIdHex: '0x14a34',
  chainName: 'Base Sepolia',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrl:
    process.env.BASE_SEPOLIA_RPC_URL ||
    process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC_URL ||
    'https://sepolia.base.org',
  explorerUrl: 'https://sepolia.basescan.org',
  diamondsTokenAddress:
    process.env.DIAMONDS_SEPOLIA_TOKEN_ADDRESS ||
    process.env.NEXT_PUBLIC_DIAMONDS_SEPOLIA_TOKEN_ADDRESS ||
    '0xd116e780ca9ec3984e7682e095aab50006a9c160',
  reflectionVaultAddress:
    process.env.DIAMONDS_SEPOLIA_VAULT_ADDRESS ||
    process.env.NEXT_PUBLIC_DIAMONDS_SEPOLIA_VAULT_ADDRESS ||
    '0xc8FfD11F157C71F58477Cc49a2bf25bc69683b20',
  cbBTcAddress:
    process.env.DIAMONDS_SEPOLIA_CBBTC_ADDRESS ||
    process.env.NEXT_PUBLIC_DIAMONDS_SEPOLIA_CBBTC_ADDRESS ||
    '0x71a92f9b94646e5119f82cd7b01c69da8ec3a352',
  // Circle's canonical USDC on Base Sepolia
  usdcAddress:
    process.env.NEXT_PUBLIC_USDC_SEPOLIA_ADDRESS ||
    '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
};

function isTestnet(): boolean {
  if (typeof process === 'undefined') return false;
  const v = process.env.NEXT_PUBLIC_USE_TESTNET || process.env.USE_TESTNET || '';
  return v === 'true' || v === '1' || v === 'yes';
}

export function getChainConfig(): ChainConfig {
  return isTestnet() ? SEPOLIA : MAINNET;
}

export function getDiamondsTokenAddress(): string {
  return getChainConfig().diamondsTokenAddress;
}

export function getReflectionVaultAddress(): string | null {
  return getChainConfig().reflectionVaultAddress;
}

export function getCbBTCAddress(): string | null {
  return getChainConfig().cbBTcAddress;
}

export function getRpcUrl(): string {
  return getChainConfig().rpcUrl;
}

export function getChainId(): number {
  return getChainConfig().chainId;
}

export const BURN_ADDRESS = '0x000000000000000000000000000000000000dEaD';

/** Canonical public RPC per chain — the safe fallback when env is wrong. */
const CANONICAL_RPC: Record<number, string> = {
  8453: 'https://mainnet.base.org',
  84532: 'https://sepolia.base.org',
};

/**
 * Server-side guard: confirm the configured RPC actually serves the active
 * chain, falling back to the canonical public RPC when it does not. A wrong
 * BASE_SEPOLIA_RPC_URL on Vercel once pointed Diamonds writes at mainnet —
 * StaticJsonRpcProvider trusts the declared chainId, so calls against
 * addresses with no code there fail with empty revert data (or worse,
 * silently no-op). Never trust the URL; ask it.
 */
export async function resolveVerifiedRpcUrl(): Promise<string> {
  const cfg = getChainConfig();
  const canonical = CANONICAL_RPC[cfg.chainId] || cfg.rpcUrl;
  try {
    const res = await fetch(cfg.rpcUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json().catch(() => null);
    const reported = data?.result ? parseInt(data.result, 16) : null;
    if (reported === cfg.chainId) return cfg.rpcUrl;
    console.error(
      `[chain-config] Configured RPC reports chain ${reported}, expected ${cfg.chainId} (${cfg.chainName}) — using ${canonical}`,
    );
    return canonical;
  } catch {
    console.error(`[chain-config] Configured RPC unreachable — using ${canonical}`);
    return canonical;
  }
}
