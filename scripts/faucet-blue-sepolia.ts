/**
 * Top up Blue's wallet with Base Sepolia ETH from the CDP faucet.
 * CDP grants up to 0.1 testnet ETH per 24h — plenty for deploys forever.
 *
 * Needs CDP secret API keys in .env.local (portal.cdp.coinbase.com →
 * API keys → Secret API keys). Either naming works:
 *   CDP_API_KEY_ID + CDP_API_KEY_SECRET            (current CDP names)
 *   CDP_API_KEY_NAME + CDP_API_KEY_PRIVATE_KEY     (legacy names blue-wallet.ts uses)
 *
 * Run:  npx tsx scripts/faucet-blue-sepolia.ts
 */
import path from 'path';
import { config } from 'dotenv';
import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, http, formatEther } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

config({ path: path.join(__dirname, '..', '.env.local') });

async function main() {
  const apiKeyId = process.env.CDP_API_KEY_ID || process.env.CDP_API_KEY_NAME;
  const apiKeySecret = process.env.CDP_API_KEY_SECRET || process.env.CDP_API_KEY_PRIVATE_KEY;
  if (!apiKeyId || !apiKeySecret) {
    throw new Error(
      'Set CDP_API_KEY_ID + CDP_API_KEY_SECRET (or CDP_API_KEY_NAME + CDP_API_KEY_PRIVATE_KEY) in .env.local',
    );
  }

  const raw = process.env.BLUE_PRIVATE_KEY || process.env.AZURA_PRIVATE_KEY;
  if (!raw) throw new Error('BLUE_PRIVATE_KEY / AZURA_PRIVATE_KEY not set');
  const blue = privateKeyToAccount((raw.startsWith('0x') ? raw : `0x${raw}`) as `0x${string}`);

  const rpc =
    process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org';
  const client = createPublicClient({ chain: baseSepolia, transport: http(rpc) });

  console.log('Blue:', blue.address);
  console.log('Before:', formatEther(await client.getBalance({ address: blue.address })), 'ETH');

  const cdp = new CdpClient({ apiKeyId, apiKeySecret });
  const { transactionHash } = await cdp.evm.requestFaucet({
    address: blue.address,
    network: 'base-sepolia',
    token: 'eth',
  });
  console.log('Faucet tx:', transactionHash);

  await client.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  console.log('After:', formatEther(await client.getBalance({ address: blue.address })), 'ETH');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
