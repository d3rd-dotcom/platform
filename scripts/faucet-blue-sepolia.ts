/**
 * Top up Blue's wallet from the CDP faucet on Base Sepolia — ETH, USDC, or
 * both (default). CDP grants up to 0.1 testnet ETH and 10 USDC per 24h.
 *
 * Needs CDP secret API keys in .env.local (portal.cdp.coinbase.com →
 * API keys → Secret API keys). Either naming works:
 *   CDP_API_KEY_ID + CDP_API_KEY_SECRET            (current CDP names)
 *   CDP_API_KEY_NAME + CDP_API_KEY_PRIVATE_KEY     (legacy names blue-wallet.ts uses)
 *
 * Run:  npx tsx scripts/faucet-blue-sepolia.ts             (ETH + USDC)
 *       npx tsx scripts/faucet-blue-sepolia.ts --token=eth
 *       npx tsx scripts/faucet-blue-sepolia.ts --token=usdc
 */
import path from 'path';
import { config } from 'dotenv';
import { CdpClient } from '@coinbase/cdp-sdk';
import { createPublicClient, http, formatEther, formatUnits, parseAbi } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

config({ path: path.join(__dirname, '..', '.env.local') });

const USDC_SEPOLIA = '0x036CbD53842c5426634e7929541eC2318f3dCF7e' as const;
const USDC_ABI = parseAbi(['function balanceOf(address) view returns (uint256)']);

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

  const tokenArg = process.argv.find((a) => a.startsWith('--token='))?.split('=')[1];
  const tokens: Array<'eth' | 'usdc'> = tokenArg === 'eth' ? ['eth'] : tokenArg === 'usdc' ? ['usdc'] : ['eth', 'usdc'];

  const balances = async () => ({
    eth: formatEther(await client.getBalance({ address: blue.address })),
    usdc: formatUnits(await client.readContract({ address: USDC_SEPOLIA, abi: USDC_ABI, functionName: 'balanceOf', args: [blue.address] }), 6),
  });

  console.log('Blue:', blue.address);
  const before = await balances();
  console.log('Before:', before.eth, 'ETH |', before.usdc, 'USDC');

  const cdp = new CdpClient({ apiKeyId, apiKeySecret });
  for (const token of tokens) {
    const { transactionHash } = await cdp.evm.requestFaucet({
      address: blue.address,
      network: 'base-sepolia',
      token,
    });
    console.log(`Faucet ${token} tx:`, transactionHash);
    await client.waitForTransactionReceipt({ hash: transactionHash as `0x${string}` });
  }

  const after = await balances();
  console.log('After:', after.eth, 'ETH |', after.usdc, 'USDC');
}

main().catch((e) => {
  console.error('FATAL:', e?.message ?? e);
  process.exit(1);
});
